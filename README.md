# Smart Stadium Experience System (SSES) 🏟️

A production-ready, hyper-intelligent stadium management platform designed to optimize fan experience and operational efficiency through real-time data visualization, AI-driven routing, and modular service integration.

## 🌟 Key Features

### 📍 2D Digital Twin Map
- **High-Clarity Grid**: A 10x10 top-down schematic of the stadium layout.
- **Dynamic Density Indicators**: Visual vertical "fill" overlays and organic "people dots" representing real-time crowd levels.
- **Heatmap Intelligence**: Instant visual feedback on safe (🟢), moderate (🟡), and high-risk (🔴) zones.

### 🤖 Smart Routing Engine
- **Bidirectional Selection**: Users can choose both **From** and **To** destinations via a simple two-click interaction.
- **A* Pathfinding**: Calculates the most efficient routes across the stadium, avoiding high-density "blockage" areas.

### 🛡️ Real-Time Safety & Alerts
- **AI Monitoring**: Automatic detection of overcrowding and security risks.
- **Active Alerts Dashboard**: Live feed of safety notifications and emergency guidance.
- **Emergency Mode**: One-click activation to reveal white glowing evacuation paths to the nearest exits.

### 🍔 Integrated Fan Services
- **Intelligent Food Ordering**: Dynamic pricing based on queue length and real-time order tracking.
- **Smart Mobility**: Booking for Shuttles, Bikes, and Cabs with real-time ETA and vehicle status management.
- **Digital Ticketing**: Seamless match ticket booking with digital pass generation.

### 📊 Admin Analytics Dashboard
- **Crowd Rankings**: Live leaderboard of most crowded stadium zones.
- **Peak History Tracking**: Historical charts visualizing occupancy trends over time.
- **Sales Intelligence**: Aggregated statistics on popular concessions and sales volume.

## 🚀 Tech Stack
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, CSS3 (Glassmorphism), HTML5
- **Simulation**: Custom engine for crowd density and vehicle logistics.
- **Persistence**: File-based JSON database (`stadium_data.json`).

## 🛠️ Setup & Execution

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/srija312/smart-stadium.git
   cd smart-stadium
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```

4. **Access the Dashboard**:
   Open `http://localhost:3000` in your browser.

## 📝 License
This project is licensed under the MIT License.
