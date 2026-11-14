# Handoff — "Spicetify per TV Samsung" (Spotify su Tizen via TizenBrew)

Stato al 14/11/2026. Documento scritto per un'altra AI che riprende il progetto.

## 1. Obiettivo e intenzioni dell'utente

- L'utente vuole uno **"Spicetify per Tizen"**: Spotify sulla TV Samsung, personalizzabile come Spicetify su PC.
- **L'obiettivo principale dichiarato è un add-on "no-ads"** da usare con un **account Spotify Free**. Motivo: l'utente ha **Premium Individual**, che consente un solo ascolto alla volta, e quell'account è usato con rekordbox. Per la TV vuole un secondo account Free senza pubblicità.
- **Idee e richieste dell'utente sull'esperienza:**
  - la navigazione attuale con il telecomando ha "enormi problemi";
  - **rifare completamente l'interfaccia** prendendo come base quella dell'app Spotify originale per TV;
  - **ottimizzare** perché il web player carica molto lentamente sulla TV;
  - aggiungere **animazioni di caricamento**.
- Cose escluse:
  - l'utente **non è interessato** a temi o estensioni "legittimi" senza il no-ads;
  - la Spotify Web API e il Web Playback SDK **non permettono di riprodurre musica con account Free**, quindi un'interfaccia nostra non può fare a meno del web player come motore audio;
  - l'utente stava creando un'app su developer.spotify.com, ma con un account Free non serve.

## 2. Dispositivi e rete (LAN 192.168.1.0/24)

| Dispositivo | IP | Note |
|---|---|---|
| **TV 2 — Samsung UE65DU7170 (2024)** | **192.168.1.34** | Tizen 8.0, armv7 32 bit, browser Chromium 108. **TV di test, con TizenBrew installato** |
| TV 1 — Samsung UE55TU7022 (2020) | 192.168.1.6 | Ha già TizenBrew + **TizenTube**: **non toccarla** |
| Mac dell'utente (macOS, Apple Silicon) | 192.168.1.33 | Qui ci sono i tool e il repo |

Developer mode della TV 2: si attiva da App → `12345`. Per installare da Mac, come Host PC IP va messo **192.168.1.33**. Per far funzionare TizenBrew (injection via debug) va messo **127.0.0.1**. In questo momento è impostato su **127.0.0.1**. Dopo ogni cambio la TV va riavviata tenendo premuto power.

## 3. Cosa è stato fatto

### 3.1 TizenBrew installato sulla TV 2
- Il **TizenBrewInstaller v1.1.3** per macOS è servito solo per il **login Samsung e la creazione del certificato** (obbligatorio da Tizen 7 in su). Con questo installer l'installazione vera si blocca sempre su "Installing package".
  - Bug dell'installer: "Select file to install" non ha il `break` e prosegue fino a `DeleteConfiguration`, che **cancella il certificato** salvato in `~/share/tizenbrewInstallerConfig.json`.
  - L'installer occupa l'unica connessione sdb verso la TV. Va chiuso prima di usare `sdb`.
- **Procedura che funziona**, con Tizen Studio CLI 6.1 in `~/tizen-studio`:
  1. Certificati estratti in `~/tizen-studio-data/tizenbrew-cert/` (`author.p12`, `distributor.p12`, `pw`) e importati come profilo di firma **`TizenBrewTV`**.
  2. Firma: `~/tizen-studio/tools/ide/bin/tizen package -t wgt -s TizenBrewTV -o <out> -- <file.wgt>`
  3. Connessione: `~/tizen-studio/tools/sdb connect 192.168.1.34`. Richiede Host PC IP = Mac.
  4. Installazione: `tizen install -s 192.168.1.34:26101 -n <file.wgt>`. Usare nomi file **senza spazi**.
  5. Avvio: `tizen run -s 192.168.1.34:26101 -p xvvl3S1bvH.TizenBrewStandalone`
- Pacchetto usato: `TizenBrewStandalone-Old.wgt` v2.0.5 (l'unico `.wgt` presente nella release), già firmato in `~/Downloads/TizenBrew/resigned/`.
- **Problema ricorrente:** il log dice *"Work is queuing / Waiting for ready to work"* e poi *"Failed to install"*. Significa che la coda installazioni della TV è bloccata, di solito dopo un'installazione fallita. Soluzione: **staccare la spina della TV per 30 secondi**.
- La modalità auto di Claude Code blocca l'esecuzione di installer o binari scaricati: li ha lanciati l'utente con `! <comando>`.

### 3.2 Verifiche sulla TV 2
- Pagina di test `shaka-player-demo.appspot.com/support.html`: **Widevine supportato** (fino a `HW_SECURE_ALL`), PlayReady base, ClearKey. Codec audio AAC, Opus e FLAC supportati.
- L'EME è disponibile **solo in HTTPS**. Un test in http dal Mac aveva dato `eme: false`, ed era un falso negativo.
- Nell'app Internet della TV, `open.spotify.com` risponde **"Browser non supportato"**. Il controllo è **lato server sull'User-Agent HTTP**: Chrome ≤ 108 viene bloccato, da 109 in su passa (verificato con curl). La TV è proprio un Chromium 108.
- Sulla TV è installata anche l'app ufficiale `rJeHak5zRg.Spotify`.

### 3.3 Modulo TizenBrew `spotify-tizenbrew`
- Repository locale: `~/spotify-tizenbrew`. Remoto: **https://github.com/franzonimarco07/spotify-tizenbrew** (pubblico). L'utente fa il push con **GitHub Desktop**, perché sul Mac non ci sono `gh` né credenziali git da terminale.
- Sulla TV si aggiunge da TizenBrew → Module Manager → GitHub → `franzonimarco07/spotify-tizenbrew`. Attenzione: se si scrive anche il prefisso `gh/` il modulo diventa `gh/gh/...` e compare come "Unknown Module".
- TizenBrew scarica i moduli da **jsDelivr**. Dopo ogni push bisogna svuotare la cache: `https://purge.jsdelivr.net/gh/franzonimarco07/spotify-tizenbrew@main/<file>` (e la stessa URL senza `@main`).
- Il **servizio TizenBrew resta attivo in background e tiene in cache l'elenco dei moduli**. Dopo un aggiornamento bisogna rimuovere e riaggiungere il modulo, oppure riavviare la TV.
- `package.json`: `packageType: "mods"`, `websiteURL: https://open.spotify.com`, `main: dist/userScript.js`, `keys` (tasti media e colorati).
  - **Non usare `evaluateScriptOnDocumentStart`**: con quell'opzione il modulo non parte dalla home di TizenBrew, perché la UI aspetta un evento che non arriva.
- `dist/userScript.js` **v0.3** (servita da jsDelivr) contiene:
  - override JS di `navigator.userAgent` e `userAgentData` (Chrome 120 su Linux) e tentativo di `tizen.websetting.setUserAgentString`. Sulla pagina esterna risulta **"no tizen API"**, eppure con la v0.2 Spotify si è caricato. Il motivo non è chiaro: va verificato se il blocco si ripresenta;
  - navigazione spaziale con frecce, OK e Indietro, con un **anello di focus disegnato dal modulo** e bersagli filtrati con `elementFromPoint`, così non si selezionano elementi coperti;
  - tasti media mappati sui `data-testid` del player (`control-button-playpause`, `-skip-forward`, `-skip-back`);
  - rifiuto automatico del banner cookie OneTrust;
  - pannello di diagnostica: **BLU** lo mostra o nasconde, **GIALLO** ricarica. Nel pannello compaiono anche le richieste DRM del sito.
- Risultato sulla TV: **Spotify si carica e Widevine viene concesso** (`DRM granted: com.widevine.alpha`). L'utente dice che "funziona", ma la navigazione è scomoda e il caricamento è molto lento. La riproduzione con login completo non è stata ancora verificata.

## 4. Codice di riferimento studiato
- TizenBrew (`reisxd/TizenBrew`): i moduli sono `gh/…` o `npm/…` via jsDelivr. I moduli `mods` vengono iniettati via CDP con `Runtime.evaluate` a ogni nuovo execution context. Un modulo può avere un `serviceFile` che gira nel servizio Node di TizenBrew con `require` e `tizen` a disposizione: è un possibile punto da cui cambiare l'UA HTTP via CDP (`Network.setUserAgentOverride`) se il blocco torna.
- Esempio di modulo mods: TizenTube (`reisxd/TizenTube`).
- Le impostazioni UA di TizenBrew offrono solo preset Cobalt, non uno user agent personalizzato.

## 5. File e percorsi utili
- Repository del modulo: `~/spotify-tizenbrew`. Sorgenti studiati e file temporanei nello scratchpad della sessione, non necessari.
- Tool Tizen: `~/tizen-studio/tools/sdb`, `~/tizen-studio/tools/ide/bin/tizen`.
- Certificato Samsung: `~/tizen-studio-data/tizenbrew-cert/` (riservato, non condividere).
