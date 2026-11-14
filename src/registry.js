/* Registro dei comandi della UI.
 * L'iniezione di TizenBrew gira in un execution context diverso da quello
 * della pagina: la UI (nella pagina) si registra qui, e il codice iniettato
 * la chiama. Se la UI non c'è, i comandi ripiegano sui bottoni di Spotify. */
'use strict';

import * as player from './player.js';

export var ui = null;

export function registerUi(api) {
  ui = api;
}

export function call(name, arg) {
  if (ui && typeof ui[name] === 'function') {
    try { return ui[name](arg); } catch (e) { console.warn('[spotify-tv] ui.' + name, e); }
  }
  return null;
}

export function show() { return call('show'); }
export function hide() { return call('hide'); }
export function toast(msg) { return call('toast', msg); }
export function focusPlayer() { return call('focusPlayer'); }

export var commands = {
  togglePlay: player.togglePlay,
  next: player.next,
  prev: player.prev,
  seek: player.seek,
  volume: player.volumeDelta,
  back: player.back,
  navigate: player.navigate
};
