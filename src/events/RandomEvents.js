// Evenimente dinamice de SIMULARE: semnal defect, macaz indisponibil, linie închisă
// (lucrări), cădere de alimentare, obstacol pe linie. Fiecare are consecințe reale în
// simulare (nu doar text) și se rezolvă automat după un timp; dispecerul e anunțat prin
// toast + radio la declanșare și la rezolvare.
import { NODES, EDGES } from '../core/DataLoader.js';
import { findEdge } from '../dispatch/Routing.js';

const EVENT_DEFS = {
    SIGNAL_FAILURE: { label: 'Semnal defect', min: 90, max: 220 },
    POINTS_FAILURE: { label: 'Macaz indisponibil', min: 120, max: 260 },
    LINE_CLOSURE: { label: 'Linie închisă (lucrări)', min: 300, max: 600 },
    POWER_OUTAGE: { label: 'Cădere de alimentare', min: 180, max: 360 },
    OBSTACLE: { label: 'Obstacol pe linie', min: 30, max: 80 }
};
const TYPES = Object.keys(EVENT_DEFS);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randRange(a, b) { return a + Math.random() * (b - a); }

export const RandomEventsMixin = {
    updateEventBadge() {
        const el = document.getElementById('sys-events');
        if (el) el.innerText = this.activeEvents.length;
    },

    // Verifică periodic dacă e cazul să pornească un incident nou (folosit din bucla principală).
    // `forceType`/`forceEdge`/`forceNode` permit declanșare deterministă (teste, scenarii).
    triggerRandomEvent(forceType = null, forceEdge = null, forceNode = null) {
        const type = forceType || pick(TYPES);
        const def = EVENT_DEFS[type];
        if (!def) return null;
        const remaining = randRange(def.min, def.max);
        let ev = { type, label: def.label, remaining, total: remaining };

        if (type === 'SIGNAL_FAILURE') {
            const candidates = this.signals.filter(s => s.isDouble && !s.failed && (!forceEdge || (findEdge(s.from, s.to) && findEdge(s.from, s.to).id === forceEdge)));
            const sig = candidates.length ? pick(candidates) : null;
            if (!sig) return null;
            sig.failed = true; ev.sigId = sig.id; ev.location = `${NODES[sig.from].name} → ${NODES[sig.to].name}`;
        } else if (type === 'POINTS_FAILURE') {
            const nodes = Object.keys(NODES).filter(k => !this.nodeCapacityOverride.has(k) && (!forceNode || k === forceNode));
            const node = nodes.length ? (forceNode && nodes.includes(forceNode) ? forceNode : pick(nodes)) : null;
            if (!node) return null;
            this.nodeCapacityOverride.set(node, 0); ev.node = node; ev.location = NODES[node].name;
            const el = document.getElementById(`node-${node}`); if (el) el.classList.add('points-failed');
        } else if (type === 'LINE_CLOSURE') {
            const options = EDGES.filter(e => !this.closedEdges.has(e.id) && (!forceEdge || e.id === forceEdge));
            const edge = options.length ? pick(options) : null;
            if (!edge) return null;
            this.closedEdges.add(edge.id); ev.edgeId = edge.id; ev.location = `${NODES[edge.from].name} — ${NODES[edge.to].name}`;
            this.styleEdge(edge.id, 'line-closed', true);
        } else if (type === 'POWER_OUTAGE') {
            const options = EDGES.filter(e => !this.powerOutageEdges.has(e.id) && (!forceEdge || e.id === forceEdge));
            const edge = options.length ? pick(options) : null;
            if (!edge) return null;
            this.powerOutageEdges.add(edge.id); ev.edgeId = edge.id; ev.location = `${NODES[edge.from].name} — ${NODES[edge.to].name}`;
            this.styleEdge(edge.id, 'line-outage', true);
        } else if (type === 'OBSTACLE') {
            const options = EDGES.filter(e => this.speedRestrictionFor(e.id) == null && (!forceEdge || e.id === forceEdge));
            const edge = options.length ? pick(options) : null;
            if (!edge) return null;
            this.restrictions[edge.id] = 20; ev.edgeId = edge.id; ev.location = `${NODES[edge.from].name} — ${NODES[edge.to].name}`;
            this.styleEdge(edge.id, 'line-obstacle', true);
        }

        this.activeEvents.push(ev);
        this.updateEventBadge();
        this.showToast(`⚠ ${ev.label}: ${ev.location}`, 'warn');
        this.radioMsg('Dispecer', `Atenție, ${ev.label.toLowerCase()} la ${ev.location}. Circulați cu precauție.`);
        return ev;
    },

    clearEvent(ev) {
        if (ev.sigId) { const sig = this.signals.find(s => s.id === ev.sigId); if (sig) { sig.failed = false; if (sig.state === 'FAILED') sig.state = 'RED'; } }
        if (ev.node) { this.nodeCapacityOverride.delete(ev.node); const el = document.getElementById(`node-${ev.node}`); if (el) el.classList.remove('points-failed'); }
        if (ev.type === 'LINE_CLOSURE') { this.closedEdges.delete(ev.edgeId); this.styleEdge(ev.edgeId, 'line-closed', false); }
        if (ev.type === 'POWER_OUTAGE') { this.powerOutageEdges.delete(ev.edgeId); this.styleEdge(ev.edgeId, 'line-outage', false); }
        if (ev.type === 'OBSTACLE') { delete this.restrictions[ev.edgeId]; this.styleEdge(ev.edgeId, 'line-obstacle', false); }
        this.showToast(`✔ Rezolvat: ${ev.label} — ${ev.location}`, 'success');
        this.radioMsg('Dispecer', `Secția de la ${ev.location} e liberă. ${ev.label} rezolvat(ă).`);
    },

    tickEvents(dtSim) {
        for (let i = this.activeEvents.length - 1; i >= 0; i--) {
            const ev = this.activeEvents[i];
            ev.remaining -= dtSim;
            if (ev.remaining <= 0) { this.clearEvent(ev); this.activeEvents.splice(i, 1); }
        }
        this.updateEventBadge();
        this.eventTimer += dtSim;
        const threshold = 500 + Math.random() * 700;
        if (this.eventTimer > threshold) { this.eventTimer = 0; if (Math.random() < 0.6) this.triggerRandomEvent(); }
    },

    // Marchează vizual pe hartă tronsonul afectat de un incident (liniile <line class="rail">
    // care leagă cele două gări — Regions.js le-a marcat deja cu data-a/data-b).
    styleEdge(edgeId, className, on) {
        const edge = EDGES.find(e => e.id === edgeId);
        if (!edge) return;
        document.querySelectorAll('line.rail').forEach(l => {
            if ((l.dataset.a === edge.from && l.dataset.b === edge.to) || (l.dataset.a === edge.to && l.dataset.b === edge.from)) {
                l.classList.toggle(className, on);
            }
        });
    }
};
