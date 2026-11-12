// Settings: voice and speed, the exam (type and date), study options, speech recognition, backup, install and updates.
import { $, esc, toast } from "./util.js";
import { settings, saveSettings, stars, saveStars, paraMiss } from "./store.js";
import { speech, voicesFor, chooseVoice, onVoices, speakOne, accentVoices } from "./speech.js";
import { pwa, onPwa, promptInstall, checkForUpdate } from "./pwa.js";
import { wordCount, clearFlips, levels, LEVEL_NAMES } from "./dict.js";
import { learnedCount, masteredCount, exportRecords, importRecords } from "./srs.js";
import { setNewPerDay, MAX_NEW, daysToExam } from "./learn.js";
import { canRecognize } from "./listen.js";
import { mlog, importLog } from "./mistakes.js";
import { drafts, saveDrafts } from "./writing.js";
import { VERSION } from "./version.js";

const SAMPLE = "In my view, the benefits of this development clearly outweigh the drawbacks.";

export function renderSettings(view) {
  view.innerHTML = `
    <header class="vbar"><div class="vrow"><h1 class="vtitle">设置</h1></div></header>
    <div class="settings pad">
      <section class="group" id="gInstall"></section>

      <section class="group">
        <h2>发音</h2>
        <p id="vStatus"></p>
        <div class="field">
          <label for="vEn">英语声音</label>
          <div class="fieldrow"><select id="vEn"></select><button type="button" class="txtbtn" id="testEn">试听</button></div>
        </div>
        <div class="notice" id="vWarn" hidden></div>
        <div class="field">
          <span class="flabel">语速</span>
          <div class="fieldrow"><div class="seg" id="rates" role="group" aria-label="语速">
            <button type="button" data-rate="0.7">慢速</button><button type="button" data-rate="0.9">中速</button><button type="button" data-rate="1">正常</button>
          </div></div>
        </div>
      </section>

      <section class="group">
        <h2>考试</h2>
        <div class="field">
          <span class="flabel">考哪一类</span>
          <div class="fieldrow"><div class="seg" id="examType" role="group" aria-label="考哪一类">
            <button type="button" data-t="A">学术类（A 类）</button><button type="button" data-t="G">培训类（G 类）</button>
          </div></div>
          <p class="note">两类的听力、口语和大作文一样；阅读文章和小作文不同，阅读分数的换算也不同。</p>
        </div>
        <div class="field">
          <label for="examDate">考试日期</label>
          <div class="fieldrow"><input type="date" id="examDate" class="mtext"><button type="button" class="txtbtn" id="examClear">清除</button></div>
          <p class="note" id="examNote"></p>
        </div>
      </section>

      <section class="group">
        <h2>学习</h2>
        <div class="field">
          <span class="flabel">每天新词</span>
          <div class="fieldrow wrap">
            <div class="seg" id="perDay" role="group" aria-label="每天新词">
              <button type="button" data-n="5">5</button><button type="button" data-n="10">10</button><button type="button" data-n="15">15</button><button type="button" data-n="20">20</button>
            </div>
            <label class="numfield" for="perDayNum">自定义
              <input type="number" id="perDayNum" inputmode="numeric" min="0" max="${MAX_NEW}" step="1">个</label>
          </div>
          <p class="note">可以填 0 到 ${MAX_NEW}。填 0 表示先暂停新词，只做复习。</p>
        </div>
        <label class="switch"><span>学单词时自动朗读</span><input type="checkbox" id="sAuto"></label>
      </section>

      <section class="group">
        <h2>口语</h2>
        <label class="switch"><span>发音识别<small>说完以后，把回答转成文字，统计词数、语速和重复最多的词。需要联网，录音会发给 Google 识别。</small></span><input type="checkbox" id="sRecog"></label>
        <p class="note" id="recogNote"></p>
      </section>

      <section class="group">
        <h2>词汇</h2>
        <label class="switch"><span>例句默认展开</span><input type="checkbox" id="sExOpen"></label>
        <label class="switch"><span>连读时也读例句</span><input type="checkbox" id="sPlayEx"></label>
      </section>

      <section class="group">
        <h2>学习记录</h2>
        <p id="records"></p>
        <div class="btnrow">
          <button type="button" class="txtbtn" id="exportBtn">导出备份</button>
          <button type="button" class="txtbtn" id="importBtn">导入备份</button>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </div>
        <p class="note">单词进度、收藏、错题本和作文草稿只保存在这台手机上。换手机或清除浏览器数据之前，先导出一份备份。</p>
      </section>

      <section class="group">
        <h2>离线和更新</h2>
        <p id="offline"></p>
        <div class="btnrow"><button type="button" class="txtbtn" id="updBtn">检查更新</button></div>
      </section>

      <section class="group about">
        <h2>说明</h2>
        <p>词汇 ${wordCount()} 个（${levels().map(L => LEVEL_NAMES[L] || L).join("、")}），同义替换、大作文范文和口语参考回答都是为这个 App 原创的练习材料，不是官方真题。整套模考请用剑桥雅思真题书，做完把成绩和错题记在“听读错题本”里。</p>
        <p>范文和参考回答按 8 分的标准来写，只是参考写法，不是考官评过分的答卷。</p>
        <p>发音用的是手机自带的语音，和考试录音里的真人发音会有差别。</p>
      </section>
    </div>`;

  $("vEn").onchange = e => { chooseVoice(e.target.value); speakOne(SAMPLE, "en", $("testEn")); };
  $("testEn").onclick = e => speakOne(SAMPLE, "en", e.currentTarget);
  $("rates").onclick = e => {
    const b = e.target.closest("[data-rate]");
    if (!b) return;
    settings.rate = Number(b.dataset.rate);
    saveSettings();
    drawRates();
  };
  $("examType").onclick = e => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    settings.examType = b.dataset.t;
    saveSettings();
    drawExam();
  };
  $("examDate").onchange = e => { settings.examDate = e.target.value; saveSettings(); drawExam(); };
  $("examClear").onclick = () => { settings.examDate = ""; saveSettings(); drawExam(); };
  $("perDay").onclick = e => {
    const b = e.target.closest("[data-n]");
    if (!b) return;
    setNewPerDay(Number(b.dataset.n));
    drawPerDay();
  };
  $("perDayNum").onchange = e => {
    const n = Number(e.target.value);
    if (e.target.value.trim() !== "" && Number.isFinite(n)) {
      const saved = setNewPerDay(n);
      toast(saved ? `每天 ${saved} 个新词` : "已暂停新词，只做复习");
    }
    drawPerDay();
  };
  $("perDayNum").onkeydown = e => { if (e.key === "Enter") e.target.blur(); };
  $("sAuto").checked = settings.autoSay;
  $("sAuto").onchange = e => { settings.autoSay = e.target.checked; saveSettings(); };
  const recogOk = canRecognize();
  $("sRecog").checked = settings.recognize && recogOk;
  $("sRecog").disabled = !recogOk;
  $("sRecog").onchange = e => {
    settings.recognize = e.target.checked;
    saveSettings();
    toast(settings.recognize ? "已打开发音识别：说完会联网识别" : "已关闭发音识别：麦克风只录音");
  };
  $("recogNote").textContent = recogOk
    ? "关着的时候，麦克风只是录音：录音只在这台手机上播放，不保存，也不上传。"
    : "这个浏览器不支持语音识别。麦克风只是录音：录音只在这台手机上播放，不保存，也不上传。";
  $("sExOpen").checked = settings.exOpen;
  $("sExOpen").onchange = e => { settings.exOpen = e.target.checked; clearFlips(); saveSettings(); };
  $("sPlayEx").checked = settings.playEx;
  $("sPlayEx").onchange = e => { settings.playEx = e.target.checked; saveSettings(); };
  $("exportBtn").onclick = exportBackup;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = importBackup;
  $("updBtn").onclick = async () => toast(await checkForUpdate());

  drawInstall();
  drawVoices();
  drawRates();
  drawExam();
  drawPerDay();
  drawRecords();
  drawOffline();
  return false;
}

function drawInstall() {
  const g = $("gInstall");
  if (!g) return;
  if (pwa.standalone) { g.hidden = true; return; }
  g.innerHTML = `<h2>安装到桌面</h2><p>安装以后从桌面图标打开，全屏显示，没有网络也能用。</p>` + (pwa.prompt
    ? `<div class="btnrow"><button type="button" class="txtbtn primary" id="installBtn">安装</button></div>`
    : `<p class="note">在 Chrome 里点右上角的菜单 ⋮，选“安装应用”或“添加到主屏幕”。</p>`);
  if ($("installBtn")) $("installBtn").onclick = () => promptInstall();
}

function drawVoices() {
  const sel = $("vEn");
  if (!sel) return;
  const list = voicesFor("en");
  sel.innerHTML = list.length
    ? list.map(v => `<option value="${esc(v.name)}"${speech.en && v.name === speech.en.name ? " selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")
    : '<option value="">没有找到英语声音</option>';
  sel.disabled = !list.length;
  const status = $("vStatus"), warn = $("vWarn");
  if (!speech.supported) { status.textContent = "这个浏览器不能朗读。请用 Chrome 打开。"; warn.hidden = true; return; }
  if (!speech.checked) { status.textContent = "正在读取手机里的声音…"; return; }
  const accents = accentVoices().slice(1).map(a => a.name);
  status.textContent = speech.en ? `现在用：${speech.en.name}${accents.length ? `。听音写词还可以轮换：${accents.join("、")}` : ""}` : "";
  warn.hidden = !!speech.en && accents.length > 0;
  warn.innerHTML = speech.en
    ? `<p>手机上只有一种英语口音。想在听音写词里练不同口音，可以多装几种英语语音：</p><ul><li>安卓：设置 → 搜索“文字转语音” → Google 语音服务旁边的齿轮 → 安装语音数据，下载 English (United Kingdom)、English (Australia) 等。</li></ul>`
    : `<p><b>没有找到英语声音。</b></p><ul><li>安卓：设置 → 搜索“文字转语音” → 首选引擎选 Google 语音服务 → 齿轮 → 安装语音数据，下载 English (United Kingdom)。</li><li>装好以后，把这个 App 完全关掉再打开。</li></ul>`;
}
onVoices(drawVoices);

function drawRates() {
  document.querySelectorAll("#rates button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.rate) === settings.rate)));
}
function drawExam() {
  document.querySelectorAll("#examType button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === settings.examType)));
  if (!$("examDate")) return;
  $("examDate").value = settings.examDate || "";
  const left = daysToExam();
  $("examNote").textContent = left == null ? "填了以后，学习首页会显示离考试还有几天。" : left >= 0 ? `离考试还有 ${left} 天。` : "这个日期已经过去了。";
}
function drawPerDay() {
  document.querySelectorAll("#perDay button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.n) === settings.newPerDay)));
  if ($("perDayNum")) $("perDayNum").value = settings.newPerDay;
}
function drawRecords() {
  if (!$("records")) return;
  const written = Object.values(drafts).filter(d => d && d.done).length;
  $("records").textContent = `已学 ${learnedCount()} 个词（已掌握 ${masteredCount()} 个）· 收藏 ${stars.size} 个 · 错题 ${mlog.items.length} 道 · 成绩 ${mlog.tests.length} 条 · 写过作文 ${written} 篇`;
}
function drawOffline() {
  const p = $("offline");
  if (!p) return;
  p.textContent = !pwa.supported ? "这个浏览器不支持离线使用。"
    : pwa.offlineReady ? `已可离线使用 · 版本 ${VERSION}`
    : pwa.failed ? `离线功能没有启动，联网时可以正常使用 · 版本 ${VERSION}`
    : `正在准备离线内容… · 版本 ${VERSION}`;
}
onPwa(() => { drawInstall(); drawOffline(); });

function exportBackup() {
  const data = { app: "ielts-prep", format: 1, exported: new Date().toISOString(), stars: [...stars], ...exportRecords(),
    paraMiss: paraMiss.all(), mlog, drafts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `雅思备考备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("备份文件已生成，在手机的“下载”里");
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "ielts-prep" || !Array.isArray(data.stars)) throw new Error("not a backup");
    data.stars.forEach(s => { if (typeof s === "string") stars.add(s); });
    saveStars();
    importRecords(data);
    paraMiss.merge(data.paraMiss);
    importLog(data.mlog);
    for (const [id, d] of Object.entries(data.drafts || {})) {
      if (d && typeof d.text === "string" && (!drafts[id] || (d.updated || 0) > (drafts[id].updated || 0))) drafts[id] = d;
    }
    saveDrafts();
    drawRecords();
    toast(`已导入：已学 ${learnedCount()} 个词，收藏 ${stars.size} 个，错题 ${mlog.items.length} 道`);
  } catch (err) {
    toast("这个文件不是本 App 导出的备份");
  }
}
