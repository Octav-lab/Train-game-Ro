// Grafic de circulație (simulare). Orele planificate sunt un ESTIMAT procedural
// (distanță schematică / viteză medie asumată pe categorie), nu date reale CFR.
// Fiecare tren primește un orar (o oprire planificată per gară din traseu); pe
// măsură ce circulă, orele REALE de sosire/plecare se înregistrează și se compară
// cu cele planificate → întârzierea afișată per oprire.
import { NODES } from '../core/DataLoader.js';
import { findEdge } from './Routing.js';
import { stopsAt } from '../trains/TrainTypes.js';

export const KM_PER_UNIT = 0.03;   // conversie schematică unitate-hartă → km (SIMULARE)
const AVG_FACTOR = 0.82;           // viteza medie asumată = 82% din viteza maximă admisă (acc./frânare/opriri)

function segmentKm(a, b) { const A = NODES[a], B = NODES[b]; return Math.hypot(A.x - B.x, A.y - B.y) * KM_PER_UNIT; }

export function buildSchedule(t, startTime) {
    const rows = []; let cursor = new Date(startTime);
    for (let i = 0; i < t.path.length; i++) {
        const node = t.path[i];
        if (i > 0) {
            const edge = findEdge(t.path[i - 1], node);
            const speed = Math.max(20, Math.min(t.consist.maxSpeed, edge ? edge.maxSpeed : 80) * AVG_FACTOR);
            const km = edge ? segmentKm(t.path[i - 1], node) : 5;
            cursor = new Date(cursor.getTime() + (km / speed) * 3600000);
        }
        const willStop = stopsAt(t, node, t.path[i + 1]);
        const arr = new Date(cursor);
        const dep = (i < t.path.length - 1 && willStop) ? new Date(cursor.getTime() + t.dwellTime * 1000) : new Date(cursor);
        rows.push({ node, arr, dep, willStop, actualArr: null, actualDep: null });
        cursor = dep;
    }
    return rows;
}

// Reconstruiește orarul de la nodul curent înainte (rută nouă/regiune schimbată). `anchorRow` este
// rândul din orarul VECHI corespunzător poziției curente a trenului (înainte de rescrierea t.path) —
// ora lui reală de sosire/plecare se păstrează, ca istoricul deja parcurs să nu se piardă.
export function rebuildSchedule(t, baseTime, anchorRow = null) {
    const base = (anchorRow && anchorRow.actualDep) || (anchorRow && anchorRow.actualArr) || baseTime;
    t.schedule = buildSchedule(t, base);
    if (anchorRow && t.schedule[0] && t.schedule[0].node === anchorRow.node) {
        t.schedule[0].actualArr = anchorRow.actualArr;
        t.schedule[0].actualDep = anchorRow.actualDep;
    }
}

export function recordDeparture(t, now) {
    const row = t.schedule && t.schedule[t.pathIndex];
    if (row && !row.actualDep) row.actualDep = new Date(now);
}

// Înregistrează sosirea la gara curentă (t.pathIndex trebuie să indice deja noul currentNode)
// și recalibrează t.delayMinutes din diferența față de orarul planificat.
export function recordArrival(t, now) {
    const row = t.schedule && t.schedule[t.pathIndex];
    if (!row) return;
    row.actualArr = new Date(now);
    t.delayMinutes = (row.actualArr - row.arr) / 60000;
}

export function fmtTime(d) { return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }); }

// Rândurile orarului pentru afișare, cu întârzierea cunoscută (sosire reală) sau
// proiectată live (dacă trenul a depășit deja ora planificată dar n-a ajuns încă).
export function scheduleView(t, now) {
    return (t.schedule || []).map((row, i) => {
        let delay = null;
        if (row.actualArr) delay = Math.round((row.actualArr - row.arr) / 60000);
        else if (i === t.pathIndex && now > row.arr) delay = Math.round((now - row.arr) / 60000);
        return { name: NODES[row.node].name, time: fmtTime(row.arr), willStop: row.willStop, delay, isPast: i < t.pathIndex, isCurrent: i === t.pathIndex };
    });
}
