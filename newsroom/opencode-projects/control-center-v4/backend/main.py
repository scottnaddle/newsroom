"""
UBION Control Center v4 - FastAPI Backend

실시간 에이전트 모니터링 및 파이프라인 추적 시스템
"""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
from datetime import datetime

app = FastAPI(
    title="UBION Control Center v4",
    description="AI News Management System - Real-time Monitoring",
    version="4.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """기본 엔드포인트"""
    return {
        "status": "ok",
        "message": "UBION Control Center v4",
        "timestamp": datetime.now().isoformat(),
        "version": "4.0.0"
    }


@app.get("/health")
async def health():
    """헬스 체크"""
    return {
        "status": "healthy",
        "uptime": "running",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/dashboard")
async def get_dashboard():
    """대시보드 데이터 조회"""
    return {
        "agents": [],
        "pipeline": {},
        "stats": {},
        "alerts": [],
        "timestamp": datetime.now().isoformat()
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 실시간 연결"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        print(f"WebSocket error: {e}")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
