import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { getNeighbors } from '../dispatch/Routing.js';

export const DispatcherPanelMixin = {
    selectNode(nodeId) {
        AudioSys.playTone(400, 'square', 0.1);
        if (this.selectedNode) { const p = document.getElementById(`node-${this.selectedNode}`); if (p) p.classList.remove('selected'); }
        this.selectedNode = nodeId; this.selectedTrainId = null;
        const c = document.getElementById(`node-${nodeId}`); if (c) c.classList.add('selected');
        this.updateControlPanel(); this.updateHighlights();
    },
    selectTrainInStation(trainId) {
        AudioSys.playTone(600, 'square', 0.1);
        this.selectedTrainId = trainId;
        this.updateControlPanel(); this.updateHighlights();
    },
    trainStatusText(t) {
        if (t.held) return '<span style="color:#ffeb3b">⏸ ținut de dispecer</span>';
        if (t.dwell > 0) return `oprire la peron (${Math.ceil(t.dwell)}s)`;
        if (t.pendingNext) return `<span style="color:#0f0">✔ rută programată → ${NODES[t.pendingNext].name}</span>`;
        return 'gata de plecare';
    },
    updateControlPanel() {
        const panel = document.getElementById('map-panel-content');
        if (!this.selectedNode) {
            panel.innerHTML = '<div style="color:#aaa; text-align:center; padding: 20px 0;"><em>Atingeți o stație pe hartă pentru a dirija trenurile parcate acolo.</em></div>';
            return;
        }
        const nodeName = NODES[this.selectedNode].name;
        const parked = this.trains.filter(t => t.currentNode === this.selectedNode && t.state === 'IDLE' && !t.suspended);
        let html = '';
        if (parked.length === 0) html += `<div style="color: #0f0; font-weight: bold; text-align:center; padding:15px;">Stația ${nodeName} e liberă.</div>`;
        else {
            html += `<div style="margin-bottom: 8px; font-weight: bold; color: #fff;">Garate în ${nodeName}:</div>`;
            parked.forEach(t => {
                const isActive = this.selectedTrainId === t.id ? 'active' : '';
                html += `<div class="train-select-btn ${isActive}" onclick="MapSystem.selectTrainInStation('${t.id}')">
                    🚂 <strong>${t.id}</strong> <span style="color:#aaa;">(${t.cat.desc})</span><br>
                    <span style="font-size:11px; font-weight:normal; color:#0ff;">Destinație: ${NODES[t.destFinal].name} · ${this.trainStatusText(t)}</span></div>`;
            });
            if (!this.selectedTrainId && parked.length > 0) { this.selectedTrainId = parked[0].id; this.updateHighlights(); }
            const active = parked.find(t => t.id === this.selectedTrainId);
            if (active) {
                html += `<div style="font-size:11px; color:#9cf; background:#10182a; border:1px solid #345; border-radius:4px; padding:6px 8px; margin-top:6px; line-height:1.5;">
                    ${active.operator} · ${active.locomotive}<br>${active.consist.text} · ${active.lengthM} m · ${active.massT} t<br>
                    max ${active.consist.maxSpeed} km/h · prioritate ${active.priority}/5 · întârziere +${Math.floor(active.delayMinutes)}m</div>`;
                html += `<div style="display:flex; gap:6px; margin-top:8px;">
                    <button class="route-btn" style="margin:0; background:${active.held ? '#ffeb3b' : '#ff9800'};" onclick="MapSystem.toggleHold('${active.id}')">${active.held ? '▶ Eliberează' : '⏸ Ține trenul'}</button>
                    ${active.pendingNext ? `<button class="route-btn" style="margin:0; background:#f66;" onclick="MapSystem.cancelRoute('${active.id}')">✖ Anulează ruta</button>` : ''}</div>`;
                html += `<div style="background: rgba(0, 255, 0, 0.1); border: 1px solid #0f0; padding: 10px; margin-top:10px; border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 8px; color:#0f0;">Trasează rută pt ${active.id}:</div>`;
                const nextInPath = (active.path && active.path.length > active.pathIndex + 1) ? active.path[active.pathIndex + 1] : null;
                getNeighbors(this.selectedNode, this.activeRegion).forEach(n => {
                    const isDest = n === active.destFinal ? ' (Destinație)' : '';
                    const rec = n === nextInPath ? '⭐ (Rută GPS)' : '';
                    html += `<button class="${rec ? 'route-btn gps-route' : 'route-btn'}" onclick="MapSystem.dispatchTrain('${active.id}', '${n}')">► Spre ${NODES[n].name}${isDest} ${rec}</button>`;
                });
                html += '</div>';
            }
        }
        panel.innerHTML = html;
    },
    // Stabilește ruta. Trenul pleacă imediat dacă a terminat oprirea și nu e ținut; altfel ruta rămâne programată.
    dispatchTrain(trainId, nextNode) {
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t || t.state !== 'IDLE' || t.suspended) return;
        if (this.activeRegion && NODES[nextNode].region !== this.activeRegion) return;
        AudioSys.dispatch();
        t.pendingNext = nextNode;
        if (t.held) this.showToast(`${t.id}: ruta spre ${NODES[nextNode].name} e programată; trenul e ținut.`, 'info');
        else if (t.dwell > 0) this.showToast(`${t.id}: pleacă spre ${NODES[nextNode].name} după oprirea la peron.`, 'info');
        else if (!this.attemptDeparture(t, nextNode).ok) this.showToast(`${t.id}: traseul spre ${NODES[nextNode].name} nu e liber acum — va pleca imediat ce se eliberează.`, 'warn');
        this.selectedTrainId = null;
        this.updateControlPanel(); this.updateHighlights(); this.updateTimetable();
    },
    cancelRoute(trainId) {
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t || t.state !== 'IDLE') return;
        t.pendingNext = null;
        this.showToast(`${t.id}: ruta programată a fost anulată.`, 'info');
        this.updateControlPanel(); this.updateTimetable();
    },
    toggleHold(trainId) {
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t || t.state !== 'IDLE') return;
        AudioSys.dispatch();
        t.held = !t.held;
        this.radioMsg('Dispecer', t.held ? `${t.id}, mențineți poziția. Revin cu instrucțiuni.` : `${t.id}, eliberat. Puteți pleca.`);
        this.queueReply(`Mecanic ${t.id}`, 'Recepționat.');
        this.updateControlPanel(); this.updateTimetable();
    }
};
