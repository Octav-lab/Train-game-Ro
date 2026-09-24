import { AudioSys } from '../audio/AudioManager.js';

export function startGame(game) {
    AudioSys.init();
    AudioSys.playTone(800, 'square', 0.1);
    const btn = document.getElementById('start-btn');
    const sub = document.querySelector('.menu-subtitle');
    const menu = document.getElementById('main-menu');
    btn.style.display = 'none';
    sub.innerHTML = 'Inițializare module SCADA...<br>Conectare la servere CFR...';
    setTimeout(() => {
        AudioSys.playTone(1200, 'square', 0.1);
        sub.innerHTML = 'Sincronizare trafic BLA... OK<br>Preluare control dispecerat... OK';
        setTimeout(() => {
            menu.style.opacity = '0';
            setTimeout(() => { menu.style.display = 'none'; game.init(); }, 1500);
        }, 1200);
    }, 1500);
}

export function toggleDispatcherPanel() {
    document.getElementById('map-panel-content').classList.toggle('hidden-content');
}
