const socket = io("http://localhost:3000");
const API_URL = "http://localhost:3000";

// Chart instances – destroy before re-render
const _charts = {};
function _destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ─── Voice Engine ────────────────────────────────────────────────────────────
function announce(ward) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`Attention! Request from Ward ${ward}`);
        msg.rate = 0.95;
        window.speechSynthesis.speak(msg);
    }
}

// ─── View Controller ─────────────────────────────────────────────────────────
function switchView(view) {
    const views = ['active', 'history', 'analytics'];
    const subtitles = {
        active:    'Real-time nurse call monitoring',
        history:   'Completed call log',
        analytics: 'Performance & usage insights'
    };
    const titles = {
        active:    'Active Requests',
        history:   'History',
        analytics: 'Analytics'
    };

    views.forEach(v => {
        document.getElementById(`${v}-section`).classList.add('d-none');
        document.getElementById(`nav-${v}`).classList.remove('active');
    });

    document.getElementById(`${view}-section`).classList.remove('d-none');
    document.getElementById(`nav-${view}`).classList.add('active');
    document.getElementById('view-title').innerText    = titles[view];
    document.getElementById('view-subtitle').innerText = subtitles[view];

    const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('mobileMenu'));
    if (offcanvas) offcanvas.hide();

    if (view === 'analytics') renderAnalytics();
}

// ─── Real-time Listeners ─────────────────────────────────────────────────────
socket.on("new-request", (data) => {
    refreshData();
    announce(data.ward_number);
});

socket.on("request-update", (data) => {
    const card = document.getElementById(`card-ward-${data.ward_number}`);
    if (card) {
        card.classList.remove('state-active');
        card.classList.add('state-completed-flash');
        const badge = card.querySelector('.ward-badge');
        if (badge) { badge.className = 'ward-badge badge-completed'; badge.textContent = 'RESOLVED'; }
        setTimeout(refreshData, 1200);
    } else {
        refreshData();
    }
});

// ─── Data Fetch ───────────────────────────────────────────────────────────────
async function refreshData() {
    const [activeRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/active`),
        fetch(`${API_URL}/history`)
    ]);
    renderActive(await activeRes.json());
    renderHistory(await historyRes.json());
}

// ─── Render Active ────────────────────────────────────────────────────────────
function renderActive(data) {
    const container = document.getElementById('active-list');
    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <div class="empty-title">All clear</div>
                <div class="empty-sub">No active nurse calls at this time</div>
            </div>`;
        return;
    }
    container.innerHTML = data.map(req => `
        <div class="ward-card state-active" id="card-ward-${req.ward_number}">
            <div class="ward-card-inner">
                <div class="ward-info">
                    <div class="ward-number"><span>WARD</span>${req.ward_number}</div>
                    <div class="ward-timestamp">Called at ${new Date(req.sender_time).toLocaleTimeString()}</div>
                </div>
                <span class="ward-badge badge-active">ACTIVE</span>
            </div>
        </div>
    `).join('');
}

// ─── Render History ───────────────────────────────────────────────────────────
function renderHistory(data) {
    const container = document.getElementById('history-list');
    if (data.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No history yet</div></div>`;
        return;
    }
    container.innerHTML = data.map(req => {
        const duration = req.total_time >= 60
            ? `${Math.floor(req.total_time / 60)}m ${Math.round(req.total_time % 60)}s`
            : `${Math.round(req.total_time)}s`;
        return `
        <div class="history-row">
            <div class="hist-ward">Ward ${req.ward_number}<small>completed</small></div>
            <div class="hist-time">${new Date(req.sender_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div class="hist-time">${new Date(req.receiver_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            <div><span class="hist-duration">${duration}</span></div>
        </div>`;
    }).join('');
}

// ─── Analytics Master ─────────────────────────────────────────────────────────
async function renderAnalytics() {
    const res     = await fetch(`${API_URL}/history`);
    const history = await res.json();

    renderKPICards(history);
    renderResolutionGauge(history);
    renderShiftDonut(history);
    renderCallVolumeBar(history);
    renderResponseTrendLine(history);
    renderDayOfWeekBar(history);
    renderWardRanking(history);
    renderHeatmap(history);
}

// ─── Shared ApexCharts defaults ───────────────────────────────────────────────
const CHART_FONT = "'IBM Plex Mono', monospace";
const C_BLUE  = '#ffffff';
const C_RED   = '#ff3b3b';
const C_GREEN = '#39d98a';
const C_AMB   = '#aaaaaa';
const PALETTE = ['#ffffff','#cccccc','#999999','#777777','#555555','#aaaaaa','#e0e0e0'];

function baseOptions(extra = {}) {
    return {
        chart: { fontFamily: CHART_FONT, toolbar: { show: false }, animations: { speed: 600 }, background: 'transparent', foreColor: '#a0a0a0', ...extra.chart },
        grid:  { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 3 },
        tooltip: { theme: 'dark' },
        ...extra
    };
}

// ─── 1. KPI Summary Cards ─────────────────────────────────────────────────────
function renderKPICards(history) {
    if (!history.length) return;

    const avg = history.reduce((s, c) => s + c.total_time, 0) / history.length;
    const avgStr = avg >= 60 ? `${Math.floor(avg/60)}m ${Math.round(avg%60)}s` : `${Math.round(avg)}s`;
    document.getElementById('avg-response-val').innerText = avgStr;
    setTimeout(() => {
        document.getElementById('avg-bar').style.width = Math.min((avg / 300) * 100, 100) + '%';
    }, 150);

    const hours = history.map(h => new Date(h.sender_time).getHours());
    const peak  = hours.sort((a,b) => hours.filter(v=>v===a).length - hours.filter(v=>v===b).length).pop();
    document.getElementById('peak-hour-val').innerText = `${peak % 12 || 12}:00 ${peak >= 12 ? 'PM' : 'AM'}`;

    document.getElementById('kpi-total-calls').innerText = history.length;

    const withIn5 = history.filter(h => h.total_time <= 300).length;
    document.getElementById('kpi-within-target').innerText = Math.round((withIn5 / history.length) * 100) + '%';
}

// ─── 2. Resolution Rate Gauge ─────────────────────────────────────────────────
function renderResolutionGauge(history) {
    _destroyChart('gauge');
    const el = document.getElementById('chart-gauge');
    if (!el || !history.length) return;

    const pct = Math.round((history.filter(h => h.total_time <= 300).length / history.length) * 100);

    _charts['gauge'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'radialBar', height: 240 } }),
        series: [pct],
        labels: ['Within 5 min'],
        plotOptions: {
            radialBar: {
                hollow: { size: '60%' },
                dataLabels: {
                    name:  { fontSize: '11px', color: '#555555', fontFamily: CHART_FONT, offsetY: -6 },
                    value: { fontSize: '2rem', fontWeight: 700, color: '#f5f5f5', fontFamily: "'Space Grotesk', sans-serif", offsetY: 8,
                             formatter: v => v + '%' }
                },
                track: { background: 'rgba(255,255,255,0.08)' }
            }
        },
        fill: { type: 'gradient', gradient: { shade: 'dark', type: 'diagonal1',
            gradientToColors: ['#39d98a'], stops: [0, 100] } },
        colors: ['#ffffff'],
        stroke: { lineCap: 'round' }
    });
    _charts['gauge'].render();
}

// ─── 3. Shift Donut ───────────────────────────────────────────────────────────
function renderShiftDonut(history) {
    _destroyChart('donut');
    const el = document.getElementById('chart-donut');
    if (!el || !history.length) return;

    const shifts = { Morning: 0, Afternoon: 0, Night: 0 };
    history.forEach(h => {
        const hr = new Date(h.sender_time).getHours();
        if (hr >= 6  && hr < 14) shifts.Morning++;
        else if (hr >= 14 && hr < 22) shifts.Afternoon++;
        else shifts.Night++;
    });

    _charts['donut'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'donut', height: 240 } }),
        series: Object.values(shifts),
        labels: Object.keys(shifts),
        colors: ['#ffffff', '#888888', '#444444'],
        plotOptions: { pie: { donut: { size: '62%',
            labels: { show: true,
                total: { show: true, label: 'Total', fontSize: '11px', color: '#555555',
                         formatter: w => w.globals.seriesTotals.reduce((a,b)=>a+b,0) }
            }
        }}},
        legend: { position: 'bottom', fontSize: '12px', fontFamily: CHART_FONT,
                  markers: { width: 8, height: 8, radius: 4 } },
        dataLabels: { enabled: false },
        stroke: { width: 0 }
    });
    _charts['donut'].render();
}

// ─── 4. Call Volume by Hour Bar ───────────────────────────────────────────────
function renderCallVolumeBar(history) {
    _destroyChart('volbar');
    const el = document.getElementById('chart-volbar');
    if (!el || !history.length) return;

    const counts = Array(24).fill(0);
    history.forEach(h => counts[new Date(h.sender_time).getHours()]++);
    const labels = counts.map((_, i) => `${i % 12 || 12}${i < 12 ? 'a' : 'p'}`);

    _charts['volbar'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'bar', height: 220, sparkline: { enabled: false } } }),
        series: [{ name: 'Calls', data: counts }],
        xaxis:  { categories: labels, labels: { style: { fontSize: '10px', colors: '#8fa3bc', fontFamily: CHART_FONT } },
                  axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis:  { labels: { style: { fontSize: '11px', colors: '#8fa3bc', fontFamily: CHART_FONT } } },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%',
            colors: { ranges: [{ from: 0, to: 999, color: C_BLUE }] } } },
        fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical',
            gradientToColors: ['rgba(255,255,255,0.15)'], stops: [0, 100] } },
        colors: [C_BLUE],
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: v => v + ' calls' } }
    });
    _charts['volbar'].render();
}

// ─── 5. Response Time Trend Line ──────────────────────────────────────────────
function renderResponseTrendLine(history) {
    _destroyChart('trend');
    const el = document.getElementById('chart-trend');
    if (!el || !history.length) return;

    // Avg response per hour
    const buckets = {};
    history.forEach(h => {
        const hr = new Date(h.sender_time).getHours();
        if (!buckets[hr]) buckets[hr] = [];
        buckets[hr].push(h.total_time);
    });
    const sortedHours = Object.keys(buckets).map(Number).sort((a,b)=>a-b);
    const avgs   = sortedHours.map(hr => +(buckets[hr].reduce((a,b)=>a+b,0)/buckets[hr].length).toFixed(1));
    const labels = sortedHours.map(hr => `${hr % 12 || 12}:00 ${hr < 12 ? 'AM' : 'PM'}`);

    _charts['trend'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'area', height: 220 } }),
        series: [{ name: 'Avg Response (s)', data: avgs }],
        xaxis:  { categories: labels, labels: { style: { fontSize: '10px', colors: '#8fa3bc', fontFamily: CHART_FONT },
                  rotate: -30 }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis:  { labels: { style: { fontSize: '11px', colors: '#8fa3bc', fontFamily: CHART_FONT },
                  formatter: v => v + 's' } },
        colors: [C_GREEN],
        fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02, stops: [0, 95] } },
        stroke: { curve: 'smooth', width: 2.5 },
        markers:{ size: 4, strokeWidth: 0, hover: { size: 6 } },
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: v => v + 's' } }
    });
    _charts['trend'].render();
}

// ─── 6. Busiest Day of Week ───────────────────────────────────────────────────
function renderDayOfWeekBar(history) {
    _destroyChart('daybar');
    const el = document.getElementById('chart-daybar');
    if (!el || !history.length) return;

    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = Array(7).fill(0);
    history.forEach(h => counts[new Date(h.sender_time).getDay()]++);

    _charts['daybar'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'bar', height: 220 } }),
        series: [{ name: 'Calls', data: counts }],
        xaxis:  { categories: days, labels: { style: { fontSize: '11px', colors: '#8fa3bc', fontFamily: CHART_FONT } },
                  axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis:  { labels: { style: { fontSize: '11px', colors: '#8fa3bc', fontFamily: CHART_FONT } } },
        plotOptions: { bar: { borderRadius: 5, columnWidth: '52%', distributed: true } },
        colors: ['#ffffff','#d0d0d0','#aaaaaa','#888888','#666666','#bbbbbb','#999999'],
        legend: { show: false },
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: v => v + ' calls' } }
    });
    _charts['daybar'].render();
}

// ─── 7. Ward Ranking ──────────────────────────────────────────────────────────
function renderWardRanking(history) {
    if (!history.length) return;
    const counts = {};
    history.forEach(h => counts[h.ward_number] = (counts[h.ward_number] || 0) + 1);
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const max = sorted[0][1];
    document.getElementById('ward-ranking-list').innerHTML = sorted.map(([ward, count]) => `
        <li>
            <span class="rank-ward">Ward ${ward}</span>
            <div class="rank-bar-wrap"><div class="rank-bar" style="width:${(count/max)*100}%"></div></div>
            <span class="rank-count">${count} calls</span>
        </li>
    `).join('');
}

// ─── 8. Ward × Hour Heatmap ───────────────────────────────────────────────────
function renderHeatmap(history) {
    _destroyChart('heatmap');
    const el = document.getElementById('chart-heatmap');
    if (!el || !history.length) return;

    const wards = [...new Set(history.map(h => h.ward_number))].sort((a,b)=>a-b);
    const series = wards.map(ward => {
        const data = Array(24).fill(0);
        history.filter(h => h.ward_number === ward).forEach(h => data[new Date(h.sender_time).getHours()]++);
        return { name: `Ward ${ward}`, data: data.map((v, i) => ({ x: `${i}h`, y: v })) };
    });

    _charts['heatmap'] = new ApexCharts(el, {
        ...baseOptions({ chart: { type: 'heatmap', height: Math.max(180, wards.length * 38 + 60) } }),
        series,
        dataLabels: { enabled: false },
        colors: [C_BLUE],
        xaxis:  { labels: { style: { fontSize: '9px', colors: '#8fa3bc', fontFamily: CHART_FONT } },
                  axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis:  { labels: { style: { fontSize: '11px', colors: '#4a6080', fontFamily: CHART_FONT } } },
        plotOptions: { heatmap: { radius: 3, useFillColorAsStroke: false,
            colorScale: { ranges: [
                { from: 0, to: 0,   color: '#111111', name: 'None' },
                { from: 1, to: 2,   color: '#333333', name: 'Low' },
                { from: 3, to: 5,   color: '#777777', name: 'Medium' },
                { from: 6, to: 999, color: '#ffffff', name: 'High' }
            ]}
        }},
        tooltip: { y: { formatter: v => v + ' calls' } }
    });
    _charts['heatmap'].render();
}

document.addEventListener("DOMContentLoaded", refreshData);