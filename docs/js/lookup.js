// Tap-a-word lookup: finds the vocabulary entry a word in a sentence belongs to, also from a plural, a past tense,
// an -ing form, an adverb in -ly or a word of the same family (analysis → analyse), and multi-word entries
// around it (climate change, fossil fuels). Has no page code, so it can be tested with Node.
export const WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
export const wordsOf = text => text.match(WORD) || [];
const low = s => s.toLowerCase().replace(/’/g, "'");

// irregular forms of the verbs in the word list
const IRREGULAR = { sought: "seek", spent: "spend", brought: "bring", grew: "grow", grown: "grow", rose: "rise", risen: "rise",
  fell: "fall", fallen: "fall", made: "make", led: "lead", chose: "choose", chosen: "choose", children: "child", women: "woman", men: "man",
  undertook: "undertake", undertaken: "undertake", underwent: "undergo", undergone: "undergo", oversaw: "oversee", overseen: "oversee",
  withstood: "withstand", dug: "dig", sown: "sow", took: "take", taken: "take", broke: "break", broken: "break", held: "hold",
  paid: "pay", sold: "sell", bought: "buy", built: "build", kept: "keep", sent: "send", told: "tell", thought: "think",
  understood: "understand", won: "win", wrote: "write", written: "write", drew: "draw", drawn: "draw", fled: "flee",
  hid: "hide", hidden: "hide", forgot: "forget", forgotten: "forget", began: "begin", begun: "begin", ran: "run", spoke: "speak", spoken: "speak" };

// the forms a word could come from; each candidate is only a guess, the word list decides
export function lemmas(t) {
  const out = new Set([t]);
  const add = x => { if (x && x.length > 1) out.add(x); };
  if (t.endsWith("'s")) add(t.slice(0, -2));
  if (t.endsWith("ies")) add(t.slice(0, -3) + "y");
  if (t.endsWith("es")) add(t.slice(0, -2));
  if (t.endsWith("s") && !t.endsWith("ss")) add(t.slice(0, -1));
  if (t.endsWith("ied")) add(t.slice(0, -3) + "y");
  if (t.endsWith("ed")) {
    add(t.slice(0, -2));
    add(t.slice(0, -1));
    if (/([^aeiou])\1ed$/.test(t)) add(t.slice(0, -3));
  }
  if (t.endsWith("ing")) {
    add(t.slice(0, -3));
    add(t.slice(0, -3) + "e");
    if (/([^aeiou])\1ing$/.test(t)) add(t.slice(0, -4));
  }
  if (t.endsWith("ily")) add(t.slice(0, -3) + "y");
  if (t.endsWith("ly")) add(t.slice(0, -2));
  if (t.endsWith("er")) { add(t.slice(0, -2)); add(t.slice(0, -1)); }
  if (t.endsWith("est")) { add(t.slice(0, -3)); add(t.slice(0, -2)); }
  if (IRREGULAR[t]) add(IRREGULAR[t]);
  return [...out];
}

// entries: [{ hw, fam, … }] → { lookup(sentence, k) → { word, phrases: [entry], hits: [{ e, how }] } }
export function createLookup(entries) {
  const single = new Map();   // a word, or a word of the family → [{ e, how }]
  const phrases = [];         // multi-word headwords
  const put = (k, e, how) => {
    if (!single.has(k)) single.set(k, []);
    if (!single.get(k).some(x => x.e === e)) single.get(k).push({ e, how });
  };
  for (const e of entries) {
    const hw = low(e.hw);
    if (hw.includes(" ")) phrases.push({ toks: wordsOf(hw), e });
    else put(hw, e, "");
    for (const f of (e.fam || "").split(",")) {
      const w = low(f.replace(/\(.*?\)/g, "").trim());
      if (w && !w.includes(" ")) put(w, e, "同族词");
    }
  }
  function lookup(sentence, k) {
    const raw = wordsOf(sentence), toks = raw.map(low), t = toks[k];
    if (!t) return null;
    const res = { word: raw[k], phrases: [], hits: [] };
    for (const p of phrases) {
      const n = p.toks.length;
      for (let j = 0; j < n; j++) {
        const s = k - j;
        if (s < 0 || s + n > toks.length || res.phrases.includes(p.e)) continue;
        // the last word may be inflected: fossil fuels, the elderly
        if (p.toks.every((pt, m) => toks[s + m] === pt || (m === n - 1 && lemmas(toks[s + m]).includes(pt)))) res.phrases.push(p.e);
      }
    }
    for (const c of lemmas(t)) {
      for (const h of single.get(c) || []) {
        if (res.hits.some(x => x.e === h.e)) continue;
        res.hits.push({ e: h.e, how: h.how || (c === t ? "" : "变形") });
      }
    }
    return res;
  }
  return { lookup, size: single.size };
}
