// UI aplikácie: stav v localStorage, vykreslenie záložiek a týždňového mriežkového pohľadu.
const P = Planner;
const STORE = "studybalance-v1";
const DAYS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const DAYS_LONG = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];
const COLORS = ["#ffe45c", "#8ef0b4", "#ff9ec8", "#8fd3ff", "#ffb870", "#c9a8ff"];

const DEFAULT_SETTINGS = {
  dayStart: "08:00", dayEnd: "22:00", maxPerDay: 6, minBlock: 60, maxBlock: 120, breakMin: 15,
  geminiKey: "", geminiModel: "gemini-3.5-flash-lite",
};

// ---------- stav ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s) return { ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
  } catch (e) { /* poškodené alebo nedostupné úložisko → začni odznova */ }
  return { schedule: [], tasks: [], plan: { status: "none", blocks: [], warnings: [], priorities: [] }, log: [], settings: { ...DEFAULT_SETTINGS } };
}
let state = load();
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* napr. súkromné okno */ }
};
const logEvent = (type, blockId) => state.log.push({ type, blockId, at: new Date().toISOString() });
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- pomocné ----------
const $ = (sel) => document.querySelector(sel);
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") for (const [p, val] of Object.entries(v)) p.startsWith("--") ? el.style.setProperty(p, val) : (el.style[p] = val);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}
const taskById = (id) => state.tasks.find((t) => t.id === id);
const taskColor = (id) => COLORS[Math.max(0, state.tasks.findIndex((t) => t.id === id)) % COLORS.length];
const fmtHours = (min) => (min / 60).toLocaleString("sk-SK", { maximumFractionDigits: 1 }) + " h";
const fmtDate = (s) => P.parseDate(s).toLocaleDateString("sk-SK", { weekday: "short", day: "numeric", month: "numeric" });
const mondayOf = (s) => P.addDays(s, -P.weekday(s));

// ---------- záložky ----------
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + name));
  document.querySelectorAll(".steps button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"));
  try { localStorage.setItem(STORE + "-tab", name); } catch (e) { /* nevadí */ }
  render();
}
document.querySelectorAll(".steps button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------- týždňová mriežka ----------
// items: { day, start, end, title, sub, kind: "fixed"|"study", color, done, onclick }
function renderWeek(container, { dates, items }) {
  const s = state.settings;
  let from = P.toMin(s.dayStart), to = P.toMin(s.dayEnd);
  for (const it of items) { from = Math.min(from, it.start); to = Math.max(to, it.end); }
  from = Math.floor(from / 60) * 60;
  to = Math.ceil(to / 60) * 60;
  const PX = 0.9; // px na minútu
  const height = (to - from) * PX;
  const today = P.dateStr(new Date());

  const head = h("div", { class: "week-head" }, h("div"),
    DAYS.map((d, i) => h("div", { class: "day-name" + (dates && dates[i] === today ? " is-today" : "") },
      d, dates ? h("span", {}, " " + P.parseDate(dates[i]).getDate() + ". " + (P.parseDate(dates[i]).getMonth() + 1) + ".") : null)));

  const times = h("div", { class: "times", style: { height: height + "px" } });
  for (let m = from; m < to; m += 60) times.append(h("span", { style: { top: (m - from) * PX + "px" } }, P.toHHMM(m)));

  const cols = DAYS.map((_, i) => {
    const col = h("div", { class: "day-col", style: { height: height + "px", "--hour": 60 * PX + "px" } });
    for (const it of items.filter((x) => x.day === i)) {
      const el = h(it.onclick ? "button" : "div", {
        class: "item " + it.kind + (it.done ? " done" : ""),
        style: { top: (it.start - from) * PX + "px", height: Math.max(18, (it.end - it.start) * PX - 2) + "px", "--c": it.color || "" },
        title: it.title + " · " + P.toHHMM(it.start) + "–" + P.toHHMM(it.end),
        onclick: it.onclick,
      }, h("strong", {}, it.title), h("small", {}, P.toHHMM(it.start) + "–" + P.toHHMM(it.end) + (it.sub ? " · " + it.sub : "")));
      col.append(el);
    }
    return col;
  });

  container.replaceChildren(h("div", { class: "week" }, head, h("div", { class: "week-body" }, times, cols)));
}

// ---------- 1. rozvrh ----------
let editingScheduleId = null;
const sForm = $("#schedule-form");

function resetScheduleForm() {
  editingScheduleId = null;
  sForm.label.value = "";
  sForm.querySelector("[type=submit]").textContent = "Pridať do rozvrhu";
  $("#schedule-delete").hidden = $("#schedule-cancel").hidden = true;
  $("#schedule-error").textContent = "";
}

sForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const item = { day: Number(sForm.day.value), start: sForm.start.value, end: sForm.end.value, label: sForm.label.value.trim() };
  if (P.toMin(item.end) <= P.toMin(item.start)) {
    $("#schedule-error").textContent = "Čas „Do“ musí byť neskôr ako „Od“.";
    return;
  }
  if (editingScheduleId) Object.assign(state.schedule.find((x) => x.id === editingScheduleId), item);
  else state.schedule.push({ id: uid("s"), ...item });
  save();
  resetScheduleForm();
  render();
});
$("#schedule-cancel").addEventListener("click", resetScheduleForm);
$("#schedule-delete").addEventListener("click", () => {
  state.schedule = state.schedule.filter((x) => x.id !== editingScheduleId);
  save();
  resetScheduleForm();
  render();
});

function editSchedule(item) {
  editingScheduleId = item.id;
  sForm.day.value = item.day;
  sForm.start.value = item.start;
  sForm.end.value = item.end;
  sForm.label.value = item.label;
  sForm.querySelector("[type=submit]").textContent = "Uložiť zmeny";
  $("#schedule-delete").hidden = $("#schedule-cancel").hidden = false;
  sForm.label.focus();
}

function renderSchedule() {
  renderWeek($("#schedule-week"), {
    dates: null,
    items: state.schedule.map((s) => ({
      day: s.day, start: P.toMin(s.start), end: P.toMin(s.end), title: s.label, kind: "fixed", onclick: () => editSchedule(s),
    })),
  });
}

// ---------- 2. povinnosti ----------
let editingTaskId = null;
const tForm = $("#task-form");

function resetTaskForm() {
  editingTaskId = null;
  tForm.title.value = "";
  tForm.querySelector("[type=submit]").textContent = "Pridať povinnosť";
  $("#task-cancel").hidden = true;
  $("#task-error").textContent = "";
}

tForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const task = { title: tForm.title.value.trim(), type: tForm.type.value, deadline: tForm.deadline.value, hours: Number(tForm.hours.value) };
  if (task.deadline <= P.dateStr(new Date())) {
    $("#task-error").textContent = "Termín musí byť najskôr zajtra – učenie plánujeme do dňa pred termínom.";
    return;
  }
  if (editingTaskId) Object.assign(taskById(editingTaskId), task);
  else state.tasks.push({ id: uid("t"), ...task });
  save();
  resetTaskForm();
  render();
});
$("#task-cancel").addEventListener("click", resetTaskForm);

function renderTasks() {
  const list = $("#task-list");
  if (state.tasks.length === 0) {
    list.replaceChildren(h("li", { class: "empty" }, "Zatiaľ žiadne povinnosti. Pridaj prvú úlohu alebo skúšku vyššie."));
    return;
  }
  const sorted = state.tasks.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));
  list.replaceChildren(...sorted.map((t) => h("li", {},
    h("span", { class: "swatch", style: { background: taskColor(t.id) } }),
    h("div", { class: "task-main" },
      h("strong", {}, t.title),
      h("small", {}, (t.type === "exam" ? "Skúška" : "Úloha") + " · termín " + fmtDate(t.deadline) + " · " + t.hours + " h")),
    h("button", { onclick: () => {
      editingTaskId = t.id;
      tForm.title.value = t.title; tForm.type.value = t.type; tForm.deadline.value = t.deadline; tForm.hours.value = t.hours;
      tForm.querySelector("[type=submit]").textContent = "Uložiť zmeny";
      $("#task-cancel").hidden = false;
      tForm.title.focus();
    } }, "Upraviť"),
    h("button", { class: "danger", onclick: () => {
      if (!confirm("Zmazať „" + t.title + "“ aj s jej blokmi v pláne?")) return;
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      state.plan.blocks = state.plan.blocks.filter((b) => b.taskId !== t.id);
      save();
      render();
    } }, "Zmazať"))));
}

// ---------- 3. plán ----------
let weekStart = mondayOf(P.dateStr(new Date()));

$("#generate").addEventListener("click", () => {
  if (state.tasks.length === 0) { alert("Najprv pridaj aspoň jednu úlohu alebo skúšku."); showTab("tasks"); return; }
  const now = new Date();
  const isPast = (b) => P.dateStr(now) > b.date || (P.dateStr(now) === b.date && b.end <= now.getHours() * 60 + now.getMinutes());
  const replaced = state.plan.blocks.filter((b) => !b.done && !isPast(b));
  if (state.plan.status === "confirmed" && replaced.length > 0 &&
      !confirm("Nový návrh nahradí " + replaced.length + " nesplnených blokov. Splnené bloky ostanú. Pokračovať?")) return;

  const done = state.plan.blocks.filter((b) => b.done && taskById(b.taskId));
  const pastUndone = state.plan.blocks.filter((b) => !b.done && isPast(b) && taskById(b.taskId));
  const r = P.generatePlan({ schedule: state.schedule, tasks: state.tasks, blocks: done, settings: state.settings, now });
  state.plan = { status: "draft", blocks: [...done, ...pastUndone, ...r.blocks], warnings: r.warnings, priorities: r.priorities };
  save();
  weekStart = mondayOf(P.dateStr(now));
  render();
});

$("#confirm").addEventListener("click", () => {
  state.plan.status = "confirmed";
  state.plan.blocks.forEach((b) => { if (!b.confirmed) { b.confirmed = true; logEvent("block_confirmed", b.id); } });
  save();
  render();
});

$("#week-prev").addEventListener("click", () => { weekStart = P.addDays(weekStart, -7); renderPlan(); });
$("#week-next").addEventListener("click", () => { weekStart = P.addDays(weekStart, 7); renderPlan(); });
$("#week-today").addEventListener("click", () => { weekStart = mondayOf(P.dateStr(new Date())); renderPlan(); });

function renderPlan() {
  const plan = state.plan;
  const status = {
    none: "Plán zatiaľ nemáš. Keď máš vyplnený rozvrh a povinnosti, nechaj si ho navrhnúť.",
    draft: "Toto je návrh. Klikni na blok, ak ho chceš presunúť, skrátiť alebo zmazať. Keď ti plán vyhovuje, potvrď ho.",
    confirmed: "Plán je potvrdený. Po učení klikni na blok a označ ho ako splnený.",
  }[plan.status];
  $("#plan-status").textContent = status;
  $("#generate").textContent = plan.status === "none" ? "Navrhnúť plán" : "Navrhnúť znova";
  $("#confirm").hidden = plan.status !== "draft";

  // upozornenia na nedostatok času
  $("#warnings").replaceChildren(...plan.warnings.filter((w) => taskById(w.taskId)).map((w) => {
    const t = taskById(w.taskId);
    return h("div", { class: "warning", role: "alert" },
      h("strong", {}, "„" + t.title + "“: chýba " + fmtHours(w.missingMin) + "."),
      " Do termínu nie je v rozvrhu dosť voľného času. Uvoľni čas v rozvrhu, zvýš denný limit v nastaveniach alebo uprav odhad.");
  }));

  // priority – prečo je plán taký, aký je
  const pr = plan.priorities.filter((p) => taskById(p.taskId));
  $("#priorities").replaceChildren(...(pr.length ? [
    h("h2", {}, "Poradie podľa termínov"),
    h("ol", { class: "priorities" }, pr.map((p) => {
      const t = taskById(p.taskId);
      const planned = plan.blocks.filter((b) => b.taskId === t.id).reduce((s, b) => s + b.end - b.start, 0);
      return h("li", {},
        h("span", { class: "swatch", style: { background: taskColor(t.id) } }),
        h("div", {}, h("strong", {}, t.title),
          h("small", {}, (t.type === "exam" ? "Skúška o " + p.daysLeft + " d – príprava rozložená do dní pred skúškou"
            : "Termín o " + p.daysLeft + " d – plánované čo najskôr") + " · naplánované " + fmtHours(planned) + " z " + t.hours + " h")));
    })),
  ] : []));

  // miera splnenia (Fáza B)
  const c = P.completion(plan.blocks.filter((b) => b.confirmed), new Date());
  const progress = [h("h2", {}, "Miera splnenia")];
  if (!c) progress.push(h("p", { class: "hint" }, "Zobrazí sa, keď uplynie čas prvého potvrdeného bloku."));
  else {
    progress.push(h("p", { class: "rate" }, h("span", { class: "rate-num" }, c.rate + " %"), " " + c.done + " z " + c.past + " uplynulých blokov splnených"));
    if (c.past >= 3 && c.rate < 50) progress.push(h("p", { class: "tip" }, "Viacero blokov ostalo nesplnených. Skús rozdeliť veľké úlohy na menšie časti alebo zvýšiť odhad času a navrhnúť plán znova."));
  }
  $("#progress").replaceChildren(...progress);

  // týždeň
  const dates = DAYS.map((_, i) => P.addDays(weekStart, i));
  $("#week-label").textContent = fmtDate(dates[0]) + " – " + fmtDate(dates[6]);
  const items = [];
  dates.forEach((d, i) => {
    for (const s of state.schedule) if (s.day === i) items.push({ day: i, start: P.toMin(s.start), end: P.toMin(s.end), title: s.label, kind: "fixed" });
    for (const b of plan.blocks) if (b.date === d) {
      const t = taskById(b.taskId);
      if (!t) continue;
      items.push({ day: i, start: b.start, end: b.end, title: t.title, sub: b.done ? "splnené" : t.type === "exam" ? "skúška" : "úloha",
        kind: "study", color: taskColor(t.id), done: b.done, onclick: () => openBlock(b) });
    }
  });
  renderWeek($("#plan-week"), { dates, items });

  const s = state.settings;
  $("#ai-explain").disabled = plan.status === "none";
  $("#ai-hint").textContent = s.geminiKey
    ? "AI nemení časy v pláne, iba ho vysvetlí a dá tipy."
    : "Na vysvetlenie od AI vlož Gemini API kľúč v Nastaveniach. Plán funguje aj bez neho.";
}

// úprava bloku
const dlg = $("#block-dialog");
const bForm = $("#block-form");
let editingBlock = null;

function openBlock(b) {
  editingBlock = b;
  $("#block-title").textContent = taskById(b.taskId).title;
  bForm.date.value = b.date;
  bForm.start.value = P.toHHMM(b.start);
  bForm.end.value = P.toHHMM(b.end);
  bForm.done.checked = !!b.done;
  $("#block-done-wrap").hidden = state.plan.status !== "confirmed";
  $("#block-error").textContent = "";
  dlg.showModal();
}

bForm.addEventListener("submit", (e) => {
  const action = e.submitter && e.submitter.value;
  const b = editingBlock;
  if (action === "delete") {
    state.plan.blocks = state.plan.blocks.filter((x) => x !== b);
    if (b.confirmed) logEvent("block_deleted", b.id);
  } else if (action === "save") {
    const start = P.toMin(bForm.start.value), end = P.toMin(bForm.end.value);
    if (end <= start) { e.preventDefault(); $("#block-error").textContent = "Koniec musí byť po začiatku."; return; }
    const moved = b.date !== bForm.date.value || b.start !== start || b.end !== end;
    if (moved && b.confirmed) logEvent("block_moved", b.id);
    if (b.done !== bForm.done.checked) logEvent(bForm.done.checked ? "block_done" : "block_undone", b.id);
    Object.assign(b, { date: bForm.date.value, start, end, done: bForm.done.checked });
  } else return;
  save();
  render();
});

// AI
$("#ai-explain").addEventListener("click", async () => {
  const s = state.settings;
  const out = $("#ai-output");
  if (!s.geminiKey) { showTab("settings"); return; }
  const btn = $("#ai-explain");
  btn.disabled = true;
  out.textContent = "Pýtam sa AI…";
  const plan = state.plan;
  const payload = {
    dnes: P.dateStr(new Date()),
    povinnosti: state.tasks.map((t) => ({
      nazov: t.title, typ: t.type === "exam" ? "skúška" : "úloha", termin: t.deadline, odhad_h: t.hours,
      bloky: plan.blocks.filter((b) => b.taskId === t.id).map((b) => b.date + " " + P.toHHMM(b.start) + "-" + P.toHHMM(b.end) + (b.done ? " (splnené)" : "")),
    })),
    chyba_cas: plan.warnings.map((w) => ({ nazov: (taskById(w.taskId) || {}).title, chyba_h: w.missingMin / 60 })),
    miera_splnenia: P.completion(plan.blocks.filter((b) => b.confirmed), new Date()),
  };
  try {
    out.textContent = await explainPlan({ key: s.geminiKey, model: s.geminiModel, payload });
  } catch (err) {
    out.textContent = "AI sa nepodarilo zavolať: " + err.message + " Skontroluj kľúč a názov modelu v Nastaveniach.";
  } finally {
    btn.disabled = false;
  }
});

// ---------- nastavenia ----------
const setForm = $("#settings-form");
function fillSettings() {
  for (const [k, v] of Object.entries(state.settings)) if (setForm[k]) setForm[k].value = v;
}
setForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const n = (k) => Number(setForm[k].value);
  const next = {
    dayStart: setForm.dayStart.value, dayEnd: setForm.dayEnd.value, maxPerDay: n("maxPerDay"),
    minBlock: n("minBlock"), maxBlock: n("maxBlock"), breakMin: n("breakMin"),
    geminiKey: setForm.geminiKey.value.trim(), geminiModel: setForm.geminiModel.value.trim(),
  };
  const err = P.toMin(next.dayEnd) <= P.toMin(next.dayStart) ? "„Najneskôr do“ musí byť neskôr ako „Najskôr od“."
    : next.minBlock > next.maxBlock ? "Najkratší blok nemôže byť dlhší ako najdlhší." : "";
  $("#settings-error").textContent = err;
  if (err) return;
  state.settings = next;
  save();
  $("#settings-saved").textContent = "Uložené";
  setTimeout(() => ($("#settings-saved").textContent = ""), 2000);
});
$("#reset").addEventListener("click", () => {
  if (!confirm("Naozaj vymazať rozvrh, povinnosti, plán aj nastavenia v tomto prehliadači? Nedá sa to vrátiť.")) return;
  try { localStorage.removeItem(STORE); } catch (e) { /* nevadí */ }
  state = load();
  fillSettings();
  showTab("schedule");
});

// ---------- štart ----------
function render() {
  renderSchedule();
  renderTasks();
  renderPlan();
}
tForm.deadline.min = P.addDays(P.dateStr(new Date()), 1);
fillSettings();
let startTab = state.schedule.length ? (state.tasks.length ? "plan" : "tasks") : "schedule";
try { startTab = localStorage.getItem(STORE + "-tab") || startTab; } catch (e) { /* nevadí */ }
showTab(startTab);
