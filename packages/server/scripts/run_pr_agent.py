"""
Wrapper to run PR-Agent tools and capture their output to stdout.
Monkey-patches the GitLab provider's publish methods to intercept output
instead of posting to GitLab.

Output protocol (line-based, read by Node backend):
  [CHUNK] ...    → a piece of PR-Agent output (streamed live)
  [PROMPT] ...   → the actual LLM prompt JSON (system + user)
  [DONE]         → all chunks sent
"""
import asyncio
import json
import os
import sys
import urllib.request
import time

# Suppress python-dotenv warnings
import logging
logging.getLogger("dotenv.main").setLevel(logging.ERROR)

from pr_agent.log import setup_logger
setup_logger(os.environ.get("LOG_LEVEL", "INFO"))


def emit(tag: str, data: str):
    """Write a tagged line to stdout and flush immediately."""
    for line in data.split("\n"):
        print(f"[{tag}] {line}", flush=True)


OPENCODE_URL = os.environ.get("OPENCODE_URL", "http://localhost:4096")
OPENCODE_MODEL = os.environ.get("OPENCODE_MODEL", "")  # "providerID/modelID"


def _oc_request(path: str, method: str = "GET", body: dict | None = None):
    """Simple HTTP helper for OpenCode API."""
    url = f"{OPENCODE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        if not raw:
            return None
        return json.loads(raw)


# ── Monkey-patch LLM handler to route through OpenCode ──

from pr_agent.algo.ai_handlers.litellm_ai_handler import LiteLLMAIHandler

import re

def _strip_pr_description(user_prompt: str) -> str:
    """Strip the PR description section from the user prompt to save tokens.
    Keeps title and branch for context, removes description body (often empty templates, images)."""
    # Remove the PR Description block between ====== markers
    stripped = re.sub(
        r"PR Description:\s*\n======\n[\s\S]*?\n======",
        "PR Description: (stripped to save tokens)",
        user_prompt,
    )
    # Remove markdown images ![...](...)
    stripped = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", stripped)
    # Collapse multiple blank lines
    stripped = re.sub(r"\n{3,}", "\n\n", stripped)
    return stripped


async def _patched_chat_completion(self, model, system, user, temperature=0.2, img_path=None):
    temperature = 0  # deterministic reviews
    user = _strip_pr_description(user)

    prompt_data = {
        "model": model,
        "system": system[:500] + ("..." if len(system) > 500 else ""),
        "system_length": len(system),
        "user": user[:500] + ("..." if len(user) > 500 else ""),
        "user_length": len(user),
        "temperature": temperature,
    }
    emit("PROMPT", json.dumps(prompt_data))

    if os.environ.get("PR_AGENT_DEBUG_PROMPTS") == "1":
        emit("FULL_SYSTEM", system)
        emit("FULL_USER", user)

    # Create a fresh session per LLM call to avoid message confusion
    session = _oc_request("/session", method="POST", body={"title": "[dashboard] pr-agent-llm"})
    session_id = session["id"]

    structured_suffix = """

IMPORTANT ADDITIONAL INSTRUCTION: After your normal response, you MUST also output a structured JSON summary inside <structured_json> tags. The JSON must match this schema exactly:
{
  "tool": "review" | "describe" | "improve" | "ask",
  "summary": "one-line summary of the result",
  "items": [
    {
      "severity": "critical" | "warning" | "suggestion" | "info",
      "title": "short title",
      "file": "path/to/file (if applicable, otherwise omit)",
      "line": 42,
      "body": "markdown description",
      "suggestion": "code suggestion if applicable (otherwise omit)"
    }
  ]
}
Rules for the JSON:
- "tool" must match the current operation (review/describe/improve/ask)
- Every piece of feedback becomes an item
- For /review: map severity ("Major" → "critical", "Medium" → "warning", "Minor/Low" → "suggestion")
- For /improve: each suggestion is an item with severity "suggestion", include file/line
- For /describe: use "info" severity, put description sections as items
- For /ask: use a single "info" item with the answer
- Preserve all markdown formatting in "body"
Output format: your normal markdown response first, then <structured_json>{...}</structured_json> at the very end."""

    combined_prompt = f"<system>\n{system}\n{structured_suffix}\n</system>\n\n{user}"
    body: dict = {
        "parts": [{"type": "text", "text": combined_prompt}],
    }
    if OPENCODE_MODEL:
        provider_id, _, model_id = OPENCODE_MODEL.partition("/")
        if provider_id and model_id:
            body["model"] = {"providerID": provider_id, "modelID": model_id}

    # Count existing assistant messages so we can detect the new one
    msgs_before = _oc_request(f"/session/{session_id}/message") or []
    assistant_count_before = sum(
        1 for m in msgs_before
        if isinstance(m, dict) and m.get("info", {}).get("role") == "assistant"
    )

    _oc_request(f"/session/{session_id}/prompt_async", method="POST", body=body)

    # Poll for assistant response — wait until session is idle and a new message exists
    deadline = time.time() + 180
    while time.time() < deadline:
        time.sleep(2)
        # Check if session is done generating
        try:
            statuses = _oc_request("/session/status")
            status = (statuses or {}).get(session_id)
            if status is not None and status.get("type") != "idle":
                continue
        except Exception:
            continue
        msgs = _oc_request(f"/session/{session_id}/message")
        if not isinstance(msgs, list):
            continue
        assistants = [m for m in msgs if m.get("info", {}).get("role") == "assistant"]
        if len(assistants) <= assistant_count_before:
            continue  # new response hasn't arrived yet
        last = assistants[-1]
        parts = last.get("parts", [])
        texts = [p["text"] for p in parts if p.get("type") == "text" and p.get("text")]
        if texts:
            response_text = "".join(texts)
            return response_text, "stop"

    raise RuntimeError("OpenCode did not respond within timeout")

LiteLLMAIHandler.chat_completion = _patched_chat_completion


# ── Monkey-patch GitLab provider to stream output ──

from pr_agent.git_providers import gitlab_provider
from pr_agent.git_providers import _GIT_PROVIDERS
_OriginalProvider = gitlab_provider.GitLabProvider

captured_output: list[str] = []

def _capture_and_stream(text: str):
    captured_output.append(text)
    emit("CHUNK", text)


class CapturingGitLabProvider(_OriginalProvider):
    def publish_comment(self, mr_comment, is_temporary=False):
        if is_temporary:
            return
        # Skip progress/loading comments (e.g. "Work in progress ..." with gif)
        if "Work in progress" in mr_comment and "loading" in mr_comment:
            self._progress_comment = mr_comment  # store ref so remove_initial_comment works
            return
        _capture_and_stream(mr_comment)

    def publish_persistent_comment(self, pr_comment, **kwargs):
        _capture_and_stream(pr_comment)

    def publish_description(self, pr_title, pr_body):
        _capture_and_stream(f"# {pr_title}\n\n{pr_body}")

    def publish_inline_comment(self, body, relevant_file, relevant_line_in_file, original_suggestion=None):
        _capture_and_stream(f"**{relevant_file}:{relevant_line_in_file}**\n{body}")

    def publish_code_suggestions(self, code_suggestions):
        for s in code_suggestions:
            body = s.get("body", "")
            path = s.get("relevant_file", "")
            _capture_and_stream(f"**{path}**\n{body}")
        return True

    def publish_file_comments(self, file_comments):
        for c in file_comments:
            body = c.get("body", "")
            path = c.get("relevant_file", "")
            _capture_and_stream(f"**{path}**\n{body}")
        return True

    def publish_labels(self, pr_types):
        pass

    def publish_inline_comments(self, comments):
        for c in comments:
            body = c.get("body", "")
            path = c.get("relevant_file", c.get("path", ""))
            _capture_and_stream(f"**{path}**\n{body}")

    def remove_initial_comment(self):
        pass

    def remove_comment(self, comment):
        pass


gitlab_provider.GitLabProvider = CapturingGitLabProvider
_GIT_PROVIDERS["gitlab"] = CapturingGitLabProvider


async def main():
    import traceback as tb
    from pr_agent.agent.pr_agent import PRAgent, command2class

    pr_url = os.environ.get("PR_URL")
    tool = os.environ.get("PR_TOOL", "review")
    question = os.environ.get("PR_AGENT_QUESTION", "")

    if not pr_url:
        print("ERROR: PR_URL not set", file=sys.stderr)
        sys.exit(1)

    # Run the tool directly for better error visibility
    args = []
    if tool == "ask" and question:
        args.append(question)

    try:
        await PRAgent().handle_request(pr_url, [tool] + args)
    except Exception as e:
        print(f"Exception running /{tool}: {e}", file=sys.stderr)
        tb.print_exc(file=sys.stderr)

    # Fallback: check if PR-Agent stored the result in settings.data
    if not captured_output:
        try:
            from pr_agent.config_loader import get_settings
            data = get_settings().get("data", {})
            artifact = data.get("artifact") if isinstance(data, dict) else getattr(data, "artifact", None)
            if artifact:
                print(f"[DEBUG] Found artifact in settings.data, len={len(str(artifact))}", file=sys.stderr)
                _capture_and_stream(str(artifact))
        except Exception:
            pass

    if captured_output:
        print("[DONE]", flush=True)
    else:
        print(f"No output captured (tool={tool})", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
