// Everything the app remembers lives in this phone's browser storage, under one prefix. The Italian app is
// served from the same site, so the prefix keeps the two apart.
const PREFIX = "ielts.";

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
  }
};

export const DEFAULTS = {
  rate: 0.9, voice: null, exOpen: false, playEx: false,
  // volume numbers; null means the first volume shown (newFrom) or the one new words come from (reviewVol)
  newPerDay: 10, newFrom: null, autoSay: true, examType: "A", examDate: "", recognize: false,
  reviewSrc: "recent", reviewDays: 7, reviewVol: null, reviewWhole: false, reviewDir: "en", reviewN: 20,
  spellMode: "words", spellSrc: "listen", accents: true, formSrc: "awl"
};
export const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
export const saveSettings = () => store.set("settings", settings);

// The reading volumes were added in front of the first six. Volume numbers stayed the same, but newFrom 1 used to be
// the default, "from the first volume"; it keeps that meaning, so new words now start with the reading volumes.
if (store.get("vocabLayout", 1) < 2) {
  if (settings.newFrom === 1) { settings.newFrom = null; saveSettings(); }
  store.set("vocabLayout", 2);
}

// starred words, by headword
export const stars = new Set(store.get("stars", []));
export const saveStars = () => store.set("stars", [...stars]);

// how often something went wrong, so it comes up more: paraphrases missed, numbers and names misheard
export function counter(key) {
  const map = new Map(Object.entries(store.get(key, {})));
  return {
    get: k => map.get(String(k)) || 0,
    hit(k, wrong) {
      if (wrong) map.set(String(k), (map.get(String(k)) || 0) + 1);
      else map.delete(String(k));
      store.set(key, Object.fromEntries(map));
    },
    size: () => map.size,
    all: () => Object.fromEntries(map),
    merge(obj) {
      for (const [k, n] of Object.entries(obj || {})) if (Number.isFinite(n) && n > (map.get(k) || 0)) map.set(k, n);
      store.set(key, Object.fromEntries(map));
    }
  };
}
export const paraMiss = counter("paraMiss");
