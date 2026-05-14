/*
 * Welcome to Country splash — shared across all pages.
 * Self-contained: injects its own <style> + overlay <div> into the page
 * and handles fade in / 10s timeout / click-to-dismiss / sessionStorage.
 *
 * Include with:  <script src="/assets/welcome-splash.js" defer></script>
 */
(function () {
  'use strict';

  // Skip if already seen in this session
  try {
    if (sessionStorage.getItem('wtc-seen') === '1') return;
  } catch (e) {
    // sessionStorage may be unavailable (private mode); fail open and still show splash
  }

  function init() {
    // Inject styles once
    if (!document.getElementById('wtc-style')) {
      var style = document.createElement('style');
      style.id = 'wtc-style';
      style.textContent = [
        '.wtc-overlay{',
          'position:fixed;inset:0;z-index:9999;',
          'background:#5B1F3A;color:#F7F0E8;',
          'display:flex;align-items:center;justify-content:center;',
          'padding:40px;opacity:0;pointer-events:none;',
          'transition:opacity 800ms ease;cursor:pointer;',
          'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;',
          '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;',
        '}',
        '.wtc-overlay.show{opacity:1;pointer-events:auto;transition:opacity 400ms ease}',
        '.wtc-inner{max-width:720px;text-align:center}',
        '.wtc-divider{width:64px;height:1px;background:#C97B8E;margin:0 auto 28px}',
        '.wtc-title{',
          'font-size:clamp(36px,4.5vw,48px);font-weight:500;',
          'letter-spacing:-0.025em;line-height:1.05;margin-bottom:28px;',
          'text-wrap:balance;',
        '}',
        '.wtc-body{',
          'font-size:17px;line-height:1.55;max-width:600px;margin:0 auto;',
          'color:rgba(247,240,232,0.9);',
        '}',
        '.wtc-hint{',
          'margin-top:40px;font-size:11px;font-weight:500;letter-spacing:0.12em;',
          'text-transform:uppercase;color:rgba(247,240,232,0.55);',
        '}'
      ].join('');
      document.head.appendChild(style);
    }

    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'wtc-overlay';
    overlay.id = 'wtc-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Welcome to Country');
    overlay.innerHTML = [
      '<div class="wtc-inner">',
        '<div class="wtc-divider"></div>',
        '<h2 class="wtc-title">Welcome to Country</h2>',
        '<p class="wtc-body">In a spirit of reconciliation, we acknowledge the Traditional Custodians of country throughout Australia, and their connections to land, sea and community. We pay our respect to their Elders past and present and extend that respect to all Aboriginal and Torres Strait Islander peoples today.</p>',
        '<p class="wtc-hint">Tap anywhere to continue</p>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      try { sessionStorage.setItem('wtc-seen', '1'); } catch (e) { /* ignore */ }
      overlay.style.transition = 'opacity 800ms ease';
      overlay.classList.remove('show');
      setTimeout(function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 850);
    }

    // Fade in on next frame
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    // Auto-dismiss after 10s
    var auto = setTimeout(dismiss, 10000);

    // Click anywhere on the overlay dismisses early
    overlay.addEventListener('click', function () {
      clearTimeout(auto);
      dismiss();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
