/* Bootstrap del modulo: parte quando TizenBrew lo inietta nella pagina.
 *
 * Ordine dei compiti, dal più urgente al meno:
 *  1. far credere a Spotify di essere su un browser desktop (l'UA lato HTTP lo
 *     imposta il service file, qui sistemiamo quello lato JavaScript);
 *  2. avviare il motore no-ads prima che il player faccia la prima richiesta;
 *  3. costruire la UI televisiva e mappare i tasti del telecomando.
 */
'use strict';

import { startUi } from './ui.js';
import { on, emit } from './bus.js';
import { st } from './state.js';
import * as noads from './noads.js';
import * as player from './player.js';
import { ui, show, hide, toast, focusPlayer } from './registry.js';

(function boot() {
  if (window.__spotifyTv) return;

  var top = window.self === window.top;
  var cfg = (window.__spotifyTvConfig) || {};

  window.__spotifyTv = {
    version: '0.4.0',
    debug: false,
    log: [],
    showUi: function () { if (ui) show(); },
    hideUi: function () { if (ui) hide(); },
    focusPlayer: function () { focusPlayer(); },
    noads: noads,
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

  /* -------------------------------------------- 2. motore no-ads */
  if (cfg.noAds !== false) {
    try { noads.setNetworkContext(cfg.network); } catch (e) { }
    noads.init();
  }

  /* ------------------------------------------------- 3. UI e telecomando */
  if (top) {
    try { player.init(); } catch (e) { console.warn(e); }
    if (cfg.tvUi !== false) startUi();
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
        case KEY.GREEN: toast(st.adBlocked ? 'Pubblicità bloccate: ' + st.adBlocked : 'Nessuna pubblicità bloccata'); break;
        case KEY.YELLOW: window.__spotifyTv.debug = !window.__spotifyTv.debug; toast('Debug ' + (window.__spotifyTv.debug ? 'on' : 'off')); break;
        case KEY.RED: location.reload(); break;
        default: handled = false;
      }
    } else {
      switch (k) {
        case KEY.PLAYPAUSE: case KEY.PLAY: case KEY.PAUSE: case KEY.STOP: player.togglePlay(); break;
        case KEY.NEXT: case KEY.FF: player.next(); break;
        case KEY.PREV: case KEY.RW: player.prev(); break;
        case KEY.BLUE: show(); break;
        default: handled = false;
      }
    }

    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Se la pagina principale si ricarica, la UI va ricostruita.
  window.addEventListener('beforeunload', function () { window.__spotifyTvUi = null; });
})();
