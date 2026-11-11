// 听读错题本: while working through the Cambridge IELTS books on paper, note each listening and reading test's score
// and every question that went wrong, with its type and why. The counts show which kind of mistake costs the
// most marks, and point to the drill that trains it. Everything stays on this phone (and in the backup file).
import { $, esc, ICON, nav, openSheet, closeSheet, toast } from "./util.js";
import { store, settings } from "./store.js";

export const mlog = store.get("mlog", { tests: [], items: [] });
export const saveLog = () => store.set("mlog", mlog);

const SKILLS = ["听力", "阅读"];
const PARTS = { 听力: ["Part 1", "Part 2", "Part 3", "Part 4"], 阅读: ["Passage 1", "Passage 2", "Passage 3"] };
const TYPES = {
  听力: ["填空（表格、笔记、句子）", "单选", "多选", "配对", "地图、平面图", "流程图、图表"],
  阅读: ["判断 T/F/NG", "判断 Y/N/NG", "段落标题", "段落信息配对", "特征配对", "句子结尾配对", "填空（句子、摘要、表格）", "单选", "多选", "简答"]
};
// why it went wrong, and what to do about it
const REASONS = [
  ["拼写错误", "听音写词练单词拼写", "#spell"],
  ["单复数", "填空前先看空格前后：a/an、动词单复数会提示要不要加 s", "#spell"],
  ["超出字数", "看清 NO MORE THAN TWO WORDS 这类要求，数字也算一个词", ""],
  ["同义替换没认出", "做同义替换练习，复盘时把题目和原文对应的词写进备注", "#para"],
  ["没听到或没找到", "先划出名字、数字、专有名词这些好定位的词，再往下听或读", ""],
  ["定位错了", "答案通常按题目顺序出现；回头核对上一题答案所在的位置", ""],
  ["F 和 NG 混淆", "False 是原文说了相反的意思；Not Given 是原文根本没说到这一点", ""],
  ["理解错了", "把这一句逐词读懂，尤其注意 not、only、never 和比较级", ""],
  ["时间不够", "阅读每篇不超过 20 分钟；一道题卡住超过两分钟就先跳过", ""],
  ["粗心", "检查时专门看拼写、大小写和单复数", ""]
];

// raw score out of 40 → band, from the published conversion tables
const BANDS = {
  听力: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
  阅读A: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]],
  阅读G: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5]]
};
export function band(skill, raw) {
  const table = skill === "听力" ? BANDS.听力 : settings.examType === "G" ? BANDS.阅读G : BANDS.阅读A;
  for (const [min, b] of table) if (raw >= min) return b;
  return raw > 0 ? 2 : 0;
}
// how many right answers a band needs
export function rawFor(skill, target) {
  const table = skill === "听力" ? BANDS.听力 : settings.examType === "G" ? BANDS.阅读G : BANDS.阅读A;
  const row = table.find(([, b]) => b === target);
  return row ? row[0] : null;
}

let filter = "全部";
const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));
const lastBook = () => (mlog.items[0] || mlog.tests[0] || {}).book || "剑桥雅思 18";

export function renderMistakes(view) {
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="mClose" aria-label="返回学习首页">${ICON.close}</button>
      <b class="rtitle">听读错题本</b><span class="grow"></span>
    </div></header>
    <div class="drill pad" id="mBody"></div>`;
  $("mClose").onclick = leave;
  $("mBody").onclick = onClick;
  draw();
  return false;
}

function draw() {
  const items = mlog.items.filter(x => filter === "全部" || x.skill === filter);
  const count = key => {
    const m = new Map();
    for (const x of items) m.set(x[key], (m.get(x[key]) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const bars = (rows, withTips) => {
    const top = rows.length ? rows[0][1] : 1;
    return rows.map(([name, n]) => {
      const r = withTips ? REASONS.find(x => x[0] === name) : null;
      return `<div class="mrow"><div class="mrow-top"><span>${esc(name)}</span><span class="mn">${n}</span></div>
        <span class="mbar"><i style="width:${Math.round((n / top) * 100)}%"></i></span>
        ${r ? `<p class="note">${esc(r[1])}${r[2] ? ` <a class="linkbtn" href="${r[2]}">去练习${ICON.fwd}</a>` : ""}</p>` : ""}</div>`;
    }).join("");
  };
  const tests = mlog.tests.slice().sort((a, b) => b.date - a.date);
  const last = s => tests.find(t => t.skill === s);
  const need = rawFor("听力", 8.5), needR = rawFor("阅读", 8.5);
  $("mBody").innerHTML = `
    <p class="lead">做剑桥雅思真题时，把每套听力、阅读的分数和每道错题记在这里，看看分数主要丢在哪里。目标 8.5 分：听力要对 ${need} 题，阅读（${settings.examType === "G" ? "G 类" : "A 类"}）要对 ${needR} 题。</p>
    <div class="btnrow">
      <button type="button" class="bigbtn" data-go="item">${ICON.check}记一道错题</button>
      <button type="button" class="bigbtn soft" data-go="test">记一套成绩</button>
    </div>
    <section class="group">
      <h2>成绩</h2>
      ${tests.length ? `<div class="mlast">${SKILLS.map(s => last(s) ? `<div class="stat"><b>${band(s, last(s).raw)}</b><span>最近一次${s}（${last(s).raw}/40）</span></div>` : "").join("")}</div>
        <ul class="mtests">${tests.slice(0, 12).map(t => `<li><span>${esc(t.book)} · ${esc(t.test)} · ${t.skill}</span><span class="mn">${t.raw}/40 → <b>${band(t.skill, t.raw)}</b></span>
          <button type="button" class="iconbtn" data-del-test="${t.id}" aria-label="删除这条成绩">${ICON.close}</button></li>`).join("")}</ul>`
        : `<p class="note">还没有记录。做完一套听力或阅读，点“记一套成绩”，分数会自动换算成雅思分。</p>`}
    </section>
    <div class="chiprow">${["全部", ...SKILLS].map(s => `<button type="button" class="chip" data-filter="${s}" aria-pressed="${s === filter}">${s}<span class="n">${s === "全部" ? mlog.items.length : mlog.items.filter(x => x.skill === s).length}</span></button>`).join("")}</div>
    ${items.length ? `
      <section class="group"><h2>错因 · 最多的在上面</h2>${bars(count("reason"), true)}</section>
      <section class="group"><h2>题型</h2>${bars(count("type"), false)}</section>
      <section class="group"><h2>错题 · ${items.length} 道</h2>
        <ul class="mitems">${items.map(x => `<li>
          <div class="mi-top"><b>${esc(x.book)} · ${esc(x.test)} · ${esc(x.part)} · 第 ${esc(x.q)} 题</b>
            <button type="button" class="iconbtn" data-del="${x.id}" aria-label="删除这道错题">${ICON.close}</button></div>
          <p class="note">${esc(x.skill)} · ${esc(x.type)} · <span class="mreason">${esc(x.reason)}</span></p>
          ${x.mine || x.right ? `<p lang="en">${x.mine ? `我写的：<s>${esc(x.mine)}</s>　` : ""}${x.right ? `答案：<b>${esc(x.right)}</b>` : ""}</p>` : ""}
          ${x.note ? `<p class="mnote">${esc(x.note)}</p>` : ""}
        </li>`).join("")}</ul></section>`
      : `<p class="note">${mlog.items.length ? "这一类还没有错题。" : "还没有错题。每做完一套，把错的题记下来：题号、题型、为什么错。记得越具体，越容易看出问题。"}</p>`}`;
}

/* ---------- the two forms ---------- */
const field = (label, inner) => `<div class="field"><span class="flabel">${label}</span>${inner}</div>`;
const segOf = (name, values, current) => `<div class="seg" role="group" data-seg="${name}">${values.map(v =>
  `<button type="button" data-val="${esc(v)}" aria-pressed="${v === current}">${esc(v)}</button>`).join("")}</div>`;
const selectOf = (id, values, current) => `<select id="${id}" class="mselect">${values.map(v =>
  `<option${v === current ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
const TESTS = ["Test 1", "Test 2", "Test 3", "Test 4"];

function testForm() {
  const prev = mlog.tests[0] || {};
  let skill = prev.skill || "听力";
  const html = `<div class="mform">
    ${field("书", `<input id="fBook" class="mtext" value="${esc(lastBook())}">`)}
    ${field("哪一套", selectOf("fTest", TESTS, prev.test || "Test 1"))}
    ${field("哪一项", segOf("skill", SKILLS, skill))}
    ${field("答对几题（满分 40）", `<div class="fieldrow"><input id="fRaw" class="mtext short" type="number" inputmode="numeric" min="0" max="40"><span class="mband" id="fBand"></span></div>`)}
    <button type="button" class="bigbtn" data-save="test">保存</button></div>`;
  openSheet("记一套成绩", html, e => {
    const s = e.target.closest("[data-seg] [data-val]");
    if (s) { skill = s.dataset.val; s.parentNode.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === s))); showBand(); return; }
    if (!e.target.closest("[data-save]")) return;
    const raw = Number($("fRaw").value);
    if ($("fRaw").value === "" || !(raw >= 0 && raw <= 40)) { $("fRaw").focus(); toast("请填 0 到 40"); return; }
    mlog.tests.unshift({ id: Date.now(), date: Date.now(), book: $("fBook").value.trim() || "剑桥雅思", test: $("fTest").value, skill, raw: Math.round(raw) });
    saveLog();
    closeSheet();
    toast(`已记下：${skill} ${Math.round(raw)}/40，约 ${band(skill, raw)} 分`);
    draw();
  });
  const showBand = () => { const v = $("fRaw").value; $("fBand").textContent = v === "" ? "" : `约 ${band(skill, Number(v))} 分`; };
  $("fRaw").addEventListener("input", showBand);
}

function itemForm() {
  const prev = mlog.items[0] || {};
  let skill = prev.skill || "听力", reason = "";
  const draw2 = () => {
    $("fPartBox").innerHTML = selectOf("fPart", PARTS[skill], prev.skill === skill ? prev.part : PARTS[skill][0]);
    $("fTypeBox").innerHTML = selectOf("fType", TYPES[skill], prev.skill === skill ? prev.type : TYPES[skill][0]);
  };
  const html = `<div class="mform">
    ${field("书和哪一套", `<div class="fieldrow"><input id="fBook" class="mtext" value="${esc(lastBook())}">${selectOf("fTest", TESTS, prev.test || "Test 1")}</div>`)}
    ${field("哪一项", segOf("skill", SKILLS, skill))}
    ${field("部分和题号", `<div class="fieldrow"><span id="fPartBox"></span><input id="fQ" class="mtext short" type="number" inputmode="numeric" min="1" max="40" placeholder="题号"></div>`)}
    ${field("题型", `<span id="fTypeBox"></span>`)}
    ${field("为什么错", `<div class="chiprow" id="fReasons">${REASONS.map(([r]) => `<button type="button" class="chip" data-reason="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("")}</div>`)}
    ${field("我的答案和正确答案（可以不填）", `<div class="fieldrow"><input id="fMine" class="mtext" lang="en" placeholder="我写的" autocapitalize="off" spellcheck="false"><input id="fRight" class="mtext" lang="en" placeholder="答案" autocapitalize="off" spellcheck="false"></div>`)}
    ${field("备注（可以不填）", `<textarea id="fNote" class="mtext" rows="2" placeholder="比如：题目 rise ↔ 原文 went up"></textarea>`)}
    <button type="button" class="bigbtn" data-save="item">保存</button></div>`;
  openSheet("记一道错题", html, e => {
    const s = e.target.closest("[data-seg] [data-val]");
    if (s) { skill = s.dataset.val; s.parentNode.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === s))); draw2(); return; }
    const r = e.target.closest("[data-reason]");
    if (r) { reason = r.dataset.reason; document.querySelectorAll("#fReasons .chip").forEach(c => c.setAttribute("aria-pressed", String(c === r))); return; }
    if (!e.target.closest("[data-save]")) return;
    const q = Number($("fQ").value);
    if (!(q >= 1 && q <= 40)) { $("fQ").focus(); toast("请填题号（1 到 40）"); return; }
    if (!reason) { toast("请选一个错因"); return; }
    mlog.items.unshift({ id: Date.now(), date: Date.now(), book: $("fBook").value.trim() || "剑桥雅思", test: $("fTest").value, skill,
      part: $("fPart").value, q: String(Math.round(q)), type: $("fType").value, reason,
      mine: $("fMine").value.trim(), right: $("fRight").value.trim(), note: $("fNote").value.trim() });
    saveLog();
    closeSheet();
    toast("已记下这道错题");
    draw();
  });
  draw2();
}

function onClick(e) {
  const f = e.target.closest("[data-filter]");
  if (f) { filter = f.dataset.filter; draw(); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    if (!confirm("删除这道错题？")) return;
    mlog.items = mlog.items.filter(x => String(x.id) !== del.dataset.del);
    saveLog();
    draw();
    return;
  }
  const delT = e.target.closest("[data-del-test]");
  if (delT) {
    if (!confirm("删除这条成绩？")) return;
    mlog.tests = mlog.tests.filter(x => String(x.id) !== delT.dataset.delTest);
    saveLog();
    draw();
    return;
  }
  const b = e.target.closest("[data-go]");
  if (!b) return;
  if (b.dataset.go === "item") itemForm();
  else if (b.dataset.go === "test") testForm();
}

// backup: merge entries by id, keeping both sides
export function exportLog() { return mlog; }
export function importLog(data) {
  if (!data || !Array.isArray(data.tests) || !Array.isArray(data.items)) return;
  for (const key of ["tests", "items"]) {
    const have = new Set(mlog[key].map(x => x.id));
    for (const x of data[key]) if (x && Number.isFinite(x.id) && !have.has(x.id)) mlog[key].push(x);
    mlog[key].sort((a, b) => b.date - a.date);
  }
  saveLog();
}
