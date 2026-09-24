import { NODES } from '../core/DataLoader.js';
import { findEdge } from '../dispatch/Routing.js';

// Viteza țintă = min( tren, tronson, restricție temporară, curbă, meteo, semnal, apropiere gară, trafic ).
// Progresul pe tronson e normalizat 0..1; rata depinde de lungimea (schematică) a tronsonului.
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
    if (!edge) return { kmh: 0, limiter: '?' };
    let kmh = t.consist.maxSpeed, lim = 'TREN';
    const apply = (v, name) => { if (v < kmh) { kmh = Math.max(0, v); lim = name; } };
    apply(edge.maxSpeed, 'LINIE');
    const rs = game.speedRestrictionFor(edge.id); if (rs) apply(rs, 'RESTRICȚIE');
    const cv = curveLimit(edge); if (cv) apply(cv, 'CURBĂ');
    const w = game.currentWeather.speed;
    if (w < 1) { kmh *= w; lim = 'METEO'; }

    const rate = progressRate(edge), dec = t.decel * (game.currentWeather.brake ?? 1);
    if (t.state === 'MOVING_TO_SIGNAL') {          // semnal roșu în față: frânare până la semnal (viteză de târâre 6 km/h)
        const sig = game.findSignal(edge, t.currentNode, t.targetNode);
        if (!(game.autoBLA || (sig && sig.state === 'GREEN'))) apply(Math.max(6, brakeSpeed(0.48 - t.progress, dec, rate)), 'SEMNAL');
    } else if (t.state === 'MOVING_TO_STATION') {
        const d = 1 - t.progress;
        if (t.willStop) apply(Math.max(8, brakeSpeed(d, dec, rate)), 'STAȚIE');
        else if (d < 0.15) apply(100, 'TRANZIT');
    }
    // trafic: nu ajunge din urmă trenul din față (același tronson, același sens), distanță minimă 0.05
    const lane = c.lanes.get(`${t.currentNode}>${t.targetNode}`);
    if (lane) {
        let lead = null;
        for (const o of lane) if (o !== t && o.progress > t.progress && (!lead || o.progress < lead.progress)) lead = o;
        if (lead) { const gap = lead.progress - t.progress - 0.05; apply(lead.speed + (gap > 0 ? brakeSpeed(gap, dec, rate) : 0), 'TRAFIC'); }
    }
    return { kmh, limiter: lim, rate };
}
