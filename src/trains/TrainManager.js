import { NODES } from '../core/DataLoader.js';
import { getPath, reachableFrom } from '../dispatch/Routing.js';
import { randomCategory } from './TrainTypes.js';
import { createTrain } from './Train.js';
import { buildSchedule } from '../dispatch/Timetable.js';

export const TrainManagerMixin = {
    spawnTrain(forcedId = null, startNode = null) {
        const cat = randomCategory();
        // ID-uri PROCEDURALE (simulare), unice în rețea
        let id = forcedId;
        while (!id || this.trains.some(t => t.id === id)) id = `${cat.prefix} ${Math.floor(Math.random() * 9000) + 100}`;
        const region = this.activeRegion;   // în mod regiune, trenurile apar și circulă doar acolo
        const hubs = Object.keys(NODES).filter(k => NODES[k].hub && (!region || NODES[k].region === region));
        const start = (startNode && (!region || NODES[startNode].region === region)) ? startNode : hubs[Math.floor(Math.random() * hubs.length)];
        if (!start) return null;
        const dests = [...reachableFrom(start, region)].filter(n => NODES[n].hub && n !== start);
        if (!dests.length) return null;
        const dest = dests[Math.floor(Math.random() * dests.length)];
        const train = createTrain({ id, cat, start, dest, path: getPath(start, dest, region) });
        train.schedule = buildSchedule(train, this.simTime);

        const tDiv = document.createElement('div');
        tDiv.className = 'map-train';
        const dot = document.createElement('div'); dot.className = `train-dot ${cat.class} waiting`;
        const lbl = document.createElement('div'); lbl.className = 'train-label'; lbl.innerText = id;
        const speedTag = document.createElement('div'); speedTag.className = 'train-speed-tag'; speedTag.style.display = 'none';
        tDiv.append(dot, lbl, speedTag);
        document.getElementById('map-elements').appendChild(tDiv);
        train.domElement = tDiv;
        this.trains.push(train);

        const f = document.createElement('div');
        f.className = 'floating-label'; f.innerText = `+ ${id} (${NODES[start].name})`;
        f.style.left = `${NODES[start].x}px`; f.style.top = `${NODES[start].y - 30}px`;
        document.getElementById('map-elements').appendChild(f);
        setTimeout(() => f.remove(), 4000);

        this.showToast(`Nou: ${id} a apărut în ${NODES[start].name}. Rută finală: ${NODES[dest].name}.`);
        if (this.selectedNode === start) this.updateControlPanel();
        this.updateTimetable();
        return train;
    }
};
