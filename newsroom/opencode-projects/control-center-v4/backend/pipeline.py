"""
pipeline.py - Pipeline Monitoring and Tracking

Tracks article movement through the 8-stage pipeline and provides
real-time statistics on processing status.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from collections import defaultdict
import asyncio

# ============================================================================
# Models
# ============================================================================

class PipelineStageEnum(str, Enum):
    """Pipeline stages"""
    SOURCED = "01-sourced"
    ASSIGNED = "02-assigned"
    REPORTED = "03-reported"
    DRAFTED = "04-drafted"
    FACT_CHECKED = "05-fact-checked"
    DESK_APPROVED = "06-desk-approved"
    COPY_EDITED = "07-copy-edited"
    PUBLISHED = "08-published"
    REJECTED = "rejected"


class ArticleStatusEnum(str, Enum):
    """Article status"""
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    ERROR = "error"


class ArticleTracking(BaseModel):
    """Article tracking information"""
    id: str
    title: str
    current_stage: PipelineStageEnum
    source_stage: Optional[PipelineStageEnum] = None
    entered_stage_at: str
    previous_stage: Optional[PipelineStageEnum] = None
    left_previous_at: Optional[str] = None
    status: ArticleStatusEnum
    trust_score: int = 0  # 0-100
    quality_notes: Optional[str] = None


class PipelineStats(BaseModel):
    """Pipeline statistics for a time period"""
    hour_start: str
    sourced_count: int = 0
    assigned_count: int = 0
    reported_count: int = 0
    drafted_count: int = 0
    fact_checked_count: int = 0
    desk_approved_count: int = 0
    copy_edited_count: int = 0
    published_count: int = 0
    rejected_count: int = 0
    duplicate_detected: int = 0
    avg_quality_score: int = 0


class ArticleMovement(BaseModel):
    """Article movement event"""
    article_id: str
    article_title: str
    from_stage: PipelineStageEnum
    to_stage: PipelineStageEnum
    timestamp: str


# ============================================================================
# In-Memory Storage
# ============================================================================

articles_db: Dict[str, Dict[str, Any]] = {}

# Statistics tracking
stats_hourly: Dict[str, Dict[str, int]] = defaultdict(
    lambda: {
        "sourced": 0,
        "assigned": 0,
        "reported": 0,
        "drafted": 0,
        "fact_checked": 0,
        "desk_approved": 0,
        "copy_edited": 0,
        "published": 0,
        "rejected": 0,
        "duplicate_detected": 0,
        "avg_quality_score": 0
    }
)

# WebSocket connection manager
class PipelineConnectionManager:
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


manager = PipelineConnectionManager()

# ============================================================================
# Router
# ============================================================================

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


# ============================================================================
# REST Endpoints
# ============================================================================

@router.get("/articles")
async def get_all_articles(status: Optional[ArticleStatusEnum] = None) -> List[ArticleTracking]:
    """Get all articles (optionally filtered by status)"""
    articles = []
    for article_data in articles_db.values():
        if status and article_data["status"] != status:
            continue
        
        article = ArticleTracking(
            id=article_data["id"],
            title=article_data["title"],
            current_stage=article_data["current_stage"],
            source_stage=article_data.get("source_stage"),
            entered_stage_at=article_data["entered_stage_at"],
            previous_stage=article_data.get("previous_stage"),
            left_previous_at=article_data.get("left_previous_at"),
            status=article_data["status"],
            trust_score=article_data.get("trust_score", 0),
            quality_notes=article_data.get("quality_notes")
        )
        articles.append(article)
    
    return articles


@router.get("/articles/{article_id}")
async def get_article(article_id: str) -> ArticleTracking:
    """Get specific article tracking information"""
    if article_id not in articles_db:
        raise HTTPException(status_code=404, detail="Article not found")

    article_data = articles_db[article_id]
    return ArticleTracking(
        id=article_data["id"],
        title=article_data["title"],
        current_stage=article_data["current_stage"],
        source_stage=article_data.get("source_stage"),
        entered_stage_at=article_data["entered_stage_at"],
        previous_stage=article_data.get("previous_stage"),
        left_previous_at=article_data.get("left_previous_at"),
        status=article_data["status"],
        trust_score=article_data.get("trust_score", 0),
        quality_notes=article_data.get("quality_notes")
    )


@router.post("/articles")
async def create_article(article: ArticleTracking) -> Dict[str, Any]:
    """Create new article entry"""
    articles_db[article.id] = {
        "id": article.id,
        "title": article.title,
        "current_stage": article.current_stage,
        "source_stage": article.source_stage,
        "entered_stage_at": article.entered_stage_at,
        "previous_stage": article.previous_stage,
        "left_previous_at": article.left_previous_at,
        "status": article.status,
        "trust_score": article.trust_score,
        "quality_notes": article.quality_notes,
        "created_at": datetime.now().isoformat()
    }

    # Update statistics
    hour_key = datetime.now().strftime("%Y-%m-%d %H:00")
    stats_hourly[hour_key]["sourced"] += 1

    # Broadcast
    await manager.broadcast({
        "type": "article_created",
        "article_id": article.id,
        "title": article.title,
        "stage": article.current_stage
    })

    return {"status": "ok", "article_id": article.id}


@router.put("/articles/{article_id}/stage")
async def move_article_stage(
    article_id: str,
    from_stage: PipelineStageEnum,
    to_stage: PipelineStageEnum
) -> Dict[str, Any]:
    """Move article to next stage"""
    if article_id not in articles_db:
        raise HTTPException(status_code=404, detail="Article not found")

    article_data = articles_db[article_id]
    
    # Record movement
    now = datetime.now().isoformat()
    article_data["previous_stage"] = article_data["current_stage"]
    article_data["left_previous_at"] = now
    article_data["current_stage"] = to_stage
    article_data["entered_stage_at"] = now

    # Update statistics
    hour_key = datetime.now().strftime("%Y-%m-%d %H:00")
    stage_map = {
        PipelineStageEnum.SOURCED: "sourced",
        PipelineStageEnum.ASSIGNED: "assigned",
        PipelineStageEnum.REPORTED: "reported",
        PipelineStageEnum.DRAFTED: "drafted",
        PipelineStageEnum.FACT_CHECKED: "fact_checked",
        PipelineStageEnum.DESK_APPROVED: "desk_approved",
        PipelineStageEnum.COPY_EDITED: "copy_edited",
        PipelineStageEnum.PUBLISHED: "published",
        PipelineStageEnum.REJECTED: "rejected"
    }
    
    if to_stage in stage_map:
        stats_hourly[hour_key][stage_map[to_stage]] += 1

    # Broadcast movement
    await manager.broadcast({
        "type": "article_moved",
        "article_id": article_id,
        "from_stage": from_stage,
        "to_stage": to_stage,
        "timestamp": now
    })

    return {"status": "ok", "article_id": article_id, "new_stage": to_stage}


@router.put("/articles/{article_id}/quality")
async def update_article_quality(
    article_id: str,
    trust_score: int,
    quality_notes: Optional[str] = None
) -> Dict[str, Any]:
    """Update article quality metrics"""
    if article_id not in articles_db:
        raise HTTPException(status_code=404, detail="Article not found")

    article_data = articles_db[article_id]
    article_data["trust_score"] = max(0, min(100, trust_score))
    if quality_notes:
        article_data["quality_notes"] = quality_notes

    # Update hourly statistics
    hour_key = datetime.now().strftime("%Y-%m-%d %H:00")
    total_articles = len([a for a in articles_db.values() if a["status"] != ArticleStatusEnum.REJECTED])
    if total_articles > 0:
        avg_score = sum(a.get("trust_score", 0) for a in articles_db.values()) / total_articles
        stats_hourly[hour_key]["avg_quality_score"] = int(avg_score)

    return {"status": "ok", "article_id": article_id}


@router.get("/stats/hourly")
async def get_hourly_stats(hours: int = 24) -> List[PipelineStats]:
    """Get hourly pipeline statistics"""
    now = datetime.now()
    stats = []

    for i in range(hours):
        hour_time = now - timedelta(hours=i)
        hour_key = hour_time.strftime("%Y-%m-%d %H:00")
        
        hour_stats = stats_hourly.get(hour_key, {})
        
        stats.append(PipelineStats(
            hour_start=hour_key,
            sourced_count=hour_stats.get("sourced", 0),
            assigned_count=hour_stats.get("assigned", 0),
            reported_count=hour_stats.get("reported", 0),
            drafted_count=hour_stats.get("drafted", 0),
            fact_checked_count=hour_stats.get("fact_checked", 0),
            desk_approved_count=hour_stats.get("desk_approved", 0),
            copy_edited_count=hour_stats.get("copy_edited", 0),
            published_count=hour_stats.get("published", 0),
            rejected_count=hour_stats.get("rejected", 0),
            duplicate_detected=hour_stats.get("duplicate_detected", 0),
            avg_quality_score=hour_stats.get("avg_quality_score", 0)
        ))

    return stats


@router.get("/stats/summary")
async def get_pipeline_summary() -> Dict[str, Any]:
    """Get overall pipeline summary"""
    total = len(articles_db)
    
    stage_counts = defaultdict(int)
    for article in articles_db.values():
        stage_counts[article["current_stage"]] += 1

    avg_quality = 0
    if total > 0:
        avg_quality = sum(a.get("trust_score", 0) for a in articles_db.values()) / total

    return {
        "total_articles": total,
        "published": stage_counts[PipelineStageEnum.PUBLISHED],
        "rejected": stage_counts[PipelineStageEnum.REJECTED],
        "in_progress": total - stage_counts[PipelineStageEnum.PUBLISHED] - stage_counts[PipelineStageEnum.REJECTED],
        "avg_quality_score": int(avg_quality),
        "stage_distribution": dict(stage_counts)
    }


# ============================================================================
# WebSocket Endpoints
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection for real-time pipeline updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "subscribe":
                # Send current pipeline snapshot
                await websocket.send_json({
                    "type": "pipeline_snapshot",
                    "articles": len(articles_db),
                    "summary": await get_pipeline_summary()
                })
            
            elif data.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "articles_count": len(articles_db)
    }
