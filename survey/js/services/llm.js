/**
 * LLM 어댑터
 * ------------------------------------------------------------
 * 브라우저는 Cloudflare Functions의 /api/chat 프록시만 호출합니다.
 * Anthropic API 키는 절대 이 파일이나 다른 프론트엔드 코드에 두지 마세요.
 */
(function (S) {
  S.services = S.services || {};

  var MOCK_REPLIES = [
    '그렇게 느끼셨군요. 조금 더 이야기해 주실 수 있을까요?',
    '말씀해 주셔서 고마워요. 그 상황에서 어떤 감정이 가장 크게 남았나요?',
    '듣고 있어요. 그때 가장 힘들었던 부분은 무엇이었나요?',
    '그런 생각이 드셨던 이유가 궁금해요. 조금 더 들려주실래요?',
    '지금 이야기를 나누면서 어떤 느낌이 드세요?',
    '충분히 그럴 수 있다고 생각해요. 그 마음을 어떻게 표현하고 싶으세요?',
  ];

  function pickReply(text) {
    if (!text) return MOCK_REPLIES[0];
    if (text.indexOf('외로') >= 0) {
      return '외로움을 이야기해 주셨네요. 그 감정이 들 때 주로 무엇을 하시게 되나요?';
    }
    if (text.indexOf('친구') >= 0 || text.indexOf('사람') >= 0) {
      return '사람과의 관계에 대한 이야기군요. 그 관계에서 어떤 점이 가장 마음에 남나요?';
    }
    if (text.indexOf('안녕') >= 0) {
      return '안녕하세요. 반가워요. 오늘은 어떤 이야기를 편하게 나눠볼까요?';
    }
    return MOCK_REPLIES[Math.abs(text.length) % MOCK_REPLIES.length];
  }

  function abortError() {
    if (typeof DOMException === 'function') {
      return new DOMException('Aborted', 'AbortError');
    }
    var error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  }

  function ensureUsageState() {
    var behavior = S.state.chat.behavior;
    if (!behavior.llm) {
      behavior.llm = {
        model: null,
        promptVersion: null,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        errors: 0,
      };
    }
    return behavior.llm;
  }

  S.services.llm = {
    get config() {
      return S.config.llm;
    },

    /**
     * @param {{ messages: Array<{role:string, content:string}>, character: object, signal?: AbortSignal }} params
     * @returns {Promise<{text:string, usage:object|null, model:string, promptVersion:string|null, latencyMs:number|null}>}
     */
    async send(params) {
      var provider = this.config.provider;
      if (provider === 'mock') {
        var text = await this.mockReply(params.messages, params.character, params.signal);
        return {
          text: text,
          usage: null,
          model: 'mock',
          promptVersion: null,
          latencyMs: null,
        };
      }
      if (provider === 'claude') {
        return this.callClaude(params);
      }
      throw new Error('지원하지 않는 LLM provider입니다: ' + provider);
    },

    mockReply(messages, character, signal) {
      var lastUser = null;
      for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUser = messages[i];
          break;
        }
      }
      var text = lastUser ? lastUser.content : '';
      var delay = 550 + Math.min(1100, text.length * 18);

      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          resolve(pickReply(text));
        }, delay);

        if (signal) {
          if (signal.aborted) {
            clearTimeout(timer);
            reject(abortError());
            return;
          }
          signal.addEventListener('abort', function () {
            clearTimeout(timer);
            reject(abortError());
          }, { once: true });
        }
      });
    },

    /**
     * Cloudflare Functions 프록시 호출.
     * 서버가 시스템 프롬프트와 모델을 고정하므로 클라이언트는 대화 메시지만 보냅니다.
     */
    async callClaude(params) {
      var cfg = this.config;
      var endpoint = cfg.endpoint || '/api/chat';
      var timeoutMs = cfg.timeoutMs || 30000;
      var behavior = S.state.chat.behavior;
      var usageState = ensureUsageState();

      var controller = new AbortController();
      var timedOut = false;
      var external = params.signal;
      var onExternalAbort = function () {
        controller.abort();
      };

      if (external) {
        if (external.aborted) throw abortError();
        external.addEventListener('abort', onExternalAbort, { once: true });
      }

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      var startedAt = (window.performance && performance.now) ? performance.now() : Date.now();

      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: S.state.meta.responseId,
            characterId: params.character && params.character.id,
            messages: this.toClaudeMessages(params.messages),
          }),
          signal: controller.signal,
        });

        var data = null;
        try {
          data = await response.json();
        } catch (parseError) {
          data = null;
        }

        if (!response.ok) {
          var errorCode =
            data && typeof data.error === 'string'
              ? data.error
              : (data && data.error && data.error.type) || 'request_failed';
          var errorMessage =
            data && typeof data.message === 'string'
              ? data.message
              : (data && data.error && typeof data.error.message === 'string' && data.error.message) ||
                'request_failed';

          var requestError = new Error(errorMessage);
          requestError.status = response.status;
          requestError.code = errorCode;
          throw requestError;
        }

        if (!data || !data.reply) {
          var emptyError = new Error('empty_reply');
          emptyError.code = 'empty_reply';
          throw emptyError;
        }

        var endedAt = (window.performance && performance.now) ? performance.now() : Date.now();
        var latencyMs = Math.round(endedAt - startedAt);

        usageState.model = data.model || cfg.model;
        usageState.promptVersion = data.promptVersion || cfg.promptVersion || null;
        usageState.calls += 1;
        usageState.inputTokens += (data.usage && data.usage.input_tokens) || 0;
        usageState.outputTokens += (data.usage && data.usage.output_tokens) || 0;
        usageState.latencyMs += latencyMs;

        behavior.lastLlmUsage = {
          model: usageState.model,
          promptVersion: usageState.promptVersion,
          inputTokens: (data.usage && data.usage.input_tokens) || 0,
          outputTokens: (data.usage && data.usage.output_tokens) || 0,
          latencyMs: latencyMs,
          requestId: data.requestId || null,
        };

        return {
          text: data.reply,
          usage: behavior.lastLlmUsage,
          model: usageState.model,
          promptVersion: usageState.promptVersion,
          latencyMs: latencyMs,
        };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          if (timedOut) {
            var timeoutError = new Error('timeout');
            timeoutError.code = 'timeout';
            usageState.errors += 1;
            throw timeoutError;
          }
          throw error;
        }
        usageState.errors += 1;
        throw error;
      } finally {
        clearTimeout(timer);
        if (external) external.removeEventListener('abort', onExternalAbort);
      }
    },

    /** 사용자에게 보여줄 오류 메시지 */
    errorMessage(error) {
      var code = error && error.code;
      var status = error && error.status;

      if (code === 'timeout') {
        return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      }
      if (code === 'turn_limit') {
        return '대화 가능한 최대 횟수에 도달했습니다. 대화를 종료해 주세요.';
      }
      if (code === 'rate_limited' || status === 429) {
        return '지금 대화 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
      }
      if (code === 'daily_budget_exceeded') {
        return '오늘의 대화 한도에 도달했습니다. 내일 다시 시도해 주세요.';
      }
      if (code === 'overloaded' || status === 503) {
        return '대화 서버가 잠시 혼잡합니다. 잠시 후 다시 시도해 주세요.';
      }
      if (code === 'invalid_request' || status === 400) {
        return '메시지를 처리하지 못했습니다. 표현을 바꿔 다시 시도해 주세요.';
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return '네트워크 연결을 확인해 주세요.';
      }
      return '응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    },

    /**
     * Claude Messages API 형식으로 변환합니다.
     * - system 메시지 제외
     * - 하드코딩된 첫 인사말(assistant) 제외
     * - 최근 30개 메시지만 전송
     */
    toClaudeMessages(messages) {
      var out = [];
      (messages || []).forEach(function (message) {
        if (!message || (message.role !== 'user' && message.role !== 'assistant')) return;
        var content = typeof message.content === 'string' ? message.content.trim() : '';
        if (!content) return;
        out.push({ role: message.role, content: content });
      });

      // 인사말은 UI에만 남기고 API 컨텍스트에서는 제외합니다.
      while (out.length && out[0].role === 'assistant') out.shift();

      if (out.length > 30) out = out.slice(out.length - 30);
      return out;
    },
  };
})(window.Survey = window.Survey || {});
