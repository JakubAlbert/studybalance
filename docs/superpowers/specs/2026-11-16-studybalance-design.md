# StudyBalance – návrh prototypu (Fáza C)

## Zámer
Ukázať jednu interakciu z Fázy C: študent zadá týždenný rozvrh, pridá úlohy/skúšky
s termínom a odhadom hodín, aplikácia navrhne študijné bloky, študent ich upraví a potvrdí.
Konštrukt: samoregulované učenie (plánovanie + sebamonitorovanie).

## Ciele / mimo rozsahu
- Ciele: rozvrh (úprava), povinnosti, generovanie + úprava + potvrdenie plánu,
  označovanie splnených blokov a miera splnenia plánu.
- Mimo rozsahu: pripomienky, synchronizácia s kalendármi, hodnotenie vedomostí,
  predpovede výsledkov, používateľské účty, server.

## Zvolený prístup
Statická webová aplikácia na GitHub Pages (HTML + CSS + čistý JavaScript, bez build kroku).
Dáta v `localStorage` prehliadača. Zvažované alternatívy:
- lokálne s Ollamou (podľa Fázy B) – každý by musel mať Ollamu, nedá sa ukázať online;
- Pages + serverless proxy na skrytie kľúča – zbytočná práca pre prototyp.

## Rozdelenie práce: pravidlá vs. AI
Plán počítajú **deterministické pravidlá** (`js/planner.js`), lebo LLM spoľahlivo nedodrží
obsadené časy a súčty hodín (hlavná technická prekážka z Fázy C):
1. Voľné úseky = študijné okno dňa (napr. 8:00–22:00) mínus rozvrh mínus už naplánované bloky,
   od teraz do dňa pred termínom.
2. Poradie: najskorší termín prvý (pri zhode úloha pred skúškou).
3. Úloha → bloky čo najskôr (greedy dopredu), aj viac blokov v jeden deň s prestávkou.
4. Skúška → od dňa pred skúškou dozadu, najviac jeden blok na deň v každom kole
   → príprava je rozložená a hustejšia bližšie k skúške.
5. Bloky 1–2 h (nastaviteľné), prestávka 15 min, max. hodín štúdia za deň (nastaviteľné).
6. Ak čas nestačí, naplánuje sa, čo sa dá, a zobrazí sa upozornenie, koľko hodín chýba.

**Gemini (`gemini-3.5-flash-lite`, voliteľné)** iba vysvetlí hotový plán a dá 2–3 tipy
(aj podľa miery splnenia). Kľúč si používateľ vloží v Nastaveniach, ukladá sa len v jeho prehliadači.
Bez kľúča aplikácia plne funguje, vysvetlenie priorít zobrazí aj pravidlový generátor.

## Analytika (Fáza B)
- Stopa: záznam udalostí `block_confirmed`, `block_moved`, `block_done`, `block_undone`.
- Indikátor: miera splnenia = splnené bloky / bloky, ktorých čas už uplynul × 100 %
  (ak žiadny neuplynul, nezobrazí sa).
- Pri miere < 50 % (aspoň 3 uplynulé bloky) aplikácia odporučí rozdeliť úlohy alebo zvýšiť odhad.

## Kontrola študenta
Návrh je koncept, kým ho študent nepotvrdí. Každý blok môže presunúť, skrátiť/predĺžiť alebo zmazať.
Pri opätovnom generovaní sa ponechajú splnené bloky a plánujú sa iba zostávajúce hodiny.
