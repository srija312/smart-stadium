const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'stadium_data.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8080;

// ==========================================
// CORE STATE & SIMULATION ENGINE
// ==========================================

const GRID_SIZE = 10;
const STATE = {
    phase: 'PRE_MATCH', // PRE_MATCH, MID_MATCH, POST_MATCH
    timeElapsed: 0,
    zones: [],
    foodStalls: [
        { id: 1, name: 'Burger Arena', menu: [{item: 'Classic Burger', price: 299}, {item: 'Cheese Fries', price: 149}, {item: 'Coke', price: 89}, {item: 'Veggie Wrap', price: 199}], queue: 0, x: 2, y: 3, basePrice: 299 },
        { id: 2, name: 'Pizza Corner', menu: [{item: 'Margherita', price: 499}, {item: 'Pepperoni', price: 599}, {item: 'Garlic Bread', price: 129}, {item: 'Pasta', price: 349}], queue: 0, x: 7, y: 2, basePrice: 499 },
        { id: 3, name: 'Taco Field', menu: [{item: 'Beef Taco', price: 249}, {item: 'Nachos', price: 179}, {item: 'Quesadilla', price: 299}, {item: 'Churros', price: 119}], queue: 0, x: 5, y: 7, basePrice: 249 }
    ],
    vehicles: [
        { id: 'S1', type: 'Shuttle', x: 0, y: 0, status: 'Idle', target: null },
        { id: 'B1', type: 'Bike', x: 9, y: 9, status: 'Idle', target: null },
        { id: 'C1', type: 'Cab', x: 0, y: 9, status: 'Idle', target: null }
    ],
    orders: [],
    bookings: [],
    tickets: [],
    events: [
        { id: 101, teams: 'Mumbai Indians vs CSK', date: '25 Oct, 2026', time: '19:30', price: 1499, stadium: 'Wankhede Arena' },
        { id: 102, teams: 'India vs Pakistan', date: '02 Nov, 2026', time: '14:00', price: 4999, stadium: 'Narendra Modi Stadium' },
        { id: 103, teams: 'RCB vs KKR', date: '10 Nov, 2026', time: '19:30', price: 999, stadium: 'Chinnaswamy Field' }
    ],
    leaderboard: [
        { name: 'User123', points: 450 },
        { name: 'Fanatic88', points: 320 }
    ],
    alerts: [],
    peakHistory: []
};

// Initialize Zones
function initZones() {
    STATE.zones = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            let type = 'seating';
            // Entry Gates (Corners)
            if ((x === 0 || x === 9) && (y === 0 || y === 9)) type = 'entry_gate';
            // Exit Gates (Mid-edges)
            else if ((x === 4 && (y === 0 || y === 9)) || (y === 4 && (x === 0 || x === 9))) type = 'exit_gate';
            // Food Spots
            else if ((x === 2 && y === 3) || (x === 7 && y === 2) || (x === 5 && y === 7)) type = 'food';
            // Restrooms
            else if ((x === 2 && y === 7) || (x === 7 && y === 7) || (x === 5 && y === 2)) type = 'restroom';
            // Ticket Counter
            else if (x === 4 && y === 4) type = 'ticket';
            
            STATE.zones.push({
                x, y,
                density: Math.random() * 20,
                queue: 0,
                risk: 'SAFE',
                type: type
            });
        }
    }
}
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            orders: STATE.orders,
            bookings: STATE.bookings,
            tickets: STATE.tickets,
            leaderboard: STATE.leaderboard
        }, null, 2));
    } catch (e) { console.error('Persistence Error:', e); }
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            STATE.orders = data.orders || [];
            STATE.bookings = data.bookings || [];
            STATE.tickets = data.tickets || [];
            if (data.leaderboard) STATE.leaderboard = data.leaderboard;
        } catch (e) { console.error('Load Error:', e); }
    }
}

initZones();
loadData();

// AI Simulation Logic
setInterval(() => {
    STATE.timeElapsed += 3;
    
    // Update Phase based on time
    if (STATE.timeElapsed < 60) STATE.phase = 'PRE_MATCH';
    else if (STATE.timeElapsed < 120) STATE.phase = 'MID_MATCH';
    else STATE.phase = 'POST_MATCH';

    // Update Zones (Crowd Flow Logic)
    STATE.zones.forEach(zone => {
        // Trend-based movement
        if (STATE.phase === 'PRE_MATCH') {
            if (zone.type === 'entry_gate' || zone.type === 'ticket') zone.density = Math.min(100, zone.density + Math.random() * 15);
            else zone.density = Math.min(100, zone.density + Math.random() * 5);
        } else if (STATE.phase === 'MID_MATCH') {
            if (zone.type === 'food' || zone.type === 'restroom') zone.density = Math.min(100, zone.density + Math.random() * 20);
            else zone.density = Math.max(10, zone.density - Math.random() * 5);
        } else {
            if (zone.type === 'exit_gate') zone.density = Math.min(100, zone.density + Math.random() * 25);
            else zone.density = Math.max(0, zone.density - Math.random() * 10);
        }

        // Risk detection
        if (zone.density > 80) zone.risk = 'HIGH RISK';
        else if (zone.density > 50) zone.risk = 'MODERATE';
        else zone.risk = 'SAFE';

        // Chain Reaction: Density -> Queue
        if (zone.type === 'food') {
            zone.queue = Math.floor(zone.density / 10);
        }
    });

    // Food Pricing Simulation
    STATE.foodStalls.forEach(stall => {
        const zone = STATE.zones.find(z => z.x === stall.x && z.y === stall.y);
        stall.queue = zone ? zone.queue : 0;
        // Dynamic pricing: Price increases with queue
        stall.menu[0].price = stall.basePrice + Math.floor(stall.queue / 2);
    });

    // Mobility Simulation
    STATE.vehicles.forEach(v => {
        if (v.target) {
            if (v.x < v.target.x) v.x++;
            else if (v.x > v.target.x) v.x--;
            else if (v.y < v.target.y) v.y++;
            else if (v.y > v.target.y) v.y--;
            
            if (v.x === v.target.x && v.y === v.target.y) {
                v.status = 'Idle';
                v.target = null;
            }
        }
    });

    // Generate Alerts
    if (STATE.zones.some(z => z.risk === 'HIGH RISK')) {
        const zone = STATE.zones.find(z => z.risk === 'HIGH RISK');
        const alertMsg = `Critical Overcrowding at Zone (${zone.x}, ${zone.y})!`;
        if (!STATE.alerts.some(a => a.message === alertMsg)) {
            STATE.alerts.unshift({ time: new Date().toLocaleTimeString(), message: alertMsg, level: 'CRITICAL' });
            if (STATE.alerts.length > 10) STATE.alerts.pop();
        }
    }

    io.emit('state:update', STATE);

    // Record Peak History every 10 ticks (approx 30s)
    if (STATE.timeElapsed % 10 === 0) {
        const avg = STATE.zones.reduce((a, b) => a + b.density, 0) / STATE.zones.length;
        STATE.peakHistory.push({ time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}), avg });
        if (STATE.peakHistory.length > 20) STATE.peakHistory.shift();
    }
    STATE.timeElapsed++;
}, 3000);

// ==========================================
// SMART ROUTING (A*)
// ==========================================

function getPath(start, end, mode = 'fastest') {
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (p) => `${p.x},${p.y}`;
    gScore.set(key(start), 0);
    fScore.set(key(start), Math.abs(start.x - end.x) + Math.abs(start.y - end.y));

    while (openSet.length > 0) {
        let current = openSet.reduce((a, b) => fScore.get(key(a)) < fScore.get(key(b)) ? a : b);
        
        if (current.x === end.x && current.y === end.y) {
            const path = [];
            while (cameFrom.has(key(current))) {
                path.push(current);
                current = cameFrom.get(key(current));
            }
            return path.reverse();
        }

        openSet.splice(openSet.indexOf(current), 1);

        const neighbors = [
            {x: current.x+1, y: current.y}, {x: current.x-1, y: current.y},
            {x: current.x, y: current.y+1}, {x: current.x, y: current.y-1}
        ].filter(p => p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10);

        for (let neighbor of neighbors) {
            const zone = STATE.zones.find(z => z.x === neighbor.x && z.y === neighbor.y);
            // In 'safest' mode, high-density areas have massive cost penalty
            const weight = mode === 'safest' ? (zone ? zone.density * 5 : 1) : 1;
            const tentativeGScore = gScore.get(key(current)) + weight;

            if (tentativeGScore < (gScore.get(key(neighbor)) ?? Infinity)) {
                cameFrom.set(key(neighbor), current);
                gScore.set(key(neighbor), tentativeGScore);
                fScore.set(key(neighbor), tentativeGScore + Math.abs(neighbor.x - end.x) + Math.abs(neighbor.y - end.y));
                if (!openSet.some(p => p.x === neighbor.x && p.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return [];
}

// ==========================================
// API ENDPOINTS
// ==========================================

app.get('/api/crowd', (req, res) => res.json(STATE.zones));
app.get('/api/food', (req, res) => res.json(STATE.foodStalls));
app.get('/api/vehicle', (req, res) => res.json(STATE.vehicles));
app.get('/api/route', (req, res) => {
    const { sx, sy, dx, dy, mode } = req.query;
    if (sx && sy && dx && dy) {
        const path = getPath({ x: parseInt(sx), y: parseInt(sy) }, { x: parseInt(dx), y: parseInt(dy) }, mode || 'fastest');
        return res.json(path);
    }
    res.status(400).json({ error: 'Missing sx, sy, dx, or dy' });
});
app.get('/api/analytics', (req, res) => {
    const avgDensity = STATE.zones.reduce((a, b) => a + b.density, 0) / STATE.zones.length;
    res.json({ avgDensity, phase: STATE.phase, alertsCount: STATE.alerts.length });
});

// ==========================================
// FRONTEND (EMBEDDED)
// ==========================================

app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSES | Hyper-Intelligent Stadium</title>
    <script src="/socket.io/socket.io.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #050505;
            --panel-bg: rgba(20, 20, 25, 0.85);
            --accent-color: #00f2fe;
            --safe-color: #00ff88;
            --mod-color: #ffcc00;
            --risk-color: #ff3366;
            --text-main: #ffffff;
            --text-color: #e0e0e0;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: var(--bg-color); color: var(--text-color); overflow-x: hidden; }

        .app-container { display: flex; height: 100vh; }

        /* Sidebar */
        .sidebar {
            width: 280px;
            background: rgba(10, 12, 18, 0.95);
            border-right: 1px solid rgba(255,255,255,0.1);
            padding: 30px 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            backdrop-filter: blur(10px);
        }

        .logo { font-size: 24px; font-weight: 800; background: linear-gradient(45deg, var(--accent-color), #4facfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }

        .nav-item {
            padding: 12px 15px;
            border-radius: 12px;
            cursor: pointer;
            transition: 0.3s;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 500;
            color: #888;
        }
        .nav-item:hover, .nav-item.active { background: var(--panel-bg); color: #fff; border-left: 4px solid var(--accent-color); }

        /* Main Content */
        .main-content { flex: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 30px; }

        /* Header Stats */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-card { background: var(--panel-bg); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-val { font-size: 28px; font-weight: 800; color: var(--accent-color); }
        .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #777; margin-top: 5px; }

        /* Map Layout */
        .map-section { display: flex; gap: 30px; padding-top: 20px; align-items: flex-start; }
        
        .grid-container {
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 8px;
            background: rgba(10,12,18,0.9);
            padding: 20px;
            border-radius: 20px;
            width: 550px;
            height: 550px;
            border: 1px solid rgba(255,255,255,0.05);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .grid-cell {
            width: 100%; height: 100%;
            position: relative;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        .grid-cell:hover { transform: scale(1.05); background: rgba(255,255,255,0.05); z-index: 5; }

        .density-overlay {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            background: linear-gradient(to top, var(--color), transparent);
            opacity: 0.4;
            transition: height 0.3s ease;
            border-radius: 0 0 8px 8px;
        }

        .density-label {
            position: absolute;
            bottom: 4px; right: 4px;
            font-size: 8px;
            color: rgba(255,255,255,0.4);
            font-weight: 600;
            z-index: 3;
        }

        .people-dots {
            position: absolute;
            inset: 0;
            display: flex;
            flex-wrap: wrap;
            padding: 4px;
            gap: 2px;
            pointer-events: none;
            opacity: 0.6;
            z-index: 1;
        }
        .person { width: 3px; height: 3px; background: rgba(255,255,255,0.8); border-radius: 50%; display: none; }
        .grid-cell[data-density="heavy"] .person { display: block; }

        .path-cell { border: 2px solid #fff; box-shadow: 0 0 15px rgba(255,255,255,0.3); background: rgba(255,255,255,0.1) !important; }
        .start-cell { border: 2px solid var(--safe-color); box-shadow: 0 0 15px var(--safe-color); background: rgba(0,255,136,0.1) !important; }
        .end-cell { border: 2px solid var(--risk-color); box-shadow: 0 0 15px var(--risk-color); background: rgba(255,51,102,0.1) !important; }
        
        .vehicle-dot {
            width: 12px; height: 12px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 10%; right: 10%;
            box-shadow: 0 0 10px #fff;
            z-index: 10;
        }
        
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(1.5); opacity: 0; }
        }

        /* Panels */
        .right-panel { flex: 1; display: flex; flex-direction: column; gap: 20px; }
        .panel { background: var(--panel-bg); border-radius: 20px; padding: 20px; border: 1px solid rgba(255,255,255,0.05); }
        .panel-h { font-size: 18px; font-weight: 700; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }

        .alert-item { padding: 10px; border-radius: 10px; background: rgba(255,65,108,0.1); border-left: 3px solid var(--risk-color); margin-bottom: 10px; font-size: 13px; }
        .food-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .btn { padding: 8px 15px; border-radius: 8px; border: none; background: var(--accent-color); color: #000; font-weight: 600; cursor: pointer; transition: 0.3s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 0 15px var(--accent-glow); }
        .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }

        .voice-mic {
            width: 50px; height: 50px; border-radius: 50%; background: var(--accent-color);
            position: fixed; bottom: 30px; right: 30px; display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 0 20px var(--accent-glow); animation: pulse 2s infinite;
        }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 var(--accent-glow); } 70% { box-shadow: 0 0 0 20px rgba(0,242,254,0); } 100% { box-shadow: 0 0 0 0 rgba(0,242,254,0); } }

        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
        .modal-content { background: #111; padding: 40px; border-radius: 30px; width: 400px; text-align: center; border: 1px solid var(--accent-color); }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="sidebar">
            <div class="logo">SSES v1.0</div>
            <div class="nav-item" onclick="showTab('tickets')">Ticket Booking</div>
            <div class="nav-item active" onclick="showTab('crowd')">Stadium Map</div>
            <div class="nav-item" onclick="showTab('food')">Food & Beverages</div>
            <div class="nav-item" onclick="showTab('mobility')">Smart Mobility</div>
            <div class="nav-item" onclick="showTab('activity')">My Activity</div>
            <div class="nav-item" onclick="showTab('analytics')">Admin Analytics</div>
            <div class="nav-item" style="margin-top:auto; color: var(--risk-color)" onclick="triggerEmergency()">EMERGENCY MODE</div>
        </div>

        <div class="main-content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-val" id="sys-phase">PRE-MATCH</div>
                    <div class="stat-label">System Phase</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" id="avg-density">12%</div>
                    <div class="stat-label">Avg. Density</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" id="active-alerts">0</div>
                    <div class="stat-label">Active Alerts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" id="user-points">450</div>
                    <div class="stat-label">My Points</div>
                </div>
            </div>

            <div id="tickets-view" class="tab-content" style="display:none;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;" id="event-list"></div>
            </div>

            <div id="crowd-view" class="tab-content">
                <div class="map-section">
                    <div id="stadium-grid" class="grid-container"></div>
                    
                    <div class="right-panel">
                        <div class="panel">
                            <div class="panel-h">Health & Safety <span>🏨</span></div>
                            <div style="font-size:12px; color:#999; line-height:1.5;">First Aid available at Zone (2,7) and (7,7). Real-time hydration monitoring active.</div>
                        </div>
                        <div class="panel">
                            <div class="panel-h">Smart Routing <span>🤖</span></div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                                <div style="display:flex; flex-direction:column; gap:5px;">
                                    <label style="font-size:10px; color:#555;">FROM</label>
                                    <input type="text" id="route-from" readonly placeholder="Click Grid" style="background:rgba(255,255,255,0.05); border:1px solid #333; color:var(--safe-color); padding:8px; border-radius:8px; font-size:12px;">
                                </div>
                                <div style="display:flex; flex-direction:column; gap:5px;">
                                    <label style="font-size:10px; color:#555;">TO</label>
                                    <input type="text" id="route-to" readonly placeholder="Click Grid" style="background:rgba(255,255,255,0.05); border:1px solid #333; color:var(--risk-color); padding:8px; border-radius:8px; font-size:12px;">
                                </div>
                            </div>
                            <div style="display:flex; gap:10px; margin-bottom:15px;">
                                <button class="btn" style="flex:2;" onclick="getPathToTarget()">Find Path</button>
                                <button class="btn btn-secondary" style="flex:1;" onclick="resetSelection()">Reset</button>
                            </div>
                            <div id="route-info" style="font-size:12px; color:var(--accent-color)">Click grid to set <b>From</b>, then <b>To</b>.</div>
                        </div>
                        <div class="panel" id="map-legend">
                            <div class="panel-h">Interactive Legend</div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:11px;">
                                <div>🏠 Entry Gate</div>
                                <div>🚶 Exit Gate</div>
                                <div>🍔 Food Stall</div>
                                <div>🚻 Restroom</div>
                                <div>🎫 Tickets</div>
                                <div>🚜 Vehicle</div>
                            </div>
                        </div>
                        <div class="panel">
                            <div class="panel-h">Active Alerts ⚡</div>
                            <div id="alerts-list" style="max-height: 150px; overflow-y: auto;">
                                <div style="color:#555; text-align:center; padding:10px;">No active alerts</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="food-view" class="tab-content" style="display:none;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;" id="food-stalls-list"></div>
            </div>

            <div id="activity-view" class="tab-content" style="display:none;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                    <div class="panel">
                        <div class="panel-h">Food Orders 🍔</div>
                        <div id="order-history-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-h">Mobility 🚕</div>
                        <div id="booking-history-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-h">Tickets 🎫</div>
                        <div id="ticket-history-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                </div>
            </div>

            <div id="mobility-view" class="tab-content" style="display:none;">
                <div class="panel">
                    <div class="panel-h">Available Vehicles</div>
                    <div id="vehicles-list" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px;"></div>
                </div>
            </div>

            <div id="analytics-view" class="tab-content" style="display:none;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
                    <div class="panel" style="grid-column: span 2;">
                        <div class="panel-h">Peak Load Distribution (Historical)</div>
                        <div id="analytics-chart" style="height:200px; display:flex; align-items:flex-end; gap:5px; padding-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05);"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-h">Most Crowded Zones 🚩</div>
                        <div id="top-crowded-zones" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-h">Popular Food Items 🍔</div>
                        <div id="popular-food-items" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-h">Fan Leaderboard</div>
                        <div id="leaderboard-list"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="voice-mic" onclick="startVoice()">
        <span style="font-size:20px;">🎤</span>
    </div>

    <div class="modal" id="order-modal">
        <div class="modal-content">
            <h2 id="modal-title">Success!</h2>
            <p id="modal-msg" style="margin: 15px 0; color: #888;"></p>
            <button class="btn" onclick="document.getElementById('order-modal').style.display='none'">Awesome</button>
        </div>
    </div>

    <script>
        const socket = io();
        let currentPath = [];
        let startPoint = null;
        let endPoint = null;

        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById(tabId + '-view').style.display = 'block';
            event.target.classList.add('active');
        }

        function renderGrid(zones, vehicles) {
            const grid = document.getElementById('stadium-grid');
            grid.innerHTML = '';
            zones.forEach(z => {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                
                const color = z.density < 30 ? 'var(--safe-color)' : (z.density < 70 ? 'var(--mod-color)' : 'var(--risk-color)');
                
                if (currentPath.some(p => p.x === z.x && p.y === z.y)) {
                    cell.classList.add('path-cell');
                }
                
                if (startPoint && startPoint.x === z.x && startPoint.y === z.y) cell.classList.add('start-cell');
                if (endPoint && endPoint.x === z.x && endPoint.y === z.y) cell.classList.add('end-cell');

                let icon = '';
                if (z.type === 'entry_gate') icon = '🏠';
                else if (z.type === 'exit_gate') icon = '🚶';
                else if (z.type === 'food') icon = '🍔';
                else if (z.type === 'restroom') icon = '🚻';
                else if (z.type === 'ticket') icon = '🎫';
                
                const count = Math.floor(z.density / 10);
                let peopleHTML = '<div class="people-dots">';
                for(let i=0; i<count; i++) peopleHTML += '<div class="person" style="display:block; opacity:'+(Math.random()*0.5+0.5)+'"></div>';
                peopleHTML += '</div>';

                cell.innerHTML = \`
                    <div class="density-overlay" style="height: \${z.density}%; --color: \${color}"></div>
                    \${peopleHTML}
                    <span style="position:relative; z-index:2">\${icon}</span>
                    <div class="density-label">\${Math.floor(z.density)}%</div>
                \`;
                cell.setAttribute('data-info', \`\${z.type.replace('_',' ').toUpperCase()} | Density: \${Math.floor(z.density)}%\`);
                
                const v = vehicles.find(veh => veh.x === z.x && veh.y === z.y);
                if (v) {
                    const dot = document.createElement('div');
                    dot.className = 'vehicle-dot pulse';
                    cell.appendChild(dot);
                }

                cell.onclick = () => {
                    if (!startPoint) {
                        startPoint = z;
                        document.getElementById('route-from').value = \`\${z.x},\${z.y}\`;
                        document.getElementById('route-info').innerHTML = 'Select <b>Destination</b> point next.';
                    } else if (!endPoint) {
                        endPoint = z;
                        document.getElementById('route-to').value = \`\${z.x},\${z.y}\`;
                        document.getElementById('route-info').innerHTML = 'Ready to <b>Find Path</b>.';
                    }
                    renderGrid(zones, vehicles);
                };
                grid.appendChild(cell);
            });
        }

        socket.on('state:update', (data) => {
            document.getElementById('sys-phase').innerText = data.phase;
            document.getElementById('active-alerts').innerText = data.alerts.length;
            const avg = data.zones.reduce((a, b) => a + b.density, 0) / data.zones.length;
            document.getElementById('avg-density').innerText = \`\${Math.floor(avg)}%\`;
            
            renderGrid(data.zones, data.vehicles);
            renderFood(data.foodStalls);
            renderVehicles(data.vehicles);
            renderAlerts(data.alerts);
            renderActivity(data.orders, data.bookings, data.tickets);
            renderEvents(data.events);
            renderAnalytics(data.zones, data.leaderboard, data.orders, data.peakHistory);
        });

        function renderEvents(events) {
            const list = document.getElementById('event-list');
            list.innerHTML = events.map(e => \`
                <div class="panel">
                    <div style="font-size:20px; margin-bottom:10px;">🏏</div>
                    <div class="panel-h" style="margin-bottom:5px;">\${e.teams}</div>
                    <div style="font-size:12px; color:#777; margin-bottom:15px;">
                        📅 \${e.date} | ⏰ \${e.time}<br>
                        📍 \${e.stadium}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
                        <span style="font-weight:700; color:var(--safe-color)">₹\${e.price}</span>
                        <button class="btn" onclick="bookTicket(\${e.id}, '\${e.teams}', \${e.price})">Book Seats</button>
                    </div>
                </div>
            \`).join('');
        }

        function renderActivity(orders, bookings, tickets = []) {
            const oList = document.getElementById('order-history-list');
            oList.innerHTML = orders.slice().reverse().map(o => \`
                <div class="food-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 10px; flex-direction: column; align-items: flex-start; background: rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:5px;">
                        <span style="font-weight:600">\${o.item} (x\${o.quantity})</span>
                        <span style="color:var(--safe-color)">₹\${o.totalPrice}</span>
                    </div>
                    <div style="font-size:11px; color:#777; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span>From: \${o.stall} | Status: <span style="color:var(--accent-color)">\${o.status}</span> | Pickup: \${o.pickupTime}</span>
                        <button class="btn" style="background:var(--risk-color); padding:2px 8px; font-size:10px;" onclick="cancelOrder(\${o.id})">Cancel</button>
                    </div>
                </div>
            \`).join('') || '<div style="color:#555; text-align:center; padding:20px;">No previous orders</div>';

            const bList = document.getElementById('booking-history-list');
            bList.innerHTML = bookings.slice().reverse().map(b => \`
                <div class="food-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 10px; flex-direction: column; align-items: flex-start; background: rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:5px;">
                        <span style="font-weight:600">\${b.type} (\${b.id})</span>
                        <span style="color:var(--accent-color)">ETA: \${b.eta}</span>
                    </div>
                    <div style="font-size:11px; color:#777; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span>Time: \${b.timestamp} | Fare: ₹249</span>
                        <button class="btn" style="background:var(--risk-color); padding:2px 8px; font-size:10px;" onclick="cancelBooking('\${b.id}')">Cancel</button>
                    </div>
                </div>
            \`).join('') || '<div style="color:#555; text-align:center; padding:20px;">No previous bookings</div>';

            const tList = document.getElementById('ticket-history-list');
            tList.innerHTML = tickets.slice().reverse().map(t => \`
                <div class="food-item" style="border: 1px solid rgba(0,242,254,0.1); padding: 10px; border-radius: 10px; flex-direction: column; align-items: flex-start; background: rgba(0,242,254,0.02);">
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:5px;">
                        <span style="font-weight:600; color:var(--accent-color)">🎫 \${t.event}</span>
                        <span style="color:var(--safe-color)">₹\${t.totalPrice}</span>
                    </div>
                    <div style="font-size:11px; color:#777; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <span>Qty: \${t.quantity} | ID: \${t.ticketId}</span>
                        <button class="btn" style="background:var(--risk-color); padding:2px 8px; font-size:10px;" onclick="cancelTicket('\${t.ticketId}')">Cancel</button>
                    </div>
                </div>
            \`).join('') || '<div style="color:#555; text-align:center; padding:20px;">No previous tickets</div>';
        }

        function renderAlerts(alerts) {
            const list = document.getElementById('alerts-list');
            list.innerHTML = alerts.map(a => \`
                <div class="alert-item">
                    <strong>\${a.time}</strong><br>\${a.message}
                </div>
            \`).join('') || '<div style="color:#555; text-align:center; padding:20px;">No active alerts</div>';
        }

        function renderFood(stalls) {
            const list = document.getElementById('food-stalls-list');
            list.innerHTML = stalls.map(s => \`
                <div class="panel">
                    <div class="panel-h">\${s.name} <span style="font-size:12px; color:#777;">Wait: \${s.queue * 2}m</span></div>
                    \${s.menu.map(m => \`
                        <div class="food-item">
                            <span>\${m.item}</span>
                            <span>₹\${m.price} <button class="btn" style="padding:4px 8px; font-size:10px; margin-left:10px;" onclick="placeOrder('\${m.item}', \${m.price}, '\${s.name}')">Order</button></span>
                        </div>
                    \`).join('')}
                </div>
            \`).join('');
        }

        function renderVehicles(vehicles) {
            const list = document.getElementById('vehicles-list');
            list.innerHTML = vehicles.map(v => \`
                <div class="stat-card" style="position:relative;">
                    <div style="font-size:24px;">\${v.type === 'Shuttle' ? '🚍' : (v.type === 'Bike' ? '🚲' : '🚕')}</div>
                    <div class="stat-label">\${v.type} \${v.id}</div>
                    <div style="font-size:11px; color:\${v.status === 'Idle' ? 'var(--safe-color)' : 'var(--accent-color)'}">\${v.status}</div>
                    <button class="btn" style="width:100%; margin-top:10px; font-size:11px;" onclick="bookVehicle('\${v.id}')">Book Now</button>
                </div>
            \`).join('');
        }

        function renderAnalytics(zones, leaderboard, orders, history = []) {
            const chart = document.getElementById('analytics-chart');
            chart.innerHTML = history.map(h => {
                const height = Math.max(10, h.avg * 2);
                return \`<div style="flex:1; background:var(--accent-color); height:\${height}px; border-radius:3px; position:relative;" title="\${h.time}: \${Math.floor(h.avg)}%">
                    <div style="position:absolute; bottom:-20px; left:50%; transform:translateX(-50%); font-size:7px; white-space:nowrap; color:#555">\${h.time.split(':')[1]}m</div>
                </div>\`;
            }).join('') || '<div style="color:#555; font-size:12px; padding:20px;">Analyzing patterns... (Wait 30s)</div>';

            const topZonesList = document.getElementById('top-crowded-zones');
            const sortedZones = zones.slice().sort((a,b) => b.density - a.density).slice(0,5);
            topZonesList.innerHTML = sortedZones.map(z => \`
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,51,102,0.05); border-left:3px solid var(--risk-color); border-radius:4px;">
                    <span style="font-size:12px;">Zone (\${z.x}, \${z.y})</span>
                    <span style="color:var(--risk-color); font-weight:bold;">\${Math.floor(z.density)}%</span>
                </div>
            \`).join('');

            const foodStatsList = document.getElementById('popular-food-items');
            const itemsMap = {};
            orders.forEach(o => {
                itemsMap[o.item] = (itemsMap[o.item] || 0) + o.quantity;
            });
            const topItems = Object.entries(itemsMap).sort((a,b) => b[1] - a[1]).slice(0,5);
            foodStatsList.innerHTML = topItems.map(([name, qty]) => \`
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(0,242,254,0.05); border-left:3px solid var(--accent-color); border-radius:4px;">
                    <span style="font-size:12px;">\${name}</span>
                    <span style="color:var(--accent-color); font-weight:bold;">\${qty} sold</span>
                </div>
            \`).join('') || '<div style="color:#555; font-size:12px; padding:20px;">Waiting for sales...</div>';

            const board = document.getElementById('leaderboard-list');
            board.innerHTML = leaderboard.map((u, i) => \`
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span>#\${i+1} \${u.name}</span>
                    <span style="color:var(--safe-color)">\${u.points} XP</span>
                </div>
            \`).join('');
        }

        function showTab(tab) {
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            document.getElementById(\`\${tab}-view\`).style.display = 'block';
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            if (event) event.currentTarget.classList.add('active');
        }

        function getPathToTarget() {
            if (!startPoint || !endPoint) return alert('Select both Start and End points first!');
            socket.emit('route:request', { x: startPoint.x, y: startPoint.y, target: endPoint, mode: 'fastest' });
        }

        function resetSelection() {
            startPoint = null;
            endPoint = null;
            currentPath = [];
            document.getElementById('route-from').value = '';
            document.getElementById('route-to').value = '';
            document.getElementById('route-info').innerHTML = 'Click grid to set <b>From</b>, then <b>To</b>.';
            // Trigger a re-render if we have data, or wait for next update
            socket.emit('request:update'); // Ask server for immediate state to clear visuals
        }

        socket.on('route:result', (path) => {
            currentPath = path;
            const pts = path.length * 10;
            document.getElementById('user-points').innerText = parseInt(document.getElementById('user-points').innerText || '0') + pts;
            document.getElementById('route-info').innerHTML = \`<span style="color:var(--safe-color)">Path Found!</span> \${path.length} zones. +\${pts} XP earned.\`;
        });

        function placeOrder(item, price, stall) {
            const qty = prompt(\`How many \${item} would you like?\`, "1");
            if (qty && parseInt(qty) > 0) {
                socket.emit('order:place', { item, price, stall, quantity: parseInt(qty) });
            }
        }

        socket.on('order:confirm', (data) => {
            const details = \`
                <div style="text-align: left; margin-top: 15px; font-size: 14px; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between;"><span>Item:</span> <span>\${data.item}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Quantity:</span> <span>x\${data.quantity}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Total:</span> <span style="color: var(--safe-color); font-weight: bold;">₹\${data.totalPrice}</span></div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
                        <span>Pickup At:</span> <span style="color: var(--accent-color); text-align: right;">\${data.pickupTime}</span>
                    </div>
                </div>
            \`;
            showModal('Order Confirmed! ✅', details);
        });

        function bookVehicle(id) {
            socket.emit('vehicle:book', { id, target: {x: Math.floor(Math.random()*10), y: Math.floor(Math.random()*10)} });
        }

        socket.on('vehicle:confirm', (data) => {
            const details = \`
                <div style="text-align: left; margin-top: 15px; font-size: 14px; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between;"><span>Service:</span> <span>\${data.type} (\${data.id})</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Passengers:</span> <span>1-3 (Standard)</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Estimated Fare:</span> <span style="color: var(--safe-color); font-weight: bold;">₹249</span></div>
                    <div style="display: flex; justify-content: space-between; border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
                        <span>ETA:</span> <span style="color: var(--accent-color); text-align: right;">\${data.eta}</span>
                    </div>
                </div>
            \`;
            showModal('Booking Confirmed! 🚕', details);
        });

        function bookTicket(id, event, price) {
            const qty = prompt(\`How many tickets for \${event}?\`, "1");
            if (qty && parseInt(qty) > 0) {
                socket.emit('ticket:book', { id, event, price, quantity: parseInt(qty) });
            }
        }

        socket.on('ticket:confirm', (data) => {
            const details = \`
                <div style="text-align: left; margin-top: 15px; font-size: 14px; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between;"><span>Event:</span> <span>\${data.event}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Quantity:</span> <span>\${data.quantity} Seats</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Total Paid:</span> <span style="color: var(--safe-color); font-weight: bold;">₹\${data.totalPrice}</span></div>
                    <div style="text-align:center; margin-top:20px; border: 2px dashed #444; padding:15px; border-radius:10px;">
                        <div style="font-size:10px; color:#555; margin-bottom:5px;">DIGITAL PASS ID</div>
                        <div style="font-family:monospace; letter-spacing:2px; color:var(--accent-color);">\${data.ticketId}</div>
                    </div>
                </div>
            \`;
            showModal('Ticket Confirmed! 🎫', details);
        });

        function cancelOrder(id) {
            if (confirm('Cancel this food order?')) socket.emit('order:cancel', { id });
        }
        function cancelBooking(id) {
            if (confirm('Cancel this vehicle booking?')) socket.emit('vehicle:cancel', { id });
        }
        function cancelTicket(ticketId) {
            if (confirm('Cancel these match tickets?')) socket.emit('ticket:cancel', { ticketId });
        }

        function triggerEmergency() {
            showModal('EMERGENCY ACTIVE', 'Please follow the white glowing path to the nearest exit immediately.', 'var(--risk-color)');
            socket.emit('emergency:activate');
        }

        function showModal(title, content, color = 'var(--accent-color)') {
            const m = document.getElementById('order-modal');
            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-title').style.color = color;
            document.getElementById('modal-msg').innerHTML = content;
            m.style.display = 'flex';
        }

        function startVoice() {
            const cmd = prompt("Voice Command Simulator: (e.g. 'find food', 'best route', 'book cab')");
            if (!cmd) return;
            if (cmd.toLowerCase().includes('food')) showTab('food');
            else if (cmd.toLowerCase().includes('route')) { showTab('crowd'); alert('Select a zone to find the best route.'); }
            else if (cmd.toLowerCase().includes('cab')) showTab('mobility');
            else alert("I didn't quite catch that. Try 'find food'.");
        }
    </script>
</body>
</html>
    `;
    res.send(html);
});

// ==========================================
// SOCKET HANDLERS
// ==========================================

io.on('connection', (socket) => {
    socket.on('route:request', (data) => {
        const path = getPath({ x: data.x, y: data.y }, data.target, data.mode);
        socket.emit('route:result', path);
    });

    socket.on('order:place', (data) => {
        const stall = STATE.foodStalls.find(s => s.name === data.stall);
        const waitTime = stall ? (5 + stall.queue * 2) : 5;
        const pickupTime = new Date(Date.now() + waitTime * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const quantity = data.quantity || 1;
        const totalPrice = data.price * quantity;
        
        const order = { id: Date.now(), ...data, quantity, totalPrice, status: 'Preparing', pickupTime };
        STATE.orders.push(order);
        saveData();
        
        const user = STATE.leaderboard[0];
        user.points += 50;
        
        socket.emit('order:confirm', order);
    });

    socket.on('vehicle:book', (data) => {
        const v = STATE.vehicles.find(veh => veh.id === data.id);
        if (v) {
            v.status = 'Busy';
            v.target = data.target;
            const eta = Math.floor(Math.random() * 5) + 2; 
            const etaTime = new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const booking = { id: v.id, type: v.type, eta: etaTime, timestamp: new Date().toLocaleTimeString() };
            STATE.bookings.push(booking);
            saveData();
            
            socket.emit('vehicle:confirm', booking);
        }
    });

    socket.on('ticket:book', (data) => {
        const ticketId = 'TIX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const totalPrice = data.price * data.quantity;
        const ticket = { ...data, ticketId, totalPrice, timestamp: new Date().toLocaleTimeString() };
        
        STATE.tickets.push(ticket);
        saveData();
        
        const user = STATE.leaderboard[0];
        user.points += 200; // Large XP reward for ticket booking
        
        socket.emit('ticket:confirm', ticket);
    });

    socket.on('emergency:activate', () => {
        // Find path to nearest exit (0,0)
        const path = getPath({ x: 5, y: 5 }, { x: 0, y: 0 }, 'fastest');
        socket.emit('route:result', path);
    });

    socket.on('order:cancel', (data) => {
        STATE.orders = STATE.orders.filter(o => o.id !== data.id);
        saveData();
        io.emit('state:update', STATE);
    });

    socket.on('vehicle:cancel', (data) => {
        STATE.bookings = STATE.bookings.filter(b => b.id !== data.id);
        const v = STATE.vehicles.find(veh => veh.id === data.id);
        if (v) {
            v.status = 'Idle';
            v.target = null;
        }
        saveData();
        io.emit('state:update', STATE);
    });

    socket.on('ticket:cancel', (data) => {
        STATE.tickets = STATE.tickets.filter(t => t.ticketId !== data.ticketId);
        saveData();
        io.emit('state:update', STATE);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SSES Hyper-Intelligent System Online`);
    console.log(`📍 URL: http://0.0.0.0:${PORT}`);
    console.log(`⏱️  Simulation Engine: RUNNING (3s interval)\n`);
});
