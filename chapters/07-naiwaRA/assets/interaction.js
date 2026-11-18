/* 《奶蛙：午夜奶厂》交互框架 v1
 * 与渲染无关：状态 / 背包 / 交互管理 / 对话 UI / 结局演出 / 跳舞小游戏。
 * 实验台与三幕场景共用。依赖：无（纯 DOM）。
 */
window.MF = (function () {
"use strict";

/* ===== 常量 ===== */
const FLAVORS = ["strawberry", "chocolate", "mint", "vanilla", "plain"];
const FLAVOR_CN = { strawberry: "草莓", chocolate: "巧克力", mint: "薄荷", vanilla: "香草", plain: "原味" };
const FLAVOR_COLOR = { strawberry: 0xd9605a, chocolate: 0x5a4030, mint: 0x86c24b, vanilla: 0xe6e2cf, plain: 0xf0e8b0 };

const ENDINGS = {
  escape: { name: "溜了溜了", tag: "普通结局", color: "#1a2430",
    text: "门外是空的公路。你走了很久，路边所有广告牌上都是你的脸。\n——工厂还在生产。" },
  wean: { name: "断奶", tag: "真结局", color: "#2a3020",
    text: "主泵停了。十二只奶蛙排成一队走向公路，没有回头。\n汽水有点甜，但没有奶味。\n——今天也没有被做成奶昔。" },
  shake: { name: "草莓奶昔 S 级", tag: "搞笑结局", color: "#e06b9e",
    text: "口感 S · 甜度 A · 奶蛙含量 100%\n恭喜解锁隐藏商品：奶蛙味奶昔 — 现已上市 — 限量供应。\n——你被消费得很彻底。" },
  manager: { name: "新厂长", tag: "坏结局", color: "#3a1020",
    text: "母液涌进身体。十二只穿黑西装的奶蛙齐声说：欢迎新厂长。\n你想说话，发出的却是一声——哞。\n——它从来没打算放你走。" },
  god: { name: "蛙神降临", tag: "隐藏结局", color: "#4a2a5a",
    text: "巨蛙踩扁了工厂，像踩扁一个纸盒：咔。\n「我的孩子。你跳得不错。」\n——乳糖不耐受是神的旨意。" },
  speed: { name: "三分钟下班", tag: "速通结局", color: "#101820",
    text: "效率员工。\n通关时间：3 分以内 · 真相收集：0/3 · 奶蛙存活：是\n——你甚至没弄脏雨衣。" },
  egg: { name: "售货机的新货", tag: "彩蛋", color: "#2a2416",
    text: "成分：奶蛙 100% · 保质期：永远\n饮用前请确认自己不是奶蛙。\n瓶里传来一声很轻的：哞……\n——你想喝吗？" },
};
const MAIN_ENDINGS = ["escape", "wean", "shake", "manager", "god", "speed"];
const LS_KEY = "mf_endings_v1";

/* ===== 状态 ===== */
function newState() {
  const bottles = {}; FLAVORS.forEach(f => bottles[f] = false);
  return {
    inv: { coin: 0, key: false, floorKey: false, flashlight: false,
      tapes: [false, false, false], bottles },
    flags: { pigeonSaved: false, valveSolved: false, truthHeard: 0,
      tapesInserted: 0, slots: [false, false, false, false, false],
      altarOpen: false, metVend: false },
    milk: 78, lactose: 100, happy: 0, flashOn: false, dead: false,
    startAt: performance.now(),
  };
}
let state = newState();
function resetState() { state = newState(); refreshPanel(); }
function elapsed() { return (performance.now() - state.startAt) / 1000; }
function clockStr() {
  const m = 13 + Math.floor(elapsed() / 60), s = Math.floor(elapsed() % 60);
  return "02:" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
function tapeCount() { return state.inv.tapes.filter(Boolean).length; }
function bottleCount() { return FLAVORS.filter(f => state.inv.bottles[f]).length; }
function slotCount() { return state.flags.slots.filter(Boolean).length; }

/* ===== 结局记录 ===== */
function getUnlocked() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
}
function allMainUnlocked() { const u = getUnlocked(); return MAIN_ENDINGS.every(k => u[k]); }
function clearUnlocked() { localStorage.removeItem(LS_KEY); refreshPanel(); }

/* ===== UI（自动注入样式与节点） ===== */
const CSS = `
.mf-ui{font-family:Consolas,"SF Mono",Menlo,monospace;}
#mf-hint{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:40;pointer-events:none;
  color:#eaffd0;background:rgba(10,14,8,.85);border:1px solid #86c24b;padding:9px 18px;font-size:13px;
  letter-spacing:.06em;opacity:0;transition:opacity .15s;white-space:nowrap;}
#mf-hint.on{opacity:1;}
#mf-hint b{color:#86c24b;}
#mf-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:41;pointer-events:none;
  color:#f0eddc;background:rgba(8,10,8,.8);border:1px solid #5a5a48;padding:8px 16px;font-size:12px;
  opacity:0;transition:opacity .3s;text-align:center;max-width:70vw;}
#mf-toast.on{opacity:1;}
#mf-dialog{position:fixed;left:50%;bottom:6%;transform:translateX(-50%);z-index:42;width:min(620px,92vw);
  background:rgba(10,12,10,.94);border:2px solid #86c24b;padding:14px 18px;display:none;cursor:pointer;}
#mf-dialog.on{display:block;}
#mf-dialog .who{color:#86c24b;font-size:11px;letter-spacing:.24em;margin-bottom:7px;}
#mf-dialog .line{color:#f0eddc;font-size:14px;line-height:1.8;min-height:2.4em;}
#mf-dialog .next{color:#6f8f4f;font-size:10px;text-align:right;margin-top:6px;letter-spacing:.1em;}
#mf-confirm{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:43;width:min(420px,90vw);
  background:rgba(14,10,12,.96);border:2px solid #d9605a;padding:18px 20px;display:none;text-align:center;}
#mf-confirm.on{display:block;}
#mf-confirm .q{color:#f0eddc;font-size:14px;line-height:1.8;margin-bottom:14px;white-space:pre-line;}
#mf-confirm button{font-family:inherit;cursor:pointer;font-size:12px;padding:8px 22px;margin:0 6px;
  border:1px solid #6a6a55;background:#1a1c17;color:#e6e2cf;}
#mf-confirm button.yes{border-color:#d9605a;color:#ffb0a8;}
#mf-confirm button:hover{background:#2a2e20;}
#mf-ending{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;
  flex-direction:column;text-align:center;padding:30px;transition:background 1s;}
#mf-ending.on{display:flex;}
#mf-ending .tag{font-size:12px;letter-spacing:.4em;color:rgba(255,255,255,.65);margin-bottom:14px;}
#mf-ending .name{font-size:40px;font-weight:700;color:#fff;letter-spacing:.12em;text-shadow:0 2px 12px rgba(0,0,0,.5);}
#mf-ending .txt{font-size:14px;line-height:2.1;color:rgba(255,255,255,.88);margin:26px 0 34px;white-space:pre-line;max-width:560px;}
#mf-ending button{font-family:inherit;cursor:pointer;font-size:12px;padding:10px 26px;letter-spacing:.1em;
  background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.5);}
#mf-dance{position:fixed;inset:0;z-index:55;display:none;align-items:center;justify-content:center;
  flex-direction:column;background:rgba(20,8,26,.88);}
#mf-dance.on{display:flex;}
#mf-dance .t{color:#e06b9e;font-size:13px;letter-spacing:.3em;margin-bottom:20px;}
#mf-dance .arrow{font-size:96px;color:#fff;text-shadow:0 0 30px #e06b9e;line-height:1;}
#mf-dance .seq{margin-top:22px;font-size:20px;color:#8a7a9a;letter-spacing:.3em;}
#mf-dance .seq b{color:#e8d06a;}
#mf-dance .bar{width:220px;height:5px;background:#3a2a4a;margin-top:24px;}
#mf-dance .bar i{display:block;height:100%;background:#e06b9e;width:100%;}
#mf-dance .hint{margin-top:16px;color:#9a8aaa;font-size:11px;}
#mf-dance .dbtns{display:flex;gap:12px;margin-top:20px;}
#mf-dance .dbtns button{width:52px;height:52px;font-size:22px;font-family:inherit;cursor:pointer;
  background:rgba(60,30,70,.6);color:#e8d0f0;border:1px solid #8a5a9a;touch-action:none;}
#mf-dance .dbtns button:active{background:#e06b9e;color:#fff;}
`;
let els = {};
function initUI() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  const wrap = document.createElement("div"); wrap.className = "mf-ui";
  wrap.innerHTML = `
    <div id="mf-hint"></div><div id="mf-toast"></div>
    <div id="mf-dialog"><div class="who"></div><div class="line"></div><div class="next">E / 点击 继续 ▼</div></div>
    <div id="mf-confirm"><div class="q"></div><button class="yes">确定</button><button class="no">再想想</button></div>
    <div id="mf-ending"><div class="tag"></div><div class="name"></div><div class="txt"></div><button>返回</button></div>
    <div id="mf-dance"><div class="t">奶 蛙 舞 · 跟 上 节 拍</div><div class="arrow"></div><div class="seq"></div><div class="bar"><i></i></div><div class="hint">按对应方向键 · 错拍或超时即失败</div>
      <div class="dbtns"><button data-d="ArrowLeft">←</button><button data-d="ArrowUp">↑</button><button data-d="ArrowDown">↓</button><button data-d="ArrowRight">→</button></div></div>`;
  document.body.appendChild(wrap);
  ["hint", "toast", "dialog", "confirm", "ending", "dance"].forEach(k => els[k] = document.getElementById("mf-" + k));
  els.dialog.addEventListener("click", advanceDialog);
  els.confirm.querySelector(".yes").onclick = () => closeConfirm(true);
  els.confirm.querySelector(".no").onclick = () => closeConfirm(false);
  els.ending.querySelector("button").onclick = () => els.ending.classList.remove("on");
  els.dance.querySelectorAll(".dbtns button").forEach(b => {
    b.addEventListener("click", () => danceKey(b.dataset.d));
  });
}

/* ---- 提示 / toast ---- */
let toastTimer = null;
function toast(text, ms) {
  els.toast.textContent = text; els.toast.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove("on"), ms || 2600);
}
function hint(text) {
  if (text) { els.hint.innerHTML = text; els.hint.classList.add("on"); }
  else els.hint.classList.remove("on");
}

/* ---- 对话 ---- */
let dlgQueue = [], dlgCb = null;
function dialog(who, lines, cb) {
  dlgQueue = lines.slice(); dlgCb = cb || null;
  els.dialog.querySelector(".who").textContent = who;
  els.dialog.classList.add("on");
  advanceDialog();
}
function advanceDialog() {
  if (!dlgQueue.length) {
    els.dialog.classList.remove("on");
    const cb = dlgCb; dlgCb = null; if (cb) cb();
    return;
  }
  els.dialog.querySelector(".line").textContent = dlgQueue.shift();
}
function dialogOpen() { return els.dialog.classList.contains("on"); }

/* ---- 确认 ---- */
let confirmCb = null;
function confirm(q, cb) {
  els.confirm.querySelector(".q").textContent = q;
  els.confirm.classList.add("on"); confirmCb = cb;
}
function closeConfirm(v) {
  els.confirm.classList.remove("on");
  const cb = confirmCb; confirmCb = null; if (cb) cb(v);
}
function confirmOpen() { return els.confirm.classList.contains("on"); }

/* ---- 结局 ---- */
function ending(id) {
  const e = ENDINGS[id]; if (!e) return;
  const u = getUnlocked(); u[id] = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(u)); } catch (err) {}
  els.ending.style.background = e.color;
  els.ending.querySelector(".tag").textContent = "— " + e.tag + " —";
  els.ending.querySelector(".name").textContent = e.name;
  els.ending.querySelector(".txt").textContent = e.text;
  els.ending.classList.add("on");
  hint(null); refreshPanel();
}

/* ---- 跳舞小游戏（隐藏结局） ---- */
const ARROWS = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
let dance = null;
function startDance(cb) {
  const seq = Array.from({ length: 8 }, () => Object.keys(ARROWS)[Math.random() * 4 | 0]);
  dance = { seq, idx: 0, cb, deadline: 0, raf: 0 };
  els.dance.classList.add("on");
  nextBeat();
}
function nextBeat() {
  if (!dance) return;
  if (dance.idx >= dance.seq.length) { finishDance(true); return; }
  els.dance.querySelector(".arrow").textContent = ARROWS[dance.seq[dance.idx]];
  els.dance.querySelector(".seq").innerHTML = dance.seq.map((k, i) =>
    i === dance.idx ? "<b>" + ARROWS[k] + "</b>" : ARROWS[k]).join(" ");
  dance.deadline = performance.now() + 1400;
  const bar = els.dance.querySelector(".bar i");
  const tick = () => {
    if (!dance) return;
    const left = dance.deadline - performance.now();
    if (left <= 0) { finishDance(false); return; }
    bar.style.width = (left / 1400 * 100) + "%";
    dance.raf = requestAnimationFrame(tick);
  };
  tick();
}
function finishDance(ok) {
  if (!dance) return;
  cancelAnimationFrame(dance.raf);
  const cb = dance.cb; dance = null;
  els.dance.classList.remove("on");
  if (ok) cb && cb(); else toast("跳错了……奶蛙舞需要节奏感。再来一次。");
}
function danceKey(code) {
  if (!dance) return false;
  if (!ARROWS[code]) return true;
  if (code === dance.seq[dance.idx]) { dance.idx++; nextBeat(); }
  else finishDance(false);
  return true;
}
function dancing() { return !!dance; }

/* ===== 交互管理 ===== */
/* prop: { id, pos:{x,z}, radius, label():string|null, action() }  label 返回 null 表示当前不可交互 */
const props = [];
let active = null;
let locked = false;
function setLock(v) { locked = v; if (v) { active = null; hint(null); } }
function register(p) { p.radius = p.radius || 2.2; props.push(p); return p; }
function clearProps() { props.length = 0; active = null; }
function update(px, pz) {
  if (locked || dialogOpen() || confirmOpen() || dancing() || els.ending.classList.contains("on")) { active = null; hint(null); return; }
  let best = null, bestD = 1e9;
  for (const p of props) {
    if (p.enabled && !p.enabled()) continue;
    const d = Math.hypot(px - p.pos.x, pz - p.pos.z);
    if (d < p.radius && d < bestD) { const lb = p.label(); if (lb) { best = p; bestD = d; best._lb = lb; } }
  }
  active = best;
  hint(best ? "<b>[E]</b> " + best._lb : null);
}
function interact() {
  if (locked) return;
  if (dialogOpen()) { advanceDialog(); return; }
  if (confirmOpen() || dancing()) return;
  if (active) active.action();
}
function getActive() { return active; }

/* ===== 状态面板（实验台用，场景可隐藏） ===== */
let panelEl = null;
function bindPanel(el) { panelEl = el; refreshPanel(); }
function refreshPanel() {
  if (!panelEl) return;
  const s = state, u = getUnlocked();
  const invBits = [];
  if (s.inv.flashlight) invBits.push("奶瓶手电" + (s.flashOn ? "·开" : "·关"));
  if (s.inv.coin) invBits.push("硬币×" + s.inv.coin);
  if (s.inv.key) invBits.push("鸽子的钥匙");
  if (s.inv.floorKey) invBits.push("地上的钥匙");
  s.inv.tapes.forEach((t, i) => { if (t) invBits.push("磁带0" + (i + 1)); });
  FLAVORS.forEach(f => { if (s.inv.bottles[f]) invBits.push(FLAVOR_CN[f] + "奶瓶"); });
  const flagBits = [];
  if (s.flags.pigeonSaved) flagBits.push("鸽子已救");
  if (s.flags.valveSolved) flagBits.push("配方正确 3·2·1");
  flagBits.push("真相 " + s.flags.truthHeard + "/3");
  flagBits.push("磁带已插入 " + s.flags.tapesInserted + "/3");
  flagBits.push("凹槽 " + slotCount() + "/5");
  if (s.flags.altarOpen) flagBits.push("祭坛已开启");
  panelEl.innerHTML =
    `<div class="p-clock">${clockStr()}</div>` +
    `<div class="p-bar"><span>奶量</span><i style="width:${s.milk}%"></i><b>${Math.round(s.milk)}%</b></div>` +
    `<div class="p-bar lac"><span>乳糖</span><i style="width:${s.lactose}%"></i><b>${Math.round(s.lactose)}</b></div>` +
    `<div class="p-bar happy"><span>开心</span><i style="width:${Math.min(100, s.happy)}%"></i><b>${Math.round(s.happy)}</b></div>` +
    `<div class="p-sec">背包</div><div class="p-list">${invBits.length ? invBits.join(" · ") : "（空）"}</div>` +
    `<div class="p-sec">进度</div><div class="p-list">${flagBits.join(" · ")}</div>` +
    `<div class="p-sec">结局收集</div><div class="p-list">` +
    MAIN_ENDINGS.concat(["egg"]).map(k =>
      `<span style="color:${u[k] ? "#86c24b" : "#5a5f50"}">${u[k] ? "■" : "□"} ${ENDINGS[k].name}</span>`).join("<br>") +
    `</div>`;
}

/* ===== 全局按键 ===== */
window.addEventListener("keydown", e => {
  if (e.code === "KeyE") { e.preventDefault(); interact(); return; }
  if (dance && danceKey(e.code)) e.preventDefault();
});

return {
  FLAVORS, FLAVOR_CN, FLAVOR_COLOR, ENDINGS, MAIN_ENDINGS,
  get state() { return state; }, resetState, elapsed, clockStr,
  tapeCount, bottleCount, slotCount,
  getUnlocked, allMainUnlocked, clearUnlocked,
  initUI, toast, hint, dialog, dialogOpen, confirm, closeConfirm, confirmOpen, ending,
  startDance, dancing,
  register, clearProps, update, interact, getActive, setLock,
  bindPanel, refreshPanel,
};
})();