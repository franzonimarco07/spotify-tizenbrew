/* Player: comanda Spotify e legge lo stato reale.
 *
 * Sul web non esiste una API: i comandi passano dai bottoni del player (data-testid)
 * oppure, quando questi non ci sono, da eventi tastiera sul documento. La UI non
 * parla mai col DOM di Spotify: chiama queste funzioni e ascolta il bus.
 */
'use strict';

import { on, emit } from './bus.js';
import { st, setPlaying, setPosition, setVolume, setTrack, setAd } from './state.js';

function q(sel) { return document.querySelector(sel); }

/* L'elemento audio/video che Spotify fa suonare: è l'unica fonte affidabile per
 * "sta suonando?" (l'etichetta del tasto di Spotify dice "Pausa" anche da fermo). */
var media = null;
function trackMedia(m) {
  media = m;
  if (m.__stv) return;
  m.__stv = true;
  ['playing', 'pause', 'ended', 'emptied'].forEach(function (type) {
    m.addEventListener(type, function () { if (m === media) setPlaying(!m.paused && !m.ended); });
  });
}
try {
  var origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    trackMedia(this);
    return origPlay.apply(this, arguments);
  };
} catch (e) { }

function click(sel) {
  var el = q(sel);
  if (el) {
    el.click();
    return true;
  }
  return false;
}

function press(key, code) {
  var ev = new KeyboardEvent('keydown', { key: key, code: code, bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
}

export function togglePlay() {
  if (click('[data-testid="control-button-playpause"]')) return;
  press(' ', 'Space');
  setPlaying(!st.playing);
}

export function next() {
  if (click('[data-testid="control-button-skip-forward"]')) return;
  press('MediaTrackNext', 'MediaTrackNext');
}

export function prev() {
  if (click('[data-testid="control-button-skip-back"]')) return;
  press('MediaTrackPrevious', 'MediaTrackPrevious');
}

export function seek(deltaSeconds) {
  var target = Math.max(0, Math.min(st.duration || 0, (st.position || 0) + deltaSeconds));
  // Il player di Spotify ha una barra di avanzamento con role="slider": la
  // spostiamo simulando i tasti freccia quando è a fuoco, altrimenti usiamo
  // il click sulla barra (posizione proporzionale).
  var bar = q('[data-testid="playback-progressbar"]');
  if (bar) {
    var r = bar.getBoundingClientRect();
    if (r.width > 0 && st.duration > 0) {
      var x = r.left + (target / st.duration) * r.width;
      var y = r.top + r.height / 2;
      ['mousedown', 'mouseup', 'click'].forEach(function (type) {
        bar.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      });
      setPosition(target);
      return;
    }
  }
  if (window.console) console.warn('[spotify-tv] barra di avanzamento non trovata');
}

export function seekTo(ratio) {
  if (!st.duration) return;
  seek(ratio * st.duration - st.position);
}

export function setVol(v) {
  v = Math.max(0, Math.min(1, v));
  var bar = q('[data-testid="volume-bar"] [role="slider"]') || q('[data-testid="volume-bar"]');
  if (bar) {
    var r = bar.getBoundingClientRect();
    if (r.width > 0) {
      var x = r.left + v * r.width;
      var y = r.top + r.height / 2;
      ['mousedown', 'mouseup', 'click'].forEach(function (type) {
        bar.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      });
    }
  }
  setVolume(v);
}

export function volumeDelta(d) { setVol((st.volume || 0) + d); }

/* Cambio pagina senza ricaricare: Spotify è una single page app che ascolta
 * la history del browser, quindi basta pushState + popstate. */
export function navigate(path) {
  if (location.pathname === path) return;
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
}

function mouseClick(e) {
  var r = e.getBoundingClientRect();
  var opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    var Ev = /^pointer/.test(type) && window.PointerEvent ? PointerEvent : MouseEvent;
    e.dispatchEvent(new Ev(type, opts));
  });
}

/* OK del telecomando su un elemento della pagina di Spotify. */
export function activate(e) {
  if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') {
    e.focus();
    return;
  }
  // riga di una tracklist: si suona il brano (sul web è il doppio clic,
  // oppure il tasto play nascosto nella prima colonna)
  if (e.getAttribute('role') === 'row' || e.getAttribute('data-testid') === 'tracklist-row') {
    var playBtn = e.querySelector('button[aria-label^="Riproduci"], button[aria-label^="Play"]');
    if (playBtn) { playBtn.click(); return; }
    var r = e.getBoundingClientRect();
    e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    return;
  }
  if (e.tagName === 'A' || e.tagName === 'BUTTON') { e.click(); return; }
  // schede e altri elementi con role=button: Spotify spesso ascolta i mouse event
  mouseClick(e);
}

export function login() {
  var b = q('[data-testid="login-button"]');
  if (b) b.click();
  else location.href = 'https://accounts.spotify.com/login?continue=' + encodeURIComponent('https://open.spotify.com/');
}

function parseTime(txt) {
  if (!txt) return NaN;
  var parts = txt.trim().split(':').map(Number);
  var s = 0;
  for (var i = 0; i < parts.length; i++) s = s * 60 + parts[i];
  return s;
}

export function back() {
  if (history.length > 1) history.back();
}

/* La UI legge da qui lo stato del player del sito: se Spotify non ci dice
 * nulla, proviamo a dedurlo dai suoi elementi. */
export function pollDomState() {
  try {
    if (media) setPlaying(!media.paused && !media.ended);
    var title = q('[data-testid="context-item-info-title"]');
    var artist = q('[data-testid="context-item-info-artist"]');
    var art = q('[data-testid="cover-art-image"] img, [data-testid="now-playing-widget"] img');
    if (title) {
      var name = (title.textContent || '').trim();
      var artists = artist ? (artist.textContent || '').trim() : '';
      if (name && (!st.track || st.track.name !== name || st.track.artists !== artists)) {
        setTrack({
          uri: '', name: name, artists: artists, album: '',
          art: art ? (art.currentSrc || art.src || '') : '',
          duration: st.duration
        });
      }
    }
    var dur = parseTime((q('[data-testid="playback-duration"]') || {}).textContent);
    if (isFinite(dur) && dur > 0) st.duration = dur;
    var pos = parseTime((q('[data-testid="playback-position"]') || {}).textContent);
    if (isFinite(pos)) setPosition(pos);
    var sub = q('[data-testid="context-item-info-ad-subtitle"]');
    setAd(!!sub);
  } catch (e) { }
}

export function init() {
  on('cluster_position', function (p) {
    setPosition(p.position);
    setPlaying(!p.paused);
  });
  on('media_position', function (pos) { setPosition(pos); });
  on('media_duration', function (d) {
    if (isFinite(d) && d > 0 && st.duration && Math.abs(d - st.duration) > 3) setPosition(Math.min(st.position, d));
  });
  on('media_playing', function (p) { setPlaying(p); });
  setInterval(pollDomState, 1000);
  pollDomState();
}
