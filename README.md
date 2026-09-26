# CFR SCADA — Simulator de dispecerat feroviar

Simulator/joc de dispecerat inspirat de sisteme SCADA. **Faza 1-7:** refactorizare modulară, date în JSON, regiuni, trenuri cu fizică și AI, blocuri + interlocking + semnale automate, grafic de circulație (orar), radio contextual.

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

## Grafic de circulație / orar (Faza 6)
- **Generare** (`src/dispatch/Timetable.js`): la apariția fiecărui tren, i se construiește un orar cu câte o oprire planificată per gară din traseu, estimat din distanța schematică a hărții și o viteză medie asumată (82% din viteza maximă admisă pe categorie+linie) — marcat explicit ca SIMULARE, nu date reale CFR.
- **Ore reale:** la fiecare plecare/sosire, ora reală (din ceasul de simulare) se înregistrează în orar și se compară cu cea planificată → întârzierea per oprire, exact ca-n graficul de mers cerut (stație / oră / +Xm).
- **Recalibrare automată:** `t.delayMinutes` (folosit și la scor) se recalibrează la fiecare sosire din diferența reală față de orar, nu doar din acumulare continuă.
- **Abateri de rută:** dacă dispecerul trimite trenul pe altă rută decât cea GPS (sau se schimbă regiunea activă), orarul se reconstruiește pentru partea rămasă, păstrând orele reale deja înregistrate la stațiile parcurse — istoricul nu se pierde.
- **UI:** click pe 📅 lângă orice tren din panoul „Situație trenuri" deschide orarul complet al acelui tren (gări, ore planificate, întârziere per oprire).
- Testat automat (fără browser): generare corectă pe traseu simplu/multi-hop, recalibrare exactă a întârzierii la sosire, întârziere live vizibilă la un tren ținut, reconstrucție corectă a orarului la abatere de rută (cu păstrarea istoricului), și sincronizare orar↔traseu pe trafic automat susținut.

## Radio contextual (Faza 7)
- **Fără conversație aleatorie:** vechiul `generateRandomChatter` (saluturi între trenuri, afirmații neverificate de tipul „am liber în față" indiferent de starea reală) a fost eliminat complet.
- **`generateStatusReports()`** (`src/audio/RadioSystem.js`) alege, din situația REALĂ de pe hartă, ce merită raportat: un tren oprit la semnal roșu de un timp, un tren defect (cu numele real al gării unde s-a oprit), sau un tren cu întârziere reală ≥3 minute (citează exact `t.delayMinutes`, calculat din orar — Faza 6). Fiecare tren are un cooldown de 25s simulate ca să nu repete raportul în fiecare tură de buclă.
- **Refuzurile de bloc/interlocking (Faza 5) generează acum și schimb radio**, nu doar toast: mecanicul întreabă, dispecerul răspunde negativ și motivează („secția e ocupată" / „traseu ocupat la X"). Reîncercările automate silențioase (retry pe rută programată) nu spamează radioul.
- **Confirmări „Recepționat"** programate (cu mică întârziere, prin `queueReply`) la ținere/eliberare tren, la clearance de plecare și la raportul de întârziere.
- Testat automat (fără browser): eliminarea conversației aleatorii, raport de întârziere cu valoarea exactă, raport de semnal roșu cu cooldown funcțional, raport de defecțiune cu gara reală, schimb radio la refuz de bloc și de interlocking, absența spam-ului la reîncercări silențioase, și confirmarea "Recepționat" la hold.

## Roadmap
Fazele 8-12: regiuni, AI trenuri, blocuri + interlocking, orar, radio contextual, evenimente, scenarii, intro, save/load, polish.
