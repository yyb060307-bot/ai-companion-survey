/**
 * 페이지 흐름 컨트롤러
 * ------------------------------------------------------------
 * 7개 페이지를 순서대로 렌더링하고 이전/다음 이동을 관리합니다.
 * 각 페이지는 js/pages/*.js의 독립 모듈로 분리되어 있습니다.
 */
(function (S) {
  var modules = [
    S.pages.intro,
    S.pages.preAI,
    S.pages.prePsych,
    S.pages.postPsych,
    S.pages.chat,
    S.pages.evaluation,
    S.pages.ending,
  ];

  var app = {
    current: 0,
    nextEnabled: true,
    nextReason: '',
    root: null,
    prevBtn: null,
    nextBtn: null,

    init: function () {
      this.root = document.getElementById('page-root');
      this.prevBtn = document.getElementById('prev-btn');
      this.nextBtn = document.getElementById('next-btn');
      this.progressFill = document.getElementById('progress-fill');
      this.pageCount = document.getElementById('page-count');
      this.pageContext = document.getElementById('page-context');
      this.footer = document.getElementById('app-footer');
      this.footerNote = document.getElementById('footer-note');

      var self = this;
      this.prevBtn.addEventListener('click', function () {
        self.prev();
      });
      this.nextBtn.addEventListener('click', function () {
        self.next();
      });

      this.render(0);
    },

    render: function (index) {
      var target = Math.max(0, Math.min(modules.length - 1, index));
      var previous = modules[this.current];

      if (target !== this.current && previous && previous.onLeave) {
        previous.onLeave();
      }

      this.current = target;
      this.nextEnabled = true;
      this.nextReason = '';
      S.state.meta.currentPage = target;

      var meta = S.pageMeta[target];
      if (S.state.meta.visitedPages.indexOf(meta.id) < 0) {
        S.state.meta.visitedPages.push(meta.id);
      }

      this.root.innerHTML = '';
      this.root.classList.remove('page-enter');

      modules[target].render(this.root, this);

      // 페이지 진입 애니메이션을 다시 트리거합니다.
      void this.root.offsetWidth;
      this.root.classList.add('page-enter');

      this.updateChrome();

      if (modules[target].onEnter) {
        modules[target].onEnter(this.root, this);
      }

      this.updateChrome();
      window.scrollTo(0, 0);
      this.root.focus({ preventScroll: true });
    },

    updateChrome: function () {
      var total = S.pageMeta.length;
      var meta = S.pageMeta[this.current];
      var isFirst = this.current === 0;
      var isLast = this.current === total - 1;

      this.pageCount.textContent = String(this.current + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      this.progressFill.style.width = ((this.current + 1) / total * 100) + '%';
      this.pageContext.textContent = meta.kicker + ' · ' + meta.title;

      this.prevBtn.hidden = isFirst;
      this.prevBtn.disabled = isFirst;

      this.nextBtn.hidden = isFirst || isLast;
      if (!this.nextBtn.hidden) {
        this.nextBtn.textContent = meta.nav + ' →';
        this.nextBtn.disabled = !this.nextEnabled;
        this.nextBtn.title = this.nextEnabled ? '' : this.nextReason;
      }

      // 소개 페이지에서는 자체 시작 버튼을 사용합니다.
      this.footer.hidden = isFirst;

      this.footerNote.textContent = S.config.testMode
        ? '테스트 모드 · 응답과 대화 내용은 저장되지 않습니다.'
        : '응답은 안전하게 저장됩니다.';
    },

    setNextEnabled: function (enabled, reason) {
      this.nextEnabled = !!enabled;
      this.nextReason = reason || '';
      this.updateChrome();
    },

    goTo: function (index) {
      if (index === this.current) return;
      this.render(index);
    },

    next: function () {
      if (this.current >= modules.length - 1) return;
      if (!this.nextEnabled) {
        if (this.nextReason) S.ui.toast(this.nextReason);
        return;
      }
      this.goTo(this.current + 1);
    },

    prev: function () {
      if (this.current <= 0) return;
      this.goTo(this.current - 1);
    },
  };

  S.app = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      app.init();
    });
  } else {
    app.init();
  }
})(window.Survey = window.Survey || {});
