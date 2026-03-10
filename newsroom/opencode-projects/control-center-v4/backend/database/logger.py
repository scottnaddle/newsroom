"""
database/logger.py - SQLite Agent Activity Logger

Handles all database operations for logging agent activities,
storing statistics, and retrieving historical data.
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager
from pathlib import Path
import json
import threading

# ============================================================================
# Database Configuration
# ============================================================================

DATABASE_PATH = Path(__file__).parent.parent.parent / "database" / "ubion-control.db"

# Ensure database directory exists
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


# ============================================================================
# Database Connection Manager
# ============================================================================

class DatabaseConnection:
    """Context manager for database connections"""
    
    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None
        self.cursor: Optional[sqlite3.Cursor] = None

    def __enter__(self) -> sqlite3.Cursor:
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        return self.cursor

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type:
                self.conn.rollback()
            else:
                self.conn.commit()
            self.conn.close()


# ============================================================================
# Agent Logger
# ============================================================================

class AgentLogger:
    """Logger for agent activities"""

    def __init__(self, db_path: Path = DATABASE_PATH):
        self.db_path = db_path
        self.lock = threading.RLock()
        self._init_database()

    def _init_database(self):
        """Initialize database schema"""
        with DatabaseConnection(self.db_path) as cursor:
            # Agents table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT DEFAULT 'idle',
                    last_run DATETIME,
                    last_success DATETIME,
                    last_failure DATETIME,
                    success_count INTEGER DEFAULT 0,
                    failure_count INTEGER DEFAULT 0,
                    total_processed INTEGER DEFAULT 0,
                    avg_duration_ms INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Agent logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS agent_logs (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME,
                    duration_ms INTEGER,
                    input_count INTEGER,
                    output_count INTEGER,
                    error_message TEXT,
                    details TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            """)

            # Pipeline tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_tracking (
                    id TEXT PRIMARY KEY,
                    article_id TEXT NOT NULL,
                    title TEXT,
                    current_stage TEXT NOT NULL,
                    source_stage TEXT,
                    entered_stage_at DATETIME,
                    previous_stage TEXT,
                    left_previous_at DATETIME,
                    status TEXT DEFAULT 'in-progress',
                    trust_score INTEGER DEFAULT 0,
                    quality_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Cron jobs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cron_jobs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    agent_name TEXT,
                    schedule TEXT NOT NULL,
                    last_run DATETIME,
                    last_status TEXT,
                    next_run DATETIME,
                    success_count INTEGER DEFAULT 0,
                    failure_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Cron logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cron_logs (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME,
                    duration_ms INTEGER,
                    output TEXT,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (job_id) REFERENCES cron_jobs(id)
                )
            """)

            # Alerts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    source_agent_id TEXT,
                    article_id TEXT,
                    is_resolved BOOLEAN DEFAULT 0,
                    resolved_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Pipeline stats table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_stats (
                    id TEXT PRIMARY KEY,
                    hour_start DATETIME NOT NULL UNIQUE,
                    sourced_count INTEGER DEFAULT 0,
                    assigned_count INTEGER DEFAULT 0,
                    reported_count INTEGER DEFAULT 0,
                    drafted_count INTEGER DEFAULT 0,
                    fact_checked_count INTEGER DEFAULT 0,
                    desk_approved_count INTEGER DEFAULT 0,
                    copy_edited_count INTEGER DEFAULT 0,
                    published_count INTEGER DEFAULT 0,
                    rejected_count INTEGER DEFAULT 0,
                    duplicate_detected INTEGER DEFAULT 0,
                    avg_quality_score INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON agent_logs(agent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pipeline_tracking_article_id ON pipeline_tracking(article_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pipeline_tracking_current_stage ON pipeline_tracking(current_stage)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved)")

    # ========================================================================
    # Agent Operations
    # ========================================================================

    def log_agent_start(self, agent_id: str, agent_name: str, agent_type: str, input_count: int) -> str:
        """Log agent start"""
        with self.lock:
            log_id = f"{agent_id}_{datetime.now().timestamp()}"
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    INSERT OR IGNORE INTO agents (id, name, type)
                    VALUES (?, ?, ?)
                """, (agent_id, agent_name, agent_type))

                cursor.execute("""
                    INSERT INTO agent_logs
                    (id, agent_id, status, start_time, input_count)
                    VALUES (?, ?, ?, ?, ?)
                """, (log_id, agent_id, "running", datetime.now().isoformat(), input_count))
            
            return log_id

    def log_agent_success(self, log_id: str, output_count: int, duration_ms: int):
        """Log agent success"""
        with self.lock:
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    UPDATE agent_logs
                    SET status = ?, end_time = ?, duration_ms = ?, output_count = ?
                    WHERE id = ?
                """, ("success", datetime.now().isoformat(), duration_ms, output_count, log_id))

                # Update agent stats
                cursor.execute("""
                    SELECT agent_id FROM agent_logs WHERE id = ?
                """, (log_id,))
                result = cursor.fetchone()
                if result:
                    agent_id = result[0]
                    cursor.execute("""
                        UPDATE agents
                        SET success_count = success_count + 1,
                            total_processed = total_processed + 1,
                            last_success = ?,
                            last_run = ?
                        WHERE id = ?
                    """, (datetime.now().isoformat(), datetime.now().isoformat(), agent_id))

    def log_agent_failure(self, log_id: str, error_message: str, duration_ms: int):
        """Log agent failure"""
        with self.lock:
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    UPDATE agent_logs
                    SET status = ?, end_time = ?, duration_ms = ?, error_message = ?
                    WHERE id = ?
                """, ("failure", datetime.now().isoformat(), duration_ms, error_message, log_id))

                # Update agent stats
                cursor.execute("""
                    SELECT agent_id FROM agent_logs WHERE id = ?
                """, (log_id,))
                result = cursor.fetchone()
                if result:
                    agent_id = result[0]
                    cursor.execute("""
                        UPDATE agents
                        SET failure_count = failure_count + 1,
                            total_processed = total_processed + 1,
                            last_failure = ?,
                            last_run = ?
                        WHERE id = ?
                    """, (datetime.now().isoformat(), datetime.now().isoformat(), agent_id))

    def get_agent_logs(self, agent_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get agent logs"""
        with DatabaseConnection(self.db_path) as cursor:
            cursor.execute("""
                SELECT * FROM agent_logs
                WHERE agent_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (agent_id, limit))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    # ========================================================================
    # Pipeline Operations
    # ========================================================================

    def track_article_movement(self, article_id: str, title: str, from_stage: str, to_stage: str):
        """Track article movement between stages"""
        with self.lock:
            track_id = f"{article_id}_{to_stage}_{datetime.now().timestamp()}"
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    INSERT INTO pipeline_tracking
                    (id, article_id, title, current_stage, previous_stage, entered_stage_at, left_previous_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    track_id, article_id, title, to_stage, from_stage,
                    datetime.now().isoformat(), datetime.now().isoformat(), "in-progress"
                ))

    def get_article_tracking(self, article_id: str) -> Optional[Dict[str, Any]]:
        """Get article tracking information"""
        with DatabaseConnection(self.db_path) as cursor:
            cursor.execute("""
                SELECT * FROM pipeline_tracking
                WHERE article_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (article_id,))
            
            row = cursor.fetchone()
            return dict(row) if row else None

    # ========================================================================
    # Statistics Operations
    # ========================================================================

    def update_hourly_stats(self, hour_start: str, stats: Dict[str, int]):
        """Update hourly pipeline statistics"""
        with self.lock:
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    INSERT OR REPLACE INTO pipeline_stats
                    (hour_start, sourced_count, assigned_count, reported_count, drafted_count,
                     fact_checked_count, desk_approved_count, copy_edited_count, published_count,
                     rejected_count, duplicate_detected, avg_quality_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    hour_start,
                    stats.get("sourced", 0),
                    stats.get("assigned", 0),
                    stats.get("reported", 0),
                    stats.get("drafted", 0),
                    stats.get("fact_checked", 0),
                    stats.get("desk_approved", 0),
                    stats.get("copy_edited", 0),
                    stats.get("published", 0),
                    stats.get("rejected", 0),
                    stats.get("duplicate_detected", 0),
                    stats.get("avg_quality_score", 0)
                ))

    def get_hourly_stats(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get hourly statistics"""
        with DatabaseConnection(self.db_path) as cursor:
            start_time = (datetime.now() - timedelta(hours=hours)).isoformat()
            cursor.execute("""
                SELECT * FROM pipeline_stats
                WHERE hour_start >= ?
                ORDER BY hour_start DESC
            """, (start_time,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    # ========================================================================
    # Alert Operations
    # ========================================================================

    def log_alert(self, alert_type: str, severity: str, title: str, description: str,
                  source_agent_id: Optional[str] = None, article_id: Optional[str] = None):
        """Log an alert"""
        with self.lock:
            alert_id = f"alert_{datetime.now().timestamp()}"
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    INSERT INTO alerts
                    (id, type, severity, title, description, source_agent_id, article_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (alert_id, alert_type, severity, title, description, source_agent_id, article_id))

    def get_unresolved_alerts(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get unresolved alerts"""
        with DatabaseConnection(self.db_path) as cursor:
            cursor.execute("""
                SELECT * FROM alerts
                WHERE is_resolved = 0
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    # ========================================================================
    # Database Maintenance
    # ========================================================================

    def cleanup_old_logs(self, days: int = 30):
        """Delete logs older than specified days"""
        with self.lock:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            with DatabaseConnection(self.db_path) as cursor:
                cursor.execute("""
                    DELETE FROM agent_logs
                    WHERE created_at < ?
                """, (cutoff_date,))
                
                cursor.execute("""
                    DELETE FROM cron_logs
                    WHERE created_at < ?
                """, (cutoff_date,))

    def get_database_size(self) -> int:
        """Get database file size in bytes"""
        return self.db_path.stat().st_size if self.db_path.exists() else 0

    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with DatabaseConnection(self.db_path) as cursor:
            cursor.execute("SELECT COUNT(*) FROM agents")
            agents_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM agent_logs")
            logs_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM pipeline_tracking")
            tracking_count = cursor.fetchone()[0]
            
            return {
                "agents": agents_count,
                "logs": logs_count,
                "tracking": tracking_count,
                "size_bytes": self.get_database_size()
            }


# ============================================================================
# Singleton Instance
# ============================================================================

_logger_instance: Optional[AgentLogger] = None


def get_logger() -> AgentLogger:
    """Get or create logger instance"""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = AgentLogger()
    return _logger_instance
