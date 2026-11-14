/* Stato del player condiviso: una sola fonte di verità per la UI.
 * La UI non legge il DOM di Spotify (fragile e lento): ascolta questi eventi,
 * che arrivano da tre sorgenti indipendenti:
 *   - il cluster del WebSocket (metadati, stato, posizione, brano corrente);
 *   - il motore no-ads (stato dedotto dalla state machine);
 *   - un <audio> "spia" per la posizione reale del playback.
 */
'use strict';

import { emit } from './bus.js';

export var st = {
  track: null,          // { uri, name, artists, album, art, duration }
  playing: false,
  position: 0,          // secondi
  duration: 0,
  volume: 1,
  ad: false,
  adBlocked: 0,
  ready: false
};

export function setTrack(t) {
  st.track = t;
  st.duration = t && t.duration ? t.duration : 0;
  if (!t) st.position = 0;
  emit('track', st.track);
}

export function setPlaying(p) {
  if (st.playing === p) return;
  st.playing = p;
  emit('playing', p);
}

export function setPosition(pos) {
  if (!isFinite(pos) || pos < 0) return;
  st.position = pos;
  emit('position', pos);
}

export function setVolume(v) {
  if (!isFinite(v)) return;
  st.volume = Math.max(0, Math.min(1, v));
  emit('volume', st.volume);
}

export function setAd(on) {
  if (st.ad === on) return;
  st.ad = on;
  emit('ad', on);
}

export function setReady() {
  if (st.ready) return;
  st.ready = true;
  emit('ready', true);
}

export function trackFromMetadata(md) {
  if (!md) return null;
  var artists = md.artist_name || md.artists || '';
  if (Array.isArray(artists)) artists = artists.join(', ');
  return {
    uri: md.uri || '',
    name: md.name || md.title || '',
    artists: artists,
    album: md.album_title || md.album_name || md.album || '',
    art: pickImage(md.image_url || md.image_large_url || md.cover_art || ''),
    duration: md.duration ? Math.round(md.duration / 1000) : 0
  };
}

export function pickImage(u) {
  if (!u) return '';
  if (/^https?:/.test(u)) return u.replace(/^http:/, 'https:');
  if (u.indexOf('spotify:image:') === 0) return 'https://i.scdn.co/image/' + u.split(':')[2];
  return u;
}
