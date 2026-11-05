(function (S) {
  S.pages = S.pages || {};

  var saveStatus = 'pending';

  function completionPayload() {
    var meta = S.state.meta;
    var behavior = S.state.chat.behavior;
    var llm = behavior.llm || {};
    var isMock = S.config.llm.provider === 'mock';

    return {
      responseId: meta.responseId,
      appVersion: S.config.version,
      model: isMock ? 'mock' : (llm.model || S.config.llm.model),
      promptVersion: isMock ? null : (llm.promptVersion || S.config.llm.promptVersion),
      consentAt: meta.consentAt,
      startedAt: meta.startedAt,
      completedAt: meta.completedAt,
      visitedPages: meta.visitedPages.slice(),
      preAI: S.state.preAI,
      prePsych: S.state.prePsych,
      postPsych: S.state.postPsych,
      evaluation: S.state.evaluation,
      chatBehavior: {
        characterId: S.config.character.id,
        startedAt: behavior.startedAt,
        firstUserMessageAt: behavior.firstUserMessageAt,
        endedAt: behavior.endedAt,
        endedReason: behavior.endedReason,
        durationMs: behavior.startedAt && behavior.endedAt
          ? behavior.endedAt - behavior.startedAt
          : null,
        userTurnCount: behavior.userTurnCount,
        assistantTurnCount: behavior.assistantTurnCount,
        totalUserChars: behavior.totalUserChars,
        totalAssistantChars: behavior.totalAssistantChars,
        minUserTurns: behavior.minUserTurns,
        maxUserTurns: S.config.maxUserTurns,
        minTurnsMet: behavior.minTurnsMet,
        endedByUser: behavior.endedByUser,
        llm: {
          model: llm.model || null,
          promptVersion: llm.promptVersion || null,
          calls: llm.calls || 0,
          inputTokens: llm.inputTokens || 0,
          outputTokens: llm.outputTokens || 0,
          latencyMs: llm.latencyMs || 0,
          errors: llm.errors || 0,
        },
        transcript: S.state.chat.messages.map(function (message) {
          return {
            role: message.role,
            content: message.content,
            at: message.at,
            kind: message.kind || null,
            model: message.model || null,
            usage: message.usage || null,
          };
        }),
      },
    };
  }

  function statusHtml() {
    if (S.config.testMode) {
      return S.ui.notice(
        '테스트 모드입니다. 응답과 대화 내용은 저장되지 않으며, 새로고침하면 처음부터 다시 시작됩니다.',
        'warning'
      );
    }
    if (saveStatus === 'saved') {
      return S.ui.notice('응답이 익명으로 안전하게 저장되었습니다. 이 창을 닫아도 됩니다.', 'info');
    }
    if (saveStatus === 'not_configured') {
      return S.ui.notice(
        '저장소가 설정되지 않아 응답이 저장되지 않았습니다. 화면을 닫지 말고 연구진에게 알려 주세요.',
        'warning'
      );
    }
    if (saveStatus === 'failed') {
      return S.ui.notice(
        '응답 저장에 실패했습니다. 네트워크를 확인한 뒤 이 페이지를 다시 열거나 연구진에게 알려 주세요.',
        'warning'
      );
    }
    return S.ui.notice('응답을 저장하는 중입니다…', 'info');
  }

  function renderStatus() {
    var holder = document.getElementById('ending-save-status');
    if (holder) holder.innerHTML = statusHtml();
  }

  S.pages.ending = {
    render: function (root, ctx) {
      var raffleIsPlaceholder =
        !S.config.raffleUrl ||
        S.config.raffleUrl.indexOf('REPLACE_ME') >= 0 ||
        S.config.raffleUrl.indexOf('example.com') >= 0;

      var raffleAction = raffleIsPlaceholder
        ? '<button type="button" class="btn btn-primary" disabled>추첨 링크 준비 중</button>'
        : '<a class="btn btn-primary" href="' + S.ui.attr(S.config.raffleUrl) + '" target="_blank" rel="noopener noreferrer">추첨 설문 참여하기 ↗</a>';

      root.innerHTML = '' +
        '<section class="page page--ending">' +
          '<section class="card completion-card">' +
            '<span class="completion-mark" aria-hidden="true">✓</span>' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[6].kicker) + '</p>' +
            '<h1>설문이 완료되었습니다</h1>' +
            '<p class="lede">소중한 시간을 내어 참여해 주셔서 진심으로 감사합니다.</p>' +
            '<p>남겨주신 응답은 AI 챗봇과의 대화 경험을 이해하는 데 큰 도움이 됩니다.</p>' +
          '</section>' +

          '<section class="card raffle-card">' +
            '<div class="raffle-icon" aria-hidden="true">🎁</div>' +
            '<div class="raffle-text">' +
              '<h2>경품 추첨 참여</h2>' +
              '<p>경품 추첨은 본 설문과 별도로 진행됩니다. 아래 링크에서 참여할 수 있습니다.</p>' +
              (raffleIsPlaceholder
                ? '<p class="muted small">추첨 링크가 아직 설정되지 않았습니다. 연구진에게 문의해 주세요.</p>'
                : '') +
            '</div>' +
            raffleAction +
          '</section>' +

          '<div id="ending-save-status">' + statusHtml() + '</div>' +

          '<div class="ending-actions">' +
            '<button type="button" class="btn btn-ghost" id="restart-btn">처음부터 다시 보기</button>' +
          '</div>' +
        '</section>';

      root.querySelector('#restart-btn').addEventListener('click', function () {
        var ok = window.confirm(
          '처음부터 다시 시작할까요? 현재 화면의 응답은 초기화되며, 이미 저장된 응답은 연구 데이터로 남습니다.'
        );
        if (!ok) return;
        S.resetState();
        saveStatus = 'pending';
        ctx.goTo(0);
      });
    },

    onEnter: function () {
      var meta = S.state.meta;
      if (!meta.completedAt) meta.completedAt = Date.now();

      if (S.config.testMode) {
        saveStatus = 'test';
        renderStatus();
        return;
      }
      if (saveStatus === 'saved' || saveStatus === 'saving') return;

      if (!S.services.storage.isConfigured()) {
        saveStatus = 'not_configured';
        renderStatus();
        return;
      }

      saveStatus = 'saving';
      renderStatus();

      S.services.storage.saveCompletion(completionPayload()).then(function (result) {
        if (result && result.ok && result.persisted) {
          saveStatus = 'saved';
        } else if (result && result.persisted === false) {
          saveStatus = 'not_configured';
        } else {
          saveStatus = 'failed';
        }
        renderStatus();
      }).catch(function (error) {
        console.error('[ending] saveCompletion failed', error);
        saveStatus = 'failed';
        renderStatus();
      });
    },
  };
})(window.Survey = window.Survey || {});
