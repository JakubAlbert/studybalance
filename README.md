# StudyBalance

Webová aplikácia, ktorá vysokoškolákom pomáha naplánovať čas na učenie medzi školu, prácu a ostatné povinnosti.
Školský projekt – tím: Jakub Albert, Jakub Schulcz, Marianna Kvasňovská.

## Ako to funguje

1. **Rozvrh** – študent zadá pravidelný týždeň (prednášky, cvičenia, práca…). Dá sa kedykoľvek upraviť.
2. **Povinnosti** – úlohy a skúšky s termínom a odhadom hodín prípravy.
3. **Plán** – aplikácia navrhne študijné bloky do voľných časov. Študent bloky presunie, skráti alebo zmaže,
   plán potvrdí a priebežne označuje splnené bloky. Zobrazuje sa miera splnenia plánu.

Pravidlá plánovania (`js/planner.js`):
- učenie sa plánuje iba do voľných časov v študijnom okne dňa (predvolene 8:00–22:00), do dňa pred termínom;
- najskorší termín má prednosť;
- **úlohy** sa plánujú čo najskôr, **skúšky** sa rozložia do dní pred skúškou (viac učenia bližšie k termínu);
- bloky 1–2 h, 15 min prestávka, najviac 6 h učenia denne (všetko sa dá zmeniť v Nastaveniach);
- ak čas nestačí, aplikácia ukáže, koľko hodín chýba.

**AI (Gemini, nepovinné):** v Nastaveniach sa dá vložiť vlastný API kľúč z [Google AI Studio](https://aistudio.google.com/).
AI plán nemení, iba ho vysvetlí a dá tipy. Kľúč sa ukladá len v prehliadači používateľa.
Návrh a zdôvodnenie: [docs/superpowers/specs/2026-11-16-studybalance-design.md](docs/superpowers/specs/2026-11-16-studybalance-design.md).

## Spustenie

- **Online:** GitHub Pages – `https://jakubalbert.github.io/studybalance/`
  (zapína sa v repozitári: Settings → Pages → Deploy from a branch → `main` / `/ (root)`).
- **Lokálne:** stačí otvoriť `index.html` v prehliadači (bez inštalácie).

Všetky údaje sa ukladajú do `localStorage` prehliadača – nie je tu žiadny server ani databáza.

## Testy

Plánovač má testy (vrátane normálneho, nejasného a zlyhaného prípadu z fázy C), potrebný je iba Node.js:

```bash
node --test
```

## Štruktúra

```
index.html          stránka so všetkými záložkami
css/style.css       vzhľad
js/planner.js       plánovací algoritmus (čisté funkcie, testované)
js/gemini.js        volanie Gemini API
js/app.js           ovládanie stránky, ukladanie údajov
tests/              testy plánovača
```
