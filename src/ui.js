/* UI televisiva per Spotify ("skin TV"), con i colori e il font di Spotify.
 *
 * Un solo web player. Di Spotify resta visibile solo l'area dei contenuti,
 * fissata fra la nostra barra in alto e il player in basso: tutto il resto è
 * visibility:hidden, così i suoi pannelli non si sovrappongono e non rubano il
 * focus. L'area viene cercata mentre la pagina gira; se non c'è, non si nasconde
 * nulla.
 *
 * Navigazione a tre zone: menu (in alto), contenuto (spaziale fra gli elementi
 * visibili dell'area), player (in basso).
 */
'use strict';

import { on } from './bus.js';
import { st } from './state.js';
import { registerUi, commands } from './registry.js';
import * as player from './player.js';

// Palette e misure condivise da noi e dal tema di Spotify.
// Colori e font di Spotify: l'interfaccia nostra deve sembrare parte dell'app.
var C = {
  black: '#000000',
  base: '#121212',
  elevated: '#1f1f1f',
  highlight: '#2a2a2a',
  text: '#ffffff',
  subdued: '#b3b3b3',
  green: '#1ed760'
};
var FONT = 'var(--encore-body-font-stack, "Helvetica Neue", Helvetica, Arial, sans-serif)';
var TITLE_FONT = 'var(--encore-title-font-stack, "Helvetica Neue", Helvetica, Arial, sans-serif)';
var TOP_H = 11;     // vh
var BOTTOM_H = 15;  // vh

/* Le regole che toccano l'impaginazione di Spotify valgono solo con html.stv-layout,
 * che mettiamo quando abbiamo trovato l'area dei contenuti ([data-stv-view]).
 * Se Spotify cambia struttura e non la troviamo, la pagina resta com'è: mai vuota. */
var CSS = `
html.stv-layout #main { visibility: hidden !important; }
html.stv-layout [data-stv-view] { visibility: visible !important; position: fixed !important; top: ${TOP_H}vh !important;
  bottom: ${BOTTOM_H}vh !important; left: 0 !important; right: 0 !important; width: auto !important; height: auto !important;
  max-width: none !important; z-index: 1; border-radius: 0 !important; }
html.stv-layout #global-nav-bar { position: relative; z-index: 2147483001 !important; }
html.stv-layout #global-nav-bar form[role="search"] { visibility: visible !important; position: fixed !important; top: 2.6vh;
  right: 3vw; width: 28vw !important; max-width: none !important; }
#onetrust-consent-sdk { display: none !important; }
html.stv-layout [data-stv-view] *, html.stv-layout [data-stv-view] *::before, html.stv-layout [data-stv-view] *::after {
  animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }
html.stv-layout [data-stv-view] * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

/* ---------- interfaccia nostra, nello stile di Spotify ---------- */
#stv-root { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; color: ${C.text}; font-family: ${FONT};
  -webkit-font-smoothing: antialiased; }
#stv-root * { box-sizing: border-box; }
.stv-top, .stv-bottom { position: absolute; left: 0; right: 0; pointer-events: auto; }

.stv-top { top: 0; height: ${TOP_H}vh; display: flex; align-items: center; gap: 1vw; padding: 0 3vw; background: transparent; }
.stv-menu { display: flex; gap: .8vw; }
.stv-menu-item { padding: 1.1vh 1.6vw; border-radius: 999px; font-size: 2.3vmin; font-weight: 700; color: ${C.text};
  background: ${C.elevated}; white-space: nowrap; transition: transform .15s, background .15s, color .15s; }
.stv-menu-item.stv-active { background: ${C.text}; color: ${C.black}; }
.stv-menu-item.stv-focus { outline: 3px solid ${C.text}; outline-offset: 3px; transform: scale(1.06); }

.stv-bottom { bottom: 0; height: ${BOTTOM_H}vh; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  column-gap: 2vw; padding: 0 3vw; background: ${C.black}; }
.stv-now { display: flex; align-items: center; gap: 1.4vw; min-width: 0; }
.stv-art { width: 9.5vh; height: 9.5vh; border-radius: 4px; background: ${C.elevated} center/cover no-repeat; flex: 0 0 auto; }
.stv-meta { min-width: 0; }
.stv-meta h2 { margin: 0; font-size: 2.6vmin; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-meta p { margin: .5vh 0 0; font-size: 2.1vmin; color: ${C.subdued}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-tag { display: inline-block; margin-left: .8vw; padding: .2vh .6vw; border-radius: 4px; font-size: 1.6vmin; font-weight: 700;
  background: ${C.highlight}; color: ${C.subdued}; vertical-align: middle; }
.stv-center { display: flex; flex-direction: column; align-items: center; gap: 1.2vh; width: 40vw; }
.stv-controls { display: flex; align-items: center; gap: 1.8vw; }
.stv-btn { width: 6vmin; height: 6vmin; border-radius: 50%; display: grid; place-items: center; transition: transform .15s, background .15s; }
.stv-btn svg { width: 3vmin; height: 3vmin; fill: ${C.subdued}; }
.stv-btn.stv-play { width: 7.4vmin; height: 7.4vmin; background: ${C.text}; }
.stv-btn.stv-play svg { fill: ${C.black}; width: 3.4vmin; height: 3.4vmin; }
.stv-btn.stv-focus { transform: scale(1.12); background: ${C.highlight}; }
.stv-btn.stv-focus svg { fill: ${C.text}; }
.stv-btn.stv-play.stv-focus { background: ${C.green}; }
.stv-btn.stv-play.stv-focus svg { fill: ${C.black}; }
.stv-scale { display: flex; align-items: center; gap: .8vw; width: 100%; font-size: 1.7vmin; color: ${C.subdued};
  font-variant-numeric: tabular-nums; }
.stv-track { position: relative; flex: 1 1 auto; height: 4px; border-radius: 2px; background: #4d4d4d; overflow: hidden; }
.stv-track > i { position: absolute; inset: 0; background: ${C.text}; border-radius: 2px; transform-origin: left center;
  transform: scaleX(0); transition: transform .9s linear; }
.stv-bottom.stv-playing .stv-track > i { background: ${C.green}; }

.stv-ring { position: absolute; left: 0; top: 0; display: none; pointer-events: none; border: 3px solid ${C.text}; border-radius: 8px;
  transition: transform .12s ease-out, width .12s ease-out, height .12s ease-out; }

.stv-loading { position: absolute; top: ${TOP_H}vh; left: 0; right: 0; height: 3px; overflow: hidden; opacity: 0; transition: opacity .2s; }
.stv-loading.stv-on { opacity: 1; }
.stv-loading i { position: absolute; top: 0; left: 0; width: 30%; height: 100%; background: ${C.green};
  animation: stv-scan 1.1s infinite cubic-bezier(.45,0,.55,1); }
@keyframes stv-scan { from { transform: translateX(-100%); } to { transform: translateX(340%); } }

.stv-toast { position: absolute; left: 50%; bottom: calc(${BOTTOM_H}vh + 3vh); transform: translate(-50%, 8px); opacity: 0;
  padding: 1.3vh 2vw; background: ${C.text}; color: ${C.black}; border-radius: 8px; font-size: 2.1vmin; font-weight: 700;
  transition: opacity .2s, transform .2s; white-space: nowrap; }
.stv-toast.stv-show { opacity: 1; transform: translate(-50%, 0); }

.stv-splash { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 4vh; background: ${C.base}; transition: opacity .5s; }
.stv-splash.stv-gone { opacity: 0; }
.stv-splash h1 { margin: 0; font-family: ${TITLE_FONT}; font-size: 7vmin; font-weight: 800; letter-spacing: -0.03em; }
.stv-eq { display: flex; align-items: flex-end; gap: 1vmin; height: 7vmin; }
.stv-eq i { width: 1.4vmin; height: 100%; border-radius: .7vmin; background: ${C.green}; transform-origin: bottom;
  animation: stv-eq 1s infinite ease-in-out; }
.stv-eq i:nth-child(2) { animation-delay: -.3s; } .stv-eq i:nth-child(3) { animation-delay: -.6s; } .stv-eq i:nth-child(4) { animation-delay: -.15s; }
@keyframes stv-eq { 0%,100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
.stv-splash p { margin: 0; font-size: 2.3vmin; color: ${C.subdued}; }

@media (prefers-reduced-motion: reduce) {
  .stv-eq i, .stv-loading i { animation: none; }
  .stv-ring, .stv-track > i { transition: none; }
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
  { id: 'liked', label: 'Brani che ti piacciono', path: '/collection/tracks' }
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
  var style = el('style');
  style.id = 'stv-style';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  var root = el('div');
  root.id = 'stv-root';
  root.innerHTML =
    '<div class="stv-top"><div class="stv-menu"></div></div>' +
    '<div class="stv-loading"><i></i></div>' +
    '<div class="stv-bottom">' +
    '  <div class="stv-now"><div class="stv-art"></div>' +
    '    <div class="stv-meta"><h2>Niente in riproduzione</h2><p>Scegli un brano o una playlist</p></div></div>' +
    '  <div class="stv-center"><div class="stv-controls">' +
    '    <div class="stv-btn" data-cmd="rw">' + RW + '</div>' +
    '    <div class="stv-btn" data-cmd="prev">' + PREV + '</div>' +
    '    <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>' +
    '    <div class="stv-btn" data-cmd="next">' + NEXT + '</div>' +
    '    <div class="stv-btn" data-cmd="ff">' + FF + '</div>' +
    '  </div>' +
    '  <div class="stv-scale"><span class="stv-time">0:00</span><div class="stv-track"><i></i></div><span class="stv-dur">0:00</span></div></div>' +
    '  <div></div>' +
    '</div>' +
    '<div class="stv-ring"></div>' +
    '<div class="stv-toast"></div>' +
    '<div class="stv-splash"><h1>Spotify</h1><div class="stv-eq"><i></i><i></i><i></i><i></i></div>' +
    '  <p class="stv-splash-msg">Avvio di Spotify…</p></div>';
  document.body.appendChild(root);

  this.root = root;
  this.ring = root.querySelector('.stv-ring');
  this.toastEl = root.querySelector('.stv-toast');
  this.loading = root.querySelector('.stv-loading');
  this.splash = root.querySelector('.stv-splash');
  this.splashMsg = root.querySelector('.stv-splash-msg');
  this.art = root.querySelector('.stv-art');
  this.title = root.querySelector('.stv-meta h2');
  this.sub = root.querySelector('.stv-meta p');
  this.timeEl = root.querySelector('.stv-time');
  this.durEl = root.querySelector('.stv-dur');
  this.fill = root.querySelector('.stv-track > i');
  this.playBtn = root.querySelector('[data-cmd="play"]');
  this.bottom = root.querySelector('.stv-bottom');
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

  this.layout();
  setInterval(function () { self.layout(); }, 1000);
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
  on('playing', function (p) {
    self.playBtn.innerHTML = p ? PAUSE : PLAY;
    self.bottom.classList.toggle('stv-playing', !!p);
  });
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
/* L'area dei contenuti di Spotify: di solito #main-view; altrimenti il contenitore
 * più esterno di <main> che ha la sua stessa misura (la cella della griglia). */
function findView() {
  var v = document.getElementById('main-view');
  if (v && v.querySelector('main')) return v;
  var m = document.querySelector('main');
  if (!m) return null;
  var node = m, r = m.getBoundingClientRect();
  while (node.parentElement && node.parentElement !== document.body) {
    var pr = node.parentElement.getBoundingClientRect();
    if (Math.abs(pr.width - r.width) > 2 || Math.abs(pr.height - r.height) > 2) break;
    node = node.parentElement;
  }
  return node;
}

// Controllata di continuo: Spotify ridisegna la pagina (login, cambio pagina).
SpotifyUI.prototype.layout = function () {
  var v = findView();
  var old = document.querySelector('[data-stv-view]');
  if (old && old !== v) old.removeAttribute('data-stv-view');
  if (v) v.setAttribute('data-stv-view', '');
  document.documentElement.classList.toggle('stv-layout', !!v && !this.plain);
  this.view = v;
};

SpotifyUI.prototype.mainEl = function () {
  return this.view || findView();
};

function mainScroller() {
  var v = document.querySelector('[data-stv-view]') || document;
  return v.querySelector('[data-overlayscrollbars-viewport]') || v.querySelector('.main-view-container__scroll-node');
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
  this.drawRing();
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

// Tasto VERDE: mostra Spotify senza la nostra impaginazione (per capire cosa c'è sotto).
SpotifyUI.prototype.togglePlain = function () {
  this.plain = !this.plain;
  this.layout();
  this.toast(this.plain ? 'Impaginazione TV disattivata' : 'Impaginazione TV attivata');
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
