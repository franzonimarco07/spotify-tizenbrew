/* Navigazione minima per le pagine fuori dal player (login su accounts.spotify.com):
 * frecce fra campi e bottoni, OK per scegliere, Indietro per tornare.
 * Niente UI nostra: solo un anello verde che segue l'elemento scelto. */
'use strict';

var TARGETS = 'input:not([type="hidden"]), button:not([disabled]), a[href], select, [role="button"], [role="checkbox"]';

function rectOf(e) {
  var r = e.getBoundingClientRect();
  if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) return null;
  var cs = getComputedStyle(e);
  if (cs.visibility === 'hidden' || cs.display === 'none') return null;
  return r;
}

function isText(e) {
  return e && (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !/^(button|checkbox|radio|submit)$/.test(e.type)));
}

export function startBasicNav() {
  var cur = null, ring = null;

  function draw() {
    if (!document.body) return requestAnimationFrame(draw);
    if (!ring) {
      ring = document.createElement('div');
      ring.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #1ed760;' +
        'border-radius:10px;box-shadow:0 0 22px rgba(30,215,96,.6);display:none;transition:all .12s';
      document.body.appendChild(ring);
    }
    var r = cur && document.contains(cur) ? cur.getBoundingClientRect() : null;
    ring.style.display = r ? 'block' : 'none';
    if (r) {
      ring.style.left = (r.left - 5) + 'px'; ring.style.top = (r.top - 5) + 'px';
      ring.style.width = (r.width + 10) + 'px'; ring.style.height = (r.height + 10) + 'px';
    }
    requestAnimationFrame(draw);
  }
  draw();

  function targets() {
    var out = [];
    document.querySelectorAll(TARGETS).forEach(function (e) {
      var r = rectOf(e);
      if (r) out.push({ el: e, r: r });
    });
    return out;
  }

  function go(e) {
    cur = e;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (isText(e)) e.focus();
  }

  function move(dir) {
    var list = targets();
    if (!list.length) return;
    if (!cur || !document.contains(cur)) { go(list[0].el); return; }
    var f = cur.getBoundingClientRect(), cx = f.left + f.width / 2, cy = f.top + f.height / 2;
    var best = null, bestScore = Infinity;
    list.forEach(function (it) {
      if (it.el === cur) return;
      var px = it.r.left + it.r.width / 2, py = it.r.top + it.r.height / 2, primary, ortho;
      if (dir === 'up') { if (py >= cy - 4) return; primary = cy - py; ortho = Math.abs(px - cx); }
      if (dir === 'down') { if (py <= cy + 4) return; primary = py - cy; ortho = Math.abs(px - cx); }
      if (dir === 'left') { if (px >= cx - 4) return; primary = cx - px; ortho = Math.abs(py - cy); }
      if (dir === 'right') { if (px <= cx + 4) return; primary = px - cx; ortho = Math.abs(py - cy); }
      var s = primary + ortho * 2.5;
      if (s < bestScore) { bestScore = s; best = it.el; }
    });
    if (best) go(best);
  }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode, handled = true;
    var typing = isText(document.activeElement);
    if (k === 37 && !typing) move('left');
    else if (k === 39 && !typing) move('right');
    else if (k === 38) { if (typing) document.activeElement.blur(); move('up'); }
    else if (k === 40) { if (typing) document.activeElement.blur(); move('down'); }
    else if (k === 13 && cur && !typing) { if (isText(cur)) cur.focus(); else cur.click(); }
    else if (k === 10009) { if (typing) document.activeElement.blur(); else history.back(); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}
