/* Finto player di Spotify per l'anteprima della UI (tools/preview/index.html).
 * Ricrea gli elementi che il modulo usa davvero: i data-testid dei controlli,
 * la barra di avanzamento, il volume, il titolo del brano. Così i tasti
 * play/next/seek dell'anteprima fanno qualcosa di visibile.
 */
(function () {
  'use strict';
  var state = { playing: false, t: 0, d: 214, vol: 0.8, track: 0 };
  var TRACKS = [
    ['Midnight City', 'M83', 'Hurry Up, We\'re Dreaming'],
    ['Time', 'Pink Floyd', 'The Dark Side of the Moon'],
    ['Everything In Its Right Place', 'Radiohead', 'Kid A']
  ];

  var style = document.createElement('style');
  style.textContent =
    'body{margin:0;background:#121212;color:#fff;font-family:system-ui,sans-serif;overflow:hidden}' +
    '.fk-top{display:flex;gap:22px;padding:16px 24px;background:#000;font-weight:600;color:#b3b3b3}' +
    '.fk-top b{color:#1ed760}' +
    '.fk-main{padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px}' +
    '.fk-card{background:#181818;border-radius:10px;padding:14px;font-size:14px}' +
    '.fk-card i{display:block;height:120px;border-radius:8px;margin-bottom:10px;background:linear-gradient(135deg,#2b2b2b,#4a4a4a)}' +
    '.fk-now{position:fixed;left:0;right:0;bottom:0;height:80px;background:#181818;display:flex;align-items:center;gap:14px;padding:0 20px}' +
    '.fk-now button{border:0;border-radius:50%;width:38px;height:38px;background:#222;color:#fff;cursor:pointer}' +
    '[data-testid="control-button-playpause"]{background:#fff!important;color:#000!important;width:44px!important;height:44px!important}' +
    '.fk-bar{height:6px;background:#3a3a3a;border-radius:99px;flex:1;position:relative}' +
    '.fk-bar i{position:absolute;inset:0 auto 0 0;background:#1ed760;border-radius:99px;width:0}' +
    '.fk-vol{width:90px;height:6px;background:#3a3a3a;border-radius:99px;position:relative}' +
    '.fk-vol i{position:absolute;inset:0 auto 0 0;background:#fff;border-radius:99px;width:80%}';
  document.head.appendChild(style);

  document.body.innerHTML =
    '<div class="fk-top"><b>Spotify</b><span>Home</span><span>Cerca</span><span>La tua raccolta</span></div>' +
    '<div class="fk-main">' +
    '<div class="fk-card"><i></i>Titolo playlist</div><div class="fk-card"><i></i>Album in evidenza</div>' +
    '<div class="fk-card"><i></i>Artista del mese</div><div class="fk-card"><i></i>Mix del venerdì</div>' +
    '<div class="fk-card"><i></i>Nuovi brani</div><div class="fk-card"><i></i>Riscopri</div>' +
    '</div>' +
    '<div class="fk-now">' +
    '<div data-testid="cover-art-image" style="width:52px;height:52px;border-radius:6px;background:linear-gradient(135deg,#3d3d3d,#6a6a6a)"></div>' +
    '<div style="width:190px">' +
    '  <div data-testid="context-item-info-title" style="font-size:14px">Midnight City</div>' +
    '  <div data-testid="context-item-info-artist" style="font-size:12px;color:#a7a7a7">M83</div>' +
    '</div>' +
    '<button data-testid="control-button-skip-back">⏮</button>' +
    '<button data-testid="control-button-playpause" aria-label="Play">▶</button>' +
    '<button data-testid="control-button-skip-forward">⏭</button>' +
    '<span style="font-size:12px;color:#a7a7a7" class="fk-t">0:00</span>' +
    '<div data-testid="playback-progressbar" class="fk-bar"><i></i></div>' +
    '<span style="font-size:12px;color:#a7a7a7" class="fk-d">3:34</span>' +
    '<div data-testid="volume-bar" class="fk-vol"><i></i></div>' +
    '</div>';

  var btn = document.querySelector('[data-testid="control-button-playpause"]');
  var bar = document.querySelector('.fk-bar i');
  var tEl = document.querySelector('.fk-t');
  var dEl = document.querySelector('.fk-d');
  var titleEl = document.querySelector('[data-testid="context-item-info-title"]');
  var artistEl = document.querySelector('[data-testid="context-item-info-artist"]');
  var volBar = document.querySelector('.fk-vol i');

  function fmt(s) { var m = Math.floor(s / 60); var r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

  function render() {
    btn.innerHTML = state.playing ? '❚❚' : '▶';
    btn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    bar.style.width = (state.t / state.d * 100) + '%';
    tEl.textContent = fmt(state.t);
    dEl.textContent = fmt(state.d);
    var tr = TRACKS[state.track % TRACKS.length];
    titleEl.textContent = tr[0];
    artistEl.textContent = tr[1];
    volBar.style.width = (state.vol * 100) + '%';
  }

  btn.addEventListener('click', function () { state.playing = !state.playing; render(); });
  document.querySelector('[data-testid="control-button-skip-forward"]').addEventListener('click', function () {
    state.track++; state.t = 0; render();
  });
  document.querySelector('[data-testid="control-button-skip-back"]').addEventListener('click', function () {
    state.track = Math.max(0, state.track - 1); state.t = 0; render();
  });
  document.querySelector('[data-testid="playback-progressbar"]').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    state.t = Math.max(0, Math.min(state.d, (e.clientX - r.left) / r.width * state.d));
    render();
  });
  document.querySelector('[data-testid="volume-bar"]').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    state.vol = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    render();
  });

  setInterval(function () {
    if (!state.playing) return;
    state.t += 1;
    if (state.t >= state.d) { state.track++; state.t = 0; }
    render();
  }, 1000);

  render();
})();
