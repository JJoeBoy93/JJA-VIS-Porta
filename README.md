# JJA-VIS — la porta

Riceve le risposte della [pagina pubblica](https://jjoeboy93.github.io/JJA-VIS/) e le scrive, una per file, in un archivio privato. Non legge, non risponde, non parla con nessun altro sistema.

`GET /` dice se è accesa e se l'archivio è collegato. `POST /risposta` accetta solo dalla pagina.

## Le risposte per mail

Chi scrive una domanda con la mail riceve una risposta, **solo dopo il tocco di JJ**:
bozza scritta da Claude (senza vault, sa solo quello che dice la pagina) → Telegram
al bot di JJA-VIS con *Invia* / *Scarta* → la mail parte da Brevo. Per cambiare la
bozza, JJ risponde al messaggio col testo giusto. Le bozze stanno in `bozze/` nell'archivio.

## La piazza (`piazza/`)

Un worker suo, `jjavis-piazza`, **sull'account Cloudflare di JJA-VIS** (non quello di Hermes e Clio: contatori separati), con la sua consegna (`.github/workflows/piazza.yml`): in città si vedono gli altri e ci si scrive (JJ, 5 ottobre 2026). Passano l'aspetto dell'avatar, dove si cammina, il soprannome (mai il nome vero) e i messaggi della chat della piazza, filtrati da `filtro.js` (parole pesanti, link, numeri di telefono). Niente si scrive su disco. `GET /` dice se risponde e quanti sono dentro. Prima di ogni consegna gira `piazza/collaudo.mjs` contro workerd: se non è verde non si consegna.
