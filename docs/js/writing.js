// 写作: Task 2 questions of the five common types, each with a model essay written to band 8 (paragraph by
// paragraph, with what each paragraph does and the phrases worth borrowing), and timed writing: 40 minutes,
// a live word count, a draft kept on the phone, a self-check list and a prompt to paste into an AI for marking.
import { $, esc, ICON, nav, setFab, openSheet, toast, wordsIn } from "./util.js";
import { store, settings } from "./store.js";
import { speakOne, playList } from "./speech.js";
import { tapWords, showWord, hintOnce } from "./wordinfo.js";

const TYPES = ["观点", "讨论", "利弊", "问题解决", "双问题"];
const TYPE_EN = { 观点: "Opinion（To what extent do you agree）", 讨论: "Discussion（Discuss both views）", 利弊: "Advantages and disadvantages", 问题解决: "Problem and solution", 双问题: "Two-part question" };
const MINUTES = 40;
let TASKS = [];
let type = "全部";
let showNotes = true;

export function setWriting(data) {
  TASKS = data.tasks.map(t => ({ ...t, words: t.paras.reduce((n, p) => n + wordsIn(p), 0) }));
}
export const drafts = store.get("drafts", {});
export const saveDrafts = () => store.set("drafts", drafts);
const task = id => TASKS.find(t => t.id === id);
const sentences = p => p.split(/(?<=[.!?])\s+(?=[A-Z])/);

/* ---------- the list ---------- */
export function renderWriting(view) {
  const list = TASKS.filter(t => type === "全部" || t.type === type);
  view.innerHTML = `
    <header class="vbar"><div class="vrow"><h1 class="vtitle">写作</h1><span class="grow"></span><span class="vcount">大作文 ${TASKS.length} 题</span></div>
      <div class="chips" role="group" aria-label="题型">${["全部", ...TYPES].map(t => `<button type="button" class="chip" data-type="${t}" aria-pressed="${t === type}">${t}<span class="n">${t === "全部" ? TASKS.length : TASKS.filter(x => x.type === t).length}</span></button>`).join("")}</div>
    </header>
    <div class="pad wlist-intro"><p class="note">每题都有一篇按 8 分标准写的范文（参考写法，不是考官评过分的真实答卷）。先自己限时写，再对照范文和自查清单。</p></div>
    <ul class="elist">${list.map(t => {
      const d = drafts[t.id];
      return `<li class="witem">
        <div class="wi-text"><span class="lvl">${t.type}</span><b>${esc(t.zh)}</b>
          <p class="wprompt" lang="en">${esc(t.prompt)}</p>
          ${d && d.text ? `<p class="note">${d.done ? "写过" : "草稿"} · ${wordsIn(d.text)} 词 · 用时 ${Math.round((d.used || 0) / 60)} 分钟</p>` : ""}</div>
        <div class="btnrow"><a class="txtbtn primary" href="#write/${t.id}">${ICON.play}计时写作</a><a class="txtbtn" href="#essay/${t.id}">看范文</a></div>
      </li>`;
    }).join("")}</ul>`;
  view.querySelector(".chips").onclick = e => {
    const b = e.target.closest("[data-type]");
    if (!b || b.dataset.type === type) return;
    type = b.dataset.type;
    renderWriting(view);
  };
  return false;
}

/* ---------- a model essay ---------- */
export function renderEssay(view, id) {
  const t = task(id);
  if (!t) { location.replace("#writing"); return true; }
  const back = () => (nav.prev === "writing" ? history.back() : location.replace("#writing"));
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="eBack" aria-label="返回题目列表">${ICON.back}</button>
      <div class="rhead"><b>${esc(t.zh)}</b><small>${t.type} · 8 分范文 · ${t.words} 词</small></div>
      <span class="grow"></span>
      <button type="button" class="txtbtn" id="eNotes" aria-pressed="${showNotes}">段落说明</button>
    </div></header>
    <div class="essay pad" id="essay">
      <section class="task"><p class="eyebrow">${esc(TYPE_EN[t.type])}</p>
        <div class="task-en" lang="en">${tapWords(t.prompt)}<button type="button" class="sspk" data-say-prompt aria-label="朗读题目">${ICON.spk}</button></div></section>
      ${t.paras.map((p, i) => `<section class="wpara">
        <p class="wp" lang="en">${sentences(p).map((s, k) => `<span class="fs" data-say="e:${i}:${k}" data-p="${i}" data-k="${k}">${tapWords(s)}</span>`).join(" ")}</p>
        <p class="wnote${showNotes ? "" : " hidden"}">${esc(t.notes[i] || "")}</p></section>`).join("")}
      <section class="tip"><p class="eyebrow">值得借用的表达</p>
        <ul class="tips">${t.phrases.map(([en, zh], k) => `<li><button type="button" class="exit" data-phrase="${k}" lang="en">${esc(en)}${ICON.spk}</button><span class="exzh">${esc(zh)}</span></li>`).join("")}</ul></section>
      <a class="bigbtn" href="#write/${t.id}">${ICON.play}自己限时写这道题</a>
    </div>`;
  $("eBack").onclick = back;
  $("eNotes").onclick = e => {
    showNotes = !showNotes;
    e.currentTarget.setAttribute("aria-pressed", String(showNotes));
    document.querySelectorAll(".wnote").forEach(n => n.classList.toggle("hidden", !showNotes));
  };
  const items = [];
  t.paras.forEach((p, i) => sentences(p).forEach((s, k) => items.push({ i, k, s })));
  $("essay").onclick = e => {
    const wd = e.target.closest(".wd");
    if (wd && wd.closest(".fs")) {
      const fs = wd.closest(".fs"), s = sentences(t.paras[fs.dataset.p])[fs.dataset.k];
      showWord(s, Number(wd.dataset.k), wd, () => speakOne(s, "en", fs));
      return;
    }
    if (wd) { showWord(t.prompt, Number(wd.dataset.k), wd, () => speakOne(t.prompt, "en", wd.closest(".task-en"))); return; }
    if (e.target.closest("[data-say-prompt]")) { speakOne(t.prompt, "en", e.target.closest(".task-en")); return; }
    const ph = e.target.closest("[data-phrase]");
    if (ph) { speakOne(t.phrases[Number(ph.dataset.phrase)][0], "en", ph); return; }
    const fs = e.target.closest(".fs");
    if (fs) speakOne(sentences(t.paras[fs.dataset.p])[fs.dataset.k], "en", fs);
  };
  hintOnce();
  setFab("朗读全文", () => playList({ kind: "essay", title: t.zh, items, label: x => x.s,
    expand: x => [{ text: x.s, lang: "en", sel: `e:${x.i}:${x.k}`, gap: 500 }] }));
  return false;
}

/* ---------- timed writing ---------- */
let tick = 0;
const CHECKS = [
  ["任务回应", ["回答了题目的每一部分（双问题两个都答了）", "立场从头到尾一致，开头和结尾都写清楚", "每个主体段有一个中心论点，并用解释和例子展开"]],
  ["连贯与衔接", ["段落清楚：开头、两到三个主体段、结尾", "连接词自然，没有每句都用 Firstly / Moreover", "this、it、they 指代的是什么一看就明白"]],
  ["词汇", ["用了准确的话题词，而不只是 good、bad、things", "没有一直重复题目里的原词，换了同义表达", "搭配地道，比如 play a role in、have an impact on"]],
  ["语法", ["用了从句、条件句、让步句等复杂句", "冠词 a / an / the 用对了", "可数名词复数、主谓一致都对", "时态前后一致", "没有用逗号把两个完整的句子连在一起"]],
  ["字数和时间", ["至少 250 词", "40 分钟内写完，留出几分钟检查"]]
];

export function renderWrite(view, id) {
  const t = task(id);
  if (!t) { location.replace("#writing"); return true; }
  const d = drafts[id] || (drafts[id] = { text: "", used: 0, updated: 0 });
  let running = null;   // when the clock was last started
  const used = () => d.used + (running ? (Date.now() - running) / 1000 : 0);
  const back = () => { pause(); nav.prev === "writing" || nav.prev.startsWith("essay/") ? history.back() : location.replace("#writing"); };
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="wBack" aria-label="返回">${ICON.back}</button>
      <div class="rhead"><b>${esc(t.zh)}</b><small>计时写作 · ${MINUTES} 分钟</small></div>
      <span class="grow"></span>
      <button type="button" class="txtbtn" id="wClock"></button>
    </div></header>
    <div class="essay pad">
      <section class="task"><p class="eyebrow">${esc(TYPE_EN[t.type])}</p><p class="task-en" lang="en">${esc(t.prompt)}</p>
        <p class="task-zh">写至少 250 词。</p></section>
      <textarea class="dict-ans wtext" id="wText" lang="en" rows="14" autocapitalize="sentences" spellcheck="false"
        placeholder="点上面的时钟开始计时，然后在这里写。写的内容会自动保存在这台手机上。">${esc(d.text)}</textarea>
      <p class="wcount" id="wCount"></p>
      <div class="btnrow">
        <button type="button" class="bigbtn" id="wDone">写完了，开始检查</button>
      </div>
      <div id="wAfter"></div>
    </div>`;
  const clock = $("wClock"), box = $("wText");
  const drawClock = () => {
    const left = MINUTES * 60 - used();
    const s = Math.abs(Math.round(left));
    clock.innerHTML = `${running ? ICON.pause : ICON.play}${left < 0 ? "超时 " : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    clock.classList.toggle("late", left < 0);
  };
  const drawCount = () => {
    const n = wordsIn(box.value);
    $("wCount").textContent = `${n} 词${n < 250 ? ` · 还差 ${250 - n} 词到 250` : " · 已够 250 词"}`;
    $("wCount").classList.toggle("ok", n >= 250);
  };
  function pause() {
    if (running) { d.used = used(); running = null; saveDrafts(); }
    clearInterval(tick);
    drawClock();
  }
  const start = () => {
    running = Date.now();
    clearInterval(tick);
    tick = setInterval(() => {
      if (!$("wClock")) { clearInterval(tick); return; }
      const before = MINUTES * 60 - used();
      drawClock();
      if (before > 0 && before <= 1) { toast("40 分钟到了", 4000); if (navigator.vibrate) navigator.vibrate(300); }
    }, 1000);
    drawClock();
    box.focus();
  };
  clock.onclick = () => (running ? pause() : start());
  let saveTimer = 0;
  box.addEventListener("input", () => {
    d.text = box.value;
    d.updated = Date.now();
    drawCount();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDrafts, 500);
  });
  $("wBack").onclick = back;
  $("wDone").onclick = () => {
    pause();
    d.done = true;
    saveDrafts();
    afterWriting(t, d);
  };
  addEventListener("hashchange", () => { if (running) { d.used = used(); running = null; saveDrafts(); } clearInterval(tick); }, { once: true });
  drawClock();
  drawCount();
  if (d.done && d.text) afterWriting(t, d);
  return false;
}

function afterWriting(t, d) {
  const n = wordsIn(d.text);
  $("wAfter").innerHTML = `<section class="group wcheck">
    <h2>写完了：${n} 词，用时 ${Math.round(d.used / 60)} 分钟</h2>
    ${n < 250 ? `<p class="notice">不到 250 词会扣分，下次注意分配时间。</p>` : ""}
    <p class="note">按考官的四项评分标准逐条检查，做到了就勾上。</p>
    ${CHECKS.map(([name, items]) => `<p class="sub">${name}</p>${items.map(x => `<label class="switch"><span>${esc(x)}</span><input type="checkbox"></label>`).join("")}`).join("")}
    <div class="btnrow">
      <a class="txtbtn primary" href="#essay/${t.id}">对照 8 分范文</a>
      <button type="button" class="txtbtn" id="wCopy">复制批改提示</button>
    </div>
    <p class="note">“复制批改提示”会把题目、你的作文和批改要求一起复制下来，你可以自己贴到常用的 AI 里请它按雅思标准批改。App 不会把作文发给任何人。</p>
  </section>`;
  $("wCopy").onclick = () => copyPrompt(t, d.text);
}

function copyPrompt(t, text) {
  const n = wordsIn(text);
  const prompt = `Please act as an experienced IELTS examiner and assess this ${settings.examType === "G" ? "General Training" : "Academic"} Writing Task 2 essay.
1. Give an estimated band for each criterion (Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy) and an overall band, with a short reason for each.
2. List the most important language errors, quoting each one and giving a correction.
3. Suggest three specific changes that would move this essay towards band 8.
Please write your explanations in Chinese.

Task:
${t.prompt}

My essay (${n} words):
${text}`;
  const fallback = () => openSheet("复制批改提示", `<p class="note">手机不允许直接复制，请长按下面的文字全选复制。</p><textarea class="dict-ans" rows="12" readonly>${esc(prompt)}</textarea>`, () => {});
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(prompt).then(() => toast("已复制，可以粘贴到你常用的 AI 里"), fallback);
  } else fallback();
}

