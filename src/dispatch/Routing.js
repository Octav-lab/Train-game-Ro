import { EDGES, NODES } from '../core/DataLoader.js';

let adjacency = null;
function build() {
    adjacency = {};
    Object.keys(NODES).forEach(k => adjacency[k] = []);
    EDGES.forEach(e => { adjacency[e.from].push(e.to); adjacency[e.to].push(e.from); });
}
// `region` (opțional) restrânge graful la gările acelei regiuni.
export function getNeighbors(node, region = null) {
    if (!adjacency) build();
    const ns = adjacency[node] || [];
    return region ? ns.filter(n => NODES[n].region === region) : ns;
}
let edgeCache = null;
export function findEdge(a, b) {
    if (!edgeCache) { edgeCache = new Map(); EDGES.forEach(e => { edgeCache.set(e.from + '|' + e.to, e); edgeCache.set(e.to + '|' + e.from, e); }); }
    return edgeCache.get(a + '|' + b);
}

// Toate gările accesibile din `start` (în regiune, dacă e dată)
export function reachableFrom(start, region = null) {
    const seen = new Set([start]), q = [start];
    while (q.length) for (const n of getNeighbors(q.shift(), region)) if (!seen.has(n)) { seen.add(n); q.push(n); }
    return seen;
}

// BFS pe graful complet sau restrâns la regiune
export function getPath(start, end, region = null) {
    if (!NODES[start] || !NODES[end]) { console.error('[ROUTING] gară inexistentă', start, end); return [start, end]; }
    const queue = [[start]], visited = new Set([start]);
    while (queue.length) {
        const path = queue.shift(), node = path[path.length - 1];
        if (node === end) return path;
        for (const n of getNeighbors(node, region)) if (!visited.has(n)) { visited.add(n); queue.push([...path, n]); }
    }
    console.error('[ROUTING] rută imposibilă', start, '->', end, region ? `(regiune ${region})` : '');
    return [start, end];
}
