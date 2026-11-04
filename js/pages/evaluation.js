(function (S) {
  S.pages = S.pages || {};

  S.pages.evaluation = {
    render: function (root) {
      var st = S.state.evaluation;

      var cards = S.evaluationItems.map(function (item) {
        return S.ui.questionCard({
          question: item.item,
          name: 'evaluation.' + item.key,
          value: st[item.key],
          labels: S.config.likertLabels,
        });
      }).join('');

      root.innerHTML = '' +
        '<section class="page">' +
          '<header class="page-head">' +
            '<p class="eyebrow">' + S.ui.escape(S.pageMeta[5].kicker) + '</p>' +
            '<h1>' + S.ui.escape(S.pageMeta[5].title) + '</h1>' +
            '<p class="lede">방금 전 대화 경험을 바탕으로 각 항목에 응답해 주세요. 정답은 없습니다.</p>' +
          '</header>' +

          '<div class="stack">' + cards + '</div>' +
        '</section>';

      S.evaluationItems.forEach(function (item) {
        S.ui.bindLikert(root, 'evaluation.' + item.key, function (value) {
          S.state.evaluation[item.key] = value;
        });
      });
    },
  };
})(window.Survey = window.Survey || {});
