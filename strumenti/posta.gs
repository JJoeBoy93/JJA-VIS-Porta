/**
 * La posta in arrivo di JJA-VIS (11 ottobre 2026; 20 ottobre: anche gli allegati, per l'archivio dei documenti).
 *
 * Va messo UNA volta nella Gmail di JJA-VIS: script.google.com → Nuovo progetto → incolla tutto → nella riga CHIAVE la chiave
 * che il bot di JJA-VIS ti dà col comando /posta → Salva → funzione «avvia» → Esegui → dai il permesso di leggere la posta.
 *
 * Ogni 5 minuti: le mail arrivate dopo la nostra ultima risposta (anche se le hai già aperte tu), non nostre e non automatiche,
 * vanno alla porta di JJA-VIS. Se la
 * porta dice «rispondi», lo script risponde da questa Gmail, nella stessa conversazione. Se dice «attesa», la mail è passata a JJ
 * su Telegram e la risposta partirà da lì. In ogni caso la mail viene segnata come letta e con l'etichetta «JJA-VIS/letta».
 * Se la porta non risponde, si riprova al giro dopo: niente si perde. Ogni mail si passa una volta sola.
 */
const CHIAVE = "METTI-QUI-LA-CHIAVE";
const PORTA = "https://jjavis-porta.19-jjardito93.workers.dev/posta";
const ETICHETTA = "JJA-VIS/letta";

function avvia() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "leggi") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("leggi").timeBased().everyMinutes(5).create();
  leggi();
}

function leggi() {
  if (CHIAVE === "METTI-QUI-LA-CHIAVE") throw new Error("manca la CHIAVE: chiedila al bot di JJA-VIS con /posta");
  const io = Session.getEffectiveUser().getEmail().toLowerCase();
  const etichetta = GmailApp.getUserLabelByName(ETICHETTA) || GmailApp.createLabel(ETICHETTA);
  // 12/10: NON si guarda più «non letta». JJ legge la Gmail di JJA-VIS dal telefono, e una mail aperta da lui prima del giro
  // dei 5 minuti non veniva più passata (la seconda mail di Jessica è rimasta senza risposta). Ora: in ogni conversazione
  // degli ultimi 3 giorni, le mail arrivate DOPO la nostra ultima risposta, che non sono già state passate (gli id passati
  // si tengono nelle proprietà dello script)
  const prop = PropertiesService.getScriptProperties();
  const fatte = JSON.parse(prop.getProperty("fatte") || "[]");
  const visto = {}; fatte.forEach(function (id) { visto[id] = true; });
  GmailApp.search("in:inbox newer_than:3d", 0, 30).forEach(function (filo) {
    const messaggi = filo.getMessages();
    let dopo = 0;   // l'indice dopo la nostra ultima mail nella conversazione
    messaggi.forEach(function (msg, i) { if (mittente(msg).mail === io) dopo = i + 1; });
    messaggi.slice(dopo).forEach(function (msg) {
      const id = msg.getId(); if (visto[id]) return;
      const m = mittente(msg);
      // le nostre, i risponditori automatici, le liste: non si passano
      const auto = (msg.getHeader("Auto-Submitted") || "").toLowerCase();
      if (m.mail === io || (auto && auto !== "no") || msg.getHeader("List-Id") || /mailer-daemon|no-?reply|postmaster/.test(m.mail)) { segna(id); return; }
      const r = UrlFetchApp.fetch(PORTA, { method: "post", contentType: "application/json", headers: { "X-Posta": CHIAVE },
        payload: JSON.stringify({ da: m.mail, nome: m.nome, oggetto: msg.getSubject(), testo: msg.getPlainBody(), mid: id, allegati: allegati(msg) }), muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) { console.log("la porta dice " + r.getResponseCode() + ": " + r.getContentText().slice(0, 200)); return; }   // si riprova al giro dopo
      const d = JSON.parse(r.getContentText() || "{}");
      if (d.rispondi) msg.reply(d.rispondi);
      msg.markRead(); filo.addLabel(etichetta); segna(id);
    });
  });
  prop.setProperty("fatte", JSON.stringify(fatte.slice(-300)));
  function segna(id) { if (!visto[id]) { visto[id] = true; fatte.push(id); } }
}

// 20/10: i documenti in allegato (PDF e foto, al massimo 5, ognuno sotto i 4,5 MB) vanno ad Atlas, che li archivia cifrati
function allegati(msg) {
  const tipi = { "application/pdf": 1, "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
  return msg.getAttachments({ includeInlineImages: false }).filter(function (a) { return tipi[a.getContentType()] && a.getSize() < 4500000; }).slice(0, 5)
    .map(function (a) { return { nome: a.getName(), tipo: a.getContentType(), dati: Utilities.base64Encode(a.getBytes()) }; });
}

function mittente(msg) {
  const da = msg.getFrom(); const m = da.match(/<([^>]+)>/);
  return { mail: (m ? m[1] : da).trim().toLowerCase(), nome: m ? da.replace(/<[^>]+>/, "").replace(/"/g, "").trim() : "" };
}
