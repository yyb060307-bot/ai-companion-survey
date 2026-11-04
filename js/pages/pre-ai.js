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

      var perceptionRadios = opts.perceptions.map(function (value) {
        return '<label class="choice">' +
          '<input type="radio" name="perception" value="' + S.ui.attr(value) + '"' +
          (st.perception === value ? ' checked' : '') + '>' +
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

          '<section class="card">' +
            '<p class="question">AI를 주로 어떤 목적으로 사용하시나요? <span class="hint">복수 선택 가능</span></p>' +
            '<div class="choice-grid">' + purposeChecks + '</div>' +
            '<input class="text-input mt-sm" type="text" id="purpose-other" placeholder="기타 목적을 적어주세요" value="' +
              S.ui.attr(st.purposeOther) + '"' + (st.purposes.indexOf('기타') >= 0 ? '' : ' hidden') + '>' +
          '</section>' +

          '<section class="card">' +
            '<p class="question">AI는 본인에게 어떤 존재인가요? <span class="hint">하나 선택</span></p>' +
            '<div class="choice-list">' + perceptionRadios + '</div>' +
            '<input class="text-input mt-sm" type="text" id="perception-other" placeholder="기타 인식을 적어주세요" value="' +
              S.ui.attr(st.perceptionOther) + '"' + (st.perception === '기타' ? '' : ' hidden') + '>' +
          '</section>' +

          '<section class="card question-card">' +
            '<p class="question">일주일 평균 AI 사용 시간은 어느 정도인가요?</p>' +
            S.ui.likert('usageTime', st.usageTime, {
              ariaLabel: '일주일 평균 AI 사용 시간',
              labels: S.config.usageTimeLabels,
            }) +
          '</section>' +

          '<section class="card question-card">' +
            '<p class="question">AI를 사용한 기간은 어느 정도인가요?</p>' +
            S.ui.likert('usagePeriod', st.usagePeriod, {
              ariaLabel: 'AI를 사용한 기간',
              labels: S.config.usagePeriodLabels,
            }) +
          '</section>' +

          '<section class="card question-card">' +
            '<p class="question">나는 AI에게 개인적인 이야기나 고민을 털어놓는 편이다.</p>' +
            S.ui.likert('selfDisclosure', st.selfDisclosure, { ariaLabel: 'AI에게 개인적인 이야기나 고민을 털어놓는 편이다.' }) +
          '</section>' +

          '<section class="card">' +
            '<p class="question">AI에게 주로 어떤 이야기를 하는지 적어주세요 <span class="hint">선택</span></p>' +
            '<textarea class="text-input" id="disclosure-note" rows="3" placeholder="예: 일상적인 고민, 업무 이야기 등">' +
              S.ui.escape(st.disclosureNote) + '</textarea>' +
          '</section>' +

          S.ui.notice('현재 페이지의 문항은 UI 확인용 예시입니다. 실제 연구 문항과 선택지는 추후 확정됩니다.', 'info') +
        '</section>';

      S.ui.bindCheckboxes(root, 'purposes', function (values) {
        S.state.preAI.purposes = values;
        root.querySelector('#purpose-other').hidden = values.indexOf('기타') < 0;
      });

      S.ui.bindRadio(root, 'perception', function (value) {
        S.state.preAI.perception = value;
        root.querySelector('#perception-other').hidden = value !== '기타';
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

      S.ui.bindInput(root, '#purpose-other', 'input', function (e) {
        S.state.preAI.purposeOther = e.target.value;
      });
      S.ui.bindInput(root, '#perception-other', 'input', function (e) {
        S.state.preAI.perceptionOther = e.target.value;
      });
      S.ui.bindInput(root, '#disclosure-note', 'input', function (e) {
        S.state.preAI.disclosureNote = e.target.value;
      });
    },
  };
})(window.Survey = window.Survey || {});
