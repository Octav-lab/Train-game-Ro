import { EDGES, NODES } from '../core/DataLoader.js';

let adjacency = null;
function build() {
    adjacency = {};
    Object.keys(NODES).forEach(k => adjacency[k] = []);
    EDGES.forEach(e => { adjacency[e.from].push(e.to); adjacency[e.to].push(e.from); });
}
let edgeCache = null;
export function findEdge(a, b) {
    if (!edgeCache) { edgeCache = new Map(); EDGES.forEach(e => { edgeCache.set(e.from + '|' + e.to, e); edgeCache.set(e.to + '|' + e.from, e); }); }
    return edgeCache.get(a + '|' + b);
}

// `region` (opțional) restrânge graful la gările acelei regiuni; `avoidEdgeIds` (opțional,
// un Set) exclude tronsoane închise temporar (Faza 8: lucrări/linie închisă) din rutare.
export function getNeighbors(node, region = null, avoidEdgeIds = null) {
    if (!adjacency) build();
    let ns = adjacency[node] || [];
    if (region) ns = ns.filter(n => NODES[n].region === region);
    if (avoidEdgeIds && avoidEdgeIds.size) ns = ns.filter(n => { const e = findEdge(node, n); return !e || !avoidEdgeIds.has(e.id); });
    return ns;
}

// Toate gările accesibile din `start` (în regiune, ocolind tronsoanele închise, dacă sunt date)
export function reachableFrom(start, region = null, avoidEdgeIds = null) {
    const seen = new Set([start]), q = [start];
    while (q.length) for (const n of getNeighbors(q.shift(), region, avoidEdgeIds)) if (!seen.has(n)) { seen.add(n); q.push(n); }
    return seen;
}

// BFS pe graful complet sau restrâns la regiune/tronsoane disponibile
export function getPath(start, end, region = null, avoidEdgeIds = null) {
    if (!NODES[start] || !NODES[end]) { console.error('[ROUTING] gară inexistentă', start, end); return [start, end]; }
    const queue = [[start]], visited = new Set([start]);
    while (queue.length) {
        const path = queue.shift(), node = path[path.length - 1];
        if (node === end) return path;
        for (const n of getNeighbors(node, region, avoidEdgeIds)) if (!visited.has(n)) { visited.add(n); queue.push([...path, n]); }
    }
    // fallback: dacă nu există rută ocolind tronsoanele închise, încearcă fără restricția de ocolire
    // (mai bine o rută care poate necesita așteptare decât niciuna) — doar dacă chiar asta a fost cauza.
    if (avoidEdgeIds && avoidEdgeIds.size) return getPath(start, end, region, null);
    console.error('[ROUTING] rută imposibilă', start, '->', end, region ? `(regiune ${region})` : '');
    return [start, end];
}
