import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { findEdge, getPath } from '../dispatch/Routing.js';
import { computeTargetSpeed } from './SpeedModel.js';
import { stopsAt } from './TrainTypes.js';

const SIGNAL_POS = 0.48;
const ON_TRACK = new Set(['MOVING_TO_SIGNAL', 'MOVING_TO_STATION', 'WAITING_SIGNAL_MID', 'BROKEN']);

// AI-ul trenului. Mixin pe Game (`this` = Game). Viteza țintă vine din SpeedModel;
// aici trenul accelerează/frânează spre ea, respectă semnalul, oprește la peron,
// așteaptă timpul de oprire și poate fi ținut de dispecer.
export const TrainAIMixin = {
    // trenurile aflate pe tronson, grupate pe sens (folosit de SpeedModel pentru distanța față de trenul din față)
    buildLanes() {
        const lanes = new Map();
        for (const t of this.trains) {
            if (t.suspended || !t.targetNode || !ON_TRACK.has(t.state)) continue;
            const k = `${t.currentNode}>${t.targetNode}`;
            if (!lanes.has(k)) lanes.set(k, []);
            lanes.get(k).push(t);
        }
        return lanes;
    },

    // Pornește trenul pe tronsonul spre `next` (path[pathIndex+1] trebuie să fie `next`)
    beginEdge(t, next) {
        t.targetNode = next; t.progress = 0; t.state = 'MOVING_TO_SIGNAL';
        t.willStop = stopsAt(t, next, t.path[t.pathIndex + 2]);
        t.domElement.querySelector('.train-dot').classList.remove('waiting');
        const edge = findEdge(t.currentNode, next);
        const sig = this.findSignal(edge, t.currentNode, next);
        if (this.autoBLA && sig && sig.state === 'RED') this.setSignal(sig, true);
        const k = `${t.currentNode}>${next}`;
        if (!this.lanes.has(k)) this.lanes.set(k, []);
        this.lanes.get(k).push(t);
    },

    // Plecare din stație spre `next`. Returnează false dacă nu se poate (tronson ocupat la ieșire).
    departTrain(t, next) {
        const edge = findEdge(t.currentNode, next);
        if (!edge || (this.activeRegion && NODES[next].region !== this.activeRegion)) { t.pendingNext = null; return false; }
        const lane = this.lanes.get(`${t.currentNode}>${next}`);
        if (lane && lane.some(o => o !== t && o.progress < 0.06)) return false;   // tren încă la ieșirea din stație
        t.pendingNext = null;
        if (t.path[t.pathIndex + 1] !== next) {   // abatere de la ruta GPS: recalculează ruta prin `next`
            const rest = next === t.destFinal ? [next] : getPath(next, t.destFinal, this.activeRegion);
            t.path = [t.currentNode, ...rest]; t.pathIndex = 0;
        }
        this.beginEdge(t, next);
        this.radioMsg('Dispecer', `Liber pe secție spre ${NODES[next].name} pentru ${t.id}.`);
        return true;
    },

    arriveAtStation(t) {
        const dot = t.domElement.querySelector('.train-dot');
        t.currentNode = t.targetNode; t.targetNode = null; t.progress = 0;
        if (t.path[t.pathIndex + 1] === t.currentNode) t.pathIndex++;
        if (t.willStop) t.speed = 0;
        if (t.currentNode === t.destFinal) {
            this.radioMsg(`Mecanic ${t.id}`, `Am ajuns la destinația finală ${NODES[t.currentNode].name}.`);
            this.completedCount++;
            document.getElementById('sys-completed').innerText = this.completedCount;
            // întârzierea contează mai mult pentru trenurile prioritare
            this.updateScore(Math.max(0, Math.round(150 - t.delayMinutes * (0.6 + 0.2 * t.priority))));
            t.state = 'DONE'; t.domElement.remove();
            setTimeout(() => this.spawnTrain(), 2000 + Math.random() * 4000);
        } else {
            const next = t.path[t.pathIndex + 1];
            if (!t.willStop && next) {
                this.beginEdge(t, next);
                this.radioMsg(`Mecanic ${t.id}`, `Tranzităm în viteză ${NODES[t.currentNode].name}.`);
            } else {
                t.state = 'IDLE'; t.speed = 0; t.dwell = t.dwellTime;
                dot.classList.add('waiting'); t.domElement.classList.remove('moving');
                this.radioMsg(`Mecanic ${t.id}`, `Am oprit în ${NODES[t.currentNode].name}. Așteptăm parcurs.`);
                this.updateScore(25);
            }
        }
        if (this.selectedNode === t.currentNode) this.updateControlPanel();
        this.updateHighlights();
    },

    // Un pas de simulare pentru un tren. Returnează true dacă timetable-ul trebuie reîmprospătat.
    stepTrain(t, dtSim, realDt, mt, ctx, stationCounts) {
        let upd = false;
        const el = t.domElement, dot = el.querySelector('.train-dot'), tag = el.querySelector('.train-speed-tag');

        if (t.state === 'CRASHED') {
            t.breakdownTimer += realDt;
            if (t.breakdownTimer > 5.0) { t.state = 'DONE'; el.remove(); upd = true; }
            return upd;
        }
        if (t.suspended) { if (t.state === 'IDLE') stationCounts[t.currentNode]++; return false; }

        if (t.state === 'IDLE') {
            stationCounts[t.currentNode]++;
            t.speed = t.currentSpeedKmh = 0;
            tag.style.display = 'none'; dot.style.transform = 'rotate(0deg)'; el.classList.remove('moving');
            if (t.dwell > 0) {                       // oprire la peron: nu contează ca întârziere
                t.dwell = Math.max(0, t.dwell - dtSim);
                if (t.dwell === 0) { upd = true; if (this.selectedNode === t.currentNode) this.updateControlPanel(); }
            } else t.delayMinutes += dtSim / 60;
            if (t.dwell <= 0 && !t.held) {
                const next = t.pendingNext || (this.autoRoute ? t.path[t.pathIndex + 1] : null);
                if (next && this.departTrain(t, next)) upd = true;
            }
            if (Math.random() < 0.01) upd = true;
            return upd;
        }

        el.classList.add('moving');

        if (t.state === 'BROKEN') {
            t.speed = t.currentSpeedKmh = 0;
            t.delayMinutes += dtSim / 60;
            if (Math.random() < 0.05) upd = true;
            t.breakdownTimer -= mt;
            if (t.breakdownTimer <= 0) {
                t.state = 'MOVING_TO_STATION';
                this.radioMsg(`Mecanic ${t.id}`, 'Am reușit remedierea, continuăm parcursul.');
                dot.classList.remove('broken');
                if (t.breakdownNode) this.showBrokenBadge(t.breakdownNode, false);
                t.breakdownNode = null; upd = true;
            }
        } else {
            const edge = findEdge(t.currentNode, t.targetNode);
            const sig = this.findSignal(edge, t.currentNode, t.targetNode);
            if (this.autoBLA && sig && sig.state === 'RED' && (t.state === 'MOVING_TO_SIGNAL' || t.state === 'WAITING_SIGNAL_MID')) this.setSignal(sig, true);

            if (t.state === 'WAITING_SIGNAL_MID') {
                t.speed = t.currentSpeedKmh = 0;
                t.delayMinutes += dtSim / 60;
                if (Math.random() < 0.05) upd = true;
                if (sig && sig.state === 'GREEN') {
                    this.setSignal(sig, false);
                    t.state = 'MOVING_TO_STATION';
                    dot.classList.remove('waiting');
                    this.radioMsg(`Mecanic ${t.id}`, 'Avem semnal liber. Pornim.');
                    upd = true;
                }
            } else {
                if (t.state === 'MOVING_TO_STATION' && t.speed > 20 && this.minigamesEnabled && Math.random() < 0.00008) {
                    this.triggerBreakdown(t);
                    return true;
                }
                // dinamică: accelerează / frânează spre viteza țintă
                const r = computeTargetSpeed(this, t, ctx);
                t.limiter = r.limiter;
                const brakeF = this.currentWeather.brake ?? 1;
                if (t.speed < r.kmh) t.speed = Math.min(r.kmh, t.speed + t.accel * 2.5 * mt);
                else t.speed = Math.max(r.kmh, t.speed - t.decel * brakeF * 2.5 * mt);
                t.currentSpeedKmh = t.speed;
                t.progress += t.speed * r.rate * mt;

                if (t.state === 'MOVING_TO_SIGNAL') {
                    if (sig && sig.state === 'GREEN') {
                        if (t.progress >= SIGNAL_POS) { this.setSignal(sig, false); t.state = 'MOVING_TO_STATION'; }
                    } else if (t.progress >= SIGNAL_POS || (t.progress >= SIGNAL_POS - 0.004 && t.speed < 12)) {
                        t.progress = SIGNAL_POS; t.speed = t.currentSpeedKmh = 0;   // oprit la semnal roșu
                        t.state = 'WAITING_SIGNAL_MID';
                        dot.classList.add('waiting'); el.classList.remove('moving');
                        this.radioMsg(`Mecanic ${t.id}`, 'Am oprit la semafor roșu intermediar. Așteptăm verde.');
                        upd = true;
                    }
                } else if (t.state === 'MOVING_TO_STATION') {
                    if (t.progress >= 1.0 || (t.willStop && 1 - t.progress < 0.004 && t.speed < 15)) {
                        this.arriveAtStation(t);
                        return true;
                    }
                }
            }
        }

        // coliziune frontală pe linie simplă (poziții comparate în același sens al tronsonului)
        if (t.targetNode && ON_TRACK.has(t.state)) {
            const e = findEdge(t.currentNode, t.targetNode);
            if (e && !e.double) {
                const pos = x => (x.currentNode === e.from ? x.progress : 1 - x.progress);
                const hit = this.trains.find(o => o !== t && !o.suspended && ON_TRACK.has(o.state) &&
                    o.currentNode === t.targetNode && o.targetNode === t.currentNode && Math.abs(pos(o) - pos(t)) < 0.03);
                if (hit) {
                    [t, hit].forEach(x => {
                        x.state = 'CRASHED'; x.breakdownTimer = 0; x.speed = x.currentSpeedKmh = 0;
                        x.domElement.querySelector('.train-dot').className = 'train-dot crashed';
                        x.domElement.classList.remove('moving');
                    });
                    this.showToast(`AVARIE MAJORĂ! Coliziune între ${t.id} și ${hit.id}!`, 'error');
                    this.radioMsg('Dispecer', '!!! MAYDAY! COLIZIUNE PE SECȚIE !!! Toate garniturile OPRIȚI!');
                    this.updateScore(-500); AudioSys.error();
                    return true;
                }
            }
        }

        // poziție pe hartă
        if (t.targetNode && t.state !== 'DONE' && t.state !== 'IDLE') {
            const n1 = NODES[t.currentNode], n2 = NODES[t.targetNode];
            let px = n1.x + (n2.x - n1.x) * t.progress, py = n1.y + (n2.y - n1.y) * t.progress;
            const e = findEdge(t.currentNode, t.targetNode);
            if (e && e.double) {
                const dx = n2.x - n1.x, dy = n2.y - n1.y, dist = Math.sqrt(dx * dx + dy * dy);
                px += (-dy / dist) * 16.0; py += (dx / dist) * 16.0;
            }
            dot.style.transform = `rotate(${Math.atan2(n2.y - n1.y, n2.x - n1.x) * 180 / Math.PI}deg)`;
            el.style.left = `${px}px`; el.style.top = `${py}px`;
            if (t.state === 'WAITING_SIGNAL_MID' || t.state === 'BROKEN') tag.style.display = 'none';
            else { tag.style.display = 'block'; tag.innerText = `${Math.round(t.speed)} km/h · ${t.limiter}`; }
        }
        return upd;
    }
};
