import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: InstanceType<typeof ZAI> | null = null

/**
 * Initialize the Z-AI SDK using environment variables.
 *
 * The SDK's `ZAI.create()` reads from a `.z-ai-config` file on disk,
 * which doesn't exist on Vercel's read-only serverless filesystem.
 * Instead, we use `new ZAI(config)` directly with env vars.
 *
 * Required env vars (set in Vercel dashboard):
 *   ZAI_BASE_URL  - API base URL
 *   ZAI_API_KEY   - API key
 *   ZAI_CHAT_ID   - (optional) chat session ID
 *   ZAI_TOKEN     - (optional) JWT token
 *   ZAI_USER_ID   - (optional) user ID
 */
export async function getZAI() {
  if (!zaiInstance) {
    const baseUrl = process.env.ZAI_BASE_URL
    const apiKey = process.env.ZAI_API_KEY

    if (baseUrl && apiKey) {
      // Use env vars directly — works on Vercel serverless
      zaiInstance = new ZAI({
        baseUrl,
        apiKey,
        chatId: process.env.ZAI_CHAT_ID || '',
        token: process.env.ZAI_TOKEN || '',
        userId: process.env.ZAI_USER_ID || '',
      })
    } else {
      // Fallback: let the SDK read from .z-ai-config file (local dev)
      zaiInstance = await ZAI.create()
    }
  }
  return zaiInstance
}
