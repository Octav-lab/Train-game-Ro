import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';

export const RepairMinigameMixin = {
    openNextMinigame() {
        if (this.breakdownQueue.length === 0) {
            this.minigame.active = false;
            document.getElementById('pause-banner').classList.remove('show');
            return;
        }
        const trainId = this.breakdownQueue.shift();
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t || t.state !== 'BROKEN') { this.openNextMinigame(); return; }

        const mg = this.minigame;
        mg.active = true; mg.trainId = trainId; mg.progress = 0; mg.playerIndex = 0; mg.showingSequence = true;
        const seqLen = Math.min(7, 4 + Math.floor(mg.fixedCount / 2));
        const pool = [...this.TOOL_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
        mg.iconSet = pool; mg.sequence = [];
        for (let i = 0; i < seqLen; i++) mg.sequence.push(pool[Math.floor(Math.random() * pool.length)]);
        mg.timeMax = 12 + seqLen * 2; mg.timeLeft = mg.timeMax;

        document.getElementById('pause-banner').classList.add('show');
        document.getElementById('minigame-train-info').innerText = `Trenul ${trainId} este defect lângă ${NODES[t.breakdownNode].name}.`;
        document.getElementById('minigame-progress-bar').style.width = '0%';
        const st = document.getElementById('minigame-status');
        st.innerText = 'Urmărește ordinea sculelor...'; st.style.color = '#ffeb3b';
        const timerBar = document.getElementById('minigame-timer-bar');
        timerBar.style.width = '100%'; timerBar.style.background = '#ffeb3b';
        document.getElementById('mg-fixed-count').innerText = mg.fixedCount;
        document.getElementById('mg-fail-count').innerText = mg.failCount;
        document.getElementById('mg-streak').innerText = mg.streak;
        document.getElementById('mg-best-streak').innerText = mg.bestStreak;
        document.getElementById('minigame-overlay').classList.add('show');

        const grid = document.getElementById('minigame-toolgrid');
        grid.innerHTML = '';
        pool.forEach(icon => {
            const btn = document.createElement('button');
            btn.className = 'mg-tool-btn locked'; btn.innerText = icon;
            btn.onclick = () => this.minigameTap(icon, btn);
            grid.appendChild(btn);
        });
        const seqDisplay = document.getElementById('minigame-sequence-display');
        seqDisplay.innerHTML = '';
        mg.sequence.forEach(() => {
            const slot = document.createElement('div');
            slot.className = 'mg-seq-icon'; slot.innerText = '?';
            seqDisplay.appendChild(slot);
        });
        this.playSequenceDemo(trainId);
        this.startMinigameTimer(trainId);
    },

    playSequenceDemo(trainId) {
        const seq = this.minigame.sequence;
        const slots = document.querySelectorAll('#minigame-sequence-display .mg-seq-icon');
        let i = 0;
        const showNext = () => {
            if (!this.minigame.active || this.minigame.trainId !== trainId) return;
            if (i > 0) { slots[i - 1].classList.remove('lit'); slots[i - 1].innerText = seq[i - 1]; }
            if (i >= seq.length) {
                this.minigame.showingSequence = false;
                document.querySelectorAll('.mg-tool-btn').forEach(b => b.classList.remove('locked'));
                document.getElementById('minigame-status').innerText = 'Acum apasă sculele în aceeași ordine!';
                return;
            }
            slots[i].classList.add('lit');
            AudioSys.playTone(500 + i * 40, 'sine', 0.15, 0.08);
            i++;
            setTimeout(showNext, 550);
        };
        setTimeout(showNext, 500);
    },

    startMinigameTimer(trainId) {
        const timerBar = document.getElementById('minigame-timer-bar');
        let last = performance.now();
        const tick = (ts) => {
            if (!this.minigame.active || this.minigame.trainId !== trainId) return;
            const dt = (ts - last) / 1000; last = ts;
            this.minigame.timeLeft -= dt;
            const pct = Math.max(0, (this.minigame.timeLeft / this.minigame.timeMax) * 100);
            timerBar.style.width = pct + '%';
            timerBar.style.background = pct < 30 ? '#ff3333' : (pct < 60 ? '#ff9800' : '#ffeb3b');
            if (this.minigame.timeLeft <= 0) { this.finishMinigame(false, true); return; }
            this.minigame.loopId = requestAnimationFrame(tick);
        };
        this.minigame.loopId = requestAnimationFrame(tick);
    },

    minigameTap(icon, btnEl) {
        const mg = this.minigame;
        if (!mg.active || mg.showingSequence) return;
        AudioSys.init();
        const expected = mg.sequence[mg.playerIndex];
        const statusEl = document.getElementById('minigame-status');
        if (icon === expected) {
            AudioSys.hit();
            btnEl.classList.add('correct'); setTimeout(() => btnEl.classList.remove('correct'), 200);
            mg.playerIndex++;
            mg.progress = Math.round((mg.playerIndex / mg.sequence.length) * 100);
            document.getElementById('minigame-progress-bar').style.width = mg.progress + '%';
            statusEl.innerText = `✔ Corect! (${mg.playerIndex}/${mg.sequence.length})`; statusEl.style.color = '#0f0';
            if (mg.playerIndex >= mg.sequence.length) this.finishMinigame(true, false);
        } else {
            AudioSys.miss();
            btnEl.classList.add('wrong'); setTimeout(() => btnEl.classList.remove('wrong'), 300);
            mg.streak = 0; document.getElementById('mg-streak').innerText = 0;
            mg.playerIndex = 0; mg.progress = 0;
            document.getElementById('minigame-progress-bar').style.width = '0%';
            mg.timeLeft = Math.max(2, mg.timeLeft - 3);
            statusEl.innerText = '✘ Greșit! Reia secvența de la început.'; statusEl.style.color = '#f55';
        }
    },

    finishMinigame(success, timedOut) {
        const mg = this.minigame, trainId = mg.trainId;
        const t = this.trains.find(tr => tr.id === trainId);
        cancelAnimationFrame(mg.loopId);
        document.getElementById('minigame-overlay').classList.remove('show');
        document.getElementById('pause-banner').classList.remove('show');
        if (t && t.state === 'BROKEN') {
            if (success) {
                t.breakdownTimer = 0;
                mg.fixedCount++; mg.streak++;
                if (mg.streak > mg.bestStreak) mg.bestStreak = mg.streak;
                const bonus = Math.min(120, mg.streak * 15);
                this.radioMsg(`Mecanic ${t.id}`, 'Reparație finalizată la fața locului! Continuăm parcursul.');
                this.showToast(`✔ ${t.id} reparat! +${60 + bonus}p (streak x${mg.streak})`, 'success');
                this.updateScore(60 + bonus);
            } else {
                mg.failCount++; mg.streak = 0;
                const reduction = (mg.progress / 100) * t.breakdownTimer;
                t.breakdownTimer = Math.max(3, t.breakdownTimer - reduction);
                this.radioMsg(`Mecanic ${t.id}`, 'Nu am terminat reparația la timp, continuăm manual echipa de intervenție.');
                this.showToast(`⏱ Timp expirat la ${t.id} — reparație parțială (${Math.round(mg.progress)}%).`, 'warn');
            }
            if (t.breakdownNode) this.showBrokenBadge(t.breakdownNode, false);
        }
        mg.active = false; mg.trainId = null;
        this.lastTime = performance.now();
        setTimeout(() => this.openNextMinigame(), 400);
    }
};
