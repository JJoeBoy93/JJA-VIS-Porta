/**
 * La posta in arrivo di JJA-VIS (11 ottobre 2026).
 *
 * Va messo UNA volta nella Gmail di JJA-VIS: script.google.com → Nuovo progetto → incolla tutto → nella riga CHIAVE la chiave
 * che il bot di JJA-VIS ti dà col comando /posta → Salva → funzione «avvia» → Esegui → dai il permesso di leggere la posta.
 *
 * Ogni 5 minuti: le mail nuove in arrivo (non lette, non nostre, non risposte automatiche) vanno alla porta di JJA-VIS. Se la
 * porta dice «rispondi», lo script risponde da questa Gmail, nella stessa conversazione. Se dice «attesa», la mail è passata a JJ
 * su Telegram e la risposta partirà da lì. In ogni caso la mail viene segnata come letta e con l'etichetta «JJA-VIS/letta».
 * Se la porta non risponde, la mail resta non letta e si riprova al giro dopo: niente si perde.
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
  const io = Session.getActiveUser().getEmail().toLowerCase();
  const etichetta = GmailApp.getUserLabelByName(ETICHETTA) || GmailApp.createLabel(ETICHETTA);
  const fili = GmailApp.search("in:inbox is:unread newer_than:7d", 0, 20);
  fili.forEach(function (filo) {
    filo.getMessages().forEach(function (msg) {
      if (!msg.isUnread()) return;
      const da = msg.getFrom(); const m = da.match(/<([^>]+)>/); const mail = (m ? m[1] : da).trim().toLowerCase();
      const nome = m ? da.replace(/<[^>]+>/, "").replace(/"/g, "").trim() : "";
      // le nostre, i risponditori automatici, le liste: si segnano lette e basta
      const auto = (msg.getHeader("Auto-Submitted") || "").toLowerCase();
      if (mail === io || (auto && auto !== "no") || msg.getHeader("List-Id") || /mailer-daemon|no-?reply|postmaster/.test(mail)) { msg.markRead(); return; }
      const r = UrlFetchApp.fetch(PORTA, { method: "post", contentType: "application/json", headers: { "X-Posta": CHIAVE },
        payload: JSON.stringify({ da: mail, nome: nome, oggetto: msg.getSubject(), testo: msg.getPlainBody(), mid: msg.getId() }), muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) { console.log("la porta dice " + r.getResponseCode() + ": " + r.getContentText().slice(0, 200)); return; }   // si riprova
      const d = JSON.parse(r.getContentText() || "{}");
      if (d.rispondi) msg.reply(d.rispondi);
      msg.markRead(); filo.addLabel(etichetta);
    });
  });
}
