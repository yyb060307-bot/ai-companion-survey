/**
 * 연구자 대시보드
 * ------------------------------------------------------------
 * Supabase Auth(이메일+비밀번호)로 로그인한 뒤,
 * survey_participants 뷰에서 참여자 요약과 대화 전문을 읽습니다.
 *
 * - 읽기 권한은 Supabase RLS가 담당합니다. (supabase/admin.sql)
 * - anon key만 사용하며 service_role 키는 브라우저에 두지 않습니다.
 * - 대화 내용은 textContent로만 렌더링해 HTML 주입을 막습니다.
 */
(function () {
  'use strict';

  var Survey = window.Survey || {};
  var config = Survey.config || {};
  var supabase = config.supabase || {};
  var baseUrl = String(supabase.url || '').replace(/\/+$/, '');
  var anonKey = supabase.anonKey || '';

  var SESSION_KEY = 'survey_admin_session_v1';

  var SUMMARY_COLUMNS = [
    'response_id',
    'short_id',
    'status',
    'completed',
    'chat_ended',
    'consent_at',
    'started_at',
    'completed_at',
    'chat_ended_at',
    'last_seen_at',
    'user_turn_count',
    'assistant_turn_count',
    'duration_ms',
    'ended_reason',
    'ended_by_user',
    'min_turns_met',
    'min_user_turns',
    'max_user_turns',
    'model',
  ].join(',');

  var STATUS_META = {
    completed: { label: '완료', className: 'status-chip--completed' },
    chat_ended: { label: '대화 종료', className: 'status-chip--chat_ended' },
    in_progress: { label: '진행 중', className: 'status-chip--in_progress' },
  };

  var REASON_LABELS = {
    user: '사용자 종료',
    max_turns: '최대 턴 도달',
  };

  var PSYCH_LABELS = {
    loneliness: '외로움',
    isolation: '소외감',
    disclosure: '자기노출',
    support: '사회적 지지',
  };

  var EVALUATION_LABELS = {
    immersion: '몰입',
    closeness: '친밀감',
    empathy: '공감',
    relief: '외로움 감소',
    continueDesire: '지속 의향',
  };

  var state = {
    session: null,
    participants: [],
    loading: false,
    detailToken: 0,
    filter: {
      q: '',
      status: 'all',
      sort: 'recent',
    },
  };

  var el = {};
  var toastTimer = null;

  // ── 초기화 ──────────────────────────────────────────────
  function init() {
    el = {
      loginView: document.getElementById('login-view'),
      dashboardView: document.getElementById('dashboard-view'),
      loginForm: document.getElementById('login-form'),
      loginEmail: document.getElementById('login-email'),
      loginPassword: document.getElementById('login-password'),
      loginBtn: document.getElementById('login-btn'),
      loginError: document.getElementById('login-error'),
      logoutBtn: document.getElementById('logout-btn'),
      adminUser: document.getElementById('admin-user'),
      refreshBtn: document.getElementById('refresh-btn'),
      exportBtn: document.getElementById('export-btn'),
      lastRefreshed: document.getElementById('last-refreshed'),
      stats: document.getElementById('stats'),
      searchInput: document.getElementById('search-input'),
      statusFilter: document.getElementById('status-filter'),
      sortSelect: document.getElementById('sort-select'),
      resultCount: document.getElementById('result-count'),
      rows: document.getElementById('participant-rows'),
      emptyState: document.getElementById('empty-state'),
      loadingState: document.getElementById('loading-state'),
      detailBackdrop: document.getElementById('detail-backdrop'),
      detailDrawer: document.getElementById('detail-drawer'),
      detailTitle: document.getElementById('detail-title'),
      detailBody: document.getElementById('detail-body'),
      detailClose: document.getElementById('detail-close'),
      toast: document.getElementById('admin-toast'),
    };

    if (!isConfigured()) {
      showLogin();
      showLoginError('Supabase 설정이 비어 있습니다. survey/js/config.js의 supabase.url과 anonKey를 확인해 주세요.');
      el.loginBtn.disabled = true;
      return;
    }

    bindEvents();
    state.session = readSession();

    if (state.session && state.session.access_token) {
      restoreSession();
    } else {
      showLogin();
    }
  }

  function isConfigured() {
    return !!(
      baseUrl &&
      anonKey &&
      baseUrl.indexOf('YOUR_PROJECT') < 0 &&
      anonKey.indexOf('YOUR_PUBLIC') < 0
    );
  }

  function bindEvents() {
    el.loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      login();
    });

    el.logoutBtn.addEventListener('click', logout);
    el.refreshBtn.addEventListener('click', loadParticipants);
    el.exportBtn.addEventListener('click', exportCsv);

    el.searchInput.addEventListener('input', function () {
      state.filter.q = el.searchInput.value;
      renderTable();
    });

    el.statusFilter.addEventListener('change', function () {
      state.filter.status = el.statusFilter.value;
      renderTable();
    });

    el.sortSelect.addEventListener('change', function () {
      state.filter.sort = el.sortSelect.value;
      renderTable();
    });

    el.detailClose.addEventListener('click', closeDetail);
    el.detailBackdrop.addEventListener('click', closeDetail);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !el.detailDrawer.hidden) {
        closeDetail();
      }
    });
  }

  // ── 세션·인증 ───────────────────────────────────────────
  function readSession() {
    try {
      return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeSession(session) {
    state.session = session;
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      // 시크릿 모드 등 저장소를 쓸 수 없으면 메모리에만 유지합니다.
    }
  }

  function clearSession() {
    state.session = null;
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // ignore
    }
  }

  function normalizeSession(data, fallbackEmail) {
    var user = data.user || {};
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 30000,
      email: user.email || fallbackEmail || '',
    };
  }

  async function authRequest(path, options) {
    options = options || {};
    var response = await fetch(baseUrl + path, {
      method: options.method || 'POST',
      headers: Object.assign(
        {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        options.headers || {}
      ),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    var text = await response.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        (data && (data.error_description || data.msg || data.message)) ||
          '요청에 실패했습니다. (' + response.status + ')'
      );
    }

    return data;
  }

  async function ensureSession() {
    var session = state.session || readSession();
    if (!session || !session.access_token) return null;

    if (session.expires_at && Date.now() < session.expires_at) {
      state.session = session;
      return session;
    }

    if (!session.refresh_token) {
      clearSession();
      return null;
    }

    try {
      var data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        body: { refresh_token: session.refresh_token },
      });
      var next = normalizeSession(data, session.email);
      writeSession(next);
      return next;
    } catch (error) {
      clearSession();
      return null;
    }
  }

  async function checkAdmin() {
    var session = await ensureSession();
    if (!session) return false;

    var response = await fetch(baseUrl + '/rest/v1/rpc/is_survey_admin', {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
    });

    if (response.status === 401) {
      clearSession();
      return false;
    }

    if (!response.ok) {
      var text = await response.text();
      var message = '권한 확인에 실패했습니다.';
      try {
        var data = JSON.parse(text);
        message = data.message || data.hint || message;
      } catch (error) {
        // ignore
      }
      throw new Error(message + ' supabase/admin.sql을 실행했는지 확인해 주세요.');
    }

    var result = await response.json();
    return result === true;
  }

  async function login() {
    var email = el.loginEmail.value.trim();
    var password = el.loginPassword.value;
    if (!email || !password) return;

    hideLoginError();
    el.loginBtn.disabled = true;
    el.loginBtn.textContent = '로그인 중…';

    try {
      var data = await authRequest('/auth/v1/token?grant_type=password', {
        body: { email: email, password: password },
      });
      writeSession(normalizeSession(data, email));

      var isAdmin = await checkAdmin();
      if (!isAdmin) {
        clearSession();
        showLoginError(
          '이 계정은 연구자 허용 목록에 없습니다. Supabase의 survey_admins 테이블에 이 이메일을 등록해 주세요.'
        );
        return;
      }

      el.loginPassword.value = '';
      showDashboard();
      await loadParticipants();
    } catch (error) {
      clearSession();
      showLoginError(authErrorMessage(error));
    } finally {
      el.loginBtn.disabled = false;
      el.loginBtn.textContent = '로그인';
    }
  }

  async function restoreSession() {
    var session = await ensureSession();
    if (!session) {
      clearSession();
      showLogin();
      return;
    }

    try {
      var isAdmin = await checkAdmin();
      if (!isAdmin) {
        clearSession();
        showLogin();
        showLoginError(
          '로그인 세션은 있지만 연구자 권한이 없습니다. survey_admins에 이메일을 등록한 뒤 다시 로그인해 주세요.'
        );
        return;
      }
      showDashboard();
      await loadParticipants();
    } catch (error) {
      clearSession();
      showLogin();
      showLoginError(authErrorMessage(error));
    }
  }

  async function logout() {
    var session = state.session;
    if (session && session.access_token) {
      try {
        await fetch(baseUrl + '/auth/v1/logout', {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: 'Bearer ' + session.access_token,
          },
        });
      } catch (error) {
        // 로컬 세션만 지워도 충분합니다.
      }
    }

    clearSession();
    state.participants = [];
    state.detailToken += 1;
    closeDetail();
    showLogin();
  }

  function authErrorMessage(error) {
    var message = (error && error.message) || '로그인에 실패했습니다.';
    if (/invalid login credentials/i.test(message)) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (/email not confirmed/i.test(message)) {
      return '이메일 인증이 완료되지 않았습니다. Supabase Dashboard에서 계정을 확인해 주세요.';
    }
    return message;
  }

  function showLogin() {
    el.loginView.hidden = false;
    el.dashboardView.hidden = true;
    el.logoutBtn.hidden = true;
    el.adminUser.hidden = true;
    window.setTimeout(function () {
      if (el.loginEmail) el.loginEmail.focus();
    }, 0);
  }

  function showDashboard() {
    el.loginView.hidden = true;
    el.dashboardView.hidden = false;
    el.logoutBtn.hidden = false;
    el.adminUser.hidden = !(state.session && state.session.email);
    el.adminUser.textContent = (state.session && state.session.email) || '';
    hideLoginError();
  }

  function showLoginError(message) {
    el.loginError.textContent = message;
    el.loginError.hidden = false;
  }

  function hideLoginError() {
    el.loginError.textContent = '';
    el.loginError.hidden = true;
  }

  // ── 데이터 조회 ─────────────────────────────────────────
  async function rest(path) {
    var session = await ensureSession();
    if (!session) {
      showLogin();
      throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
    }

    var response = await fetch(baseUrl + '/rest/v1/' + path, {
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + session.access_token,
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      clearSession();
      showLogin();
      throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
    }

    var text = await response.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = text;
    }

    if (!response.ok) {
      var message =
        (data && (data.message || data.hint || data.details)) ||
        '데이터를 불러오지 못했습니다. (' + response.status + ')';
      if (response.status === 403) {
        message += ' supabase/admin.sql의 SELECT 권한을 확인해 주세요.';
      }
      throw new Error(message);
    }

    return data;
  }

  async function loadParticipants() {
    if (state.loading) return;
    state.loading = true;
    el.loadingState.hidden = false;
    el.emptyState.hidden = true;

    try {
      var rows = await rest(
        'survey_participants?select=' +
          encodeURIComponent(SUMMARY_COLUMNS) +
          '&order=last_seen_at.desc'
      );
      state.participants = Array.isArray(rows) ? rows : [];
      renderStats();
      renderTable();
      el.lastRefreshed.textContent = '마지막 새로고침: ' + formatDateTime(new Date().toISOString());
    } catch (error) {
      toast(error.message);
    } finally {
      state.loading = false;
      el.loadingState.hidden = true;
    }
  }

  // ── 요약 통계 ───────────────────────────────────────────
  function renderStats() {
    var rows = state.participants;
    var total = rows.length;
    var completed = rows.filter(function (row) {
      return row.completed === true;
    }).length;
    var chatEnded = rows.filter(function (row) {
      return row.chat_ended === true;
    }).length;
    var turnValues = rows
      .map(function (row) {
        return toNumber(row.user_turn_count);
      })
      .filter(function (value) {
        return value !== null;
      });
    var durationValues = rows
      .map(function (row) {
        return toNumber(row.duration_ms);
      })
      .filter(function (value) {
        return value !== null;
      });

    var completionRate = total ? Math.round((completed / total) * 100) : 0;
    var avgTurns = average(turnValues);
    var avgDuration = average(durationValues);
    var maxTurns = turnValues.length ? Math.max.apply(null, turnValues) : null;
    var dropped = Math.max(0, chatEnded - completed);

    el.stats.innerHTML = '';
    el.stats.appendChild(
      statCard('전체 참여자', formatNumber(total) + '명', '대화 시작 기준')
    );
    el.stats.appendChild(
      statCard('설문 완료', formatNumber(completed) + '명', '완료율 ' + completionRate + '%')
    );
    el.stats.appendChild(
      statCard('대화 종료', formatNumber(chatEnded) + '명', '종료 후 미완료 ' + formatNumber(dropped) + '명')
    );
    el.stats.appendChild(
      statCard(
        '평균 발화 수',
        avgTurns === null ? '—' : avgTurns.toFixed(1) + '회',
        maxTurns === null ? '데이터 없음' : '최대 ' + maxTurns + '회'
      )
    );
    el.stats.appendChild(
      statCard('평균 대화 시간', formatDuration(avgDuration), '대화 종료자 기준')
    );
  }

  function statCard(label, value, sub) {
    var card = document.createElement('div');
    card.className = 'admin-stat';
    card.appendChild(createEl('span', 'admin-stat-value', value));
    card.appendChild(createEl('span', 'admin-stat-label', label));
    if (sub) card.appendChild(createEl('span', 'admin-stat-sub', sub));
    return card;
  }

  // ── 표 ──────────────────────────────────────────────────
  function renderTable() {
    var rows = visibleParticipants();
    el.rows.innerHTML = '';
    el.resultCount.textContent = formatNumber(rows.length) + '명 / 전체 ' + formatNumber(state.participants.length) + '명';
    el.emptyState.hidden = rows.length > 0;

    var fragment = document.createDocumentFragment();

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.title = '참여자 ' + shortId(row) + ' 상세 보기';

      tr.appendChild(cell(statusChip(row.status)));

      var idCell = document.createElement('td');
      var idText = createEl('span', 'admin-id', shortId(row));
      idText.title = row.response_id || '';
      idCell.appendChild(idText);
      tr.appendChild(idCell);

      var turns = toNumber(row.user_turn_count);
      var assistantTurns = toNumber(row.assistant_turn_count);
      var turnsCell = cell(turns === null ? '—' : turns + '회');
      turnsCell.className = 'admin-turn-count';
      if (turns !== null || assistantTurns !== null) {
        turnsCell.title =
          '사용자 ' + (turns === null ? '—' : turns) + '회 / AI ' +
          (assistantTurns === null ? '—' : assistantTurns) + '회';
      }
      tr.appendChild(turnsCell);

      tr.appendChild(cell(formatDuration(row.duration_ms)));
      tr.appendChild(cell(minTurnsText(row.min_turns_met)));
      tr.appendChild(cell(reasonText(row.ended_reason), 'admin-reason'));
      tr.appendChild(cell(formatDateTime(row.started_at)));
      tr.appendChild(cell(formatDateTime(row.last_seen_at)));

      var actionCell = document.createElement('td');
      var openBtn = createEl('button', 'btn btn-ghost admin-open', '보기');
      openBtn.type = 'button';
      openBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        openDetail(row.response_id);
      });
      actionCell.appendChild(openBtn);
      tr.appendChild(actionCell);

      tr.addEventListener('click', function () {
        openDetail(row.response_id);
      });
      tr.addEventListener('keydown', function (event) {
        if (event.target !== tr) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail(row.response_id);
        }
      });

      fragment.appendChild(tr);
    });

    el.rows.appendChild(fragment);
  }

  function visibleParticipants() {
    var query = state.filter.q.trim().toLowerCase();
    var status = state.filter.status;

    var rows = state.participants.filter(function (row) {
      if (status !== 'all' && row.status !== status) return false;
      if (!query) return true;
      var id = String(row.response_id || '').toLowerCase();
      var short = String(row.short_id || '').toLowerCase();
      return id.indexOf(query) >= 0 || short.indexOf(query) >= 0;
    });

    rows = rows.slice();

    if (state.filter.sort === 'turns') {
      rows.sort(function (a, b) {
        return compareDesc(toNumber(a.user_turn_count), toNumber(b.user_turn_count)) || compareRecent(a, b);
      });
    } else if (state.filter.sort === 'duration') {
      rows.sort(function (a, b) {
        return compareDesc(toNumber(a.duration_ms), toNumber(b.duration_ms)) || compareRecent(a, b);
      });
    } else if (state.filter.sort === 'started') {
      rows.sort(function (a, b) {
        return compareDate(toDate(a.started_at), toDate(b.started_at), true);
      });
    } else {
      rows.sort(compareRecent);
    }

    return rows;
  }

  function compareRecent(a, b) {
    return compareDate(toDate(a.last_seen_at), toDate(b.last_seen_at), false);
  }

  function compareDate(a, b, ascending) {
    var aTime = a ? a.getTime() : 0;
    var bTime = b ? b.getTime() : 0;
    return ascending ? aTime - bTime : bTime - aTime;
  }

  function compareDesc(a, b) {
    var aValue = a === null ? -1 : a;
    var bValue = b === null ? -1 : b;
    return bValue - aValue;
  }

  // ── 상세 ────────────────────────────────────────────────
  async function openDetail(responseId) {
    if (!responseId) return;

    var token = ++state.detailToken;
    el.detailTitle.textContent = '참여자 상세';
    el.detailBody.innerHTML = '';
    el.detailBody.appendChild(createEl('p', 'admin-loading', '대화와 응답을 불러오는 중입니다…'));
    el.detailBackdrop.hidden = false;
    el.detailDrawer.hidden = false;
    document.body.style.overflow = 'hidden';
    el.detailClose.focus();

    try {
      var rows = await rest(
        'survey_participants?select=*&response_id=eq.' +
          encodeURIComponent(responseId) +
          '&limit=1'
      );
      if (token !== state.detailToken) return;

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('해당 참여자의 데이터를 찾지 못했습니다.');
      }

      renderDetail(rows[0]);
    } catch (error) {
      if (token !== state.detailToken) return;
      renderDetailError(error.message);
    }
  }

  function closeDetail() {
    state.detailToken += 1;
    el.detailDrawer.hidden = true;
    el.detailBackdrop.hidden = true;
    el.detailBody.innerHTML = '';
    document.body.style.overflow = '';
  }

  function renderDetail(row) {
    el.detailTitle.textContent = '참여자 ' + shortId(row);
    el.detailBody.innerHTML = '';

    var titleRow = document.createElement('div');
    titleRow.className = 'admin-detail-title-row';
    titleRow.appendChild(statusChip(row.status));
    titleRow.appendChild(createEl('span', 'admin-detail-id', row.response_id || '—'));

    var copyBtn = createEl('button', 'btn btn-ghost admin-open', 'ID 복사');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      copyText(row.response_id || '');
    });
    titleRow.appendChild(copyBtn);
    el.detailBody.appendChild(titleRow);

    var metaSection = document.createElement('section');
    metaSection.className = 'admin-section';
    var metaGrid = document.createElement('div');
    metaGrid.className = 'admin-meta';

    [
      ['상태', statusLabel(row.status)],
      ['동의 시각', formatDateTime(row.consent_at)],
      ['시작', formatDateTime(row.started_at)],
      ['완료', formatDateTime(row.completed_at)],
      ['대화 종료', formatDateTime(row.chat_ended_at)],
      ['마지막 활동', formatDateTime(row.last_seen_at)],
      ['발화 수', formatCount(row.user_turn_count, '회')],
      ['AI 응답 수', formatCount(row.assistant_turn_count, '회')],
      ['대화 시간', formatDuration(row.duration_ms)],
      ['종료 사유', reasonText(row.ended_reason)],
      ['최소 턴 충족', minTurnsText(row.min_turns_met)],
      ['모델', valueOrDash(row.model)],
      ['프롬프트 버전', valueOrDash(row.prompt_version)],
      ['토큰', tokenText(row)],
      ['이벤트 수', formatCount(row.event_count, '개')],
      ['마지막 페이지', valueOrDash(row.last_page_id)],
    ].forEach(function (pair) {
      var item = document.createElement('div');
      item.className = 'admin-meta-item';
      item.appendChild(createEl('span', 'admin-meta-label', pair[0]));
      item.appendChild(createEl('span', 'admin-meta-value', pair[1]));
      metaGrid.appendChild(item);
    });

    metaSection.appendChild(metaGrid);
    el.detailBody.appendChild(metaSection);
    el.detailBody.appendChild(transcriptSection(row));
    el.detailBody.appendChild(surveySection(row));
  }

  function renderDetailError(message) {
    el.detailBody.innerHTML = '';
    var notice = document.createElement('p');
    notice.className = 'notice notice--warning';
    notice.textContent = message;
    el.detailBody.appendChild(notice);
  }

  function transcriptSection(row) {
    var transcript = Array.isArray(row.transcript) ? row.transcript.slice() : [];
    transcript.sort(function (a, b) {
      return (Number(a.at) || 0) - (Number(b.at) || 0);
    });

    var section = document.createElement('section');
    section.className = 'admin-section';

    var heading = document.createElement('h3');
    heading.appendChild(document.createTextNode('대화 전문'));
    heading.appendChild(
      createEl('span', 'muted', transcript.length ? formatNumber(transcript.length) + '개 메시지' : '저장된 메시지 없음')
    );
    section.appendChild(heading);

    if (transcript.length === 0) {
      section.appendChild(
        createEl(
          'p',
          'muted small',
          '대화를 종료하기 전에 이탈했거나 대화 기록이 저장되지 않았습니다.'
        )
      );
      return section;
    }

    var log = document.createElement('div');
    log.className = 'admin-transcript';
    transcript.forEach(function (message) {
      log.appendChild(transcriptMessage(message));
    });
    section.appendChild(log);
    return section;
  }

  function transcriptMessage(message) {
    var content = message && message.content != null ? String(message.content) : '';

    if (!message || message.role === 'system') {
      return createEl('div', 'chat-system', content);
    }

    var isUser = message.role === 'user';
    var wrap = createEl('div', 'message ' + (isUser ? 'message--user' : 'message--assistant'));

    if (!isUser) {
      wrap.appendChild(
        createEl('span', 'avatar avatar--sm', (config.character && config.character.avatar) || 'AI')
      );
    }

    var body = document.createElement('div');
    body.className = 'message-body';

    var meta = document.createElement('div');
    meta.className = 'message-meta';
    var name = isUser
      ? '참여자'
      : (config.character && config.character.name) || 'AI';
    var time = message.at ? formatTime(message.at) : '';
    meta.textContent = time ? name + ' · ' + time : name;

    body.appendChild(meta);
    body.appendChild(createEl('div', 'bubble', content));
    wrap.appendChild(body);
    return wrap;
  }

  function surveySection(row) {
    var section = document.createElement('section');
    section.className = 'admin-section';
    section.appendChild(createEl('h3', null, '설문 응답'));

    if (!row.pre_ai && !row.pre_psych && !row.post_psych && !row.evaluation) {
      section.appendChild(
        createEl('p', 'muted small', '완료된 설문 응답이 없습니다. (대화 종료 후 이탈했을 수 있습니다.)')
      );
      return section;
    }

    var preAI = row.pre_ai || {};
    var prePsych = row.pre_psych || {};
    var postPsych = row.post_psych || {};
    var evaluation = row.evaluation || {};
    var configData = config;

    section.appendChild(
      answerGroup('사전 검사 · AI 사용 경험', [
        ['AI에 대한 인식', valueOrDash(preAI.perception)],
        ['사용 목적', Array.isArray(preAI.purposes) && preAI.purposes.length ? preAI.purposes.join(', ') : '—'],
        ['하루 사용 시간', optionValue(preAI.usageTime, configData.usageTimeOptions)],
        ['사용 기간', optionValue(preAI.usagePeriod, configData.usagePeriodOptions)],
        ['AI에게 자기노출', optionValue(preAI.selfDisclosure, configData.selfDisclosureLabels)],
      ])
    );

    section.appendChild(
      answerGroup('사전 검사 · 심리 상태', psychPairs(prePsych, true, configData))
    );

    section.appendChild(
      answerGroup('사후 검사 · 심리 상태', psychPairs(postPsych, false, configData))
    );

    section.appendChild(
      answerGroup('챗봇 경험 평가', evaluationPairs(evaluation, configData))
    );

    return section;
  }

  function psychPairs(payload, includeNetwork, configData) {
    var pairs = [];
    var constructs = Survey.psychConstructs || [];

    constructs.forEach(function (construct) {
      pairs.push([
        PSYCH_LABELS[construct.key] || construct.key,
        scaleValue(payload[construct.key], configData.psychLabels),
      ]);
    });

    if (includeNetwork) {
      pairs.push([
        '친한 사람 수',
        optionValue(payload.networkMeet, configData.networkMeetOptions),
      ]);
      pairs.push([
        '친한 사람과 연락 빈도',
        optionValue(payload.networkContact, configData.networkContactOptions),
      ]);
    }

    return pairs;
  }

  function evaluationPairs(payload, configData) {
    var pairs = [];
    var items = Survey.evaluationItems || [];

    items.forEach(function (item) {
      pairs.push([
        EVALUATION_LABELS[item.key] || item.key,
        scaleValue(payload[item.key], configData.likertLabels),
      ]);
    });

    return pairs;
  }

  function answerGroup(title, pairs) {
    var group = document.createElement('div');
    group.className = 'admin-answer-group';
    group.appendChild(createEl('h4', null, title));

    var list = document.createElement('dl');
    list.className = 'admin-answer-list';

    pairs.forEach(function (pair) {
      var row = document.createElement('div');
      row.className = 'admin-answer-row';
      row.appendChild(createEl('dt', null, pair[0]));
      row.appendChild(createEl('dd', null, pair[1]));
      list.appendChild(row);
    });

    group.appendChild(list);
    return group;
  }

  // ── CSV ─────────────────────────────────────────────────
  function exportCsv() {
    var rows = visibleParticipants();
    if (rows.length === 0) {
      toast('내려받을 데이터가 없습니다.');
      return;
    }

    var header = [
      'response_id',
      '짧은ID',
      '상태',
      '완료',
      '대화종료',
      '발화수',
      'AI응답수',
      '대화시간_ms',
      '대화시간',
      '종료사유',
      '최소턴충족',
      '동의시각_ISO',
      '시작_ISO',
      '대화종료시각_ISO',
      '완료시각_ISO',
      '마지막활동_ISO',
      '모델',
    ];

    var lines = [header];
    rows.forEach(function (row) {
      lines.push([
        row.response_id,
        shortId(row),
        statusLabel(row.status),
        row.completed ? 'Y' : 'N',
        row.chat_ended ? 'Y' : 'N',
        row.user_turn_count,
        row.assistant_turn_count,
        row.duration_ms,
        formatDuration(row.duration_ms),
        reasonText(row.ended_reason),
        minTurnsText(row.min_turns_met),
        isoOrEmpty(row.consent_at),
        isoOrEmpty(row.started_at),
        isoOrEmpty(row.chat_ended_at),
        isoOrEmpty(row.completed_at),
        isoOrEmpty(row.last_seen_at),
        row.model,
      ]);
    });

    var csv = '\uFEFF' + lines.map(function (line) {
      return line.map(csvCell).join(',');
    }).join('\r\n');

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'survey_participants_' + timestamp() + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);

    toast(formatNumber(rows.length) + '명의 요약을 CSV로 내려받았습니다.');
  }

  function csvCell(value) {
    if (value === null || value === undefined) return '';
    var text = String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function timestamp() {
    var date = new Date();
    return (
      date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') +
      '_' +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0')
    );
  }

  // ── 유틸 ────────────────────────────────────────────────
  function createEl(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function cell(content, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    if (content instanceof Node) {
      td.appendChild(content);
    } else {
      td.textContent = content === null || content === undefined ? '—' : String(content);
    }
    return td;
  }

  function statusChip(status) {
    var meta = STATUS_META[status] || { label: status || '—', className: 'status-chip--neutral' };
    return createEl('span', 'status-chip ' + meta.className, meta.label);
  }

  function statusLabel(status) {
    return (STATUS_META[status] && STATUS_META[status].label) || status || '—';
  }

  function reasonText(reason) {
    if (!reason) return '—';
    return REASON_LABELS[reason] || reason;
  }

  function minTurnsText(value) {
    if (value === true) return '충족';
    if (value === false) return '미달';
    return '—';
  }

  function shortId(row) {
    if (row.short_id) return row.short_id;
    return row.response_id ? String(row.response_id).slice(0, 8) : '—';
  }

  function valueOrDash(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  function optionValue(value, options) {
    if (value === null || value === undefined || value === '') return '—';
    var index = Number(value) - 1;
    if (Array.isArray(options) && options[index] !== undefined) {
      return value + ' · ' + options[index];
    }
    return String(value);
  }

  function scaleValue(value, labels) {
    if (value === null || value === undefined || value === '') return '—';
    var index = Number(value) - 1;
    if (Array.isArray(labels) && labels[index] !== undefined) {
      return value + ' · ' + labels[index];
    }
    return String(value);
  }

  function formatCount(value, unit) {
    var number = toNumber(value);
    return number === null ? '—' : formatNumber(number) + unit;
  }

  function tokenText(row) {
    var input = toNumber(row.input_tokens);
    var output = toNumber(row.output_tokens);
    var latency = toNumber(row.latency_ms);
    if (input === null && output === null && latency === null) return '—';

    var parts = [];
    if (input !== null) parts.push('in ' + formatNumber(input));
    if (output !== null) parts.push('out ' + formatNumber(output));
    if (latency !== null) parts.push('지연 ' + formatDuration(latency));
    return parts.join(' / ');
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function average(values) {
    if (!values.length) return null;
    var sum = values.reduce(function (total, value) {
      return total + value;
    }, 0);
    return sum / values.length;
  }

  function formatNumber(value) {
    var number = toNumber(value);
    if (number === null) return '0';
    return number.toLocaleString('ko-KR');
  }

  function formatDuration(ms) {
    var value = toNumber(ms);
    if (value === null) return '—';

    var total = Math.max(0, Math.round(value / 1000));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;

    if (hours > 0) return hours + '시간 ' + minutes + '분';
    if (minutes > 0) return minutes + '분 ' + String(seconds).padStart(2, '0') + '초';
    return seconds + '초';
  }

  function toDate(value) {
    if (!value) return null;
    var date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isoOrEmpty(value) {
    var date = toDate(value);
    return date ? date.toISOString() : '';
  }

  function formatDateTime(value) {
    var date = toDate(value);
    if (!date) return '—';
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function formatTime(value) {
    var date = toDate(Number(value));
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function copyText(text) {
    if (!text) return;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        function () {
          toast('response_id를 복사했습니다.');
        },
        function () {
          toast('복사에 실패했습니다.');
        }
      );
      return;
    }

    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      toast('response_id를 복사했습니다.');
    } catch (error) {
      toast('복사에 실패했습니다.');
    }
    document.body.removeChild(textarea);
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, 3200);
  }

  function boot() {
    var ready = typeof Survey.loadPersona === 'function' ? Survey.loadPersona() : Promise.resolve();
    ready.then(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
