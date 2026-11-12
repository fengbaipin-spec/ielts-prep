// 听音写词: hear a word and type it, or hear a name, phone number, postcode, date, time or price the way they come up
// in Listening Section 1. Spelling is where many listening marks are lost, so every letter counts.
import { $, esc, ICON, nav, shuffle } from "./util.js";
import { settings, saveSettings, stars } from "./store.js";
import { speakOne, accentVoices, onVoices } from "./speech.js";
import { words, volumes, volume } from "./dict.js";
import * as rec from "./srs.js";

const ROUND = 10;
let round = null;   // { mode, items, pos, results, checked }

const leave = () => (nav.prev === "learn" ? history.back() : location.replace("#learn"));

function wordSources() {
  const all = words(), V = volume(settings.newFrom) || volumes()[0];
  return [
    { id: "learned", name: "已学的词", list: all.filter(w => rec.known(w.hw)) },
    { id: "stars", name: "收藏", list: all.filter(w => stars.has(w.hw)) },
    { id: "volume", name: V.name, list: all.slice(V.first, V.first + V.count) }
  ];
}

/* ---------- numbers and letters, made up fresh each round ---------- */
const pick = list => list[Math.floor(Math.random() * list.length)];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const SURNAMES = ["Thompson", "Whitfield", "Gallagher", "Pemberton", "Holloway", "Ashcroft", "Kingsley", "Harrington", "Blackwood",
  "Fitzgerald", "Llewellyn", "Fairweather", "Cartwright", "Dempsey", "Hargreaves", "Montague", "Prendergast", "Sutcliffe", "Whitaker", "Rutherford"];
const STREETS = ["Oakfield Road", "Riverside Avenue", "Kingsway", "Hillcrest Drive", "Mill Lane", "Station Road", "Elmwood Close",
  "Victoria Street", "Church Lane", "Meadow View", "Granville Terrace", "Beechwood Crescent"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DIGIT = ["oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const squash = s => s.toLowerCase().replace(/[\s.,'’-]/g, "");
// a typed word against the headword: capitals and extra spaces don't count, and "the" in "the Milky Way" may be left out
const plain = s => s.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").replace(/^the /, "");
// digits read the British way, in groups, with "double" for a repeated digit
function sayDigits(groups) {
  return groups.map(g => {
    const out = [];
    for (let i = 0; i < g.length; i++) {
      if (g[i] === g[i + 1]) { out.push("double " + DIGIT[g[i]]); i++; }
      else out.push(DIGIT[g[i]]);
    }
    return out.join(" ");
  }).join(", ");
}
// letter by letter, with "double" for a repeated letter, as in "H, O, double L, O, W, A, Y"
function spellOut(s) {
  const say = c => (/\d/.test(c) ? DIGIT[c].replace("oh", "zero") : c);
  const chars = s.toUpperCase().split(""), out = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === chars[i + 1]) { out.push("double " + say(chars[i])); i++; }
    else out.push(say(chars[i]));
  }
  return out.join(", ");
}
const POSTCODE_AREAS = ["BS", "CB", "OX", "M", "LS", "EH", "NE", "SW", "W", "B", "G", "CF"];
const LETTERS = "ABDEFGHJLNPQRSTUWXYZ";

const MAKERS = [
  () => {
    const name = pick(SURNAMES);
    return { kind: "姓氏", say: `My surname is ${name}. That's ${spellOut(name)}.`, answer: name, ok: t => squash(t) === squash(name) };
  },
  () => {
    const d = "07" + Array.from({ length: 9 }, () => rnd(0, 9)).join("");
    const groups = [d.slice(0, 5), d.slice(5, 8), d.slice(8)];
    return { kind: "电话号码", say: `You can call me on ${sayDigits(groups)}.`, answer: groups.join(" "), ok: t => t.replace(/\D/g, "") === d };
  },
  () => {
    const pc = pick(POSTCODE_AREAS) + rnd(1, 20) + " " + rnd(1, 9) + pick(LETTERS) + pick(LETTERS);
    return { kind: "邮编", say: `The postcode is ${spellOut(pc.replace(" ", ""))}.`, answer: pc, ok: t => squash(t) === squash(pc) };
  },
  () => {
    const day = rnd(1, 28), m = rnd(0, 11);
    const okDate = t => {
      const s = t.toLowerCase();
      const num = (s.match(/\d+/) || [])[0];
      const mon = MONTHS.findIndex(x => s.includes(x.toLowerCase().slice(0, 3)));
      const slash = s.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})$/);
      return slash ? Number(slash[1]) === day && Number(slash[2]) === m + 1 : Number(num) === day && mon === m;
    };
    return { kind: "日期", say: `The course starts on the ${ordinal(day)} of ${MONTHS[m]}.`, answer: `${day} ${MONTHS[m]}`, ok: okDate };
  },
  () => {
    const h = rnd(7, 11), [min, said] = pick([[15, "quarter past"], [30, "half past"], [45, "quarter to"], [50, "ten to"], [10, "ten past"], [20, "twenty past"], [40, "twenty to"]]);
    const hour = min > 30 ? h - 1 : h;
    const shown = `${hour}:${String(min).padStart(2, "0")}`;
    return { kind: "时间", say: `The meeting is at ${said} ${h}.`, answer: shown,
      ok: t => { const m = t.match(/(\d{1,2})\s*[:.]\s*(\d{2})/); return !!m && Number(m[1]) % 12 === hour % 12 && Number(m[2]) === min; } };
  },
  () => {
    const pounds = rnd(3, 95), pence = pick([0, 25, 50, 75, 99, 40, 60]);
    const shown = `£${pounds}.${String(pence).padStart(2, "0")}`;
    const said = pence ? `${pounds} pounds ${pence}` : `${pounds} pounds`;
    return { kind: "价格", say: `It costs ${said}.`, answer: shown, ok: t => {
      const m = t.replace(/[£\s]/g, "").match(/^(\d+)(?:[.,](\d{1,2}))?$/);
      return !!m && Number(m[1]) === pounds && Number((m[2] || "0").padEnd(2, "0")) === pence;
    } };
  },
  () => {
    const n = rnd(2, 180), st = pick(STREETS);
    return { kind: "地址", say: `I live at ${n} ${st}.`, answer: `${n} ${st}`, ok: t => squash(t) === squash(`${n} ${st}`) };
  }
];
export function numberItems() {
  const out = [];
  for (let i = 0; i < ROUND; i++) out.push(MAKERS[i % MAKERS.length]());
  return shuffle(out);
}

/* ---------- screens ---------- */
export function renderSpell(view) {
  round = null;
  view.innerHTML = `
    <header class="vbar"><div class="vrow">
      <button type="button" class="iconbtn" id="xClose" aria-label="结束听写">${ICON.close}</button>
      <b class="rtitle">听音写词</b><span class="grow"></span><span class="vcount" id="xCount"></span>
    </div><div class="pbar"><i id="xBar"></i></div></header>
    <div class="drill pad" id="xBody"></div>`;
  $("xClose").onclick = leave;
  drawSetup();
  return false;
}
onVoices(() => { if (!round && $("xBody") && $("xSetup")) drawSetup(); });

function drawSetup() {
  const src = wordSources(), mode = settings.spellMode;
  if (!src.some(s => s.id === settings.spellSrc && s.list.length)) settings.spellSrc = (src.find(s => s.list.length >= 5) || src[2]).id;
  const accents = accentVoices();
  $("xCount").textContent = "";
  $("xBar").style.width = "0";
  $("xBody").innerHTML = `<div id="xSetup" class="drill-in">
    <p class="lead">${mode === "words"
      ? `每轮 ${ROUND} 个词。听到单词后写下来，拼错的字母会标出来。听力填空错一个字母就不得分。`
      : `每轮 ${ROUND} 题，都是听力第一部分常考的：姓氏拼读、电话号码、邮编、日期、时间、价格、地址。`}</p>
    <div class="field"><span class="flabel">练什么</span>
      <div class="fieldrow"><div class="seg" id="xMode" role="group" aria-label="练什么">
        <button type="button" data-mode="words" aria-pressed="${mode === "words"}">单词拼写</button><button type="button" data-mode="numbers" aria-pressed="${mode === "numbers"}">数字和字母</button>
      </div></div>
    </div>
    ${mode === "words" ? `<div class="field"><span class="flabel">单词来自</span>
      <div class="chiprow" id="xSrc">${src.map(s => `<button type="button" class="chip" data-src="${s.id}" aria-pressed="${s.id === settings.spellSrc}"${s.list.length ? "" : " disabled"}>${esc(s.name)}<span class="n">${s.list.length}</span></button>`).join("")}</div>
    </div>` : ""}
    <label class="switch"><span>轮换口音<small>${accents.length > 1 ? `手机上有：${accents.map(a => a.name).join("、")}` : "手机上只找到一种英语声音"}</small></span><input type="checkbox" id="xAcc"${settings.accents ? " checked" : ""}${accents.length > 1 ? "" : " disabled"}></label>
    <button type="button" class="bigbtn" id="xStart">${ICON.play}开始</button>
    <p class="note">${mode === "words" ? "写错过的词会更常出现，写对一次后恢复正常；它们也会出现在随时复习的“容易忘的”里。" : "日期可以写 23 March 或 23/3，时间写 7:15，价格写 12.50。"}</p></div>`;
  $("xMode").onclick = e => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    settings.spellMode = b.dataset.mode;
    saveSettings();
    drawSetup();
  };
  if ($("xSrc")) $("xSrc").onclick = e => {
    const b = e.target.closest("[data-src]");
    if (!b || b.disabled) return;
    settings.spellSrc = b.dataset.src;
    saveSettings();
    drawSetup();
  };
  $("xAcc").onchange = e => { settings.accents = e.target.checked; saveSettings(); };
  $("xStart").onclick = start;
}

function start() {
  const accents = accentVoices();
  const voice = () => (settings.accents && accents.length > 1 ? pick(accents) : accents[0] || { name: "", v: null });
  let items;
  if (settings.spellMode === "numbers") {
    items = numberItems().map(x => ({ ...x, voice: voice() }));
  } else {
    // words misspelt before come first, then the ones learned most recently; random among equals
    const pool = shuffle(wordSources().find(s => s.id === settings.spellSrc).list.slice());
    pool.sort((a, b) => rec.missCount(b.hw) - rec.missCount(a.hw));
    items = shuffle(pool.slice(0, ROUND)).map(w => ({ kind: "单词", w, say: w.hw, answer: w.hw, voice: voice(),
      ok: t => plain(t) === plain(w.hw),
      near: t => squash(plain(t)) === squash(plain(w.hw)) }));
  }
  round = { items, pos: 0, results: [] };
  drawItem();
}

function say(slow) {
  const it = round.items[round.pos];
  speakOne(it.say, "en", $("xPlay"), slow ? 0.6 : null, it.voice.v);
}

function drawItem() {
  const it = round.items[round.pos];
  if (!it) { drawSummary(); return; }
  round.checked = false;
  $("xCount").textContent = `${round.pos + 1} / ${round.items.length}`;
  $("xBar").style.width = `${Math.round((round.pos / round.items.length) * 100)}%`;
  $("xBody").innerHTML = `
    <p class="eyebrow">${it.kind}${it.voice.name && settings.accents ? ` · ${it.voice.name}` : ""}</p>
    <div class="eplay">
      <button type="button" class="pbtn it" id="xPlay">${ICON.play}再听一遍</button>
      <button type="button" class="pbtn en" id="xSlow">${ICON.play}慢速</button>
    </div>
    <input class="spell-ans" id="xAns" lang="en" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
      enterkeyhint="done" aria-label="写下你听到的" placeholder="写下你听到的${it.kind === "单词" ? "单词" : it.kind}">
    <button type="button" class="bigbtn" id="xCheck">检查</button>
    <div id="xResult"></div>`;
  $("xPlay").onclick = () => say(false);
  $("xSlow").onclick = () => say(true);
  $("xCheck").onclick = check;
  $("xAns").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); round.checked ? next() : check(); } });
  $("xAns").focus();
  say(false);
}

// the right spelling with the letters that went wrong marked, by aligning the two words
function marked(right, typed) {
  const a = right, b = typed.trim();
  const D = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
    }
  }
  const bad = new Set();
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i && j && D[i][j] === D[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)) {
      if (a[i - 1].toLowerCase() !== b[j - 1].toLowerCase()) bad.add(i - 1);
      i--; j--;
    } else if (i && D[i][j] === D[i - 1][j] + 1) { bad.add(i - 1); i--; }
    else j--;
  }
  return a.split("").map((c, k) => (bad.has(k) ? `<span class="dw bad">${esc(c)}</span>` : esc(c))).join("");
}

function check() {
  const it = round.items[round.pos], typed = $("xAns").value;
  if (!typed.trim()) { $("xAns").focus(); return; }
  round.checked = true;
  const right = it.ok(typed), near = !right && it.near && it.near(typed);
  round.results.push({ it, typed, right });
  if (it.w) rec.noteDictation(it.w.hw, right);
  $("xAns").readOnly = true;
  $("xCheck").textContent = round.pos + 1 < round.items.length ? "下一个" : "看结果";
  $("xCheck").onclick = next;
  $("xResult").innerHTML = `<div class="result ${right ? "good" : "bad"}">
    <p class="verdict">${right ? "写对了！" : near ? "差一点：注意空格、连字符或撇号" : "写错了"}</p>
    ${right ? "" : `<p class="marked" lang="en">${it.w ? marked(it.answer, typed) : esc(it.answer)}</p><p class="note">你写的：<span lang="en">${esc(typed)}</span></p>`}
    ${it.w ? `<p class="note"><b lang="en">${esc(it.w.hw)}</b> ${esc(it.w.ipa)} ${esc(it.w.zh)}</p>` : `<p class="note" lang="en">${esc(it.say)}</p>`}
  </div>`;
}

function next() {
  round.pos++;
  drawItem();
  window.scrollTo(0, 0);
}

function drawSummary() {
  const right = round.results.filter(r => r.right).length, wrong = round.results.filter(r => !r.right);
  $("xCount").textContent = "";
  $("xBar").style.width = "100%";
  $("xBody").innerHTML = `<div class="done">
    <p class="eyebrow">这一轮完成</p>
    <h2 class="donetitle">写对 ${right} / ${round.results.length}</h2>
    ${wrong.length ? `<ul class="wronglist">${wrong.map(r => `<li><b lang="en">${esc(r.it.answer)}</b><span class="note">你写的：${esc(r.typed)}</span></li>`).join("")}</ul>` : "<p>全部写对了！</p>"}
    <div class="donebtns">
      <button type="button" class="bigbtn" id="xAgain">再来一轮</button>
      <button type="button" class="bigbtn soft" id="xSetupBtn">换个练法</button>
      <button type="button" class="bigbtn no" id="xHome">回到学习首页</button>
    </div></div>`;
  $("xAgain").onclick = start;
  $("xSetupBtn").onclick = () => { round = null; drawSetup(); };
  $("xHome").onclick = leave;
}
