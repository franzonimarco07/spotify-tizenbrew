/* Runtime del service file: connessione CDP al browser della TV.
 *
 * Sul canale CDP:
 *  - Network.setUserAgentOverride su tutte le sessioni: l'header HTTP diventa
 *    Chrome 120, così Spotify non risponde più "browser non supportato";
 *  - Fetch.enable sui target degli iframe: quando compare la richiesta della
 *    state machine di un annuncio video, la intercettiamo e la chiudiamo, così
 *    l'ad non parte e Spotify passa al contenuto successivo.
 */
'use strict';

var UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var PORTS = [9222, 9223, 9333, 8000];

function log() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ['[spotify-tv cdp]'].concat(args));
}

function getJson(url) {
  return new Promise(function (resolve) {
    var mod;
    try { mod = require('http'); } catch (e) { return resolve(null); }
    var req = mod.get(url, function (res) {
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (d) { body += d; });
      res.on('end', function () {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', function () { resolve(null); });
    req.setTimeout(2000, function () { req.destroy(); resolve(null); });
  });
}

function connect(port) {
  var WebSocketImpl;
  try { WebSocketImpl = require('ws'); } catch (e) { return Promise.resolve(null); }

  return new Promise(function (resolve) {
    var ws;
    try {
      ws = new WebSocketImpl('ws://127.0.0.1:' + port + '/devtools/browser');
    } catch (e) { return resolve(null); }
    var timer = setTimeout(function () { try { ws.close(); } catch (e) { } resolve(null); }, 4000);
    ws.on('open', function () { clearTimeout(timer); resolve(ws); });
    ws.on('error', function () { clearTimeout(timer); resolve(null); });
  });
}

function Cdp(ws) {
  this.ws = ws;
  this.id = 0;
  this.pending = {};
  this.handlers = [];
  var self = this;
  ws.on('message', function (raw) {
    var msg;
    try { msg = JSON.parse(String(raw)); } catch (e) { return; }
    if (msg.id && self.pending[msg.id]) {
      var p = self.pending[msg.id];
      delete self.pending[msg.id];
      p(msg);
      return;
    }
    self.handlers.forEach(function (h) {
      try { h(msg); } catch (e) { }
    });
  });
}

Cdp.prototype.send = function (method, params, sessionId) {
  var self = this;
  var id = ++this.id;
  return new Promise(function (resolve) {
    self.pending[id] = resolve;
    var payload = { id: id, method: method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    try { self.ws.send(JSON.stringify(payload)); } catch (e) { delete self.pending[id]; resolve(null); }
    setTimeout(function () {
      if (self.pending[id]) { delete self.pending[id]; resolve(null); }
    }, 6000);
  });
};

Cdp.prototype.on = function (fn) { this.handlers.push(fn); };

function setup(cdp) {
  var sessions = 0;

  cdp.on(function (msg) {
    // Nuova sessione (pagina o iframe): UA desktop ovunque.
    if (msg.method === 'Target.attachedToTarget' && msg.params) {
      var sid = msg.params.sessionId;
      sessions++;
      cdp.send('Runtime.enable', {}, sid);
      cdp.send('Network.setUserAgentOverride', {
        userAgent: UA,
        acceptLanguage: 'it-IT,it;q=0.9,en;q=0.8',
        platform: 'Linux x86_64'
      }, sid);
      cdp.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*track-playback*', requestStage: 'Request' },
          { urlPattern: '*adstudio*', requestStage: 'Request' },
          { urlPattern: '*mp3-ad*', requestStage: 'Request' }
        ]
      }, sid);
      if (sessions === 1) log('sessione CDP agganciata, UA desktop impostato');
    }

    // Richieste pubblicitarie: la state machine dell'ad viene chiusa a vuoto,
    // così il player non riceve mai il brano pubblicitario.
    if (msg.method === 'Fetch.requestPaused' && msg.params) {
      var url = msg.params.request && msg.params.request.url || '';
      var isState = url.indexOf('track-playback') !== -1;
      var isAdMedia = /mp3-ad|adstudio/i.test(url);
      if (isState || isAdMedia) {
        log('annuncio intercettato: ' + url.split('?')[0]);
        cdp.send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'BlockedByClient' }, msg.sessionId);
      } else {
        cdp.send('Fetch.continueRequest', { requestId: msg.params.requestId }, msg.sessionId);
      }
    }

    if (msg.method === 'Target.detachedFromTarget') sessions = Math.max(0, sessions - 1);
  });

  cdp.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true
  });
}

function discoverPort() {
  var i = 0;
  function attempt() {
    if (i >= PORTS.length) return Promise.resolve(null);
    var port = PORTS[i++];
    return getJson('http://127.0.0.1:' + port + '/json/version').then(function (info) {
      if (info && info.webSocketDebuggerUrl) return { port: port, info: info };
      return attempt();
    });
  }
  return attempt();
}

function start() {
  discoverPort().then(function (found) {
    if (!found) {
      log('nessun endpoint CDP trovato, riprovo fra 5s');
      return setTimeout(start, 5000);
    }
    log('endpoint CDP su porta ' + found.port);
    connect(found.port).then(function (ws) {
      if (!ws) {
        log('connessione CDP fallita, riprovo');
        return setTimeout(start, 5000);
      }
      var cdp = new Cdp(ws);
      setup(cdp);
      ws.on('close', function () {
        log('connessione CDP chiusa, riconnetto');
        setTimeout(start, 3000);
      });
    });
  }).catch(function (e) { log('errore: ' + (e && e.message)); });
}

module.exports = start;
