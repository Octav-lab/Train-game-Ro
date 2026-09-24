import { AudioSys } from './AudioManager.js';

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
    handleRadioQueue() {
        if (this.radioQueue.length > 0 && Math.random() < 0.1) {
            const m = this.radioQueue.shift();
            this.radioMsg(m.speaker, m.text);
        }
    },
    generateRandomChatter() {
        const active = this.trains.filter(t => t.state === 'MOVING_TO_SIGNAL' || t.state === 'MOVING_TO_STATION');
        if (active.length < 2) return;
        const r = Math.random(), t1 = active[Math.floor(Math.random() * active.length)];
        if (r < 0.3) this.radioMsg(`Mecanic ${t1.id}`, 'Am trecut semaforul, avem liber în față.');
        else if (r < 0.6) {
            const t2 = active[Math.floor(Math.random() * active.length)];
            if (t1 !== t2) {
                this.radioMsg(`Mecanic ${t1.id}`, `Salutări colegului de pe ${t2.id} din mers! Drum bun!`);
                this.radioQueue.push({ speaker: `Mecanic ${t2.id}`, text: `Recepționat ${t1.id}, toate bune și vouă!` });
            }
        } else this.radioMsg('Dispecer', 'Atenție mecanici, respectați cu strictețe indicațiile semnalelor BLA pe magistrală.');
    }
};
