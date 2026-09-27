// ══ IL MOTORE DEL PREVENTIVO — 27 settembre 2026 (Athena) ══════════════
// Modello v2 di JJ (vault: progetto/piano/sogni/il-preventivo-lo-fa-jjavis.md).
// Commesse singole: prezzo dal COSTO, col tempo di JJ. Le giornate da
// corriere in subappalto (230/250 €) sono prezzo di mercato: non passano di qui.
//
// Percorso: partenza di JJ → carico → scarico → partenza (andata e ritorno
// a vuoto compresi). Km, tempi e tratti a pedaggio da openrouteservice
// (ORS_KEY): il PREZZO del casello ORS non lo da', si stima coi km a
// pedaggio × una tariffa da tarare sui caselli veri di JJ. Lo Sprinter e'
// classe B (assi-sagoma: 2 assi, oltre 1,30 m al primo asse).
//
// Niente parte al cliente da qui: la stima va solo a JJ. Prezzo pieno, mai
// sconti proposti dal motore.

export const MEZZI = {
  sprinter: { nome: "Sprinter", carburante: 0.32, usura: 0.08 },  // gasolio 2,30 €/l × 13,9 l/100 km
  panda:    { nome: "Panda",    carburante: 0.08, usura: 0.04 },  // ibrida, ~25 km/l
};
export const TARIFFE = {
  guida: 30,           // €/ora — JJ, modello v1
  facchinaggio: 40,    // €/ora — supplemento confermato da JJ
  aiutante: 100,       // € a persona, passano a loro
  fissiGiornata: 32,   // € per giornata lavorata (assicurazioni, INPS, bollo, commercialista)
  oreGiornata: 9,
  urgenza: 0.33,
  imposte: 0.0325,     // forfettario: 5% sul 65%, niente IVA
  caselloKm: 0.12,     // € per km a pedaggio — DA TARARE: Marche, ~100 € su ~820 km (JJ, a memoria)
};

const eur = (x) => Math.round(x);

// Il calcolo puro: niente rete. km, kmPedaggio, oreGuida vengono dal percorso.
export function calcola({ km, kmPedaggio = 0, oreGuida, oreFacchinaggio = 0, aiutanti = 0, urgente = false, mezzo = "sprinter" }) {
  const m = MEZZI[mezzo];
  if (!m) throw new Error(`mezzo sconosciuto: ${mezzo}`);
  const ore = oreGuida + oreFacchinaggio;
  const voci = [
    ["carburante", km * m.carburante, `${Math.round(km)} km`],
    ["usura", km * m.usura, ""],
    ["caselli", kmPedaggio * TARIFFE.caselloKm, kmPedaggio ? `stima: ${Math.round(kmPedaggio)} km a pedaggio × ${TARIFFE.caselloKm} €` : "nessun tratto a pedaggio"],
    ["costi fissi", ore / TARIFFE.oreGiornata * TARIFFE.fissiGiornata, `${ore.toFixed(1)} h`],
    ["guida", oreGuida * TARIFFE.guida, `${oreGuida.toFixed(1)} h × ${TARIFFE.guida} €`],
  ];
  if (oreFacchinaggio) voci.push(["facchinaggio", oreFacchinaggio * TARIFFE.facchinaggio, `${oreFacchinaggio} h × ${TARIFFE.facchinaggio} €`]);
  if (aiutanti) voci.push(["aiutanti", aiutanti * TARIFFE.aiutante, `${aiutanti} × ${TARIFFE.aiutante} €`]);
  let costo = voci.reduce((s, v) => s + v[1], 0);
  if (urgente) { voci.push(["urgenza", costo * TARIFFE.urgenza, "+33%"]); costo *= 1 + TARIFFE.urgenza; }
  const lordo = costo / (1 - TARIFFE.imposte);
  voci.push(["imposte", lordo - costo, "3,25% forfettario"]);
  const prezzo = Math.ceil(lordo / 5) * 5;
  return { voci, costo: lordo, prezzo, mezzo: m.nome };
}

// Il comando di JJ: «/stima Limbiate > Seriate fac 2 aiut 1 urgente panda»
export function leggiComando(testo) {
  const corpo = testo.replace(/^\/stima(@\w+)?\s*/i, "");
  const pezzi = corpo.split(">");
  if (pezzi.length < 2 || pezzi.some((p) => !p.trim())) return null;
  const daGrezzo = pezzi[0], resto = pezzi[pezzi.length - 1], mezzo = pezzi.slice(1, -1).map((p) => p.trim());
  const opz = { oreFacchinaggio: 0, aiutanti: 0, urgente: false, mezzo: "sprinter", mezzoScelto: false };
  let a = resto;
  a = a.replace(/\bfac(?:chinaggio)?\s+(\d+(?:[.,]\d+)?)/i, (_, n) => { opz.oreFacchinaggio = parseFloat(n.replace(",", ".")); return ""; });
  a = a.replace(/\baiut(?:anti|ante)?\s+(\d+)/i, (_, n) => { opz.aiutanti = parseInt(n, 10); return ""; });
  a = a.replace(/\burgente\b/i, () => { opz.urgente = true; return ""; });
  a = a.replace(/\b(panda|sprinter)\b/i, (_, n) => { opz.mezzo = n.toLowerCase(); opz.mezzoScelto = true; return ""; });
  a = a.replace(/\s+/g, " ").trim();
  if (!a) return null;
  return { da: daGrezzo.trim(), a, tappe: mezzo, ...opz };
}

const BASE = (env) => env.ORS_BASE || "https://api.openrouteservice.org";

async function geocodifica(env, testo) {
  const q = new URLSearchParams({ api_key: env.ORS_KEY, text: testo, "boundary.country": "IT", size: "1" });
  const r = await fetch(`${BASE(env)}/geocode/search?${q}`);
  if (!r.ok) throw new Error(`indirizzo «${testo}»: openrouteservice ${r.status}`);
  const f = ((await r.json()).features || [])[0];
  if (!f) throw new Error(`indirizzo «${testo}» non trovato`);
  return { lngLat: f.geometry.coordinates, nome: (f.properties && f.properties.label) || testo };
}

// Partenza → carico → scarico → partenza. Mai la chiave nei messaggi d'errore.
// Casa → ritiro → tappe (nell'ordine dato dal cliente) → consegna → casa.
// JJ, 27 settembre: «Limbiate è sempre la mia partenza, poi c'è il ritiro e
// la consegna e poi torno a casa, oppure ci sono servizi multitappa».
export const MAX_TAPPE = 8;
export async function percorso(env, da, a, tappe = []) {
  if (!env.ORS_KEY) throw new Error("manca ORS_KEY nei segreti della porta");
  if (!env.PARTENZA) throw new Error("manca PARTENZA nei segreti della porta (il comune da cui parte JJ)");
  if (tappe.length > MAX_TAPPE) throw new Error(`al massimo ${MAX_TAPPE} tappe intermedie`);
  const punti = await Promise.all([env.PARTENZA, da, ...tappe, a].map((x) => geocodifica(env, x)));
  const casa = punti[0], p1 = punti[1], p2 = punti[punti.length - 1];
  const r = await fetch(`${BASE(env)}/v2/directions/driving-car`, {
    method: "POST",
    headers: { "Authorization": env.ORS_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [...punti.map((p) => p.lngLat), casa.lngLat], extra_info: ["tollways"] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`percorso: openrouteservice ${r.status} ${(j.error && (j.error.message || j.error)) || ""}`.trim());
  const rt = (j.routes || [])[0];
  if (!rt) throw new Error("percorso: nessuna strada trovata");
  const pedaggio = ((rt.extras && rt.extras.tollways && rt.extras.tollways.summary) || []).find((s) => s.value === 1);
  // I km di ogni tratto: ORS da' un `segment` per coppia di punti. Se il conto
  // non torna, il dettaglio si tace invece di inventarlo.
  const nomi = [...punti.map((p) => p.nome), casa.nome];
  const tratti = (rt.segments || []).length === nomi.length - 1
    ? rt.segments.map((g, i) => ({ da: nomi[i], a: nomi[i + 1], km: g.distance / 1000 })) : null;
  return {
    tratti, casa: casa.nome, tappe: punti.slice(2, -1).map((p) => p.nome),
    km: rt.summary.distance / 1000,
    oreGuida: rt.summary.duration / 3600,
    kmPedaggio: pedaggio ? pedaggio.distance / 1000 : 0,
    pedaggioNoto: Boolean(rt.extras && rt.extras.tollways),
    da: p1.nome, a: p2.nome,
  };
}

export function testoStima(c, s, r) {
  const n = (s.tratti || []).length;
  const giro = s.tratti
    ? s.tratti.map((x, i) => `${i === 0 ? "🏠" : i === n - 1 ? "🏠" : "📦"} ${x.da} → ${x.a}: ${Math.round(x.km)} km${i === 0 || i === n - 1 ? " a vuoto" : ""}`)
    : [[s.da, ...(s.tappe || []), s.a].join(" → "), "(partenza da casa e ritorno a vuoto compresi)"];
  const righe = [`🧮 STIMA — ${r.mezzo}${c.urgente ? " · URGENTE" : ""}`, ...giro, ""];
  for (const [nome, euro, nota] of r.voci) righe.push(`${nome}: ${eur(euro)} €${nota ? ` — ${nota}` : ""}`);
  if (!s.pedaggioNoto) righe.push("⚠️ caselli: openrouteservice non ha detto i tratti a pedaggio");
  // JJ, 27 settembre: il tempo di una fermata «non è sempre uguale… non lo sai
  // subito». Il motore non lo inventa: lo ricorda, col conto pronto.
  const fermate = (s.tappe || []).length + 2;   // ritiro + tappe + consegna
  if ((s.tappe || []).length) {
    const q = 15 / 60 * TARIFFE.guida * (c.urgente ? 1 + TARIFFE.urgenza : 1) / (1 - TARIFFE.imposte);
    righe.push(`⏱ soste non contate: ${fermate} fermate. Ogni 15 min in più ≈ ${Math.round(q)} € — se le conosci, rispondi con il prezzo`);
  }
  righe.push("", `→ ${r.prezzo} €`);
  if (r.altro) righe.push(`${r.altro.mezzo === "Panda" ? "🚗" : "🚐"} con ${r.altro.mezzo === "Panda" ? "la Panda" : "lo Sprinter"}: ${r.altro.prezzo} € (carburante ${eur(r.altro.voci[0][1])} €, usura ${eur(r.altro.voci[1][1])} €)`);
  righe.push("Prezzo pieno: gli sconti li decidi tu. I caselli sono una stima (classe B): se non tornano coi tuoi, dimmelo.");
  return righe.join("\n");
}

export async function comandoStima(env, testo) {
  const c = leggiComando(testo);
  if (!c) return "Scrivi così: /stima Monza > Seriate (ritiro > consegna)\ncon tappe: /stima Monza > Bergamo > Seriate\nopzioni: fac 2 (ore di carico/scarico) · aiut 1 · urgente · panda\nPartenza e ritorno da casa li aggiungo io.";
  const s = await percorso(env, c.da, c.a, c.tappe);
  return testoStima(c, s, dueMezzi({ ...c, ...s }, c.mezzoScelto));
}

// ══ LE RICHIESTE DAL SITO DI ATHENA TRASPORTI — 27 settembre ══════════
// Il cliente compila il modulo → la porta calcola → JJ su Telegram approva,
// cambia o rifiuta → solo allora il preventivo parte al cliente. Il sito
// non mostra mai un prezzo: lo decide JJ.
export const SERVIZI = {
  "Consegna conto terzi": { oreFacchinaggio: 0, urgente: false },
  "Consegna urgente":     { oreFacchinaggio: 0, urgente: true },
  "Sgombero":             { oreFacchinaggio: 3, urgente: false },  // stima: JJ la cambia
};
export const MAIL_ATHENA = "jja.athenatrasporti@gmail.com";   // pubblica, sul sito

const t = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function telefonoWa(v) {
  let c = String(v || "").replace(/[^\d+]/g, "");
  if (c.startsWith("+")) c = c.slice(1); else if (c.startsWith("00")) c = c.slice(2);
  if (/^3\d{8,9}$/.test(c)) c = "39" + c;          // cellulare italiano senza prefisso
  return /^\d{10,15}$/.test(c) ? c : "";
}

// Solo i campi noti; senza consenso o senza un modo di ricontattarlo, niente.
export function pulisciRichiesta(d) {
  if (!d || typeof d !== "object") return { errore: "richiesta vuota" };
  const servizio = Object.keys(SERVIZI).includes(d.servizio) ? d.servizio : "";
  const tappe = (Array.isArray(d.tappe) ? d.tappe : String(d.tappe || "").split("\n")).map((x) => t(x, 120)).filter(Boolean);
  if (tappe.length > MAX_TAPPE) return { errore: `al massimo ${MAX_TAPPE} tappe intermedie` };
  const ingombro = servizio === "Sgombero" ? "furgone" : (Object.keys(INGOMBRI).includes(d.ingombro) ? d.ingombro : "nonso");
  const r = { servizio, ingombro, da: t(d.da, 120), a: t(d.a, 120), tappe, quando: t(d.quando, 80), note: t(d.note, 800),
              nome: t(d.nome, 60), telefono: telefonoWa(d.telefono), mail: t(d.mail, 120) };
  if (r.mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.mail)) r.mail = "";
  if (!servizio) return { errore: "scegli il servizio" };
  if (!r.da) return { errore: "manca da dove" };
  if (!r.a && servizio !== "Sgombero") return { errore: "manca a dove" };
  if (!r.nome) return { errore: "manca il nome" };
  if (!r.telefono && !r.mail) return { errore: "serve un telefono o una mail per mandarti il preventivo" };
  if (d.consenso !== true) return { errore: "serve il consenso per ricontattarti" };
  // ══ LE AZIENDE — 27 settembre ══ JJ: «per le aziende devi per forza fare
  // fattura… serve mettere iban nel preventivo». I dati della fattura
  // elettronica: ragione sociale, P.IVA, codice destinatario o PEC, sede.
  if (d.azienda === true) {
    const a = { ragione_sociale: t(d.ragione_sociale, 120), piva: String(d.piva || "").replace(/^IT/i, "").replace(/\s/g, ""),
                sdi: String(d.sdi || "").trim().toUpperCase(), pec: t(d.pec, 120), sede: t(d.sede, 160) };
    if (!a.ragione_sociale) return { errore: "manca la ragione sociale" };
    if (!/^\d{11}$/.test(a.piva)) return { errore: "la partita IVA ha 11 cifre" };
    if (a.sdi && !/^[A-Z0-9]{7}$/.test(a.sdi)) a.sdi = "";
    if (a.pec && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.pec)) a.pec = "";
    if (!a.sdi && !a.pec) return { errore: "serve il codice destinatario (7 caratteri) o la PEC per la fattura" };
    if (!a.sede) return { errore: "manca la sede per la fattura" };
    return { richiesta: { ...r, consenso: true, tipo: "azienda", fattura: a } };
  }
  return { richiesta: { ...r, consenso: true, tipo: "privato" } };
}

// Il testo che arriva al cliente: lo vede JJ prima che parta.
// ══ LA CAPARRA — 27 settembre 2026 ══ JJ: «se mi contatta gente che vuole
// provare a fare un lavoro a gratis… va fatto qualcosa che mi tutela»; poi
// «va bene come hai detto»: caparra CONFIRMATORIA (art. 1385 c.c.) del 30%
// sopra i 100 €, tutto anticipato sotto, saldo prima dello scarico. Su PayPal
// «beni e servizi» (ricevuta e protezione). Da confermare col commercialista.
export const PAYPAL = "19.jjardito93@gmail.com";
export const SOGLIA_CAPARRA = 100;
export function caparraDi(prezzo) {
  const p = Number(prezzo) || 0;
  return p < SOGLIA_CAPARRA ? { importo: p, tutto: true } : { importo: Math.ceil(p * 0.3 / 5) * 5, tutto: false };
}

export const PAGINA_PRENOTA = "https://jjoeboy93.github.io/athena-trasporti/prenota.html";
export const linkPrenota = (r) => `${PAGINA_PRENOTA}?p=${r.id}&k=${r.chiave}`;

// Aziende: niente caparra, bonifico a 30 giorni dalla fattura (JJ: «le
// aziende di solito pagano a 30/60/90 giorni»; termini diversi si dicono).
export const GIORNI_AZIENDE = 30;
export function testoCliente(r, prezzo, iban = "") {
  const conTappe = r.tappe && r.tappe.length ? `, con tappe a ${r.tappe.join(", ")},` : "";
  const tratta = r.a ? `da ${r.da}${conTappe} a ${r.a}` : `a ${r.da}`;
  return `Buongiorno ${r.nome},\n` +
    `per ${r.servizio.toLowerCase()} ${tratta}${r.quando ? ` (${r.quando})` : ""} il prezzo è ${prezzo} €, tutto compreso: ` +
    `carburante, pedaggi e tempo di lavoro. È il prezzo finale, senza IVA da aggiungere${r.tipo === "azienda" ? " (regime forfettario)" : ""}.\n` +
    (r.id && r.chiave
      ? `Se va bene, scegli il giorno e conferma qui:\n${linkPrenota(r)}\n` +
        (r.tipo === "azienda"
          ? `Pagamento con bonifico a ${GIORNI_AZIENDE} giorni dalla data della fattura elettronica${iban ? ` (IBAN ${iban}, intestato ad Ardito Jacopo Joe)` : ""}. Se avete termini diversi, ditemelo prima.\n`
          : caparraDi(prezzo).tutto
          ? `Il giorno si blocca col pagamento anticipato di ${prezzo} € ${iban ? "con PayPal o bonifico" : "su PayPal"}.\n`
          : `Il giorno si blocca con una caparra di ${caparraDi(prezzo).importo} € ${iban ? "con PayPal o bonifico" : "su PayPal"}; il resto si paga prima dello scarico.\n`) +
        `Per qualsiasi domanda rispondi a questo messaggio.\n\n`
      : `Se va bene, rispondi a questo messaggio e fissiamo il giorno.\n\n`) +
    `Athena Trasporti — 377 594 7995`;
}

export const linkWa = (numero, testo) => `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;
// JJ, 27 settembre: il WhatsApp Business di Athena sta su un altro telefono e
// su questo non si puo' affiancare; ci arriva solo da WhatsApp Web. Questo
// link apre la chat del cliente, col testo pronto, nel WhatsApp Web collegato.
export const linkWaWeb = (numero, testo) => `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(testo)}`;


// ══ SPRINTER O PANDA — 27 settembre ══ JJ: «furgone o macchina come lo
// sceglie il motore? hanno costi e guadagni diversi». Il motore NON sceglie:
// cosa c'e' da portare lo sa JJ leggendo le note. Calcola tutti e due e JJ
// tocca il tasto del mezzo che usera'. Lo sgombero e' sempre Sprinter.
export function dueMezzi(p, soloQuello = false) {
  const primo = p.mezzo || "sprinter";
  const r = calcola({ ...p, mezzo: primo });
  if (!soloQuello) r.altro = calcola({ ...p, mezzo: primo === "sprinter" ? "panda" : "sprinter" });
  return r;
}

// ══ L'INGOMBRO — 27 settembre ══ JJ: «fai la domanda secca, ovviamente se
// selezionano sgombero solo furgone». La risposta del cliente decide quale
// mezzo si calcola per primo e quali tasti vede JJ:
//   auto    → Panda per prima, Sprinter come alternativa
//   furgone → solo Sprinter
//   nonso   → Sprinter per primo, Panda come alternativa
export const INGOMBRI = { auto: "sta in un'auto", furgone: "serve un furgone", nonso: "non lo sa" };
export function mezziPer(ingombro, servizio) {
  if (servizio === "Sgombero" || ingombro === "furgone") return { mezzo: "sprinter", solo: true };
  return { mezzo: ingombro === "auto" ? "panda" : "sprinter", solo: false };
}


// ══ IL CALENDARIO — 27 settembre ════════════════════════════════════════
// JJ: «non devo segnare io il lavoro, se dice si, lo segna nel calendario».
// Il cliente sceglie il giorno dalla pagina del link nel preventivo: la porta
// segna e avvisa JJ. Due fasce, mattina e pomeriggio; un lavoro oltre le 4
// ore le prende tutte e due. Tutti i giorni aperti (JJ: «adesso non dice no a
// niente»); li chiude JJ da Telegram. Il sito vede solo libero/occupato.
export const FASCE = ["mattina", "pomeriggio"];
export const GIORNI_AVANTI = 45;
export const serveGiornata = (ore) => (ore || 0) > 4;

export function giornoIso(d) { return d.toISOString().slice(0, 10); }
export function giorniPrenotabili(oggi = new Date()) {
  const g = [];
  for (let i = 1; i <= GIORNI_AVANTI; i++) g.push(giornoIso(new Date(oggi.getTime() + i * 86400000)));
  return g;
}
// «12/10», «12/10/2026», «2026-10-12» → ISO; il resto → ""
export function leggiData(s, oggi = new Date()) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (!m) return "";
  let anno = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : oggi.getUTCFullYear();
  const iso = `${anno}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  if (!m[3] && iso < giornoIso(oggi)) return `${anno + 1}${iso.slice(4)}`;
  return isNaN(Date.parse(iso)) ? "" : iso;
}
// Quello che il sito puo' vedere: solo quali fasce sono prese, di nessuno.
export function occupati(cal) {
  const o = {};
  for (const [g, f] of Object.entries(cal || {})) { const prese = FASCE.filter((x) => f[x]); if (prese.length) o[g] = prese; }
  return o;
}
export function libero(cal, giorno, fasce) { return fasce.every((x) => !(cal[giorno] && cal[giorno][x])); }
