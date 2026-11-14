// Test del motore no-ads: carica il bundle in un DOM finto (node:vm) e verifica
// che una state machine con un annuncio in mezzo venga riscritta senza ad.
// Uso: node tools/test-statemachine.mjs   (prima: npm run build)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../dist/userScript.js', import.meta.url), 'utf8');

function fakeEl() {
  return {
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, getBoundingClientRect() {
      return { left: 0, top: 0, width: 10, height: 10 };
    }
  };
}

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
  Promise, Map, Set, WeakMap, Object, Array, JSON, Date, Math, isFinite, String, Number, Error, RegExp,
  requestAnimationFrame: () => 0,
  Headers: class { constructor() {} get() {} delete() {} },
  Response: class { constructor(b) { this.body = b; } },
  MessageEvent: class { constructor(t, o) { Object.assign(this, o || {}); this.type = t; } },
  KeyboardEvent: class { constructor(t, o) { Object.assign(this, o || {}); this.type = t; } },
  MouseEvent: class { constructor(t, o) { Object.assign(this, o || {}); this.type = t; } },
  Event: class { constructor(t) { this.type = t; } },
  XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; this.setRequestHeader = () => {}; },
  HTMLMediaElement: { prototype: {} },
  Navigator: class {},
  fetch: () => Promise.resolve(),
  location: { href: 'https://open.spotify.com/', origin: 'https://open.spotify.com', hash: '' },
  history: { length: 1, back() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
  document: {
    readyState: 'loading',
    addEventListener() {},
    createElement: () => fakeEl(),
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild() {} },
    documentElement: fakeEl(),
    body: null
  }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.top = sandbox;
sandbox.globalThis = sandbox;
sandbox.WebSocket = function () { this.addEventListener = () => {}; };
sandbox.WebSocket.prototype = {};

const ctx = vm.createContext(sandbox);
vm.runInContext(src, ctx);

const api = sandbox.window.__spotifyTv;
if (!api) throw new Error('il bundle non ha esposto window.__spotifyTv');

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok   ' + name);
  else { console.log('  FAIL ' + name); failures++; }
}

function machine(uris) {
  const tracks = uris.map((u, i) => ({
    metadata: { uri: u, name: 'T' + i, duration: 200000 }
  }));
  const states = uris.map((u, i) => ({
    state_id: 's' + i,
    track: i,
    transitions: { advance: { state_index: (i + 1) % uris.length } }
  }));
  return { tracks, states };
}

console.log('versione ' + api.version);
console.log('1. ad in mezzo alla coda');
{
  const sm = machine(['spotify:track:a', 'spotify:ad:1', 'spotify:track:b']);
  const out = api.noads.manipulateForTest(sm, 0);
  const uris = out.states.map(s => (out.tracks[s.track] || { metadata: {} }).metadata.uri);
  check('nessuno stato punta più all\'ad', uris.every(u => String(u).indexOf(':ad:') === -1));
  check('lo stato 1 ora è il brano b', uris[1] === 'spotify:track:b');
  check('la tabella dei brani non contiene più l\'ad', out.tracks.every(t => !t || String(t.metadata.uri).indexOf(':ad:') === -1));
}

console.log('2. ad in fondo alla coda (nessuno stato successivo)');
{
  const sm = machine(['spotify:track:a', 'spotify:ad:9']);
  const out = api.noads.manipulateForTest(sm, 0);
  const uris = out.states.map(s => (out.tracks[s.track] || { metadata: {} }).metadata.uri);
  check('l\'ad non è più nella coda', uris.every(u => String(u).indexOf(':ad:') === -1));
  check('lo stato dell\'ad è stato accorciato a fine brano',
    out.states[1].initial_playback_position > 0 || out.states[1].state_id === 's0');
}

console.log('3. nessun ad: la state machine resta intatta');
{
  const sm = machine(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']);
  const before = JSON.stringify(sm.states);
  const out = api.noads.manipulateForTest(sm, 0);
  check('gli stati non cambiano', JSON.stringify(out.states) === before);
}

console.log('4. la UI si monta nel documento principale');
{
  // Il sandbox ha document.body: la UI deve costruirsi senza errori.
  sandbox.document.body = fakeEl();
  const ui = sandbox.window.__spotifyTvUi;
  check('window.__spotifyTvUi esiste', !!ui);
  check('la vista iniziale è la home (hero)', !!ui && ui.current === 'home');
  check('nessun iframe creato all\'avvio', !!ui && ui.frameMounted === false);
  // Il DOM finto non costruisce i figli: per provare la navigazione usiamo
  // una versione minima dell'oggetto, con le zone come le calcola zonesOf().
  if (ui) {
    ui.menuItems = [fakeEl(), fakeEl(), fakeEl()];
    ui.brand = fakeEl();
    ui.playerEls = [fakeEl(), fakeEl(), fakeEl()];
    ui.hero = { style: {}, querySelectorAll: () => [fakeEl(), fakeEl(), fakeEl()] };
    ui.focusedEl = null;
    ui.ring = null;
    ui.views = {};
    ui.frameMounted = false;
    ui.current = 'home';
    const zones = ui.zonesOf();
    check('zona 0 = menu, zona 1 = riquadri, zona 2 = player', zones.length === 3);
    ui.move('down');
    check('il primo "giù" porta sui riquadri', ui.zoneIndex === 1);
    ui.move('right');
    check('"destra" resta nei riquadri', ui.zoneIndex === 1 && ui.itemIndex === 1);
    ui.back();
    check('"indietro" riporta al menu', ui.zoneIndex === 0);
  }
}

console.log('5. comandi del player disponibili');
{
  const c = api.commands || {};
  check('togglePlay esiste', typeof c.togglePlay === 'function');
  check('next/prev esistono', typeof c.next === 'function' && typeof c.prev === 'function');
  check('seek esiste', typeof c.seek === 'function');
}

if (failures) { console.log('\n' + failures + ' test falliti'); process.exit(1); }
console.log('\ntutti i test passati');
// il modulo installa timer (polling DOM): chiudiamo qui, non serve altro.
process.exit(0);
