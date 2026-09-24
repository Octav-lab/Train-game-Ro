import { loadData } from './core/DataLoader.js';
import { Game } from './core/Game.js';
import { AudioSys } from './audio/AudioManager.js';
import { startGame, toggleDispatcherPanel } from './ui/MainMenu.js';

// Handler-ele inline din HTML (onclick="MapSystem...") au nevoie de globals.
window.MapSystem = Game;
window.toggleDispatcherPanel = toggleDispatcherPanel;

document.body.addEventListener('touchstart', () => AudioSys.init(), { once: true });
document.body.addEventListener('mousedown', () => AudioSys.init(), { once: true });

const btn = document.getElementById('start-btn');
const err = document.getElementById('menu-error');

loadData('.').then(info => {
    btn.disabled = false;
    btn.innerText = '▶ ÎNCEPE TURA';
    btn.onclick = () => startGame(Game);
    if (info.warnings.length) err.innerText = 'Avertismente date:\n' + info.warnings.join('\n');
}).catch(e => {
    btn.innerText = '✖ EROARE DATE';
    err.innerText = String(e.message || e) + '\n\n(Rulează printr-un server local: npm start — fetch() nu merge pe file://)';
    console.error(e);
});
