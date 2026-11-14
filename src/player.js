/* Player: comanda Spotify e legge lo stato reale.
 *
 * Sul web non esiste una API: i comandi passano dai bottoni del player (data-testid)
 * oppure, quando questi non ci sono, da eventi tastiera sul documento. La UI non
 * parla mai col DOM di Spotify: chiama queste funzioni e ascolta il bus.
 */
'use strict';

import { on, emit } from './bus.js';
import { st, setPlaying, setPosition, setVolume, setTrack, setAd } from './state.js';
import { networkContext, fetchOriginal, adLog } from './noads.js';

function q(sel) { return document.querySelector(sel); }

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
  adLog('barra di avanzamento non trovata');
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

export function navigate(path) {
  location.hash = '#' + path;
}

export function back() {
  if (history.length > 1) history.back();
}

/* La UI legge da qui lo stato del player del sito: se Spotify non ci dice
 * nulla, proviamo a dedurlo dai suoi elementi. */
export function pollDomState() {
  try {
    var btn = q('[data-testid="control-button-playpause"]');
    if (btn) {
      var label = (btn.getAttribute('aria-label') || btn.title || '').toLowerCase();
      if (label) setPlaying(label.indexOf('pause') !== -1 || label.indexOf('pausa') !== -1);
    }
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
  setInterval(pollDomState, 1500);
  pollDomState();
}
