import { buildConsist } from './RollingStock.js';

// Fizica se rulează pe timp de "mișcare" (0.4 s per secundă reală), comprimat față de realitate:
// un tronson de ~14 km la 140 km/h (≈360 s fizice) se parcurge în ~9.5 s de mișcare → 1 s de mișcare ≈ 38 s fizice.
// accel/decel ale trenului sunt exprimate în unitățile SpeedModel: viteza variază cu (unitate × 2.5) km/h per s de mișcare.
export const TIME_COMPRESS = 38;
export const ACCEL_UNIT = 3.6 * TIME_COMPRESS / 2.5;   // m/s² → unități

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Datele unui tren. `simulated: true` — numerele și operatorii sunt de simulare.
export function createTrain({ id, cat, start, dest, path }) {
    const consist = buildConsist(cat);
    return {
        id, category: cat.prefix, cat, simulated: true, operator: pick(cat.operators),
        origin: start, destFinal: dest, path, pathIndex: 0,
        consist, locomotive: consist.loco, lengthM: consist.lengthM, massT: consist.massT,
        accel: consist.accelMs2 * ACCEL_UNIT, decel: cat.decel * ACCEL_UNIT,
        priority: cat.priority, dwellTime: cat.dwell,
        currentNode: start, targetNode: null, progress: 0, state: 'IDLE',
        speed: 0, currentSpeedKmh: 0, limiter: '', willStop: false,
        delayMinutes: 0, dwell: 0, held: false, pendingNext: null,
        breakdownTimer: 0, breakdownNode: null, domElement: null,
        blockKeys: [], blockIdx: -1, throatNode: null, throatCleared: true,
        schedule: [], lastRadioReport: 0
    };
}
