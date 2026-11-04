(function (S) {
  S.pages = S.pages || {};

  S.pages.postPsych = {
    render: function (root) {
      var st = S.state.postPsych;

      var cards = S.psychConstructs.map(function (construct) {
        return S.ui.questionCard({
          question: construct.postItem,
          name: 'postPsych.' + construct.key,
          value: st[construct.key],
        });
      }).join('');

      root.innerHTML = '' +
        '<section class="page">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[3].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[3].title) + '</h1>' +
            '<p class="lede">현재의 심리 상태를 응답해 주세요. 지금의 상태를 있는 그대로 응답해 주시면 됩니다.</p>' +
          '</header>' +

          '<div class="stack">' + cards + '</div>' +

          S.ui.notice('현재 심리 상태 문항은 UI 확인용 예시입니다. AI 경험 전 검사와 동일한 척도로 측정하는 구조만 준비되어 있습니다.', 'info') +
        '</section>';

      S.psychConstructs.forEach(function (construct) {
        S.ui.bindLikert(root, 'postPsych.' + construct.key, function (value) {
          S.state.postPsych[construct.key] = value;
        });
      });
    },
  };
})(window.Survey = window.Survey || {});
