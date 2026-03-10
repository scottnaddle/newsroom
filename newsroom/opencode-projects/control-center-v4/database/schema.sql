-- UBION Control Center v4 - SQLite Schema

-- 에이전트 정보
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
);

-- 에이전트 실행 로그
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
);

-- 파이프라인 추적
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
);

-- 크론 작업
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
);

-- 크론 실행 로그
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
);

-- 경고 및 알림
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
);

-- 파이프라인 통계 (시간대별)
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
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_tracking_article_id ON pipeline_tracking(article_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_tracking_current_stage ON pipeline_tracking(current_stage);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved);
