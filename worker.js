// ══ LA PORTA DI JJA-VIS ══
// Riceve le risposte della pagina pubblica e le scrive, una per file, in
// un archivio privato (JJoeBoy93/JJA-VIS-Voci). Non legge niente, non
// risponde a nessuno, non parla con JARVIS: e' una cassetta delle lettere.
//
// Perche' sta qui e non sullo Space: quello che scrive uno sconosciuto non
// deve toccare la macchina di JARVIS, che ha in mano il vault. Vedi
// progetto/decisioni/i-prodotti-sono-di-jjavis.md nel vault.
//
// Segreto: GH_TOKEN, un token che puo' scrivere SOLO in JJA-VIS-Voci.
// Se manca, la porta lo dice invece di fingere di aver salvato.

const ARCHIVIO = "JJoeBoy93/JJA-VIS-Voci";
const ORIGINI = ["https://jjoeboy93.github.io"];
const TETTO_CORPO = 8000;

function cors(origine) {
  const ok = ORIGINI.includes(origine);
  return {
    "Access-Control-Allow-Origin": ok ? origine : ORIGINI[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function risposta(corpo, stato, origine) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origine) },
  });
}

const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function pulisci(d) {
  const r = {
    quando: new Date().toISOString(),
    mestiere: testo(d.mestiere, 60),
    tempo: testo(d.tempo, 80),
    dettaglio: testo(d.dettaglio, 800),
    prezzo_al_mese: Math.max(0, Math.min(100, Math.round(Number(d.prezzo) || 0))),
    voti: Array.isArray(d.voti) ? d.voti.slice(0, 3).map((v) => testo(v, 100)).filter(Boolean) : [],
    proposta: testo(d.proposta, 200),
    messaggio: "",
  };
  const mail = testo(d.mail, 120);
  // Nome, mail e messaggio si tengono solo col consenso: senza, si butta
  // tutto quello che identifica una persona.
  if (mail && d.consenso === true && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    r.nome = testo(d.nome, 60);
    r.mail = mail;
    r.consenso = true;
    r.messaggio = testo(d.messaggio, 1500);
  }
  return r;
}

async function scrivi(env, r) {
  const giorno = r.quando.slice(0, 10);
  const nome = `${r.quando.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`;
  const percorso = `risposte/${giorno}/${nome}`;
  const contenuto = btoa(unescape(encodeURIComponent(JSON.stringify(r, null, 2) + "\n")));
  const res = await fetch(`https://api.github.com/repos/${ARCHIVIO}/contents/${percorso}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "jjavis-porta",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: `risposta ${r.mestiere || "senza mestiere"}`, content: contenuto }),
  });
  if (!res.ok) {
    let perche = "";
    try { perche = (await res.json()).message || ""; } catch {}
    throw new Error(`GitHub ha risposto ${res.status}${perche ? ": " + perche : ""}`);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origine = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origine) });
    // ══ LA PORTA SI CONTROLLA DA UN BROWSER ══
    // 25 settembre: la pagina diceva solo «502» e non si sapeva perche'.
    // Qui si chiede davvero a GitHub se il token vede l'archivio e puo'
    // scriverci, senza scrivere niente. Si apre dal telefono e si legge.
    if (req.method === "GET" && url.pathname === "/") {
      if (!env.GH_TOKEN) return risposta({ porta: "accesa", archivio: "manca GH_TOKEN" }, 200, origine);
      const r = await fetch(`https://api.github.com/repos/${ARCHIVIO}`, {
        headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "jjavis-porta" },
      });
      let d = {};
      try { d = await r.json(); } catch {}
      return risposta({
        porta: "accesa",
        github_risponde: r.status,
        messaggio: d.message || "",
        vede_l_archivio: r.ok,
        puo_scrivere: r.ok ? Boolean(d.permissions && d.permissions.push) : false,
      }, 200, origine);
    }
    if (req.method !== "POST" || url.pathname !== "/risposta") return risposta({ errore: "non c'e' niente qui" }, 404, origine);
    if (!ORIGINI.includes(origine)) return risposta({ errore: "origine non ammessa" }, 403, origine);

    const grezzo = await req.text();
    if (grezzo.length > TETTO_CORPO) return risposta({ errore: "troppo lungo" }, 413, origine);
    let d;
    try { d = JSON.parse(grezzo); } catch { return risposta({ errore: "non e' JSON" }, 400, origine); }
    // Il campo nascosto lo riempiono solo i robot: si risponde ok e si butta.
    if (typeof d.sito === "string" && d.sito.trim()) return risposta({ ok: true }, 200, origine);
    if (!env.GH_TOKEN) return risposta({ errore: "archivio non collegato" }, 503, origine);

    try {
      await scrivi(env, pulisci(d));
      return risposta({ ok: true }, 201, origine);
    } catch (e) {
      return risposta({ errore: String(e.message || e) }, 502, origine);
    }
  },
};
