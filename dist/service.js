/* Service file di TizenBrew (gira nel processo Node del servizio, non nella pagina).
 *
 * Due cose che dalla pagina non si possono fare:
 *  1. lo User-Agent HTTP: Spotify blocca lato server i browser con Chrome <= 108
 *     (la TV è Chromium 108), quindi va cambiato a livello di rete con CDP;
 *  2. saltare le pubblicità video, che vivono in un iframe pubblicitario con la
 *     sua state machine: qui le intercettiamo e le interrompiamo.
 *
 * Il file viene caricato da TizenBrew con require() nel servizio: qui dentro ci
 * sono require, process e il modulo tizen. Tutto è racchiuso in un try/catch:
 * se qualcosa non va, il modulo deve comunque funzionare (la pagina ha i suoi
 * hook JS).
 */
'use strict';

module.exports = function spotifyTvService() {
  var UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  var started = false;

  function log() {
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['[spotify-tv service]'].concat(args));
  }

  function once() {
    if (started) return;
    started = true;
    try { require('../dist/service-runtime.js')(); } catch (e) {
      log('impossibile avviare il runtime:', e && e.message);
    }
  }

  try {
    once();
  } catch (e) {
    log('errore:', e && e.message);
  }

  // Esposto per il debug: si può chiamare da console del servizio.
  return { userAgent: UA };
};
