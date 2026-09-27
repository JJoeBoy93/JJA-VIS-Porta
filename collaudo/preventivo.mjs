// Il motore del preventivo, senza rete.   node collaudo/preventivo.mjs
// 27 settembre 2026 (Athena). Il modello deve rifare i conti del vault
// (Marche 1232 €); il percorso con openrouteservice finto: partenza e
// ritorno a vuoto, tratti a pedaggio, errori detti per nome, chiave mai fuori.
import { calcola, leggiComando, percorso, comandoStima } from "../preventivo.js";
let errori = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) errori++; };
const CHIAVE = "orsFINTAsegretissima";

console.log("── il modello v2 rifà i conti del vault");
let r = calcola({ km: 820, kmPedaggio: 100 / 0.12, oreGuida: 12, oreFacchinaggio: 6, aiutanti: 1 });
ok(Math.abs(r.costo - 1232) < 1 && r.prezzo === 1235, `Marche: costo ${r.costo.toFixed(0)} € (vault 1232), proposta ${r.prezzo} €`);
r = calcola({ km: 120, oreGuida: 3, urgente: true, mezzo: "panda" });
ok(r.voci.some((v) => v[0] === "urgenza") && r.mezzo === "Panda", `urgenza Panda 120 km, 3 h: ${r.prezzo} €`);
ok(r.prezzo % 5 === 0 && r.prezzo >= r.costo, "arrotonda a 5 € in su, mai sotto il costo");
let lanciato = false; try { calcola({ km: 1, oreGuida: 1, mezzo: "tir" }); } catch { lanciato = true; }
ok(lanciato, "un mezzo sconosciuto si rifiuta");

console.log("── il comando");
const c = leggiComando("/stima Via Roma 3, Limbiate > Seriate fac 2 aiut 1 urgente panda");
ok(c.da === "Via Roma 3, Limbiate" && c.a === "Seriate" && c.oreFacchinaggio === 2 && c.aiutanti === 1 && c.urgente && c.mezzo === "panda", "legge da, a e le opzioni");
ok(leggiComando("/stima Limbiate") === null, "senza «>» non indovina");
ok(leggiComando("/stima Monza > Como fac 1,5").oreFacchinaggio === 1.5, "la virgola nei decimali");

console.log("── il percorso, con openrouteservice finto");
let chiamate = [];
const finto = ({ geo = true, strada = true, pedaggio = true } = {}) => { chiamate = []; globalThis.fetch = async (url, o = {}) => {
  chiamate.push({ url: String(url), o });
  const j = (s, b) => new Response(JSON.stringify(b), { status: s });
  if (String(url).includes("/geocode/")) {
    const t = new URL(url).searchParams.get("text");
    return geo ? j(200, { features: [{ geometry: { coordinates: [9 + t.length / 100, 45.6] }, properties: { label: t + ", Italia" } }] }) : j(200, { features: [] });
  }
  if (!strada) return j(403, { error: { message: "Access to this API has been disallowed" } });
  return j(200, { routes: [{ summary: { distance: 140000, duration: 7200 }, extras: pedaggio ? { tollways: { summary: [{ value: 0, distance: 80000 }, { value: 1, distance: 60000 }] } } : undefined }] });
}; };
const env = { ORS_KEY: CHIAVE, PARTENZA: "Limbiate" };
finto(); let s = await percorso(env, "Monza", "Seriate");
const corpo = JSON.parse(chiamate.at(-1).o.body);
ok(corpo.coordinates.length === 4 && JSON.stringify(corpo.coordinates[0]) === JSON.stringify(corpo.coordinates[3]), "partenza → carico → scarico → partenza");
ok(corpo.extra_info.includes("tollways") && chiamate.at(-1).o.headers.Authorization === CHIAVE, "chiede i tratti a pedaggio, chiave nell'intestazione");
ok(s.km === 140 && s.kmPedaggio === 60 && s.oreGuida === 2, "km 140, 60 a pedaggio, 2 ore");
ok(chiamate.every((x) => !x.url.includes("/geocode/") || x.url.includes("boundary.country=IT")), "cerca gli indirizzi solo in Italia");

let t = await comandoStima(env, "/stima Monza > Seriate fac 1");
ok(/→ \d+ €/.test(t) && t.includes("caselli: 7 €") && t.includes("facchinaggio"), "il messaggio per JJ ha le voci e il prezzo");
ok(!t.includes(CHIAVE), "la chiave non esce nel messaggio");

finto({ pedaggio: false }); t = await comandoStima(env, "/stima Monza > Seriate");
ok(t.includes("non ha detto i tratti a pedaggio"), "se ORS non dice i pedaggi, lo dice (non «0 €» muto)");

console.log("── gli errori, per nome");
const errore = async (e, testo) => { try { await comandoStima(e, testo); return ""; } catch (x) { return x.message; } };
ok((await errore({ PARTENZA: "Limbiate" }, "/stima A > B")).includes("manca ORS_KEY"), "senza chiave: «manca ORS_KEY»");
ok((await errore({ ORS_KEY: CHIAVE }, "/stima A > B")).includes("manca PARTENZA"), "senza partenza: «manca PARTENZA»");
finto({ geo: false }); ok((await errore(env, "/stima Xyzzy > B")).includes("non trovato"), "indirizzo introvabile: detto");
finto({ strada: false }); const m = await errore(env, "/stima A > B");
ok(m.includes("403") && !m.includes(CHIAVE), "chiave rifiutata: «403», senza la chiave — " + m);
ok((await comandoStima(env, "/stima")).startsWith("Scrivi così"), "/stima vuoto spiega come si scrive");

console.log(errori ? `\nROSSO: ${errori}` : "\nVERDE");
process.exit(errori ? 1 : 0);
