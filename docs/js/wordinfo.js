// The word pop-up: tap any word in an example, an essay or a model answer to hear it and see its entry, or get
// links to an online dictionary when the word is not in the app's list.
import { esc, ICON, openSheet, closeSheet, toast } from "./util.js";
import { store } from "./store.js";
import { speakOne } from "./speech.js";
import { words, openInDict, synList } from "./dict.js";
import { createLookup, WORD } from "./lookup.js";

let L = null;
const finder = () => L || (L = createLookup(words()));
export const warmLookup = () => setTimeout(finder, 300);

// a sentence with every word in its own tappable span; k counts the words
export function tapWords(text) {
  let k = 0, last = 0, html = "";
  for (const m of text.matchAll(WORD)) {
    html += esc(text.slice(last, m.index)) + `<span class="wd" data-k="${k++}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return html + esc(text.slice(last));
}

export function hintOnce() {
  if (store.get("wordHint", false)) return;
  store.set("wordHint", true);
  toast("提示：点句子里的单词，可以看解释", 4000);
}

const card = (e, how) => `<div class="wi-card">
    <div class="wi-head"><button type="button" class="w" data-wi="say" data-text="${esc(e.hw)}" lang="en">${esc(e.hw)}${ICON.spk}</button></div>
    ${how ? `<p class="wi-note">${esc(how)}</p>` : ""}
    <div class="ipa-row"><span class="ipa">${esc(e.ipa)}</span><span class="pos">${esc(e.pos)}</span></div>
    <div class="zh">${esc(e.zh)}</div>
    <p class="wi-def" lang="en">${esc(e.def)}</p>
    ${e.syn ? `<p class="wi-syn"><span class="lbl">同义</span><span lang="en">${synList(e).map(esc).join(" · ")}</span></p>` : ""}
    <button type="button" class="linkbtn" data-wi="open" data-hw="${esc(e.hw)}">在词汇里看${ICON.fwd}</button>
  </div>`;

export function showWord(sentence, k, el, sayAll) {
  const r = finder().lookup(sentence, k);
  if (!r) return;
  document.querySelectorAll(".wd.on").forEach(x => x.classList.remove("on"));
  if (el) el.classList.add("on");
  const word = r.word.replace(/’/g, "'");
  const q = encodeURIComponent(word.toLowerCase().replace(/'s$/, ""));
  let html = `<div class="wordinfo">
    <div class="wi-top">
      <button type="button" class="w" data-wi="say" data-text="${esc(word)}" lang="en">${esc(word)}${ICON.spk}</button>
      ${sayAll ? `<button type="button" class="txtbtn" data-wi="all">${ICON.play}朗读整句</button>` : ""}
    </div>`;
  if (r.phrases.length) html += `<p class="wi-sec">这里是一个词组</p>` + r.phrases.map(e => card(e, "")).join("");
  if (r.hits.length) html += `<p class="wi-sec">词汇表里的词</p>` + r.hits.slice(0, 2).map(h => card(h.e, h.how === "同族词" ? `${word} 是 ${h.e.hw} 的同族词` : h.how === "变形" ? `${word} 是 ${h.e.hw} 的变化形式` : "")).join("");
  if (!r.phrases.length && !r.hits.length) html += `<p class="wi-none">这个词不在 App 的词汇表里。</p>`;
  html += `<p class="wi-links">查词典：<a href="https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${q}" target="_blank" rel="noopener">剑桥英汉词典</a> · <a href="https://dict.youdao.com/result?word=${q}&lang=en" target="_blank" rel="noopener">有道词典</a></p></div>`;
  openSheet("单词解释", html, e => {
    const b = e.target.closest("[data-wi]");
    if (!b) return;
    if (b.dataset.wi === "say") speakOne(b.dataset.text, "en", b);
    else if (b.dataset.wi === "all") sayAll();
    else if (b.dataset.wi === "open") { const hw = b.dataset.hw; closeSheet(false, () => openInDict(hw)); }
  });
}
