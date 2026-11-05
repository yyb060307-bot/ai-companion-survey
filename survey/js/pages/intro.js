(function (S) {
  S.pages = S.pages || {};

  function contactLine() {
    var email = S.config.contactEmail || '';
    var configured = email && email.indexOf('example.com') < 0 && email.indexOf('REPLACE') < 0;
    if (!configured) {
      return '<li>문의·철회: 연구 책임자에게 연락해 주세요.</li>';
    }
    return '<li>문의·철회: <a href="mailto:' + S.ui.attr(email) + '">' + S.ui.escape(email) + '</a></li>';
  }

  S.pages.intro = {
    render: function (root, ctx) {
      var min = S.config.minUserTurns;
      var max = S.config.maxUserTurns;
      var storageReady = S.services.storage && S.services.storage.isConfigured && S.services.storage.isConfigured();

      var modeBadge = S.config.testMode
        ? '<span class="badge">테스트 모드</span>'
        : '<span class="badge">연구 참여</span>';

      var warnings = '';
      if (!S.config.testMode && !storageReady) {
        warnings += S.ui.notice(
          '저장소가 아직 설정되지 않았습니다. 이 상태로 참여하면 응답이 저장되지 않으니 연구진에게 알려 주세요.',
          'warning'
        );
      }
      if (S.config.testMode) {
        warnings += S.ui.notice(
          '테스트 모드입니다. 응답과 대화 내용은 저장되지 않으며, 새로고침하면 초기화됩니다.',
          'warning'
        );
      }

      root.innerHTML = '' +
        '<section class="page page--intro">' +
          '<div class="hero card">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[0].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.config.title) + '</h1>' +
            '<p class="hero-sub">' + S.ui.escape(S.config.subtitle) + '</p>' +
            '<div class="hero-meta">' +
              modeBadge +
              '<span class="muted">약 15~20분 · 총 7단계</span>' +
            '</div>' +
          '</div>' +

          warnings +

          '<section class="card">' +
            '<h2>연구 목적</h2>' +
            '<p>캐릭터 기반 AI 챗봇과의 대화 경험, 그리고 AI 경험 전후의 심리 상태가 외로움·사회적 고립·사회적 지지와 어떻게 관련되는지 탐구합니다.</p>' +
            '<p class="muted small">본 설문은 연구 목적의 학술 조사입니다. 수집된 자료는 통계적으로 분석되며, 개별 응답이 외부에 공개되지 않습니다.</p>' +
          '</section>' +

          '<section class="card">' +
            '<h2>진행 순서</h2>' +
            '<ul class="check-list">' +
              '<li>AI 사용 경험과 평소 심리 상태에 대한 사전 문항에 응답합니다.</li>' +
              '<li>캐릭터 ‘' + S.ui.escape(S.config.character.name) + '’와 최소 ' + min + '회, 최대 ' + max + '회 대화합니다.</li>' +
              '<li>대화 후 심리 상태와 챗봇 이용 후기를 응답합니다.</li>' +
              '<li>마지막에 경품 추첨 참여 링크를 안내합니다.</li>' +
            '</ul>' +
          '</section>' +

          '<section class="card">' +
            '<h2>데이터 처리와 개인정보</h2>' +
            '<ul class="check-list">' +
              '<li>응답은 이름 없이 익명 UUID로 저장되며, 이름·연락처·주소 등 직접 식별 정보는 수집하지 않습니다.</li>' +
              '<li>대화 내용은 AI 응답 생성을 위해 Anthropic의 Claude API로 전송됩니다. Anthropic은 API 입력·출력을 기본적으로 모델 학습에 사용하지 않습니다.</li>' +
              '<li>대화에 이름, 연락처, 주소, 계좌번호 등 개인정보를 입력하지 마세요.</li>' +
              '<li>대화 내용은 연구자가 연구 목적에 한해 검토할 수 있으며, 연구자만 접근할 수 있는 보호된 화면에서 확인합니다.</li>' +
              '<li>수집된 자료는 연구 목적 외에는 사용하지 않으며, 연구 종료 후 관련 지침에 따라 파기합니다.</li>' +
              '<li>민감한 주제(외로움, 소외감, 자기노출)를 다루므로 불편할 경우 언제든 중단할 수 있습니다.</li>' +
              contactLine() +
            '</ul>' +
          '</section>' +

          '<section class="card">' +
            '<h2>참여 유의사항</h2>' +
            '<ul class="check-list">' +
              '<li>정답은 없습니다. 떠오르는 대로 솔직하게 응답해 주세요.</li>' +
              '<li>각 페이지는 이전·다음으로 이동할 수 있으며, 마지막에 다시 확인할 수 있습니다.</li>' +
              '<li>대화를 종료한 뒤에만 다음 단계로 이동할 수 있습니다.</li>' +
              '<li>경품 추첨은 설문 완료 후 별도 링크에서 진행됩니다.</li>' +
            '</ul>' +
          '</section>' +

          S.ui.notice(
            '대화 중 자해·자살 등 위기 상황이 느껴지면 즉시 109(자살예방상담), 1577-0199(정신건강상담), 119(응급)로 연락해 주세요.',
            'info'
          ) +

          '<section class="card start-card">' +
            '<label class="consent">' +
              '<input type="checkbox" id="consent">' +
              '<span>위 안내 사항을 확인했으며, 익명 응답 수집, AI 응답 생성을 위한 대화 내용 전송, 연구자의 연구 목적 대화 내용 검토에 동의합니다.</span>' +
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
