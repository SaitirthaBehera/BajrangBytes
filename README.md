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

| 🌐 3D Spatial Digital Twin (WebGL) | 🧠 Live Crowd-Aware Navigation |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/63dd14c9-7088-4e3f-ba74-6503c9ea8d58" width="100%" alt="3D Digital Twin Map" /> | <img src="https://github.com/user-attachments/assets/268a0c86-8ec7-40df-adaa-968482f6cc4a" width="100%" alt="Crowd Aware Route" /> |

| 📸 TwinGram Community Social Feed | 🤖 AI Multimodal Barrier Detection |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/41c2be88-46f5-43ad-b09b-4913dec15053" width="100%" alt="TwinGram Feed" /> | <img src="https://github.com/user-attachments/assets/66bc54a9-4781-4d2a-9fe7-43964c4aeae0" width="100%" alt="AI Detection" /> |

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

### 1. Clone & Setup
```bash
git clone https://github.com/SaitirthaBehera/BajrangBytes.git
cd BajrangBytes
