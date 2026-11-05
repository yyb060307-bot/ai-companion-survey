import { PERSONA } from './persona.js';

/**
 * GET /api/health
 * 배포 상태 확인용. 비밀 값은 절대 노출하지 않습니다.
 */
export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      ok: true,
      anthropicConfigured: !!env.ANTHROPIC_API_KEY,
      rateLimitKv: !!env.RATE_LIMIT_KV,
      model: env.CLAUDE_MODEL || 'claude-haiku-5-5',
      promptVersion: PERSONA.version,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}
