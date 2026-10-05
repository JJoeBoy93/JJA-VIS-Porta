// Il filtro della piazza: soprannomi e messaggi (JJ, 5/10: «il nickname sopra all'avatar, non il nome personale», «la chat
// tra persone indipendente da quella di Twitch»). È un primo filtro, non una moderazione: blocca le parole più pesanti
// (bestemmie, insulti, offese per razza, orientamento o disabilità), i link e i numeri di telefono. Chi scrive cose
// brutte lo silenzi tu, dal suo soprannome; chi insiste viene zittito dalla piazza per dieci minuti.

// le parole si confrontano «schiacciate»: minuscole, senza accenti, 4→a 3→e 1→i 0→o 5→s @→a $→s, senza spazi né segni,
// lettere ripetute ridotte a una: così «c4zz0», «s t r o n z o» e «cazzzo» sono la stessa cosa
export function schiaccia(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[4@]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}
// radici già schiacciate (lettere doppie ridotte a una)
const PESANTI = [
  // bestemmie
  "poriodio", "porcodio", "diocan", "dioporc", "diobestia", "diomerd", "porcamadon", "madonaputana", "madonatroia", "diolad", "cristodio", "porcocristo",
  // insulti
  "caz", "stronz", "vafancul", "fancul", "putan", "troia", "zocol", "bocchin", "pompin", "minchi", "coglion", "figadi", "merdos", "pezodimerd",
  "fuck", "shit", "bitch", "cunt", "whore", "slut", "dick", "pusy", "asshole",
  // odio
  "negr", "nigg", "nigr", "frocio", "froci", "ricchion", "culaton", "fagot", "faget", "retard", "ritardat", "mongoloid", "handicapat", "spastic",
  "terone", "polacon", "zingar", "ebreidimerd", "hitler", "nazis", "kkk",
];
// radici corte che stanno dentro parole buone: valgono solo da sole (es. «caz» sta in «scazzottata», «dick» in «dickens», «negr» in «negroni»)
const INTERE = new Set(["caz", "dick", "kkk", "negr", "terone"]);

export function pesante(t) {
  const s = schiaccia(t);
  for (const p of PESANTI) if (!INTERE.has(p) && s.includes(p)) return true;
  // le corte: parola per parola
  for (const w of String(t).toLowerCase().split(/[^a-z0-9@$!|]+/)) { const x = schiaccia(w); for (const p of INTERE) if (x.startsWith(p) && x.length <= p.length + (p === "negr" ? 2 : 1)) return true; }
  return false;
}
// un link o un indirizzo: niente, nemmeno spezzato
export const link = t => /(https?:|www\.|\b[a-z0-9-]+\s*(\.|\(dot\)|\[dot\]| dot )\s*(com|it|net|org|io|ly|gg|me|tv|xyz|ru|co|app|link)\b|t\.me|discord\s*\.?\s*gg)/i.test(t);
// un numero di telefono (7 cifre o più, anche con spazi o trattini): i dati personali non si scrivono in piazza
export const telefono = t => /(\d[\s.\-\/]*){7,}/.test(t);

// il soprannome: 3–16 tra lettere, numeri, spazio, _ . -; niente parole pesanti, niente link, niente numeri lunghi
export function soprannome(n) {
  if (typeof n !== "string") return null;
  const s = n.normalize("NFC").replace(/\s+/g, " ").trim();
  if (s.length < 3 || s.length > 16) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(s)) return null;
  if (pesante(s) || link(s) || telefono(s)) return null;
  return s;
}
// il messaggio: 1–200 caratteri, una riga, senza caratteri di controllo. Ritorna {testo} o {no: perché}
export function messaggio(t) {
  if (typeof t !== "string") return { no: "vuoto" };
  const s = t.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return { no: "vuoto" };
  if (s.length > 200) return { no: "lungo" };
  if (link(s)) return { no: "link" };
  if (telefono(s)) return { no: "numero" };
  if (pesante(s)) return { no: "parole" };
  return { testo: s };
}
