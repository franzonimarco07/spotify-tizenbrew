# Push su GitHub — v0.4

Commit già fatto in locale: **05d7b02** — `v0.4: motore no-ads + interfaccia TV con navigazione da telecomando`
Branch: `main`, remoto: `https://github.com/franzonimarco07/spotify-tizenbrew.git`

Il commit è su `main` e il working tree è pulito: non serve altro lato git.

## 1. Push (GitHub Desktop, il modo che usi di solito)

1. Apri GitHub Desktop → repository `spotify-tizenbrew`.
2. In alto deve comparire **1 commit da pushare** ("Push origin").
3. Premi **Push origin**.

In alternativa, dal Terminale (serve aver configurato un token o le credenziali):

```
cd ~/spotify-tizenbrew
git push origin main
```

Se il push viene rifiutato perché il remoto è più avanti:

```
git pull --rebase origin main
git push origin main
```

## 2. Svuota la cache di jsDelivr (obbligatorio)

TizenBrew scarica i moduli da jsDelivr, che tiene i file in cache. Dopo il push, apri queste URL nel browser (ognuna deve rispondere con un messaggio tipo "done"):

```
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/package.json
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/dist/userScript.js
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/dist/service.js
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/dist/service-runtime.js
```

e le stesse quattro senza `@main`:

```
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew/package.json
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew/dist/userScript.js
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew/dist/service.js
https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew/dist/service-runtime.js
```

Verifica che sia arrivata la v0.4.0:

```
https://cdn.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/package.json
```

deve contenere `"version": "0.4.0"` e `"serviceFile": "dist/service.js"`.

## 3. Sulla TV

1. TizenBrew → Module Manager → **rimuovi** `franzonimarco07/spotify-tizenbrew` (il servizio tiene in cache l'elenco dei moduli).
2. Riaggiungilo come `franzonimarco07/spotify-tizenbrew` — **senza** il prefisso `gh/`.
3. Apri il modulo: deve comparire la schermata nera con "La tua musica, senza pubblicità." sopra la pagina di Spotify.
4. Tasto **GIALLO**: attiva i log in console; tasto **VERDE**: quante pubblicità sono state bloccate.

Se al posto della UI vedi la pagina di Spotify normale, il modulo non è stato iniettato: riavvia la TV e riapri TizenBrew.

## Cosa NON è stato verificato

- il **service file** (`dist/service.js`): UA HTTP desktop via CDP e blocco degli annunci video. Richiede la TV; se TizenBrew non lo carica, il modulo funziona lo stesso ma l'UA HTTP resta quello vecchio.
- il login con l'account Free sulla TV: la UI e il player sono stati provati solo con il finto player in `tools/preview/`.
