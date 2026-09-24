import { NODES } from '../core/DataLoader.js';

export const FailuresMixin = {
    triggerBreakdown(train) {
        this.breakdownsCount = (this.breakdownsCount || 0) + 1;
        const bd = document.getElementById('sys-breakdowns');
        if (bd) bd.innerText = this.breakdownsCount;
        train.state = 'BROKEN';
        train.speed = 0; train.currentSpeedKmh = 0;   // simplificare: oprire imediată
        train.breakdownTimer = 30;
        train.breakdownNode = train.currentNode;
        this.radioMsg(`Mecanic ${train.id}`, 'URGENT: Defecțiune tehnică pe secție. Oprim. Cerem locomotivă de ajutor.');
        train.domElement.querySelector('.train-dot').classList.add('broken');
        this.showBrokenBadge(train.breakdownNode, true);
        this.showToast(`⚠ DEFECȚIUNE: ${train.id} s-a defectat lângă ${NODES[train.breakdownNode].name}!`, 'error');
        this.breakdownQueue.push(train.id);
        if (!this.minigame.active) this.openNextMinigame();
    },
    showBrokenBadge(nodeId, on) {
        const badge = document.getElementById(`badge-${nodeId}`);
        if (!badge) return;
        if (on) { badge.classList.add('broken-alert'); badge.innerText = '⚠'; badge.style.opacity = '1'; }
        else if (!this.trains.some(t => t.state === 'BROKEN' && t.breakdownNode === nodeId)) badge.classList.remove('broken-alert');
    }
};
