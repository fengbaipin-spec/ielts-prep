// The 学习 tab: today's plan, the study session (new words and reviews), the practice cards and progress by volume.
import { $, esc, ICON, nav, openSheet, closeSheet } from "./util.js";
import { settings, saveSettings } from "./store.js";
import { speakOne } from "./speech.js";
import { words, volumes, byHead, volumeSheet, synList } from "./dict.js";
import * as rec from "./srs.js";
import { tapWords, showWord, hintOnce } from "./wordinfo.js";

const MAX_REVIEWS = 60;   // after a long break hundreds can be due; take them one session at a time
const EXTRA = 5;          // "再学 5 个新词"
const PRESETS = [0, 5, 10, 15, 20, 30];
export const MAX_NEW = 100;

// 0 pauses new words and leaves only the reviews
export function setNewPerDay(n) {
  settings.newPerDay = Math.max(0, Math.min(MAX_NEW, Math.round(n)));
  saveSettings();
  return settings.newPerDay;
}

const fromVolume = () => (volumes()[settings.newFrom - 1] ? settings.newFrom : 1);
const newLeft = () => Math.max(0, settings.newPerDay - rec.doneToday()[0]);
const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));
// days left until the exam date chosen in settings
export function daysToExam() {
  if (!settings.examDate) return null;
  const [y, m, d] = settings.examDate.split("-").map(Number);
  const exam = Date.UTC(y, m - 1, d) / 864e5;
  return Number.isFinite(exam) ? exam - rec.today() : null;
}

/* ---------- hub ---------- */
export function renderLearn(view) {
  const due = rec.dueWords().filter(hw => byHead(hw)).length;
  const fresh = rec.freshWords(words(), fromVolume(), newLeft()).length;
  const done = rec.doneToday(), streak = rec.streak(), left = daysToExam();
  const date = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <h1 class="vtitle">学习</h1><span class="grow"></span>
      <span class="vcount">${left != null && left >= 0 ? `离考试 ${left} 天` : date}${streak ? ` · 连续 ${streak} 天` : ""}</span>
    </div></header>
    <div class="hub pad">
      <section class="today">
        <div class="stats">
          <div class="stat"><b>${due}</b><span>待复习</span></div>
          <div class="stat"><b>${fresh}</b><span>今天的新词</span></div>
          <div class="stat"><b>${done[0] + done[1]}</b><span>今天已完成</span></div>
        </div>
        ${due || fresh
          ? `<button type="button" class="bigbtn" id="startStudy">${ICON.play}${done[0] + done[1] ? "继续今天的学习" : "开始今天的学习"}</button>`
          : `<p class="donetext">${settings.newPerDay ? "今天的复习和新词都完成了。" : "今天的复习都完成了，新词已暂停。"}</p>
             <button type="button" class="bigbtn soft" id="startMore">再学 ${EXTRA} 个新词</button>`}
        <p class="note">新词来自 <button type="button" class="linkbtn" id="pickFrom">${volumes()[fromVolume() - 1].name}${ICON.down}</button>，<button type="button" class="linkbtn" id="pickPerDay">${settings.newPerDay ? `每天 ${settings.newPerDay} 个` : "已暂停新词"}${ICON.down}</button>，收藏的词优先。记得的词会隔 1、3、7、14、30 天再出现。</p>
      </section>
      <div class="pcards">
        <a class="pcard" href="#review"><b>随时复习</b><span>不用等到期，自己挑一组词翻卡</span></a>
        <a class="pcard" href="#para"><b>同义替换</b><span>认出题目和原文里换了说法的词</span></a>
        <a class="pcard" href="#spell"><b>听音写词</b><span>单词拼写、数字、日期、地址</span></a>
        <a class="pcard" href="#mistakes"><b>听读错题本</b><span>做剑桥真题时记下错题和分数</span></a>
      </div>
      <section class="group">
        <h2>进度 · 已学 ${rec.learnedCount()} 个词，已掌握 ${rec.masteredCount()} 个</h2>
        <div class="vprogs">${progressRows()}</div>
        <p class="note">浅色是已学，深色是已掌握（隔 30 天还记得）。</p>
      </section>
    </div>`;
  if ($("startStudy")) $("startStudy").onclick = () => { location.hash = "#study"; };
  if ($("startMore")) $("startMore").onclick = () => { location.hash = "#study/more"; };
  $("pickFrom").onclick = () => pickFrom(view);
  $("pickPerDay").onclick = () => pickPerDay(view);
  return false;
}

function pickPerDay(view) {
  const html = `<div class="perday">
    <div class="chiprow">${PRESETS.map(n =>
      `<button type="button" class="chip" data-n="${n}" aria-pressed="${n === settings.newPerDay}">${n ? `${n} 个` : "暂停新词"}</button>`).join("")}</div>
    <div class="fieldrow">
      <label class="numfield" for="pdInput">自定义
        <input type="number" id="pdInput" inputmode="numeric" min="0" max="${MAX_NEW}" step="1" value="${settings.newPerDay}">个</label>
      <button type="button" class="txtbtn primary" id="pdOk">确定</button>
    </div>
    <p class="note">可以填 0 到 ${MAX_NEW}。填 0 表示先暂停新词，只做复习。今天已经学过的新词也算在里面。</p>
  </div>`;
  const done = n => {
    setNewPerDay(n);
    closeSheet();
    renderLearn(view);
  };
  const typed = () => {
    const box = $("pdInput"), n = Number(box.value);
    if (box.value.trim() === "" || !Number.isFinite(n)) { box.focus(); return; }
    done(n);
  };
  openSheet("每天学几个新词", html, e => {
    const b = e.target.closest("[data-n]");
    if (b) done(Number(b.dataset.n));
    else if (e.target.closest("#pdOk")) typed();
  });
  $("pdInput").addEventListener("keydown", e => { if (e.key === "Enter") typed(); });
}

function progressRows() {
  const all = words();
  return volumes().map(V => {
    let learned = 0, mastered = 0;
    for (let i = V.first; i < V.first + V.count; i++) {
      const s = rec.stageOf(all[i].hw);
      if (s >= 0) learned++;
      if (s >= rec.MASTERED) mastered++;
    }
    const pct = n => `${Math.round((n / V.count) * 100)}%`;
    return `<div class="vprog"><span class="vp-name">${esc(V.name.replace("话题词：", ""))}</span>
      <span class="vp-bar"><i class="l" style="width:${pct(learned)}"></i><i class="m" style="width:${pct(mastered)}"></i></span>
      <span class="vp-n">${learned}/${V.count}</span></div>`;
  }).join("");
}

function pickFrom(view) {
  const all = words();
  const learned = V => { let n = 0; for (let i = V.first; i < V.first + V.count; i++) if (rec.known(all[i].hw)) n++; return n; };
  volumeSheet("新词从哪一册开始", fromVolume(), V => `已学 ${learned(V)}/${V.count}`, v => {
    settings.newFrom = v;
    saveSettings();
    closeSheet();
    renderLearn(view);
  });
}

/* ---------- a word card, shared with 随时复习 ---------- */
export function cardHTML(w, label, zhFirst) {
  const word = `<button type="button" class="w big" data-s="w" lang="en">${esc(w.hw)}${ICON.spk}</button>
    <div class="ipa-row"><span class="ipa">${esc(w.ipa)}</span><span class="pos">${esc(w.pos)}</span></div>`;
  return `
    <p class="eyebrow">${label} · ${esc(volumes()[w.v - 1].name)} · ${esc(w.tag)}</p>
    ${zhFirst ? `<div class="zh cue">${esc(w.zh)}</div>` : word}
    <button type="button" class="peek" data-go="show" id="peek">${zhFirst ? "先想一想英文怎么说，再点这里看答案" : "先想一想它的意思，再点这里看答案"}</button>
    <div class="answer" id="answer" hidden>
      ${zhFirst ? word : `<div class="zh big">${esc(w.zh)}</div>`}
      <div class="meta"><button type="button" class="en def" data-s="def" lang="en">${esc(w.def)}${ICON.spk}</button></div>
      ${w.syn ? `<div class="syn"><span class="lbl">同义</span><span lang="en">${synList(w).map(esc).join(" · ")}</span></div>` : ""}
      ${w.fam ? `<div class="fam"><span class="lbl">词族</span><span lang="en">${esc(w.fam)}</span></div>` : ""}
      <div class="ex">
        <div class="exs" lang="en">${tapWords(w.ex)}<button type="button" class="exspk" data-s="ex" aria-label="朗读例句">${ICON.spk}</button></div>
        <div class="exzh">${esc(w.exZh)}</div>
      </div>
    </div>
    <div class="actions" id="actions"></div>`;
}
// taps on a card that are not answers: the word, the definition, the example, a word in the example
export function cardTap(e, w, body) {
  const wd = e.target.closest(".wd");
  if (wd) {
    const ex = body.querySelector(".exs");
    showWord(w.ex, Number(wd.dataset.k), wd, () => speakOne(w.ex, "en", ex));
    return true;
  }
  const s = e.target.closest("[data-s]");
  if (s) {
    const text = { w: w.hw, def: w.def, ex: w.ex }[s.dataset.s];
    speakOne(text, "en", s.dataset.s === "ex" ? s.closest(".exs") : s);
    return true;
  }
  return false;
}

/* ---------- study session ---------- */
let ses = null;

function newSession(extra) {
  const items = [];
  if (extra == null) {
    for (const hw of rec.dueWords().slice(0, MAX_REVIEWS)) {
      const w = byHead(hw);
      if (w) items.push({ kind: "review", w });
    }
  }
  for (const w of rec.freshWords(words(), fromVolume(), extra == null ? newLeft() : extra)) items.push({ kind: "new", w });
  return { items, pos: 0, shown: false, again: new Set(), counts: { fresh: 0, known: 0, review: 0, forgot: 0 } };
}

export function renderStudy(view, arg) {
  ses = newSession(arg === "more" ? EXTRA : null);
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="sClose" aria-label="结束学习">${ICON.close}</button>
      <b class="rtitle">今日学习</b><span class="grow"></span><span class="vcount" id="sCount"></span>
    </div><div class="pbar"><i id="sBar"></i></div></header>
    <div class="study pad" id="sBody"></div>`;
  $("sClose").onclick = leave;
  $("sBody").onclick = onCardClick;
  drawCard();
  return false;
}

function drawCard() {
  const item = ses.items[ses.pos], total = ses.items.length;
  $("sCount").textContent = item ? `${ses.pos + 1} / ${total}` : "";
  $("sBar").style.width = `${total ? Math.round(((item ? ses.pos : total) / total) * 100) : 100}%`;
  if (!item) { drawDone(); return; }
  const open = item.kind === "new";
  ses.shown = open;
  $("sBody").innerHTML = cardHTML(item.w, { new: "新词", review: "复习", again: "再看一遍" }[item.kind], false);
  if (open) { $("peek").hidden = true; $("answer").hidden = false; hintOnce(); }
  drawActions(item);
  if (settings.autoSay) speakOne(item.w.hw, "en", $("sBody").querySelector(".w"));
}

function drawActions(item) {
  const btn = (act, text, cls = "") => `<button type="button" class="bigbtn ${cls}" data-a="${act}">${text}</button>`;
  $("actions").innerHTML =
    item.kind === "new" ? btn("known", "已经认识", "no") + btn("learned", "学会了")
    : !ses.shown ? btn("show", "显示答案", "wide")
    : item.kind === "again" ? btn("next", "记住了，下一个", "wide")
    : btn("forgot", "不记得", "no") + btn("remember", "记得");
}

function show() {
  ses.shown = true;
  $("peek").hidden = true;
  $("answer").hidden = false;
  drawActions(ses.items[ses.pos]);
  hintOnce();
}

function onCardClick(e) {
  const item = ses.items[ses.pos];
  if (!item) return;
  const w = item.w;
  if (cardTap(e, w, $("sBody"))) return;
  if (e.target.closest("#peek")) { show(); return; }
  const b = e.target.closest("[data-a]");
  if (!b) return;
  const c = ses.counts;
  switch (b.dataset.a) {
    case "show": show(); return;
    case "learned": rec.learnNew(w.hw, false); c.fresh++; break;
    case "known": rec.learnNew(w.hw, true); c.known++; break;
    case "remember": rec.review(w.hw, true); c.review++; break;
    case "forgot":
      rec.review(w.hw, false);
      c.review++;
      c.forgot++;
      // a forgotten word comes round once more at the end of today's session
      if (!ses.again.has(w.hw)) { ses.again.add(w.hw); ses.items.push({ kind: "again", w }); }
      break;
  }
  ses.pos++;
  drawCard();
  window.scrollTo(0, 0);
}

function drawDone() {
  const c = ses.counts, streak = rec.streak();
  const parts = [c.fresh && `学会 ${c.fresh} 个新词`, c.known && `${c.known} 个已经认识`, c.review && `复习 ${c.review} 个`,
    c.forgot && `其中 ${c.forgot} 个明天再复习`].filter(Boolean);
  $("sBody").innerHTML = `<div class="done">
    <p class="eyebrow">${ses.items.length ? "完成" : "没有要学的了"}</p>
    <h2 class="donetitle">${ses.items.length ? "今天的学习完成了" : "今天的都学完了"}</h2>
    <p>${parts.length ? parts.join("，") + "。" : "可以再学几个新词，或者做同义替换练习。"}${streak ? ` 已经连续学习 ${streak} 天。` : ""}</p>
    <div class="donebtns">
      <button type="button" class="bigbtn" id="dMore">再学 ${EXTRA} 个新词</button>
      <button type="button" class="bigbtn soft" id="dPara">做同义替换练习</button>
      <button type="button" class="bigbtn no" id="dHome">回到学习首页</button>
    </div></div>`;
  $("dMore").onclick = () => {
    ses = newSession(EXTRA);
    drawCard();
  };
  $("dPara").onclick = () => location.replace("#para");
  $("dHome").onclick = leave;
}
