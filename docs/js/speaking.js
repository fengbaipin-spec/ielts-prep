// 口语: Part 1 questions on everyday topics and Part 2 topic cards (one minute to prepare, two minutes to talk),
// each with a model answer and useful phrases, and Part 3 follow-up questions. Answers are recorded and played
// back on the phone; with speech recognition switched on in settings, the answer is turned into text instead,
// with the number of words, the speed and the words used most often.
import { $, esc, ICON, nav, setFab, toast } from "./util.js";
import { settings } from "./store.js";
import { speakOne, halt, playList, stopList, player } from "./speech.js";
import { tapWords, showWord, hintOnce } from "./wordinfo.js";
import { canRecord, record, stopRecording, playClip, stopClip } from "./recorder.js";
import { canRecognize, recognizeLong, stopRecognizing, recognitionError } from "./listen.js";

const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
let P1 = [], P2 = [];
export function setSpeaking(data) { P1 = data.part1; P2 = data.part2; }

let busy = null;          // the microphone in use: { stop }
let prepTimer = 0;
const clips = new Map();  // answer box → the recording, only while the page is open
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const useRecognition = () => settings.recognize && canRecognize();

function quiet() {
  if (busy) busy.stop();
  clearInterval(prepTimer);
  stopClip();
  clips.clear();
}
addEventListener("hashchange", e => { if (/#p[12]\//.test(e.oldURL)) quiet(); });

/* ---------- the list ---------- */
export function renderSpeaking(view) {
  view.innerHTML = `
    <header class="vbar"><div class="vrow"><h1 class="vtitle">口语</h1><span class="grow"></span><span class="vcount">${P1.length} 个话题 · ${P2.length} 张卡</span></div></header>
    <div class="hub pad">
      <p class="note">先听问题，录下自己的回答，再听回放、看参考回答。参考回答里的经历只是示范，练的时候换成你自己的真实情况。${useRecognition() ? "发音识别已打开：回答会转成文字，并统计词数和语速。" : "在设置里打开发音识别，可以把回答转成文字，看看说了多少词、语速多快。"}</p>
      <section class="group"><h2>Part 1 · 日常话题</h2>
        <ul class="tlist">${P1.map(t => `<li><a class="titem" href="#p1/${t.id}"><span><b>${esc(t.zh)}</b><small lang="en">${esc(t.topic)} · ${t.qs.length} 个问题</small></span><span></span></a></li>`).join("")}</ul></section>
      <section class="group"><h2>Part 2 · 话题卡（准备 1 分钟，说 2 分钟）</h2>
        <ul class="tlist">${P2.map(c => `<li><a class="titem" href="#p2/${c.id}"><span><b>${esc(c.zh)}</b><small lang="en">${esc(c.card)}</small></span><span></span></a></li>`).join("")}</ul></section>
    </div>`;
  return false;
}

/* ---------- answering: record, or recognise ---------- */
const STOP = new Set(("the a an and or but so to of in on at for with is are was were be been being it its this that these those i you he she we they " +
  "my your his her our their me him us them do did does doing have has had having not no there what which who when where how as if then than " +
  "about from by up out also can could would will should may might one some any all more most other such into over after before because while " +
  "i'm it's that's i've i'd don't didn't can't isn't there's they're you're we're").split(" "));
function statsHTML(text, sec) {
  const words = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  const wpm = sec > 5 ? Math.round(words.length / (sec / 60)) : 0;
  const counts = new Map();
  for (const w of words) if (!STOP.has(w) && w.length > 2) counts.set(w, (counts.get(w) || 0) + 1);
  const repeats = [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `<div class="result">
    <p class="verdict">说了 ${words.length} 个词 · ${fmt(sec)}${wpm ? ` · 每分钟约 ${wpm} 词` : ""}</p>
    <p class="transcript" lang="en">${esc(text)}</p>
    ${repeats.length ? `<p class="note">用得最多的词：<span lang="en">${repeats.map(([w, n]) => `${esc(w)} ×${n}`).join("，")}</span>。想想能不能换个说法。</p>` : ""}
    <p class="note">参考：英语母语者日常说话大约每分钟 150 词。识别结果只能当参考，口音和噪音都会影响它。</p></div>`;
}

async function answer(box, maxSec) {
  if (busy) { busy.stop(); return; }
  if (player.active) stopList();
  halt();
  stopClip();
  const btn = box.querySelector("[data-act=rec]"), out = box.querySelector(".ans-out");
  const label = btn.innerHTML, t0 = Date.now();
  const show = s => { btn.innerHTML = `${ICON.stop}<span>${useRecognition() ? "在听… " : ""}${fmt(s)} / ${fmt(maxSec)}</span>`; };
  btn.classList.add("on");
  show(0);
  if (useRecognition()) {
    busy = { stop: stopRecognizing };
    const timer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      show(s);
      if (s >= maxSec) stopRecognizing();
    }, 250);
    const r = await recognizeLong("en-GB", text => { out.innerHTML = `<p class="transcript live" lang="en">${esc(text)}</p>`; });
    clearInterval(timer);
    busy = null;
    btn.classList.remove("on");
    btn.innerHTML = label;
    if (!out.isConnected) return;
    if (!r.text) { out.innerHTML = ""; toast(recognitionError(r.error)); return; }
    out.innerHTML = statsHTML(r.text, (Date.now() - t0) / 1000);
    return;
  }
  if (!canRecord()) { btn.classList.remove("on"); btn.innerHTML = label; toast("这个浏览器不能录音"); return; }
  busy = { stop: stopRecording };
  let clip = null;
  try {
    clip = await record(maxSec * 1000, s => show(s));
  } catch (e) {
    const n = e && e.name;
    toast(n === "NotAllowedError" || n === "SecurityError" ? "需要允许使用麦克风，可以在手机设置的应用权限里打开" : n === "NotFoundError" ? "没有找到麦克风" : "录音没有成功，再试一次");
  }
  busy = null;
  btn.classList.remove("on");
  btn.innerHTML = label;
  if (!clip || !clip.size || !out.isConnected) return;
  const sec = (Date.now() - t0) / 1000;
  clips.set(box, clip);
  out.innerHTML = `<div class="btnrow"><button type="button" class="txtbtn" data-act="mine">${ICON.play}听我的回答</button><span class="note">${fmt(sec)}</span></div>
    ${maxSec > 60 && sec < 90 ? `<p class="note">Part 2 最好说满 1 分半到 2 分钟，说不够会影响流利度的分数。</p>` : ""}
    <p class="note">录音不保存，离开这一页就删掉。</p>`;
  playClip(clip);
}

function onBoxClick(e, sayModel) {
  const box = e.target.closest("[data-box]");
  if (!box) return false;
  const b = e.target.closest("[data-act]");
  const wd = e.target.closest(".wd");
  if (wd) { const text = wd.closest("[data-text]").dataset.text; showWord(text, Number(wd.dataset.k), wd, () => speakOne(text, "en", wd.closest("[data-text]"))); return true; }
  if (!b) return false;
  const act = b.dataset.act;
  if (act === "ask") speakOne(b.dataset.q, "en", b);
  else if (act === "rec") answer(box, Number(box.dataset.max));
  else if (act === "mine") { const c = clips.get(box); if (c) { halt(); playClip(c); } }
  else if (act === "model") {
    const m = box.querySelector(".model");
    m.hidden = !m.hidden;
    b.setAttribute("aria-pressed", String(!m.hidden));
    if (!m.hidden) { hintOnce(); if (sayModel) sayModel(box); }
  } else if (act === "say") speakOne(b.closest("[data-text]").dataset.text, "en", b.closest("[data-text]"));
  return true;
}

const recBtn = () => `<button type="button" class="txtbtn primary" data-act="rec">${MIC}${useRecognition() ? "说一遍" : "录音回答"}</button>`;
const spoken = (text, cls = "exs") => `<div class="${cls}" data-text="${esc(text)}" lang="en">${tapWords(text)}<button type="button" class="exspk" data-act="say" aria-label="朗读">${ICON.spk}</button></div>`;

/* ---------- Part 1 ---------- */
export function renderPart1(view, id) {
  const t = P1.find(x => x.id === id);
  if (!t) { location.replace("#speaking"); return true; }
  quiet();
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="kBack" aria-label="返回口语">${ICON.back}</button>
      <div class="rhead"><b>${esc(t.zh)}</b><small lang="en">Part 1 · ${esc(t.topic)}</small></div><span class="grow"></span>
    </div></header>
    <div class="essay pad" id="kBody">
      <p class="hint">每题回答两三句（20 到 30 秒）就够了：先直接回答，再加一个原因或例子。</p>
      ${t.qs.map(([q, a], i) => `<section class="qcard" data-box="${i}" data-max="45">
        <p class="eyebrow">问题 ${i + 1}</p>
        <button type="button" class="qtext" data-act="ask" data-q="${esc(q)}" lang="en">${esc(q)}${ICON.spk}</button>
        <div class="btnrow">${recBtn()}<button type="button" class="txtbtn" data-act="model" aria-pressed="false">参考回答</button></div>
        <div class="ans-out"></div>
        <div class="model" hidden>${spoken(a)}</div>
      </section>`).join("")}
    </div>`;
  $("kBack").onclick = () => (nav.prev === "speaking" ? history.back() : location.replace("#speaking"));
  $("kBody").onclick = e => onBoxClick(e, box => { const m = box.querySelector(".model [data-text]"); speakOne(m.dataset.text, "en", m); });
  return false;
}

/* ---------- Part 2 ---------- */
export function renderPart2(view, id) {
  const c = P2.find(x => x.id === id);
  if (!c) { location.replace("#speaking"); return true; }
  quiet();
  const whole = c.answer.join(" ");
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="kBack" aria-label="返回口语">${ICON.back}</button>
      <div class="rhead"><b>${esc(c.zh)}</b><small>Part 2 · 准备 1 分钟，说 2 分钟</small></div><span class="grow"></span>
    </div></header>
    <div class="essay pad" id="kBody">
      <section class="cue" lang="en">
        <button type="button" class="qtext" data-act="ask" data-q="${esc(c.card)}">${esc(c.card)}${ICON.spk}</button>
        <p class="cue-say">You should say:</p>
        <ul>${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      </section>
      <section class="qcard" data-box="p2" data-max="120">
        <div class="btnrow"><button type="button" class="bigbtn soft" id="kPrep">${ICON.play}开始准备 1 分钟</button></div>
        <textarea class="dict-ans knotes" rows="3" lang="en" placeholder="准备时可以在这里记几个关键词（考试时有纸笔）"></textarea>
        <div class="btnrow">${recBtn().replace("txtbtn primary", "bigbtn")}</div>
        <div class="ans-out"></div>
      </section>
      <section class="tip"><p class="eyebrow">好用的表达</p>
        <ul class="tips">${c.phrases.map(([en, zh]) => `<li data-box="ph" data-max="0"><div data-text="${esc(en)}"><button type="button" class="exit" data-act="say" lang="en">${esc(en)}${ICON.spk}</button></div><span class="exzh">${esc(zh)}</span></li>`).join("")}</ul></section>
      <section class="qcard" data-box="model" data-max="0">
        <div class="btnrow"><button type="button" class="txtbtn" data-act="model" aria-pressed="false">看参考回答（${whole.split(/\s+/).length} 词）</button></div>
        <div class="model" hidden>${c.answer.map(p => spoken(p, "wp-say")).join("")}</div>
      </section>
      <section class="group"><h2>Part 3 · 考官可能接着问</h2>
        ${c.p3.map((q, i) => `<section class="qcard" data-box="p3-${i}" data-max="60">
          <button type="button" class="qtext" data-act="ask" data-q="${esc(q)}" lang="en">${esc(q)}${ICON.spk}</button>
          <div class="btnrow">${recBtn()}</div><div class="ans-out"></div></section>`).join("")}
        <p class="note">Part 3 要多说几句：先表态，再给理由和例子，最好再从另一个角度补充一下。</p>
      </section>
    </div>`;
  $("kBack").onclick = () => (nav.prev === "speaking" ? history.back() : location.replace("#speaking"));
  $("kBody").onclick = e => onBoxClick(e);
  $("kPrep").onclick = () => prepare($("kPrep"));
  setFab("朗读参考回答", () => {
    const m = document.querySelector('[data-box="model"] .model');
    if (m && m.hidden) document.querySelector('[data-box="model"] [data-act="model"]').click();
    playList({ kind: "p2", title: c.zh, items: c.answer.map((p, i) => i), label: i => c.answer[i],
      expand: i => [{ text: c.answer[i], lang: "en", sel: "", gap: 400 }] });
  });
  return false;
}

function prepare(btn) {
  clearInterval(prepTimer);
  const t0 = Date.now();
  speakOne("You have one minute to prepare. You can make notes if you wish.", "en");
  const draw = () => {
    const left = 60 - (Date.now() - t0) / 1000;
    if (left <= 0) {
      clearInterval(prepTimer);
      btn.innerHTML = `${ICON.check}准备时间到`;
      toast("准备时间到，点“录音回答”开始说", 3500);
      if (navigator.vibrate) navigator.vibrate(200);
      return;
    }
    btn.innerHTML = `${ICON.stop}准备中 ${fmt(left)}`;
  };
  draw();
  prepTimer = setInterval(() => { if (!btn.isConnected) { clearInterval(prepTimer); return; } draw(); }, 250);
}
