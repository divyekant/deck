import { getSettings } from "./settings"

const REQUIRED_BETAS = "oauth-2025-04-20,interleaved-thinking-2025-05-14"

export function isOAuthToken(token: string): boolean {
  return token.startsWith("sk-ant-oat01-")
}

/**
 * Returns the environment variables needed to authenticate the Claude CLI.
 * - OAuth tokens → ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BETAS
 * - API keys → ANTHROPIC_API_KEY
 * - Env var fallback → passes through existing ANTHROPIC_API_KEY from process.env
 */
export async function getAuthEnv(): Promise<Record<string, string>> {
  const settings = await getSettings()
  const token = settings.authToken?.trim()

  if (token) {
    if (isOAuthToken(token)) {
      return {
        ANTHROPIC_AUTH_TOKEN: token,
        ANTHROPIC_BETAS: REQUIRED_BETAS,
      }
    }
    return { ANTHROPIC_API_KEY: token }
  }

  // Fall back to env var if no token configured in settings
  if (process.env.ANTHROPIC_API_KEY) {
    return { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
  }

  return {}
}
