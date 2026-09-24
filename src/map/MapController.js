import { NODES } from '../core/DataLoader.js';
import { AudioSys } from '../audio/AudioManager.js';
import { findEdge } from '../dispatch/Routing.js';

const UI_SELECTOR = '#map-control-panel, .map-zoom-controls, #radio-panel, #timetable-panel, .map-signal';

export const MapControllerMixin = {
    setupTouchAndMouse() {
        const wrapper = document.getElementById('map-wrapper');
        wrapper.addEventListener('mousedown', (e) => {
            if (e.target.closest(UI_SELECTOR)) return;
            this.isDragging = true; this.dragStartX = e.clientX; this.dragStartY = e.clientY;
            wrapper.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.mapOffsetX += (e.clientX - this.dragStartX) / this.zoom;
            this.mapOffsetY += (e.clientY - this.dragStartY) / this.zoom;
            this.dragStartX = e.clientX; this.dragStartY = e.clientY;
            this.updateTransform();
        });
        window.addEventListener('mouseup', () => { this.isDragging = false; wrapper.style.cursor = 'grab'; });
        wrapper.addEventListener('mouseleave', () => { this.isDragging = false; wrapper.style.cursor = 'grab'; });
        wrapper.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(e.deltaY < 0 ? 0.05 : -0.05); }, { passive: false });

        wrapper.addEventListener('touchstart', (e) => {
            AudioSys.init();
            if (e.target.closest(UI_SELECTOR)) return;
            if (e.touches.length === 1) { this.isDragging = true; this.dragStartX = e.touches[0].clientX; this.dragStartY = e.touches[0].clientY; }
        }, { passive: false });
        wrapper.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            e.preventDefault();
            this.mapOffsetX += (e.touches[0].clientX - this.dragStartX) / this.zoom;
            this.mapOffsetY += (e.touches[0].clientY - this.dragStartY) / this.zoom;
            this.dragStartX = e.touches[0].clientX; this.dragStartY = e.touches[0].clientY;
            this.updateTransform();
        }, { passive: false });
        wrapper.addEventListener('touchend', () => { this.isDragging = false; });
    },

    setZoom(delta) {
        this.zoom = Math.min(2.0, Math.max(0.15, this.zoom + delta));
        this.updateTransform();
    },

    updateTransform() {
        document.getElementById('map-content').style.transform = `scale(${this.zoom}) translate(${this.mapOffsetX}px, ${this.mapOffsetY}px)`;
    },

    focusTrain(trainId) {
        const t = this.trains.find(tr => tr.id === trainId);
        if (!t) return;
        AudioSys.playTone(400, 'square', 0.1);
        let px, py;
        if (t.state === 'IDLE') {
            px = NODES[t.currentNode].x; py = NODES[t.currentNode].y;
            this.selectNode(t.currentNode); this.selectTrainInStation(trainId);
        } else if (t.targetNode) {
            const n1 = NODES[t.currentNode], n2 = NODES[t.targetNode];
            px = n1.x + (n2.x - n1.x) * t.progress; py = n1.y + (n2.y - n1.y) * t.progress;
            const edge = findEdge(t.currentNode, t.targetNode);
            if (edge && edge.double) {
                const dx = n2.x - n1.x, dy = n2.y - n1.y, dist = Math.sqrt(dx * dx + dy * dy);
                px += (-dy / dist) * 16.0; py += (dx / dist) * 16.0;
            }
        } else { px = NODES[t.currentNode].x; py = NODES[t.currentNode].y; }

        const wrapper = document.getElementById('map-wrapper');
        this.mapOffsetX = (wrapper.clientWidth / 2) / this.zoom - px;
        this.mapOffsetY = (wrapper.clientHeight / 2) / this.zoom - py;
        this.updateTransform();
        if (t.domElement) {
            t.domElement.classList.add('highlighted');
            setTimeout(() => { if (this.selectedTrainId !== t.id) t.domElement.classList.remove('highlighted'); }, 2500);
        }
    }
};
