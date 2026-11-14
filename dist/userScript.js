/* Spotify TV Mod v0.6.0 — UI TV per il web player di Spotify. Modulo TizenBrew. */
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

  // src/player.js
  var player_exports = {};
  __export(player_exports, {
    activate: () => activate,
    back: () => back,
    init: () => init,
    login: () => login,
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
  function q(sel) {
    return document.querySelector(sel);
  }
  var media = null;
  function trackMedia(m) {
    media = m;
    if (m.__stv) return;
    m.__stv = true;
    ["playing", "pause", "ended", "emptied"].forEach(function(type) {
      m.addEventListener(type, function() {
        if (m === media) setPlaying(!m.paused && !m.ended);
      });
    });
  }
  try {
    origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      trackMedia(this);
      return origPlay.apply(this, arguments);
    };
  } catch (e) {
  }
  var origPlay;
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
    if (window.console) console.warn("[spotify-tv] barra di avanzamento non trovata");
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
    if (location.pathname === path) return;
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }
  function mouseClick(e) {
    var r = e.getBoundingClientRect();
    var opts = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function(type) {
      var Ev = /^pointer/.test(type) && window.PointerEvent ? PointerEvent : MouseEvent;
      e.dispatchEvent(new Ev(type, opts));
    });
  }
  function activate(e) {
    if (e.tagName === "INPUT" || e.tagName === "TEXTAREA") {
      e.focus();
      return;
    }
    if (e.getAttribute("role") === "row" || e.getAttribute("data-testid") === "tracklist-row") {
      var playBtn = e.querySelector('button[aria-label^="Riproduci"], button[aria-label^="Play"]');
      if (playBtn) {
        playBtn.click();
        return;
      }
      var r = e.getBoundingClientRect();
      e.dispatchEvent(new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2
      }));
      return;
    }
    if (e.tagName === "A" || e.tagName === "BUTTON") {
      e.click();
      return;
    }
    mouseClick(e);
  }
  function login() {
    var b = q('[data-testid="login-button"]');
    if (b) b.click();
    else location.href = "https://accounts.spotify.com/login?continue=" + encodeURIComponent("https://open.spotify.com/");
  }
  function parseTime(txt) {
    if (!txt) return NaN;
    var parts = txt.trim().split(":").map(Number);
    var s = 0;
    for (var i = 0; i < parts.length; i++) s = s * 60 + parts[i];
    return s;
  }
  function back() {
    if (history.length > 1) history.back();
  }
  function pollDomState() {
    try {
      if (media) setPlaying(!media.paused && !media.ended);
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
      var dur = parseTime((q('[data-testid="playback-duration"]') || {}).textContent);
      if (isFinite(dur) && dur > 0) st.duration = dur;
      var pos = parseTime((q('[data-testid="playback-position"]') || {}).textContent);
      if (isFinite(pos)) setPosition(pos);
      var sub = q('[data-testid="context-item-info-ad-subtitle"]');
      setAd(!!sub);
    } catch (e) {
    }
  }
  function init() {
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
    setInterval(pollDomState, 1e3);
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
  var C = {
    graphite: "#141821",
    panel: "#1C2230",
    raised: "#252C3D",
    ivory: "#F2EEE3",
    steel: "#9AA2B4",
    amber: "#FFB547"
  };
  var FONT = '"Sora", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var TOP_H = 12;
  var BOTTOM_H = 16;
  var CSS = `
/* ---------- Spotify: solo l'area dei contenuti, ricolorata ---------- */
html, body { background: ${C.graphite} !important; }
#main { visibility: hidden !important; }
#main-view { visibility: visible !important; position: fixed !important; top: ${TOP_H}vh !important; bottom: ${BOTTOM_H}vh !important;
  left: 0 !important; right: 0 !important; width: auto !important; height: auto !important; z-index: 1; }
#global-nav-bar { position: relative; z-index: 2147483001 !important; }
#global-nav-bar form[role="search"] { visibility: visible !important; position: fixed !important; top: 3.2vh; right: 3vw;
  width: 28vw !important; max-width: none !important; z-index: 2147483001; }
#global-nav-bar form[role="search"] input { font-size: 2.2vmin !important; }
#onetrust-consent-sdk { display: none !important; }

.encore-dark-theme, .encore-dark-theme .encore-base-set {
  --background-base: ${C.graphite} !important; --background-highlight: ${C.raised} !important;
  --background-press: #0F121A !important; --background-elevated-base: ${C.panel} !important;
  --background-elevated-highlight: ${C.raised} !important; --background-tinted-base: rgba(242,238,227,.07) !important;
  --background-tinted-highlight: rgba(242,238,227,.12) !important;
  --text-base: ${C.ivory} !important; --text-subdued: ${C.steel} !important;
  --essential-bright-accent: ${C.amber} !important; --text-bright-accent: ${C.amber} !important;
  --encore-title-font-stack: ${FONT} !important; --encore-body-font-stack: ${FONT} !important;
}
.encore-dark-theme .encore-bright-accent-set {
  --background-base: ${C.amber} !important; --background-highlight: #FFC676 !important;
  --background-press: #E59A2E !important; --text-base: ${C.graphite} !important;
}
#main-view *, #main-view *::before, #main-view *::after { animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important; }
#main-view * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
#main-view h1 { font-size: 5.4vmin !important; letter-spacing: -0.01em !important; }
#main-view h2 { font-size: 3.4vmin !important; }

/* ---------- interfaccia nostra ---------- */
#stv-root { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; color: ${C.ivory}; font-family: ${FONT};
  -webkit-font-smoothing: antialiased; }
#stv-root * { box-sizing: border-box; }
.stv-top, .stv-bottom { position: absolute; left: 0; right: 0; pointer-events: auto; }

/* barra in alto: menu con la lancetta */
/* trasparente: dietro c'\xE8 solo il fondo grafite e, a destra, il campo di ricerca di Spotify */
.stv-top { top: 0; height: ${TOP_H}vh; display: flex; align-items: center; padding: 0 3vw; background: transparent;
  border-bottom: 1px solid rgba(242,238,227,.06); }
.stv-knob { width: 4.4vmin; height: 4.4vmin; border-radius: 50%; border: 2px solid ${C.steel}; position: relative; margin-right: 2.6vw; flex: 0 0 auto; }
.stv-knob::after { content: ''; position: absolute; left: 50%; top: 14%; width: 2px; height: 34%; margin-left: -1px; background: ${C.amber}; border-radius: 1px; }
.stv-menu { position: relative; display: flex; gap: 3.2vw; height: 100%; align-items: center; }
.stv-menu-item { font-size: 2.6vmin; font-weight: 400; color: ${C.steel}; white-space: nowrap; padding: 1vh 0; transition: color .15s; }
.stv-menu-item.stv-active { color: ${C.ivory}; font-weight: 600; }
.stv-menu-item.stv-focus { color: ${C.amber}; }
.stv-needle { position: absolute; left: 0; bottom: 2.2vh; height: 3px; width: 40px; background: ${C.steel}; border-radius: 2px;
  transform-origin: left center; transition: transform .32s cubic-bezier(.3,.7,.2,1), background .2s; }
.stv-needle.stv-lit { background: ${C.amber}; }

/* player in basso */
.stv-bottom { bottom: 0; height: ${BOTTOM_H}vh; display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: 1fr auto;
  column-gap: 2vw; padding: 2vh 3vw 2.2vh; background: ${C.panel}; border-top: 1px solid rgba(242,238,227,.06); }
.stv-art { grid-row: 1 / span 2; align-self: center; width: 11vh; height: 11vh; border-radius: 6px; background: ${C.raised} center/cover no-repeat; }
.stv-meta { min-width: 0; align-self: center; }
.stv-meta h2 { margin: 0; font-size: 3.1vmin; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-meta p { margin: .6vh 0 0; font-size: 2.3vmin; color: ${C.steel}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-tag { display: inline-block; margin-left: 1vw; padding: .2vh .7vw; border: 1.5px solid ${C.amber}; border-radius: 4px;
  font-size: 1.7vmin; font-weight: 600; color: ${C.amber}; vertical-align: middle; }
.stv-controls { grid-column: 3; grid-row: 1 / span 2; align-self: center; display: flex; align-items: center; gap: 1.2vw; }
.stv-btn { width: 7vmin; height: 7vmin; border-radius: 50%; display: grid; place-items: center; border: 2px solid rgba(154,162,180,.5);
  transition: transform .15s, background .15s, border-color .15s; }
.stv-btn svg { width: 3.2vmin; height: 3.2vmin; fill: ${C.ivory}; }
.stv-btn.stv-play { width: 9vmin; height: 9vmin; background: ${C.ivory}; border-color: ${C.ivory}; }
.stv-btn.stv-play svg { width: 4vmin; height: 4vmin; fill: ${C.graphite}; }
.stv-btn.stv-focus { background: ${C.amber}; border-color: ${C.amber}; transform: scale(1.08); }
.stv-btn.stv-focus svg { fill: ${C.graphite}; }
.stv-scale { grid-column: 2; display: flex; align-items: center; gap: 1.2vw; font-size: 1.9vmin; color: ${C.steel};
  font-variant-numeric: tabular-nums; }
.stv-track { position: relative; flex: 1 1 auto; height: 1.6vh;
  background: repeating-linear-gradient(90deg, rgba(154,162,180,.45) 0 1px, transparent 1px 1.5%) center / 100% 60% no-repeat; }
.stv-track > i { position: absolute; left: 0; top: 50%; height: 3px; margin-top: -1.5px; width: 100%; background: ${C.amber};
  transform-origin: left center; transform: scaleX(0); transition: transform .9s linear; }

/* anello di focus sugli elementi della pagina */
.stv-ring { position: absolute; display: none; pointer-events: none; border: 3px solid ${C.amber}; border-radius: 10px;
  box-shadow: 0 0 0 5px rgba(255,181,71,.16); transition: transform .14s ease-out, width .14s ease-out, height .14s ease-out;
  left: 0; top: 0; }

/* caricamento al cambio pagina: una riga ambra che scorre sotto la barra */
.stv-loading { position: absolute; top: ${TOP_H}vh; left: 0; right: 0; height: 3px; overflow: hidden; opacity: 0; transition: opacity .2s; }
.stv-loading.stv-on { opacity: 1; }
.stv-loading i { position: absolute; top: 0; left: 0; width: 30%; height: 100%; background: ${C.amber};
  animation: stv-scan 1.1s infinite cubic-bezier(.45,0,.55,1); }
@keyframes stv-scan { from { transform: translateX(-100%); } to { transform: translateX(340%); } }

.stv-toast { position: absolute; left: 3vw; bottom: calc(${BOTTOM_H}vh + 2.4vh); display: flex; align-items: center; gap: 1vw;
  padding: 1.4vh 1.8vw; background: ${C.raised}; border-radius: 8px; font-size: 2.2vmin; opacity: 0; transform: translateY(8px);
  transition: opacity .2s, transform .2s; }
.stv-toast::before { content: ''; width: 1vmin; height: 1vmin; border-radius: 50%; background: ${C.amber}; }
.stv-toast.stv-show { opacity: 1; transform: none; }

/* schermata di avvio: la lancetta cerca la stazione */
.stv-splash { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center;
  justify-content: center; background: ${C.graphite}; transition: opacity .5s; }
.stv-splash.stv-gone { opacity: 0; }
.stv-splash h1 { margin: 0 0 6vh; font-size: 7vmin; font-weight: 700; letter-spacing: -0.02em; }
.stv-dial { position: relative; width: 44vw; height: 6vh;
  background: repeating-linear-gradient(90deg, rgba(154,162,180,.5) 0 2px, transparent 2px 2.5%) center bottom / 100% 55% no-repeat; }
.stv-dial::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(154,162,180,.5); }
.stv-dial i { position: absolute; left: 0; bottom: 0; width: 3px; height: 100%; background: ${C.amber}; border-radius: 2px;
  animation: stv-tune 2.4s infinite cubic-bezier(.45,0,.55,1) alternate; }
@keyframes stv-tune { from { transform: translateX(0); } to { transform: translateX(44vw); } }
.stv-splash p { margin: 4vh 0 0; font-size: 2.4vmin; color: ${C.steel}; }

@media (prefers-reduced-motion: reduce) {
  .stv-dial i, .stv-loading i { animation: none; }
  .stv-needle, .stv-ring, .stv-track > i { transition: none; }
}
`;
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  var PREV = '<svg viewBox="0 0 24 24"><path d="M7 6h2v12H7zM20 6v12l-9-6z"/></svg>';
  var NEXT = '<svg viewBox="0 0 24 24"><path d="M15 6h2v12h-2zM4 6l9 6-9 6z"/></svg>';
  var RW = '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
  var FF = '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>';
  var VIEWS = [
    { id: "home", label: "Home", path: "/" },
    { id: "search", label: "Cerca", path: "/search" },
    { id: "liked", label: "Preferiti", path: "/collection/tracks" }
  ];
  var TARGETS = 'a[href], button:not([disabled]), input, [role="button"], [role="link"], [role="row"], [role="tab"], [role="option"]';
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
  function bandTop() {
    return innerHeight * TOP_H / 100;
  }
  function bandBottom() {
    return innerHeight * (100 - BOTTOM_H) / 100;
  }
  function SpotifyUI() {
    this.zone = "menu";
    this.menuIndex = 0;
    this.playerIndex = 2;
    this.contentEl = null;
    this.current = "home";
    this.visible = false;
    this.mounted = false;
  }
  SpotifyUI.prototype.mount = function() {
    var self = this;
    var font = el("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap";
    (document.head || document.documentElement).appendChild(font);
    var style = el("style");
    style.id = "stv-style";
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
    var root = el("div");
    root.id = "stv-root";
    root.innerHTML = '<div class="stv-top"><div class="stv-knob"></div><div class="stv-menu"><div class="stv-needle"></div></div></div><div class="stv-loading"><i></i></div><div class="stv-bottom">  <div class="stv-art"></div>  <div class="stv-meta"><h2>Niente in riproduzione</h2><p>Scegli un brano o una playlist</p></div>  <div class="stv-controls">    <div class="stv-btn" data-cmd="rw">' + RW + '</div>    <div class="stv-btn" data-cmd="prev">' + PREV + '</div>    <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>    <div class="stv-btn" data-cmd="next">' + NEXT + '</div>    <div class="stv-btn" data-cmd="ff">' + FF + '</div>  </div>  <div class="stv-scale"><span class="stv-time">0:00</span><div class="stv-track"><i></i></div><span class="stv-dur">0:00</span></div></div><div class="stv-ring"></div><div class="stv-toast"></div><div class="stv-splash"><h1>Spotify</h1><div class="stv-dial"><i></i></div><p class="stv-splash-msg">Avvio di Spotify\u2026</p></div>';
    document.body.appendChild(root);
    this.root = root;
    this.ring = root.querySelector(".stv-ring");
    this.toastEl = root.querySelector(".stv-toast");
    this.loading = root.querySelector(".stv-loading");
    this.splash = root.querySelector(".stv-splash");
    this.splashMsg = root.querySelector(".stv-splash-msg");
    this.needle = root.querySelector(".stv-needle");
    this.art = root.querySelector(".stv-art");
    this.title = root.querySelector(".stv-meta h2");
    this.sub = root.querySelector(".stv-meta p");
    this.timeEl = root.querySelector(".stv-time");
    this.durEl = root.querySelector(".stv-dur");
    this.fill = root.querySelector(".stv-track > i");
    this.playBtn = root.querySelector('[data-cmd="play"]');
    this.playerEls = Array.prototype.slice.call(root.querySelectorAll(".stv-btn"));
    var menu = root.querySelector(".stv-menu");
    this.menuItems = VIEWS.map(function(v) {
      var it = el("div", "stv-menu-item", v.label);
      it.setAttribute("data-view", v.id);
      menu.appendChild(it);
      return it;
    });
    this.loginItem = el("div", "stv-menu-item", "Accedi");
    this.loginItem.setAttribute("data-view", "login");
    this.loginItem.style.display = "none";
    menu.appendChild(this.loginItem);
    this.bindState();
    this.markActive();
    this.show();
    this.mounted = true;
    this.waitForSpotify();
    (function follow() {
      self.drawRing();
      requestAnimationFrame(follow);
    })();
  };
  SpotifyUI.prototype.waitForSpotify = function() {
    var self = this;
    var start = Date.now();
    var timer = setInterval(function() {
      var elapsed = Date.now() - start;
      var loggedOut = !!document.querySelector('[data-testid="login-button"]');
      if (elapsed > 6e3) self.splashMsg.textContent = "Spotify \xE8 lento ad avviarsi sulla TV, manca poco";
      if (self.contentTargets().length > 6 || elapsed > 3e4) {
        clearInterval(timer);
        self.loginItem.style.display = loggedOut ? "" : "none";
        self.splash.classList.add("stv-gone");
        setTimeout(function() {
          self.splash.style.display = "none";
        }, 600);
        self.focusContentStart();
        if (loggedOut) self.toast("Accedi dal menu in alto per ascoltare la tua musica");
      }
    }, 250);
  };
  SpotifyUI.prototype.bindState = function() {
    var self = this;
    on("track", function(t) {
      self.title.textContent = t && t.name ? t.name : "Niente in riproduzione";
      self.sub.textContent = t && t.artists ? t.artists : "Scegli un brano o una playlist";
      self.art.style.backgroundImage = t && t.art ? 'url("' + t.art + '")' : "";
      if (st.ad) self.title.appendChild(el("span", "stv-tag", "Pubblicit\xE0"));
    });
    on("playing", function(p) {
      self.playBtn.innerHTML = p ? PAUSE : PLAY;
    });
    on("position", function(pos) {
      var d = st.duration || 0;
      self.timeEl.textContent = fmt(pos);
      self.durEl.textContent = fmt(d);
      self.fill.style.transform = "scaleX(" + (d > 0 ? Math.min(1, pos / d) : 0) + ")";
    });
    on("ad", function(isAd) {
      var tag = self.title.querySelector(".stv-tag");
      if (isAd && !tag) self.title.appendChild(el("span", "stv-tag", "Pubblicit\xE0"));
      if (!isAd && tag) tag.parentNode.removeChild(tag);
    });
  };
  SpotifyUI.prototype.mainEl = function() {
    return document.getElementById("main-view") || document.querySelector("main");
  };
  function mainScroller() {
    return document.querySelector("#main-view [data-overlayscrollbars-viewport]") || document.querySelector("#main-view .main-view-container__scroll-node");
  }
  function visibleRect(e) {
    var r = e.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return null;
    if (r.bottom < bandTop() || r.top > bandBottom() || r.right < 0 || r.left > innerWidth) return null;
    return r;
  }
  function reachable(e, r) {
    var x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
    var y = Math.min(Math.max(r.top + r.height / 2, bandTop() + 2), bandBottom() - 2);
    var hit = document.elementFromPoint(x, y);
    return !!hit && (hit === e || e.contains(hit) || hit.contains(e));
  }
  SpotifyUI.prototype.contentTargets = function() {
    var main = this.mainEl();
    if (!main) return [];
    var els = main.querySelectorAll(TARGETS);
    var list = [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.closest('footer, [data-testid="footer-div"]')) continue;
      var r = visibleRect(e);
      if (r && reachable(e, r)) list.push({ el: e, r });
    }
    return list.filter(function(a) {
      for (var j = 0; j < list.length; j++) {
        if (list[j] !== a && list[j].el.contains(a.el)) return false;
      }
      return true;
    });
  };
  function center(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function pick(list, from, dir) {
    var c = center(from), best = null, bestScore = Infinity;
    list.forEach(function(it) {
      var p = center(it.r), dx = p.x - c.x, dy = p.y - c.y, primary, ortho;
      if (dir === "left") {
        if (it.r.right > from.left + 4) return;
        primary = -dx;
        ortho = Math.abs(dy);
      }
      if (dir === "right") {
        if (it.r.left < from.right - 4) return;
        primary = dx;
        ortho = Math.abs(dy);
      }
      if (dir === "up") {
        if (it.r.bottom > from.top + 4) return;
        primary = -dy;
        ortho = Math.abs(dx);
      }
      if (dir === "down") {
        if (it.r.top < from.bottom - 4) return;
        primary = dy;
        ortho = Math.abs(dx);
      }
      var score = primary + ortho * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    });
    return best;
  }
  function scrollerOf(e, horizontal) {
    var node = e.parentElement;
    while (node && node !== document.documentElement) {
      var cs = getComputedStyle(node);
      if (horizontal) {
        if (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 4) return node;
      } else if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 4) return node;
      node = node.parentElement;
    }
    return horizontal ? null : mainScroller();
  }
  SpotifyUI.prototype.focusContentStart = function() {
    var list = this.contentTargets();
    if (!list.length) {
      this.setZone("menu");
      return;
    }
    list.sort(function(a, b) {
      return a.r.top - b.r.top || a.r.left - b.r.left;
    });
    this.setContent(list[0].el);
  };
  SpotifyUI.prototype.setContent = function(e) {
    this.zone = "content";
    this.contentEl = e;
    var r = e.getBoundingClientRect();
    var top = bandTop(), bottom = bandBottom();
    if (r.top < top + innerHeight * 0.04 || r.bottom > bottom - innerHeight * 0.04) {
      var sc = scrollerOf(e, false);
      var delta = r.top + r.height / 2 - (top + bottom) / 2;
      if (sc) sc.scrollBy({ top: delta, behavior: "smooth" });
      else e.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (r.left < 0 || r.right > innerWidth) e.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    this.paintFocus();
  };
  SpotifyUI.prototype.setZone = function(zone) {
    this.zone = zone;
    this.paintFocus();
  };
  SpotifyUI.prototype.menuList = function() {
    var items = this.menuItems.slice();
    if (this.loginItem.style.display !== "none") items.push(this.loginItem);
    return items;
  };
  SpotifyUI.prototype.paintFocus = function() {
    var items = this.menuList();
    this.menuItems.concat([this.loginItem]).forEach(function(m) {
      m.classList.remove("stv-focus");
    });
    this.playerEls.forEach(function(b) {
      b.classList.remove("stv-focus");
    });
    this.menuIndex = Math.min(this.menuIndex, items.length - 1);
    if (this.zone === "menu") items[this.menuIndex].classList.add("stv-focus");
    if (this.zone === "player") this.playerEls[this.playerIndex].classList.add("stv-focus");
    this.placeNeedle();
    this.drawRing();
  };
  SpotifyUI.prototype.placeNeedle = function() {
    var target = this.zone === "menu" ? this.menuList()[this.menuIndex] : this.menuItems.filter(function(m) {
      return m.classList.contains("stv-active");
    })[0];
    if (!target) {
      this.needle.style.opacity = "0";
      return;
    }
    this.needle.style.opacity = "1";
    this.needle.style.transform = "translateX(" + target.offsetLeft + "px) scaleX(" + target.offsetWidth / 40 + ")";
    this.needle.classList.toggle("stv-lit", this.zone === "menu");
  };
  SpotifyUI.prototype.drawRing = function() {
    if (!this.ring) return;
    var e = this.zone === "content" ? this.contentEl : null;
    if (!e || !document.contains(e) || !this.visible) {
      this.ring.style.display = "none";
      return;
    }
    var r = e.getBoundingClientRect();
    this.ring.style.display = "block";
    this.ring.style.transform = "translate(" + (r.left - 6) + "px," + (r.top - 6) + "px)";
    this.ring.style.width = r.width + 12 + "px";
    this.ring.style.height = r.height + 12 + "px";
  };
  SpotifyUI.prototype.move = function(dir) {
    var self = this;
    if (this.zone === "menu") {
      var items = this.menuList();
      if (dir === "left") this.menuIndex = Math.max(0, this.menuIndex - 1);
      if (dir === "right") this.menuIndex = Math.min(items.length - 1, this.menuIndex + 1);
      if (dir === "down") {
        this.focusContentStart();
        return;
      }
      this.paintFocus();
      return;
    }
    if (this.zone === "player") {
      if (dir === "left") this.playerIndex = Math.max(0, this.playerIndex - 1);
      if (dir === "right") this.playerIndex = Math.min(this.playerEls.length - 1, this.playerIndex + 1);
      if (dir === "up") {
        if (this.contentEl && document.contains(this.contentEl) && visibleRect(this.contentEl)) this.setContent(this.contentEl);
        else this.focusContentStart();
        return;
      }
      this.paintFocus();
      return;
    }
    var cur = this.contentEl;
    if (!cur || !document.contains(cur)) {
      this.focusContentStart();
      return;
    }
    var others = function() {
      return self.contentTargets().filter(function(it) {
        return it.el !== cur;
      });
    };
    var best = pick(others(), cur.getBoundingClientRect(), dir);
    if (best) {
      this.setContent(best.el);
      return;
    }
    var horizontal = dir === "left" || dir === "right";
    var sc = scrollerOf(cur, horizontal);
    var before = sc ? horizontal ? sc.scrollLeft : sc.scrollTop : 0;
    if (sc) {
      var step = (dir === "right" || dir === "down" ? 1 : -1) * (horizontal ? innerWidth * 0.5 : innerHeight * 0.4);
      sc.scrollBy(horizontal ? { left: step, behavior: "smooth" } : { top: step, behavior: "smooth" });
    }
    setTimeout(function() {
      var moved = sc && Math.abs((horizontal ? sc.scrollLeft : sc.scrollTop) - before) > 4;
      var again = pick(others(), cur.getBoundingClientRect(), dir);
      if (again) {
        self.setContent(again.el);
        return;
      }
      if (!moved && !horizontal) self.setZone(dir === "up" ? "menu" : "player");
    }, 420);
  };
  SpotifyUI.prototype.activate = function() {
    if (this.zone === "menu") {
      var v = this.menuList()[this.menuIndex].getAttribute("data-view");
      if (v === "login") {
        login();
        return;
      }
      this.openView(v);
      return;
    }
    if (this.zone === "player") {
      var cmd = this.playerEls[this.playerIndex].getAttribute("data-cmd");
      if (cmd === "play") commands.togglePlay();
      if (cmd === "next") commands.next();
      if (cmd === "prev") commands.prev();
      if (cmd === "rw") commands.seek(-10);
      if (cmd === "ff") commands.seek(10);
      return;
    }
    var e = this.contentEl;
    if (!e || !document.contains(e)) return;
    var path = location.pathname;
    activate(e);
    var self = this;
    setTimeout(function() {
      if (location.pathname !== path) self.afterNavigation();
    }, 150);
  };
  SpotifyUI.prototype.openView = function(id) {
    var view = null;
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) view = VIEWS[i];
    if (!view) return;
    this.current = id;
    this.markActive();
    navigate(view.path);
    this.afterNavigation(id === "search");
  };
  SpotifyUI.prototype.afterNavigation = function(isSearch) {
    var self = this;
    this.loading.classList.add("stv-on");
    this.contentEl = null;
    var start = Date.now();
    clearInterval(this._navTimer);
    this._navTimer = setInterval(function() {
      if (self.contentTargets().length > 3 || Date.now() - start > 6e3) {
        clearInterval(self._navTimer);
        self.loading.classList.remove("stv-on");
        var input = isSearch && document.querySelector('input[data-testid="search-input"], input[role="searchbox"]');
        if (input) {
          self.setContent(input);
          return;
        }
        self.focusContentStart();
      }
    }, 200);
  };
  SpotifyUI.prototype.markActive = function() {
    var cur = this.current;
    this.menuItems.forEach(function(m) {
      m.classList.toggle("stv-active", m.getAttribute("data-view") === cur);
    });
    this.placeNeedle();
  };
  SpotifyUI.prototype.back = function() {
    var e = this.contentEl;
    if (this.zone === "content" && e && /^(INPUT|TEXTAREA)$/.test(e.tagName) && document.activeElement === e) {
      e.blur();
      return;
    }
    if (location.pathname !== "/") {
      history.back();
      this.afterNavigation();
      return;
    }
    if (this.zone !== "menu") {
      this.setZone("menu");
      return;
    }
    this.toast("Tieni premuto Indietro per uscire");
  };
  SpotifyUI.prototype.show = function() {
    if (this.root) this.root.style.display = "block";
    this.visible = true;
  };
  SpotifyUI.prototype.hide = function() {
    if (this.root) this.root.style.display = "none";
    this.visible = false;
  };
  SpotifyUI.prototype.toast = function(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("stv-show");
    clearTimeout(this._toastTimer);
    var self = this;
    this._toastTimer = setTimeout(function() {
      self.toastEl.classList.remove("stv-show");
    }, 2600);
  };
  SpotifyUI.prototype.focusPlayer = function() {
    this.playerIndex = 2;
    this.setZone("player");
  };
  function startUi() {
    if (window.__spotifyTvUi) return;
    var ui2 = new SpotifyUI();
    window.__spotifyTvUi = ui2;
    registerUi(ui2);
    function mount() {
      if (!document.body) return setTimeout(mount, 50);
      ui2.mount();
    }
    mount();
  }

  // src/basicnav.js
  var TARGETS2 = 'input:not([type="hidden"]), button:not([disabled]), a[href], select, [role="button"], [role="checkbox"]';
  function rectOf(e) {
    var r = e.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) return null;
    var cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") return null;
    return r;
  }
  function isText(e) {
    return e && (e.tagName === "TEXTAREA" || e.tagName === "INPUT" && !/^(button|checkbox|radio|submit)$/.test(e.type));
  }
  function startBasicNav() {
    var cur = null, ring = null;
    function draw() {
      if (!document.body) return requestAnimationFrame(draw);
      if (!ring) {
        ring = document.createElement("div");
        ring.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #1ed760;border-radius:10px;box-shadow:0 0 22px rgba(30,215,96,.6);display:none;transition:all .12s";
        document.body.appendChild(ring);
      }
      var r = cur && document.contains(cur) ? cur.getBoundingClientRect() : null;
      ring.style.display = r ? "block" : "none";
      if (r) {
        ring.style.left = r.left - 5 + "px";
        ring.style.top = r.top - 5 + "px";
        ring.style.width = r.width + 10 + "px";
        ring.style.height = r.height + 10 + "px";
      }
      requestAnimationFrame(draw);
    }
    draw();
    function targets() {
      var out = [];
      document.querySelectorAll(TARGETS2).forEach(function(e) {
        var r = rectOf(e);
        if (r) out.push({ el: e, r });
      });
      return out;
    }
    function go(e) {
      cur = e;
      e.scrollIntoView({ block: "center", behavior: "smooth" });
      if (isText(e)) e.focus();
    }
    function move(dir) {
      var list = targets();
      if (!list.length) return;
      if (!cur || !document.contains(cur)) {
        go(list[0].el);
        return;
      }
      var f = cur.getBoundingClientRect(), cx = f.left + f.width / 2, cy = f.top + f.height / 2;
      var best = null, bestScore = Infinity;
      list.forEach(function(it) {
        if (it.el === cur) return;
        var px = it.r.left + it.r.width / 2, py = it.r.top + it.r.height / 2, primary, ortho;
        if (dir === "up") {
          if (py >= cy - 4) return;
          primary = cy - py;
          ortho = Math.abs(px - cx);
        }
        if (dir === "down") {
          if (py <= cy + 4) return;
          primary = py - cy;
          ortho = Math.abs(px - cx);
        }
        if (dir === "left") {
          if (px >= cx - 4) return;
          primary = cx - px;
          ortho = Math.abs(py - cy);
        }
        if (dir === "right") {
          if (px <= cx + 4) return;
          primary = px - cx;
          ortho = Math.abs(py - cy);
        }
        var s = primary + ortho * 2.5;
        if (s < bestScore) {
          bestScore = s;
          best = it.el;
        }
      });
      if (best) go(best);
    }
    window.addEventListener("keydown", function(e) {
      var k = e.keyCode, handled = true;
      var typing = isText(document.activeElement);
      if (k === 37 && !typing) move("left");
      else if (k === 39 && !typing) move("right");
      else if (k === 38) {
        if (typing) document.activeElement.blur();
        move("up");
      } else if (k === 40) {
        if (typing) document.activeElement.blur();
        move("down");
      } else if (k === 13 && cur && !typing) {
        if (isText(cur)) cur.focus();
        else cur.click();
      } else if (k === 10009) {
        if (typing) document.activeElement.blur();
        else history.back();
      } else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  // src/main.js
  (function boot() {
    if (window.__spotifyTv) return;
    var diag = [];
    function d(msg) {
      diag.push((/* @__PURE__ */ new Date()).toTimeString().substr(0, 8) + " " + msg);
      if (diag.length > 60) diag.shift();
    }
    d("boot v0.6.0 \u2014 " + location.href.substr(0, 60));
    try {
      if (window.self === window.top) document.title = "[v060] " + (document.title || "Spotify");
    } catch (e) {
    }
    window.addEventListener("error", function(e) {
      d("ERRORE: " + (e.message || "") + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno);
    });
    var top = window.self === window.top;
    var cfg = window.__spotifyTvConfig || {};
    window.__spotifyTv = {
      version: "0.6.0",
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
    if (top && location.hostname !== "open.spotify.com") {
      startBasicNav();
      d("pagina esterna: navigazione minima");
      return;
    }
    if (top) {
      try {
        init();
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
      var a = document.activeElement;
      var typing = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" && !/^(button|checkbox|radio|submit)$/.test(a.type));
      if (typing && (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.ENTER)) return;
      if (typing && (k === KEY.UP || k === KEY.DOWN)) a.blur();
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
      diagBox.textContent = "Spotify TV Mod " + window.__spotifyTv.version + "   (GIALLO chiude)\npagina: " + location.href.substr(0, 80) + "\n--- eventi ---\n" + lines.join("\n");
      diagBox.style.display = "block";
    }
    window.__spotifyTv.showDiag = showDiag;
    document.addEventListener("keydown", function(e) {
      if (e.keyCode === KEY.YELLOW) showDiag();
    }, false);
    window.addEventListener("beforeunload", function() {
      window.__spotifyTvUi = null;
    });
  })();
})();
