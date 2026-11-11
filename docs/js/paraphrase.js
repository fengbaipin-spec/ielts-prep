// 同义替换: IELTS questions rarely use the words of the recording or the passage, so the score at 8 and above
// depends on spotting the same idea in other words. A word as the question puts it; which of four is how the
// passage might say it? Groups missed before come back more often.
import { $, esc, ICON, nav, shuffle } from "./util.js";
import { paraMiss } from "./store.js";
import { speakOne } from "./speech.js";

const ROUND = 10;
let GROUPS = [];
let CATS = [];
let cat = "全部";
let round = null;   // { qs, pos, results, answered }
let browsing = false;

export function setParaphrases(data) {
  GROUPS = data.groups.map((g, i) => ({ ...g, i, key: `${g.zh}|${g.words[0]}` }));
  CATS = [...new Set(GROUPS.map(g => g.cat))];
}
const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));
const inCat = () => (cat === "全部" ? GROUPS : GROUPS.filter(g => g.cat === cat));

// a question: two words of one group, and three words that do not mean the same, from the same category if possible
function makeQuestion(g) {
  const [prompt, answer] = shuffle(g.words.slice());
  const clash = w => GROUPS.some(o => o.words.includes(w) && o.words.includes(prompt));
  const near = shuffle(GROUPS.filter(o => o !== g && o.cat === g.cat)).flatMap(o => o.words);
  const far = shuffle(GROUPS.filter(o => o !== g && o.cat !== g.cat)).flatMap(o => o.words);
  const wrong = [];
  for (const w of [...shuffle(near), ...far]) {
    if (wrong.length === 3) break;
    if (!g.words.includes(w) && !clash(w) && !wrong.includes(w)) wrong.push(w);
  }
  return { g, prompt, answer, options: shuffle([answer, ...wrong]) };
}

// groups missed before are weighted up; otherwise a random spread
function pickGroups(list, n) {
  const weighted = list.map(g => ({ g, w: Math.random() * (1 + 2 * paraMiss.get(g.key)) }));
  return weighted.sort((a, b) => b.w - a.w).slice(0, n).map(x => x.g);
}

export function renderPara(view) {
  round = null;
  browsing = false;
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="pClose" aria-label="结束练习">${ICON.close}</button>
      <b class="rtitle">同义替换</b><span class="grow"></span><span class="vcount" id="pCount"></span>
    </div><div class="pbar"><i id="pBar"></i></div></header>
    <div class="drill pad" id="pBody"></div>`;
  $("pClose").onclick = () => (browsing ? drawSetup() : leave());
  $("pBody").onclick = onClick;
  drawSetup();
  return false;
}

function drawSetup() {
  round = null;
  browsing = false;
  $("pCount").textContent = "";
  $("pBar").style.width = "0";
  const missed = GROUPS.filter(g => paraMiss.get(g.key) > 0).length;
  $("pBody").innerHTML = `
    <p class="lead">听力和阅读的题目很少照搬原文的词，常常换一种说法。每题给出题目里的说法，从四个选项里找出原文可能用的同义表达。</p>
    <div class="field"><span class="flabel">练哪一类</span>
      <div class="chiprow">${["全部", ...CATS].map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}<span class="n">${c === "全部" ? GROUPS.length : GROUPS.filter(g => g.cat === c).length}</span></button>`).join("")}</div>
    </div>
    <button type="button" class="bigbtn" data-go="start">${ICON.play}开始练习 · ${ROUND} 题</button>
    <button type="button" class="bigbtn soft" data-go="browse">浏览同义替换表</button>
    <p class="note">共 ${GROUPS.length} 组${missed ? `，其中 ${missed} 组选错过，会更常出现，选对一次后恢复正常` : ""}。</p>`;
}

function drawBrowse() {
  browsing = true;
  const list = inCat();
  $("pBody").innerHTML = `
    <p class="lead">${esc(cat)} · ${list.length} 组。点英文可以听发音。</p>
    <ul class="paralist">${list.map(g => `<li><p class="pzh">${esc(g.zh)}${paraMiss.get(g.key) ? `<span class="pmiss">选错过</span>` : ""}</p>
      <p class="pwords">${g.words.map(w => `<button type="button" class="pword" data-say="${esc(w)}" lang="en">${esc(w)}</button>`).join("")}</p></li>`).join("")}</ul>
    <button type="button" class="bigbtn" data-go="start">${ICON.play}用这一类练习</button>`;
  window.scrollTo(0, 0);
}

function start() {
  const pool = inCat();
  round = { qs: pickGroups(pool, Math.min(ROUND, pool.length)).map(makeQuestion), pos: 0, results: [], answered: false };
  browsing = false;
  drawQuestion();
}

function drawQuestion() {
  const q = round.qs[round.pos];
  if (!q) { drawSummary(); return; }
  round.answered = false;
  $("pCount").textContent = `${round.pos + 1} / ${round.qs.length}`;
  $("pBar").style.width = `${Math.round((round.pos / round.qs.length) * 100)}%`;
  $("pBody").innerHTML = `
    <p class="eyebrow">${esc(q.g.cat)} · 题目里说</p>
    <button type="button" class="w big" data-say="${esc(q.prompt)}" lang="en">${esc(q.prompt)}${ICON.spk}</button>
    <p class="lead">原文里可能换成哪一个？</p>
    <div class="choices">${q.options.map(o => `<button type="button" class="choice" data-opt="${esc(o)}" lang="en"><b>${esc(o)}</b></button>`).join("")}</div>
    <div id="pResult"></div>`;
}

function answer(opt, btn) {
  if (round.answered) return;
  round.answered = true;
  const q = round.qs[round.pos], right = opt === q.answer;
  round.results.push({ q, right, opt });
  paraMiss.hit(q.g.key, !right);
  btn.classList.add(right ? "right" : "wrong");
  if (!right) document.querySelector(`.choice[data-opt="${CSS.escape(q.answer)}"]`)?.classList.add("right");
  $("pResult").innerHTML = `<div class="result ${right ? "good" : "bad"}">
    <p class="verdict">${right ? "对了！" : "不对"}</p>
    <p>这一组都表示 <b>${esc(q.g.zh)}</b>：</p>
    <p class="pwords">${q.g.words.map(w => `<button type="button" class="pword" data-say="${esc(w)}" lang="en">${esc(w)}</button>`).join("")}</p>
    ${right ? "" : `<p class="note"><span lang="en">${esc(opt)}</span> 不是这个意思。</p>`}
  </div>
  <button type="button" class="bigbtn" data-go="next">${round.pos + 1 < round.qs.length ? "下一题" : "看结果"}</button>`;
  speakOne(`${q.prompt}. ${q.answer}.`, "en");
}

function drawSummary() {
  const right = round.results.filter(r => r.right).length, wrong = round.results.filter(r => !r.right);
  $("pCount").textContent = "";
  $("pBar").style.width = "100%";
  $("pBody").innerHTML = `<div class="done">
    <p class="eyebrow">这一轮完成</p>
    <h2 class="donetitle">选对 ${right} / ${round.results.length}</h2>
    ${wrong.length ? `<p>选错的组：</p><ul class="paralist">${wrong.map(r => `<li><p class="pzh">${esc(r.q.g.zh)}</p>
      <p class="pwords">${r.q.g.words.map(w => `<button type="button" class="pword" data-say="${esc(w)}" lang="en">${esc(w)}</button>`).join("")}</p></li>`).join("")}</ul>` : "<p>全部选对了！</p>"}
    <div class="donebtns">
      <button type="button" class="bigbtn" data-go="start">再来一轮</button>
      <button type="button" class="bigbtn soft" data-go="setup">换一类</button>
      <button type="button" class="bigbtn no" data-go="home">回到学习首页</button>
    </div></div>`;
}

function onClick(e) {
  const say = e.target.closest("[data-say]");
  if (say) { speakOne(say.dataset.say, "en", say); return; }
  const c = e.target.closest("[data-cat]");
  if (c) { cat = c.dataset.cat; drawSetup(); return; }
  const o = e.target.closest("[data-opt]");
  if (o && round) { answer(o.dataset.opt, o); return; }
  const b = e.target.closest("[data-go]");
  if (!b) return;
  const go = b.dataset.go;
  if (go === "start") start();
  else if (go === "browse") drawBrowse();
  else if (go === "next") { round.pos++; drawQuestion(); window.scrollTo(0, 0); }
  else if (go === "setup") drawSetup();
  else if (go === "home") leave();
}
