// Încarcă și validează datele din /data. NODES/EDGES/TRAIN_CATEGORIES sunt
// obiecte "live": sunt umplute după load(), deci importurile rămân valide.
export const NODES = {};
export const EDGES = [];
export const TRAIN_CATEGORIES = [];
export const REGIONS = [];
export const ROLLING_STOCK = { locomotives: [], wagons: [] };

async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Nu pot încărca ${path} (HTTP ${res.status})`);
    return res.json();
}

export function validateData(stations, edges, categories, regions = [], rolling = null) {
    const errors = [], warnings = [];
    const ids = new Set();
    stations.forEach(s => {
        if (!s.id || !s.name) errors.push(`Gară invalidă: ${JSON.stringify(s)}`);
        if (ids.has(s.id)) errors.push(`ID de gară duplicat: ${s.id}`);
        ids.add(s.id);
        if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) errors.push(`Coordonate invalide la gara ${s.id}`);
    });
    const rids = new Set(regions.map(r => r.id));
    if (regions.length) stations.forEach(s => { if (!rids.has(s.region)) errors.push(`Gara ${s.id}: regiune necunoscută "${s.region}"`); });
    const edgeIds = new Set(), linked = new Set();
    edges.forEach(e => {
        if (edgeIds.has(e.id)) errors.push(`ID de tronson duplicat: ${e.id}`);
        edgeIds.add(e.id);
        if (!ids.has(e.from)) errors.push(`Tronson ${e.id}: gara inexistentă "${e.from}"`);
        if (!ids.has(e.to)) errors.push(`Tronson ${e.id}: gara inexistentă "${e.to}"`);
        if (e.from === e.to) errors.push(`Tronson ${e.id}: legătură către aceeași gară`);
        if (!(e.maxSpeed > 0)) errors.push(`Tronson ${e.id}: viteză invalidă (${e.maxSpeed})`);
        linked.add(e.from); linked.add(e.to);
    });
    stations.forEach(s => { if (!linked.has(s.id)) warnings.push(`Gara ${s.id} nu are nicio linie`); });
    if (!categories.length) errors.push('Nicio categorie de tren definită');
    const policies = ['all', 'hubs', 'junctions'];
    categories.forEach(c => {
        if (!(c.maxSpeed > 0)) errors.push(`Categorie ${c.type}: viteză invalidă`);
        if (!(c.accel > 0) || !(c.decel > 0)) errors.push(`Categorie ${c.type}: accel/decel invalide`);
        if (!(c.priority >= 1) || !(c.dwell >= 0)) errors.push(`Categorie ${c.type}: priority/dwell invalide`);
        if (!policies.includes(c.stopPolicy)) errors.push(`Categorie ${c.type}: stopPolicy necunoscut "${c.stopPolicy}"`);
        if (!Array.isArray(c.wagons) || c.wagons[0] > c.wagons[1]) errors.push(`Categorie ${c.type}: interval vagoane invalid`);
        if (rolling) {
            if (!rolling.locomotives.some(l => l.categories.includes(c.type))) errors.push(`Categorie ${c.type}: nicio locomotivă disponibilă`);
            if (!rolling.wagons.some(w => w.categories.includes(c.type))) errors.push(`Categorie ${c.type}: niciun vagon disponibil`);
        }
    });

    // conectivitate: toate gările trebuie să fie într-o singură componentă
    if (!errors.length && stations.length) {
        const adj = {}; stations.forEach(s => adj[s.id] = []);
        edges.forEach(e => { adj[e.from].push(e.to); adj[e.to].push(e.from); });
        const seen = new Set([stations[0].id]), q = [stations[0].id];
        while (q.length) adj[q.shift()].forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } });
        if (seen.size !== stations.length) warnings.push(`Rețea neconectată: ${stations.length - seen.size} gări izolate de restul`);
    }
    return { errors, warnings };
}

export async function loadData(base = '.') {
    const [st, ln, tr, rg, rs] = await Promise.all([
        fetchJson(`${base}/data/stations.json`),
        fetchJson(`${base}/data/railway-lines.json`),
        fetchJson(`${base}/data/trains.json`),
        fetchJson(`${base}/data/regions.json`),
        fetchJson(`${base}/data/rolling-stock.json`)
    ]);
    const { errors, warnings } = validateData(st.stations, ln.edges, tr.categories, rg.regions, rs);
    warnings.forEach(w => console.warn('[DATA]', w));
    if (errors.length) { errors.forEach(e => console.error('[DATA]', e)); throw new Error(errors.join('\n')); }

    st.stations.forEach(s => { NODES[s.id] = { ...s }; });
    ln.edges.forEach(e => EDGES.push(e));
    tr.categories.forEach(c => TRAIN_CATEGORIES.push(c));
    rg.regions.forEach(r => REGIONS.push(r));
    rs.locomotives.forEach(l => ROLLING_STOCK.locomotives.push(l));
    rs.wagons.forEach(w => ROLLING_STOCK.wagons.push(w));
    return { simulated: !!(st.meta && st.meta.simulated), warnings };
}
