// 词形填空: a word's example sentence with that word left out; you write it in the form the sentence needs
// (analysed, analysis, significantly). The gap is found with the same rules as tap-a-word lookup: endings such as
// -s, -ed, -ing, -ly, and the words listed in the entry's word family.
import { $, esc, ICON, nav, shuffle } from "./util.js";
import { settings, saveSettings, stars } from "./store.js";
import { speakOne } from "./speech.js";
import { words, volume, volumes } from "./dict.js";
import { WORD, lemmas } from "./lookup.js";
import * as rec from "./srs.js";

const ROUND = 10;
let round = null;   // { items, pos, results, checked }
const low = s => s.toLowerCase().replace(/’/g, "'");
const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));

// where a word appears in its own example, in whatever form: { start, end, form }, or null for phrases and
// sentences where it cannot be found
const FOUND = new Map();
export function formIn(w) {
  if (FOUND.has(w.i)) return FOUND.get(w.i);
  let res = null;
  const hw = low(w.hw);
  if (!/\s/.test(hw)) {
    const fam = new Set(w.fam.split(",").map(f => low(f.replace(/\(.*?\)/g, "").trim())).filter(f => f && !/\s/.test(f)));
    for (const m of w.ex.matchAll(new RegExp(WORD.source, "g"))) {
      const t = low(m[0]), cands = lemmas(t);
      if (t === hw || cands.includes(hw) || fam.has(t) || cands.some(c => fam.has(c))) {
        res = { start: m.index, end: m.index + m[0].length, form: m[0] };
        break;
      }
    }
  }
  FOUND.set(w.i, res);
  return res;
}
const changed = w => low(formIn(w).form) !== low(w.hw);

function sources() {
  const all = words().filter(formIn), V = volume(settings.newFrom) || volumes()[0];
  return [
    { id: "awl", name: "学过的学术词", list: all.filter(w => rec.known(w.hw) && volume(w.v).level === "AWL") },
    { id: "learned", name: "已学的词", list: all.filter(w => rec.known(w.hw)) },
    { id: "stars", name: "收藏", list: all.filter(w => stars.has(w.hw)) },
    { id: "volume", name: V.name, list: all.filter(w => w.v === V.v) }
  ];
}

export function renderForms(view) {
  round = null;
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="fClose" aria-label="结束练习">${ICON.close}</button>
      <b class="rtitle">词形填空</b><span class="grow"></span><span class="vcount" id="fCount"></span>
    </div><div class="pbar"><i id="fBar"></i></div></header>
    <div class="drill pad" id="fBody"></div>`;
  $("fClose").onclick = leave;
  drawSetup();
  return false;
}

function drawSetup() {
  const src = sources();
  if (!src.some(s => s.id === settings.formSrc && s.list.length)) settings.formSrc = (src.find(s => s.list.length >= 5) || src.find(s => s.id === "volume")).id;
  $("fCount").textContent = "";
  $("fBar").style.width = "0";
  $("fBody").innerHTML = `<div id="fSetup" class="drill-in">
    <p class="lead">每轮 ${ROUND} 题。例句里挖掉一个词，给你它的原形和中文，你写出句子需要的形式：复数、过去式、-ing、名词、形容词或副词。写作和听力填空都要求词形完全正确。</p>
    <div class="field"><span class="flabel">词来自</span>
      <div class="chiprow" id="fSrc">${src.map(s => `<button type="button" class="chip" data-src="${s.id}" aria-pressed="${s.id === settings.formSrc}"${s.list.length ? "" : " disabled"}>${esc(s.name)}<span class="n">${s.list.length}</span></button>`).join("")}</div>
    </div>
    <button type="button" class="bigbtn" id="fStart">${ICON.play}开始</button>
    <p class="note">要变形的题会多出一些。写错的词会更常出现，也会进入随时复习的“容易忘的”。</p></div>`;
  $("fSrc").onclick = e => {
    const b = e.target.closest("[data-src]");
    if (!b || b.disabled) return;
    settings.formSrc = b.dataset.src;
    saveSettings();
    drawSetup();
  };
  $("fStart").onclick = start;
}

function start() {
  // words written wrong before come first, then the ones whose example uses a changed form; random among equals
  const pool = shuffle(sources().find(s => s.id === settings.formSrc).list.slice());
  pool.sort((a, b) => rec.missCount(b.hw) - rec.missCount(a.hw) || changed(b) - changed(a));
  round = { items: shuffle(pool.slice(0, ROUND)), pos: 0, results: [] };
  drawItem();
}

function drawItem() {
  const w = round.items[round.pos];
  if (!w) { drawSummary(); return; }
  const f = formIn(w);
  round.checked = false;
  $("fCount").textContent = `${round.pos + 1} / ${round.items.length}`;
  $("fBar").style.width = `${Math.round((round.pos / round.items.length) * 100)}%`;
  $("fBody").innerHTML = `
    <p class="eyebrow">词形填空 · ${esc(volume(w.v).name)}</p>
    <p class="fsent" lang="en">${esc(w.ex.slice(0, f.start))}<span class="fgap" aria-label="空格">　　　　</span>${esc(w.ex.slice(f.end))}</p>
    <p class="note">${esc(w.exZh)}</p>
    <p class="fbase">用 <b lang="en">${esc(w.hw)}</b><span class="pos">${esc(w.pos)}</span> ${esc(w.zh)} 的正确形式填空</p>
    <input class="spell-ans" id="fAns" lang="en" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
      enterkeyhint="done" aria-label="写出正确的词形" placeholder="写出句子里需要的形式">
    <button type="button" class="bigbtn" id="fCheck">检查</button>
    <div id="fResult"></div>`;
  $("fCheck").onclick = check;
  $("fAns").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); round.checked ? next() : check(); } });
  $("fAns").focus();
}

function check() {
  const w = round.items[round.pos], f = formIn(w), typed = $("fAns").value;
  if (!typed.trim()) { $("fAns").focus(); return; }
  round.checked = true;
  const right = low(typed.trim()) === low(f.form);
  const unchanged = !right && low(typed.trim()) === low(w.hw);
  round.results.push({ w, typed, right });
  rec.noteDictation(w.hw, right);
  $("fAns").readOnly = true;
  $("fCheck").textContent = round.pos + 1 < round.items.length ? "下一题" : "看结果";
  $("fCheck").onclick = next;
  $("fResult").innerHTML = `<div class="result ${right ? "good" : "bad"}">
    <p class="verdict">${right ? "写对了！" : unchanged ? "这里不能用原形，要变形" : "写错了"}</p>
    <p class="fsent small" lang="en" id="fFull">${esc(w.ex.slice(0, f.start))}<mark>${esc(f.form)}</mark>${esc(w.ex.slice(f.end))}
      <button type="button" class="exspk" id="fSay" aria-label="朗读例句">${ICON.spk}</button></p>
    ${right ? "" : `<p class="note">你写的：<span lang="en">${esc(typed)}</span></p>`}
    ${w.fam ? `<p class="note">词族：<span lang="en">${esc(w.hw)}, ${esc(w.fam)}</span></p>` : ""}
  </div>`;
  $("fSay").onclick = () => speakOne(w.ex, "en", $("fFull"));
  speakOne(w.ex, "en", $("fFull"));
}

function next() {
  round.pos++;
  drawItem();
  window.scrollTo(0, 0);
}

function drawSummary() {
  const right = round.results.filter(r => r.right).length, wrong = round.results.filter(r => !r.right);
  $("fCount").textContent = "";
  $("fBar").style.width = "100%";
  $("fBody").innerHTML = `<div class="done">
    <p class="eyebrow">这一轮完成</p>
    <h2 class="donetitle">写对 ${right} / ${round.results.length}</h2>
    ${wrong.length ? `<ul class="wronglist">${wrong.map(r => `<li><b lang="en">${esc(formIn(r.w).form)}</b><span class="note">${esc(r.w.hw)} · 你写的：${esc(r.typed)}</span></li>`).join("")}</ul>` : "<p>全部写对了！</p>"}
    <div class="donebtns">
      <button type="button" class="bigbtn" id="fAgain">再来一轮</button>
      <button type="button" class="bigbtn soft" id="fSetupBtn">换个练法</button>
      <button type="button" class="bigbtn no" id="fHome">回到学习首页</button>
    </div></div>`;
  $("fAgain").onclick = start;
  $("fSetupBtn").onclick = () => { round = null; drawSetup(); };
  $("fHome").onclick = leave;
}
