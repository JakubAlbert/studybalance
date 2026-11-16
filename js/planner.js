// Plánovač študijných blokov – čisté funkcie bez prístupu k stránke.
// Časy sú v minútach od polnoci, dátumy ako reťazce "YYYY-MM-DD" (miestny čas).

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

const dateStr = (d) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
};
// 0 = pondelok … 6 = nedeľa
const weekday = (s) => (parseDate(s).getDay() + 6) % 7;

// Voľné úseky v daný deň: študijné okno mínus rozvrh mínus bloky (blok + prestávka po ňom).
function freeGaps(date, schedule, blocks, settings, fromMin) {
  const busy = [];
  for (const s of schedule) if (s.day === weekday(date)) busy.push([toMin(s.start), toMin(s.end)]);
  for (const b of blocks) if (b.date === date) busy.push([b.start, b.end + settings.breakMin]);
  busy.sort((a, b) => a[0] - b[0]);

  const gaps = [];
  let cursor = Math.max(toMin(settings.dayStart), fromMin);
  const end = toMin(settings.dayEnd);
  for (const [s, e] of busy) {
    if (s > cursor) gaps.push([cursor, Math.min(s, end)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) gaps.push([cursor, end]);
  return gaps.filter(([s, e]) => e > s);
}

// Skúsi vložiť do dňa bloky pre úlohu. maxBlocks obmedzí počet blokov (pri skúškach 1 za kolo).
function fillDay(date, task, remaining, ctx, maxBlocks) {
  const { schedule, blocks, settings, today, nowMin } = ctx;
  let placed = 0;
  let count = 0;
  const used = blocks.filter((b) => b.date === date).reduce((s, b) => s + b.end - b.start, 0);
  let capLeft = settings.maxPerDay * 60 - used;

  while (remaining - placed > 0 && count < maxBlocks && capLeft > 0) {
    const need = remaining - placed;
    const minLen = Math.min(settings.minBlock, need);
    let want = Math.min(need, settings.maxBlock, capLeft);
    // Zvyšok kratší ako najkratší blok radšej pripoj k tomuto bloku, nech nevznikajú mini bloky.
    if (need - want > 0 && need - want < settings.minBlock && need <= capLeft) want = need;
    const gaps = freeGaps(date, schedule, blocks, settings, date === today ? nowMin : 0);
    // Najprv úsek, kam sa zmestí celý blok; inak prvý, kam sa zmestí aspoň najkratší blok.
    const gap = gaps.find(([s, e]) => e - s >= want) || gaps.find(([s, e]) => Math.min(e - s, capLeft) >= minLen);
    if (!gap) break;
    const len = Math.min(want, gap[1] - gap[0]);
    blocks.push({ id: newId(), taskId: task.id, date, start: gap[0], end: gap[0] + len, done: false });
    placed += len;
    capLeft -= len;
    count++;
  }
  return placed;
}

let idCounter = 0;
const newId = () => "b" + Date.now().toString(36) + (idCounter++).toString(36);

// Hlavná funkcia. `blocks` sú ponechané (napr. splnené) bloky – odrátajú sa a zaberajú čas.
function generatePlan({ schedule, tasks, blocks, settings, now }) {
  const today = dateStr(now);
  const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
  const all = blocks.slice();
  const ctx = { schedule, blocks: all, settings, today, nowMin };

  const order = tasks
    .slice()
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || (a.type === "task" ? -1 : 1) - (b.type === "task" ? -1 : 1));

  const warnings = [];
  const priorities = [];
  for (const task of order) {
    const doneMin = blocks.filter((b) => b.taskId === task.id).reduce((s, b) => s + b.end - b.start, 0);
    let remaining = Math.round(task.hours * 60) - doneMin;
    const lastDay = addDays(task.deadline, -1);
    const daysLeft = Math.round((parseDate(task.deadline) - parseDate(today)) / 86400000);
    priorities.push({ taskId: task.id, daysLeft });

    const days = [];
    for (let d = today; d <= lastDay; d = addDays(d, 1)) days.push(d);

    if (task.type === "exam") {
      // Od skúšky dozadu, jeden blok na deň v každom kole → viac učenia bližšie k termínu.
      let progress = true;
      while (remaining > 0 && progress) {
        progress = false;
        for (const d of days.slice().reverse()) {
          if (remaining <= 0) break;
          const p = fillDay(d, task, remaining, ctx, 1);
          remaining -= p;
          if (p > 0) progress = true;
        }
      }
    } else {
      // Úloha: čo najskôr.
      for (const d of days) {
        if (remaining <= 0) break;
        remaining -= fillDay(d, task, remaining, ctx, Infinity);
      }
    }
    if (remaining > 0) warnings.push({ taskId: task.id, missingMin: remaining });
  }

  return { blocks: all.slice(blocks.length), warnings, priorities };
}

// Miera splnenia = splnené / bloky, ktorých čas už uplynul. null, ak žiadny neuplynul.
function completion(blocks, now) {
  const today = dateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const past = blocks.filter((b) => b.date < today || (b.date === today && b.end <= nowMin));
  if (past.length === 0) return null;
  const done = past.filter((b) => b.done).length;
  return { done, past: past.length, rate: Math.round((done / past.length) * 100) };
}

const Planner = { toMin, toHHMM, dateStr, parseDate, addDays, weekday, freeGaps, generatePlan, completion };
if (typeof module !== "undefined") module.exports = Planner;
