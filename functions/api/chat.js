/**
 * POST /api/chat
 * ------------------------------------------------------------
 * Claude Messages API 서버 프록시.
 *
 * - ANTHROPIC_API_KEY는 Cloudflare Secret에만 저장합니다.
 * - 시스템 프롬프트, 모델, 토큰 상한은 모두 서버에서 고정합니다.
 * - 클라이언트는 대화 메시지만 보냅니다.
 *
 * 환경 변수(모두 선택, 기본값 있음):
 *   ANTHROPIC_API_KEY   (필수)
 *   CLAUDE_MODEL        기본 claude-haiku-5-5
 *   MAX_USER_TURNS      기본 20
 *   MAX_MESSAGE_CHARS   기본 500
 *   MAX_TOTAL_CHARS     기본 6000
 *   DAILY_BUDGET_USD    기본 2
 *   ALLOWED_ORIGINS     쉼표 구분 추가 허용 오리진 (same-origin은 자동 허용)
 *   RATE_LIMIT_KV       (선택 KV 바인딩) 요청 제한·일일 예산 카운터
 */

import { PERSONA } from './persona.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2026-10-21';
const DEFAULT_MODEL = 'claude-haiku-5-5';

const CRISIS_KEYWORDS = [
  '자살', '자해', '죽고 싶', '죽어버', '죽을래', '극단적',
  '손목을', '목숨', '살해', '해치고', '죽이고', '성폭력', '학대',
];

const CRISIS_SUFFIX = `

[안전 우선] 마지막 사용자 메시지에 자해·자살·폭력·학대의 암시가 있습니다. 공감을 먼저 표현한 뒤, 109(자살예방상담), 1577-0199(정신건강상담), 119(응급) 안내를 반드시 포함하고, 필요하면 대화를 잠시 멈추고 주변의 도움을 받도록 권유하세요.`;

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
      headers || {}
    ),
  });
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(function (item) {
      return item.trim().replace(/\/+$/, '');
    })
    .filter(Boolean);
}

function resolveOrigin(request, env) {
  var origin = request.headers.get('Origin') || '';
  if (!origin) return { allowed: true, origin: '' };

  var selfOrigin = new URL(request.url).origin;
  var allowed = splitList(env.ALLOWED_ORIGINS);
  var ok = origin === selfOrigin || allowed.indexOf(origin) >= 0;
  return { allowed: ok, origin: origin };
}

function corsHeaders(resolvedOrigin) {
  if (!resolvedOrigin.allowed || !resolvedOrigin.origin) return {};
  return {
    'access-control-allow-origin': resolvedOrigin.origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function numberEnv(value, fallback) {
  var parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function detectCrisis(messages) {
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    var text = messages[i].content;
    for (var j = 0; j < CRISIS_KEYWORDS.length; j++) {
      if (text.indexOf(CRISIS_KEYWORDS[j]) >= 0) return true;
    }
    return false;
  }
  return false;
}

/**
 * 클라이언트 메시지를 Messages API 형식으로 정리합니다.
 * - user/assistant만 허용
 * - 선행 assistant(인사말) 제거, 마지막은 반드시 user
 * - 연속 동일 role 병합
 * - 길이·개수 상한 적용
 */
function sanitizeMessages(raw, maxChars, maxTotalChars) {
  var out = [];

  if (!Array.isArray(raw)) return out;

  for (var i = 0; i < raw.length; i++) {
    var message = raw[i];
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) continue;
    if (typeof message.content !== 'string') continue;

    var content = message.content.trim();
    if (!content) continue;
    if (content.length > maxChars) content = content.slice(0, maxChars);

    var last = out[out.length - 1];
    if (last && last.role === message.role) {
      last.content = (last.content + '\n' + content).slice(0, maxChars);
    } else {
      out.push({ role: message.role, content: content });
    }
  }

  while (out.length && out[0].role === 'assistant') out.shift();
  while (out.length && out[out.length - 1].role === 'assistant') out.pop();

  // 오래된 메시지부터 잘라 전체 길이를 제한합니다.
  var total = 0;
  var kept = [];
  for (var k = out.length - 1; k >= 0; k--) {
    total += out[k].content.length;
    if (total > maxTotalChars) break;
    kept.unshift(out[k]);
  }

  // 자른 뒤 user로 시작하도록 앞쪽 assistant를 제거합니다.
  while (kept.length && kept[0].role === 'assistant') kept.shift();
  return kept;
}

function countUserTurns(messages) {
  var count = 0;
  for (var i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') count += 1;
  }
  return count;
}

async function hashIdentifier(value) {
  try {
    var data = new TextEncoder().encode(String(value));
    var digest = await crypto.subtle.digest('SHA-256', data);
    var bytes = Array.from(new Uint8Array(digest)).slice(0, 16);
    return bytes.map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  } catch (error) {
    return 'anon';
  }
}

async function readCounter(env, key) {
  if (!env.RATE_LIMIT_KV) return 0;
  var raw = await env.RATE_LIMIT_KV.get(key);
  return Number(raw) || 0;
}

async function bumpCounter(env, key, ttlSeconds) {
  if (!env.RATE_LIMIT_KV) return null;
  var current = await readCounter(env, key);
  var next = current + 1;
  await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlSeconds });
  return next;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function estimateCostUsd(usage, model) {
  // Haiku 5.5 기본 단가: input $0.10 / output $0.50 per MTok
  var inputPrice = 0.10;
  var outputPrice = 0.50;

  if (model && model.indexOf('sonnet') >= 0) {
    inputPrice = 2.00;
    outputPrice = 10.00;
  } else if (model && model.indexOf('opus') >= 0) {
    inputPrice = 5.00;
    outputPrice = 25.00;
  }

  return (
    ((usage.input_tokens || 0) * inputPrice + (usage.output_tokens || 0) * outputPrice) / 1e6
  );
}

async function recordSpend(env, usage, model) {
  if (!env.RATE_LIMIT_KV) return;
  var key = 'budget:' + todayKey();
  var spent = await readCounter(env, key);
  var cost = estimateCostUsd(usage, model);
  await env.RATE_LIMIT_KV.put(key, String(spent + cost), { expirationTtl: 172800 });
}

function mapUpstreamError(status, data) {
  if (status === 429) return { status: 429, code: 'rate_limited', message: '요청이 너무 많습니다.' };
  if (status === 529 || status === 503) {
    return { status: 503, code: 'overloaded', message: '대화 서버가 잠시 혼잡합니다.' };
  }
  if (status === 400) {
    return { status: 400, code: 'invalid_request', message: '메시지를 처리하지 못했습니다.' };
  }
  if (status === 401 || status === 403) {
    return { status: 500, code: 'server_error', message: '서버 설정 오류입니다.' };
  }
  if (data && data.error && data.error.type === 'overloaded_error') {
    return { status: 503, code: 'overloaded', message: '대화 서버가 잠시 혼잡합니다.' };
  }
  return { status: 502, code: 'upstream_error', message: '응답을 불러오지 못했습니다.' };
}

export async function onRequestOptions(context) {
  var resolvedOrigin = resolveOrigin(context.request, context.env);
  if (!resolvedOrigin.allowed) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(resolvedOrigin),
  });
}

export async function onRequestPost(context) {
  var request = context.request;
  var env = context.env;
  var waitUntil = null;

  if (typeof context.waitUntil === 'function') {
    waitUntil = context.waitUntil.bind(context);
  } else if (context.ctx && typeof context.ctx.waitUntil === 'function') {
    waitUntil = context.ctx.waitUntil.bind(context.ctx);
  }

  var resolvedOrigin = resolveOrigin(request, env);
  var cors = corsHeaders(resolvedOrigin);

  if (!resolvedOrigin.allowed) {
    return json({ error: 'forbidden_origin', message: '허용되지 않은 출처입니다.' }, 403, cors);
  }

  if (!env.ANTHROPIC_API_KEY) {
    return json(
      { error: 'server_error', message: '서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다.' },
      500,
      cors
    );
  }

  var contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 100000) {
    return json({ error: 'payload_too_large' }, 413, cors);
  }

  var body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'invalid_json', message: '요청 형식이 올바르지 않습니다.' }, 400, cors);
  }

  var maxUserTurns = numberEnv(env.MAX_USER_TURNS, 20);
  var maxMessageChars = numberEnv(env.MAX_MESSAGE_CHARS, 500);
  var maxTotalChars = numberEnv(env.MAX_TOTAL_CHARS, 6000);
  var model = env.CLAUDE_MODEL || DEFAULT_MODEL;

  var messages = sanitizeMessages(body && body.messages, maxMessageChars, maxTotalChars);
  if (!messages.length) {
    return json({ error: 'invalid_messages', message: '대화 내용이 없습니다.' }, 400, cors);
  }

  var userTurns = countUserTurns(messages);
  if (userTurns > maxUserTurns) {
    return json(
      { error: 'turn_limit', message: '대화 가능한 최대 횟수에 도달했습니다.', maxUserTurns: maxUserTurns },
      429,
      cors
    );
  }

  var ip = request.headers.get('cf-connecting-ip') || 'unknown';
  var sessionId = (body && body.sessionId ? String(body.sessionId) : '').slice(0, 64);

  if (env.RATE_LIMIT_KV) {
    var minuteCount = await bumpCounter(env, 'rl:min:' + ip, 60);
    if (minuteCount && minuteCount > numberEnv(env.RATE_LIMIT_PER_MINUTE, 8)) {
      return json(
        { error: 'rate_limited', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        429,
        cors
      );
    }

    // 일일 예산 소프트 가드 (KV는 결과적 일관성이므로 강한 보장은 아닙니다)
    var budget = numberEnv(env.DAILY_BUDGET_USD, 2);
    var spent = await readCounter(env, 'budget:' + todayKey());
    if (spent >= budget) {
      return json(
        { error: 'daily_budget_exceeded', message: '오늘의 대화 한도에 도달했습니다. 내일 다시 시도해 주세요.' },
        429,
        cors
      );
    }
  }

  var crisis = detectCrisis(messages);
  var userId = await hashIdentifier(sessionId || ip);

  var payload = {
    model: model,
    max_tokens: numberEnv(env.MAX_OUTPUT_TOKENS, 300),
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: (PERSONA.systemPrompt || '') + (crisis ? CRISIS_SUFFIX : ''),
    messages: messages,
    metadata: { user_id: 'sess-' + userId },
  };

  var upstream;
  try {
    upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return json(
      { error: 'upstream_unreachable', message: '대화 서버에 연결하지 못했습니다.' },
      502,
      cors
    );
  }

  var data = null;
  try {
    data = await upstream.json();
  } catch (error) {
    data = null;
  }

  if (!upstream.ok) {
    var mapped = mapUpstreamError(upstream.status, data);
    return json({ error: mapped.code, message: mapped.message }, mapped.status, cors);
  }

  var reply = (data && Array.isArray(data.content) ? data.content : [])
    .filter(function (block) {
      return block && block.type === 'text' && typeof block.text === 'string';
    })
    .map(function (block) {
      return block.text;
    })
    .join('\n')
    .trim();

  if (!reply) {
    return json(
      { error: 'empty_reply', message: '응답이 비어 있습니다. 다시 시도해 주세요.' },
      502,
      cors
    );
  }

  var usage = {
    input_tokens: (data.usage && data.usage.input_tokens) || 0,
    output_tokens: (data.usage && data.usage.output_tokens) || 0,
    cache_read_input_tokens: (data.usage && data.usage.cache_read_input_tokens) || 0,
    cache_creation_input_tokens: (data.usage && data.usage.cache_creation_input_tokens) || 0,
  };

  if (waitUntil) {
    waitUntil(recordSpend(env, usage, model));
  }

  return json(
    {
      reply: reply,
      usage: usage,
      model: data.model || model,
      promptVersion: PERSONA.version,
      requestId: upstream.headers.get('request-id') || crypto.randomUUID(),
      userTurns: userTurns,
      crisisFlag: crisis,
    },
    200,
    cors
  );
}
