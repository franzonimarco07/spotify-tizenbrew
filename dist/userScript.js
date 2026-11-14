/* Spotify TV Mod v0.4.1 — motore no-ads + UI TV per il web player di Spotify.
 * Modulo TizenBrew. Le parti di blocco delle pubblicità derivano da
 * T-64/spotify-ad-skip e tomer8007/spotify-web-ads-remover (GPL-3.0). */
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/bus.js
  var listeners = {};
  var last = {};
  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    if (last[type] !== void 0) {
      try {
        fn(last[type]);
      } catch (e) {
      }
    }
    return function() {
      var a = listeners[type] || [];
      var i = a.indexOf(fn);
      if (i !== -1) a.splice(i, 1);
    };
  }
  function emit(type, payload) {
    last[type] = payload;
    var a = listeners[type] || [];
    for (var i = 0; i < a.length; i++) {
      try {
        a[i](payload);
      } catch (e) {
        console.warn("[spotify-tv] listener", type, e);
      }
    }
  }

  // src/state.js
  var st = {
    track: null,
    // { uri, name, artists, album, art, duration }
    playing: false,
    position: 0,
    // secondi
    duration: 0,
    volume: 1,
    ad: false,
    adBlocked: 0,
    ready: false
  };
  function setTrack(t) {
    st.track = t;
    st.duration = t && t.duration ? t.duration : 0;
    if (!t) st.position = 0;
    emit("track", st.track);
  }
  function setPlaying(p) {
    if (st.playing === p) return;
    st.playing = p;
    emit("playing", p);
  }
  function setPosition(pos) {
    if (!isFinite(pos) || pos < 0) return;
    st.position = pos;
    emit("position", pos);
  }
  function setVolume(v) {
    if (!isFinite(v)) return;
    st.volume = Math.max(0, Math.min(1, v));
    emit("volume", st.volume);
  }
  function setAd(on2) {
    if (st.ad === on2) return;
    st.ad = on2;
    emit("ad", on2);
  }
  function trackFromMetadata(md) {
    if (!md) return null;
    var artists = md.artist_name || md.artists || "";
    if (Array.isArray(artists)) artists = artists.join(", ");
    return {
      uri: md.uri || "",
      name: md.name || md.title || "",
      artists,
      album: md.album_title || md.album_name || md.album || "",
      art: pickImage(md.image_url || md.image_large_url || md.cover_art || ""),
      duration: md.duration ? Math.round(md.duration / 1e3) : 0
    };
  }
  function pickImage(u) {
    if (!u) return "";
    if (/^https?:/.test(u)) return u.replace(/^http:/, "https:");
    if (u.indexOf("spotify:image:") === 0) return "https://i.scdn.co/image/" + u.split(":")[2];
    return u;
  }

  // src/player.js
  var player_exports = {};
  __export(player_exports, {
    back: () => back,
    init: () => init2,
    navigate: () => navigate,
    next: () => next,
    pollDomState: () => pollDomState,
    prev: () => prev,
    seek: () => seek,
    seekTo: () => seekTo,
    setVol: () => setVol,
    togglePlay: () => togglePlay,
    volumeDelta: () => volumeDelta
  });

  // src/noads.js
  var noads_exports = {};
  __export(noads_exports, {
    adLog: () => adLog,
    adLogLines: () => adLogLines,
    fetchOriginal: () => fetchOriginal,
    init: () => init,
    installMediaHooks: () => installMediaHooks,
    manipulateForTest: () => manipulateForTest,
    networkContext: () => networkContext,
    setNetworkContext: () => setNetworkContext,
    startAdWatcher: () => startAdWatcher
  });
  var LOG_MAX = 120;
  var logLines = [];
  var bootCtx = null;
  function setNetworkContext(c) {
    bootCtx = c;
  }
  function adLog(msg) {
    var line = (/* @__PURE__ */ new Date()).toTimeString().substr(0, 8) + " " + msg;
    logLines.push(line);
    if (logLines.length > LOG_MAX) logLines.shift();
    if (window.__spotifyTv && window.__spotifyTv.debug) console.log("[noads]", msg);
    emit("noadslog", line);
  }
  function adLogLines() {
    return logLines.slice();
  }
  function Queue(timeoutMs) {
    this.items = [];
    this.busy = false;
    this.timeoutMs = timeoutMs;
  }
  Queue.prototype.push = function(fn, fallback) {
    var self = this;
    return new Promise(function(resolve) {
      self.items.push({ fn, fallback, resolve });
      self.next();
    });
  };
  Queue.prototype.next = function() {
    if (this.busy) return;
    var item = this.items.shift();
    if (!item) return;
    var self = this;
    var done = false;
    var timer = setTimeout(function() {
      if (done) return;
      done = true;
      adLog("coda in timeout, passo avanti");
      try {
        item.resolve(item.fallback ? item.fallback() : null);
      } catch (e) {
        item.resolve(null);
      }
      self.busy = false;
      self.next();
    }, this.timeoutMs);
    this.busy = true;
    Promise.resolve().then(item.fn).then(function(v) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      item.resolve(v);
      self.busy = false;
      self.next();
    }, function(e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      adLog("errore: " + (e && e.message || e));
      try {
        item.resolve(item.fallback ? item.fallback() : null);
      } catch (x) {
        item.resolve(null);
      }
      self.busy = false;
      self.next();
    });
  };
  var queue = new Queue(8e3);
  var ctx = bootCtx || {
    deviceId: "",
    authorization: "",
    clientToken: "",
    accessToken: ""
  };
  function networkContext() {
    return ctx;
  }
  var origFetch = window.fetch;
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  function fetchOriginal(url, init3) {
    return origFetch.call(window, url, init3);
  }
  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  function patchBody(body) {
    var data = parseJson(body);
    if (!data) return body;
    var ref = data.state_ref;
    if (ref && typeof ref.state_id === "string" && ref.state_id.indexOf("future_") !== -1) {
      var parts = ref.state_id.split("+");
      ref.state_machine_id = parts[1];
      ref.state_id = parts[2];
      adLog('richiesta stato "future" normalizzata');
      return JSON.stringify(data);
    }
    return body;
  }
  window.fetch = function(input, init3) {
    try {
      var url = typeof input === "string" ? input : input && input.url || "";
      if (!init3) init3 = {};
      if (init3.headers) {
        var h = init3.headers;
        if (h.get) {
          if (h.get("authorization")) ctx.authorization = h.get("authorization");
          if (h.get("client-token")) ctx.clientToken = h.get("client-token");
        } else {
          if (h.authorization) ctx.authorization = h.authorization;
          if (h["authorization"]) ctx.authorization = h["authorization"];
          if (h["client-token"]) ctx.clientToken = h["client-token"];
        }
      }
      if (url.indexOf("/state") !== -1 && init3.body) {
        init3 = Object.assign({}, init3, { body: patchBody(init3.body) });
        return origFetch.call(window, input, init3).then(function(res) {
          if (!res.ok || res.status === 204) return res;
          return rewriteStateResponse(res);
        });
      }
      if (url.indexOf("/devices") !== -1 && init3.body) {
        var d = parseJson(init3.body);
        if (d && d.device && d.device.device_id) ctx.deviceId = d.device.device_id;
        return origFetch.call(window, input, init3);
      }
      if (url.indexOf("get_access_token") !== -1) {
        return origFetch.call(window, input, init3).then(function(res) {
          try {
            res.clone().json().then(function(j) {
              if (j && j.accessToken) ctx.accessToken = j.accessToken;
            }).catch(function() {
            });
          } catch (e) {
          }
          return res;
        });
      }
      return origFetch.call(window, input, init3);
    } catch (e) {
      adLog("hook fetch: " + e.message);
      return origFetch.call(window, input, init3);
    }
  };
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__stvUrl = String(url || "");
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    try {
      var n = String(name).toLowerCase();
      if (n === "authorization") ctx.authorization = value;
      if (n === "client-token") ctx.clientToken = value;
    } catch (e) {
    }
    return origSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    try {
      var url = xhr.__stvUrl || "";
      if (url.indexOf("/state") !== -1 && body) {
        body = patchBody(body);
        if (xhr.responseType === "" || xhr.responseType === "text") {
          xhr.addEventListener("readystatechange", function() {
            if (xhr.readyState !== 4 || xhr.status !== 200) return;
            try {
              var data = parseJson(xhr.responseText);
              if (!data) return;
              var out = transformPayload(data);
              if (!out) return;
              Object.defineProperty(xhr, "responseText", { value: JSON.stringify(out), configurable: true });
              Object.defineProperty(xhr, "response", { value: JSON.stringify(out), configurable: true });
            } catch (e) {
            }
          });
        }
      } else if (url.indexOf("/devices") !== -1 && body) {
        var d = parseJson(body);
        if (d && d.device && d.device.device_id) ctx.deviceId = d.device.device_id;
      }
    } catch (e) {
    }
    return origSend.call(this, body);
  };
  function rewriteStateResponse(res) {
    var status = res.status;
    var statusText = res.statusText;
    var headers = res.headers;
    return res.clone().text().then(function(text) {
      var data = parseJson(text);
      if (!data) return res;
      return queue.push(function() {
        var out = transformPayload(data);
        return out ? JSON.stringify(out) : text;
      }, function() {
        return text;
      }).then(function(body) {
        var h = new Headers(headers);
        h.delete("content-length");
        h.delete("content-encoding");
        var out = new Response(body, { status, statusText, headers: h });
        Object.defineProperty(out, "url", { value: res.url });
        Object.defineProperty(out, "redirected", { value: res.redirected });
        Object.defineProperty(out, "type", { value: res.type });
        return out;
      });
    }).catch(function(e) {
      adLog("risposta /state non riscritta: " + e.message);
      return res;
    });
  }
  var NativeWS = window.WebSocket;
  function MutableMessageEvent(o) {
    this.type = o.type || "message";
    this.data = o.data || null;
    this.origin = o.origin || "";
    this.lastEventId = o.lastEventId || "";
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
    adLog("websocket aperto: " + String(url).split("?")[0]);
    var onmessageFn = null;
    Object.defineProperty(ws, "onmessage", {
      configurable: true,
      get: function() {
        return onmessageFn;
      },
      set: function(fn) {
        onmessageFn = fn;
      }
    });
    var opened = false;
    ws.addEventListener("open", function() {
      opened = true;
    });
    ws.addEventListener("message", function(event) {
      if (!onmessageFn) return;
      var payload = event.data;
      if (typeof payload !== "string" || payload.indexOf('"payloads"') === -1) {
        onmessageFn.call(ws, event);
        return;
      }
      queue.push(function() {
        return handleWsPayload(payload);
      }, function() {
        return null;
      }).then(function(out) {
        var ev = event;
        if (out) ev = new MutableMessageEvent({ type: "message", data: out, origin: event.origin });
        try {
          onmessageFn.call(ws, ev);
        } catch (e) {
          adLog("onmessage: " + e.message);
        }
      });
    });
    var onerrorFn = null;
    Object.defineProperty(ws, "onerror", {
      configurable: true,
      get: function() {
        return onerrorFn;
      },
      set: function(fn) {
        onerrorFn = fn;
      }
    });
    ws.addEventListener("error", function(event) {
      if (opened) return;
      if (onerrorFn) onerrorFn.call(ws, event);
    });
    return ws;
  }
  HookedWS.prototype = NativeWS.prototype;
  Object.setPrototypeOf(HookedWS, NativeWS);
  Object.defineProperty(HookedWS, "OPEN", { value: 1 });
  Object.defineProperty(HookedWS, "CLOSED", { value: 3 });
  Object.defineProperty(HookedWS, "CONNECTING", { value: 0 });
  Object.defineProperty(HookedWS, "CLOSING", { value: 2 });
  window.WebSocket = HookedWS;
  function handleWsPayload(raw) {
    var data = parseJson(raw);
    if (!data || !data.payloads) return null;
    var changed = false;
    for (var i = 0; i < data.payloads.length; i++) {
      var p = data.payloads[i];
      if (!p) continue;
      if (p.type === "replace_state" && p.state_machine && p.state_ref) {
        p.state_machine = manipulateStateMachine(p.state_machine, p.state_ref.state_index, true);
        changed = true;
        continue;
      }
      if (p.cluster) {
        readCluster(p.cluster);
        var ps = p.cluster.player_state;
        if (ps && ps.track && ps.track.provider === "ads/inject_tracks") {
          adLog("ad iniettato bloccato (advertiser: " + (ps.track.metadata && ps.track.metadata.advertiser) + ")");
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
        emit("cluster_position", { position: (pos + since) / 1e3, paused: !!ps.is_paused });
      }
      if (ps.track && ps.track.metadata) {
        var uri = ps.track.metadata.uri || "";
        var isAd = uri.indexOf(":ad:") !== -1 || ps.track.provider === "ads/inject_tracks" || (ps.track.content_type || "").toUpperCase() === "AD";
        if (isAd) {
          setAd(true);
        } else {
          setAd(false);
          var t = trackFromMetadata(ps.track.metadata);
          if (t && (!st.track || st.track.uri !== t.uri || st.track.name !== t.name)) {
            setTrack(t);
            adLog("brano: " + t.name + " \u2014 " + t.artists);
          }
        }
      }
    } catch (e) {
    }
  }
  function trackOf(sm, state) {
    if (!state || !sm.tracks) return null;
    var id = state.track;
    return sm.tracks[id] || null;
  }
  function isAdState(sm, state) {
    if (!state) return false;
    if (typeof state.state_id === "string" && state.state_id.indexOf("filler") !== -1) return false;
    var t = trackOf(sm, state);
    if (!t) return false;
    var uri = t.metadata && t.metadata.uri || "";
    if (uri.indexOf(":ad:") !== -1) return true;
    if ((t.content_type || "").toUpperCase() === "AD") return true;
    return false;
  }
  function nextIndex(sm, index, key) {
    var state = sm.states && sm.states[index];
    if (!state || !state.transitions) return -1;
    var tr = state.transitions[key || "advance"];
    if (!tr || tr.state_index == null) return -1;
    return tr.state_index;
  }
  function nextAdFreeIndex(sm, startIndex) {
    var i = nextIndex(sm, startIndex, "advance");
    var guard = 0;
    while (i >= 0 && isAdState(sm, sm.states[i]) && guard++ < 8) {
      i = nextIndex(sm, i, "advance");
    }
    return i;
  }
  var totalBlocked = 0;
  function bumpCounter() {
    totalBlocked++;
    st.adBlocked = totalBlocked;
    emit("adblocked", totalBlocked);
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
        var uri = (trackOf(sm, state).metadata || {}).uri || "";
        var target = nextAdFreeIndex(sm, i);
        if (target >= 0) {
          sm.states[i] = sm.states[target];
          removed = true;
          blocked++;
          adLog("ad saltato: " + uri);
        } else {
          shorten(sm, state);
          removed = true;
          blocked++;
          adLog("ad accorciato: " + uri);
        }
      }
      if (!removed) break;
    }
    if (blocked) {
      totalBlocked += blocked;
      st.adBlocked = totalBlocked;
      emit("adblocked", totalBlocked);
      if (replacing) setAd(false);
    }
    if (sm.tracks) {
      for (var j = 0; j < sm.tracks.length; j++) {
        var t = sm.tracks[j];
        if (t && (t.metadata || {}).uri && String(t.metadata.uri).indexOf(":ad:") !== -1) sm.tracks[j] = null;
      }
    }
    return sm;
  }
  function shorten(sm, state) {
    var t = trackOf(sm, state);
    var duration = t && t.metadata && t.metadata.duration || 3e4;
    state.disallow_seeking = false;
    state.restrictions = {};
    state.initial_playback_position = duration;
    state.position_offset = duration;
  }
  function transformPayload(data) {
    try {
      if (data.commands) {
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
      adLog("state machine: " + e.message);
      return null;
    }
  }
  var AD_UI = '[data-testid="ad-companion-card"], [data-testid="ad-slot-container"], [data-testid="ad-billboard"], [data-testid="context-item-info-ad-subtitle"], [aria-label="Advertisement"], [aria-label="Pubblicit\xE0"]';
  var adUiSeen = false;
  function checkDomForAd() {
    var el2 = document.querySelector(AD_UI);
    if (el2) {
      if (!adUiSeen) adLog("ad rilevato dal DOM");
      adUiSeen = true;
      setAd(true);
      muteAdAudio(true);
      try {
        el2.style.display = "none";
      } catch (e) {
      }
      return;
    }
    if (adUiSeen) {
      adUiSeen = false;
      muteAdAudio(false);
      if (!st.track || !st.playing) setAd(false);
    }
  }
  var mediaEls = [];
  function watchMedia(el2) {
    if (!el2 || mediaEls.indexOf(el2) !== -1) return;
    mediaEls.push(el2);
    adLog("elemento audio trovato");
    el2.addEventListener("timeupdate", function() {
      if (!adUiSeen) emit("media_position", el2.currentTime);
    });
    el2.addEventListener("play", function() {
      emit("media_playing", true);
    });
    el2.addEventListener("pause", function() {
      emit("media_playing", false);
    });
    el2.addEventListener("durationchange", function() {
      emit("media_duration", el2.duration);
    });
  }
  function muteAdAudio(on2) {
    mediaEls.forEach(function(el2) {
      try {
        if (on2) {
          el2.__stvVol = el2.volume;
          el2.volume = 0;
        } else if (el2.__stvVol != null) {
          el2.volume = el2.__stvVol;
          el2.__stvVol = null;
        }
      } catch (e) {
      }
    });
  }
  function installMediaHooks() {
    try {
      var origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        try {
          watchMedia(this);
        } catch (e) {
        }
        return origPlay.apply(this, arguments);
      };
    } catch (e) {
    }
    try {
      var origCreate = Document.prototype.createElement;
      Document.prototype.createElement = function(tag) {
        var el2 = origCreate.apply(this, arguments);
        try {
          if (String(tag).toLowerCase() === "audio") watchMedia(el2);
        } catch (e) {
        }
        return el2;
      };
    } catch (e) {
    }
    setInterval(function() {
      var el2 = document.querySelector("audio, video");
      if (el2) watchMedia(el2);
    }, 2e3);
  }
  function startAdWatcher() {
    setInterval(checkDomForAd, 700);
  }
  function manipulateForTest(sm, index) {
    return manipulateStateMachine(sm, index == null ? 0 : index, false);
  }
  function init() {
    adLog("motore no-ads attivo");
    installMediaHooks();
    startAdWatcher();
  }

  // src/player.js
  function q(sel) {
    return document.querySelector(sel);
  }
  function click(sel) {
    var el2 = q(sel);
    if (el2) {
      el2.click();
      return true;
    }
    return false;
  }
  function press(key, code) {
    var ev = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
  }
  function togglePlay() {
    if (click('[data-testid="control-button-playpause"]')) return;
    press(" ", "Space");
    setPlaying(!st.playing);
  }
  function next() {
    if (click('[data-testid="control-button-skip-forward"]')) return;
    press("MediaTrackNext", "MediaTrackNext");
  }
  function prev() {
    if (click('[data-testid="control-button-skip-back"]')) return;
    press("MediaTrackPrevious", "MediaTrackPrevious");
  }
  function seek(deltaSeconds) {
    var target = Math.max(0, Math.min(st.duration || 0, (st.position || 0) + deltaSeconds));
    var bar = q('[data-testid="playback-progressbar"]');
    if (bar) {
      var r = bar.getBoundingClientRect();
      if (r.width > 0 && st.duration > 0) {
        var x = r.left + target / st.duration * r.width;
        var y = r.top + r.height / 2;
        ["mousedown", "mouseup", "click"].forEach(function(type) {
          bar.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        });
        setPosition(target);
        return;
      }
    }
    adLog("barra di avanzamento non trovata");
  }
  function seekTo(ratio) {
    if (!st.duration) return;
    seek(ratio * st.duration - st.position);
  }
  function setVol(v) {
    v = Math.max(0, Math.min(1, v));
    var bar = q('[data-testid="volume-bar"] [role="slider"]') || q('[data-testid="volume-bar"]');
    if (bar) {
      var r = bar.getBoundingClientRect();
      if (r.width > 0) {
        var x = r.left + v * r.width;
        var y = r.top + r.height / 2;
        ["mousedown", "mouseup", "click"].forEach(function(type) {
          bar.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        });
      }
    }
    setVolume(v);
  }
  function volumeDelta(d) {
    setVol((st.volume || 0) + d);
  }
  function navigate(path) {
    location.hash = "#" + path;
  }
  function back() {
    if (history.length > 1) history.back();
  }
  function pollDomState() {
    try {
      var btn = q('[data-testid="control-button-playpause"]');
      if (btn) {
        var label = (btn.getAttribute("aria-label") || btn.title || "").toLowerCase();
        if (label) setPlaying(label.indexOf("pause") !== -1 || label.indexOf("pausa") !== -1);
      }
      var title = q('[data-testid="context-item-info-title"]');
      var artist = q('[data-testid="context-item-info-artist"]');
      var art = q('[data-testid="cover-art-image"] img, [data-testid="now-playing-widget"] img');
      if (title) {
        var name = (title.textContent || "").trim();
        var artists = artist ? (artist.textContent || "").trim() : "";
        if (name && (!st.track || st.track.name !== name || st.track.artists !== artists)) {
          setTrack({
            uri: "",
            name,
            artists,
            album: "",
            art: art ? art.currentSrc || art.src || "" : "",
            duration: st.duration
          });
        }
      }
      var sub = q('[data-testid="context-item-info-ad-subtitle"]');
      setAd(!!sub);
    } catch (e) {
    }
  }
  function init2() {
    on("cluster_position", function(p) {
      setPosition(p.position);
      setPlaying(!p.paused);
    });
    on("media_position", function(pos) {
      setPosition(pos);
    });
    on("media_duration", function(d) {
      if (isFinite(d) && d > 0 && st.duration && Math.abs(d - st.duration) > 3) setPosition(Math.min(st.position, d));
    });
    on("media_playing", function(p) {
      setPlaying(p);
    });
    setInterval(pollDomState, 1500);
    pollDomState();
  }

  // src/registry.js
  var ui = null;
  function registerUi(api) {
    ui = api;
  }
  function call(name, arg) {
    if (ui && typeof ui[name] === "function") {
      try {
        return ui[name](arg);
      } catch (e) {
        console.warn("[spotify-tv] ui." + name, e);
      }
    }
    return null;
  }
  function show() {
    return call("show");
  }
  function hide() {
    return call("hide");
  }
  function toast(msg) {
    return call("toast", msg);
  }
  function focusPlayer() {
    return call("focusPlayer");
  }
  var commands = {
    togglePlay,
    next,
    prev,
    seek,
    volume: volumeDelta,
    back,
    navigate
  };

  // src/ui.js
  var CSS = `
#stv-root { position: fixed; inset: 0; z-index: 2147483000; background: #000; color: #fff;
  font-family: "Samsung Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden;
  -webkit-font-smoothing: antialiased; }
#stv-root * { box-sizing: border-box; }
.stv-shell { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
.stv-top { flex: 0 0 auto; display: flex; align-items: center; gap: 1.4vw; padding: 2vh 3vw 1.2vh;
  background: linear-gradient(180deg, rgba(0,0,0,.96) 0%, rgba(0,0,0,.72) 70%, rgba(0,0,0,0) 100%); z-index: 3; }
.stv-brand { padding: .9vh .9vw; border-radius: 10px; transition: background .18s, color .18s; font-weight: 800; letter-spacing: .06em; font-size: 2.6vmin; white-space: nowrap; color: #1ed760; text-transform: uppercase; }
.stv-menu { display: flex; gap: 1.6vw; }
.stv-menu-item { padding: .9vh 1.1vw; border-radius: 999px; font-size: 2.5vmin; white-space: nowrap; font-weight: 600; color: #b3b3b3;
  transition: color .18s, background .18s, transform .18s; }
.stv-menu-item.stv-focus, .stv-brand.stv-focus { color: #000; background: #fff; transform: scale(1.04); }
.stv-brand.stv-focus { color: #000; }
.stv-menu-item.stv-active:not(.stv-focus) { color: #fff; }

.stv-stage { position: relative; flex: 1 1 auto; overflow: hidden; background: #050505; }
.stv-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
  transition: transform .38s cubic-bezier(.22,.61,.36,1), opacity .38s; opacity: 0; pointer-events: none;
  will-change: transform; }
.stv-frame.stv-visible { opacity: 1; pointer-events: auto; }

.stv-hero { position: absolute; inset: 0; padding: 2vh 4vw 20vh; overflow: hidden; z-index: 2;
  background: radial-gradient(120% 90% at 15% 0%, #1c3a2a 0%, #0a0a0a 55%, #000 100%); }
.stv-hero-title { font-size: 2.2vmin; letter-spacing: .28em; text-transform: uppercase; color: #9fe6b6; margin: 0 0 1.4vh; }
.stv-hero-big { font-size: clamp(4vmin, 8.2vmin, 12vmin); font-weight: 800; line-height: 1.02; margin: 0 0 1.6vh; max-width: 62vw;
  background: linear-gradient(90deg, #fff 0%, #b9f5cd 60%, #1ed760 100%); -webkit-background-clip: text;
  -webkit-text-fill-color: transparent; }
.stv-hero-sub { font-size: 2.5vmin; color: #b3b3b3; max-width: 52vw; line-height: 1.45; margin: 0; }
.stv-tiles { display: flex; gap: 1.6vw; margin-top: 3vh; }
.stv-tile { width: 20vw; border-radius: 16px; padding: 2.2vh 1.3vw; background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08); transition: transform .2s, background .2s; }
.stv-tile.stv-focus { transform: translateY(-6px) scale(1.03); background: rgba(30,215,96,.16); border-color: #1ed760; }
.stv-tile h3 { margin: 0 0 .6vh; font-size: 2.8vmin; white-space: nowrap; }
.stv-tile p { margin: 0; font-size: 2vmin; color: #b3b3b3; line-height: 1.35; }

.stv-skeleton { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 2.4vh;
  padding: 4vh 3.4vw; background: #0a0a0a; z-index: 4; transition: opacity .35s; }
.stv-skeleton.stv-done { opacity: 0; pointer-events: none; }
.stv-sk-line { height: 2.6vh; border-radius: 8px; width: 40%;
  background: linear-gradient(100deg, #1a1a1a 30%, #262626 50%, #1a1a1a 70%); background-size: 300% 100%;
  animation: stv-shimmer 1.6s infinite linear; }
.stv-sk-row { display: flex; gap: 1.4vw; }
.stv-sk-card { width: 15vw; height: 15vw; border-radius: 14px;
  background: linear-gradient(100deg, #161616 30%, #232323 50%, #161616 70%); background-size: 300% 100%;
  animation: stv-shimmer 1.6s infinite linear; }
@keyframes stv-shimmer { from { background-position: 130% 0; } to { background-position: -30% 0; } }

.stv-loadbar { position: absolute; top: 0; left: 0; height: 3px; width: 0%; background: #1ed760;
  box-shadow: 0 0 12px #1ed760; transition: width .4s ease; z-index: 6; }

.stv-bottom { flex: 0 0 auto; height: 16vh; display: flex; align-items: center; gap: 1.6vw; padding: 0 3vw;
  background: linear-gradient(0deg, #000 20%, #0b0b0b 100%); border-top: 1px solid rgba(255,255,255,.07);
  transition: transform .3s, opacity .3s; }
.stv-bottom.stv-hidden { transform: translateY(100%); opacity: 0; }
.stv-art { width: 10vh; height: 10vh; border-radius: 10px; background: #1a1a1a center/cover no-repeat; flex: 0 0 auto;
  box-shadow: 0 6px 20px rgba(0,0,0,.6); transition: transform .25s; }
.stv-art.stv-pulse { animation: stv-pulse 2.6s infinite ease-in-out; }
@keyframes stv-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
.stv-meta { min-width: 0; flex: 1 1 auto; max-width: 46vw; }
.stv-meta h2 { margin: 0; font-size: 3vmin; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-meta p { margin: .5vh 0 0; font-size: 2.3vmin; color: #b3b3b3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-progress { display: flex; align-items: center; gap: .8vw; margin-top: 1.2vh; font-size: 2vmin; color: #b3b3b3; }
.stv-bar { flex: 1 1 auto; min-width: 8vw; height: 5px; border-radius: 999px; background: rgba(255,255,255,.18); overflow: hidden; }
.stv-bar > i { display: block; height: 100%; width: 0%; background: #1ed760; border-radius: 999px; transition: width .4s linear; }
.stv-controls { display: flex; align-items: center; gap: .7vw; flex: 0 0 auto; margin-left: auto; }
.stv-btn { width: 7vmin; height: 7vmin; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; font-size: 3vmin; font-weight: 700;
  background: rgba(255,255,255,.07); transition: background .18s, transform .18s; }
.stv-btn svg { width: 3.4vmin; height: 3.4vmin; fill: #fff; }
.stv-btn.stv-play { width: 9.6vmin; height: 9.6vmin; background: #fff; }
.stv-btn.stv-play svg { fill: #000; width: 4.2vmin; height: 4.2vmin; }
.stv-btn.stv-focus { background: #1ed760; transform: scale(1.09); color: #000; }
.stv-btn.stv-vol { background: rgba(255,255,255,.04); color: #ddd; }
.stv-btn.stv-focus svg { fill: #000; }
.stv-badge { position: absolute; right: 3vw; top: 3vh; font-size: 2vmin; padding: .6vh 1vw; border-radius: 999px;
  background: rgba(30,215,96,.16); color: #1ed760; border: 1px solid rgba(30,215,96,.4); z-index: 5; }
.stv-toast { position: absolute; left: 50%; bottom: 19vh; transform: translateX(-50%) translateY(10px);
  background: rgba(20,20,20,.96); border: 1px solid rgba(255,255,255,.14); color: #fff; padding: 1.2vh 2vw;
  border-radius: 999px; font-size: 2.2vmin; opacity: 0; transition: opacity .25s, transform .25s; z-index: 20; }
.stv-toast.stv-show { opacity: 1; transform: translateX(-50%) translateY(0); }
.stv-focus-ring { position: absolute; pointer-events: none; border: 3px solid #1ed760; border-radius: 12px;
  box-shadow: 0 0 0 2px rgba(0,0,0,.55), 0 0 26px rgba(30,215,96,.55); transition: all .18s cubic-bezier(.22,.61,.36,1);
  z-index: 15; display: none; }
`;
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  var PREV = '<svg viewBox="0 0 24 24"><path d="M7 6h2v12H7zM20 6v12l-9-6z"/></svg>';
  var NEXT = '<svg viewBox="0 0 24 24"><path d="M15 6h2v12h-2zM4 6l9 6-9 6z"/></svg>';
  var RW = '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
  var FF = '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>';
  var VIEWS = [
    { id: "home", label: "Home", path: "/", hero: true },
    { id: "search", label: "Cerca", path: "/search" },
    { id: "library", label: "La tua raccolta", path: "/collection" }
  ];
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function SpotifyUI() {
    this.zones = [];
    this.zoneIndex = 0;
    this.itemIndex = 0;
    this.views = {};
    this.current = "home";
    this.frameMounted = false;
    this.frameReady = {};
    this.ring = null;
    this.booted = false;
  }
  SpotifyUI.prototype.mount = function() {
    var self0 = this;
    function step(name, fn) {
      try {
        fn();
      } catch (e) {
        self0.mountErrors = self0.mountErrors || [];
        self0.mountErrors.push(name + ": " + e.message);
        if (window.console) console.warn("[spotify-tv] mount " + name, e);
      }
    }
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    var root = el("div");
    root.id = "stv-root";
    root.innerHTML = '<div class="stv-shell">  <div class="stv-top"><div class="stv-brand">Spotify</div><div class="stv-menu"></div></div>  <div class="stv-stage">    <div class="stv-loadbar"></div>  </div>  <div class="stv-bottom">    <div class="stv-art"></div>    <div class="stv-meta"><h2>\u2014</h2><p>Premi OK su un brano</p>      <div class="stv-progress"><span class="stv-time">0:00</span><div class="stv-bar"><i></i></div><span class="stv-dur">0:00</span></div>    </div>    <div class="stv-controls">      <div class="stv-btn stv-vol" data-cmd="vol-down">\u2013</div>      <div class="stv-btn stv-vol" data-cmd="vol-up">+</div>      <div class="stv-btn" data-cmd="rw">' + RW + '</div>      <div class="stv-btn" data-cmd="prev">' + PREV + '</div>      <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>      <div class="stv-btn" data-cmd="next">' + NEXT + '</div>      <div class="stv-btn" data-cmd="ff">' + FF + '</div>    </div>  </div></div><div class="stv-toast"></div><div class="stv-focus-ring"></div>';
    document.documentElement.appendChild(root);
    this.root = root;
    this.stage = root.querySelector(".stv-stage");
    this.menu = root.querySelector(".stv-menu");
    this.ring = root.querySelector(".stv-focus-ring");
    this.loadbar = root.querySelector(".stv-loadbar");
    this.toastEl = root.querySelector(".stv-toast");
    this.bottom = root.querySelector(".stv-bottom");
    this.art = root.querySelector(".stv-art");
    this.title = root.querySelector(".stv-meta h2");
    this.sub = root.querySelector(".stv-meta p");
    this.timeEl = root.querySelector(".stv-time");
    this.durEl = root.querySelector(".stv-dur");
    this.fill = root.querySelector(".stv-bar > i");
    this.playBtn = root.querySelector('[data-cmd="play"]');
    this.badge = el("div", "stv-badge");
    this.badge.style.display = "none";
    root.appendChild(this.badge);
    var self = this;
    if (this.playBtn) this.playBtn.addEventListener("click", function() {
      commands.togglePlay();
    });
    var cmdEls = root.querySelectorAll("[data-cmd]") || [];
    Array.prototype.forEach.call(cmdEls, function(b) {
      b.addEventListener("click", function() {
        var c = b.getAttribute("data-cmd");
        if (c === "next") commands.next();
        if (c === "prev") commands.prev();
        if (c === "rw") commands.seek(-10);
        if (c === "ff") commands.seek(10);
        if (c === "vol-up") commands.volume(0.1);
        if (c === "vol-down") commands.volume(-0.1);
      });
    });
    step("menu", function() {
      self.buildMenu();
    });
    step("hero", function() {
      self.buildHero();
    });
    step("player", function() {
      self.buildPlayerZone();
    });
    step("stato", function() {
      self.bindState();
    });
    step("focus", function() {
      self.focus(0, 0);
    });
    step("mostra", function() {
      self.show();
    });
    this.mounted = true;
    setTimeout(function() {
      self.markLoaded();
    }, 400);
  };
  SpotifyUI.prototype.buildMenu = function() {
    var self = this;
    var brand = this.root.querySelector(".stv-brand");
    if (brand) {
      brand.setAttribute("data-view", "home");
      brand.addEventListener("click", function() {
        self.openView("home");
      });
    }
    this.brand = brand;
    this.menuItems = VIEWS.map(function(v) {
      var it = el("div", "stv-menu-item", v.label);
      it.setAttribute("data-view", v.id);
      it.addEventListener("click", function() {
        self.openView(v.id);
      });
      self.menu.appendChild(it);
      return it;
    });
  };
  SpotifyUI.prototype.buildHero = function() {
    var self = this;
    var hero = el("div", "stv-hero");
    hero.innerHTML = '<p class="stv-hero-title">Spotify sulla TV</p><h1 class="stv-hero-big">La tua musica,<br>senza pubblicit\xE0.</h1><p class="stv-hero-sub">Usa le frecce per muoverti, OK per scegliere. I tasti play/pausa e traccia del telecomando funzionano sempre.</p><div class="stv-tiles">  <div class="stv-tile" data-view="home"><h3>Home</h3><p>I tuoi ascolti e i consigli di Spotify</p></div>  <div class="stv-tile" data-view="search"><h3>Cerca</h3><p>Brani, artisti, album, playlist</p></div>  <div class="stv-tile" data-view="library"><h3>La tua raccolta</h3><p>Playlist e brani salvati</p></div></div>';
    var heroTiles = hero.querySelectorAll("[data-view]") || [];
    Array.prototype.forEach.call(heroTiles, function(t) {
      t.addEventListener("click", function() {
        self.openView(t.getAttribute("data-view"));
      });
    });
    this.hero = hero;
    this.stage.appendChild(hero);
  };
  SpotifyUI.prototype.buildPlayerZone = function() {
    this.playerEls = Array.prototype.slice.call(this.bottom ? this.bottom.querySelectorAll(".stv-btn") : []);
    (this.playerEls || []).forEach(function(b, i) {
      b.setAttribute("tabindex", "0");
      b.__zone = "player";
    });
  };
  SpotifyUI.prototype.bindState = function() {
    var self = this;
    on("track", function(t) {
      self.title.textContent = t && t.name ? t.name : "\u2014";
      self.sub.textContent = t && t.artists ? t.artists : "Premi OK su un brano";
      if (t && t.art) {
        self.art.style.backgroundImage = 'url("' + t.art + '")';
        self.art.classList.add("stv-pulse");
      } else {
        self.art.style.backgroundImage = "";
        self.art.classList.remove("stv-pulse");
      }
      if (t && t.duration) self.durEl.textContent = fmt(t.duration);
    });
    on("playing", function(p) {
      self.playBtn.innerHTML = p ? PAUSE : PLAY;
      self.art.classList.toggle("stv-pulse", !!p);
    });
    on("position", function(pos) {
      self.timeEl.textContent = fmt(pos);
      var d = st.duration || 0;
      self.fill.style.width = d > 0 ? Math.min(100, pos / d * 100) + "%" : "0%";
    });
    on("ad", function(isAd) {
      self.badge.style.display = isAd ? "block" : "none";
      self.badge.textContent = "Pubblicit\xE0 in corso\u2026";
    });
    on("adblocked", function(n) {
      self.badge.style.display = "block";
      self.badge.textContent = "Pubblicit\xE0 bloccate: " + n;
      setTimeout(function() {
        if (!st.ad) self.badge.style.display = "none";
      }, 2600);
    });
    on("progress", function(p) {
      self.loadbar.style.width = Math.round(p * 100) + "%";
      if (p >= 1) setTimeout(function() {
        self.loadbar.style.opacity = "0";
      }, 600);
    });
  };
  SpotifyUI.prototype.frameFor = function(view) {
    var self = this;
    if (this.views[view.id]) return this.views[view.id];
    var frame = el("iframe", "stv-frame");
    frame.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
    frame.__view = view.id;
    this.stage.appendChild(frame);
    this.views[view.id] = frame;
    frame.addEventListener("load", function() {
      self.frameReady[view.id] = true;
      if (self.pendingView === view.id) self.markLoaded();
      try {
        var doc = frame.contentDocument;
        if (doc && doc.documentElement) doc.documentElement.classList.add("stv-embedded");
      } catch (e) {
      }
    });
    frame.src = this.current === "home" && !this.frameMounted ? location.href : location.origin + view.path;
    this.frameMounted = true;
    return frame;
  };
  SpotifyUI.prototype.showSkeleton = function() {
    var self = this;
    if (!this.skeleton) {
      this.skeleton = el("div", "stv-skeleton");
      this.skeleton.innerHTML = '<div class="stv-sk-line" style="width:26%"></div><div class="stv-sk-line" style="width:52%;height:5vh"></div><div class="stv-sk-row"><div class="stv-sk-card"></div><div class="stv-sk-card"></div><div class="stv-sk-card"></div><div class="stv-sk-card"></div></div><div class="stv-sk-row"><div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div><div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div><div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div></div>';
      this.stage.appendChild(this.skeleton);
    }
    this.skeleton.classList.remove("stv-done");
    this.skeleton.style.display = "flex";
    var p = 0;
    var self2 = this;
    clearInterval(this._skTimer);
    this._skTimer = setInterval(function() {
      p = Math.min(0.9, p + 0.07);
      emit("progress", p);
      if (self2.skeleton.classList.contains("stv-done")) clearInterval(self2._skTimer);
    }, 260);
  };
  SpotifyUI.prototype.markLoaded = function() {
    if (this.skeleton) this.skeleton.classList.add("stv-done");
    emit("progress", 1);
  };
  SpotifyUI.prototype.openView = function(id) {
    var view = null;
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) view = VIEWS[i];
    if (!view) return;
    var firstFrame = !this.frameMounted;
    if (this.current === id && !firstFrame) return;
    this.current = id;
    this.pendingView = id;
    var frame = this.frameFor(view);
    if (this.frameReady[id]) this.markLoaded();
    else this.showSkeleton();
    Object.keys(this.views).forEach(function(k) {
      this.views[k].classList.toggle("stv-visible", k === id);
    }, this);
    this.hero.style.display = id === "home" && !this.frameMounted ? "block" : "none";
    (this.menuItems || []).forEach(function(it) {
      it.classList.toggle("stv-active", it.getAttribute("data-view") === id);
    });
    this.focus(1, 0);
    this.toast(view.label);
  };
  SpotifyUI.prototype.zonesOf = function() {
    var z = [];
    z.push((this.brand ? [{ el: this.brand }] : []).concat((this.menuItems || []).map(function(m) {
      return { el: m };
    })));
    if (!this.frameMounted && this.current === "home" && this.hero.style.display !== "none") {
      z.push(Array.prototype.slice.call(this.hero.querySelectorAll(".stv-tile")).map(function(t) {
        return { el: t };
      }));
    } else if (this.current) {
      var frame = this.views[this.current];
      var items = [];
      if (frame && this.frameReady[this.current]) {
        try {
          items = this.itemsInFrame(frame);
        } catch (e) {
          items = [];
        }
      }
      z.push(items.length ? items : [{ el: frame }]);
    }
    z.push(this.playerEls.map(function(b) {
      return { el: b };
    }));
    return z;
  };
  SpotifyUI.prototype.playerZone = function() {
    return this.zonesOf().length - 1;
  };
  SpotifyUI.prototype.itemsInFrame = function(frame) {
    var doc = frame.contentDocument;
    if (!doc) return [];
    var els = doc.querySelectorAll('[data-testid="card-click-handler"], [data-testid="tracklist-row"], a[href^="/album"], a[href^="/playlist"], a[href^="/artist"], [role="row"], [role="button"]');
    var out = [];
    var seen = {};
    for (var i = 0; i < els.length && out.length < 120; i++) {
      var e = els[i];
      if (seen[e]) continue;
      seen[e] = 1;
      out.push({ el: e, frame, doc });
    }
    return out;
  };
  SpotifyUI.prototype.focus = function(zone, index) {
    var zones = this.zonesOf();
    if (!zones.length) return;
    zone = Math.max(0, Math.min(zones.length - 1, zone));
    var list = zones[zone] || [];
    if (!list.length) {
      this.hideRing();
      return;
    }
    index = Math.max(0, Math.min(list.length - 1, index));
    this.zoneIndex = zone;
    this.itemIndex = index;
    if (this.focusedEl) this.focusedEl.classList.remove("stv-focus");
    var item = list[index];
    var e = item.el;
    this.focusedEl = e;
    if (e.classList) e.classList.add("stv-focus");
    if (item.frame) {
      try {
        e.scrollIntoView({ block: "center", behavior: "smooth" });
        var r = e.getBoundingClientRect();
        this.drawRing(r.left, r.top, r.width, r.height);
      } catch (err) {
        this.hideRing();
      }
    } else {
      var r2 = e.getBoundingClientRect();
      this.drawRing(r2.left, r2.top, r2.width, r2.height);
    }
  };
  SpotifyUI.prototype.drawRing = function(x, y, w, h) {
    if (!this.ring) return;
    this.ring.style.display = "block";
    this.ring.style.left = x - 6 + "px";
    this.ring.style.top = y - 6 + "px";
    this.ring.style.width = w + 12 + "px";
    this.ring.style.height = h + 12 + "px";
  };
  SpotifyUI.prototype.hideRing = function() {
    if (this.ring) this.ring.style.display = "none";
  };
  SpotifyUI.prototype.move = function(dir) {
    var zones = this.zonesOf();
    if (dir === "up") {
      if (this.zoneIndex > 0) this.focus(this.zoneIndex - 1, 0);
      else this.toast("Sei in cima");
      return;
    }
    if (dir === "down") {
      if (this.zoneIndex < zones.length - 1) this.focus(this.zoneIndex + 1, 0);
      else this.toast("Sei in fondo");
      return;
    }
    var delta = dir === "left" ? -1 : 1;
    var list = zones[this.zoneIndex] || [];
    var next2 = this.itemIndex + delta;
    if (next2 < 0 || next2 >= list.length) {
      this.scrollStage(delta);
      return;
    }
    this.focus(this.zoneIndex, next2);
  };
  SpotifyUI.prototype.scrollStage = function(dir) {
    var frame = this.current && this.views[this.current];
    if (!frame) return;
    try {
      frame.contentWindow.scrollBy({ top: dir * 420, behavior: "smooth" });
    } catch (e) {
    }
  };
  SpotifyUI.prototype.activate = function() {
    var zones = this.zonesOf();
    var item = (zones[this.zoneIndex] || [])[this.itemIndex];
    if (!item) return;
    if (item.frame) {
      try {
        var e = item.el;
        var r = e.getBoundingClientRect();
        var opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        e.dispatchEvent(new item.doc.defaultView.MouseEvent("mousedown", opts));
        e.dispatchEvent(new item.doc.defaultView.MouseEvent("mouseup", opts));
        e.dispatchEvent(new item.doc.defaultView.MouseEvent("click", opts));
      } catch (err) {
      }
      return;
    }
    var view = item.el.getAttribute && item.el.getAttribute("data-view");
    if (view) {
      this.openView(view);
      return;
    }
    if (item.el.getAttribute && item.el.getAttribute("data-cmd")) {
      item.el.click();
      return;
    }
    item.el.click();
  };
  SpotifyUI.prototype.show = function() {
    if (this.root) this.root.style.display = "block";
    this.visible = true;
  };
  SpotifyUI.prototype.hide = function() {
    if (this.root) this.root.style.display = "none";
    this.visible = false;
  };
  SpotifyUI.prototype.toggle = function() {
    this.visible ? this.hide() : this.show();
  };
  SpotifyUI.prototype.toast = function(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("stv-show");
    clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function() {
      self.toastEl.classList.remove("stv-show");
    }, 1800);
  };
  SpotifyUI.prototype.focusPlayer = function() {
    this.focus(this.playerZone(), 2);
  };
  SpotifyUI.prototype.goHome = function() {
    this.current = "home";
    this.hero.style.display = "block";
    Object.keys(this.views).forEach(function(k) {
      this.views[k].classList.remove("stv-visible");
    }, this);
    (this.menuItems || []).forEach(function(it) {
      it.classList.toggle("stv-active", it.getAttribute("data-view") === "home");
    });
    this.focus(0, 0);
  };
  SpotifyUI.prototype.back = function() {
    if (this.current && this.current !== "home") {
      this.goHome();
      return;
    }
    if (this.zoneIndex !== 0) {
      this.focus(0, 0);
      return;
    }
    this.hide();
  };
  function startUi() {
    if (window.__spotifyTvUi) return;
    var ui2 = new SpotifyUI();
    window.__spotifyTvUi = ui2;
    registerUi(ui2);
    function mount() {
      if (!document.body) return setTimeout(mount, 50);
      if (window.self !== window.top) return;
      ui2.mount();
      document.addEventListener("keydown", function(e) {
        if (!ui2.visible) return;
        var k = e.keyCode;
        if ([37, 38, 39, 40, 13, 10009].indexOf(k) === -1) return;
        e.preventDefault();
        e.stopPropagation();
      }, true);
    }
    mount();
  }

  // src/main.js
  (function boot() {
    if (window.__spotifyTv) return;
    var diag = [];
    function d(msg) {
      diag.push((/* @__PURE__ */ new Date()).toTimeString().substr(0, 8) + " " + msg);
      if (diag.length > 60) diag.shift();
    }
    d("boot v0.4.1 \u2014 " + location.href.substr(0, 60));
    window.addEventListener("error", function(e) {
      d("ERRORE: " + (e.message || "") + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno);
    });
    var top = window.self === window.top;
    var cfg = window.__spotifyTvConfig || {};
    window.__spotifyTv = {
      version: "0.4.1",
      debug: true,
      log: diag,
      diag: function() {
        return diag.join("\n");
      },
      showUi: function() {
        if (ui) show();
      },
      hideUi: function() {
        if (ui) hide();
      },
      focusPlayer: function() {
        focusPlayer();
      },
      noads: noads_exports,
      commands: player_exports
    };
    var CHROME = "120.0.0.0";
    var UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + CHROME + " Safari/537.36";
    function defineGetter(obj, prop, value) {
      try {
        Object.defineProperty(obj, prop, { get: function() {
          return value;
        }, configurable: true });
      } catch (e) {
      }
    }
    if (cfg.desktopUserAgent !== false) {
      var nav = Navigator.prototype;
      defineGetter(nav, "userAgent", UA);
      defineGetter(nav, "appVersion", UA.replace("Mozilla/", ""));
      defineGetter(nav, "platform", "Linux x86_64");
      defineGetter(nav, "vendor", "Google Inc.");
      defineGetter(nav, "maxTouchPoints", 0);
      var brands = [
        { brand: "Not?A_Brand", version: "8" },
        { brand: "Chromium", version: "120" },
        { brand: "Google Chrome", version: "120" }
      ];
      defineGetter(nav, "userAgentData", {
        brands,
        mobile: false,
        platform: "Linux",
        getHighEntropyValues: function() {
          return Promise.resolve({
            brands,
            mobile: false,
            platform: "Linux",
            platformVersion: "6.1.0",
            architecture: "x86",
            bitness: "64",
            model: "",
            uaFullVersion: CHROME,
            fullVersionList: brands.map(function(b) {
              return { brand: b.brand, version: b.version + ".0.0.0" };
            })
          });
        },
        toJSON: function() {
          return { brands, mobile: false, platform: "Linux" };
        }
      });
    }
    if (cfg.noAds !== false) {
      try {
        setNetworkContext(cfg.network);
      } catch (e) {
      }
      try {
        init();
        d("motore no-ads avviato");
      } catch (e) {
        d("no-ads KO: " + e.message);
      }
    }
    if (top) {
      try {
        init2();
        d("player collegato");
      } catch (e) {
        d("player KO: " + e.message);
      }
      if (cfg.tvUi !== false) {
        try {
          startUi();
          var u = window.__spotifyTvUi;
          if (!u) d("UI non montata (body assente?)");
          else if (u.mountErrors && u.mountErrors.length) d("UI montata con errori: " + u.mountErrors.join(" | "));
          else d("UI montata" + (u.mounted ? " e visibile" : " (in attesa del body)"));
        } catch (e) {
          d("UI KO: " + e.message + " @ " + (e.stack || "").split("\n")[1]);
        }
      }
    } else {
      d("sono in un iframe: niente UI");
    }
    var KEY = {
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      ENTER: 13,
      BACK: 10009,
      PLAYPAUSE: 10252,
      PLAY: 415,
      PAUSE: 19,
      STOP: 413,
      FF: 417,
      RW: 412,
      NEXT: 10233,
      PREV: 10232,
      RED: 403,
      GREEN: 404,
      YELLOW: 405,
      BLUE: 406,
      CHUP: 427,
      CHDOWN: 428
    };
    var mediaKeys = [
      "MediaPlayPause",
      "MediaPlay",
      "MediaPause",
      "MediaStop",
      "MediaFastForward",
      "MediaRewind",
      "MediaTrackNext",
      "MediaTrackPrevious",
      "ColorF0Red",
      "ColorF1Green",
      "ColorF2Yellow",
      "ColorF3Blue"
    ];
    try {
      if (window.tizen && tizen.tvinputdevice) {
        mediaKeys.forEach(function(k) {
          try {
            tizen.tvinputdevice.registerKey(k);
          } catch (e) {
          }
        });
      }
    } catch (e) {
    }
    function uiVisible() {
      return ui && window.__spotifyTvUi && window.__spotifyTvUi.visible;
    }
    window.addEventListener("keydown", function(e) {
      var k = e.keyCode;
      var handled = true;
      if (top && uiVisible()) {
        switch (k) {
          case KEY.LEFT:
            window.__spotifyTvUi.move("left");
            break;
          case KEY.RIGHT:
            window.__spotifyTvUi.move("right");
            break;
          case KEY.UP:
            window.__spotifyTvUi.move("up");
            break;
          case KEY.DOWN:
            window.__spotifyTvUi.move("down");
            break;
          case KEY.ENTER:
            window.__spotifyTvUi.activate();
            break;
          case KEY.BACK:
            window.__spotifyTvUi.back();
            break;
          case KEY.PLAYPAUSE:
          case KEY.PLAY:
          case KEY.PAUSE:
            togglePlay();
            break;
          case KEY.NEXT:
          case KEY.FF:
            next();
            break;
          case KEY.PREV:
          case KEY.RW:
            prev();
            break;
          case KEY.BLUE:
            show();
            focusPlayer();
            break;
          case KEY.GREEN:
            toast(st.adBlocked ? "Pubblicit\xE0 bloccate: " + st.adBlocked : "Nessuna pubblicit\xE0 bloccata");
            break;
          case KEY.YELLOW:
            showDiag();
            break;
          case KEY.RED:
            location.reload();
            break;
          default:
            handled = false;
        }
      } else {
        switch (k) {
          case KEY.PLAYPAUSE:
          case KEY.PLAY:
          case KEY.PAUSE:
          case KEY.STOP:
            togglePlay();
            break;
          case KEY.NEXT:
          case KEY.FF:
            next();
            break;
          case KEY.PREV:
          case KEY.RW:
            prev();
            break;
          case KEY.BLUE:
            show();
            break;
          case KEY.YELLOW:
            showDiag();
            break;
          default:
            handled = false;
        }
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    var diagBox = null;
    function showDiag() {
      if (!document.body) return;
      if (!diagBox) {
        diagBox = document.createElement("div");
        diagBox.id = "stv-diag";
        diagBox.style.cssText = "position:fixed;left:2vw;right:2vw;bottom:2vh;max-height:70vh;overflow:hidden;pointer-events:none;z-index:2147483647;background:rgba(0,0,0,.94);color:#9ef;border:1px solid #1ed760;border-radius:10px;padding:14px 16px;font:13px/1.35 monospace;white-space:pre-wrap;";
        document.body.appendChild(diagBox);
      }
      if (diagBox.style.display === "block") {
        diagBox.style.display = "none";
        return;
      }
      var lines = diag.slice(-16);
      try {
        lines = lines.concat(adLogLines().slice(-10));
      } catch (e) {
      }
      diagBox.textContent = "Spotify TV Mod " + window.__spotifyTv.version + "   (GIALLO chiude)\npagina: " + location.href.substr(0, 80) + "\n--- eventi ---\n" + lines.join("\n");
      diagBox.style.display = "block";
    }
    window.__spotifyTv.showDiag = showDiag;
    window.addEventListener("beforeunload", function() {
      window.__spotifyTvUi = null;
    });
  })();
})();
