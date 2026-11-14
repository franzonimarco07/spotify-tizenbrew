/* Spotify TV Mod for TizenBrew — v0.1 (test build)
 * Runs at document start inside open.spotify.com.
 *  1. Desktop Chrome user agent (Spotify blocks "SMART-TV; Tizen").
 *  2. Remote control: arrows = spatial navigation, OK = click, Back = back,
 *     media keys = player controls.
 *  3. Diagnostics overlay (BLUE key).
 */
(function () {
  'use strict';
  if (window.__spotifyTvMod) return;
  window.__spotifyTvMod = { version: '0.1.0', log: [] };

  var CHROME = '108.0.0.0';
  var UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + CHROME + ' Safari/537.36';

  function log(msg) {
    var line = new Date().toISOString().substr(11, 8) + ' ' + msg;
    window.__spotifyTvMod.log.push(line);
    if (window.__spotifyTvMod.log.length > 40) window.__spotifyTvMod.log.shift();
    renderDiag();
  }

  // ---------- 1. User agent ----------
  try {
    if (window.tizen && tizen.websetting && tizen.websetting.setUserAgentString) {
      tizen.websetting.setUserAgentString(UA);
    }
  } catch (e) { /* not available for remote origins */ }

  function defineGetter(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true });
    } catch (e) { }
  }
  var nav = Navigator.prototype;
  defineGetter(nav, 'userAgent', UA);
  defineGetter(nav, 'appVersion', UA.replace('Mozilla/', ''));
  defineGetter(nav, 'platform', 'Linux x86_64');
  defineGetter(nav, 'vendor', 'Google Inc.');
  defineGetter(nav, 'maxTouchPoints', 0);
  var brands = [
    { brand: 'Not?A_Brand', version: '8' },
    { brand: 'Chromium', version: '108' },
    { brand: 'Google Chrome', version: '108' }
  ];
  var uaData = {
    brands: brands,
    mobile: false,
    platform: 'Linux',
    getHighEntropyValues: function () {
      return Promise.resolve({
        brands: brands, mobile: false, platform: 'Linux', platformVersion: '6.1.0',
        architecture: 'x86', bitness: '64', model: '', uaFullVersion: CHROME,
        fullVersionList: brands.map(function (b) { return { brand: b.brand, version: b.version + '.0.0.0' }; })
      });
    },
    toJSON: function () { return { brands: brands, mobile: false, platform: 'Linux' }; }
  };
  defineGetter(nav, 'userAgentData', uaData);

  // ---------- 2. Remote control ----------
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, FF: 417, RW: 412,
    NEXT: 10233, PREV: 10232, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
  };

  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
        'MediaTrackNext', 'MediaTrackPrevious', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue']
        .forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) { } });
    }
  } catch (e) { }

  var FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [role="button"], [role="link"], [role="option"], [role="tab"], [role="menuitem"], [role="row"], [role="slider"], [tabindex]:not([tabindex="-1"])';

  function visibleRect(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return null;
    return r;
  }

  function candidates() {
    var list = [];
    var els = document.querySelectorAll(FOCUSABLE);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // skip elements nested inside another focusable (e.g. button inside a row) unless it's the only target
      var r = visibleRect(el);
      if (r) list.push({ el: el, r: r });
    }
    return list;
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    var cur = document.activeElement;
    var list = candidates();
    if (!list.length) return;
    if (!cur || cur === document.body || !visibleRect(cur)) {
      focusEl(list[0].el);
      return;
    }
    var cr = cur.getBoundingClientRect();
    var c = center(cr);
    var best = null, bestScore = Infinity;
    list.forEach(function (it) {
      if (it.el === cur || cur.contains(it.el) || it.el.contains(cur)) return;
      var p = center(it.r);
      var dx = p.x - c.x, dy = p.y - c.y, primary, ortho;
      if (dir === 'left') { if (it.r.right > cr.left + 2) return; primary = -dx; ortho = Math.abs(dy); }
      if (dir === 'right') { if (it.r.left < cr.right - 2) return; primary = dx; ortho = Math.abs(dy); }
      if (dir === 'up') { if (it.r.bottom > cr.top + 2) return; primary = -dy; ortho = Math.abs(dx); }
      if (dir === 'down') { if (it.r.top < cr.bottom - 2) return; primary = dy; ortho = Math.abs(dx); }
      var score = primary + ortho * 2.5;
      if (score < bestScore) { bestScore = score; best = it.el; }
    });
    if (best) focusEl(best);
    else scrollFrom(cur, dir);
  }

  function scrollFrom(el, dir) {
    var node = el;
    var dy = dir === 'down' ? 400 : dir === 'up' ? -400 : 0;
    var dx = dir === 'right' ? 400 : dir === 'left' ? -400 : 0;
    while (node && node !== document.documentElement) {
      var cs = getComputedStyle(node);
      var canY = dy && /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight;
      var canX = dx && /(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth;
      if (canY || canX) { node.scrollBy({ top: dy, left: dx, behavior: 'smooth' }); return; }
      node = node.parentElement;
    }
  }

  function focusEl(el) {
    if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function clickTestId(id) {
    var el = document.querySelector('[data-testid="' + id + '"]');
    if (el) { el.click(); return true; }
    log('control not found: ' + id);
    return false;
  }

  function isTextInput(el) {
    return el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit)$/.test(el.type)));
  }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode, a = document.activeElement, handled = true;
    lastKey = k;
    switch (k) {
      case KEY.LEFT: if (isTextInput(a)) { handled = false; break; } move('left'); break;
      case KEY.RIGHT: if (isTextInput(a)) { handled = false; break; } move('right'); break;
      case KEY.UP: move('up'); break;
      case KEY.DOWN: move('down'); break;
      case KEY.ENTER:
        if (isTextInput(a)) { handled = false; break; }
        if (a && a !== document.body) a.click(); else move('down');
        break;
      case KEY.BACK:
        if (isTextInput(a)) a.blur(); else history.back();
        break;
      case KEY.PLAYPAUSE: case KEY.PLAY: case KEY.PAUSE: case KEY.STOP:
        clickTestId('control-button-playpause'); break;
      case KEY.NEXT: case KEY.FF: clickTestId('control-button-skip-forward'); break;
      case KEY.PREV: case KEY.RW: clickTestId('control-button-skip-back'); break;
      case KEY.BLUE: diagVisible = !diagVisible; renderDiag(); break;
      case KEY.YELLOW: location.reload(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
    if (diagVisible) renderDiag();
  }, true);

  // ---------- 3. Styles + diagnostics ----------
  var diagVisible = true, lastKey = '-', diagEl = null, emeStatus = 'checking…';

  var CSS = [
    ':focus, :focus-visible { outline: 4px solid #1ed760 !important; outline-offset: 2px !important; border-radius: 6px; }',
    '#stvmod-diag { position: fixed; z-index: 2147483647; right: 24px; bottom: 120px; width: 620px; max-height: 60vh; overflow: hidden;',
    '  background: rgba(0,0,0,.85); color: #e8e8e8; font: 15px/1.35 monospace; padding: 14px 16px; border-radius: 10px; border: 1px solid #1ed760; white-space: pre-wrap; pointer-events: none; }'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('stvmod-style')) return;
    var s = document.createElement('style');
    s.id = 'stvmod-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function renderDiag() {
    if (!document.body) return;
    if (!diagEl) {
      diagEl = document.createElement('div');
      diagEl.id = 'stvmod-diag';
      document.body.appendChild(diagEl);
    }
    diagEl.style.display = diagVisible ? 'block' : 'none';
    if (!diagVisible) return;
    var audio = document.querySelector('video, audio');
    diagEl.textContent =
      'Spotify TV Mod ' + window.__spotifyTvMod.version + '   (BLU = nascondi, GIALLO = ricarica)\n' +
      'UA js: ' + navigator.userAgent.substr(0, 70) + '…\n' +
      'Widevine: ' + emeStatus + '\n' +
      'Media element: ' + (audio ? (audio.paused ? 'paused' : 'playing') + ' t=' + audio.currentTime.toFixed(1) : 'none') + '\n' +
      'URL: ' + location.pathname + '   last key: ' + lastKey + '\n' +
      '--- log ---\n' + window.__spotifyTvMod.log.slice(-12).join('\n');
  }

  function checkEme() {
    if (!navigator.requestMediaKeySystemAccess) { emeStatus = 'EME API missing'; return renderDiag(); }
    navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
      initDataTypes: ['cenc'],
      audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"', robustness: 'SW_SECURE_CRYPTO' }]
    }]).then(function (acc) {
      return acc.createMediaKeys().then(function () { emeStatus = 'OK (access + MediaKeys)'; });
    }).catch(function (e) { emeStatus = 'FAIL ' + e.name + ': ' + e.message; })
      .then(renderDiag);
  }

  window.addEventListener('error', function (e) { log('JS error: ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; log('promise: ' + (r && (r.message || r.name) || r));
  });

  // Hook EME so we can see Spotify's license flow on screen
  if (navigator.requestMediaKeySystemAccess) {
    var origRmksa = navigator.requestMediaKeySystemAccess.bind(navigator);
    navigator.requestMediaKeySystemAccess = function (ks, cfg) {
      log('site asks DRM: ' + ks);
      return origRmksa(ks, cfg).then(function (a) { log('DRM granted: ' + ks); return a; },
        function (e) { log('DRM denied: ' + ks + ' ' + e.message); throw e; });
    };
  }

  function onReady() {
    injectStyle();
    renderDiag();
    checkEme();
    log('loaded on ' + location.host);
    setInterval(function () { if (diagVisible) renderDiag(); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})();
