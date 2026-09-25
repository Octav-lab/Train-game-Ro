# CFR SCADA — Simulator de dispecerat feroviar

Simulator/joc de dispecerat inspirat de sisteme SCADA. **Faza 1-5:** refactorizare modulară, date în JSON, regiuni, trenuri cu fizică și AI, blocuri + interlocking + semnale automate.

> Acest proiect este un simulator/joc. Datele marcate ca simulate (`"simulated": true` în `data/*.json`) nu reprezintă neapărat rețeaua sau traficul feroviar real. Harta este schematică, nu GIS.

## Rulare locală
Modulele ES și `fetch()` nu funcționează pe `file://`, deci ai nevoie de un server static:

```bash
npm start          # sau: python3 -m http.server 8080
```
apoi deschide http://localhost:8080

## Structură
- `data/` — gări, tronsoane, categorii de tren (JSON, editabile fără să atingi motorul)
- `src/core/` — `DataLoader` (încărcare + validare), `Game` (stare + bucla principală)
- `src/map/`, `src/trains/`, `src/dispatch/`, `src/events/`, `src/audio/`, `src/ui/`, `src/minigames/` — mixin-uri aplicate pe `Game`
- `styles/` — CSS separat pe zone

## Adăugare gară / linie
1. Adaugă gara în `data/stations.json` (`id`, `name`, `x`, `y`, `hub`, `region`).
2. Adaugă tronsonul în `data/railway-lines.json` (`id`, `from`, `to`, `double`, `maxSpeed`).
3. Reîncarcă: validatorul raportează ID-uri duplicate, gări inexistente, viteze invalide și rețea neconectată.

## Regiuni
Bara de sub HUD selectează regiunea: camera face zoom pe ea, restul rețelei se estompează, trenurile din afara regiunii se suspendă, iar trenurile noi apar și circulă doar în regiune (rute calculate în subgraful regiunii). Regiunile fără gări în date (Maramureș, Banat, Oltenia) sunt dezactivate. Regiunile din `data/regions.json` și câmpul `region` al gărilor sunt date de simulare.

## Trenuri (Faza 4)
- **Date** (`data/trains.json`, `data/rolling-stock.json`): categorie, operator, prioritate, timp de oprire, politică de oprire (IC în noduri, IR în hub-uri, Regio/Marfă peste tot), locomotive și vagoane compatibile. Toate sunt de simulare; numerele de tren sunt generate procedural.
- **Garnitură:** locomotivă + vagoane → lungime, masă, viteză maximă; accelerația rezultă din putere/masă.
- **Viteza** (`src/trains/SpeedModel.js`): min(tren, tronson, restricție temporară, curbă, vreme, semnal, apropiere de gară, trenul din față). Trenul accelerează și frânează gradual spre această viteză; limitatorul activ apare pe hartă lângă viteză.
- **AI** (`src/trains/TrainAI.js`): frânează la semnal roșu, oprește la peron, așteaptă timpul de oprire, poate fi ținut/eliberat de dispecer, iar ruta poate fi programată în timpul opririi sau anulată. Butonul „Rută AUTO" face trenurile să plece singure pe ruta GPS.
- Restricțiile temporare se pun în `Game.restrictions[idTronson] = km/h`.

## Semnale, blocuri și interlocking (Faza 5)
- **Blocuri** (`src/dispatch/BlockSystem.js`): fiecare tronson DUBLU e împărțit în 2 blocuri pe sens (graniță la 48% din tronson); fiecare tronson SIMPLU e UN singur bloc, comun ambelor sensuri, rezervat integral de la plecare — asta exclude structural coliziunea frontală (nu mai e doar detectată după fapt, e prevenită la sursă). Un tren defect ține blocul ocupat până e reparat, blocând realist traficul din spate.
- **Interlocking** (`src/dispatch/Interlocking.js`): simplificat, fără diagramă reală de macazuri — fiecare gară are o capacitate de trasee simultane prin "gâtuitura" ei (nodurile mari suportă mai multe treceri deodată, cele mici doar una). Un al doilea tren care ar intra în conflict la aceeași gâtuitură primește exact mesajul cerut: „⚠ CONFLICT DE TRASEU — Traseul nu poate fi stabilit. Secțiunea este ocupată.”
- **Semnale** (3 aspecte): VERDE (bloc liber), GALBEN (bloc liber, dar gâtuitura gării următoare e ocupată — precauție, viteză redusă), ROȘU (bloc ocupat — oprire). În modul BLA AUTOMAT, aspectul se calculează live din ocuparea reală; în modul MANUAL, dispecerul dă liber prin click, dar trecerea reușește doar dacă blocul chiar e liber.
- Testat automat (fără browser): refuz de plecare pe bloc ocupat, plecare imediată la eliberare, excludere totală pe linie simplă, refuz de traseu prin gâtuitură saturată, aspect galben/verde corect, bloc ținut de tren defect, și 40.000 de cadre de trafic intens automat cu **zero coliziuni**.

## Roadmap
Fazele 6-12: regiuni, AI trenuri, blocuri + interlocking, orar, radio contextual, evenimente, scenarii, intro, save/load, polish.
