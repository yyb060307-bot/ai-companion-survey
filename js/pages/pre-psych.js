(function (S) {
  S.pages = S.pages || {};

  function byKey(key) {
    for (var i = 0; i < S.psychConstructs.length; i++) {
      if (S.psychConstructs[i].key === key) return S.psychConstructs[i];
    }
    return null;
  }

  S.pages.prePsych = {
    render: function (root) {
      var st = S.state.prePsych;
      var loneliness = byKey('loneliness');
      var support = byKey('support');
      var baseline = byKey('baseline');

      root.innerHTML = '' +
        '<section class="page">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[2].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[2].title) + '</h1>' +
            '<p class="lede">AI를 본격적으로 사용하기 전의 심리 상태를 떠올리며 응답해 주세요. 정답은 없습니다.</p>' +
          '</header>' +

          '<div class="stack">' +
            S.ui.questionCard({
              question: loneliness.preItem,
              name: 'prePsych.loneliness',
              value: st.loneliness,
            }) +
            S.ui.questionCard({
              question: support.preItem,
              name: 'prePsych.support',
              value: st.support,
            }) +
            S.ui.questionCard({
              question: '월 1회 이상 사적으로 만나는 친한 사람은 몇 명인가요?',
              name: 'prePsych.networkMeet',
              value: st.networkMeet,
              labels: S.config.networkMeetLabels,
            }) +
            S.ui.questionCard({
              question: '친구·가족과 사적인 연락에 하루 평균 얼마나 시간을 쓰나요?',
              name: 'prePsych.networkContact',
              value: st.networkContact,
              labels: S.config.networkContactLabels,
            }) +
            S.ui.questionCard({
              question: baseline.preItem,
              name: 'prePsych.baseline',
              value: st.baseline,
            }) +
          '</div>' +

          S.ui.notice('AI 경험 전 심리 지표 문항은 UI 확인용 예시입니다. 실제 척도(LSIS, LSNS 등)와 채점 방식은 추후 확정됩니다.', 'info') +
        '</section>';

      S.ui.bindLikert(root, 'prePsych.loneliness', function (value) {
        S.state.prePsych.loneliness = value;
      });
      S.ui.bindLikert(root, 'prePsych.support', function (value) {
        S.state.prePsych.support = value;
      });
      S.ui.bindLikert(root, 'prePsych.baseline', function (value) {
        S.state.prePsych.baseline = value;
      });
      S.ui.bindLikert(root, 'prePsych.networkMeet', function (value) {
        S.state.prePsych.networkMeet = value;
      });
      S.ui.bindLikert(root, 'prePsych.networkContact', function (value) {
        S.state.prePsych.networkContact = value;
      });
    },
  };
})(window.Survey = window.Survey || {});
