# OpSight - Operations Insight Dashboard

A real-time Prometheus metrics viewer with automated JIRA alerting.

## Prerequisites

- **Node.js** (v14 or higher) - for React frontend
- **Python 3** (v3.7 or higher) - for Flask backend
- **pip** - Python package manager

## Quick Start

### 1. Install Frontend Dependencies

Open a terminal in the project root directory:

```bash
npm install
```

### 2. Install Backend Dependencies

Navigate to the backend directory and install Python packages:

```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Run the Backend (Flask API)

In a terminal, navigate to the backend directory and start the Flask server:

```bash
cd backend
python app.py
```

The backend will start on **http://localhost:5000**

**Backend Endpoints:**
- Health check: `http://localhost:5000/api/health`
- Alert endpoint: `http://localhost:5000/api/alert` (POST)
- Critical metrics: `http://localhost:5000/api/critical-metrics` (GET)

### 4. Run the Frontend (React App)

Open a **NEW terminal** in the project root directory and start the React app:

```bash
npm start
```

The frontend will automatically open in your browser at **http://localhost:3009**

## Complete Run Commands

### Option 1: Run Manually (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```bash
npm start
```

### Option 2: Windows PowerShell (One Script)

Create a `run.ps1` file:
```powershell
# Start backend in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python app.py"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
npm start
```

Run with:
```bash
powershell -ExecutionPolicy Bypass -File run.ps1
```

### Option 3: Bash Script (Linux/Mac)

Create a `run.sh` file:
```bash
#!/bin/bash
# Start backend in background
cd backend && python app.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
cd ..
npm start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
```

Run with:
```bash
chmod +x run.sh
./run.sh
```

## Application URLs

- **Frontend:** http://localhost:3009
- **Backend API:** http://localhost:5000
- **Prometheus Proxy:** https://prometheus.odp-main.duckdns.org

## Features

- ✅ Real-time Prometheus metrics visualization
- ✅ Metric comparison (current vs yesterday)
- ✅ Threshold-based alerting
- ✅ Automatic JIRA ticket creation for critical alerts
- ✅ Category-based metric filtering
- ✅ Search functionality

## Project Structure

```
├── backend/
│   ├── app.py              # Flask API server
│   └── requirements.txt    # Python dependencies
├── src/
│   ├── App.js              # Main React component
│   ├── components/         # React components
│   │   ├── MetricsSelector.js
│   │   └── MetricDataViewer.js
│   └── services/           # API services
├── public/                 # Static files
└── package.json           # Node.js dependencies
```

## Environment Variables (Optional)

Backend environment variables can be set in `backend/.env`:
```
JIRA_URL=your_jira_url
JIRA_USERNAME=your_username
JIRA_API_TOKEN=your_token
JIRA_PROJECT_KEY=your_project_key
```

## Troubleshooting

**Port already in use:**
- Frontend: Change port in `package.json` script or set `PORT=3009` environment variable
- Backend: Change port in `backend/app.py` (default: 5000)

**Python dependencies error:**
```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

**Node modules error:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## Notes

- The frontend proxies API requests to Prometheus through the proxy configured in `package.json`
- The backend handles JIRA alerting and runs on port 5000
- Both services must be running for full functionality

