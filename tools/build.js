// Checks the data, then writes the offline file list (docs/sw.js) and the version (docs/js/version.js).
// The version is a hash of every file, so it changes exactly when something changed. Usage: node tools/build.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const docs = path.join(__dirname, "..", "docs");
const read = file => fs.readFileSync(path.join(docs, file));
const json = file => JSON.parse(read(file));
const errors = [];
const str = x => typeof x === "string" && x.trim() !== "";
const pairs = (list, where) => {
  if (!Array.isArray(list) || !list.length) { errors.push(`${where}: empty`); return; }
  list.forEach((p, k) => { if (!Array.isArray(p) || p.length !== 2 || !p.every(str)) errors.push(`${where}: bad pair ${k}`); });
};

// vocabulary: [word, IPA, part of speech, 中文, definition, example, example 中文, synonyms, word family, tag]
const vocab = json("data/vocab.json");
const heads = new Map();
vocab.volumes.forEach((V, k) => {
  if (V.v !== k + 1) errors.push(`volume ${k + 1} is numbered ${V.v}`);
  if (!str(V.name) || !str(V.level) || !Array.isArray(V.tags) || !V.tags.length) errors.push(`volume ${V.v}: name, level or tags missing`);
  for (const w of V.words) {
    const ok = Array.isArray(w) && w.length === 10 && w.every((x, i) => typeof x === "string" && (i === 8 || x.trim() !== ""));
    if (!ok) { errors.push(`${V.name}: malformed entry ${JSON.stringify(w).slice(0, 80)}`); continue; }
    if (!/^\/.+\/$/.test(w[1])) errors.push(`${w[0]}: IPA should be written /like this/`);
    if (!V.tags.includes(w[9])) errors.push(`${V.name} ${w[0]}: tag ${w[9]} is not in the volume's tag list`);
    if (heads.has(w[0])) errors.push(`${w[0]} is in both ${heads.get(w[0])} and ${V.name}`);
    heads.set(w[0], V.name);
  }
});

// paraphrase groups: words that can stand for each other in a question and a passage
const groups = json("data/paraphrase.json").groups;
const groupKeys = new Set();
for (const g of groups) {
  if (!str(g.cat) || !str(g.zh) || !Array.isArray(g.words) || g.words.length < 2 || !g.words.every(str)) errors.push(`paraphrase ${g.zh}: needs a category, 中文 and at least two words`);
  else if (new Set(g.words).size !== g.words.length) errors.push(`paraphrase ${g.zh}: a word appears twice`);
  const key = `${g.zh}|${(g.words || [])[0]}`;
  if (groupKeys.has(key)) errors.push(`paraphrase ${key} appears twice`);
  groupKeys.add(key);
}

// writing: Task 2 questions with a model essay, a note for each paragraph and phrases
const TYPES = ["观点", "讨论", "利弊", "问题解决", "双问题"];
const tasks = json("data/writing.json").tasks;
const taskIds = new Set();
for (const t of tasks) {
  if (!/^[a-z0-9-]+$/.test(t.id || "") || taskIds.has(t.id)) errors.push(`writing: missing, odd or repeated id ${t.id}`);
  taskIds.add(t.id);
  if (!TYPES.includes(t.type)) errors.push(`writing ${t.id}: unknown type ${t.type}`);
  if (!str(t.zh) || !str(t.prompt)) errors.push(`writing ${t.id}: 中文 title or prompt missing`);
  if (!Array.isArray(t.paras) || t.paras.length < 4 || !t.paras.every(str)) errors.push(`writing ${t.id}: needs at least four paragraphs`);
  else {
    const words = t.paras.join(" ").split(/\s+/).length;
    if (words < 250) errors.push(`writing ${t.id}: only ${words} words`);
    if (!Array.isArray(t.notes) || t.notes.length !== t.paras.length || !t.notes.every(str)) errors.push(`writing ${t.id}: one note per paragraph`);
  }
  pairs(t.phrases, `writing ${t.id} phrases`);
}

// speaking: Part 1 topics with [question, answer], Part 2 cards with points, a model answer, phrases and Part 3 questions
const speaking = json("data/speaking.json");
const spIds = new Set();
const spId = id => {
  if (!/^[a-z0-9-]+$/.test(id || "") || spIds.has(id)) errors.push(`speaking: missing, odd or repeated id ${id}`);
  spIds.add(id);
};
for (const t of speaking.part1) {
  spId(t.id);
  if (!str(t.topic) || !str(t.zh)) errors.push(`speaking ${t.id}: topic or 中文 missing`);
  pairs(t.qs, `speaking ${t.id} questions`);
}
for (const c of speaking.part2) {
  spId(c.id);
  if (!str(c.card) || !str(c.zh)) errors.push(`speaking ${c.id}: card or 中文 missing`);
  if (!Array.isArray(c.points) || c.points.length !== 4 || !c.points.every(str)) errors.push(`speaking ${c.id}: needs four points`);
  if (!Array.isArray(c.answer) || !c.answer.every(str) || c.answer.join(" ").split(/\s+/).length < 200) errors.push(`speaking ${c.id}: model answer missing or too short`);
  if (!Array.isArray(c.p3) || c.p3.length < 2 || !c.p3.every(str)) errors.push(`speaking ${c.id}: needs Part 3 questions`);
  pairs(c.phrases, `speaking ${c.id} phrases`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// every file under docs goes into the offline copy, except the service worker itself
const skip = new Set(["sw.js", "js/version.js", ".nojekyll"]);
const files = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(path.join(docs, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) walk(rel);
    else if (!skip.has(rel)) files.push(rel);
  }
})("");
files.sort();

const hash = crypto.createHash("sha256");
for (const f of files) hash.update(f + "\0").update(read(f));
const version = hash.digest("hex").slice(0, 10);

fs.writeFileSync(path.join(docs, "js", "version.js"),
  `// Written by tools/build.js; changes whenever any file of the app changes.\nexport const VERSION = "${version}";\n`);
const assets = ["./", ...files, "js/version.js"];
const sw = fs.readFileSync(path.join(__dirname, "sw-template.js"), "utf8")
  .replace("__VERSION__", version)
  .replace("__ASSETS__", JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(docs, "sw.js"), sw);

const kb = files.reduce((n, f) => n + fs.statSync(path.join(docs, f)).size, 0) / 1024;
console.log(`${vocab.volumes.length} volumes, ${heads.size} words, ${groups.length} paraphrase groups, ${tasks.length} essays, ` +
  `${speaking.part1.length} Part 1 topics, ${speaking.part2.length} Part 2 cards`);
console.log(`version ${version}: ${assets.length} files cached for offline use, ${kb.toFixed(0)} KB`);
