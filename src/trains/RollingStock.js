import { ROLLING_STOCK } from '../core/DataLoader.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Compune garnitura: locomotivă + vagoane compatibile cu categoria.
// Accelerația (m/s²) rezultă din raportul putere/masă, plafonată de categorie.
export function buildConsist(cat) {
    const loco = pick(ROLLING_STOCK.locomotives.filter(l => l.categories.includes(cat.type)));
    const wagon = pick(ROLLING_STOCK.wagons.filter(w => w.categories.includes(cat.type)));
    const n = randInt(cat.wagons[0], cat.wagons[1]);
    const massT = loco.massT + wagon.massT * n;
    const accel = Math.min(cat.accel, clamp(0.06 * loco.powerKw / massT + 0.03, 0.06, 1.0));
    return {
        loco: loco.name, wagon: wagon.name, wagons: n,
        lengthM: Math.round(loco.lengthM + wagon.lengthM * n), massT: Math.round(massT),
        maxSpeed: Math.min(cat.maxSpeed, loco.maxSpeed, wagon.maxSpeed),
        accelMs2: +accel.toFixed(2), text: `${n} × ${wagon.name}`
    };
}
