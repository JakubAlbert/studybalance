// Volanie Gemini API priamo z prehliadača. AI plán nemení, iba ho vysvetľuje.

async function explainPlan({ key, model, payload }) {
  const prompt =
    "Si študijný asistent pre vysokoškoláka. Plán nižšie vytvorili pevné pravidlá " +
    "(úlohy čo najskôr, skúšky rozložené do dní pred termínom, rešpektuje rozvrh). " +
    "Časy NEMEŇ a nevymýšľaj nové bloky. Po slovensky, obyčajným textom bez markdownu, " +
    "najviac 120 slov: 1) v 2–3 vetách vysvetli, prečo sú povinnosti v tomto poradí, " +
    "2) daj najviac 3 krátke praktické tipy. Ak niektorej povinnosti chýba čas, navrhni úpravu " +
    "rozvrhu alebo odhadu. Ak je miera splnenia pod 50 %, odporuč rozdeliť úlohy na menšie časti " +
    "alebo zvýšiť odhad času.\n\nDáta (JSON):\n" +
    JSON.stringify(payload);

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  if (!parts) throw new Error("AI nevrátila žiadny text.");
  return parts.map((p) => p.text || "").join("").trim();
}
