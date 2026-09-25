# JJA-VIS — la porta

Riceve le risposte della [pagina pubblica](https://jjoeboy93.github.io/JJA-VIS/) e le scrive, una per file, in un archivio privato. Non legge, non risponde, non parla con nessun altro sistema.

`GET /` dice se è accesa e se l'archivio è collegato. `POST /risposta` accetta solo dalla pagina.

## Le risposte per mail

Chi scrive una domanda con la mail riceve una risposta, **solo dopo il tocco di JJ**:
bozza scritta da Claude (senza vault, sa solo quello che dice la pagina) → Telegram
al bot di JJA-VIS con *Invia* / *Scarta* → la mail parte da Brevo. Per cambiare la
bozza, JJ risponde al messaggio col testo giusto. Le bozze stanno in `bozze/` nell'archivio.
