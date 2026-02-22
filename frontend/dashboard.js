const backendURL = "http://localhost:3000/requests";

async function loadRequests() {
    const response = await fetch(backendURL);
    const data = await response.json();

    const table = document.getElementById("requestTable");
    table.innerHTML = "";

    data.forEach(req => {
        const row = document.createElement("tr");

        let totalTime = req.totalTime ? req.totalTime : calculateLiveTime(req.startTime);

        row.innerHTML = `
            <td>${req.bedNumber}</td>
            <td>${req.status}</td>
            <td>${new Date(req.startTime).toLocaleTimeString()}</td>
            <td>${totalTime}</td>
            <td>
                ${req.status === "pending"
                    ? `<button onclick="completeRequest(${req.id})">Complete</button>`
                    : "Done"}
            </td>
        `;

        table.appendChild(row);
    });
}

function calculateLiveTime(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now - start) / 1000);
}

async function completeRequest(id) {
    await fetch(`${backendURL}/${id}/complete`, {
        method: "PUT"
    });

    loadRequests();
}

setInterval(loadRequests, 1000);
loadRequests();