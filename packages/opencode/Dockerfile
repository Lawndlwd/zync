FROM node:24-bookworm-slim

ARG OPENCODE_VERSION=1.3.3
ARG TARGETARCH

# Install runtime dependencies (git needed by opencode, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install opencode binary from GitHub releases
# Asset naming: opencode-linux-x64.tar.gz / opencode-linux-arm64.tar.gz
RUN ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "x64") && \
    curl -fsSL "https://github.com/anomalyco/opencode/releases/download/v${OPENCODE_VERSION}/opencode-linux-${ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin && \
    chmod +x /usr/local/bin/opencode

WORKDIR /app
RUN corepack enable pnpm

# Install workspace dependencies (only what the MCP server needs)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

# Copy source for shared + server (MCP server lives inside server package)
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Build shared + server so MCP tools can run
RUN pnpm --filter @zync/shared build && \
    pnpm --filter @zync/server build

# Set up opencode config and data directories
RUN mkdir -p /home/node/.config/opencode /home/node/.local/share/opencode \
    /app/packages/server/data && \
    chown -R node:node /home/node /app/packages/server/data

# Copy the project-level opencode.json
COPY opencode.json ./

# Entrypoint script that generates config and starts opencode serve
COPY packages/opencode/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

EXPOSE 4096
ENTRYPOINT ["/entrypoint.sh"]
