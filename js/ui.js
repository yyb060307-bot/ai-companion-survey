/**
 * 공통 UI 헬퍼
 * ------------------------------------------------------------
 * 페이지 모듈에서 반복되는 입력 UI와 바인딩을 담당합니다.
 */
(function (S) {
  var ui = {};

  ui.escape = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  ui.attr = ui.escape;

  /**
   * 척도형 라디오 그룹
   * labels 개수에 맞춰 4점·5점 척도를 렌더링합니다.
   * value가 null이면 아무것도 선택되지 않습니다.
   */
  ui.likert = function (name, value, options) {
    options = options || {};
    var labels = options.labels || S.config.likertLabels;
    var min = options.min || 1;
    var max = options.max || labels.length;
    var disabled = options.disabled ? ' disabled' : '';
    var html = '<div class="likert likert--' + max + '" role="radiogroup" aria-label="' + ui.attr(options.ariaLabel || name) + '">';

    for (var i = min; i <= max; i++) {
      var label = labels[i - min] || String(i);
      var checked = Number(value) === i ? ' checked' : '';
      html += '<label class="likert-option">' +
        '<input type="radio" name="' + ui.attr(name) + '" value="' + i + '"' + checked + disabled +
        ' aria-label="' + i + '점 ' + ui.attr(label) + '">' +
        '<span class="likert-num">' + i + '</span>' +
        '<span class="likert-label">' + ui.escape(label) + '</span>' +
        '</label>';
    }

    html += '</div>';
    return html;
  };

  /**
   * 선택지형 라디오 그룹
   * options 배열의 순서대로 1부터 값을 부여합니다.
   */
  ui.choice = function (name, value, options) {
    options = options || {};
    var choices = options.options || [];
    var html = '<div class="choice-list" role="radiogroup" aria-label="' + ui.attr(options.ariaLabel || name) + '">';

    choices.forEach(function (label, index) {
      var optionValue = index + 1;
      var checked = Number(value) === optionValue ? ' checked' : '';
      html += '<label class="choice">' +
        '<input type="radio" name="' + ui.attr(name) + '" value="' + optionValue + '"' + checked + '>' +
        '<span>' + ui.escape(label) + '</span>' +
        '</label>';
    });

    html += '</div>';
    return html;
  };

  /** 라디오/체크박스 변경 바인딩 */
  ui.bindLikert = function (root, name, onChange) {
    root.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (input.checked) onChange(Number(input.value));
      });
    });
  };

  ui.bindRadio = function (root, name, onChange) {
    root.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (input.checked) onChange(input.value);
      });
    });
  };

  ui.bindCheckboxes = function (root, name, onChange) {
    root.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.addEventListener('change', function () {
        var values = [];
        root.querySelectorAll('input[name="' + name + '"]:checked').forEach(function (checked) {
          values.push(checked.value);
        });
        onChange(values);
      });
    });
  };

  ui.bindInput = function (root, selector, eventName, handler) {
    var el = root.querySelector(selector);
    if (el) el.addEventListener(eventName, handler);
    return el;
  };

  /** 문항 하나를 담는 카드 (척도형 또는 선택지형) */
  ui.questionCard = function (options) {
    var input = options.options
      ? ui.choice(options.name, options.value, {
          options: options.options,
          ariaLabel: options.question,
        })
      : ui.likert(options.name, options.value, {
          ariaLabel: options.question,
          labels: options.labels,
        });

    return '<section class="card question-card">' +
      '<p class="question">' + ui.escape(options.question) + '</p>' +
      input +
    '</section>';
  };

  /** 알림 박스 */
  ui.notice = function (text, type) {
    return '<div class="notice notice--' + (type || 'info') + '">' + ui.escape(text) + '</div>';
  };

  /** 토스트 */
  var toastTimer = null;
  ui.toast = function (message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2800);
  };

  ui.formatDuration = function (ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + '분 ' + String(seconds).padStart(2, '0') + '초';
  };

  ui.scrollToBottom = function (el) {
    if (el) el.scrollTop = el.scrollHeight;
  };

  S.ui = ui;
})(window.Survey = window.Survey || {});
