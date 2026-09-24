# CFR SCADA — Simulator de dispecerat feroviar

Simulator/joc de dispecerat inspirat de sisteme SCADA. **Faza 1-4:** refactorizare modulară, date în JSON, regiuni, trenuri cu fizică și AI.

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

## Roadmap
Fazele 5-12: regiuni, AI trenuri, blocuri + interlocking, orar, radio contextual, evenimente, scenarii, intro, save/load, polish.
