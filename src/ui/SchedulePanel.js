import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { scheduleView } from '../dispatch/Timetable.js';

export const SchedulePanelMixin = {
    showSchedule(trainId) {
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t) return;
        AudioSys.playTone(500, 'sine', 0.08);
        document.getElementById('schedule-title').innerText = `${t.id} — ${NODES[t.origin].name} → ${NODES[t.destFinal].name}`;
        document.getElementById('schedule-sub').innerText = `${t.operator} · ${t.locomotive} · ${t.consist.text} · orar SIMULAT (estimat, nu date reale CFR)`;
        const rows = scheduleView(t, this.simTime);
        let html = '';
        rows.forEach(r => {
            if (!r.willStop && !r.isCurrent && r.delay === null) return;   // ascunde tranzitele fără oprire din listă (linie continuă)
            const delayHtml = r.delay === null ? '<span class="sch-pending">—</span>'
                : r.delay <= 0 ? `<span class="sch-ontime">${r.delay === 0 ? '0' : r.delay}</span>`
                : `<span class="sch-delay">+${r.delay}</span>`;
            html += `<div class="sch-row ${r.isCurrent ? 'sch-current' : ''} ${r.isPast ? 'sch-past' : ''}">
                <div class="sch-station">${r.name}${!r.willStop ? ' <em>(tranzit)</em>' : ''}</div>
                <div class="sch-time">${r.time}</div>
                <div class="sch-delaycol">${delayHtml}</div></div>`;
        });
        document.getElementById('schedule-rows').innerHTML = html || '<div style="color:#888;padding:10px;text-align:center;">Orar indisponibil.</div>';
        document.getElementById('schedule-overlay').classList.add('show');
    },
    hideSchedule() { document.getElementById('schedule-overlay').classList.remove('show'); }
};
