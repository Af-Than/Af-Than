// Generates assets/monkeytype-card.svg from Monkeytype's public profile API.
// Usage: node scripts/monkeytype-card.mjs
// Env: MT_USERNAME (default "Af-Than"), MT_FIXTURE (path to a saved JSON response, for offline testing)
import { readFile, writeFile, mkdir } from "node:fs/promises";

const USERNAME = process.env.MT_USERNAME || "Af-Than";
const OUT = "assets/monkeytype-card.svg";

// serika dark
const C = { bg: "#323437", main: "#e2b714", sub: "#646669", text: "#d1d0c5" };

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadProfile() {
  if (process.env.MT_FIXTURE) {
    return JSON.parse(await readFile(process.env.MT_FIXTURE, "utf8")).data;
  }
  const res = await fetch(`https://api.monkeytype.com/users/${encodeURIComponent(USERNAME)}/profile`, {
    headers: { "User-Agent": "profile-readme-card" },
  });
  if (!res.ok) throw new Error(`Monkeytype API returned ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error("Monkeytype API response had no data");
  return json.data;
}

// Best plain-English PB for a time mode; falls back to the best of any language.
function bestPb(profile, type, mode) {
  const list = profile.personalBests?.[type]?.[mode] ?? [];
  const plain = list.filter((p) => p.language === "english" && !p.punctuation && !p.numbers);
  const pool = plain.length ? plain : list;
  return pool.reduce((best, p) => (!best || p.wpm > best.wpm ? p : best), null);
}

const level = (xp) => Math.floor((1 / 98) * (-151 + Math.sqrt(23725 + 392 * xp)) + 1);

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function render(p) {
  const W = 495, H = 215, PAD = 24, COL = (W - PAD * 2) / 4;
  const colX = (i) => PAD + i * COL;
  const font = `font-family="'Roboto Mono','SF Mono',Consolas,'Liberation Mono',monospace"`;

  let body = "";
  [
    ["time", "15", "15s"],
    ["words", "10", "10 words"],
    ["words", "25", "25 words"],
    ["time", "30", "30s"],
  ].forEach(([type, mode, label], i) => {
    const pb = bestPb(p, type, mode);
    body += `
  <text x="${colX(i)}" y="72" ${font} font-size="12" fill="${C.sub}">${label}</text>
  <text x="${colX(i)}" y="104" ${font} font-size="30" font-weight="700" fill="${C.main}">${pb ? Math.round(pb.wpm) : "-"}</text>
  <text x="${colX(i)}" y="124" ${font} font-size="11" fill="${C.sub}">${pb ? `wpm · ${Math.round(pb.acc)}% acc` : "no pb yet"}</text>`;
  });

  const stats = [
    [p.typingStats?.completedTests ?? 0, "tests completed"],
    [fmtTime(p.typingStats?.timeTyping ?? 0), "time typing"],
    [level(p.xp ?? 0), "level"],
    [p.maxStreak ?? 0, "best streak (days)"],
  ];
  stats.forEach(([val, label], i) => {
    body += `
  <text x="${colX(i)}" y="172" ${font} font-size="16" fill="${C.text}">${esc(val)}</text>
  <text x="${colX(i)}" y="190" ${font} font-size="10.5" fill="${C.sub}">${esc(label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monkeytype stats for ${esc(p.name)}">
  <rect width="${W}" height="${H}" rx="10" fill="${C.bg}"/>
  <text x="${PAD}" y="38" ${font} font-size="16" font-weight="700" fill="${C.main}">monkeytype</text>
  <text x="${W - PAD}" y="38" ${font} font-size="14" text-anchor="end" fill="${C.sub}">${esc(p.name)}</text>
  <line x1="${PAD}" y1="50" x2="${W - PAD}" y2="50" stroke="${C.sub}" stroke-opacity="0.4"/>
  <line x1="${PAD}" y1="144" x2="${W - PAD}" y2="144" stroke="${C.sub}" stroke-opacity="0.4"/>${body}
</svg>
`;
}

const profile = await loadProfile();
await mkdir("assets", { recursive: true });
await writeFile(OUT, render(profile));
console.log(`Wrote ${OUT} for ${profile.name}`);