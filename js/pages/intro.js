(function (S) {
  S.pages = S.pages || {};

  S.pages.intro = {
    render: function (root, ctx) {
      root.innerHTML = '' +
        '<section class="page page--intro">' +
          '<div class="hero card">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[0].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.config.title) + '</h1>' +
            '<p class="hero-sub">' + S.ui.escape(S.config.subtitle) + '</p>' +
            '<div class="hero-meta">' +
              '<span class="badge">테스트 모드</span>' +
              '<span class="muted">약 15~20분 · 총 7단계</span>' +
            '</div>' +
          '</div>' +

          '<section class="card">' +
            '<h2>연구 목적</h2>' +
            '<p>캐릭터 기반 AI 챗봇과의 대화 경험, 그리고 AI 경험 전후의 심리 상태가 외로움·사회적 고립·사회적 지지와 어떻게 관련되는지 탐구합니다.</p>' +
            '<p class="muted small">본 설문은 연구 목적의 테스트 버전이며, 실제 척도와 분석 방식은 추후 확정됩니다.</p>' +
          '</section>' +

          '<section class="card">' +
            '<h2>참여 유의사항</h2>' +
            '<ul class="check-list">' +
              '<li>정답은 없습니다. 떠오르는 대로 솔직하게 응답해 주세요.</li>' +
              '<li>각 페이지는 이전·다음으로 이동할 수 있으며, 마지막에 다시 확인할 수 있습니다.</li>' +
              '<li>대화 페이지에서는 캐릭터와 최소 ' + S.config.minUserTurns + '회 이상 대화한 뒤 대화를 종료할 수 있습니다.</li>' +
              '<li>불편함을 느끼면 언제든 응답을 중단할 수 있습니다.</li>' +
              '<li>현재 테스트 모드에서는 응답과 대화 내용이 저장되지 않습니다.</li>' +
              '<li>경품 추첨은 설문 완료 후 별도 링크에서 진행됩니다.</li>' +
            '</ul>' +
          '</section>' +

          '<section class="card start-card">' +
            '<label class="consent">' +
              '<input type="checkbox" id="consent">' +
              '<span>위 안내 사항을 확인했으며, 설문 참여에 동의합니다.</span>' +
            '</label>' +
            '<button type="button" class="btn btn-primary btn-lg" id="start-btn" disabled>설문 시작하기 →</button>' +
          '</section>' +
        '</section>';

      var consent = root.querySelector('#consent');
      var startBtn = root.querySelector('#start-btn');

      function syncStart() {
        startBtn.disabled = !consent.checked;
      }

      consent.addEventListener('change', syncStart);
      syncStart();

      startBtn.addEventListener('click', function () {
        if (!consent.checked) {
          S.ui.toast('안내 사항을 확인하고 동의해 주세요.');
          return;
        }
        if (!S.state.meta.consentAt) {
          S.state.meta.consentAt = Date.now();
        }
        if (!S.state.meta.startedAt) {
          S.state.meta.startedAt = Date.now();
        }
        ctx.goTo(1);
      });
    },
  };
})(window.Survey = window.Survey || {});
