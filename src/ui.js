/* UI televisiva per Spotify.
 *
 * La pagina di Spotify resta sotto, nascosta: serve solo come motore audio.
 * Sopra costruiamo una shell TV: una barra con i menu, il player fisso in basso,
 * e le "viste" (Home, Cerca, La tua raccolta, brano) che sono iframe della
 * pagina di Spotify, ripuliti con CSS, spostati con translate3d e navigati dal
 * telecomando a zone (su/giù fra righe, sinistra/destra nella riga).
 */
'use strict';

import { on, emit } from './bus.js';
import { st } from './state.js';
import { registerUi, commands } from './registry.js';

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
  { id: 'home', label: 'Home', path: '/', hero: true },
  { id: 'search', label: 'Cerca', path: '/search' },
  { id: 'library', label: 'La tua raccolta', path: '/collection' }
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
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function SpotifyUI() {
  this.zones = [];          // zone navigabili: array di array di elementi
  this.zoneIndex = 0;
  this.itemIndex = 0;
  this.views = {};
  this.current = 'home';     // vista "logica": all'avvio è l'hero, non un iframe
  this.frameMounted = false; // l'iframe di Spotify esiste solo dopo la prima scelta
  this.frameReady = {};
  this.ring = null;
  this.booted = false;
}

SpotifyUI.prototype.mount = function () {
  var self0 = this;
  function step(name, fn) {
    try { fn(); } catch (e) {
      self0.mountErrors = self0.mountErrors || [];
      self0.mountErrors.push(name + ': ' + e.message);
      if (window.console) console.warn('[spotify-tv] mount ' + name, e);
    }
  }

  var style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var root = el('div');
  root.id = 'stv-root';
  root.innerHTML =
    '<div class="stv-shell">' +
    '  <div class="stv-top"><div class="stv-brand">Spotify</div><div class="stv-menu"></div></div>' +
    '  <div class="stv-stage">' +
    '    <div class="stv-loadbar"></div>' +
    '  </div>' +
    '  <div class="stv-bottom">' +
    '    <div class="stv-art"></div>' +
    '    <div class="stv-meta"><h2>—</h2><p>Premi OK su un brano</p>' +
    '      <div class="stv-progress"><span class="stv-time">0:00</span><div class="stv-bar"><i></i></div><span class="stv-dur">0:00</span></div>' +
    '    </div>' +
    '    <div class="stv-controls">' +
    '      <div class="stv-btn stv-vol" data-cmd="vol-down">–</div>' +
    '      <div class="stv-btn stv-vol" data-cmd="vol-up">+</div>' +
    '      <div class="stv-btn" data-cmd="rw">' + RW + '</div>' +
    '      <div class="stv-btn" data-cmd="prev">' + PREV + '</div>' +
    '      <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>' +
    '      <div class="stv-btn" data-cmd="next">' + NEXT + '</div>' +
    '      <div class="stv-btn" data-cmd="ff">' + FF + '</div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="stv-toast"></div>' +
    '<div class="stv-focus-ring"></div>';
  document.documentElement.appendChild(root);

  this.root = root;
  this.stage = root.querySelector('.stv-stage');
  this.menu = root.querySelector('.stv-menu');
  this.ring = root.querySelector('.stv-focus-ring');
  this.loadbar = root.querySelector('.stv-loadbar');
  this.toastEl = root.querySelector('.stv-toast');
  this.bottom = root.querySelector('.stv-bottom');
  this.art = root.querySelector('.stv-art');
  this.title = root.querySelector('.stv-meta h2');
  this.sub = root.querySelector('.stv-meta p');
  this.timeEl = root.querySelector('.stv-time');
  this.durEl = root.querySelector('.stv-dur');
  this.fill = root.querySelector('.stv-bar > i');
  this.playBtn = root.querySelector('[data-cmd="play"]');
  this.badge = el('div', 'stv-badge');
  this.badge.style.display = 'none';
  root.appendChild(this.badge);

  var self = this;
  if (this.playBtn) this.playBtn.addEventListener('click', function () { commands.togglePlay(); });
  var cmdEls = root.querySelectorAll('[data-cmd]') || [];
  Array.prototype.forEach.call(cmdEls, function (b) {
    b.addEventListener('click', function () {
      var c = b.getAttribute('data-cmd');
      if (c === 'next') commands.next();
      if (c === 'prev') commands.prev();
      if (c === 'rw') commands.seek(-10);
      if (c === 'ff') commands.seek(10);
      if (c === 'vol-up') commands.volume(0.1);
      if (c === 'vol-down') commands.volume(-0.1);
    });
  });

  step('menu', function () { self.buildMenu(); });
  step('hero', function () { self.buildHero(); });
  step('player', function () { self.buildPlayerZone(); });
  step('stato', function () { self.bindState(); });
  step('focus', function () { self.focus(0, 0); });
  step('mostra', function () { self.show(); });
  this.mounted = true;

  // Primo caricamento: la shell è già visibile e animata, Spotify carica sotto.
  setTimeout(function () { self.markLoaded(); }, 400);
};

SpotifyUI.prototype.buildMenu = function () {
  var self = this;
  var brand = this.root.querySelector('.stv-brand');
  if (brand) {
    brand.setAttribute('data-view', 'home');
    brand.addEventListener('click', function () { self.openView('home'); });
  }
  this.brand = brand;
  this.menuItems = VIEWS.map(function (v) {
    var it = el('div', 'stv-menu-item', v.label);
    it.setAttribute('data-view', v.id);
    it.addEventListener('click', function () { self.openView(v.id); });
    self.menu.appendChild(it);
    return it;
  });
};

SpotifyUI.prototype.buildHero = function () {
  var self = this;
  var hero = el('div', 'stv-hero');
  hero.innerHTML =
    '<p class="stv-hero-title">Spotify sulla TV</p>' +
    '<h1 class="stv-hero-big">La tua musica,<br>sul grande schermo.</h1>' +
    '<p class="stv-hero-sub">Usa le frecce per muoverti, OK per scegliere. I tasti play/pausa e traccia del telecomando funzionano sempre.</p>' +
    '<div class="stv-tiles">' +
    '  <div class="stv-tile" data-view="home"><h3>Home</h3><p>I tuoi ascolti e i consigli di Spotify</p></div>' +
    '  <div class="stv-tile" data-view="search"><h3>Cerca</h3><p>Brani, artisti, album, playlist</p></div>' +
    '  <div class="stv-tile" data-view="library"><h3>La tua raccolta</h3><p>Playlist e brani salvati</p></div>' +
    '</div>';
  var heroTiles = hero.querySelectorAll('[data-view]') || [];
  Array.prototype.forEach.call(heroTiles, function (t) {
    t.addEventListener('click', function () { self.openView(t.getAttribute('data-view')); });
  });
  this.hero = hero;
  this.stage.appendChild(hero);
};

SpotifyUI.prototype.buildPlayerZone = function () {
  // La zona 1 è sempre il player: un "su" dalle viste ci porta lì.
  this.playerEls = Array.prototype.slice.call(this.bottom ? this.bottom.querySelectorAll('.stv-btn') : []);
  (this.playerEls || []).forEach(function (b, i) {
    b.setAttribute('tabindex', '0');
    b.__zone = 'player';
  });
};

SpotifyUI.prototype.bindState = function () {
  var self = this;

  on('track', function (t) {
    self.title.textContent = t && t.name ? t.name : '—';
    self.sub.textContent = t && t.artists ? t.artists : 'Premi OK su un brano';
    if (t && t.art) {
      self.art.style.backgroundImage = 'url("' + t.art + '")';
      self.art.classList.add('stv-pulse');
    } else {
      self.art.style.backgroundImage = '';
      self.art.classList.remove('stv-pulse');
    }
    if (t && t.duration) self.durEl.textContent = fmt(t.duration);
  });

  on('playing', function (p) {
    self.playBtn.innerHTML = p ? PAUSE : PLAY;
    self.art.classList.toggle('stv-pulse', !!p);
  });

  on('position', function (pos) {
    self.timeEl.textContent = fmt(pos);
    var d = st.duration || 0;
    self.fill.style.width = d > 0 ? Math.min(100, (pos / d) * 100) + '%' : '0%';
  });

  on('ad', function (isAd) {
    self.badge.style.display = isAd ? 'block' : 'none';
    self.badge.textContent = 'Pubblicità in corso…';
  });

  on('progress', function (p) {
    self.loadbar.style.width = Math.round(p * 100) + '%';
    if (p >= 1) setTimeout(function () { self.loadbar.style.opacity = '0'; }, 600);
  });
};

/* ------------------------------------------------------------- viste */
SpotifyUI.prototype.frameFor = function (view) {
  var self = this;
  if (this.views[view.id]) return this.views[view.id];

  var frame = el('iframe', 'stv-frame');
  frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
  frame.__view = view.id;
  this.stage.appendChild(frame);
  this.views[view.id] = frame;

  frame.addEventListener('load', function () {
    self.frameReady[view.id] = true;
    if (self.pendingView === view.id) self.markLoaded();
    // Se Spotify è lento, teniamo lo scheletro di caricamento visibile.
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) doc.documentElement.classList.add('stv-embedded');
    } catch (e) { }
  });

  // Prima navigazione: alla pagina attuale (stessa sessione di login, stessa
  // musica), poi la vista vera e propria.
  frame.src = (this.current === 'home' && !this.frameMounted) ? location.href : location.origin + view.path;
  this.frameMounted = true;
  return frame;
};

SpotifyUI.prototype.showSkeleton = function () {
  var self = this;
  if (!this.skeleton) {
    this.skeleton = el('div', 'stv-skeleton');
    this.skeleton.innerHTML =
      '<div class="stv-sk-line" style="width:26%"></div>' +
      '<div class="stv-sk-line" style="width:52%;height:5vh"></div>' +
      '<div class="stv-sk-row"><div class="stv-sk-card"></div><div class="stv-sk-card"></div>' +
      '<div class="stv-sk-card"></div><div class="stv-sk-card"></div></div>' +
      '<div class="stv-sk-row"><div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div>' +
      '<div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div>' +
      '<div class="stv-sk-card" style="width:10vw;height:10vw;border-radius:50%"></div></div>';
    this.stage.appendChild(this.skeleton);
  }
  this.skeleton.classList.remove('stv-done');
  this.skeleton.style.display = 'flex';
  // Avanzamento a scatti: comunica il lavoro in corso anche se la rete è lenta.
  var p = 0;
  var self2 = this;
  clearInterval(this._skTimer);
  this._skTimer = setInterval(function () {
    p = Math.min(0.9, p + 0.07);
    emit('progress', p);
    if (self2.skeleton.classList.contains('stv-done')) clearInterval(self2._skTimer);
  }, 260);
};

SpotifyUI.prototype.markLoaded = function () {
  if (this.skeleton) this.skeleton.classList.add('stv-done');
  emit('progress', 1);
};

SpotifyUI.prototype.openView = function (id) {
  var view = null;
  for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) view = VIEWS[i];
  if (!view) return;
  var firstFrame = !this.frameMounted;
  if (this.current === id && !firstFrame) return;
  this.current = id;
  this.pendingView = id;
  var frame = this.frameFor(view);

  // Se la vista ha già caricato una volta, lo scheletro serve solo un attimo.
  if (this.frameReady[id]) this.markLoaded(); else this.showSkeleton();

  Object.keys(this.views).forEach(function (k) {
    this.views[k].classList.toggle('stv-visible', k === id);
  }, this);

  // Home: il riquadro "hero" è sopra la vista finché non si entra davvero.
  this.hero.style.display = id === 'home' && !this.frameMounted ? 'block' : 'none';
  (this.menuItems || []).forEach(function (it) {
    it.classList.toggle('stv-active', it.getAttribute('data-view') === id);
  });
  this.focus(1, 0);
  this.toast(view.label);
};

/* --------------------------------------------------------- navigazione */
SpotifyUI.prototype.zonesOf = function () {
  // Ordine di navigazione dall'alto verso il basso: menu, contenuto, player.
  // Il player è in fondo perché il telecomando deve arrivare prima ai contenuti.
  var z = [];
  z.push((this.brand ? [{ el: this.brand }] : []).concat((this.menuItems || []).map(function (m) { return { el: m }; })));
  if (!this.frameMounted && this.current === 'home' && this.hero.style.display !== 'none') {
    z.push(Array.prototype.slice.call(this.hero.querySelectorAll('.stv-tile')).map(function (t) { return { el: t }; }));
  } else if (this.current) {
    var frame = this.views[this.current];
    var items = [];
    if (frame && this.frameReady[this.current]) {
      try { items = this.itemsInFrame(frame); } catch (e) { items = []; }
    }
    z.push(items.length ? items : [{ el: frame }]);
  }
  z.push(this.playerEls.map(function (b) { return { el: b }; }));
  return z;
};

SpotifyUI.prototype.playerZone = function () {
  return this.zonesOf().length - 1;
};

SpotifyUI.prototype.itemsInFrame = function (frame) {
  var doc = frame.contentDocument;
  if (!doc) return [];
  var els = doc.querySelectorAll('[data-testid="card-click-handler"], [data-testid="tracklist-row"], ' +
    'a[href^="/album"], a[href^="/playlist"], a[href^="/artist"], [role="row"], [role="button"]');
  var out = [];
  var seen = {};
  for (var i = 0; i < els.length && out.length < 120; i++) {
    var e = els[i];
    if (seen[e]) continue;
    seen[e] = 1;
    out.push({ el: e, frame: frame, doc: doc });
  }
  return out;
};

SpotifyUI.prototype.focus = function (zone, index) {
  var zones = this.zonesOf();
  if (!zones.length) return;
  zone = Math.max(0, Math.min(zones.length - 1, zone));
  var list = zones[zone] || [];
  if (!list.length) { this.hideRing(); return; }
  index = Math.max(0, Math.min(list.length - 1, index));
  this.zoneIndex = zone;
  this.itemIndex = index;

  // togliamo il focus precedente
  if (this.focusedEl) this.focusedEl.classList.remove('stv-focus');
  var item = list[index];
  var e = item.el;
  this.focusedEl = e;
  if (e.classList) e.classList.add('stv-focus');

  if (item.frame) {
    // elemento dentro l'iframe: la vista scorre e l'anello segue
    try {
      e.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var r = e.getBoundingClientRect();
      this.drawRing(r.left, r.top, r.width, r.height);
    } catch (err) { this.hideRing(); }
  } else {
    var r2 = e.getBoundingClientRect();
    this.drawRing(r2.left, r2.top, r2.width, r2.height);
  }
};

SpotifyUI.prototype.drawRing = function (x, y, w, h) {
  if (!this.ring) return;
  this.ring.style.display = 'block';
  this.ring.style.left = (x - 6) + 'px';
  this.ring.style.top = (y - 6) + 'px';
  this.ring.style.width = (w + 12) + 'px';
  this.ring.style.height = (h + 12) + 'px';
};

SpotifyUI.prototype.hideRing = function () {
  if (this.ring) this.ring.style.display = 'none';
};

SpotifyUI.prototype.move = function (dir) {
  var zones = this.zonesOf();
  if (dir === 'up') {
    if (this.zoneIndex > 0) this.focus(this.zoneIndex - 1, 0);
    else this.toast('Sei in cima');
    return;
  }
  if (dir === 'down') {
    if (this.zoneIndex < zones.length - 1) this.focus(this.zoneIndex + 1, 0);
    else this.toast('Sei in fondo');
    return;
  }
  var delta = dir === 'left' ? -1 : 1;
  var list = zones[this.zoneIndex] || [];
  var next = this.itemIndex + delta;
  if (next < 0 || next >= list.length) {
    // bordo della riga: scorriamo la vista di una schermata
    this.scrollStage(delta);
    return;
  }
  this.focus(this.zoneIndex, next);
};

SpotifyUI.prototype.scrollStage = function (dir) {
  var frame = this.current && this.views[this.current];
  if (!frame) return;
  try {
    frame.contentWindow.scrollBy({ top: dir * 420, behavior: 'smooth' });
  } catch (e) { }
};

SpotifyUI.prototype.activate = function () {
  var zones = this.zonesOf();
  var item = (zones[this.zoneIndex] || [])[this.itemIndex];
  if (!item) return;
  if (item.frame) {
    // click "vero" dentro l'iframe, così Spotify reagisce come a un tap
    try {
      var e = item.el;
      var r = e.getBoundingClientRect();
      var opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      e.dispatchEvent(new item.doc.defaultView.MouseEvent('mousedown', opts));
      e.dispatchEvent(new item.doc.defaultView.MouseEvent('mouseup', opts));
      e.dispatchEvent(new item.doc.defaultView.MouseEvent('click', opts));
    } catch (err) { }
    return;
  }
  var view = item.el.getAttribute && item.el.getAttribute('data-view');
  if (view) { this.openView(view); return; }
  if (item.el.getAttribute && item.el.getAttribute('data-cmd')) { item.el.click(); return; }
  item.el.click();
};

SpotifyUI.prototype.show = function () {
  if (this.root) this.root.style.display = 'block';
  this.visible = true;
};

SpotifyUI.prototype.hide = function () {
  if (this.root) this.root.style.display = 'none';
  this.visible = false;
};

SpotifyUI.prototype.toggle = function () { this.visible ? this.hide() : this.show(); };

SpotifyUI.prototype.toast = function (msg) {
  if (!this.toastEl) return;
  this.toastEl.textContent = msg;
  this.toastEl.classList.add('stv-show');
  clearTimeout(this._toastTimer);
  var self = this;
  this._toastTimer = setTimeout(function () { self.toastEl.classList.remove('stv-show'); }, 1800);
};

SpotifyUI.prototype.focusPlayer = function () {
  this.focus(this.playerZone(), 2);
};

/* Torna all'inizio: hero in primo piano, senza buttare via la vista caricata. */
SpotifyUI.prototype.goHome = function () {
  this.current = 'home';
  this.hero.style.display = 'block';
  Object.keys(this.views).forEach(function (k) {
    this.views[k].classList.remove('stv-visible');
  }, this);
  (this.menuItems || []).forEach(function (it) {
    it.classList.toggle('stv-active', it.getAttribute('data-view') === 'home');
  });
  this.focus(0, 0);
};

/* Indietro: prima si esce dalla vista, poi si nasconde la UI. */
SpotifyUI.prototype.back = function () {
  if (this.current && this.current !== 'home') { this.goHome(); return; }
  if (this.zoneIndex !== 0) { this.focus(0, 0); return; }
  this.hide();
};

/* --------------------------------------------------------------- avvio */
export function startUi() {
  if (window.__spotifyTvUi) return;
  var ui = new SpotifyUI();
  window.__spotifyTvUi = ui;
  registerUi(ui);

  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    if (window.self !== window.top) return; // dentro l'iframe non facciamo nulla
    ui.mount();
    // La pagina di Spotify sotto non deve "rubare" i tasti.
    document.addEventListener('keydown', function (e) {
      if (!ui.visible) return;
      var k = e.keyCode;
      if ([37, 38, 39, 40, 13, 10009].indexOf(k) === -1) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }
  mount();
}

export function isUiPage() {
  return window.self === window.top;
}
