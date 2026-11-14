/* UI televisiva per Spotify ("skin TV").
 *
 * Un solo web player: la pagina di Spotify resta visibile al centro, ripulita
 * e alleggerita con CSS. Sopra ci sono solo tre cose nostre:
 *   - una barra in alto con i menu (Home, Cerca, La tua raccolta);
 *   - il player in basso, sempre visibile;
 *   - l'anello di focus, la schermata di avvio e i toast.
 *
 * Navigazione a tre zone: menu (in alto), contenuto (navigazione spaziale fra
 * gli elementi visibili della pagina), player (in basso). Niente iframe: ogni
 * copia del web player costa memoria e si contende l'audio con le altre.
 */
'use strict';

import { on } from './bus.js';
import { st } from './state.js';
import { registerUi, commands } from './registry.js';
import * as player from './player.js';

var CSS = `
/* ---------- alleggerimento della pagina di Spotify ---------- */
html, body { background: #000 !important; }
#main *, #main *::before, #main *::after { animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important; }
#main * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
/* barre di Spotify che sulla TV non servono: le sostituiamo con le nostre */
#Desktop_LeftSidebar_Id, [data-testid="left-sidebar"], .Root__nav-bar,
.Root__right-sidebar, [data-testid="right-sidebar"],
[data-testid="topbar-content-wrapper"], .Root__top-bar, #onetrust-consent-sdk { display: none !important; }
/* della barra in alto di Spotify teniamo solo la ricerca, spostata nella nostra barra */
#global-nav-bar { visibility: hidden !important; position: relative; z-index: 2147483001 !important; }
#global-nav-bar form[role="search"] { visibility: visible !important; position: fixed !important; top: 2.4vh; right: 3vw;
  width: 30vw !important; max-width: none !important; }
#global-nav-bar form[role="search"] input { font-size: 2.2vmin !important; }
/* il player di Spotify resta nel DOM (lo comandiamo da lì) ma sotto il nostro */
[data-testid="now-playing-bar"], .Root__now-playing-bar { opacity: 0 !important; }
/* testi più grandi: si legge dal divano */
#main h1 { font-size: 5vmin !important; }
#main h2 { font-size: 3.4vmin !important; }

/* ---------- interfaccia nostra ---------- */
#stv-root { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; color: #fff;
  font-family: "Samsung Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
#stv-root * { box-sizing: border-box; }
.stv-top, .stv-bottom { pointer-events: auto; position: absolute; left: 0; right: 0; }

.stv-top { top: 0; height: 10vh; display: flex; align-items: center; gap: 1.4vw; padding: 0 3vw;
  background: linear-gradient(180deg, rgba(0,0,0,.95) 0%, rgba(0,0,0,.75) 65%, rgba(0,0,0,0) 100%); }
.stv-brand { font-weight: 800; letter-spacing: .08em; font-size: 2.4vmin; color: #1ed760; text-transform: uppercase; margin-right: 1.5vw; }
.stv-menu { display: flex; gap: 1.2vw; }
.stv-menu-item { padding: 1vh 1.4vw; border-radius: 999px; font-size: 2.5vmin; font-weight: 700; color: #b3b3b3; white-space: nowrap;
  transition: color .15s, background .15s, transform .15s; }
.stv-menu-item.stv-active { color: #fff; }
.stv-menu-item.stv-focus { color: #000; background: #fff; transform: scale(1.05); }

.stv-bottom { bottom: 0; height: 15vh; display: flex; align-items: center; gap: 1.6vw; padding: 0 3vw;
  background: linear-gradient(0deg, #000 30%, rgba(8,8,8,.97) 100%); border-top: 1px solid rgba(255,255,255,.08); }
.stv-art { width: 10vh; height: 10vh; border-radius: 8px; background: #1a1a1a center/cover no-repeat; flex: 0 0 auto;
  box-shadow: 0 6px 20px rgba(0,0,0,.6); }
.stv-art.stv-pulse { animation: stv-pulse 2.6s infinite ease-in-out; }
@keyframes stv-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.stv-meta { min-width: 0; flex: 1 1 auto; }
.stv-meta h2 { margin: 0; font-size: 3vmin; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-meta p { margin: .5vh 0 0; font-size: 2.3vmin; color: #b3b3b3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stv-tag { display: inline-block; margin-left: .8vw; padding: .2vh .6vw; border-radius: 6px; font-size: 1.8vmin;
  background: #ffd24d; color: #000; font-weight: 700; vertical-align: middle; }
.stv-progress { display: flex; align-items: center; gap: .8vw; margin-top: 1.2vh; font-size: 2vmin; color: #b3b3b3; }
.stv-bar { flex: 1 1 auto; height: 5px; border-radius: 999px; background: rgba(255,255,255,.18); overflow: hidden; }
.stv-bar > i { display: block; height: 100%; width: 0%; background: #1ed760; transition: width .5s linear; }
.stv-controls { display: flex; align-items: center; gap: .8vw; flex: 0 0 auto; }
.stv-btn { width: 7vmin; height: 7vmin; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.08);
  transition: background .15s, transform .15s; }
.stv-btn svg { width: 3.4vmin; height: 3.4vmin; fill: #fff; }
.stv-btn.stv-play { width: 9.4vmin; height: 9.4vmin; background: #fff; }
.stv-btn.stv-play svg { fill: #000; width: 4.2vmin; height: 4.2vmin; }
.stv-btn.stv-focus { background: #1ed760; transform: scale(1.1); }
.stv-btn.stv-focus svg { fill: #000; }

.stv-ring { position: absolute; display: none; pointer-events: none; border: 4px solid #1ed760; border-radius: 12px;
  box-shadow: 0 0 0 3px rgba(0,0,0,.6), 0 0 26px rgba(30,215,96,.6);
  transition: left .14s ease-out, top .14s ease-out, width .14s ease-out, height .14s ease-out; }

.stv-toast { position: absolute; left: 50%; bottom: 18vh; transform: translateX(-50%) translateY(10px); opacity: 0;
  background: rgba(24,24,24,.97); border: 1px solid rgba(255,255,255,.14); padding: 1.2vh 2vw; border-radius: 999px;
  font-size: 2.2vmin; transition: opacity .2s, transform .2s; }
.stv-toast.stv-show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ---------- schermata di avvio ---------- */
.stv-splash { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 4vh; background: radial-gradient(110% 80% at 50% 30%, #12301f 0%, #050505 60%, #000 100%);
  transition: opacity .5s; }
.stv-splash.stv-gone { opacity: 0; pointer-events: none; }
.stv-eq { display: flex; align-items: flex-end; gap: 1.2vmin; height: 12vmin; }
.stv-eq i { display: block; width: 2.2vmin; height: 100%; border-radius: 1vmin; background: #1ed760; transform-origin: bottom;
  animation: stv-eq 1s infinite ease-in-out; }
.stv-eq i:nth-child(2) { animation-delay: -.25s; } .stv-eq i:nth-child(3) { animation-delay: -.5s; }
.stv-eq i:nth-child(4) { animation-delay: -.75s; } .stv-eq i:nth-child(5) { animation-delay: -.4s; }
@keyframes stv-eq { 0%,100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
.stv-splash h1 { margin: 0; font-size: 5vmin; font-weight: 800; }
.stv-splash p { margin: 0; font-size: 2.4vmin; color: #9a9a9a; }
.stv-load { width: 26vw; height: 4px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
.stv-load i { display: block; height: 100%; width: 0%; background: #1ed760; transition: width .6s ease-out; }

/* velo durante il cambio pagina: copre il "salto" della pagina di Spotify */
.stv-veil { position: absolute; left: 0; right: 0; top: 10vh; bottom: 15vh; pointer-events: none; opacity: 0;
  background: #000; transition: opacity .18s; display: flex; align-items: center; justify-content: center; }
.stv-veil.stv-on { opacity: .85; }
.stv-veil .stv-eq { height: 7vmin; }
.stv-veil .stv-eq i { width: 1.4vmin; }
`;

var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
var PREV = '<svg viewBox="0 0 24 24"><path d="M7 6h2v12H7zM20 6v12l-9-6z"/></svg>';
var NEXT = '<svg viewBox="0 0 24 24"><path d="M15 6h2v12h-2zM4 6l9 6-9 6z"/></svg>';
var RW = '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
var FF = '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>';
var EQ = '<div class="stv-eq"><i></i><i></i><i></i><i></i><i></i></div>';

var VIEWS = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'search', label: 'Cerca', path: '/search' },
  { id: 'library', label: 'Brani che ti piacciono', path: '/collection/tracks' }
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
    '<div class="stv-top"><div class="stv-brand">Spotify TV</div><div class="stv-menu"></div></div>' +
    '<div class="stv-veil">' + EQ + '</div>' +
    '<div class="stv-bottom">' +
    '  <div class="stv-art"></div>' +
    '  <div class="stv-meta"><h2>Nessun brano</h2><p>Scegli qualcosa da ascoltare</p>' +
    '    <div class="stv-progress"><span class="stv-time">0:00</span><div class="stv-bar"><i></i></div><span class="stv-dur">0:00</span></div>' +
    '  </div>' +
    '  <div class="stv-controls">' +
    '    <div class="stv-btn" data-cmd="rw">' + RW + '</div>' +
    '    <div class="stv-btn" data-cmd="prev">' + PREV + '</div>' +
    '    <div class="stv-btn stv-play" data-cmd="play">' + PLAY + '</div>' +
    '    <div class="stv-btn" data-cmd="next">' + NEXT + '</div>' +
    '    <div class="stv-btn" data-cmd="ff">' + FF + '</div>' +
    '  </div>' +
    '</div>' +
    '<div class="stv-ring"></div>' +
    '<div class="stv-toast"></div>' +
    '<div class="stv-splash">' + EQ + '<h1>Spotify TV</h1><p class="stv-splash-msg">Avvio del player…</p>' +
    '  <div class="stv-load"><i></i></div></div>';
  document.body.appendChild(root);

  this.root = root;
  this.ring = root.querySelector('.stv-ring');
  this.toastEl = root.querySelector('.stv-toast');
  this.veil = root.querySelector('.stv-veil');
  this.splash = root.querySelector('.stv-splash');
  this.splashMsg = root.querySelector('.stv-splash-msg');
  this.splashBar = root.querySelector('.stv-load i');
  this.art = root.querySelector('.stv-art');
  this.title = root.querySelector('.stv-meta h2');
  this.sub = root.querySelector('.stv-meta p');
  this.timeEl = root.querySelector('.stv-time');
  this.durEl = root.querySelector('.stv-dur');
  this.fill = root.querySelector('.stv-bar > i');
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
    self.splashBar.style.width = Math.min(92, 10 + elapsed / 250) + '%';
    var items = self.contentTargets().length;
    var loggedOut = !!document.querySelector('[data-testid="login-button"]');
    if (elapsed > 5000) self.splashMsg.textContent = 'Spotify è un po\' lento sulla TV, ancora un attimo…';
    if (items > 6 || elapsed > 30000) {
      clearInterval(timer);
      self.splashBar.style.width = '100%';
      self.loginItem.style.display = loggedOut ? '' : 'none';
      setTimeout(function () {
        self.splash.classList.add('stv-gone');
        self.focusContentStart();
        if (loggedOut) self.toast('Non hai fatto l\'accesso: vai su «Accedi» in alto');
      }, 350);
    }
  }, 250);
};

SpotifyUI.prototype.bindState = function () {
  var self = this;
  on('track', function (t) {
    self.title.textContent = t && t.name ? t.name : 'Nessun brano';
    self.sub.textContent = t && t.artists ? t.artists : 'Scegli qualcosa da ascoltare';
    self.art.style.backgroundImage = t && t.art ? 'url("' + t.art + '")' : '';
    if (st.ad) self.title.appendChild(el('span', 'stv-tag', 'Pubblicità'));
  });
  on('playing', function (p) {
    self.playBtn.innerHTML = p ? PAUSE : PLAY;
    self.art.classList.toggle('stv-pulse', !!p);
  });
  on('position', function (pos) {
    var d = st.duration || 0;
    self.timeEl.textContent = fmt(pos);
    self.durEl.textContent = fmt(d);
    self.fill.style.width = d > 0 ? Math.min(100, (pos / d) * 100) + '%' : '0%';
  });
  on('ad', function (isAd) {
    var tag = self.title.querySelector('.stv-tag');
    if (isAd && !tag) self.title.appendChild(el('span', 'stv-tag', 'Pubblicità'));
    if (!isAd && tag) tag.parentNode.removeChild(tag);
  });
};

/* ------------------------------------------------------- pagina Spotify */
SpotifyUI.prototype.mainEl = function () {
  return document.querySelector('main') || document.querySelector('.Root__main-view') ||
    document.querySelector('[data-testid="main-view"]');
};

function visibleRect(e) {
  var r = e.getBoundingClientRect();
  if (r.width < 12 || r.height < 12) return null;
  // la fascia utile è fra la nostra barra in alto e il player in basso
  if (r.bottom < innerHeight * 0.10 || r.top > innerHeight * 0.85 || r.right < 0 || r.left > innerWidth) return null;
  return r;
}

// Il centro dell'elemento deve essere davvero suo: esclude ciò che è coperto.
function reachable(e, r) {
  var x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
  var y = Math.min(Math.max(r.top + r.height / 2, innerHeight * 0.11), innerHeight * 0.84);
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
  return null;
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
  // teniamo l'elemento nella fascia centrale, lontano dalle nostre barre
  if (r.top < innerHeight * 0.14 || r.bottom > innerHeight * 0.80) {
    var sc = scrollerOf(e, false);
    if (sc) sc.scrollBy({ top: (r.top + r.height / 2) - innerHeight * 0.47, behavior: 'smooth' });
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
  this.menuItems.concat([this.loginItem]).forEach(function (m) { m.classList.remove('stv-focus'); });
  this.playerEls.forEach(function (b) { b.classList.remove('stv-focus'); });
  if (this.zone === 'menu') {
    var items = this.menuList();
    this.menuIndex = Math.min(this.menuIndex, items.length - 1);
    items[this.menuIndex].classList.add('stv-focus');
  }
  if (this.zone === 'player') this.playerEls[this.playerIndex].classList.add('stv-focus');
  this.drawRing();
};

SpotifyUI.prototype.drawRing = function () {
  if (!this.ring) return;
  var e = this.zone === 'content' ? this.contentEl : null;
  if (!e || !document.contains(e) || !this.visible) { this.ring.style.display = 'none'; return; }
  var r = e.getBoundingClientRect();
  this.ring.style.display = 'block';
  this.ring.style.left = (r.left - 6) + 'px';
  this.ring.style.top = (r.top - 6) + 'px';
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
    var step = (dir === 'right' || dir === 'down' ? 1 : -1) * (horizontal ? innerWidth * 0.5 : innerHeight * 0.45);
    sc.scrollBy(horizontal ? { left: step, behavior: 'smooth' } : { top: step, behavior: 'smooth' });
  }
  setTimeout(function () {
    var moved = sc && Math.abs((horizontal ? sc.scrollLeft : sc.scrollTop) - before) > 4;
    var again = pick(others(), cur.getBoundingClientRect(), dir);
    if (again) { self.setContent(again.el); return; }
    if (!moved && !horizontal) {
      // bordo della pagina: si passa alle barre
      self.setZone(dir === 'up' ? 'menu' : 'player');
    }
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

// Dopo un cambio pagina: velo con animazione, poi focus sul primo elemento.
SpotifyUI.prototype.afterNavigation = function (isSearch) {
  var self = this;
  this.veil.classList.add('stv-on');
  this.contentEl = null;
  var start = Date.now();
  clearInterval(this._navTimer);
  this._navTimer = setInterval(function () {
    if (self.contentTargets().length > 3 || Date.now() - start > 6000) {
      clearInterval(self._navTimer);
      self.veil.classList.remove('stv-on');
      var input = isSearch && document.querySelector('input[data-testid="search-input"], main input, input[role="searchbox"]');
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
  this._toastTimer = setTimeout(function () { self.toastEl.classList.remove('stv-show'); }, 2200);
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
