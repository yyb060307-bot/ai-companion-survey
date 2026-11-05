/**
 * 저장 어댑터 (Supabase)
 * ------------------------------------------------------------
 * Supabase PostgREST에 survey_responses 이벤트를 insert합니다.
 * - anon key는 브라우저에 공개되는 키이므로, 반드시 RLS로 INSERT만 허용하세요.
 * - supabase/schema.sql을 먼저 실행해야 합니다.
 * - 설정이 비어 있으면 저장을 건너뛰고 콘솔에 경고만 남깁니다.
 */
(function (S) {
  S.services = S.services || {};

  function supabaseConfig() {
    return (S.config && S.config.supabase) || {};
  }

  function isConfigured() {
    var cfg = supabaseConfig();
    return !!(
      cfg.url &&
      cfg.anonKey &&
      cfg.url.indexOf('YOUR_PROJECT') < 0 &&
      cfg.anonKey.indexOf('YOUR_PUBLIC') < 0
    );
  }

  function endpoint() {
    var cfg = supabaseConfig();
    var base = String(cfg.url || '').replace(/\/+$/, '');
    var table = cfg.table || 'survey_responses';
    return base + '/rest/v1/' + table;
  }

  async function insert(row) {
    if (!isConfigured()) {
      console.warn(
        '[storage:supabase] 설정이 없어 저장을 건너뜁니다. survey/js/config.js의 supabase.url/anonKey를 채워 주세요.'
      );
      return { ok: true, persisted: false, reason: 'not_configured' };
    }

    var cfg = supabaseConfig();

    try {
      var response = await fetch(endpoint(), {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });

      if (!response.ok) {
        var detail = '';
        try {
          detail = await response.text();
        } catch (readError) {
          detail = '';
        }
        console.error('[storage:supabase] insert failed', response.status, detail);
        return { ok: false, persisted: false, status: response.status };
      }

      return { ok: true, persisted: true };
    } catch (error) {
      console.error('[storage:supabase] insert error', error);
      return { ok: false, persisted: false, error: String(error) };
    }
  }

  S.services.storage = {
    isConfigured: isConfigured,

    async savePage(pageId, payload) {
      return insert({
        response_id: S.state.meta.responseId,
        page_id: pageId,
        payload: payload,
      });
    },

    async saveChatBehavior(payload) {
      var llm = (payload && payload.llm) || {};
      return insert({
        response_id: S.state.meta.responseId,
        page_id: 'chat',
        payload: payload,
        model: llm.model || null,
        prompt_version: llm.promptVersion || null,
        input_tokens: llm.inputTokens || null,
        output_tokens: llm.outputTokens || null,
        latency_ms: llm.latencyMs || null,
      });
    },

    async saveCompletion(payload) {
      var llm = (payload && payload.chatBehavior && payload.chatBehavior.llm) || {};
      return insert({
        response_id: S.state.meta.responseId,
        page_id: 'completion',
        payload: payload,
        model: llm.model || null,
        prompt_version: llm.promptVersion || null,
        input_tokens: llm.inputTokens || null,
        output_tokens: llm.outputTokens || null,
        latency_ms: llm.latencyMs || null,
      });
    },
  };
})(window.Survey = window.Survey || {});
