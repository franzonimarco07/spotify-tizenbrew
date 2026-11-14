/* Piccolo bus di eventi condiviso fra i moduli (UI, player).
 * Gli hook devono partire subito (document_start), la UI arriva dopo: chi si
 * iscrive prima non deve perdere gli eventi già emessi, quindi ogni evento
 * conserva l'ultimo valore e viene "ripetuto" al nuovo iscritto. */
'use strict';

var listeners = {};
var last = {};

export function on(type, fn) {
  (listeners[type] = listeners[type] || []).push(fn);
  if (last[type] !== undefined) {
    try { fn(last[type]); } catch (e) { }
  }
  return function () {
    var a = listeners[type] || [];
    var i = a.indexOf(fn);
    if (i !== -1) a.splice(i, 1);
  };
}

export function emit(type, payload) {
  last[type] = payload;
  var a = listeners[type] || [];
  for (var i = 0; i < a.length; i++) {
    try { a[i](payload); } catch (e) { console.warn('[spotify-tv] listener', type, e); }
  }
}

export function state() {
  return last;
}
