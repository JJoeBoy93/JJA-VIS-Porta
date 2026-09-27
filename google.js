// ══ IL CALENDARIO DI JJ, QUELLO VERO — 27 settembre 2026 (Athena) ══════
// JJ: «deve essere lo stesso calendario dove poi Jarvis mi fa il briefing e
// segna appuntamenti e compleanni… se segno un appuntamento da Jarvis deve
// sapere che posso o non posso».
//
// JARVIS scrive nel calendario Google di JJ (quello di cui e' proprietario,
// sincronizzato: MainActivity.calendarioScrivibile) e il briefing legge tutti
// i calendari del telefono. La porta entra con un ACCOUNT DI SERVIZIO:
//   CAL_JJ      il calendario personale, condiviso «solo disponibilita'»:
//               la porta vede quando JJ e' occupato, mai cosa fa
//   CAL_ATHENA  il calendario «Athena Trasporti», condiviso «modifiche»:
//               qui la porta scrive i lavori prenotati e i giorni chiusi
// GOOGLE_SA e' il JSON della chiave dell'account di servizio.
//
// Gli eventi di tutto il giorno del calendario personale NON bloccano: sono
// i compleanni che JARVIS segna come occupati. Un giorno di ferie si chiude
// con /chiudi (va in CAL_ATHENA) finche' JARVIS non segna i compleanni liberi.
export const FINESTRE = { mattina: [8, 13], pomeriggio: [13, 19] };
const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";
let gettone = { valore: "", scade: 0 };

export const googleCollegato = (env) => Boolean(env.GOOGLE_SA && env.CAL_JJ && env.CAL_ATHENA);

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlTesto = (s) => b64url(new TextEncoder().encode(s));

async function tokenGoogle(env) {
  if (gettone.valore && Date.now() < gettone.scade - 60000) return gettone.valore;
  let sa;
  try { sa = JSON.parse(env.GOOGLE_SA); } catch { throw new Error("GOOGLE_SA non è il JSON della chiave"); }
  const pem = String(sa.private_key || "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  if (!pem || !sa.client_email) throw new Error("GOOGLE_SA senza private_key o client_email");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chiave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ora = Math.floor(Date.now() / 1000);
  const corpo = `${b64urlTesto(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64urlTesto(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: ora, exp: ora + 3600 }))}`;
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chiave, new TextEncoder().encode(corpo));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${corpo}.${b64url(firma)}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google non dà il permesso: ${j.error_description || j.error || r.status}`);
  gettone = { valore: j.access_token, scade: Date.now() + (j.expires_in || 3600) * 1000 };
  return gettone.valore;
}

async function google(env, metodo, percorso, corpo) {
  const r = await fetch(`${API}${percorso}`, { method: metodo,
    headers: { Authorization: `Bearer ${await tokenGoogle(env)}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Calendar ${r.status}: ${(j.error && j.error.message) || ""}`);
  return j;
}

// L'ora di Roma → istante UTC (ora legale compresa).
function scartoRoma(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}
export function istanteRoma(giorno, ora) {
  const [y, m, d] = giorno.split("-").map(Number);
  const finto = Date.UTC(y, m - 1, d, ora);
  return finto - scartoRoma(finto);
}
const locale = (giorno, ora) => `${giorno}T${String(ora).padStart(2, "0")}:00:00`;

// Le fasce occupate nei giorni chiesti, dai due calendari.
// Un calendario che risponde con un errore NON vale «libero»: si solleva.
export async function occupatiGoogle(env, giorni) {
  if (!giorni.length) return {};
  const primo = giorni[0], ultimo = giorni[giorni.length - 1];
  const j = await google(env, "POST", "/freeBusy", {
    timeMin: new Date(istanteRoma(primo, 0)).toISOString(), timeMax: new Date(istanteRoma(ultimo, 24)).toISOString(),
    timeZone: "Europe/Rome", items: [{ id: env.CAL_JJ }, { id: env.CAL_ATHENA }] });
  const fuori = {};
  for (const id of [env.CAL_JJ, env.CAL_ATHENA]) {
    const c = (j.calendars || {})[id];
    if (!c) throw new Error(`Google non ha detto niente del calendario ${id === env.CAL_ATHENA ? "Athena" : "personale"}`);
    if (c.errors && c.errors.length) throw new Error(`calendario ${id === env.CAL_ATHENA ? "Athena" : "personale"} non leggibile: ${c.errors.map((e) => e.reason).join(", ")} — è condiviso con l'account di servizio?`);
    for (const b of c.busy || []) {
      const a = Date.parse(b.start), z = Date.parse(b.end);
      for (const g of giorni) {
        // tutto il giorno nel calendario personale (i compleanni): non blocca
        if (id === env.CAL_JJ && a <= istanteRoma(g, 0) && z >= istanteRoma(g, 24)) continue;
        for (const [f, [da, fino]] of Object.entries(FINESTRE)) {
          if (a < istanteRoma(g, fino) && z > istanteRoma(g, da)) (fuori[g] = fuori[g] || new Set()).add(f);
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(fuori).map(([g, s]) => [g, [...s]]));
}

// Un lavoro o una chiusura nel calendario «Athena Trasporti». Torna l'id.
export async function segnaGoogle(env, { giorno, fasce, titolo, dettagli }) {
  const da = Math.min(...fasce.map((f) => FINESTRE[f][0])), fino = Math.max(...fasce.map((f) => FINESTRE[f][1]));
  const e = await google(env, "POST", `/calendars/${encodeURIComponent(env.CAL_ATHENA)}/events`, {
    summary: titolo, description: dettagli || "",
    start: { dateTime: locale(giorno, da), timeZone: "Europe/Rome" }, end: { dateTime: locale(giorno, fino), timeZone: "Europe/Rome" } });
  return e.id;
}
export const togliGoogle = (env, id) => google(env, "DELETE", `/calendars/${encodeURIComponent(env.CAL_ATHENA)}/events/${encodeURIComponent(id)}`);
