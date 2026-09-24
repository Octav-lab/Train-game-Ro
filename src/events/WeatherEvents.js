export const WeatherMixin = {
    changeWeather() {
        const states = [
            { id: 'CLEAR', name: '☀️ Senin', restr: 'Trafic Deschis (100%)', speed: 1.0, brake: 1.0, color: '#0f0' },
            { id: 'RAIN', name: '🌧️ Ploaie', restr: 'Aderență scăzută (Viteză 80%)', speed: 0.8, brake: 0.85, color: '#0ff' },
            { id: 'HEAT', name: '🔥 Caniculă', restr: 'Dilatare șină (BAR: Viteză 60%)', speed: 0.6, brake: 1.0, color: '#ff5722' },
            { id: 'SNOW', name: '❄️ Viscol', restr: 'Condiții grele (BAR: Viteză 50%)', speed: 0.5, brake: 0.65, color: '#fff' }
        ];
        const r = Math.random();
        let chosen = states[0];
        if (r > 0.6 && r <= 0.8) chosen = states[1];
        else if (r > 0.8 && r <= 0.9) chosen = states[2];
        else if (r > 0.9) chosen = states[3];
        this.currentWeather = chosen;
        document.getElementById('sys-weather').innerText = chosen.name;
        const el = document.getElementById('sys-restr');
        el.innerText = chosen.restr; el.style.color = chosen.color;
        if (chosen.id !== 'CLEAR') this.showToast(`AVERTIZARE: ${chosen.name}. S-au impus restricții B.A.R!`, 'warn');
    }
};
