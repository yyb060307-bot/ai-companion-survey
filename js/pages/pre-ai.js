(function (S) {
  S.pages = S.pages || {};

  function checked(list, value) {
    return list.indexOf(value) >= 0 ? ' checked' : '';
  }

  S.pages.preAI = {
    render: function (root) {
      var st = S.state.preAI;
      var opts = S.preAIOptions;

      var purposeChecks = opts.purposes.map(function (value) {
        return '<label class="choice">' +
          '<input type="checkbox" name="purposes" value="' + S.ui.attr(value) + '"' + checked(st.purposes, value) + '>' +
          '<span>' + S.ui.escape(value) + '</span>' +
        '</label>';
      }).join('');

      root.innerHTML = '' +
        '<section class="page">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[1].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[1].title) + '</h1>' +
            '<p class="lede">평소 AI를 어떻게 사용하고 있는지 먼저 확인합니다. 정답은 없으니 떠오르는 대로 응답해 주세요.</p>' +
          '</header>' +

          '<section class="card question-card">' +
            '<p class="question">AI는 본인에게 어떤 존재인가요?</p>' +
            '<textarea class="text-input" id="perception" rows="3" placeholder="자유롭게 적어주세요">' +
              S.ui.escape(st.perception) + '</textarea>' +
          '</section>' +

          '<section class="card question-card">' +
            '<p class="question">어떤 용도로 AI를 사용하시나요? <span class="hint">복수 선택 가능</span></p>' +
            '<div class="choice-grid">' + purposeChecks + '</div>' +
          '</section>' +

          S.ui.questionCard({
            question: 'AI 챗봇을 하루에 평균 몇 시간 정도 사용하나요?',
            name: 'usageTime',
            value: st.usageTime,
            options: S.config.usageTimeOptions,
          }) +

          S.ui.questionCard({
            question: 'AI 챗봇을 얼마나 오랜 기간 사용했나요?',
            name: 'usagePeriod',
            value: st.usagePeriod,
            options: S.config.usagePeriodOptions,
          }) +

          S.ui.questionCard({
            question: 'AI에게 얼마나 자신의 이야기를 하나요?',
            name: 'selfDisclosure',
            value: st.selfDisclosure,
            options: S.config.selfDisclosureLabels,
          }) +
        '</section>';

      S.ui.bindInput(root, '#perception', 'input', function (e) {
        S.state.preAI.perception = e.target.value;
      });

      S.ui.bindCheckboxes(root, 'purposes', function (values) {
        S.state.preAI.purposes = values;
      });

      S.ui.bindLikert(root, 'usageTime', function (value) {
        S.state.preAI.usageTime = value;
      });
      S.ui.bindLikert(root, 'usagePeriod', function (value) {
        S.state.preAI.usagePeriod = value;
      });
      S.ui.bindLikert(root, 'selfDisclosure', function (value) {
        S.state.preAI.selfDisclosure = value;
      });
    },
  };
})(window.Survey = window.Survey || {});
