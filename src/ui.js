/* UI televisiva per Spotify ("skin TV"), stile frontale di un amplificatore hi-fi.
 *
 * Un solo web player. Di Spotify resta visibile solo l'area dei contenuti
 * (#main-view), fissata fra la nostra barra in alto e il player in basso: tutto
 * il resto è visibility:hidden, quindi qualunque pannello aggiunga Spotify non
 * si sovrappone e non ruba il focus. La pagina viene ricolorata sovrascrivendo
 * le variabili del suo tema (come fanno i temi di Spicetify).
 *
 * Navigazione a tre zone: menu (in alto), contenuto (spaziale fra gli elementi
 * visibili di #main-view), player (in basso).
 */
'use strict';

import { on } from './bus.js';
import { st } from './state.js';
import { registerUi, commands } from './registry.js';
import * as player from './player.js';

// Palette e misure condivise da noi e dal tema di Spotify.
var C = {
  graphite: '#141821',
  panel: '#1C2230',
  raised: '#252C3D',
  ivory: '#F2EEE3',
  steel: '#9AA2B4',
  amber: '#FFB547'
};
var FONT = '"Sora", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
var TOP_H = 12;     // vh
var BOTTOM_H = 16;  // vh

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
/* trasparente: dietro c'è solo il fondo grafite e, a destra, il campo di ricerca di Spotify */
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
  { id: 'home', label: 'Home', path: '/' },
  { id: 'search', label: 'Cerca', path: '/search' },
  { id: 'liked', label: 'Preferiti', path: '/collection/tracks' }
];

// Elementi della pagina di Spotify che si possono scegliere col telecomando.
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
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// Fascia dello schermo occupata dalla pagina di Spotify.
function bandTop() { return innerHeight * TOP_H / 100; }
function bandBottom() { return innerHeight * (100 - BOTTOM_H) / 100; }

function SpotifyUI() {
  this.zone = 'menu';       // 'menu' | 'content' | 'player'
  this.menuIndex = 0;
  this.playerIndex = 2;
  this.contentEl = null;
  this.current = 'home';
  this.visible = false;
  this.mounted = false;
}

/* ---------------------------------------------------------------- mount */
SpotifyUI.prototype.mount = function () {
  var self = this;
  var font = el('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap';
  (document.head || document.documentElement).appendChild(font);

  var style = el('style');
  style.id = 'stv-style';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  var root = el('div');
  root.id = 'stv-root';
  root.innerHTML =
    '<div class="stv-top"><div class="stv-knob"></div><div class="stv-menu"><div class="stv-needle"></div></div></div>' +
    '<div class="stv-loading"><i></i></div>' +
    '<div class="stv-bottom">' +
    '  <div class="stv-art"></div>' +
    '  <div class="stv-meta"><h2>Niente in riproduzione</h2><p>Scegli un brano o una playlist</p></div>' +
    '  <div class="stv-controls">' +
    '    <div class="stv-btn" data-cmd="rw">' + RW + '</div>' +
    '    <div class="stv-btn" data-cmd="prev">' + PREV + '</div>' +
    '    <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>' +
    '    <div class="stv-btn" data-cmd="next">' + NEXT + '</div>' +
    '    <div class="stv-btn" data-cmd="ff">' + FF + '</div>' +
    '  </div>' +
    '  <div class="stv-scale"><span class="stv-time">0:00</span><div class="stv-track"><i></i></div><span class="stv-dur">0:00</span></div>' +
    '</div>' +
    '<div class="stv-ring"></div>' +
    '<div class="stv-toast"></div>' +
    '<div class="stv-splash"><h1>Spotify</h1><div class="stv-dial"><i></i></div><p class="stv-splash-msg">Avvio di Spotify…</p></div>';
  document.body.appendChild(root);

  this.root = root;
  this.ring = root.querySelector('.stv-ring');
  this.toastEl = root.querySelector('.stv-toast');
  this.loading = root.querySelector('.stv-loading');
  this.splash = root.querySelector('.stv-splash');
  this.splashMsg = root.querySelector('.stv-splash-msg');
  this.needle = root.querySelector('.stv-needle');
  this.art = root.querySelector('.stv-art');
  this.title = root.querySelector('.stv-meta h2');
  this.sub = root.querySelector('.stv-meta p');
  this.timeEl = root.querySelector('.stv-time');
  this.durEl = root.querySelector('.stv-dur');
  this.fill = root.querySelector('.stv-track > i');
  this.playBtn = root.querySelector('[data-cmd="play"]');
  this.playerEls = Array.prototype.slice.call(root.querySelectorAll('.stv-btn'));

  var menu = root.querySelector('.stv-menu');
  this.menuItems = VIEWS.map(function (v) {
    var it = el('div', 'stv-menu-item', v.label);
    it.setAttribute('data-view', v.id);
    menu.appendChild(it);
    return it;
  });
  this.loginItem = el('div', 'stv-menu-item', 'Accedi');
  this.loginItem.setAttribute('data-view', 'login');
  this.loginItem.style.display = 'none';
  menu.appendChild(this.loginItem);

  this.bindState();
  this.markActive();
  this.show();
  this.mounted = true;
  this.waitForSpotify();

  // l'anello segue l'elemento mentre la pagina scorre o si ridisegna
  (function follow() { self.drawRing(); requestAnimationFrame(follow); })();
};

/* Schermata di avvio: resta finché Spotify non ha disegnato qualcosa di utile. */
SpotifyUI.prototype.waitForSpotify = function () {
  var self = this;
  var start = Date.now();
  var timer = setInterval(function () {
    var elapsed = Date.now() - start;
    var loggedOut = !!document.querySelector('[data-testid="login-button"]');
    if (elapsed > 6000) self.splashMsg.textContent = 'Spotify è lento ad avviarsi sulla TV, manca poco';
    if (self.contentTargets().length > 6 || elapsed > 30000) {
      clearInterval(timer);
      self.loginItem.style.display = loggedOut ? '' : 'none';
      self.splash.classList.add('stv-gone');
      setTimeout(function () { self.splash.style.display = 'none'; }, 600);
      self.focusContentStart();
      if (loggedOut) self.toast('Accedi dal menu in alto per ascoltare la tua musica');
    }
  }, 250);
};

SpotifyUI.prototype.bindState = function () {
  var self = this;
  on('track', function (t) {
    self.title.textContent = t && t.name ? t.name : 'Niente in riproduzione';
    self.sub.textContent = t && t.artists ? t.artists : 'Scegli un brano o una playlist';
    self.art.style.backgroundImage = t && t.art ? 'url("' + t.art + '")' : '';
    if (st.ad) self.title.appendChild(el('span', 'stv-tag', 'Pubblicità'));
  });
  on('playing', function (p) { self.playBtn.innerHTML = p ? PAUSE : PLAY; });
  on('position', function (pos) {
    var d = st.duration || 0;
    self.timeEl.textContent = fmt(pos);
    self.durEl.textContent = fmt(d);
    self.fill.style.transform = 'scaleX(' + (d > 0 ? Math.min(1, pos / d) : 0) + ')';
  });
  on('ad', function (isAd) {
    var tag = self.title.querySelector('.stv-tag');
    if (isAd && !tag) self.title.appendChild(el('span', 'stv-tag', 'Pubblicità'));
    if (!isAd && tag) tag.parentNode.removeChild(tag);
  });
};

/* ------------------------------------------------------- pagina Spotify */
SpotifyUI.prototype.mainEl = function () {
  return document.getElementById('main-view') || document.querySelector('main');
};

function mainScroller() {
  return document.querySelector('#main-view [data-overlayscrollbars-viewport]') ||
    document.querySelector('#main-view .main-view-container__scroll-node');
}

function visibleRect(e) {
  var r = e.getBoundingClientRect();
  if (r.width < 12 || r.height < 12) return null;
  if (r.bottom < bandTop() || r.top > bandBottom() || r.right < 0 || r.left > innerWidth) return null;
  return r;
}

// Il centro dell'elemento deve essere davvero suo: esclude ciò che è coperto.
function reachable(e, r) {
  var x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
  var y = Math.min(Math.max(r.top + r.height / 2, bandTop() + 2), bandBottom() - 2);
  var hit = document.elementFromPoint(x, y);
  return !!hit && (hit === e || e.contains(hit) || hit.contains(e));
}

SpotifyUI.prototype.contentTargets = function () {
  var main = this.mainEl();
  if (!main) return [];
  var els = main.querySelectorAll(TARGETS);
  var list = [];
  for (var i = 0; i < els.length; i++) {
    var e = els[i];
    if (e.closest('footer, [data-testid="footer-div"]')) continue; // link legali in fondo alla pagina
    var r = visibleRect(e);
    if (r && reachable(e, r)) list.push({ el: e, r: r });
  }
  // Se un elemento ne contiene un altro (scheda con dentro il tasto play),
  // teniamo solo quello esterno: OK sulla scheda la apre, OK su una riga la suona.
  return list.filter(function (a) {
    for (var j = 0; j < list.length; j++) {
      if (list[j] !== a && list[j].el.contains(a.el)) return false;
    }
    return true;
  });
};

function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

function pick(list, from, dir) {
  var c = center(from), best = null, bestScore = Infinity;
  list.forEach(function (it) {
    var p = center(it.r), dx = p.x - c.x, dy = p.y - c.y, primary, ortho;
    if (dir === 'left') { if (it.r.right > from.left + 4) return; primary = -dx; ortho = Math.abs(dy); }
    if (dir === 'right') { if (it.r.left < from.right - 4) return; primary = dx; ortho = Math.abs(dy); }
    if (dir === 'up') { if (it.r.bottom > from.top + 4) return; primary = -dy; ortho = Math.abs(dx); }
    if (dir === 'down') { if (it.r.top < from.bottom - 4) return; primary = dy; ortho = Math.abs(dx); }
    var score = primary + ortho * 2.5;
    if (score < bestScore) { bestScore = score; best = it; }
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

SpotifyUI.prototype.focusContentStart = function () {
  var list = this.contentTargets();
  if (!list.length) { this.setZone('menu'); return; }
  list.sort(function (a, b) { return (a.r.top - b.r.top) || (a.r.left - b.r.left); });
  this.setContent(list[0].el);
};

SpotifyUI.prototype.setContent = function (e) {
  this.zone = 'content';
  this.contentEl = e;
  var r = e.getBoundingClientRect();
  var top = bandTop(), bottom = bandBottom();
  // teniamo l'elemento lontano dai bordi della fascia, dove le barre lo coprirebbero
  if (r.top < top + innerHeight * 0.04 || r.bottom > bottom - innerHeight * 0.04) {
    var sc = scrollerOf(e, false);
    var delta = (r.top + r.height / 2) - (top + bottom) / 2;
    if (sc) sc.scrollBy({ top: delta, behavior: 'smooth' });
    else e.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (r.left < 0 || r.right > innerWidth) e.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  this.paintFocus();
};

SpotifyUI.prototype.setZone = function (zone) {
  this.zone = zone;
  this.paintFocus();
};

SpotifyUI.prototype.menuList = function () {
  var items = this.menuItems.slice();
  if (this.loginItem.style.display !== 'none') items.push(this.loginItem);
  return items;
};

SpotifyUI.prototype.paintFocus = function () {
  var items = this.menuList();
  this.menuItems.concat([this.loginItem]).forEach(function (m) { m.classList.remove('stv-focus'); });
  this.playerEls.forEach(function (b) { b.classList.remove('stv-focus'); });
  this.menuIndex = Math.min(this.menuIndex, items.length - 1);
  if (this.zone === 'menu') items[this.menuIndex].classList.add('stv-focus');
  if (this.zone === 'player') this.playerEls[this.playerIndex].classList.add('stv-focus');
  this.placeNeedle();
  this.drawRing();
};

// La lancetta sta sotto la voce scelta (accesa) o sotto la pagina aperta (spenta).
SpotifyUI.prototype.placeNeedle = function () {
  var target = this.zone === 'menu' ? this.menuList()[this.menuIndex] :
    this.menuItems.filter(function (m) { return m.classList.contains('stv-active'); })[0];
  if (!target) { this.needle.style.opacity = '0'; return; }
  this.needle.style.opacity = '1';
  this.needle.style.transform = 'translateX(' + target.offsetLeft + 'px) scaleX(' + (target.offsetWidth / 40) + ')';
  this.needle.classList.toggle('stv-lit', this.zone === 'menu');
};

SpotifyUI.prototype.drawRing = function () {
  if (!this.ring) return;
  var e = this.zone === 'content' ? this.contentEl : null;
  if (!e || !document.contains(e) || !this.visible) { this.ring.style.display = 'none'; return; }
  var r = e.getBoundingClientRect();
  this.ring.style.display = 'block';
  this.ring.style.transform = 'translate(' + (r.left - 6) + 'px,' + (r.top - 6) + 'px)';
  this.ring.style.width = (r.width + 12) + 'px';
  this.ring.style.height = (r.height + 12) + 'px';
};

/* ----------------------------------------------------------- telecomando */
SpotifyUI.prototype.move = function (dir) {
  var self = this;
  if (this.zone === 'menu') {
    var items = this.menuList();
    if (dir === 'left') this.menuIndex = Math.max(0, this.menuIndex - 1);
    if (dir === 'right') this.menuIndex = Math.min(items.length - 1, this.menuIndex + 1);
    if (dir === 'down') { this.focusContentStart(); return; }
    this.paintFocus();
    return;
  }
  if (this.zone === 'player') {
    if (dir === 'left') this.playerIndex = Math.max(0, this.playerIndex - 1);
    if (dir === 'right') this.playerIndex = Math.min(this.playerEls.length - 1, this.playerIndex + 1);
    if (dir === 'up') {
      if (this.contentEl && document.contains(this.contentEl) && visibleRect(this.contentEl)) this.setContent(this.contentEl);
      else this.focusContentStart();
      return;
    }
    this.paintFocus();
    return;
  }

  // contenuto
  var cur = this.contentEl;
  if (!cur || !document.contains(cur)) { this.focusContentStart(); return; }
  var others = function () { return self.contentTargets().filter(function (it) { return it.el !== cur; }); };
  var best = pick(others(), cur.getBoundingClientRect(), dir);
  if (best) { this.setContent(best.el); return; }

  // niente nella direzione: scorriamo (riga o pagina) e riproviamo
  var horizontal = dir === 'left' || dir === 'right';
  var sc = scrollerOf(cur, horizontal);
  var before = sc ? (horizontal ? sc.scrollLeft : sc.scrollTop) : 0;
  if (sc) {
    var step = (dir === 'right' || dir === 'down' ? 1 : -1) * (horizontal ? innerWidth * 0.5 : innerHeight * 0.4);
    sc.scrollBy(horizontal ? { left: step, behavior: 'smooth' } : { top: step, behavior: 'smooth' });
  }
  setTimeout(function () {
    var moved = sc && Math.abs((horizontal ? sc.scrollLeft : sc.scrollTop) - before) > 4;
    var again = pick(others(), cur.getBoundingClientRect(), dir);
    if (again) { self.setContent(again.el); return; }
    if (!moved && !horizontal) self.setZone(dir === 'up' ? 'menu' : 'player'); // bordo della pagina
  }, 420);
};

SpotifyUI.prototype.activate = function () {
  if (this.zone === 'menu') {
    var v = this.menuList()[this.menuIndex].getAttribute('data-view');
    if (v === 'login') { player.login(); return; }
    this.openView(v);
    return;
  }
  if (this.zone === 'player') {
    var cmd = this.playerEls[this.playerIndex].getAttribute('data-cmd');
    if (cmd === 'play') commands.togglePlay();
    if (cmd === 'next') commands.next();
    if (cmd === 'prev') commands.prev();
    if (cmd === 'rw') commands.seek(-10);
    if (cmd === 'ff') commands.seek(10);
    return;
  }
  var e = this.contentEl;
  if (!e || !document.contains(e)) return;
  var path = location.pathname;
  player.activate(e);
  var self = this;
  // se l'OK ha aperto un'altra pagina, rimettiamo il focus sul nuovo contenuto
  setTimeout(function () { if (location.pathname !== path) self.afterNavigation(); }, 150);
};

SpotifyUI.prototype.openView = function (id) {
  var view = null;
  for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) view = VIEWS[i];
  if (!view) return;
  this.current = id;
  this.markActive();
  player.navigate(view.path);
  this.afterNavigation(id === 'search');
};

// Dopo un cambio pagina: riga di caricamento, poi focus sul primo elemento.
SpotifyUI.prototype.afterNavigation = function (isSearch) {
  var self = this;
  this.loading.classList.add('stv-on');
  this.contentEl = null;
  var start = Date.now();
  clearInterval(this._navTimer);
  this._navTimer = setInterval(function () {
    if (self.contentTargets().length > 3 || Date.now() - start > 6000) {
      clearInterval(self._navTimer);
      self.loading.classList.remove('stv-on');
      var input = isSearch && document.querySelector('input[data-testid="search-input"], input[role="searchbox"]');
      if (input) { self.setContent(input); return; }
      self.focusContentStart();
    }
  }, 200);
};

SpotifyUI.prototype.markActive = function () {
  var cur = this.current;
  this.menuItems.forEach(function (m) { m.classList.toggle('stv-active', m.getAttribute('data-view') === cur); });
  this.placeNeedle();
};

SpotifyUI.prototype.back = function () {
  var e = this.contentEl;
  if (this.zone === 'content' && e && /^(INPUT|TEXTAREA)$/.test(e.tagName) && document.activeElement === e) {
    e.blur();
    return;
  }
  if (location.pathname !== '/') {
    history.back();
    this.afterNavigation();
    return;
  }
  if (this.zone !== 'menu') { this.setZone('menu'); return; }
  this.toast('Tieni premuto Indietro per uscire');
};

SpotifyUI.prototype.show = function () {
  if (this.root) this.root.style.display = 'block';
  this.visible = true;
};

SpotifyUI.prototype.hide = function () {
  if (this.root) this.root.style.display = 'none';
  this.visible = false;
};

SpotifyUI.prototype.toast = function (msg) {
  if (!this.toastEl) return;
  this.toastEl.textContent = msg;
  this.toastEl.classList.add('stv-show');
  clearTimeout(this._toastTimer);
  var self = this;
  this._toastTimer = setTimeout(function () { self.toastEl.classList.remove('stv-show'); }, 2600);
};

SpotifyUI.prototype.focusPlayer = function () {
  this.playerIndex = 2;
  this.setZone('player');
};

/* --------------------------------------------------------------- avvio */
export function startUi() {
  if (window.__spotifyTvUi) return;
  var ui = new SpotifyUI();
  window.__spotifyTvUi = ui;
  registerUi(ui);

  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    ui.mount();
  }
  mount();
}
