(function () {
  'use strict';

  var toastEl = null;
  var toastTimer = 0;

  function setupCopyCommands() {
    var codes = [].slice.call(document.querySelectorAll('code')).filter(function (code) {
      return /^\s*npm\s/.test(code.textContent);
    });
    codes.forEach(function (code) {
      code.classList.add('fx-copy');
      code.setAttribute('role', 'button');
      code.setAttribute('tabindex', '0');
      code.setAttribute('title', 'Нажмите, чтобы скопировать команду');
      var copy = function () { copyText(code.textContent.trim()); };
      code.addEventListener('click', copy);
      code.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        copy();
      });
    });
  }

  function copyText(value) {
    var done = function (ok) { showToast(ok ? 'Скопировано ✓' : 'Не удалось скопировать'); };
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      fallbackCopy(value, done);
      return;
    }
    navigator.clipboard.writeText(value).then(function () { done(true); }, function () {
      fallbackCopy(value, done);
    });
  }

  function fallbackCopy(value, done) {
    try {
      var field = document.createElement('textarea');
      field.value = value;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.focus();
      field.select();
      var copied = document.execCommand('copy');
      field.remove();
      done(copied);
    } catch (error) {
      done(false);
    }
  }

  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'fx-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('is-on'); }, 1600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupCopyCommands);
  else setupCopyCommands();
})();
