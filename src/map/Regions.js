import { NODES, REGIONS } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { getPath, reachableFrom } from '../dispatch/Routing.js';
import { stopsAt } from '../trains/TrainTypes.js';

// Regiuni: selector, cameră, vizibilitate hartă, adaptarea trenurilor și a traficului.
// activeRegion === null  =>  toată rețeaua.
export const RegionsMixin = {
    regionStations(id) { return Object.keys(NODES).filter(k => !id || NODES[k].region === id); },
    inRegion(nodeId) { return !this.activeRegion || NODES[nodeId].region === this.activeRegion; },
    isTrainActive(t) { return this.inRegion(t.currentNode) && (!t.targetNode || this.inRegion(t.targetNode)); },
    activeTrainCount() { return this.trains.filter(t => !t.suspended && t.state !== 'DONE' && t.state !== 'CRASHED').length; },
    trainCap() {
        if (!this.activeRegion) return 30;
        return Math.min(30, Math.max(6, Math.round(this.regionStations(this.activeRegion).length * 0.5)));
    },

    buildRegionBar() {
        const bar = document.getElementById('region-bar');
        bar.innerHTML = '';
        const mk = (id, label, color, count) => {
            const b = document.createElement('button');
            b.className = 'region-btn'; b.dataset.region = id || '';
            b.style.borderLeftColor = color;
            b.innerText = label;
            if (count === 0) { b.disabled = true; b.title = 'Fără gări în datele de simulare curente'; }
            else b.onclick = () => this.selectRegion(id);
            bar.appendChild(b);
        };
        mk(null, '🌍 TOATĂ REȚEAUA', '#0f0', Object.keys(NODES).length);
        REGIONS.forEach(r => { const n = this.regionStations(r.id).length; mk(r.id, `${r.name} (${n})`, r.color, n); });
        this.updateRegionBar();
    },
    updateRegionBar() {
        document.querySelectorAll('.region-btn').forEach(b => b.classList.toggle('active', b.dataset.region === (this.activeRegion || '')));
    },

    // Estompează gările/liniile/semnalele din afara regiunii; liniile de graniță rămân semi-vizibile.
    applyRegionVisibility() {
        for (const key in NODES) {
            const out = !this.inRegion(key);
            const n = document.getElementById(`node-${key}`), l = document.getElementById(`label-${key}`);
            if (n) n.classList.toggle('out-of-region', out);
            if (l) l.classList.toggle('out-of-region', out);
        }
        document.querySelectorAll('.rail').forEach(l => {
            const a = this.inRegion(l.dataset.a), b = this.inRegion(l.dataset.b);
            l.classList.toggle('out-of-region', !a && !b);
            l.classList.toggle('border-rail', a !== b);
        });
        this.signals.forEach(s => {
            const el = document.getElementById(s.id);
            if (el) el.classList.toggle('out-of-region', !(this.inRegion(s.ea) && this.inRegion(s.eb)));
        });
    },

    // Trenurile din afara regiunii se suspendă; cele dinăuntru primesc destinație/rută în regiune.
    adaptTrainsToRegion() {
        const region = this.activeRegion;
        this.trains.forEach(t => {
            if (t.state === 'DONE' || t.state === 'CRASHED') return;
            const active = this.isTrainActive(t);
            t.suspended = !active;
            t.domElement.classList.toggle('suspended', !active);
            if (!active || !region) return;
            const base = t.targetNode || t.currentNode;
            const reach = reachableFrom(base, region);
            if (!(NODES[t.destFinal].region === region && reach.has(t.destFinal))) {
                const hubs = [...reach].filter(n => NODES[n].hub && n !== base && n !== t.currentNode);
                if (!hubs.length) return;
                t.destFinal = hubs[Math.floor(Math.random() * hubs.length)];
            }
            const p = getPath(base, t.destFinal, region);
            t.path = t.targetNode ? [t.currentNode, ...p] : p;
            t.pathIndex = 0;
            if (t.targetNode) t.willStop = stopsAt(t, t.targetNode, t.path[2]);
            if (t.pendingNext && !this.inRegion(t.pendingNext)) t.pendingNext = null;
        });
        // trafic minim în regiune
        for (let i = 0; region && i < 5 && this.activeTrainCount() < 3; i++) this.spawnTrain();
    },

    fitRegion(id) {
        const ids = this.regionStations(id);
        if (!ids.length) return;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        ids.forEach(k => { const n = NODES[k]; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
        const w = document.getElementById('map-wrapper');
        const pad = 600;
        const zoom = Math.min(w.clientWidth / (x1 - x0 + pad * 2), w.clientHeight / (y1 - y0 + pad * 2));
        this.zoom = Math.min(1.2, Math.max(0.15, zoom));
        this.mapOffsetX = (w.clientWidth / 2) / this.zoom - (x0 + x1) / 2;
        this.mapOffsetY = (w.clientHeight / 2) / this.zoom - (y0 + y1) / 2;
        const mc = document.getElementById('map-content');
        mc.style.transition = 'transform 0.9s ease-in-out';
        this.updateTransform();
        setTimeout(() => { mc.style.transition = ''; }, 950);
    },

    selectRegion(id) {
        const reg = id ? REGIONS.find(r => r.id === id) : null;
        if (id && (!reg || this.regionStations(id).length === 0)) { this.showToast(`Regiunea ${id} nu are gări în datele curente.`, 'warn'); return; }
        AudioSys.playTone(700, 'square', 0.08);
        this.activeRegion = id || null;
        if (this.selectedNode) { const p = document.getElementById(`node-${this.selectedNode}`); if (p) p.classList.remove('selected'); }
        this.selectedNode = null; this.selectedTrainId = null;
        this.applyRegionVisibility();
        this.adaptTrainsToRegion();
        this.updateRegionBar();
        this.fitRegion(this.activeRegion);
        this.updateControlPanel(); this.updateHighlights(); this.updateTimetable();
        if (reg) {
            this.radioMsg('Dispecer', `Preluare sector ${reg.name}. Trenurile din alte regiuni sunt suspendate.`);
            this.showToast(`Regiune activă: ${reg.name} (${this.regionStations(id).length} gări, ${this.activeTrainCount()} trenuri).`, 'success');
        } else {
            this.radioMsg('Dispecer', 'Revenire la supravegherea întregii rețele.');
            this.showToast('Toată rețeaua activă.', 'success');
        }
    }
};
