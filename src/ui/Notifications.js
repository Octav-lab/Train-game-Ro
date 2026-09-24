import { AudioSys } from '../audio/AudioManager.js';

// Mixin: metodele folosesc `this` = Game
export const NotificationsMixin = {
    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 6000);
    },
    updateScore(points) {
        this.score += points;
        document.getElementById('sys-score').innerText = this.score;
        if (points > 0) AudioSys.success();
    },
    toggleMute() {
        AudioSys.muted = !AudioSys.muted;
        const btn = document.getElementById('mute-btn');
        if (AudioSys.muted) { btn.innerText = '🔇 OFF'; btn.classList.remove('auto'); }
        else { btn.innerText = '🔊 ON'; btn.classList.add('auto'); AudioSys.init(); }
    },
    toggleAutoBLA() {
        this.autoBLA = !this.autoBLA;
        const btn = document.getElementById('bla-mode-btn');
        if (this.autoBLA) { btn.innerText = 'AUTOMAT'; btn.classList.add('auto'); this.showToast('Modul AUTOMAT activat. Trenurile trec liber de semafoare.', 'warn'); }
        else { btn.innerText = 'MANUAL'; btn.classList.remove('auto'); this.showToast('Modul MANUAL activat. Dispecerul controlează semafoarele!', 'info'); }
    },
    toggleAutoRoute() {
        this.autoRoute = !this.autoRoute;
        const btn = document.getElementById('route-mode-btn');
        if (this.autoRoute) { btn.innerText = 'AUTO'; btn.classList.add('auto'); this.showToast('Rută AUTO: trenurile pleacă singure pe ruta GPS după oprire.', 'warn'); }
        else { btn.innerText = 'MANUAL'; btn.classList.remove('auto'); this.showToast('Rută MANUAL: dispecerul dirijează fiecare tren.', 'info'); }
    },
    toggleMinigames() {
        this.minigamesEnabled = !this.minigamesEnabled;
        const btn = document.getElementById('minigame-btn');
        if (this.minigamesEnabled) { btn.innerText = 'ON'; btn.classList.add('auto'); this.showToast('Evenimentele de avarie (Minigame) sunt ACTIVATE.', 'warn'); }
        else { btn.innerText = 'OFF'; btn.classList.remove('auto'); this.showToast('Mod Sandbox. Avariile sunt DEZACTIVATE.', 'success'); }
    }
};
