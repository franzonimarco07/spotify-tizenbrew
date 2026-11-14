# Spotify TV Mod (TizenBrew)

Spotify sul web player delle TV Samsung, come modulo [TizenBrew](https://github.com/reisxd/TizenBrew):

- **niente pubblicità** con un account Free: gli annunci vengono tolti dalla state machine del player prima che partano, e le pubblicità video vengono intercettate dal service file;
- **interfaccia TV** costruita sopra la pagina di Spotify: menu in alto, player sempre in basso, navigazione semplice col telecomando (frecce = zone, OK = scegli, Indietro = torna su);
- **animazioni di caricamento**: scheletro con shimmer, barra di avanzamento e player che "respira" durante la riproduzione;
- user agent Chrome desktop, altrimenti Spotify risponde "browser non supportato".

## Installazione

In TizenBrew → Module Manager → aggiungi il modulo `gh/<utente>/spotify-tizenbrew`.

Requisiti: TV con Widevine (verificato su Tizen 8.0 / 2024).

## Telecomando

| Tasto | Cosa fa |
|---|---|
| frecce | si muove fra menu, contenuti e player |
| OK | entra / riproduce |
| Indietro | torna alla schermata iniziale, poi nasconde l'interfaccia |
| play/pausa, avanti, indietro | controlla la musica |
| BLU | riapre l'interfaccia |
| VERDE | quante pubblicità sono state bloccate |
| GIALLO | log di debug in console |

## Sviluppo

```
npm install      # esbuild
npm run build    # src/*.js -> dist/userScript.js
node tools/test-statemachine.mjs
```

`tools/preview/index.html` è un'anteprima locale della sola interfaccia (finto player, nessun account): apri la cartella con un server statico e visita `/tools/preview/index.html`.

Dopo ogni push su GitHub svuota la cache di jsDelivr per `package.json`, `dist/userScript.js` e `dist/service.js`, poi rimuovi e riaggiungi il modulo in TizenBrew.

## Crediti

Le parti di blocco delle pubblicità derivano da [T-64/spotify-ad-skip](https://github.com/T-64/spotify-ad-skip) e [tomer8007/spotify-web-ads-remover](https://github.com/tomer8007/spotify-web-ads-remover) (GPL-3.0), riscritte e ridotte per la TV.
