import pino from 'pino'

const isMcp = process.argv[1]?.includes('mcp-server')

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    ...(!isMcp &&
      process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
  },
  // MCP uses stdio for JSON-RPC, so all logs must go to stderr
  isMcp ? pino.destination(2) : undefined,
)
