(function (S) {
  S.pages = S.pages || {};

  S.pages.prePsych = {
    render: function (root) {
      var st = S.state.prePsych;

      var cards = S.psychConstructs.map(function (construct) {
        return S.ui.questionCard({
          question: construct.item,
          name: 'prePsych.' + construct.key,
          value: st[construct.key],
          labels: S.config.psychLabels,
        });
      }).join('');

      root.innerHTML = '' +
        '<section class="page">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[2].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[2].title) + '</h1>' +
            '<p class="lede">AI를 본격적으로 사용하기 전의 심리 상태를 떠올리며 응답해 주세요. 정답은 없습니다.</p>' +
          '</header>' +

          '<div class="stack">' +
            cards +
            S.ui.questionCard({
              question: '최소한 한 달에 한 번 이상 사적으로 만나거나 주 1회 이상 연락을 할 정도로 친한 사람(가족 포함)은 몇 명인가요?',
              name: 'prePsych.networkMeet',
              value: st.networkMeet,
              options: S.config.networkMeetOptions,
            }) +
            S.ui.questionCard({
              question: '친한 사람(가족 포함)과는 얼마나 자주 만나거나 얼마나 자주 연락하나요?',
              name: 'prePsych.networkContact',
              value: st.networkContact,
              options: S.config.networkContactOptions,
            }) +
          '</div>' +
        '</section>';

      S.psychConstructs.forEach(function (construct) {
        S.ui.bindLikert(root, 'prePsych.' + construct.key, function (value) {
          S.state.prePsych[construct.key] = value;
        });
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
