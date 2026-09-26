import { NODES } from './DataLoader.js';
import { NotificationsMixin } from '../ui/Notifications.js';
import { RadioMixin } from '../audio/RadioSystem.js';
import { WeatherMixin } from '../events/WeatherEvents.js';
import { FailuresMixin } from '../events/Failures.js';
import { RepairMinigameMixin } from '../minigames/RepairMinigame.js';
import { MapRendererMixin } from '../map/MapRenderer.js';
import { MapControllerMixin } from '../map/MapController.js';
import { DispatcherPanelMixin } from '../ui/DispatcherPanel.js';
import { TimetablePanelMixin } from '../ui/TimetablePanel.js';
import { TrainManagerMixin } from '../trains/TrainManager.js';
import { TrainAIMixin } from '../trains/TrainAI.js';
import { BlockSystemMixin } from '../dispatch/BlockSystem.js';
import { InterlockingMixin } from '../dispatch/Interlocking.js';
import { RegionsMixin } from '../map/Regions.js';
import { SchedulePanelMixin } from '../ui/SchedulePanel.js';

// Game = starea simulării + bucla principală. Restul logicii e în mixin-uri
// (Object.assign), astfel încât fiecare modul rămâne mic și `this` = Game.
export const Game = {
    trains: [], signals: [], blocks: new Map(), nodeRoutes: new Map(),
    selectedNode: null, selectedTrainId: null, activeRegion: null,
    score: 0, autoBLA: false, autoRoute: false, minigamesEnabled: true, simSpeedMultiplier: 4,
    restrictions: {},   // restricții temporare de viteză { idTronson: km/h } (populate de evenimente)
    lastTime: 0, spawnTimer: 0, animReq: null,
    simTime: new Date(), weatherTimer: 0, currentWeather: { id: 'CLEAR', speed: 1.0, brake: 1.0 },
    mapOffsetX: -3200, mapOffsetY: -3500, zoom: 0.35,
    isDragging: false, dragStartX: 0, dragStartY: 0,
    radioQueue: [], breakdownQueue: [], breakdownsCount: 0, completedCount: 0,
    TOOL_POOL: ['🔧', '⚙️', '🔩', '⚡', '🪛', '🔌', '🛠️', '🔦'],
    minigame: {
        active: false, trainId: null, progress: 0, loopId: null, timeLeft: 15, timeMax: 15,
        fixedCount: 0, failCount: 0, streak: 0, bestStreak: 0,
        sequence: [], iconSet: [], playerIndex: 0, showingSequence: true
    },

    init() {
        this.simTime.setHours(19, 58, 0);
        this.updateTransform();
        this.drawMap();
        this.setupTouchAndMouse();
        this.buildRegionBar();
        ['SV', 'PAS', 'CJ', 'VD', 'BNO', 'CTA', 'BVR', 'ARA'].forEach(loc => this.spawnTrain(null, loc));
        this.lastTime = performance.now();
        this.animReq = requestAnimationFrame((ts) => this.loop(ts));
        this.showToast('Sistem BLA Regional conectat.', 'success');
    },

    // Deschide/închide semnalul unui tronson
    setSignal(sig, green) {
        sig.state = green ? 'GREEN' : 'RED';
        const el = document.getElementById(sig.id);
        if (el) { el.classList.toggle('green', green); el.classList.toggle('red', !green); }
    },
    findSignal(edge, from, to) {
        return edge.double ? this.signals.find(s => s.from === from && s.to === to) : this.signals.find(s => s.edgeId === edge.id);
    },
    speedRestrictionFor(edgeId) { const v = this.restrictions[edgeId]; return v == null ? null : v; },

    loop(timestamp) {
        if (this.minigame.active) {
            this.lastTime = timestamp;
            this.animReq = requestAnimationFrame((ts) => this.loop(ts));
            return;
        }
        let realDt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (realDt > 0.1) realDt = 0.016;
        const dtSim = realDt * this.simSpeedMultiplier;
        const mt = realDt * (this.simSpeedMultiplier / 10);   // timp de mișcare

        this.simTime.setSeconds(this.simTime.getSeconds() + dtSim);
        document.getElementById('sys-time').innerText = this.simTime.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
        const hour = this.simTime.getHours();
        document.getElementById('map-wrapper').classList.toggle('night-mode', hour >= 20 || hour < 6);

        this.weatherTimer += dtSim;
        if (this.weatherTimer > 3600) { this.weatherTimer = 0; this.changeWeather(); }
        this.spawnTimer += dtSim;
        if (this.spawnTimer > 600 && this.activeTrainCount() < this.trainCap() && this.trains.length < 60) { this.spawnTimer = 0; this.spawnTrain(); }

        this.handleRadioQueue();
        if (Math.random() < 0.001 * this.simSpeedMultiplier) this.generateStatusReports();

        const stationCounts = {};
        for (const key in NODES) stationCounts[key] = 0;
        let needsTimetableUpdate = false;
        for (const t of this.trains) if (this.stepTrain(t, dtSim, realDt, mt, null, stationCounts)) needsTimetableUpdate = true;
        this.refreshSignals();

        for (const key in NODES) {
            const badge = document.getElementById(`badge-${key}`);
            if (!badge || badge.classList.contains('broken-alert')) continue;
            const count = stationCounts[key];
            if (count > 0) { badge.innerText = count; badge.style.opacity = '1'; } else badge.style.opacity = '0';
        }
        if (needsTimetableUpdate) this.updateTimetable();
        this.trains = this.trains.filter(t => t.state !== 'DONE');
        this.animReq = requestAnimationFrame((ts) => this.loop(ts));
    }
};

Object.assign(Game, NotificationsMixin, RadioMixin, WeatherMixin, FailuresMixin, RepairMinigameMixin,
    MapRendererMixin, MapControllerMixin, DispatcherPanelMixin, TimetablePanelMixin, TrainManagerMixin, TrainAIMixin, RegionsMixin, BlockSystemMixin, InterlockingMixin, SchedulePanelMixin);
