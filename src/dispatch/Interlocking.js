// Interlocking SIMPLIFICAT: nu avem o diagramă reală de macazuri/semnale de intrare,
// așa că tratăm "gâtuitura" fiecărei gări ca având o capacitate de trasee simultane
// (nodurile mari, cu mai multe linii, suportă mai multe treceri deodată). Cât timp un
// tren traversează gâtuitura — de la plecare/tranzit până trece granița primului bloc
// (sau, pe linie simplă, o mică distanță de degajare) — traseul e rezervat; un al
// doilea traseu concurent prin același nod este refuzat cu "CONFLICT DE TRASEU".
import { NODES } from '../core/DataLoader.js';
import { getNeighbors } from './Routing.js';

export function nodeCapacity(node) {
    if (!NODES[node]) return 1;
    if (!NODES[node].hub) return 1;
    return Math.max(2, Math.ceil(getNeighbors(node).length / 2));
}

export const InterlockingMixin = {
    // Capacitatea efectivă ține cont de eventualele defecțiuni de macaz (Faza 8), care
    // reduc temporar câte trasee simultane poate susține gâtuitura unei gări.
    effectiveCapacity(node) {
        const override = this.nodeCapacityOverride.get(node);
        return override != null ? override : nodeCapacity(node);
    },
    reserveThroat(node, trainId) {
        let set = this.nodeRoutes.get(node);
        if (!set) { set = new Set(); this.nodeRoutes.set(node, set); }
        if (set.has(trainId)) return true;
        if (set.size >= this.effectiveCapacity(node)) return false;
        set.add(trainId);
        return true;
    },
    releaseThroat(node, trainId) {
        const set = this.nodeRoutes.get(node);
        if (set) { set.delete(trainId); if (!set.size) this.nodeRoutes.delete(node); }
    },
    throatOccupants(node) { const s = this.nodeRoutes.get(node); return s ? s.size : 0; }
};
