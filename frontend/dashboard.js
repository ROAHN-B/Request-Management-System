const socket = io("http://localhost:3000");
const API_BASE = "http://localhost:3000";


function switchView(view) {
    const activeSec = document.getElementById('active-section');
    const historySec = document.getElementById('history-section');
    const title = document.getElementById('current-view-title');

    if (view === 'active') {
        activeSec.classList.remove('d-none');
        historySec.classList.add('d-none');
        title.innerText = "Active Requests";
        document.getElementById('nav-active').classList.add('active');
        document.getElementById('nav-history').classList.remove('active');
    } else {
        activeSec.classList.add('d-none');
        historySec.classList.remove('d-none');
        title.innerText = "History";
        document.getElementById('nav-history').classList.add('active');
        document.getElementById('nav-active').classList.remove('active');
    }

    
    const offcanvasElement = document.getElementById('mobileMenu');
    const instance = bootstrap.Offcanvas.getInstance(offcanvasElement);
    if (instance) instance.hide();
}


socket.on("new-request", () => {
    refreshData();
});

socket.on("request-update", (data) => {
    const card = document.getElementById(`card-ward-${data.ward_number}`);
    if (card) {
        
        card.classList.add('state-completed-flash');
        card.querySelector('.badge').className = 'badge bg-success';
        card.querySelector('.badge').innerText = 'COMPLETED';

       
        setTimeout(() => {
            refreshData();
        }, 1200);
    } else {
        refreshData();
    }
});


async function refreshData() {
    try {
        const [activeRes, historyRes] = await Promise.all([
            fetch(`${API_BASE}/active`),
            fetch(`${API_BASE}/history`)
        ]);
        
        const activeData = await activeRes.json();
        const historyData = await historyRes.json();

        renderActive(activeData);
        renderHistory(historyData);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

function renderActive(data) {
    const container = document.getElementById('active-container');
    if (data.length === 0) {
        container.innerHTML = `<div class="text-center mt-5 text-muted">No pending requests</div>`;
        return;
    }

    container.innerHTML = data.map(req => `
        <div class="card ward-card shadow-sm state-active" id="card-ward-${req.ward_number}">
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-1">Ward ${req.ward_number}</h5>
                    <div class="text-time">Call: ${new Date(req.sender_time).toLocaleTimeString()}</div>
                </div>
                <span class="badge bg-danger">ACTIVE</span>
            </div>
        </div>
    `).join('');
}

function renderHistory(data) {
    const container = document.getElementById('history-container');
    
    // If no history exists yet
    if (data.length === 0) {
        container.innerHTML = `<div class="text-center mt-5 text-muted">No completed history</div>`;
        return;
    }

    container.innerHTML = data.map(req => `
        <div class="card ward-card shadow-sm border-0 mb-2">
            <div class="card-body py-3">
                <div class="row align-items-center">
                    <div class="col-4">
                        <span class="fw-bold">Ward ${req.ward_number}</span>
                    </div>
                    
                    <div class="col-4 text-center">
                        <small class="text-muted d-block">Called</small>
                        <span class="text-dark">${new Date(req.sender_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>

                    <div class="col-4 text-end">
                        <small class="text-muted d-block">Resolved</small>
                        <span class="text-dark">${new Date(req.receiver_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Initial Load
document.addEventListener('DOMContentLoaded', refreshData);