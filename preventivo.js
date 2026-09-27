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
  const [daGrezzo, resto = ""] = corpo.split(">");
  if (!daGrezzo.trim() || !resto.trim()) return null;
  const opz = { oreFacchinaggio: 0, aiutanti: 0, urgente: false, mezzo: "sprinter" };
  let a = resto;
  a = a.replace(/\bfac(?:chinaggio)?\s+(\d+(?:[.,]\d+)?)/i, (_, n) => { opz.oreFacchinaggio = parseFloat(n.replace(",", ".")); return ""; });
  a = a.replace(/\baiut(?:anti|ante)?\s+(\d+)/i, (_, n) => { opz.aiutanti = parseInt(n, 10); return ""; });
  a = a.replace(/\burgente\b/i, () => { opz.urgente = true; return ""; });
  a = a.replace(/\b(panda|sprinter)\b/i, (_, n) => { opz.mezzo = n.toLowerCase(); return ""; });
  return { da: daGrezzo.trim(), a: a.replace(/\s+/g, " ").trim(), ...opz };
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
export async function percorso(env, da, a) {
  if (!env.ORS_KEY) throw new Error("manca ORS_KEY nei segreti della porta");
  if (!env.PARTENZA) throw new Error("manca PARTENZA nei segreti della porta (il comune da cui parte JJ)");
  const [casa, p1, p2] = await Promise.all([geocodifica(env, env.PARTENZA), geocodifica(env, da), geocodifica(env, a)]);
  const r = await fetch(`${BASE(env)}/v2/directions/driving-car`, {
    method: "POST",
    headers: { "Authorization": env.ORS_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [casa.lngLat, p1.lngLat, p2.lngLat, casa.lngLat], extra_info: ["tollways"] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`percorso: openrouteservice ${r.status} ${(j.error && (j.error.message || j.error)) || ""}`.trim());
  const rt = (j.routes || [])[0];
  if (!rt) throw new Error("percorso: nessuna strada trovata");
  const pedaggio = ((rt.extras && rt.extras.tollways && rt.extras.tollways.summary) || []).find((s) => s.value === 1);
  return {
    km: rt.summary.distance / 1000,
    oreGuida: rt.summary.duration / 3600,
    kmPedaggio: pedaggio ? pedaggio.distance / 1000 : 0,
    pedaggioNoto: Boolean(rt.extras && rt.extras.tollways),
    da: p1.nome, a: p2.nome,
  };
}

export function testoStima(c, s, r) {
  const righe = [`🧮 STIMA — ${r.mezzo}${c.urgente ? " · URGENTE" : ""}`,
    `${s.da} → ${s.a}`, `(partenza e ritorno a vuoto compresi)`, ""];
  for (const [nome, euro, nota] of r.voci) righe.push(`${nome}: ${eur(euro)} €${nota ? ` — ${nota}` : ""}`);
  if (!s.pedaggioNoto) righe.push("⚠️ caselli: openrouteservice non ha detto i tratti a pedaggio");
  righe.push("", `→ ${r.prezzo} €`, "Prezzo pieno: gli sconti li decidi tu. I caselli sono una stima (classe B): se non tornano coi tuoi, dimmelo.");
  return righe.join("\n");
}

export async function comandoStima(env, testo) {
  const c = leggiComando(testo);
  if (!c) return "Scrivi così: /stima Limbiate > Seriate\nopzioni: fac 2 (ore di carico/scarico) · aiut 1 · urgente · panda";
  const s = await percorso(env, c.da, c.a);
  return testoStima(c, s, calcola({ ...c, ...s }));
}
