import { NODES, TRAIN_CATEGORIES } from '../core/DataLoader.js';
import { getNeighbors } from '../dispatch/Routing.js';

export function randomCategory() { return TRAIN_CATEGORIES[Math.floor(Math.random() * TRAIN_CATEGORIES.length)]; }

// Politica de oprire (categorie.stopPolicy): IC doar în noduri (hub cu ≥3 legături),
// IR în orice hub, Regio/Marfă peste tot. Destinația finală este mereu oprire.
export function stopsAt(t, node, nextNode) {
    if (node === t.destFinal || !nextNode) return true;
    switch (t.cat.stopPolicy) {
        case 'junctions': return NODES[node].hub && getNeighbors(node).length >= 3;
        case 'hubs': return NODES[node].hub;
        default: return true;
    }
}
