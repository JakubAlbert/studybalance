# StudyBalance – pokyny pre Claude Code

Školský prototyp: statická webová aplikácia (GitHub Pages), čisté HTML/CSS/JS bez build kroku a bez závislostí.
Dáta v `localStorage`. Texty v rozhraní sú po slovensky.

- `js/planner.js` – plánovanie sú deterministické pravidlá. Pri zmene pravidiel najprv uprav/pridaj test v `tests/planner.test.js`, potom kód. Testy: `node --test`.
- AI (Gemini) plán **nemení**, iba ho vysvetľuje. API kľúč nikdy nedávaj do kódu ani do repa.
- Skripty sú klasické `<script>` (nie ES moduly), aby `index.html` fungoval aj otvorený priamo zo súboru.
- Zadanie a rozsah: fázy A–C v dokumentoch tímu a `docs/superpowers/specs/2026-11-16-studybalance-design.md`.

## Zásady práce (Karpathy guidelines)

1. **Najprv premýšľaj.** Povedz predpoklady nahlas; ak je viac výkladov alebo niečo nejasné, opýtaj sa.
2. **Jednoduchosť.** Minimum kódu, ktorý rieši zadanie. Žiadne funkcie, abstrakcie ani „flexibilita“ navyše.
3. **Cielené zmeny.** Meň iba to, čo treba. Neupravuj okolitý kód, nepreformátuj ho, drž existujúci štýl.
4. **Overiteľný cieľ.** Úlohu premeň na kontrolovateľné kritérium (test, kontrola v prehliadači) a opakuj, kým neprejde.
