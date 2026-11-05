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

  /**
   * 페이지를 떠날 때 저장할 스냅샷.
   * chat은 종료 시 saveChatBehavior, ending은 saveCompletion에서 저장하므로 제외합니다.
   */
  function pagePayload(pageId) {
    var meta = S.state.meta;
    var base = {
      responseId: meta.responseId,
      savedAt: Date.now(),
      currentPage: meta.currentPage,
      visitedPages: meta.visitedPages.slice(),
    };

    if (pageId === 'intro') {
      base.consentAt = meta.consentAt;
      base.startedAt = meta.startedAt;
      return base;
    }
    if (pageId === 'pre-ai') return Object.assign(base, { preAI: S.state.preAI });
    if (pageId === 'pre-psych') return Object.assign(base, { prePsych: S.state.prePsych });
    if (pageId === 'post-psych') return Object.assign(base, { postPsych: S.state.postPsych });
    if (pageId === 'evaluation') return Object.assign(base, { evaluation: S.state.evaluation });
    return null;
  }

  function savePageState(index) {
    if (S.config.testMode) return;
    var meta = S.pageMeta[index];
    if (!meta) return;
    var payload = pagePayload(meta.id);
    if (!payload) return;

    S.services.storage.savePage(meta.id, payload).then(function (result) {
      if (result && result.ok === false) {
        console.warn('[app] page save failed', meta.id, result);
      }
    });
  }

  function storageConfigured() {
    return !!(S.services.storage && S.services.storage.isConfigured && S.services.storage.isConfigured());
  }

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
      this.modeBadge = document.getElementById('mode-badge');

      if (this.modeBadge) {
        this.modeBadge.hidden = !S.config.testMode;
      }

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

      if (target !== this.current) {
        savePageState(this.current);
        if (previous && previous.onLeave) {
          previous.onLeave();
        }
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

      if (S.config.testMode) {
        this.footerNote.textContent = '테스트 모드 · 응답과 대화 내용은 저장되지 않습니다.';
      } else if (!storageConfigured()) {
        this.footerNote.textContent = '저장소가 설정되지 않았습니다. 연구진에게 알려 주세요.';
      } else {
        this.footerNote.textContent = '응답은 익명으로 안전하게 저장됩니다.';
      }
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

  // 서버의 최신 페르소나(이름·인사말·버전)를 먼저 반영한 뒤 앱을 시작합니다.
  function boot() {
    var ready = typeof S.loadPersona === 'function' ? S.loadPersona() : Promise.resolve();
    ready.then(function () {
      app.init();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.Survey = window.Survey || {});
