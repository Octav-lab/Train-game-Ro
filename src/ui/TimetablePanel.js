import { NODES } from '../core/DataLoader.js';

export const TimetablePanelMixin = {
    updateTimetable() {
        const list = document.getElementById('timetable-list');
        const active = this.trains.filter(t => t.state !== 'DONE' && t.state !== 'CRASHED' && !t.suspended);
        const title = document.getElementById('tt-title');
        if (title) title.innerText = this.activeRegion ? `TRENURI — ${this.activeRegion.toUpperCase()}` : 'SITUAȚIE TRENURI (LIVE)';
        document.getElementById('active-trains-count').innerText = `${active.length} Trenuri`;
        if (active.length === 0) { list.innerHTML = '<div style="padding: 10px; text-align: center; color: #888;">Niciun tren în rețea.</div>'; return; }
        let html = '';
        active.forEach(t => {
            const delay = t.delayMinutes > 0 ? `<span class="tt-delay">+${Math.floor(t.delayMinutes)}m</span>` : '<span class="tt-ontime">La timp</span>';
            let loc = t.state === 'IDLE' ? `Oprit în ${NODES[t.currentNode].name}${t.held ? ' ⏸' : ''}` : `Spre ${t.targetNode ? NODES[t.targetNode].name : '...'}`;
            if (t.state === 'BROKEN') loc = '<span style="color:#ffeb3b">DEFECT SECȚIE</span>';
            html += `<div class="tt-row">
                <div style="flex: 1; cursor:pointer;" onclick="MapSystem.focusTrain('${t.id}')"><strong>${t.id}</strong> ➔ ${NODES[t.destFinal].name}</div>
                <div style="flex: 1; color:#aaa; cursor:pointer;" onclick="MapSystem.focusTrain('${t.id}')">${loc}</div>
                <div style="width: 42px; text-align:right;">${delay}</div>
                <div style="width: 22px; text-align:center; cursor:pointer;" title="Orar" onclick="event.stopPropagation(); MapSystem.showSchedule('${t.id}')">📅</div></div>`;
        });
        list.innerHTML = html;
    }
};
