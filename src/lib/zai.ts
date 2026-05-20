import ZAI, { type ZAIConfig } from 'z-ai-web-dev-sdk'

let zaiInstance: ZAI | null = null

/**
 * Get ZAI SDK instance — uses env vars on Vercel, config file locally.
 * Returns null if no configuration is available (LLM features disabled gracefully).
 */
export async function getZAI(): Promise<ZAI | null> {
  if (zaiInstance) return zaiInstance

  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY

  if (baseUrl && apiKey) {
    try {
      // The SDK's TypeScript types declare constructor as private,
      // but the JS runtime supports direct instantiation with config.
      // This is the ONLY way to use the SDK on Vercel (no config file).
      const config: ZAIConfig = {
        baseUrl,
        apiKey,
        chatId: process.env.ZAI_CHAT_ID || '',
        token: process.env.ZAI_TOKEN || '',
        userId: process.env.ZAI_USER_ID || '',
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      zaiInstance = new (ZAI as any)(config) as ZAI
      return zaiInstance
    } catch (error) {
      console.warn('[ZAI] Failed to initialize with env vars:', error)
      return null
    }
  }

  // Fallback: try reading from .z-ai-config file (local dev only)
  try {
    zaiInstance = await ZAI.create()
    return zaiInstance
  } catch {
    console.warn('[ZAI] No config file found and no env vars set. LLM features will use regex fallback.')
    return null
  }
}

/**
 * Check if LLM (chat completions) is available.
 */
export async function isLLMAvailable(): Promise<boolean> {
  const zai = await getZAI()
  return zai !== null
}
