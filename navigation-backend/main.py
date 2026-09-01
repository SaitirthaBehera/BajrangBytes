import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.detect import router as detect_router
from routes.navigate import router as navigate_router
from routes.recommendations import router as recommendations_router
from routes.crowd import router as crowd_router
app=FastAPI(title="S37 Accessibility Digital Twin API",description="Backend AI Vision, Dijkstra Accessible Navigation, Low-Cost Recommendation Engine, and Crowd Density Telemetry for ITER Campus.",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
static_dir=os.path.join(os.path.dirname(__file__),"static")
if os.path.exists(static_dir): app.mount("/static",StaticFiles(directory=static_dir),name="static")
app.include_router(detect_router,prefix="/api",tags=["CV Detection"])
app.include_router(navigate_router,prefix="/api",tags=["Navigation"])
app.include_router(recommendations_router,prefix="/api",tags=["Recommendations"])
app.include_router(crowd_router,prefix="/api",tags=["Crowd Density"])
@app.get("/")
def root(): return {"status":"online","message":"S37 Accessibility Digital Twin Backend is running.","docs_url":"/docs"}
@app.get("/health")
@app.get("/fastapi/health")
async def health_check(): return {"status":"ok","service":"AccessTwin Backend"}
if __name__=="__main__": uvicorn.run("main:app",host="0.0.0.0",port=8000,reload=True)
