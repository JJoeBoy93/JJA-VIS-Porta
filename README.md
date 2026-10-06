# JJA-VIS — la porta

Riceve le risposte della [pagina pubblica](https://jjoeboy93.github.io/JJA-VIS/) e le scrive, una per file, in un archivio privato. Non legge, non risponde, non parla con nessun altro sistema.

`GET /` dice se è accesa e se l'archivio è collegato. `POST /risposta` accetta solo dalla pagina.

## Le risposte per mail

Chi scrive una domanda con la mail riceve una risposta, **solo dopo il tocco di JJ**:
bozza scritta da Claude (senza vault, sa solo quello che dice la pagina) → Telegram
al bot di JJA-VIS con *Invia* / *Scarta* → la mail parte da Brevo. Per cambiare la
bozza, JJ risponde al messaggio col testo giusto. Le bozze stanno in `bozze/` nell'archivio.

## Il server della città (`citta/`)

Un worker suo, `jjavis-citta`, **sull'account Cloudflare di JJA-VIS** (non quello di Hermes e Clio: contatori separati), con la sua consegna (`.github/workflows/citta.yml`): in città si vedono gli altri e ci si scrive (JJ, 5 ottobre 2026). Passano l'aspetto dell'avatar, dove si cammina, il soprannome (mai il nome vero) e i messaggi della chat della città, filtrati da `filtro.js` (parole pesanti, link, numeri di telefono). Niente si scrive su disco. `GET /` dice se risponde e quanti sono dentro. **Gli account** (`citta/conti.js`, JJ 5/10): accedi con Google, l'account vero sta nel database del Durable Object `Conti` (soprannome, gettoni, skin); l'amministratore (segreto `JJAVIS_ADMIN`, la mail di JJ) non spende gettoni. Prova: `citta/collaudo-conti.mjs`, con biglietti firmati da `prova-chiave.json`, che il server accetta solo con `--var LOCALE:1` (mai in produzione). Prima di ogni consegna gira `citta/collaudo.mjs` contro workerd: se non è verde non si consegna.
