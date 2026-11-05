(function (S) {
  S.pages = S.pages || {};

  var mounted = false;
  var waiting = false;
  var abortController = null;
  var requestToken = 0;
  var els = null;
  var ctxRef = null;

  function ensureStarted() {
    var chat = S.state.chat;
    if (chat.started) return;
    chat.started = true;
    chat.behavior.startedAt = Date.now();
    chat.messages.push({
      role: 'assistant',
      content: S.config.character.greeting,
      at: Date.now(),
      kind: 'greeting',
    });
  }

  function messageNode(message) {
    var wrap = document.createElement('div');

    if (message.role === 'system') {
      wrap.className = 'chat-system';
      wrap.textContent = message.content;
      return wrap;
    }

    wrap.className = 'message message--' + message.role;

    if (message.role === 'assistant') {
      var avatar = document.createElement('span');
      avatar.className = 'avatar avatar--sm';
      avatar.textContent = S.config.character.avatar;
      wrap.appendChild(avatar);
    }

    var body = document.createElement('div');
    body.className = 'message-body';

    var meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = message.role === 'assistant' ? S.config.character.name : '나';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message.content;

    body.appendChild(meta);
    body.appendChild(bubble);
    wrap.appendChild(body);
    return wrap;
  }

  function typingNode() {
    var wrap = document.createElement('div');
    wrap.className = 'message message--assistant';

    var avatar = document.createElement('span');
    avatar.className = 'avatar avatar--sm';
    avatar.textContent = S.config.character.avatar;

    var body = document.createElement('div');
    body.className = 'message-body';

    var meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = S.config.character.name;

    var bubble = document.createElement('div');
    bubble.className = 'bubble typing-bubble';
    bubble.setAttribute('aria-label', '응답 작성 중');
    bubble.innerHTML = '<span></span><span></span><span></span>';

    body.appendChild(meta);
    body.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  }

  function renderMessages() {
    if (!els) return;
    els.messages.innerHTML = '';
    S.state.chat.messages.forEach(function (message) {
      els.messages.appendChild(messageNode(message));
    });
    if (waiting) {
      els.messages.appendChild(typingNode());
    }
    S.ui.scrollToBottom(els.messages);
  }

  function ensureMaxTurnsNotice() {
    var behavior = S.state.chat.behavior;
    if (S.state.chat.ended) return;
    if (behavior.userTurnCount < S.config.maxUserTurns) return;
    if (behavior.maxTurnsNotified) return;

    behavior.maxTurnsNotified = true;
    S.state.chat.messages.push({
      role: 'system',
      content: '대화 가능한 최대 횟수에 도달했습니다. 대화를 종료해 주세요.',
      at: Date.now(),
    });
    renderMessages();
  }

  /**
   * 대화 조건은 상단 안내에서 설명하고, 화면에는 종료 가능 여부만 반영합니다.
   * 발화 수·진행률·행동 데이터는 참여자에게 노출하지 않습니다.
   */
  function updateChatState() {
    if (!els) return;
    var chat = S.state.chat;
    var behavior = chat.behavior;
    var count = behavior.userTurnCount;
    var min = behavior.minUserTurns;
    var max = S.config.maxUserTurns;
    var met = count >= min;
    var maxed = count >= max;
    behavior.minTurnsMet = met;

    els.endChat.disabled = !met || waiting || chat.ended;
    els.endChat.textContent = chat.ended
      ? '대화 종료됨'
      : met
        ? '대화 종료'
        : '대화 종료 (최소 ' + min + '회)';

    els.chatNext.hidden = !chat.ended;
    els.chatNext.disabled = !chat.ended;

    if (ctxRef) {
      ctxRef.setNextEnabled(chat.ended, chat.ended ? '' : '대화를 종료하면 다음 단계로 이동할 수 있습니다.');
    }

    if (maxed && !chat.ended) ensureMaxTurnsNotice();
  }

  function setBusy(busy) {
    if (!els) return;
    waiting = busy;
    var chat = S.state.chat;
    var maxed = chat.behavior.userTurnCount >= S.config.maxUserTurns;
    var disabled = busy || chat.ended || maxed;
    els.input.disabled = disabled;
    els.send.disabled = disabled;
    els.send.textContent = busy ? '응답 중…' : '전송';
    updateChatState();
  }

  function buildSnapshot() {
    var chat = S.state.chat;
    var behavior = chat.behavior;
    var endedAt = behavior.endedAt || Date.now();
    var isMock = S.config.llm.provider === 'mock';
    return {
      responseId: S.state.meta.responseId,
      characterId: S.config.character.id,
      model: isMock ? 'mock' : ((behavior.llm && behavior.llm.model) || S.config.llm.model),
      promptVersion: isMock ? null : ((behavior.llm && behavior.llm.promptVersion) || S.config.llm.promptVersion),
      startedAt: behavior.startedAt,
      firstUserMessageAt: behavior.firstUserMessageAt,
      endedAt: behavior.endedAt,
      endedReason: behavior.endedReason,
      durationMs: behavior.startedAt ? endedAt - behavior.startedAt : null,
      userTurnCount: behavior.userTurnCount,
      assistantTurnCount: behavior.assistantTurnCount,
      totalMessages: chat.messages.filter(function (m) { return m.role !== 'system'; }).length,
      totalUserChars: behavior.totalUserChars,
      totalAssistantChars: behavior.totalAssistantChars,
      minUserTurns: behavior.minUserTurns,
      maxUserTurns: S.config.maxUserTurns,
      minTurnsMet: behavior.minTurnsMet,
      endedByUser: behavior.endedByUser,
      llm: behavior.llm,
      transcript: chat.messages.map(function (m) {
        return {
          role: m.role,
          content: m.content,
          at: m.at,
          kind: m.kind || null,
          model: m.model || null,
          usage: m.usage || null,
        };
      }),
    };
  }

  function send() {
    if (!els || waiting || S.state.chat.ended) return;
    var text = els.input.value.trim();
    if (!text) {
      S.ui.toast('메시지를 입력해 주세요.');
      els.input.focus();
      return;
    }

    var chat = S.state.chat;
    var behavior = chat.behavior;

    if (behavior.userTurnCount >= S.config.maxUserTurns) {
      S.ui.toast('대화 가능한 최대 횟수에 도달했습니다. 대화를 종료해 주세요.');
      return;
    }

    var now = Date.now();
    var wasFirst = !behavior.firstUserMessageAt;
    var lastUserMessage = { role: 'user', content: text, at: now };

    chat.messages.push(lastUserMessage);
    behavior.userTurnCount += 1;
    behavior.totalUserChars += text.length;
    if (!behavior.firstUserMessageAt) behavior.firstUserMessageAt = now;
    behavior.minTurnsMet = behavior.userTurnCount >= behavior.minUserTurns;

    els.input.value = '';
    setBusy(true);
    renderMessages();

    var token = ++requestToken;
    abortController = new AbortController();
    S.services.llm.send({
      messages: chat.messages,
      character: S.config.character,
      signal: abortController.signal,
    }).then(function (result) {
      if (!mounted || token !== requestToken || S.state.chat.ended) return;
      chat.messages.push({
        role: 'assistant',
        content: result.text,
        at: Date.now(),
        kind: 'reply',
        model: result.model || null,
        usage: result.usage || null,
      });
      behavior.assistantTurnCount += 1;
      behavior.totalAssistantChars += result.text.length;
    }).catch(function (error) {
      if (error && error.name === 'AbortError') return;
      if (!mounted || token !== requestToken) return;

      // 실패한 발화는 기록에서 되돌리고 입력창에 복원합니다.
      var last = chat.messages[chat.messages.length - 1];
      if (last && last.role === 'user') chat.messages.pop();
      behavior.userTurnCount = Math.max(0, behavior.userTurnCount - 1);
      behavior.totalUserChars = Math.max(0, behavior.totalUserChars - text.length);
      if (wasFirst) behavior.firstUserMessageAt = null;
      behavior.minTurnsMet = behavior.userTurnCount >= behavior.minUserTurns;

      if (els) {
        els.input.value = text;
        S.ui.toast(S.services.llm.errorMessage(error));
      }
    }).finally(function () {
      if (token !== requestToken) return;
      abortController = null;
      if (!mounted) return;
      setBusy(false);
      renderMessages();
    });
  }

  function endConversation() {
    if (!els || S.state.chat.ended) return;
    var chat = S.state.chat;
    var behavior = chat.behavior;

    if (waiting) {
      S.ui.toast('응답을 기다리는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (behavior.userTurnCount < behavior.minUserTurns) {
      S.ui.toast('최소 ' + behavior.minUserTurns + '회 발화 후 대화를 종료할 수 있습니다.');
      return;
    }

    chat.ended = true;
    behavior.endedByUser = true;
    behavior.endedReason = behavior.userTurnCount >= S.config.maxUserTurns ? 'max_turns' : 'user';
    behavior.endedAt = Date.now();
    behavior.minTurnsMet = true;
    chat.messages.push({
      role: 'system',
      content: '대화가 종료되었습니다. 다음 단계에서 방금 전 대화 경험을 평가해 주세요.',
      at: Date.now(),
    });

    setBusy(false);
    renderMessages();
    updateChatState();

    if (!S.config.testMode) {
      S.services.storage.saveChatBehavior(buildSnapshot()).then(function (result) {
        if (result && result.ok === false) {
          S.ui.toast('대화 기록 저장에 실패했습니다. 연구진에게 알려 주세요.');
        } else if (result && result.persisted === false) {
          S.ui.toast('저장소가 설정되지 않아 대화 기록이 저장되지 않았습니다.');
        }
      });
    }

    S.ui.toast('대화가 종료되었습니다.');
  }

  S.pages.chat = {
    render: function (root, ctx) {
      ensureStarted();
      mounted = true;
      waiting = false;
      ctxRef = ctx;

      var character = S.config.character;
      var min = S.state.chat.behavior.minUserTurns;
      var max = S.config.maxUserTurns;
      var isMock = S.config.llm.provider === 'mock';
      var statusText = isMock ? '대화 가능 · 테스트 응답' : '대화 가능';
      var badgeText = isMock ? 'Mock' : 'AI';
      var disclaimer;
      if (isMock) {
        disclaimer = '현재는 테스트용 모의 응답입니다. 실제 LLM과 대화하지 않습니다.';
      } else if (S.config.testMode) {
        disclaimer = '테스트 모드입니다. 대화 내용은 저장되지 않습니다.';
      } else {
        disclaimer = '대화 내용은 연구 목적으로만 사용되며, 개인을 식별할 수 있는 정보는 수집하지 않습니다. 응답은 AI가 생성합니다. 위기 상황에서는 109(자살예방), 119(응급)로 연락해 주세요.';
      }

      root.innerHTML = '' +
        '<section class="page page--chat">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[4].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[4].title) + '</h1>' +
            '<p class="lede">' + S.ui.escape(character.name) + '와 자유롭게 대화해 주세요. <strong>최소 ' + min + '회 이상 메시지를 보낸 뒤</strong> 대화를 종료할 수 있습니다. 최대 ' + max + '회까지 대화할 수 있습니다.</p>' +
          '</header>' +

          S.ui.notice('대화 종료는 최소 ' + min + '회 발화 후 가능합니다. 대화를 더 이어가고 싶다면 자유롭게 계속해 주세요.', 'info') +

          '<section class="chat-panel card card--flush">' +
            '<header class="chat-head">' +
              '<span class="avatar">' + S.ui.escape(character.avatar) + '</span>' +
              '<div class="chat-head-text">' +
                '<strong>' + S.ui.escape(character.name) + '</strong>' +
                '<span class="status"><i></i> ' + S.ui.escape(statusText) + '</span>' +
              '</div>' +
              '<span class="badge">' + S.ui.escape(badgeText) + '</span>' +
            '</header>' +

            '<div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>' +

            '<form class="chat-composer" id="chat-form">' +
              '<textarea id="chat-input" rows="2" aria-label="메시지 입력" placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"></textarea>' +
              '<div class="composer-actions">' +
                '<button type="submit" class="btn btn-primary" id="chat-send">전송</button>' +
                '<button type="button" class="btn btn-ghost" id="end-chat" disabled>대화 종료 (최소 ' + min + '회)</button>' +
                '<button type="button" class="btn btn-primary" id="chat-next" hidden>다음 단계로 →</button>' +
              '</div>' +
            '</form>' +
            '<p class="chat-disclaimer">' + S.ui.escape(disclaimer) + '</p>' +
          '</section>' +
        '</section>';

      els = {
        messages: root.querySelector('#chat-messages'),
        form: root.querySelector('#chat-form'),
        input: root.querySelector('#chat-input'),
        send: root.querySelector('#chat-send'),
        endChat: root.querySelector('#end-chat'),
        chatNext: root.querySelector('#chat-next'),
      };

      renderMessages();
      updateChatState();
      setBusy(false);

      els.form.addEventListener('submit', function (event) {
        event.preventDefault();
        send();
      });

      els.input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          send();
        }
      });

      els.endChat.addEventListener('click', endConversation);
      els.chatNext.addEventListener('click', function () {
        if (S.state.chat.ended) ctx.next();
      });

      if (S.state.chat.ended) {
        setBusy(false);
      }
    },

    onLeave: function () {
      mounted = false;
      waiting = false;
      requestToken += 1;
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      els = null;
      ctxRef = null;
    },
  };
})(window.Survey = window.Survey || {});
