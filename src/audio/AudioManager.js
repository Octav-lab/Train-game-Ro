export const AudioSys = {
    ctx: null,
    muted: false,
    init() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { console.warn('[AUDIO] Web Audio indisponibil'); return; }
        this.ctx = new Ctx();
    },
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx || this.muted) return;
        try {
            const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    },
    radioBeep() { this.playTone(900, 'square', 0.1, 0.05); setTimeout(() => this.playTone(1200, 'square', 0.15, 0.05), 100); },
    dispatch() { this.playTone(600, 'triangle', 0.2, 0.1); },
    error() { this.playTone(200, 'sawtooth', 0.5, 0.2); setTimeout(() => this.playTone(150, 'sawtooth', 0.5, 0.2), 200); },
    success() { this.playTone(400, 'sine', 0.2, 0.1); setTimeout(() => this.playTone(600, 'sine', 0.2, 0.1), 200); setTimeout(() => this.playTone(800, 'sine', 0.4, 0.1), 400); },
    hit() { this.playTone(500, 'square', 0.08, 0.08); },
    miss() { this.playTone(120, 'sawtooth', 0.15, 0.12); }
};
