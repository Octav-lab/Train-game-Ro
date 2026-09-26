import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { findEdge, getPath } from '../dispatch/Routing.js';
import { blockPlan, BLOCK_BOUNDARY } from '../dispatch/BlockSystem.js';
import { rebuildSchedule, recordDeparture, recordArrival } from '../dispatch/Timetable.js';
import { computeTargetSpeed } from './SpeedModel.js';
import { stopsAt } from './TrainTypes.js';

const ON_TRACK = new Set(['MOVING_TO_SIGNAL', 'MOVING_TO_STATION', 'WAITING_SIGNAL_MID', 'BROKEN']);
const THROAT_CLEAR_DOUBLE = BLOCK_BOUNDARY;   // pe linie dublă, gâtuitura se eliberează la granița de bloc
const THROAT_CLEAR_SINGLE = 0.15;              // pe linie simplă (fără graniță de bloc), la o mică distanță de degajare

// AI-ul trenului. Mixin pe Game (`this` = Game). Viteza țintă vine din SpeedModel;
// aici trenul accelerează/frânează spre ea, cere blocuri și trasee (interlocking),
// respectă semnalul, oprește la peron, așteaptă timpul de oprire și poate fi ținut de dispecer.
export const TrainAIMixin = {
    // Încearcă să plece/tranziteze pe tronsonul spre `next`: rezervă primul bloc + gâtuitura
    // nodului curent. Refuză dacă blocul e ocupat ("BLOC OCUPAT") sau dacă traseul intră în
    // conflict cu alt tren la aceeași gâtuitură ("CONFLICT DE TRASEU"). Folosită atât pentru
    // dispecerizare manuală cât și pentru tranzitul automat prin gări mici.
    attemptDeparture(t, next, opts = {}) {
        if (this.activeRegion && NODES[next].region !== this.activeRegion) return { ok: false };
        const edge = findEdge(t.currentNode, next);
        if (!edge) return { ok: false };
        const keys = blockPlan(edge, t.currentNode, next);
        if (!this.reserveBlock(keys[0], t.id)) {
            if (!opts.silent) {
                this.showToast(`⛔ BLOC OCUPAT: secțiunea ${NODES[t.currentNode].name} → ${NODES[next].name} e ocupată de alt tren.`, 'warn');
                this.radioMsg(`Mecanic ${t.id}`, `Dispecerat, avem liber spre ${NODES[next].name}?`);
                this.queueReply('Dispecer', `${t.id}, negativ, secția e ocupată. Mențineți poziția.`);
            }
            return { ok: false, reason: 'BLOC' };
        }
        if (!this.reserveThroat(t.currentNode, t.id)) {
            this.releaseBlock(keys[0], t.id);
            if (!opts.silent) {
                this.showToast(`⚠ CONFLICT DE TRASEU\nTraseul nu poate fi stabilit.\nSecțiunea este ocupată.`, 'error');
                this.radioMsg(`Mecanic ${t.id}`, `Dispecerat, solicit liber spre ${NODES[next].name}.`);
                this.queueReply('Dispecer', `${t.id}, negativ, traseu ocupat la ${NODES[t.currentNode].name}. Reveniți în așteptare.`);
            }
            return { ok: false, reason: 'INTERLOCKING' };
        }
        t.pendingNext = null;
        if (t.path[t.pathIndex + 1] !== next) {   // abatere de la ruta GPS: recalculează ruta prin `next`
            const anchorRow = t.schedule && t.schedule[t.pathIndex];
            const rest = next === t.destFinal ? [next] : getPath(next, t.destFinal, this.activeRegion);
            t.path = [t.currentNode, ...rest]; t.pathIndex = 0;
            rebuildSchedule(t, this.simTime, anchorRow);
        }
        t.throatNode = t.currentNode; t.throatCleared = false;
        t.blockKeys = keys; t.blockIdx = 0;
        t.targetNode = next; t.progress = 0;
        // linie dublă: fază de apropiere spre semnalul de bloc; linie simplă: blocul e deja
        // rezervat integral, deci nu mai există punct intermediar de oprire.
        t.state = edge.double ? 'MOVING_TO_SIGNAL' : 'MOVING_TO_STATION';
        t.willStop = stopsAt(t, next, t.path[t.pathIndex + 2]);
        recordDeparture(t, this.simTime);
        t.domElement.querySelector('.train-dot').classList.remove('waiting');
        this.radioMsg(opts.transit ? `Mecanic ${t.id}` : 'Dispecer',
            opts.transit ? `Tranzităm în viteză ${NODES[t.currentNode].name}.` : `Liber pe secție spre ${NODES[next].name} pentru ${t.id}.`);
        if (!opts.transit && !opts.silent) this.queueReply(`Mecanic ${t.id}`, 'Recepționat, plecăm.');
        return { ok: true };
    },

    // Eliberează gâtuitura nodului odată ce trenul a "curățat macazurile" (la granița de bloc,
    // sau la o mică distanță pe linie simplă) — nodul rămâne liber pentru alte trasee.
    clearThroat(t) {
        if (t.throatCleared || !t.throatNode) return;
        this.releaseThroat(t.throatNode, t.id);
        t.throatCleared = true;
    },

    arriveAtStation(t) {
        const dot = t.domElement.querySelector('.train-dot');
        this.clearThroat(t);
        this.releaseTrainBlocks(t);
        t.currentNode = t.targetNode; t.targetNode = null; t.progress = 0;
        if (t.path[t.pathIndex + 1] === t.currentNode) t.pathIndex++;
        recordArrival(t, this.simTime);
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
            const res = (!t.willStop && next) ? this.attemptDeparture(t, next, { transit: true, silent: true }) : { ok: false };
            if (res.ok) {
                // tranzit reușit
            } else {
                t.state = 'IDLE'; t.speed = 0; t.dwell = t.dwellTime;
                dot.classList.add('waiting'); t.domElement.classList.remove('moving');
                if (!t.willStop && next) this.radioMsg(`Mecanic ${t.id}`, `Traseu ocupat la ${NODES[t.currentNode].name}, oprim la peron și așteptăm parcurs liber.`);
                else this.radioMsg(`Mecanic ${t.id}`, `Am oprit în ${NODES[t.currentNode].name}. Așteptăm parcurs.`);
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
            if (t.breakdownTimer > 5.0) {
                this.clearThroat(t); this.releaseTrainBlocks(t);
                t.state = 'DONE'; el.remove(); upd = true;
            }
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
                if (next && this.attemptDeparture(t, next, { silent: !!t.pendingNext }).ok) upd = true;
            }
            if (Math.random() < 0.01) upd = true;
            return upd;
        }

        el.classList.add('moving');

        if (t.state === 'BROKEN') {
            // trenul defect ține blocul ocupat — realist, blochează traficul din spate până la reparație
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
            const nextBlockKey = t.blockKeys && t.blockKeys[1];

            if (t.state === 'WAITING_SIGNAL_MID') {
                t.speed = t.currentSpeedKmh = 0;
                t.delayMinutes += dtSim / 60;
                if (Math.random() < 0.05) upd = true;
                const canTry = this.autoBLA || (sig && sig.state === 'GREEN');
                if (canTry && nextBlockKey && this.reserveBlock(nextBlockKey, t.id)) {
                    this.releaseBlock(t.blockKeys[0], t.id); t.blockIdx = 1;
                    this.clearThroat(t);
                    t.state = 'MOVING_TO_STATION';
                    dot.classList.remove('waiting');
                    if (sig && !this.autoBLA) this.setSignal(sig, false);
                    this.radioMsg(`Mecanic ${t.id}`, 'Avem semnal liber. Pornim.');
                    upd = true;
                }
            } else {
                if (t.state === 'MOVING_TO_STATION' && t.speed > 20 && this.minigamesEnabled && Math.random() < 0.00008) {
                    this.triggerBreakdown(t);
                    return true;
                }
                // dinamică: accelerează / frânează spre viteza țintă (SpeedModel citește starea semnalului/blocului)
                const r = computeTargetSpeed(this, t, ctx);
                t.limiter = r.limiter;
                const brakeF = this.currentWeather.brake ?? 1;
                if (t.speed < r.kmh) t.speed = Math.min(r.kmh, t.speed + t.accel * 2.5 * mt);
                else t.speed = Math.max(r.kmh, t.speed - t.decel * brakeF * 2.5 * mt);
                t.currentSpeedKmh = t.speed;
                t.progress += t.speed * r.rate * mt;

                if (t.state === 'MOVING_TO_SIGNAL') {
                    if (!t.throatCleared && t.progress >= THROAT_CLEAR_DOUBLE) this.clearThroat(t);
                    if (t.progress >= BLOCK_BOUNDARY) {
                        const canTry = this.autoBLA || (sig && sig.state === 'GREEN');
                        if (canTry && nextBlockKey && this.reserveBlock(nextBlockKey, t.id)) {
                            this.releaseBlock(t.blockKeys[0], t.id); t.blockIdx = 1;
                            t.state = 'MOVING_TO_STATION';
                            if (sig && !this.autoBLA) this.setSignal(sig, false);
                        } else {
                            t.progress = BLOCK_BOUNDARY; t.speed = t.currentSpeedKmh = 0;   // semnal roșu / bloc ocupat în față
                            t.state = 'WAITING_SIGNAL_MID';
                            dot.classList.add('waiting'); el.classList.remove('moving');
                            this.radioMsg(`Mecanic ${t.id}`, canTry ? 'Am oprit la semnal roșu — bloc ocupat în față. Așteptăm verde.' : 'Am oprit la semnal roșu intermediar. Așteptăm verde.');
                            upd = true;
                        }
                    }
                } else if (t.state === 'MOVING_TO_STATION') {
                    if (!t.throatCleared) {
                        const clr = edge.double ? THROAT_CLEAR_DOUBLE : THROAT_CLEAR_SINGLE;
                        if (t.progress >= clr) this.clearThroat(t);
                    }
                    if (t.progress >= 1.0 || (t.willStop && 1 - t.progress < 0.004 && t.speed < 15)) {
                        this.arriveAtStation(t);
                        return true;
                    }
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
    },

    // Recalculează aspectul semnalelor automate din ocuparea reală a blocurilor (o dată pe tură de buclă).
    // În modul MANUAL, dispecerul controlează culoarea prin click; ea rămâne validă doar dacă blocul e liber.
    refreshSignals() {
        for (const sig of this.signals) {
            const el = document.getElementById(sig.id);
            if (!el) continue;
            let aspect;
            if (!sig.isDouble) {
                // semnal decorativ pe linie simplă: reflectă ocuparea blocului comun, nu blochează trecerea
                aspect = this.blockFree(`${sig.edgeId}:S`) ? 'GREEN' : 'RED';
            } else if (this.autoBLA) {
                const key = `${sig.from}>${sig.to}:1`;
                if (!this.blockFree(key)) aspect = 'RED';
                else aspect = this.throatOccupants(sig.to) >= 1 ? 'YELLOW' : 'GREEN';
            } else {
                aspect = sig.state || 'RED';   // rămâne cum a fost setat manual
            }
            if (sig.state !== aspect) {
                sig.state = aspect;
                el.classList.remove('red', 'yellow', 'green');
                el.classList.add(aspect === 'GREEN' ? 'green' : aspect === 'YELLOW' ? 'yellow' : 'red');
            }
        }
    }
};
