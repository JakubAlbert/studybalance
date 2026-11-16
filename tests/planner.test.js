// Spustenie: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const P = require("../js/planner.js");

const settings = { dayStart: "08:00", dayEnd: "22:00", maxPerDay: 6, minBlock: 60, maxBlock: 120, breakMin: 15 };
// Pondelok 16. 11. 2026, 7:00 ráno
const now = new Date(2026, 10, 16, 7, 0);

const minutesFor = (blocks, taskId) =>
  blocks.filter((b) => b.taskId === taskId).reduce((s, b) => s + b.end - b.start, 0);

function overlaps(a, b) {
  return a.date === b.date && a.start < b.end && b.start < a.end;
}

function assertNoClash(blocks, schedule) {
  for (const b of blocks) {
    for (const s of schedule) {
      if (s.day === P.weekday(b.date)) {
        assert.ok(b.end <= P.toMin(s.start) || b.start >= P.toMin(s.end), `blok ${b.date} ${b.start} koliduje s rozvrhom`);
      }
    }
    for (const o of blocks) if (o !== b) assert.ok(!overlaps(o, b), "bloky sa prekrývajú");
  }
}

test("pomocné funkcie času a dátumu", () => {
  assert.strictEqual(P.toMin("09:40"), 580);
  assert.strictEqual(P.toHHMM(580), "09:40");
  assert.strictEqual(P.addDays("2026-11-30", 1), "2026-12-01");
  assert.strictEqual(P.weekday("2026-11-16"), 0); // pondelok
  assert.strictEqual(P.weekday("2026-11-22"), 6); // nedeľa
});

test("normálny prípad: úloha 6 h do piatku, voľný deň → hotová čo najskôr", () => {
  const tasks = [{ id: "t1", title: "Zadanie", type: "task", deadline: "2026-11-20", hours: 6 }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  assert.strictEqual(minutesFor(r.blocks, "t1"), 360);
  assert.ok(r.blocks.every((b) => b.date === "2026-11-16"), "celé v pondelok");
  assert.ok(r.blocks.every((b) => b.end - b.start <= 120 && b.end - b.start >= 60));
  assert.deepStrictEqual(r.warnings, []);
  assertNoClash(r.blocks, []);
});

test("normálny prípad s rozvrhom: bloky sa nedostanú do obsadených časov", () => {
  const schedule = [0, 1, 2, 3].map((day) => ({ id: "s" + day, day, start: "08:00", end: "18:00", label: "Škola + práca" }));
  const tasks = [{ id: "t1", title: "Zadanie", type: "task", deadline: "2026-11-20", hours: 6 }];
  const r = P.generatePlan({ schedule, tasks, blocks: [], settings, now });
  assert.strictEqual(minutesFor(r.blocks, "t1"), 360);
  assertNoClash(r.blocks, schedule);
  assert.ok(r.blocks.every((b) => b.date < "2026-11-20"), "pred termínom");
});

test("nejasný prípad: 6 h o tri týždne → žiadne mini bloky, čo najskôr", () => {
  const tasks = [{ id: "t1", title: "Projekt", type: "task", deadline: "2026-12-07", hours: 6 }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  assert.strictEqual(minutesFor(r.blocks, "t1"), 360);
  assert.ok(r.blocks.every((b) => b.end - b.start >= 60), "žiadne bloky kratšie ako 1 h");
  assert.ok(r.blocks.every((b) => b.date === "2026-11-16"), "začne hneď");
});

test("zlyhanie: treba 10 h, voľné sú 4 h → upozornenie, nič v obsadenom čase", () => {
  // 2 dni do termínu, každý deň voľné iba 2 h (20:00–22:00)
  const schedule = [0, 1].map((day) => ({ id: "s" + day, day, start: "08:00", end: "20:00", label: "Obsadené" }));
  const tasks = [{ id: "t1", title: "Veľké zadanie", type: "task", deadline: "2026-11-18", hours: 10 }];
  const r = P.generatePlan({ schedule, tasks, blocks: [], settings, now });
  assert.strictEqual(minutesFor(r.blocks, "t1"), 240);
  assert.strictEqual(r.warnings.length, 1);
  assert.strictEqual(r.warnings[0].taskId, "t1");
  assert.strictEqual(r.warnings[0].missingMin, 360);
  assertNoClash(r.blocks, schedule);
});

test("skúška: príprava rozložená do dní tesne pred skúškou", () => {
  const tasks = [{ id: "e1", title: "Matematika", type: "exam", deadline: "2026-11-27", hours: 6 }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  const dates = r.blocks.map((b) => b.date).sort();
  assert.deepStrictEqual(dates, ["2026-11-24", "2026-11-25", "2026-11-26"]);
});

test("nevznikajú mini bloky: krátky zvyšok sa pripojí, uprednostní sa celý blok", () => {
  // Pondelok 8:00–9:40 voľno (100 min), potom škola do 15:00
  const schedule = [{ id: "s", day: 0, start: "09:40", end: "15:00", label: "Škola" }];
  const tasks = [{ id: "t1", title: "Zadanie", type: "task", deadline: "2026-11-17", hours: 2.5 }];
  const r = P.generatePlan({ schedule, tasks, blocks: [], settings, now });
  assert.strictEqual(r.blocks.length, 1);
  assert.deepStrictEqual([r.blocks[0].start, r.blocks[0].end], [P.toMin("15:00"), P.toMin("17:30")]);
});

test("denný limit hodín sa dodrží", () => {
  const tasks = [{ id: "t1", title: "Veľa práce", type: "task", deadline: "2026-11-20", hours: 10 }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  const perDay = {};
  for (const b of r.blocks) perDay[b.date] = (perDay[b.date] || 0) + b.end - b.start;
  assert.ok(Object.values(perDay).every((m) => m <= 360));
  assert.strictEqual(minutesFor(r.blocks, "t1"), 600);
});

test("skorší termín dostane skoršie bloky", () => {
  const tasks = [
    { id: "late", title: "Neskôr", type: "task", deadline: "2026-11-25", hours: 2 },
    { id: "soon", title: "Skôr", type: "task", deadline: "2026-11-18", hours: 2 },
  ];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  assert.strictEqual(r.priorities[0].taskId, "soon");
  const first = r.blocks.find((b) => b.taskId === "soon");
  const second = r.blocks.find((b) => b.taskId === "late");
  assert.ok(first.start < second.start);
});

test("ponechané splnené bloky sa odrátajú a nič sa s nimi neprekrýva", () => {
  const tasks = [{ id: "t1", title: "Zadanie", type: "task", deadline: "2026-11-20", hours: 3 }];
  const kept = [{ id: "b0", taskId: "t1", date: "2026-11-16", start: 480, end: 600, done: true }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: kept, settings, now });
  assert.strictEqual(minutesFor(r.blocks, "t1"), 60);
  assertNoClash([...kept, ...r.blocks], []);
});

test("termín, ktorý už prešiel → upozornenie", () => {
  const tasks = [{ id: "t1", title: "Staré", type: "task", deadline: "2026-11-16", hours: 2 }];
  const r = P.generatePlan({ schedule: [], tasks, blocks: [], settings, now });
  assert.strictEqual(r.blocks.length, 0);
  assert.strictEqual(r.warnings[0].missingMin, 120);
});

test("miera splnenia plánu", () => {
  const later = new Date(2026, 10, 17, 12, 0);
  const blocks = [
    { date: "2026-11-16", start: 480, end: 540, done: true },
    { date: "2026-11-16", start: 600, end: 660, done: false },
    { date: "2026-11-18", start: 600, end: 660, done: false }, // ešte neuplynul
  ];
  assert.deepStrictEqual(P.completion(blocks, later), { done: 1, past: 2, rate: 50 });
  assert.strictEqual(P.completion(blocks.slice(2), later), null);
});
