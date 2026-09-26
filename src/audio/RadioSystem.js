import { AudioSys } from './AudioManager.js';
import { NODES } from '../core/DataLoader.js';

// Radio CONTEXTUAL: fiecare mesaj generat aici pornește dintr-o stare reală de pe hartă
// (semnal roșu, defecțiune, întârziere efectivă) — nu mai există conversație aleatorie
// fără legătură cu situația trenurilor. Fiecare tren are un cooldown (`lastRadioReport`)
// ca să nu repete același raport în fiecare tură de buclă.
const REPORT_COOLDOWN_SEC = 25;

export const RadioMixin = {
    radioMsg(speaker, text) {
        AudioSys.radioBeep();
        const log = document.getElementById('radio-log');
        const msg = document.createElement('div');
        msg.className = 'radio-msg';
        const color = speaker === 'Dispecer' ? '#fff' : '#0ff';
        msg.innerHTML = `> <span style="color:${color}; font-weight:bold;">${speaker}:</span> ${text}`;
        log.appendChild(msg);
        if (log.childNodes.length > 6) log.firstChild.remove();
    },
    // Programează o replică ce urmează, cu o mică întârziere, un mesaj deja transmis (confirmare/răspuns).
    queueReply(speaker, text) { this.radioQueue.push({ speaker, text }); },
    handleRadioQueue() {
        if (this.radioQueue.length > 0 && Math.random() < 0.15) {
            const m = this.radioQueue.shift();
            this.radioMsg(m.speaker, m.text);
        }
    },

    generateStatusReports() {
        const now = this.simTime.getTime();
        const due = t => !t.suspended && (now - (t.lastRadioReport || 0)) / 1000 > REPORT_COOLDOWN_SEC;

        // 1) tren oprit la semnal roșu de un timp — raport periodic, nu doar la momentul opririi
        const waiting = this.trains.filter(t => t.state === 'WAITING_SIGNAL_MID' && due(t));
        if (waiting.length && Math.random() < 0.5) {
            const t = waiting[Math.floor(Math.random() * waiting.length)];
            t.lastRadioReport = now;
            this.radioMsg(`Mecanic ${t.id}`, `Tot pe roșu la intrarea în ${NODES[t.targetNode].name}, așteptăm liber.`);
            this.queueReply('Dispecer', `${t.id}, recepționat, urmărim secția.`);
            return;
        }
        // 2) tren defect — actualizare de progres a intervenției
        const broken = this.trains.filter(t => t.state === 'BROKEN' && due(t));
        if (broken.length && Math.random() < 0.4) {
            const t = broken[Math.floor(Math.random() * broken.length)];
            t.lastRadioReport = now;
            const loc = NODES[t.breakdownNode || t.currentNode].name;
            this.radioMsg(`Mecanic ${t.id}`, `Continuăm intervenția la locomotivă lângă ${loc}.`);
            return;
        }
        // 3) tren cu întârziere reală semnificativă (calculată din orar, nu inventată)
        const delayed = this.trains.filter(t => !t.suspended && t.state !== 'DONE' && t.delayMinutes >= 3 && due(t));
        if (delayed.length && Math.random() < 0.35) {
            const t = delayed[Math.floor(Math.random() * delayed.length)];
            t.lastRadioReport = now;
            this.radioMsg(`Mecanic ${t.id}`, `Dispecerat, ${t.id}, avem +${Math.floor(t.delayMinutes)} minute întârziere.`);
            this.queueReply('Dispecer', `${t.id}, recepționat, încercăm recuperare pe traseu.`);
            return;
        }
        // 4) fără nimic notabil de raportat: reamintire generică de dispecerat (nu afirmă nimic despre un tren anume)
        this.radioMsg('Dispecer', 'Atenție mecanici, respectați cu strictețe indicațiile semnalelor BLA pe magistrală.');
    }
};
