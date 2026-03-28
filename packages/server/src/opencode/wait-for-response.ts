import { streamOpenCode } from './stream.js'

/**
 * Send a prompt and wait for the complete response text via SSE streaming.
 * Replaces all polling patterns (sendPromptAsync + getResponse/waitForReply).
 */
export async function waitForResponse(
  sessionId: string,
  prompt: string,
  opts?: { timeoutMs?: number },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    streamOpenCode(
      sessionId,
      prompt,
      {
        onToken: () => {},
        onDone: (fullText) => resolve(fullText),
        onError: (err) => reject(err),
      },
      { timeoutMs: opts?.timeoutMs ?? 120_000 },
    ).catch(reject)
  })
}
