# Spotify TV Mod (TizenBrew)

Spotify sul web player delle TV Samsung, come modulo [TizenBrew](https://github.com/reisxd/TizenBrew):

- **interfaccia TV** sopra la pagina di Spotify, con navigazione da telecomando;
- **animazioni di caricamento**;
- user agent Chrome desktop, altrimenti Spotify risponde "browser non supportato".

Funziona con il piano di Spotify dell'account usato (Free con pubblicità, Premium senza).

## Telecomando

| Tasto | Cosa fa |
|---|---|
| frecce | menu in alto, contenuti della pagina, player in basso |
| OK | apre una scheda, suona un brano, attiva un tasto; sul campo di ricerca apre la tastiera |
| Indietro | pagina precedente, poi torna al menu |
| play/pausa, avanti, indietro | controllano la musica |
| BLU | va ai comandi del player |
| GIALLO | diagnostica a schermo |
| ROSSO | ricarica |

## Installazione

TizenBrew → Module Manager → GitHub → `franzonimarco07/spotify-tizenbrew` (senza `gh/`).

Requisiti: TV con Widevine (verificato su Tizen 8.0 / 2024).

## Sviluppo

```
npm install      # esbuild
npm run build    # src/*.js -> dist/userScript.js
```

Dopo ogni push svuota la cache di jsDelivr per `package.json` e `dist/userScript.js`
(`https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/<file>`, anche senza `@main`),
poi in TizenBrew rimuovi e riaggiungi il modulo.
