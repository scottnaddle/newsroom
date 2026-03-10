"""
tests/test_integration.py - Integration Tests

Comprehensive integration tests for Canvas + API + Database system.
Tests agent tracking, pipeline movement, and statistics generation.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch
from pathlib import Path
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import agents_db, Agent, AgentUpdate, AgentStateEnum, AgentStatusEnum
from pipeline import articles_db, ArticleTracking, PipelineStageEnum, ArticleStatusEnum
from database.logger import AgentLogger, DatabaseConnection

# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def agent_logger():
    """Create test logger"""
    # Use in-memory database for testing
    test_db = Path("/tmp/test_ubion_control.db")
    logger = AgentLogger(test_db)
    yield logger
    # Cleanup
    if test_db.exists():
        test_db.unlink()


@pytest.fixture
def clear_agents():
    """Clear agents database before each test"""
    agents_db.clear()
    yield
    agents_db.clear()


@pytest.fixture
def clear_articles():
    """Clear articles database before each test"""
    articles_db.clear()
    yield
    articles_db.clear()


# ============================================================================
# Agent Logging Tests
# ============================================================================

class TestAgentLogging:
    """Test agent activity logging"""

    def test_log_agent_start(self, agent_logger):
        """Test logging agent start"""
        log_id = agent_logger.log_agent_start(
            agent_id="test-agent",
            agent_name="Test Agent",
            agent_type="test",
            input_count=5
        )
        
        assert log_id is not None
        assert "test-agent" in log_id

    def test_log_agent_success(self, agent_logger):
        """Test logging agent success"""
        log_id = agent_logger.log_agent_start(
            agent_id="test-agent",
            agent_name="Test Agent",
            agent_type="test",
            input_count=5
        )
        
        agent_logger.log_agent_success(
            log_id=log_id,
            output_count=5,
            duration_ms=1000
        )
        
        logs = agent_logger.get_agent_logs("test-agent")
        assert len(logs) > 0
        assert logs[0]["status"] == "success"
        assert logs[0]["duration_ms"] == 1000

    def test_log_agent_failure(self, agent_logger):
        """Test logging agent failure"""
        log_id = agent_logger.log_agent_start(
            agent_id="test-agent",
            agent_name="Test Agent",
            agent_type="test",
            input_count=5
        )
        
        agent_logger.log_agent_failure(
            log_id=log_id,
            error_message="Test error",
            duration_ms=500
        )
        
        logs = agent_logger.get_agent_logs("test-agent")
        assert len(logs) > 0
        assert logs[0]["status"] == "failure"
        assert logs[0]["error_message"] == "Test error"

    def test_get_agent_logs(self, agent_logger):
        """Test retrieving agent logs"""
        for i in range(5):
            log_id = agent_logger.log_agent_start(
                agent_id="test-agent",
                agent_name="Test Agent",
                agent_type="test",
                input_count=1
            )
            agent_logger.log_agent_success(log_id, 1, 100 * (i + 1))

        logs = agent_logger.get_agent_logs("test-agent", limit=10)
        assert len(logs) == 5

    def test_agent_stats_update(self, agent_logger):
        """Test agent statistics are updated correctly"""
        # Create success logs
        for i in range(3):
            log_id = agent_logger.log_agent_start(
                agent_id="test-agent",
                agent_name="Test Agent",
                agent_type="test",
                input_count=1
            )
            agent_logger.log_agent_success(log_id, 1, 100)

        # Create failure log
        log_id = agent_logger.log_agent_start(
            agent_id="test-agent",
            agent_name="Test Agent",
            agent_type="test",
            input_count=1
        )
        agent_logger.log_agent_failure(log_id, "error", 100)

        # Check statistics
        stats = agent_logger.get_database_stats()
        assert stats["logs"] >= 4


# ============================================================================
# Pipeline Tracking Tests
# ============================================================================

class TestPipelineTracking:
    """Test pipeline tracking functionality"""

    def test_track_article_movement(self, agent_logger):
        """Test tracking article movement"""
        agent_logger.track_article_movement(
            article_id="article-1",
            title="Test Article",
            from_stage="01-sourced",
            to_stage="02-assigned"
        )
        
        tracking = agent_logger.get_article_tracking("article-1")
        assert tracking is not None
        assert tracking["article_id"] == "article-1"
        assert tracking["current_stage"] == "02-assigned"

    def test_article_movement_sequence(self, agent_logger):
        """Test sequence of article movements"""
        stages = [
            "01-sourced", "02-assigned", "03-reported",
            "04-drafted", "05-fact-checked", "06-desk-approved",
            "07-copy-edited", "08-published"
        ]
        
        previous_stage = stages[0]
        for stage in stages[1:]:
            agent_logger.track_article_movement(
                article_id="article-1",
                title="Test Article",
                from_stage=previous_stage,
                to_stage=stage
            )
            previous_stage = stage

        tracking = agent_logger.get_article_tracking("article-1")
        assert tracking["current_stage"] == "08-published"

    def test_multiple_articles_tracking(self, agent_logger):
        """Test tracking multiple articles"""
        for i in range(5):
            agent_logger.track_article_movement(
                article_id=f"article-{i}",
                title=f"Article {i}",
                from_stage="01-sourced",
                to_stage="02-assigned"
            )

        stats = agent_logger.get_database_stats()
        assert stats["tracking"] >= 5


# ============================================================================
# Statistics Tests
# ============================================================================

class TestStatistics:
    """Test statistics generation"""

    def test_update_hourly_stats(self, agent_logger):
        """Test updating hourly statistics"""
        hour_start = datetime.now().strftime("%Y-%m-%d %H:00")
        
        stats = {
            "sourced": 10,
            "assigned": 8,
            "reported": 6,
            "drafted": 5,
            "fact_checked": 4,
            "desk_approved": 3,
            "copy_edited": 2,
            "published": 1,
            "rejected": 1,
            "duplicate_detected": 0,
            "avg_quality_score": 85
        }
        
        agent_logger.update_hourly_stats(hour_start, stats)
        
        hourly_stats = agent_logger.get_hourly_stats(hours=1)
        assert len(hourly_stats) > 0
        assert hourly_stats[0]["published_count"] == 1

    def test_get_hourly_stats(self, agent_logger):
        """Test retrieving hourly statistics"""
        hour_start = datetime.now().strftime("%Y-%m-%d %H:00")
        stats = {"sourced": 5, "published": 2, "avg_quality_score": 80}
        agent_logger.update_hourly_stats(hour_start, stats)
        
        hourly = agent_logger.get_hourly_stats(hours=24)
        assert len(hourly) > 0


# ============================================================================
# Alert Tests
# ============================================================================

class TestAlerts:
    """Test alert functionality"""

    def test_log_alert(self, agent_logger):
        """Test logging an alert"""
        agent_logger.log_alert(
            alert_type="duplicate_detected",
            severity="warning",
            title="Duplicate Article Found",
            description="Article article-1 is duplicate of article-2",
            source_agent_id="editor-desk",
            article_id="article-1"
        )
        
        alerts = agent_logger.get_unresolved_alerts(limit=1)
        assert len(alerts) > 0
        assert alerts[0]["type"] == "duplicate_detected"

    def test_multiple_alerts(self, agent_logger):
        """Test logging multiple alerts"""
        for i in range(5):
            agent_logger.log_alert(
                alert_type="quality_low",
                severity="warning",
                title=f"Low Quality Article {i}",
                description=f"Article {i} has low quality score",
                article_id=f"article-{i}"
            )
        
        alerts = agent_logger.get_unresolved_alerts(limit=10)
        assert len(alerts) >= 5


# ============================================================================
# Database Operations Tests
# ============================================================================

class TestDatabaseOperations:
    """Test database operations"""

    def test_database_initialization(self, agent_logger):
        """Test database is properly initialized"""
        stats = agent_logger.get_database_stats()
        assert "agents" in stats
        assert "logs" in stats
        assert "tracking" in stats
        assert "size_bytes" in stats

    def test_database_size(self, agent_logger):
        """Test database size calculation"""
        # Add some data
        for i in range(10):
            log_id = agent_logger.log_agent_start(
                agent_id=f"agent-{i}",
                agent_name=f"Agent {i}",
                agent_type="test",
                input_count=1
            )
            agent_logger.log_agent_success(log_id, 1, 100)

        size = agent_logger.get_database_size()
        assert size > 0

    def test_cleanup_old_logs(self, agent_logger):
        """Test cleanup of old logs"""
        # Add logs
        for i in range(5):
            log_id = agent_logger.log_agent_start(
                agent_id="test-agent",
                agent_name="Test Agent",
                agent_type="test",
                input_count=1
            )
            agent_logger.log_agent_success(log_id, 1, 100)

        # Cleanup should not delete recent logs
        agent_logger.cleanup_old_logs(days=30)
        
        logs = agent_logger.get_agent_logs("test-agent")
        assert len(logs) == 5


# ============================================================================
# End-to-End Tests
# ============================================================================

class TestEndToEnd:
    """End-to-end integration tests"""

    def test_full_agent_lifecycle(self, agent_logger):
        """Test complete agent lifecycle"""
        # Agent starts
        log_id = agent_logger.log_agent_start(
            agent_id="writer",
            agent_name="Writer",
            agent_type="writer",
            input_count=10
        )
        
        # Agent processes
        agent_logger.log_agent_success(log_id, 10, 2000)
        
        # Check results
        logs = agent_logger.get_agent_logs("writer")
        assert len(logs) == 1
        assert logs[0]["status"] == "success"
        assert logs[0]["input_count"] == 10
        assert logs[0]["output_count"] == 10

    def test_full_article_pipeline(self, agent_logger):
        """Test complete article through pipeline"""
        article_id = "article-1"
        title = "Breaking News"
        
        stages = [
            "01-sourced", "02-assigned", "03-reported",
            "04-drafted", "05-fact-checked", "06-desk-approved",
            "07-copy-edited", "08-published"
        ]
        
        # Move article through all stages
        for i in range(1, len(stages)):
            agent_logger.track_article_movement(
                article_id=article_id,
                title=title,
                from_stage=stages[i-1],
                to_stage=stages[i]
            )
        
        # Verify final state
        tracking = agent_logger.get_article_tracking(article_id)
        assert tracking["current_stage"] == "08-published"

    def test_multiple_agents_multiple_articles(self, agent_logger):
        """Test system with multiple agents processing multiple articles"""
        agents = ["reporter", "writer", "fact-checker", "editor-desk"]
        articles = [f"article-{i}" for i in range(5)]
        
        # Agents process articles
        for agent in agents:
            for article in articles:
                log_id = agent_logger.log_agent_start(
                    agent_id=agent,
                    agent_name=agent.replace("-", " ").title(),
                    agent_type=agent,
                    input_count=1
                )
                agent_logger.log_agent_success(log_id, 1, 500)
        
        # Verify statistics
        stats = agent_logger.get_database_stats()
        assert stats["logs"] == len(agents) * len(articles)


# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Performance tests"""

    def test_large_log_volume(self, agent_logger):
        """Test handling large volume of logs"""
        agent_id = "test-agent"
        
        # Create 1000 logs
        for i in range(1000):
            log_id = agent_logger.log_agent_start(
                agent_id=agent_id,
                agent_name="Test Agent",
                agent_type="test",
                input_count=1
            )
            if i % 2 == 0:
                agent_logger.log_agent_success(log_id, 1, 100)
            else:
                agent_logger.log_agent_failure(log_id, "error", 100)
        
        # Query logs
        logs = agent_logger.get_agent_logs(agent_id, limit=50)
        assert len(logs) == 50

    def test_query_performance(self, agent_logger):
        """Test query performance"""
        # Add test data
        for i in range(100):
            agent_logger.track_article_movement(
                article_id=f"article-{i}",
                title=f"Article {i}",
                from_stage="01-sourced",
                to_stage="02-assigned"
            )
        
        # Measure query time
        import time
        start = time.time()
        for i in range(100):
            agent_logger.get_article_tracking(f"article-{i}")
        elapsed = time.time() - start
        
        # Should complete 100 queries in less than 1 second
        assert elapsed < 1.0


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Test error handling"""

    def test_invalid_agent_id(self, agent_logger):
        """Test handling of invalid agent ID"""
        logs = agent_logger.get_agent_logs("non-existent-agent")
        assert logs == []

    def test_invalid_article_id(self, agent_logger):
        """Test handling of invalid article ID"""
        tracking = agent_logger.get_article_tracking("non-existent-article")
        assert tracking is None

    def test_concurrent_logging(self, agent_logger):
        """Test concurrent logging operations"""
        import threading
        
        def log_activities():
            for i in range(10):
                log_id = agent_logger.log_agent_start(
                    agent_id="concurrent-agent",
                    agent_name="Concurrent Agent",
                    agent_type="test",
                    input_count=1
                )
                agent_logger.log_agent_success(log_id, 1, 100)
        
        # Run concurrent operations
        threads = [threading.Thread(target=log_activities) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Verify all logs were recorded
        logs = agent_logger.get_agent_logs("concurrent-agent", limit=1000)
        assert len(logs) == 50


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
