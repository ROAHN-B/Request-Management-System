const socket = io("http://localhost:3000");
const API_URL = "http://localhost:3000";

// --- Voice Engine ---
function announce(ward) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`Attention! Request from Ward ${ward}`);
        msg.rate = 0.95;
        window.speechSynthesis.speak(msg);
    }
}

// --- View Controller ---
function switchView(view) {
    const views = ['active', 'history', 'analytics'];
    views.forEach(v => {
        document.getElementById(`${v}-section`).classList.add('d-none');
        document.getElementById(`nav-${v}`).classList.remove('active');
    });
    
    document.getElementById(`${view}-section`).classList.remove('d-none');
    document.getElementById(`nav-${view}`).classList.add('active');
    document.getElementById('view-title').innerText = view.charAt(0).toUpperCase() + view.slice(1) + " Requests";

    const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('mobileMenu'));
    if (offcanvas) offcanvas.hide();

    if (view === 'analytics') renderAnalytics();
}

// --- Real-time Listeners ---
socket.on("new-request", (data) => {
    refreshData();
    announce(data.ward_number);
});

socket.on("request-update", (data) => {
    const card = document.getElementById(`card-ward-${data.ward_number}`);
    if (card) {
        card.classList.add('state-completed-flash');
        card.querySelector('.badge').className = 'badge bg-success';
        card.querySelector('.badge').innerText = 'COMPLETED';
        setTimeout(refreshData, 1200);
    } else {
        refreshData();
    }
});

// --- Data & Analytics Logic ---
async function refreshData() {
    const [activeRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/active`),
        fetch(`${API_URL}/history`)
    ]);
    const activeData = await activeRes.json();
    const historyData = await historyRes.json();

    renderActive(activeData);
    renderHistory(historyData);
}

function renderActive(data) {
    const container = document.getElementById('active-list');
    if (data.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-muted">All clear. No active calls.</div>';
        return;
    }
    container.innerHTML = data.map(req => `
        <div class="card ward-card shadow-sm state-active" id="card-ward-${req.ward_number}">
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-0">Ward ${req.ward_number}</h5>
                    <div class="timestamp">Call Time: ${new Date(req.sender_time).toLocaleTimeString()}</div>
                </div>
                <span class="badge bg-danger px-3 py-2">ACTIVE</span>
            </div>
        </div>
    `).join('');
}

function renderHistory(data) {
    const container = document.getElementById('history-list');
    container.innerHTML = data.map(req => `
        <div class="card ward-card shadow-sm border-0 mb-2 py-2">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-4 fw-bold">Ward ${req.ward_number}</div>
                    <div class="col-4 text-center small text-muted">Called<br>${new Date(req.sender_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    <div class="col-4 text-end small text-muted">Resolved<br>${new Date(req.receiver_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
            </div>
        </div>
    `).join('');
}

async function renderAnalytics() {
    const res = await fetch(`${API_URL}/history`);
    const history = await res.json();
    if (history.length === 0) return;

    // 1. Avg Response
    const avg = history.reduce((s, c) => s + c.total_time, 0) / history.length;
    document.getElementById('avg-response-val').innerText = avg >= 60 ? `${Math.floor(avg/60)}m ${Math.round(avg%60)}s` : `${Math.round(avg)}s`;

    // 2. Peak Hour
    const hours = history.map(h => new Date(h.sender_time).getHours());
    const peak = hours.sort((a,b) => hours.filter(v => v===a).length - hours.filter(v => v===b).length).pop();
    document.getElementById('peak-hour-val').innerText = `${peak % 12 || 12}:00 ${peak >= 12 ? 'PM' : 'AM'}`;

    // 3. Ward Ranking
    const counts = {};
    history.forEach(h => counts[h.ward_number] = (counts[h.ward_number] || 0) + 1);
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    document.getElementById('ward-ranking-list').innerHTML = sorted.map(([ward, count]) => `
        <li class="list-group-item d-flex justify-content-between">Ward ${ward} <span>${count} calls</span></li>
    `).join('');
}

document.addEventListener("DOMContentLoaded", refreshData);