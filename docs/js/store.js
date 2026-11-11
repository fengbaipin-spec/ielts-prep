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
  newPerDay: 10, newFrom: 1, autoSay: true, examType: "A", examDate: "", recognize: false,
  reviewSrc: "recent", reviewDays: 7, reviewVol: 1, reviewWhole: false, reviewDir: "en", reviewN: 20,
  spellMode: "words", spellSrc: "learned", accents: true
};
export const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
export const saveSettings = () => store.set("settings", settings);

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
