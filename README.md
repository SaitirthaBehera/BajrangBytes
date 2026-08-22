<div align="center">
  <h1>AccessTwin ♿🏛️</h1>
  <h3><i>"Find your destination. Follow the smartest route."</i></h3>
  <p><strong>Crowdsourced Accessibility Digital Twin for Public Buildings & Campuses</strong></p>
  <p><i>Smart India Hackathon / SOA Ideathon 2026 (Problem Statement: SOAIDEATHON-S37)</i></p>
  
  [![React](https://img.shields.io/badge/React-18.x-blue?style=flat-square&logo=react)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
</div>

---

## 📌 Links & Resources
* **🎥 Live Demo Video:** [Click here to watch](#) *(Insert YouTube/Drive Link)*
* **📑 Pitch Deck / Presentation:** [View PPT Here](#) *(Insert Canva/PDF Link)*

---

## 🚨 The Problem & Our Solution
In India, millions of citizens with physical or visual impairments struggle to navigate public buildings, educational campuses, and hospitals due to unmapped barriers like broken elevators, steep ramps, or blocked pathways. 

**AccessTwin** solves this by creating a real-time, interactive digital twin of any campus. We empower the community to crowdsource physical barriers, verify them using AI, and calculate customized obstacle-free paths. 

---

## ✨ Key Features

* 🗺️ **Interactive Spatial Digital Twin (Dijkstra's Algorithm):** Interactive SVG-based floor maps that map nodes across the campus. The system uses Dijkstra's algorithm to calculate the shortest, safest, and 100% obstacle-free route specifically tailored for wheelchair users.
* 🗣️ **Voice-Guided Wayfinding & Detection:** Full integration with the Web Speech API (`window.speechSynthesis`). The system provides human-like turn-by-turn auditory instructions for navigation and announces AI-detected obstacles for visually impaired users.
* 📸 **TwinGram (Gamified Social Feed):** A community-driven feed where students and visitors upload photos of physical barriers. The community confirms these issues, building a trustable "Confidence Score".
* 🤖 **AI Vision Intelligence (Gemini AI):** Uses Google Gemini's advanced multimodal capabilities for deep contextual analysis, detecting architectural features (like ramps and stairs), and generating automated, cost-effective repair recommendations.
* 📈 **Campus Accessibility Benchmark Index:** Automatically calculates an overall accessibility score for each building based on structural features, crowdsourced verified reports, and automated sensor audits.
* 🛠️ **Admin Dashboard & SVG Ingestion:** Administrators can view reports, plan fixes, and upload new SVG floor maps directly into the digital twin ecosystem.

---

## 📸 Application Screenshots

*(Replace these placeholders with your actual screenshots before submission!)*

| Interactive Digital Twin Map | Turn-by-Turn Voice Navigation |
| :---: | :---: |
| <img src="https://via.placeholder.com/400x250.png?text=Interactive+SVG+Map+Screenshot" alt="Dashboard" /> | <img src="https://via.placeholder.com/400x250.png?text=Voice+Navigation+Screenshot" alt="Map" /> |

| TwinGram Social Feed | AI Barrier Detection |
| :---: | :---: |
| <img src="https://via.placeholder.com/400x250.png?text=TwinGram+Feed+Screenshot" alt="TwinGram" /> | <img src="https://via.placeholder.com/400x250.png?text=Gemini+AI+Detection" alt="AI Detect" /> |

---

## 🛠️ Tech Stack & Architecture

**Frontend (Client)**
*   React 18, Vite, Tailwind CSS v4, Lucide React, Framer Motion
*   Interactive SVG Mapping & Web Speech API

**Backend (Server)**
*   Python 3.11.9, FastAPI, Uvicorn
*   NetworkX (Graph computation for Dijkstra routing)
*   Google GenAI SDK

**Database & Auth**
*   Supabase PostgreSQL (Structured relational data)
*   Supabase Storage (Secure image hosting)
*   Row Level Security (RLS) policies

---

## 🚀 How to Run Locally (Single Terminal)

This project uses `concurrently` to run both the React frontend and the FastAPI backend side-by-side perfectly.

### 1. Clone the repository
```bash
git clone https://github.com/sujitnayak-web/BajrangBytes.git
cd BajrangBytes
```

### 2. Install Dependencies
```bash
npm install
cd navigation-backend
pip install -r requirements.txt
cd ..
```

### 3. Setup AI Environment (Windows PowerShell)
Before running the app, set your Gemini API key in the terminal:
```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

### 4. Start the Application
Run both the frontend and backend with one simple command from the root directory:
```bash
npm run dev
```

*   🌐 **Frontend:** `http://localhost:3000`
*   ⚙️ **Backend API:** `http://localhost:8000`

---

## 🔮 Future Scope
* **IoT Sensor Integration:** Real-time data from automatic doors and elevators to update the digital twin instantly.
* **AR Navigation:** Augmented Reality directions overlaid on the smartphone camera for visually impaired users.

---

<p align="center"><i>Made with ❤️ by Bajrang Bytes for an accessible and inclusive future.</i></p>
