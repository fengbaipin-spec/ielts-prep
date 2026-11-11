// Speech recognition, an optional setting that is off by default: Chrome sends the recording to Google and gets
// back what it understood. In 口语 it turns an answer into text, so you can see how many words you said, how fast,
// and which words you keep repeating.
const recognizer = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
export const canRecognize = () => !!recognizer();

let active = null;

// keeps listening until stopRecognizing() (or until the phone gives up after a long silence);
// onText gets the text so far, including words not yet final; resolves with { text, error }
export function recognizeLong(lang = "en-GB", onText) {
  return new Promise(resolve => {
    const SR = recognizer();
    if (!SR) { resolve({ text: "", error: "unsupported" }); return; }
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    let finals = "", error = null;
    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) finals += (finals ? " " : "") + t;
        else interim += (interim ? " " : "") + t;
      }
      if (onText) onText((finals + (interim ? " " + interim : "")).trim());
    };
    r.onerror = e => { error = e.error || "error"; };
    r.onend = () => {
      if (active === r) active = null;
      resolve({ text: finals.trim(), error: finals ? null : error || "no-speech" });
    };
    active = r;
    try {
      r.start();
    } catch (e) {
      active = null;
      resolve({ text: "", error: "start" });
    }
  });
}
export function stopRecognizing() {
  if (active) active.stop();
}
export const isRecognizing = () => !!active;

export function recognitionError(code) {
  return {
    "no-speech": "没听到声音，再说一次",
    "audio-capture": "没有找到麦克风",
    "not-allowed": "需要允许使用麦克风",
    "service-not-allowed": "这台手机现在不能用语音识别",
    network: "发音识别需要联网",
    aborted: "已停止",
    unsupported: "这个浏览器不支持语音识别"
  }[code] || "识别没有成功，再试一次";
}
