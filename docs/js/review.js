// 随时复习: flip through words whenever you like, without waiting for them to fall due: the ones studied lately,
// the starred ones, the ones forgotten before, or a volume. A learned word forgotten here comes back tomorrow;
// one remembered keeps its review date.
import { $, esc, ICON, nav, shuffle, closeSheet } from "./util.js";
import { settings, saveSettings, stars } from "./store.js";
import { speakOne } from "./speech.js";
import { words, volumes, volume as volumeById, volumeSheet } from "./dict.js";
import * as rec from "./srs.js";
import { hintOnce } from "./wordinfo.js";
import { cardHTML, cardTap } from "./learn.js";

const SOURCES = [["recent", "最近学过"], ["stars", "收藏"], ["hard", "容易忘的"], ["volume", "按册"]];
const RECENT = [[1, "今天"], [3, "3 天内"], [7, "7 天内"], [30, "30 天内"], [0, "全部学过的"]];
const SIZES = [10, 20, 50, 0];   // 0: all of them
let ses = null;   // a session: { items: [{ w, again }], pos, shown, first: Map(headword → remembered) }

const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));
// the volume 按册 goes through: the one chosen here, otherwise the one new words come from
const volume = () => volumeById(settings.reviewVol) || volumeById(settings.newFrom) || volumes()[0];
// forgotten in a review, or misspelt in 听音写词
const trouble = w => rec.lapsesOf(w.hw) + rec.missCount(w.hw);

// the words a choice covers: the most recent or the most often forgotten first
function pool(src = settings.reviewSrc, days = settings.reviewDays, whole = settings.reviewWhole) {
  const all = words();
  if (src === "recent") {
    const from = rec.today() - days;
    return all.filter(w => { const last = rec.lastStudied(w.hw); return last !== null && (!days || last > from); })
      .sort((a, b) => rec.lastStudied(b.hw) - rec.lastStudied(a.hw));
  }
  if (src === "stars") return all.filter(w => stars.has(w.hw));
  if (src === "hard") return all.filter(w => trouble(w) > 0).sort((a, b) => trouble(b) - trouble(a));
  const V = volume(), list = all.slice(V.first, V.first + V.count);
  return whole ? list : list.filter(w => rec.known(w.hw));
}

export function renderReview(view) {
  ses = null;
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="rClose" aria-label="结束复习">${ICON.close}</button>
      <b class="rtitle">随时复习</b><span class="grow"></span><span class="vcount" id="rCount"></span>
    </div><div class="pbar"><i id="rBar"></i></div></header>
    <div class="drill pad" id="rBody"></div>`;
  $("rClose").onclick = leave;
  $("rBody").onclick = onClick;
  drawSetup();
  return false;
}

/* ---------- choosing what to review ---------- */
function drawSetup() {
  ses = null;
  const body = $("rBody"), list = pool(), src = settings.reviewSrc;
  body.className = "drill pad";
  $("rCount").textContent = "";
  $("rBar").style.width = "0";
  const take = settings.reviewN ? Math.min(settings.reviewN, list.length) : list.length;
  const pressed = on => `aria-pressed="${on}"`;
  let note = "", detail = "";
  if (src === "recent") {
    detail = `<div class="field"><span class="flabel">什么时候学的</span>
      <div class="chiprow">${RECENT.map(([d, name]) =>
        `<button type="button" class="chip" data-days="${d}" ${pressed(d === settings.reviewDays)}>${name}<span class="n">${pool("recent", d).length}</span></button>`).join("")}</div></div>`;
  } else if (src === "volume") {
    detail = `<div class="field"><span class="flabel">哪一册</span>
      <div class="fieldrow wrap">
        <button type="button" class="linkbtn" data-go="vol">${esc(volume().name)}${ICON.down}</button>
        <div class="seg" role="group" aria-label="复习这一册的哪些词">
          <button type="button" data-whole="0" ${pressed(!settings.reviewWhole)}>学过的 ${pool("volume", 0, false).length}</button><button type="button" data-whole="1" ${pressed(settings.reviewWhole)}>整册 ${pool("volume", 0, true).length}</button>
        </div></div></div>`;
  } else if (src === "hard") {
    note = `<p class="note">复习时点过“不记得”、或者听音写词写错过的词，错得多的先来。</p>`;
  } else {
    note = `<p class="note">收藏里还没学过的词也会出现。</p>`;
  }
  body.innerHTML = `
    <p class="lead">不用等到期，想复习就复习。记得的词复习时间不变；学过的词没记住，明天会回到“待复习”里。</p>
    <div class="field"><span class="flabel">复习哪些词</span>
      <div class="chiprow">${SOURCES.map(([id, name]) =>
        `<button type="button" class="chip" data-src="${id}" ${pressed(id === src)}>${name}<span class="n">${pool(id).length}</span></button>`).join("")}</div>
      ${note}
    </div>
    ${detail}
    <div class="field"><span class="flabel">怎么复习</span>
      <div class="fieldrow"><div class="seg" role="group" aria-label="复习方向">
        <button type="button" data-dir="en" ${pressed(settings.reviewDir !== "zh")}>看英文想中文</button><button type="button" data-dir="zh" ${pressed(settings.reviewDir === "zh")}>看中文想英文</button>
      </div></div>
    </div>
    <div class="field"><span class="flabel">每次几个</span>
      <div class="fieldrow"><div class="seg" role="group" aria-label="每次几个">${SIZES.map(n =>
        `<button type="button" data-size="${n}" ${pressed(n === settings.reviewN)}>${n || "全部"}</button>`).join("")}</div></div>
    </div>
    ${list.length ? `<button type="button" class="bigbtn" data-go="start">${ICON.play}开始复习 · ${take} 个词</button>`
      : `<p class="notice">${emptyText()}</p>`}`;
}

function emptyText() {
  return {
    recent: "这段时间还没有学过的词。先在学习首页点“开始今天的学习”学几个新词，或者选“按册”里的“整册”。",
    stars: "还没有收藏的词。在词汇里点词条右边的星星，就能收藏。",
    hard: "还没有记错过的词。复习时点过“不记得”、或者听音写词写错的词，会出现在这里。",
    volume: "这一册还没有学过的词。可以选“整册”，把这一册的词都过一遍。"
  }[settings.reviewSrc];
}

function pickVolume() {
  const all = words();
  const learned = V => { let n = 0; for (let i = V.first; i < V.first + V.count; i++) if (rec.known(all[i].hw)) n++; return n; };
  volumeSheet("复习哪一册", volume().v, V => `已学 ${learned(V)}/${V.count}`, v => {
    settings.reviewVol = v;
    saveSettings();
    closeSheet();
    drawSetup();
  });
}

function onSetupClick(e) {
  const b = e.target.closest("[data-src],[data-days],[data-whole],[data-dir],[data-size],[data-go]");
  if (!b) return;
  const d = b.dataset;
  if (d.go === "vol") { pickVolume(); return; }
  if (d.go === "start") { start(pool()); return; }
  if (d.src) settings.reviewSrc = d.src;
  else if (d.days) settings.reviewDays = Number(d.days);
  else if (d.whole) settings.reviewWhole = d.whole === "1";
  else if (d.dir) settings.reviewDir = d.dir;
  else if (d.size) settings.reviewN = Number(d.size);
  saveSettings();
  drawSetup();
}

/* ---------- the cards ---------- */
function start(list) {
  const n = settings.reviewN || list.length;
  // the most recent or most often forgotten words when there are more than fit, otherwise a random pick
  const ordered = (settings.reviewSrc === "recent" && settings.reviewDays) || settings.reviewSrc === "hard";
  const picked = ordered ? list.slice(0, n) : shuffle(list.slice()).slice(0, n);
  ses = { items: shuffle(picked).map(w => ({ w, again: false })), pos: 0, shown: false, first: new Map() };
  drawCard();
}

function drawCard() {
  const item = ses.items[ses.pos], total = ses.items.length;
  $("rCount").textContent = item ? `${ses.pos + 1} / ${total}` : "";
  $("rBar").style.width = `${Math.round(((item ? ses.pos : total) / total) * 100)}%`;
  if (!item) { drawDone(); return; }
  const w = item.w, zhFirst = settings.reviewDir === "zh";
  ses.shown = false;
  const body = $("rBody");
  body.className = "study pad";
  body.innerHTML = cardHTML(w, item.again ? "再看一遍" : rec.known(w.hw) ? "复习" : "还没学过", zhFirst);
  drawActions();
  if (settings.autoSay && !zhFirst) speakOne(w.hw, "en", body.querySelector(".w"));
}

function drawActions() {
  const item = ses.items[ses.pos];
  const btn = (go, text, cls = "") => `<button type="button" class="bigbtn ${cls}" data-go="${go}">${text}</button>`;
  $("actions").innerHTML = !ses.shown ? btn("show", "显示答案", "wide")
    : item.again ? btn("next", "记住了，下一个", "wide")
    : btn("forgot", "没记住", "no") + btn("remember", "记得");
}

function show() {
  const w = ses.items[ses.pos].w;
  ses.shown = true;
  $("peek").hidden = true;
  $("answer").hidden = false;
  drawActions();
  hintOnce();
  if (settings.autoSay && settings.reviewDir === "zh") speakOne(w.hw, "en", $("answer").querySelector(".w"));
}

function onCardClick(e, item) {
  const w = item.w;
  if (cardTap(e, w, $("rBody"))) return;
  const b = e.target.closest("[data-go]");
  if (!b) return;
  const go = b.dataset.go;
  if (go === "show") { show(); return; }
  if (go === "remember" || go === "forgot") {
    const ok = go === "remember";
    ses.first.set(w.hw, ok);
    rec.practise(w.hw, ok);
    // a word not remembered comes round once more at the end
    if (!ok) ses.items.push({ w, again: true });
  }
  ses.pos++;
  drawCard();
  window.scrollTo(0, 0);
}

/* ---------- the end of a round ---------- */
function drawDone() {
  const total = ses.first.size, missed = [...ses.first].filter(([, ok]) => !ok).map(([hw]) => hw);
  const body = $("rBody");
  body.className = "drill pad";
  body.innerHTML = `<div class="done">
    <p class="eyebrow">复习完成</p>
    <h2 class="donetitle">${missed.length ? `记得 ${total - missed.length} 个，没记住 ${missed.length} 个` : `${total} 个词都记得！`}</h2>
    <p>${missed.length ? "学过的词里没记住的，明天会回到“待复习”里。现在也可以再过一遍。" : "记得的词复习时间不变，到期时会再出现。"}</p>
    <div class="donebtns">
      ${missed.length ? `<button type="button" class="bigbtn" data-go="missed">再复习没记住的 ${missed.length} 个</button>` : ""}
      <button type="button" class="bigbtn${missed.length ? " soft" : ""}" data-go="setup">换一组复习</button>
      <button type="button" class="bigbtn no" data-go="home">回到学习首页</button>
    </div></div>`;
  ses.missed = missed;
}

function onDoneClick(e) {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  if (b.dataset.go === "missed") {
    const set = new Set(ses.missed);
    ses = { items: shuffle(words().filter(w => set.has(w.hw))).map(w => ({ w, again: false })), pos: 0, shown: false, first: new Map() };
    drawCard();
  } else if (b.dataset.go === "setup") drawSetup();
  else leave();
}

function onClick(e) {
  if (!ses) { onSetupClick(e); return; }
  const item = ses.items[ses.pos];
  if (item) onCardClick(e, item);
  else onDoneClick(e);
}
