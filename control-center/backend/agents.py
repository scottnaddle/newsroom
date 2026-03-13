"""
agents.py - Real-time Agent Tracking API

FastAPI endpoints for managing and monitoring agent activities,
states, and performance metrics.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import json
import asyncio
from uuid import uuid4

# ============================================================================
# Models
# ============================================================================

class AgentStateEnum(str, Enum):
    """Agent state enumeration"""
    IDLE = "idle"
    WALKING = "walking"
    TYPING = "typing"
    READING = "reading"
    PROCESSING = "processing"
    PUBLISHING = "publishing"
    ERROR = "error"
    WAITING = "waiting"


class AgentStatusEnum(str, Enum):
    """Agent execution status"""
    IDLE = "idle"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class ActivityLog(BaseModel):
    """Activity log entry"""
    timestamp: str
    action: str
    result: str


class AgentStats(BaseModel):
    """Agent statistics"""
    success_count: int = 0
    failure_count: int = 0
    total_processed: int = 0
    avg_duration_ms: int = 0


class Agent(BaseModel):
    """Agent information"""
    id: str
    name: str
    type: str
    state: AgentStateEnum
    color: str
    status: AgentStatusEnum
    last_run: Optional[str] = None
    stats: AgentStats
    recent_activities: List[ActivityLog] = Field(default_factory=list)
    x: float = 0
    y: float = 0


class AgentUpdate(BaseModel):
    """Agent state update"""
    agent_id: str
    state: AgentStateEnum
    status: Optional[AgentStatusEnum] = None
    position: Optional[tuple[float, float]] = None


class AgentActivity(BaseModel):
    """Agent activity log"""
    agent_id: str
    timestamp: str
    action: str
    result: str


# ============================================================================
# In-Memory Agent Storage (use database in production)
# ============================================================================

agents_db: Dict[str, Dict[str, Any]] = {
    "source-collector": {
        "id": "source-collector",
        "name": "Source Collector",
        "type": "collector",
        "state": AgentStateEnum.IDLE,
        "color": "#4169E1",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 2,
        "y": 2
    },
    "reporter": {
        "id": "reporter",
        "name": "Reporter",
        "type": "reporter",
        "state": AgentStateEnum.IDLE,
        "color": "#228B22",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 8,
        "y": 2
    },
    "writer": {
        "id": "writer",
        "name": "Writer",
        "type": "writer",
        "state": AgentStateEnum.IDLE,
        "color": "#DC143C",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 14,
        "y": 2
    },
    "fact-checker": {
        "id": "fact-checker",
        "name": "Fact Checker",
        "type": "fact-checker",
        "state": AgentStateEnum.IDLE,
        "color": "#9370DB",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 2,
        "y": 8
    },
    "editor-desk": {
        "id": "editor-desk",
        "name": "Editor Desk",
        "type": "editor",
        "state": AgentStateEnum.IDLE,
        "color": "#FF8C00",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 8,
        "y": 8
    },
    "copy-editor": {
        "id": "copy-editor",
        "name": "Copy Editor",
        "type": "copy-editor",
        "state": AgentStateEnum.IDLE,
        "color": "#FFD700",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 8,
        "y": 14
    },
    "publisher": {
        "id": "publisher",
        "name": "Publisher",
        "type": "publisher",
        "state": AgentStateEnum.IDLE,
        "color": "#20B2AA",
        "status": AgentStatusEnum.IDLE,
        "last_run": None,
        "stats": {"success_count": 0, "failure_count": 0, "total_processed": 0, "avg_duration_ms": 0},
        "recent_activities": [],
        "x": 14,
        "y": 8
    }
}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()

# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ============================================================================
# REST Endpoints
# ============================================================================

@router.get("/")
async def get_all_agents() -> List[Agent]:
    """Get all agents"""
    agents = []
    for agent_data in agents_db.values():
        agent = Agent(
            id=agent_data["id"],
            name=agent_data["name"],
            type=agent_data["type"],
            state=agent_data["state"],
            color=agent_data["color"],
            status=agent_data["status"],
            last_run=agent_data["last_run"],
            stats=AgentStats(**agent_data["stats"]),
            recent_activities=[ActivityLog(**act) for act in agent_data["recent_activities"]],
            x=agent_data["x"],
            y=agent_data["y"]
        )
        agents.append(agent)
    return agents


@router.get("/{agent_id}")
async def get_agent(agent_id: str) -> Agent:
    """Get specific agent"""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_data = agents_db[agent_id]
    return Agent(
        id=agent_data["id"],
        name=agent_data["name"],
        type=agent_data["type"],
        state=agent_data["state"],
        color=agent_data["color"],
        status=agent_data["status"],
        last_run=agent_data["last_run"],
        stats=AgentStats(**agent_data["stats"]),
        recent_activities=[ActivityLog(**act) for act in agent_data["recent_activities"]],
        x=agent_data["x"],
        y=agent_data["y"]
    )


@router.post("/{agent_id}/state")
async def update_agent_state(agent_id: str, update: AgentUpdate) -> Dict[str, Any]:
    """Update agent state"""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_data = agents_db[agent_id]
    agent_data["state"] = update.state
    
    if update.status:
        agent_data["status"] = update.status
        agent_data["last_run"] = datetime.now().isoformat()
    
    if update.position:
        agent_data["x"] = update.position[0]
        agent_data["y"] = update.position[1]

    # Broadcast update via WebSocket
    await manager.broadcast({
        "type": "agent_state_updated",
        "agent_id": agent_id,
        "data": agent_data
    })

    return {"status": "ok", "agent_id": agent_id}


@router.get("/{agent_id}/activities")
async def get_agent_activities(agent_id: str, limit: int = 10) -> List[ActivityLog]:
    """Get agent activity log"""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_data = agents_db[agent_id]
    activities = agent_data["recent_activities"][-limit:]
    return [ActivityLog(**act) for act in activities]


@router.post("/{agent_id}/activities")
async def log_agent_activity(agent_id: str, activity: AgentActivity) -> Dict[str, Any]:
    """Log agent activity"""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_data = agents_db[agent_id]
    
    # Add activity
    log_entry = {
        "timestamp": activity.timestamp,
        "action": activity.action,
        "result": activity.result
    }
    agent_data["recent_activities"].append(log_entry)
    
    # Keep only recent 50 activities
    agent_data["recent_activities"] = agent_data["recent_activities"][-50:]

    # Broadcast activity via WebSocket
    await manager.broadcast({
        "type": "agent_activity_logged",
        "agent_id": agent_id,
        "activity": log_entry
    })

    return {"status": "ok", "agent_id": agent_id}


@router.post("/{agent_id}/stats")
async def update_agent_stats(agent_id: str, stats: AgentStats) -> Dict[str, Any]:
    """Update agent statistics"""
    if agent_id not in agents_db:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_data = agents_db[agent_id]
    agent_data["stats"] = stats.dict()

    return {"status": "ok", "agent_id": agent_id}


# ============================================================================
# WebSocket Endpoints
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection for real-time agent updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Handle different message types
            if data.get("type") == "subscribe":
                # Send all current agents
                await websocket.send_json({
                    "type": "agents_snapshot",
                    "data": list(agents_db.values())
                })
            
            elif data.get("type") == "ping":
                # Respond to ping
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============================================================================
# Heartbeat
# ============================================================================

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "agents_count": len(agents_db)
    }
