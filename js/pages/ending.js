(function (S) {
  S.pages = S.pages || {};

  function completionPayload() {
    var meta = S.state.meta;
    var behavior = S.state.chat.behavior;
    return {
      responseId: meta.responseId,
      consentAt: meta.consentAt,
      startedAt: meta.startedAt,
      completedAt: meta.completedAt,
      visitedPages: meta.visitedPages.slice(),
      preAI: S.state.preAI,
      prePsych: S.state.prePsych,
      postPsych: S.state.postPsych,
      evaluation: S.state.evaluation,
      chatBehavior: {
        startedAt: behavior.startedAt,
        endedAt: behavior.endedAt,
        userTurnCount: behavior.userTurnCount,
        assistantTurnCount: behavior.assistantTurnCount,
        minTurnsMet: behavior.minTurnsMet,
        endedByUser: behavior.endedByUser,
      },
    };
  }

  S.pages.ending = {
    render: function (root, ctx) {
      var raffleIsPlaceholder = S.config.raffleUrl.indexOf('REPLACE_ME') >= 0;

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
                ? '<p class="muted small">현재는 테스트용 링크입니다. 실제 추첨 설문 URL로 교체해 주세요.</p>'
                : '') +
            '</div>' +
            '<a class="btn btn-primary" href="' + S.ui.attr(S.config.raffleUrl) + '" target="_blank" rel="noopener noreferrer">추첨 설문 참여하기 ↗</a>' +
          '</section>' +

          S.ui.notice('현재 테스트 모드에서는 응답과 대화 내용이 저장되지 않습니다. 새로고침하면 처음부터 다시 시작됩니다.', 'warning') +

          '<div class="ending-actions">' +
            '<button type="button" class="btn btn-ghost" id="restart-btn">처음부터 다시 보기</button>' +
          '</div>' +
        '</section>';

      root.querySelector('#restart-btn').addEventListener('click', function () {
        var ok = window.confirm('처음부터 다시 시작할까요? 현재 테스트 응답은 초기화됩니다.');
        if (!ok) return;
        S.resetState();
        ctx.goTo(0);
      });
    },

    onEnter: function () {
      var meta = S.state.meta;
      if (!meta.completedAt) {
        meta.completedAt = Date.now();
        S.services.storage.saveCompletion(completionPayload());
      }
    },
  };
})(window.Survey = window.Survey || {});
