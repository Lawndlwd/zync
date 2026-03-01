// Cost per 1M tokens: [input, output]
const MODEL_COSTS: Record<string, [number, number]> = {
  'gpt-4o': [2.50, 10.00],
  'gpt-4o-mini': [0.15, 0.60],
  'gpt-4-turbo': [10.00, 30.00],
  'gpt-4': [30.00, 60.00],
  'gpt-3.5-turbo': [0.50, 1.50],
  'claude-3-opus': [15.00, 75.00],
  'claude-3-sonnet': [3.00, 15.00],
  'claude-3-haiku': [0.25, 1.25],
  'claude-3.5-sonnet': [3.00, 15.00],
  'claude-3.5-haiku': [0.80, 4.00],
  // Local models are free
  'llama3.2': [0, 0],
  'llama3.1': [0, 0],
  'llama3': [0, 0],
  'mistral': [0, 0],
  'mixtral': [0, 0],
  'codellama': [0, 0],
  'phi3': [0, 0],
  'gemma2': [0, 0],
  'qwen2.5': [0, 0],
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  // Try exact match, then prefix match
  const key = Object.keys(MODEL_COSTS).find(
    (k) => model === k || model.startsWith(k)
  )
  if (!key) return null
  const [inputCost, outputCost] = MODEL_COSTS[key]
  return (promptTokens * inputCost + completionTokens * outputCost) / 1_000_000
}
