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

          '<section class="card">' +
            '<p class="question">AI 챗봇과의 대화 경험에 대해 자유롭게 적어주세요. 불편했던 점이나 좋았던 점 모두 괜찮습니다.</p>' +
            '<textarea class="text-input" id="feedback" rows="5" placeholder="예: 대화하면서 느낀 점, 개선되었으면 하는 점 등">' +
              S.ui.escape(st.feedback) + '</textarea>' +
          '</section>' +

          S.ui.notice('평가 문항은 UI 확인용 예시입니다. 실제 연구에서는 문항 구성과 응답 방식을 확정한 뒤 사용합니다.', 'info') +
        '</section>';

      S.evaluationItems.forEach(function (item) {
        S.ui.bindLikert(root, 'evaluation.' + item.key, function (value) {
          S.state.evaluation[item.key] = value;
        });
      });

      S.ui.bindInput(root, '#feedback', 'input', function (e) {
        S.state.evaluation.feedback = e.target.value;
      });
    },
  };
})(window.Survey = window.Survey || {});
