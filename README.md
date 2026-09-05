<div align="center">
  <h1>AccessTwin ♿🏛️</h1>
  <h3><i>"Find your destination. Follow the smartest route."</i></h3>
  <p><strong>AI-Powered 3D Campus Digital Twin & Crowd-Aware Barrier-Free Navigation System</strong></p>
  <p><i>Smart India Hackathon / SOA Ideathon 2026 (Problem Statement: SOAIDEATHON-S37)</i></p>
  
  [![React](https://img.shields.io/badge/React-19.x-blue?style=flat-square&logo=react)](https://reactjs.org/)
  [![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D-000000?style=flat-square&logo=three.js)](https://threejs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![YOLOv8](https://img.shields.io/badge/YOLOv8-CCTV_AI-00FFFF?style=flat-square)](https://ultralytics.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
</div>

---

## 📌 Links & Resources
* **🎥 Live Demo Video:** [Click here to watch](https://youtu.be/cX1xIBF4Xcw?si=ZLj8DDvy2Krl5lR5)
* **📑 Pitch Deck / Presentation:** [View PPT Here](https://github.com/user-attachments/files/31342501/IDEATHON.PPT.pdf)

---

## 🚨 The Problem & Our Solution
In India, millions of citizens with physical or visual impairments struggle to navigate public buildings, educational campuses, and hospitals due to unmapped barriers, congested elevators, and inaccessible pathways. 

**AccessTwin** solves this by creating a **real-time 3D spatial digital twin** of the campus. It combines **YOLO CCTV crowd telemetry** with a **dynamic crowd-aware Dijkstra routing engine** to calculate the safest, obstacle-free, and least-crowded accessible routes.

---

## ✨ Key Features

* 🌐 **3D Procedural Digital Twin (Three.js WebGL):** Interactive 360° orbital camera controls with floor-by-floor vertical slicing, elevator shafts, interactive room raycasting, and glowing 3D crowd density heatmaps.
* 🧠 **Live Crowd-Aware Dijkstra Navigation:** Real-time pathfinding engine powered by FastAPI & NetworkX. Uses dynamic impedance penalties (up to 5.0× multiplier) to automatically bypass congested elevators/foyers for wheelchair users and prioritize clear stairwells for standard users.
* 📹 **YOLOv8 CCTV Video Telemetry:** Computes real-time spatial density (people/m²) from camera feeds (`cam01_telemetry.json`), classifying zones into Low 🟢, Moderate 🟡, and High 🔴 congestion.
* 🗣️ **Human-Like Voice Wayfinding:** Full integration with the Web Speech API (`window.speechSynthesis`), providing natural turn-by-turn spoken guidance with live congestion advisories.
* 📸 **TwinGram (Gamified Social Feed):** A community-driven feed where students upload photos of physical barriers with reputation scoring and verified confidence scores.
* 🤖 **AI Vision Intelligence (Gemini AI):** Uses multimodal AI to detect structural features (ramps, stairs, blockages) and generate automated, cost-effective repair estimates.

---

## 📸 Application Screenshots

<table>
  <tr>
    <th width="50%" align="center">🌐 3D Spatial Digital Twin (WebGL)</th>
    <th width="50%" align="center">🧠 Live Crowd-Aware Navigation</th>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/e67b5f68-5fd0-4d6d-80d4-dfd3ac2158b5" width="100%" alt="3D Digital Twin" />
    </td>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/4dbe8b9f-d91d-4e43-b645-0ec40f446e5e" width="100%" alt="Live Crowd-Aware Navigation" />
    </td>
  </tr>
  <tr>
    <th width="50%" align="center">📸 TwinGram Community Social Feed</th>
    <th width="50%" align="center">🤖 AI Multimodal Barrier Detection</th>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/41c2be88-46f5-43ad-b09b-4913dec15053" width="100%" alt="TwinGram Feed" />
    </td>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/66bc54a9-4781-4d2a-9fe7-43964c4aeae0" width="100%" alt="AI Detection" />
    </td>
  </tr>
</table>
---

## 🛠️ Tech Stack & Architecture

**Frontend (Client)**
*   React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion
*   **Three.js / WebGL:** 360° Procedural 3D Digital Twin Engine & Glow Heatmaps
*   **Web Speech API:** Turn-by-Turn Audio Navigation

**Backend & AI Engine**
*   Python 3.11, FastAPI, Uvicorn
*   **YOLOv8 / OpenCV:** CCTV Video Telemetry & Spatial Crowd Density
*   **NetworkX:** Dynamic Impedance Dijkstra Routing Graph
*   **Google Gemini 2.0:** Multimodal Architectural Vision

**Database & Cloud**
*   Supabase PostgreSQL (Spatial database with Row Level Security)
*   Supabase Storage (Image hosting & telemetry logs)

---

## 🚀 How to Run Locally (Single Terminal)

This project uses `concurrently` to run both the React frontend and the FastAPI backend side-by-side with one single command.

### 📋 Prerequisites
* **Node.js (v18+)** - [Download Node.js](https://nodejs.org/)
* **Python (v3.10+)** - [Download Python](https://www.python.org/downloads/)

---

### 1. Clone the Repository
```bash
git clone https://github.com/SaitirthaBehera/AccessTwin.git
cd AccessTwin
```

---

### 2. Install Frontend Dependencies
```bash
npm install
```

---

### 3. Setup Python AI Backend (`venv`)
```powershell
# Navigate into backend directory
cd navigation-backend

# Create virtual environment (Python 3.10 or 3.11)
py -3.11 -m venv venv

# Activate Virtual Environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install backend dependencies (FastAPI, YOLO, NetworkX, Uvicorn)
pip install -r requirements.txt

# Return to root directory
cd ..
```

---

### 4. Configure Environment & API Keys (`.env`)
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Add your API credentials inside `.env`:
```env
# Google Gemini Multimodal Vision API
GEMINI_API_KEY="your_gemini_api_key_here"

# Supabase Real-time Cloud Database
VITE_SUPABASE_URL="your_supabase_project_url"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

---

### 5. Launch Full-Stack Application
Run both Frontend & AI Backend simultaneously with a single command from the root directory:
```bash
npm run dev
```

* 🌐 **Frontend Web Application:** `http://localhost:3000`
* ⚙️ **FastAPI Backend & Interactive Swagger API Docs:** `http://localhost:8000/docs`

---

## 👥 Team & Attribution

This project was ideated, engineered, and shipped by **Team Bajrang Bytes** for the **SOA Ideathon 2026 (Problem Statement: SOAIDEATHON-S37)**:

* 👨‍💻 **Saitirtha Behera** — *3D WebGL Digital Twin, Crowd-Aware Dijkstra Engine & Voice Wayfinding Architecture* ([@SaitirthaBehera](https://github.com/SaitirthaBehera))
* 👨‍💻 **Sujit Kumar Nayak** — *Computer Vision Telemetry, AI Multimodal Integration & Data Pipeline* ([@sujitnayak-web](https://github.com/sujitnayak-web))

---

<div align="center">
  <sub>Built with ❤️ by <b>Team Bajrang Bytes</b> for an accessible, barrier-free, and inclusive tomorrow.</sub>
</div>
