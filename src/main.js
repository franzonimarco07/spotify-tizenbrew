/* Bootstrap del modulo: parte quando TizenBrew lo inietta nella pagina.
 *
 * Ordine dei compiti, dal più urgente al meno:
 *  1. far credere a Spotify di essere su un browser desktop (l'UA lato HTTP lo
 *     lo controlla il server, qui sistemiamo quello lato JavaScript);
 *  2. costruire la UI televisiva e mappare i tasti del telecomando.
 */
'use strict';

import { startUi } from './ui.js';
import { on, emit } from './bus.js';
import { st } from './state.js';
import * as player from './player.js';
import { ui, show, hide, toast, focusPlayer } from './registry.js';

(function boot() {
  if (window.__spotifyTv) return;

  // Diagnostica sempre attiva e leggibile: la UI la mostra col tasto GIALLO.
  // Serve a capire, dalla TV, se il modulo nuovo è arrivato e dove si ferma.
  var diag = [];
  function d(msg) {
    diag.push(new Date().toTimeString().substr(0, 8) + ' ' + msg);
    if (diag.length > 60) diag.shift();
  }
  d('boot v0.5.0 — ' + location.href.substr(0, 60));

  // Marcatore nel titolo: sulla TV si vede subito se il modulo nuovo gira.
  try {
    if (window.self === window.top) document.title = '[v050] ' + (document.title || 'Spotify');
  } catch (e) { }
  window.addEventListener('error', function (e) {
    d('ERRORE: ' + (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  });

  var top = window.self === window.top;
  var cfg = (window.__spotifyTvConfig) || {};

  window.__spotifyTv = {
    version: '0.5.0',
    debug: true,
    log: diag,
    diag: function () { return diag.join('\n'); },
    showUi: function () { if (ui) show(); },
    hideUi: function () { if (ui) hide(); },
    focusPlayer: function () { focusPlayer(); },
    commands: player
  };

  /* ---------------------------------------------------------- 1. UA JS */
  var CHROME = '120.0.0.0';
  var UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + CHROME + ' Safari/537.36';

  function defineGetter(obj, prop, value) {
    try { Object.defineProperty(obj, prop, { get: function () { return value; }, configurable: true }); } catch (e) { }
  }

  if (cfg.desktopUserAgent !== false) {
    var nav = Navigator.prototype;
    defineGetter(nav, 'userAgent', UA);
    defineGetter(nav, 'appVersion', UA.replace('Mozilla/', ''));
    defineGetter(nav, 'platform', 'Linux x86_64');
    defineGetter(nav, 'vendor', 'Google Inc.');
    defineGetter(nav, 'maxTouchPoints', 0);
    var brands = [
      { brand: 'Not?A_Brand', version: '8' },
      { brand: 'Chromium', version: '120' },
      { brand: 'Google Chrome', version: '120' }
    ];
    defineGetter(nav, 'userAgentData', {
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
    });
  }

  /* ------------------------------------------------- 2. UI e telecomando */
  if (top) {
    try { player.init(); d('player collegato'); } catch (e) { d('player KO: ' + e.message); }
    if (cfg.tvUi !== false) {
      try {
        startUi();
        var u = window.__spotifyTvUi;
        if (!u) d('UI non montata (body assente?)');
        else if (u.mountErrors && u.mountErrors.length) d('UI montata con errori: ' + u.mountErrors.join(' | '));
        else d('UI montata' + (u.mounted ? ' e visibile' : ' (in attesa del body)'));
      } catch (e) {
        d('UI KO: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
      }
    }
  } else {
    d('sono in un iframe: niente UI');
  }

  /* ---------------------------------------------------------- tasti */
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, FF: 417, RW: 412,
    NEXT: 10233, PREV: 10232,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    CHUP: 427, CHDOWN: 428
  };

  var mediaKeys = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward',
    'MediaRewind', 'MediaTrackNext', 'MediaTrackPrevious', 'ColorF0Red', 'ColorF1Green',
    'ColorF2Yellow', 'ColorF3Blue'];
  try {
    if (window.tizen && tizen.tvinputdevice) {
      mediaKeys.forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) { } });
    }
  } catch (e) { }

  function uiVisible() {
    return ui && window.__spotifyTvUi && window.__spotifyTvUi.visible;
  }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    var handled = true;

    if (top && uiVisible()) {
      switch (k) {
        case KEY.LEFT: window.__spotifyTvUi.move('left'); break;
        case KEY.RIGHT: window.__spotifyTvUi.move('right'); break;
        case KEY.UP: window.__spotifyTvUi.move('up'); break;
        case KEY.DOWN: window.__spotifyTvUi.move('down'); break;
        case KEY.ENTER: window.__spotifyTvUi.activate(); break;
        case KEY.BACK: window.__spotifyTvUi.back(); break;
        case KEY.PLAYPAUSE: case KEY.PLAY: case KEY.PAUSE: player.togglePlay(); break;
        case KEY.NEXT: case KEY.FF: player.next(); break;
        case KEY.PREV: case KEY.RW: player.prev(); break;
        case KEY.BLUE: show(); focusPlayer(); break;
        case KEY.YELLOW: showDiag(); break;
        case KEY.RED: location.reload(); break;
        default: handled = false;
      }
    } else {
      switch (k) {
        case KEY.PLAYPAUSE: case KEY.PLAY: case KEY.PAUSE: case KEY.STOP: player.togglePlay(); break;
        case KEY.NEXT: case KEY.FF: player.next(); break;
        case KEY.PREV: case KEY.RW: player.prev(); break;
        case KEY.BLUE: show(); break;
        case KEY.YELLOW: showDiag(); break;
        default: handled = false;
      }
    }

    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* Diagnostica a schermo: elenco del modulo ed errori.
   * Serve perché sulla TV non si vede la console. */
  var diagBox = null;
  function showDiag() {
    if (!document.body) return;
    if (!diagBox) {
      diagBox = document.createElement('div');
      diagBox.id = 'stv-diag';
      diagBox.style.cssText = 'position:fixed;left:2vw;right:2vw;bottom:2vh;max-height:70vh;overflow:hidden;' +
        'pointer-events:none;z-index:2147483647;background:rgba(0,0,0,.94);color:#9ef;border:1px solid #1ed760;border-radius:10px;' +
        'padding:14px 16px;font:13px/1.35 monospace;white-space:pre-wrap;';
      document.body.appendChild(diagBox);
    }
    if (diagBox.style.display === 'block') { diagBox.style.display = 'none'; return; }
    var lines = diag.slice(-16);
    diagBox.textContent = 'Spotify TV Mod ' + window.__spotifyTv.version + '   (GIALLO chiude)\n' +
      'pagina: ' + location.href.substr(0, 80) + '\n' +
      '--- eventi ---\n' + lines.join('\n');
    diagBox.style.display = 'block';
  }
  window.__spotifyTv.showDiag = showDiag;

  // Secondo aggancio, non in fase di capture: il primo listener potrebbe non
  // vedere il tasto se qualcosa lo ferma prima. Qui non blocchiamo nulla.
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === KEY.YELLOW) showDiag();
  }, false);

  // Se la pagina principale si ricarica, la UI va ricostruita.
  window.addEventListener('beforeunload', function () { window.__spotifyTvUi = null; });
})();
