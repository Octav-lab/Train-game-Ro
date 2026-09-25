import { NODES, EDGES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';

// NOTĂ: harta este o reprezentare SCHEMATICĂ de simulare (coordonatele nu sunt GIS reale).
export const MapRendererMixin = {
    drawMap() {
        const svg = document.getElementById('map-svg');
        const container = document.getElementById('map-elements');
        container.innerHTML = '';
        this.signals = [];
        let htmlSvg = '';
        const colorDouble = '#4B5563', colorSingle = '#9CA3AF';

        EDGES.forEach(edge => {
            const n1 = NODES[edge.from], n2 = NODES[edge.to];
            const dx = n2.x - n1.x, dy = n2.y - n1.y, dist = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / dist, ny = dx / dist, offsetAmt = 16.0;
            if (edge.double) {
                const ox = nx * offsetAmt, oy = ny * offsetAmt;
                htmlSvg += `<line class="rail" data-a="${edge.from}" data-b="${edge.to}" x1="${n1.x + ox}" y1="${n1.y + oy}" x2="${n2.x + ox}" y2="${n2.y + oy}" stroke="${colorDouble}" stroke-width="8"/>`;
                htmlSvg += `<line class="rail" data-a="${edge.from}" data-b="${edge.to}" x1="${n1.x - ox}" y1="${n1.y - oy}" x2="${n2.x - ox}" y2="${n2.y - oy}" stroke="${colorDouble}" stroke-width="8"/>`;
                this.createSignal({ ea: edge.from, eb: edge.to, id: `sig_${edge.from}_${edge.to}`, from: edge.from, to: edge.to, x: n1.x + dx * 0.5 + ox, y: n1.y + dy * 0.5 + oy, isDouble: true, offset: { ox, oy } });
                this.createSignal({ ea: edge.from, eb: edge.to, id: `sig_${edge.to}_${edge.from}`, from: edge.to, to: edge.from, x: n1.x + dx * 0.5 - ox, y: n1.y + dy * 0.5 - oy, isDouble: true, offset: { ox: -ox, oy: -oy } });
            } else {
                htmlSvg += `<line class="rail" data-a="${edge.from}" data-b="${edge.to}" x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}" stroke="${colorSingle}" stroke-width="8"/>`;
                this.createSignal({ ea: edge.from, eb: edge.to, id: `sig_${edge.id}`, from: null, to: null, edgeId: edge.id, x: n1.x + dx * 0.5, y: n1.y + dy * 0.5, isDouble: false });
            }
        });
        svg.innerHTML = htmlSvg;

        for (const key in NODES) {
            const n = NODES[key];
            const st = document.createElement('div');
            st.className = `map-station ${n.hub ? 'hub' : ''}`;
            st.id = `node-${key}`;
            st.style.left = `${n.x}px`; st.style.top = `${n.y}px`;
            const badge = document.createElement('div');
            badge.className = 'station-badge'; badge.id = `badge-${key}`;
            st.appendChild(badge);
            st.onclick = (e) => { e.stopPropagation(); this.selectNode(key); };
            container.appendChild(st);
            const lbl = document.createElement('div');
            lbl.className = 'map-station-label'; lbl.id = `label-${key}`;
            lbl.style.left = `${n.x}px`; lbl.style.top = `${n.y}px`;
            lbl.innerText = n.name;
            container.appendChild(lbl);
        }
    },

    createSignal(data) {
        const sigData = { ...data, state: 'RED' };
        this.signals.push(sigData);
        const sigDiv = document.createElement('div');
        sigDiv.className = 'map-signal red';
        sigDiv.id = sigData.id;
        sigDiv.style.left = `${sigData.x}px`; sigDiv.style.top = `${sigData.y}px`;
        sigDiv.onclick = (e) => {
            e.stopPropagation();
            AudioSys.playTone(800, 'sine', 0.1);
            if (!sigData.isDouble) { this.showToast('Semnal informativ (bloc unic pe linie simplă) — nu necesită liber manual.', 'info'); return; }
            if (this.autoBLA) { this.showToast('BLA AUTOMAT activ — semnalele se comandă singure din ocuparea blocurilor.', 'warn'); return; }
            const green = sigData.state !== 'GREEN';
            sigData.state = green ? 'GREEN' : 'RED';
            sigDiv.classList.remove('red', 'yellow', 'green'); sigDiv.classList.add(green ? 'green' : 'red');
        };
        document.getElementById('map-elements').appendChild(sigDiv);
    },

    drawDynamicPath(train) {
        const layer = document.getElementById('path-layer');
        layer.innerHTML = '';
        if (!train || !train.path || train.path.length < 2) return;
        const pts = train.path.map(id => `${NODES[id].x},${NODES[id].y}`).join(' ');
        layer.innerHTML = `<polyline points="${pts}" fill="none" stroke="#00ffff" stroke-width="4" stroke-dasharray="10,10" style="opacity:0.6; animation: dash 20s linear infinite;"/>`;
    },

    updateHighlights() {
        document.querySelectorAll('.map-train.highlighted').forEach(el => el.classList.remove('highlighted'));
        document.querySelectorAll('.map-station.target-highlight').forEach(el => el.classList.remove('target-highlight'));
        document.getElementById('path-layer').innerHTML = '';
        if (this.selectedTrainId) {
            const t = this.trains.find(tr => tr.id === this.selectedTrainId);
            if (t && t.domElement) {
                t.domElement.classList.add('highlighted');
                this.drawDynamicPath(t);
                if (t.destFinal) { const st = document.getElementById(`node-${t.destFinal}`); if (st) st.classList.add('target-highlight'); }
            }
        }
    }
};
