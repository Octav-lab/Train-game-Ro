import { NODES } from '../core/DataLoader.js';
import { findEdge } from '../dispatch/Routing.js';
import { BLOCK_BOUNDARY } from '../dispatch/BlockSystem.js';

// Viteza țintă = min( tren, tronson, restricție temporară, curbă, meteo, semnal/bloc, apropiere gară ).
// Progresul pe tronson e normalizat 0..1; rata depinde de lungimea (schematică) a tronsonului.
// Distanța dintre trenuri nu mai e calculată "din ochi": e garantată structural de blocuri
// (fiecare bloc are un singur ocupant), deci viteza țintă nu mai are nevoie de un termen de trafic separat.
const K = 0.00075, REF = 700;
const lenCache = new Map();
export function edgeLen(edge) {
    let l = lenCache.get(edge.id);
    if (l == null) { const a = NODES[edge.from], b = NODES[edge.to]; l = Math.hypot(a.x - b.x, a.y - b.y); lenCache.set(edge.id, l); }
    return l;
}
export const progressRate = edge => K * REF / edgeLen(edge);   // progres pe (km/h · secundă de mișcare)

// Restricție de curbă SIMULATĂ (procedurală, determinist din id) — de înlocuit cu date reale.
export function curveLimit(edge) {
    let h = 0; for (const ch of edge.id) h += ch.charCodeAt(0);
    return (edge.maxSpeed >= 90 && h % 6 === 0) ? Math.round(edge.maxSpeed * 0.7 / 10) * 10 : null;
}
// Viteza maximă de la care se mai poate opri pe `dist` (unități de progres); 10% marjă
export const brakeSpeed = (dist, decel, rate) => dist <= 0 ? 0 : Math.sqrt(2 * decel * 2.5 * 0.9 * dist / rate);

export function computeTargetSpeed(game, t, c) {
    const edge = findEdge(t.currentNode, t.targetNode);
    if (!edge) return { kmh: 0, limiter: '?', rate: 0 };
    let kmh = t.consist.maxSpeed, lim = 'TREN';
    const apply = (v, name) => { if (v < kmh) { kmh = Math.max(0, v); lim = name; } };
    apply(edge.maxSpeed, 'LINIE');
    const rs = game.speedRestrictionFor(edge.id); if (rs) apply(rs, 'RESTRICȚIE');
    const cv = curveLimit(edge); if (cv) apply(cv, 'CURBĂ');
    const w = game.currentWeather.speed;
    if (w < 1) { kmh *= w; lim = 'METEO'; }

    const rate = progressRate(edge), dec = t.decel * (game.currentWeather.brake ?? 1);
    if (edge.double && t.state === 'MOVING_TO_SIGNAL') {   // semnal de bloc în față: frânare până la graniță
        const sig = game.findSignal(edge, t.currentNode, t.targetNode);
        const nextFree = t.blockKeys && t.blockKeys[1] && game.blockFree(t.blockKeys[1], t.id);
        if (!(game.autoBLA ? nextFree : (sig && sig.state === 'GREEN')))
            apply(Math.max(6, brakeSpeed(BLOCK_BOUNDARY - t.progress, dec, rate)), 'SEMNAL');
        else if (sig && sig.state === 'YELLOW') apply(edge.maxSpeed * 0.6, 'ATENȚIE');
    } else if (t.state === 'MOVING_TO_STATION') {
        const d = 1 - t.progress;
        if (t.willStop) apply(Math.max(8, brakeSpeed(d, dec, rate)), 'STAȚIE');
        else if (d < 0.15) apply(100, 'TRANZIT');
    }
    return { kmh, limiter: lim, rate };
}
