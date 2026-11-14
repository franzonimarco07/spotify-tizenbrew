/* Motore "no-ads" per il web player di Spotify (account Free).
 *
 * Come funziona il playback sul web: il client non riproduce un file scelto da
 * sé, ma una "state machine" (una lista di stati, ognuno con un brano) che gli
 * arriva da spclient.wg.spotify.com/track-playback/v1/... . Le pubblicità sono
 * stati normali il cui brano ha un uri `spotify:ad:...`. Se lo stato dell'ad
 * viene sostituito, prima che il client lo riproduca, con lo stato successivo
 * libero, l'audio dell'ad non viene mai chiesto al CDN.
 *
 * Questo file è la versione compatta, riscritta per la TV, dell'approccio di
 * T-64/spotify-ad-skip e tomer8007/spotify-web-ads-remover (GPL-3.0).
 * Rispetto all'originale:
 *  - nessuna dipendenza esterna e nessun popup: tutto passa dal bus;
 *  - una coda con timeout, così un blocco non ferma il player;
 *  - niente richieste di stati "futuri" (troppo lente su TV): se non si conosce
 *    lo stato dopo l'ad, si accorcia l'ad invece di rischiare un blocco;
 *  - rilevamento dell'ad anche dal DOM e dall'elemento audio, come rete di
 *    sicurezza quando la state machine non è leggibile.
 */
'use strict';

import { emit } from './bus.js';
import { st, setAd, setTrack, trackFromMetadata } from './state.js';

var LOG_MAX = 120;
var logLines = [];
var bootCtx = null;
export function setNetworkContext(c) { bootCtx = c; }
export function adLog(msg) {
  var line = new Date().toTimeString().substr(0, 8) + ' ' + msg;
  logLines.push(line);
  if (logLines.length > LOG_MAX) logLines.shift();
  if (window.__spotifyTv && window.__spotifyTv.debug) console.log('[noads]', msg);
  emit('noadslog', line);
}
export function adLogLines() { return logLines.slice(); }

/* ------------------------------------------------------------------ coda */
function Queue(timeoutMs) {
  this.items = [];
  this.busy = false;
  this.timeoutMs = timeoutMs;
}
Queue.prototype.push = function (fn, fallback) {
  var self = this;
  return new Promise(function (resolve) {
    self.items.push({ fn: fn, fallback: fallback, resolve: resolve });
    self.next();
  });
};
Queue.prototype.next = function () {
  if (this.busy) return;
  var item = this.items.shift();
  if (!item) return;
  var self = this;
  var done = false;
  var timer = setTimeout(function () {
    if (done) return;
    done = true;
    adLog('coda in timeout, passo avanti');
    try { item.resolve(item.fallback ? item.fallback() : null); } catch (e) { item.resolve(null); }
    self.busy = false;
    self.next();
  }, this.timeoutMs);
  this.busy = true;
  Promise.resolve()
    .then(item.fn)
    .then(function (v) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      item.resolve(v);
      self.busy = false;
      self.next();
    }, function (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      adLog('errore: ' + (e && e.message || e));
      try { item.resolve(item.fallback ? item.fallback() : null); } catch (x) { item.resolve(null); }
      self.busy = false;
      self.next();
    });
};

var queue = new Queue(8000);

/* ------------------------------------------------------- contesto rete */
var ctx = bootCtx || {
  deviceId: '',
  authorization: '',
  clientToken: '',
  accessToken: ''
};

export function networkContext() { return ctx; }

var origFetch = window.fetch;
var origOpen = XMLHttpRequest.prototype.open;
var origSend = XMLHttpRequest.prototype.send;
var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

export function fetchOriginal(url, init) {
  return origFetch.call(window, url, init);
}

/* -------------------------------------------------------------- fetch */
function parseJson(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function patchBody(body) {
  var data = parseJson(body);
  if (!data) return body;
  var ref = data.state_ref;
  if (ref && typeof ref.state_id === 'string' && ref.state_id.indexOf('future_') !== -1) {
    // "future_<machine>+<id>": il client chiede uno stato di una state machine
    // diversa da quella corrente. Rimettiamo la richiesta in forma normale.
    var parts = ref.state_id.split('+');
    ref.state_machine_id = parts[1];
    ref.state_id = parts[2];
    adLog('richiesta stato "future" normalizzata');
    return JSON.stringify(data);
  }
  return body;
}

window.fetch = function (input, init) {
  try {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!init) init = {};
    if (init.headers) {
      var h = init.headers;
      if (h.get) {
        if (h.get('authorization')) ctx.authorization = h.get('authorization');
        if (h.get('client-token')) ctx.clientToken = h.get('client-token');
      } else {
        if (h.authorization) ctx.authorization = h.authorization;
        if (h['authorization']) ctx.authorization = h['authorization'];
        if (h['client-token']) ctx.clientToken = h['client-token'];
      }
    }

    if (url.indexOf('/state') !== -1 && init.body) {
      init = Object.assign({}, init, { body: patchBody(init.body) });
      return origFetch.call(window, input, init).then(function (res) {
        if (!res.ok || res.status === 204) return res;
        return rewriteStateResponse(res);
      });
    }

    if (url.indexOf('/devices') !== -1 && init.body) {
      var d = parseJson(init.body);
      if (d && d.device && d.device.device_id) ctx.deviceId = d.device.device_id;
      return origFetch.call(window, input, init);
    }

    if (url.indexOf('get_access_token') !== -1) {
      return origFetch.call(window, input, init).then(function (res) {
        // clone(): leggere l'originale lascerebbe a Spotify un body consumato.
        try {
          res.clone().json().then(function (j) {
            if (j && j.accessToken) ctx.accessToken = j.accessToken;
          }).catch(function () { });
        } catch (e) { }
        return res;
      });
    }

    return origFetch.call(window, input, init);
  } catch (e) {
    adLog('hook fetch: ' + e.message);
    return origFetch.call(window, input, init);
  }
};

/* ---------------------------------------------------------------- XHR
 * Alcune build del client usano XMLHttpRequest per /state. Lo trattiamo come
 * il fetch: aggiorniamo il contesto e rimandiamo alla fine la risposta
 * riscritta quando è il caso. */
XMLHttpRequest.prototype.open = function (method, url) {
  this.__stvUrl = String(url || '');
  return origOpen.apply(this, arguments);
};
XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
  try {
    var n = String(name).toLowerCase();
    if (n === 'authorization') ctx.authorization = value;
    if (n === 'client-token') ctx.clientToken = value;
  } catch (e) { }
  return origSetHeader.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function (body) {
  var xhr = this;
  try {
    var url = xhr.__stvUrl || '';
    if (url.indexOf('/state') !== -1 && body) {
      body = patchBody(body);
      if (xhr.responseType === '' || xhr.responseType === 'text') {
        xhr.addEventListener('readystatechange', function () {
          if (xhr.readyState !== 4 || xhr.status !== 200) return;
          try {
            var data = parseJson(xhr.responseText);
            if (!data) return;
            var out = transformPayload(data);
            if (!out) return;
            Object.defineProperty(xhr, 'responseText', { value: JSON.stringify(out), configurable: true });
            Object.defineProperty(xhr, 'response', { value: JSON.stringify(out), configurable: true });
          } catch (e) { }
        });
      }
    } else if (url.indexOf('/devices') !== -1 && body) {
      var d = parseJson(body);
      if (d && d.device && d.device.device_id) ctx.deviceId = d.device.device_id;
    }
  } catch (e) { }
  return origSend.call(this, body);
};

/* ----------------------------------------------------- risposta /state */
function rewriteStateResponse(res) {
  var status = res.status;
  var statusText = res.statusText;
  var headers = res.headers;
  return res.clone().text().then(function (text) {
    var data = parseJson(text);
    if (!data) return res;
    return queue.push(function () {
      var out = transformPayload(data);
      return out ? JSON.stringify(out) : text;
    }, function () { return text; }).then(function (body) {
      var h = new Headers(headers);
      h.delete('content-length');
      h.delete('content-encoding');
      var out = new Response(body, { status: status, statusText: statusText, headers: h });
      Object.defineProperty(out, 'url', { value: res.url });
      Object.defineProperty(out, 'redirected', { value: res.redirected });
      Object.defineProperty(out, 'type', { value: res.type });
      return out;
    });
  }).catch(function (e) {
    adLog('risposta /state non riscritta: ' + e.message);
    return res;
  });
}

/* ------------------------------------------------------------ WebSocket */
var NativeWS = window.WebSocket;

function MutableMessageEvent(o) {
  this.type = o.type || 'message';
  this.data = o.data || null;
  this.origin = o.origin || '';
  this.lastEventId = o.lastEventId || '';
  this.source = o.source || null;
  this.ports = o.ports || [];
  this.bubbles = o.bubbles || false;
  this.cancelable = o.cancelable || false;
  this.timeStamp = o.timeStamp || Date.now();
}
MutableMessageEvent.prototype = Object.create(MessageEvent.prototype);
MutableMessageEvent.prototype.constructor = MutableMessageEvent;

var sockets = [];

function HookedWS(url, protocols) {
  var ws = protocols ? new NativeWS(url, protocols) : new NativeWS(url);
  sockets.push(ws);
  adLog('websocket aperto: ' + String(url).split('?')[0]);

  var onmessageFn = null;
  Object.defineProperty(ws, 'onmessage', {
    configurable: true,
    get: function () { return onmessageFn; },
    set: function (fn) { onmessageFn = fn; }
  });

  var opened = false;
  ws.addEventListener('open', function () { opened = true; });

  ws.addEventListener('message', function (event) {
    if (!onmessageFn) return;
    var payload = event.data;
    // Solo i messaggi con "payloads" contengono stato da modificare. Gli altri
    // (pong/heartbeat) passano subito: se li mettessimo in coda il player
    // andrebbe in timeout dopo 10 secondi.
    if (typeof payload !== 'string' || payload.indexOf('"payloads"') === -1) {
      onmessageFn.call(ws, event);
      return;
    }
    queue.push(function () {
      return handleWsPayload(payload);
    }, function () { return null; }).then(function (out) {
      var ev = event;
      if (out) ev = new MutableMessageEvent({ type: 'message', data: out, origin: event.origin });
      try { onmessageFn.call(ws, ev); } catch (e) { adLog('onmessage: ' + e.message); }
    });
  });

  // Spotify riconnette solo se vede una disconnessione "normale": un errore
  // dopo l'apertura (es. dopo lo standby della TV) la farebbe credere a un
  // problema di autenticazione. Lo lasciamo arrivare come close.
  var onerrorFn = null;
  Object.defineProperty(ws, 'onerror', {
    configurable: true,
    get: function () { return onerrorFn; },
    set: function (fn) { onerrorFn = fn; }
  });
  ws.addEventListener('error', function (event) {
    if (opened) return;
    if (onerrorFn) onerrorFn.call(ws, event);
  });

  return ws;
}
HookedWS.prototype = NativeWS.prototype;
Object.setPrototypeOf(HookedWS, NativeWS);
Object.defineProperty(HookedWS, 'OPEN', { value: 1 });
Object.defineProperty(HookedWS, 'CLOSED', { value: 3 });
Object.defineProperty(HookedWS, 'CONNECTING', { value: 0 });
Object.defineProperty(HookedWS, 'CLOSING', { value: 2 });
window.WebSocket = HookedWS;

function handleWsPayload(raw) {
  var data = parseJson(raw);
  if (!data || !data.payloads) return null;
  var changed = false;

  for (var i = 0; i < data.payloads.length; i++) {
    var p = data.payloads[i];
    if (!p) continue;

    if (p.type === 'replace_state' && p.state_machine && p.state_ref) {
      p.state_machine = manipulateStateMachine(p.state_machine, p.state_ref.state_index, true);
      changed = true;
      continue;
    }

    // Aggiornamento del cluster: stato del player, posizione, brano corrente.
    if (p.cluster) {
      readCluster(p.cluster);
      var ps = p.cluster.player_state;
      if (ps && ps.track && ps.track.provider === 'ads/inject_tracks') {
        // Spotify vuole iniettare un ad fuori dalla state machine.
        adLog('ad iniettato bloccato (advertiser: ' + (ps.track.metadata && ps.track.metadata.advertiser) + ')');
        setAd(true);
        p.cluster.player_state.track = null;
        changed = true;
        bumpCounter();
      }
    }
  }
  return changed ? JSON.stringify(data) : null;
}

function readCluster(cluster) {
  try {
    var ps = cluster.player_state;
    if (!ps) return;
    var pos = ps.position_as_of_timestamp;
    if (isFinite(pos)) {
      var ts = ps.timestamp || cluster.timestamp;
      var since = ts && !ps.is_paused ? Math.max(0, Date.now() - ts) : 0;
      emit('cluster_position', { position: (pos + since) / 1000, paused: !!ps.is_paused });
    }
    if (ps.track && ps.track.metadata) {
      var uri = ps.track.metadata.uri || '';
      var isAd = uri.indexOf(':ad:') !== -1 || ps.track.provider === 'ads/inject_tracks' ||
        (ps.track.content_type || '').toUpperCase() === 'AD';
      if (isAd) {
        setAd(true);
      } else {
        setAd(false);
        var t = trackFromMetadata(ps.track.metadata);
        if (t && (!st.track || st.track.uri !== t.uri || st.track.name !== t.name)) {
          setTrack(t);
          adLog('brano: ' + t.name + ' — ' + t.artists);
        }
      }
    }
  } catch (e) { }
}

/* ------------------------------------------------------- state machine */
function trackOf(sm, state) {
  if (!state || !sm.tracks) return null;
  var id = state.track;
  return sm.tracks[id] || null;
}

function isAdState(sm, state) {
  if (!state) return false;
  if (typeof state.state_id === 'string' && state.state_id.indexOf('filler') !== -1) return false;
  var t = trackOf(sm, state);
  if (!t) return false;
  var uri = (t.metadata && t.metadata.uri) || '';
  if (uri.indexOf(':ad:') !== -1) return true;
  if ((t.content_type || '').toUpperCase() === 'AD') return true;
  return false;
}

function nextIndex(sm, index, key) {
  var state = sm.states && sm.states[index];
  if (!state || !state.transitions) return -1;
  var tr = state.transitions[key || 'advance'];
  if (!tr || tr.state_index == null) return -1;
  return tr.state_index;
}

function nextAdFreeIndex(sm, startIndex) {
  var i = nextIndex(sm, startIndex, 'advance');
  var guard = 0;
  while (i >= 0 && isAdState(sm, sm.states[i]) && guard++ < 8) {
    i = nextIndex(sm, i, 'advance');
  }
  return i;
}

var totalBlocked = 0;
function bumpCounter() {
  totalBlocked++;
  st.adBlocked = totalBlocked;
  emit('adblocked', totalBlocked);
}

function manipulateStateMachine(sm, startIndex, replacing) {
  if (!sm || !sm.states || startIndex == null) return sm;
  var blocked = 0;
  var maxPasses = 3;

  for (var pass = 0; pass < maxPasses; pass++) {
    var removed = false;
    for (var i = 0; i < sm.states.length; i++) {
      var state = sm.states[i];
      if (!isAdState(sm, state)) continue;

      var uri = (trackOf(sm, state).metadata || {}).uri || '';
      var target = nextAdFreeIndex(sm, i);
      if (target >= 0) {
        sm.states[i] = sm.states[target];
        removed = true;
        blocked++;
        adLog('ad saltato: ' + uri);
      } else {
        // Non sappiamo cosa viene dopo: accorciamo l'ad a zero invece di
        // lasciarlo partire. Il client salta allo stato successivo.
        shorten(sm, state);
        removed = true;
        blocked++;
        adLog('ad accorciato: ' + uri);
      }
    }
    if (!removed) break;
  }

  if (blocked) {
    totalBlocked += blocked;
    st.adBlocked = totalBlocked;
    emit('adblocked', totalBlocked);
    if (replacing) setAd(false);
  }

  // Toglie i riferimenti ai brani pubblicitari rimasti nella tabella.
  if (sm.tracks) {
    for (var j = 0; j < sm.tracks.length; j++) {
      var t = sm.tracks[j];
      if (t && (t.metadata || {}).uri && String(t.metadata.uri).indexOf(':ad:') !== -1) sm.tracks[j] = null;
    }
  }
  return sm;
}

function shorten(sm, state) {
  var t = trackOf(sm, state);
  var duration = (t && t.metadata && t.metadata.duration) || 30000;
  state.disallow_seeking = false;
  state.restrictions = {};
  state.initial_playback_position = duration;
  state.position_offset = duration;
}

function transformPayload(data) {
  try {
    if (data.commands) {
      // risposta a /state_conflict: più state machine da sistemare
      var keys = Object.keys(data.commands);
      for (var i = 0; i < keys.length; i++) {
        var cmd = data.commands[keys[i]];
        if (cmd && cmd.state_machine && cmd.state_ref) {
          cmd.state_machine = manipulateStateMachine(cmd.state_machine, cmd.state_ref.state_index, false);
        }
      }
      return data;
    }
    if (data.state_machine && data.updated_state_ref) {
      data.state_machine = manipulateStateMachine(data.state_machine, data.updated_state_ref.state_index, false);
      return data;
    }
    return null;
  } catch (e) {
    adLog('state machine: ' + e.message);
    return null;
  }
}

/* --------------------------------------- rete di sicurezza: DOM e audio */
var AD_UI = '[data-testid="ad-companion-card"], [data-testid="ad-slot-container"], [data-testid="ad-billboard"], ' +
  '[data-testid="context-item-info-ad-subtitle"], [aria-label="Advertisement"], [aria-label="Pubblicità"]';

var adUiSeen = false;

function checkDomForAd() {
  var el = document.querySelector(AD_UI);
  if (el) {
    if (!adUiSeen) adLog('ad rilevato dal DOM');
    adUiSeen = true;
    setAd(true);
    muteAdAudio(true);
    try { el.style.display = 'none'; } catch (e) { }
    return;
  }
  if (adUiSeen) {
    adUiSeen = false;
    muteAdAudio(false);
    if (!st.track || !st.playing) setAd(false);
  }
}

var mediaEls = [];
function watchMedia(el) {
  if (!el || mediaEls.indexOf(el) !== -1) return;
  mediaEls.push(el);
  adLog('elemento audio trovato');
  el.addEventListener('timeupdate', function () {
    if (!adUiSeen) emit('media_position', el.currentTime);
  });
  el.addEventListener('play', function () { emit('media_playing', true); });
  el.addEventListener('pause', function () { emit('media_playing', false); });
  el.addEventListener('durationchange', function () { emit('media_duration', el.duration); });
}

function muteAdAudio(on) {
  mediaEls.forEach(function (el) {
    try {
      if (on) { el.__stvVol = el.volume; el.volume = 0; }
      else if (el.__stvVol != null) { el.volume = el.__stvVol; el.__stvVol = null; }
    } catch (e) { }
  });
}

export function installMediaHooks() {
  try {
    var origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      try { watchMedia(this); } catch (e) { }
      return origPlay.apply(this, arguments);
    };
  } catch (e) { }
  try {
    var origCreate = Document.prototype.createElement;
    Document.prototype.createElement = function (tag) {
      var el = origCreate.apply(this, arguments);
      try { if (String(tag).toLowerCase() === 'audio') watchMedia(el); } catch (e) { }
      return el;
    };
  } catch (e) { }
  setInterval(function () {
    var el = document.querySelector('audio, video');
    if (el) watchMedia(el);
  }, 2000);
}

export function startAdWatcher() {
  setInterval(checkDomForAd, 700);
}

/* Solo per i test (tools/test-statemachine.mjs): manipola una state machine
 * costruita a mano, senza toccare la rete. */
export function manipulateForTest(sm, index) {
  return manipulateStateMachine(sm, index == null ? 0 : index, false);
}

export function init() {
  adLog('motore no-ads attivo');
  installMediaHooks();
  startAdWatcher();
}
