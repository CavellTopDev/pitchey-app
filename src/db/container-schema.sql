-- ===================================================
-- Pitchey Container Infrastructure Database Schema
-- Cloudflare Workers + Containers Integration
-- ===================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ===== CONTAINER JOBS TABLE =====
-- Tracks all containerized processing jobs

CREATE TABLE IF NOT EXISTS container_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'video-processing',
        'document-processing', 
        'ai-inference',
        'media-transcoding',
        'code-execution'
    )),
    
    -- Job metadata
    payload JSONB NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'retrying'
    )),
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Container assignment
    container_id UUID,
    container_instance VARCHAR(100),
    
    -- Error handling
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    error_stack TEXT,
    
    -- Results
    result JSONB,
    output_urls JSONB,
    metrics JSONB,
    
    -- Cost tracking
    processing_time_seconds INTEGER,
    estimated_cost_usd DECIMAL(10, 4),
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    organization_id UUID,
    
    -- Indexes for efficient querying
    CONSTRAINT valid_timing CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= COALESCE(started_at, created_at))
    )
);

-- Indexes for container_jobs
CREATE INDEX idx_container_jobs_status ON container_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_container_jobs_type ON container_jobs(type);
CREATE INDEX idx_container_jobs_priority ON container_jobs(priority, created_at);
CREATE INDEX idx_container_jobs_created_at ON container_jobs(created_at DESC);
CREATE INDEX idx_container_jobs_container_id ON container_jobs(container_id);
CREATE INDEX idx_container_jobs_organization ON container_jobs(organization_id);

-- Composite indexes for common queries
CREATE INDEX idx_container_jobs_status_type ON container_jobs(status, type);
CREATE INDEX idx_container_jobs_type_created ON container_jobs(type, created_at DESC);

-- Partial indexes for performance
CREATE INDEX idx_container_jobs_active ON container_jobs(created_at DESC) 
    WHERE status IN ('pending', 'processing', 'retrying');
CREATE INDEX idx_container_jobs_failed_retryable ON container_jobs(created_at DESC)
    WHERE status = 'failed' AND retry_count < max_retries;

-- ===== CONTAINER INSTANCES TABLE =====
-- Tracks running container instances

CREATE TABLE IF NOT EXISTS container_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_name VARCHAR(100) NOT NULL,
    container_type VARCHAR(50) NOT NULL,
    instance_type VARCHAR(50) NOT NULL, -- standard-1, standard-2, standard-4, lite
    
    -- Status and health
    status VARCHAR(20) NOT NULL DEFAULT 'starting' CHECK (status IN (
        'starting', 'ready', 'busy', 'stopping', 'stopped', 'error'
    )),
    health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN (
        'healthy', 'unhealthy', 'unknown'
    )),
    
    -- Resource usage
    cpu_usage_percent DECIMAL(5, 2),
    memory_usage_percent DECIMAL(5, 2),
    active_jobs_count INTEGER DEFAULT 0,
    max_concurrent_jobs INTEGER DEFAULT 1,
    
    -- Networking
    internal_ip INET,
    external_endpoint TEXT,
    port INTEGER,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    last_health_check TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    image_tag VARCHAR(200),
    environment_vars JSONB,
    configuration JSONB,
    region VARCHAR(50),
    zone VARCHAR(50),
    
    -- Cost tracking
    uptime_seconds INTEGER,
    estimated_hourly_cost DECIMAL(8, 4)
);

-- Indexes for container_instances
CREATE INDEX idx_container_instances_status ON container_instances(status);
CREATE INDEX idx_container_instances_type ON container_instances(container_type);
CREATE INDEX idx_container_instances_health ON container_instances(health_status, last_health_check);
CREATE INDEX idx_container_instances_active ON container_instances(status, last_activity) 
    WHERE status IN ('ready', 'busy');

-- ===== CONTAINER METRICS TABLE =====
-- Time-series metrics for containers and jobs

CREATE TABLE IF NOT EXISTS container_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metric source
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
        'job_completion', 'container_health', 'resource_usage', 'cost_tracking'
    )),
    container_id UUID REFERENCES container_instances(id),
    job_id UUID REFERENCES container_jobs(id),
    
    -- Metric data
    metrics JSONB NOT NULL,
    
    -- Aggregation period (for pre-aggregated metrics)
    period_type VARCHAR(20) CHECK (period_type IN ('real_time', 'minute', 'hour', 'day')),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE
);

-- Hypertable for time-series optimization (if using TimescaleDB)
-- SELECT create_hypertable('container_metrics', 'timestamp', if_not_exists => TRUE);

-- Indexes for container_metrics
CREATE INDEX idx_container_metrics_timestamp ON container_metrics(timestamp DESC);
CREATE INDEX idx_container_metrics_type ON container_metrics(metric_type, timestamp);
CREATE INDEX idx_container_metrics_container ON container_metrics(container_id, timestamp);
CREATE INDEX idx_container_metrics_job ON container_metrics(job_id);

-- ===== CONTAINER SCALING EVENTS TABLE =====
-- Track auto-scaling decisions and events

CREATE TABLE IF NOT EXISTS container_scaling_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    container_type VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('scale_up', 'scale_down', 'restart', 'health_check')),
    
    -- Before and after state
    instances_before INTEGER,
    instances_after INTEGER,
    
    -- Trigger information
    trigger_type VARCHAR(30) CHECK (trigger_type IN (
        'queue_depth', 'cpu_threshold', 'memory_threshold', 'manual', 'scheduled'
    )),
    trigger_value DECIMAL(10, 2),
    trigger_threshold DECIMAL(10, 2),
    
    -- Metadata
    region VARCHAR(50),
    zone VARCHAR(50),
    metadata JSONB,
    
    -- Cost impact
    cost_impact_usd DECIMAL(8, 4),
    
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Indexes for container_scaling_events
CREATE INDEX idx_scaling_events_timestamp ON container_scaling_events(timestamp DESC);
CREATE INDEX idx_scaling_events_type ON container_scaling_events(container_type, timestamp);
CREATE INDEX idx_scaling_events_action ON container_scaling_events(action, timestamp);

-- ===== DEAD LETTER QUEUE TRACKING =====
-- Track failed jobs in dead letter queues

CREATE TABLE IF NOT EXISTS dlq_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_job_id UUID REFERENCES container_jobs(id),
    queue_name VARCHAR(100) NOT NULL,
    
    -- Failure information
    failure_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    failure_reason TEXT,
    original_payload JSONB,
    error_details JSONB,
    
    -- Processing attempts
    retry_attempts INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'retrying', 'resolved', 'abandoned'
    )),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_method VARCHAR(50)
);

-- Indexes for dlq_entries
CREATE INDEX idx_dlq_status ON dlq_entries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_dlq_queue ON dlq_entries(queue_name, failure_timestamp);
CREATE INDEX idx_dlq_retry_schedule ON dlq_entries(next_retry_at) WHERE status = 'pending';

-- ===== CONTAINER COST TRACKING =====
-- Detailed cost tracking and budgeting

CREATE TABLE IF NOT EXISTS container_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23),
    
    -- Cost breakdown by container type
    container_type VARCHAR(50) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    
    -- Usage metrics
    total_instance_hours DECIMAL(8, 2),
    total_job_count INTEGER,
    total_processing_minutes DECIMAL(10, 2),
    
    -- Cost calculations
    compute_cost_usd DECIMAL(10, 4),
    network_cost_usd DECIMAL(10, 4),
    storage_cost_usd DECIMAL(10, 4),
    total_cost_usd DECIMAL(10, 4),
    
    -- Budget tracking
    budget_allocated_usd DECIMAL(10, 4),
    budget_remaining_usd DECIMAL(10, 4),
    
    -- Metadata
    region VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for container_costs
CREATE INDEX idx_container_costs_date ON container_costs(date DESC);
CREATE INDEX idx_container_costs_type_date ON container_costs(container_type, date);
CREATE UNIQUE INDEX idx_container_costs_unique ON container_costs(date, hour, container_type, instance_type, region);

-- ===== CONTAINER CONFIGURATION =====
-- Store container deployment configurations

CREATE TABLE IF NOT EXISTS container_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_type VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    
    -- Configuration
    image_uri TEXT NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    environment_vars JSONB,
    resource_limits JSONB,
    scaling_config JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'deprecated')),
    
    -- Deployment tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    description TEXT,
    deployment_notes TEXT
);

-- Indexes for container_configurations
CREATE INDEX idx_container_config_type ON container_configurations(container_type);
CREATE INDEX idx_container_config_status ON container_configurations(status);
CREATE UNIQUE INDEX idx_container_config_active ON container_configurations(container_type) 
    WHERE status = 'active';

-- ===== FUNCTIONS AND TRIGGERS =====

-- Function to update job timing automatically
CREATE OR REPLACE FUNCTION update_container_job_timing()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set started_at when status changes to processing
    IF OLD.status != 'processing' AND NEW.status = 'processing' THEN
        NEW.started_at = NOW();
    END IF;
    
    -- Set completed_at when status changes to completed or failed
    IF OLD.status NOT IN ('completed', 'failed') AND NEW.status IN ('completed', 'failed') THEN
        NEW.completed_at = NOW();
        
        -- Calculate processing time
        IF NEW.started_at IS NOT NULL THEN
            NEW.processing_time_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at));
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for job timing
CREATE TRIGGER trigger_container_job_timing
    BEFORE UPDATE ON container_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_container_job_timing();

-- Function to track container instance uptime
CREATE OR REPLACE FUNCTION update_container_uptime()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate uptime when container stops
    IF OLD.status IN ('ready', 'busy') AND NEW.status IN ('stopping', 'stopped', 'error') THEN
        IF NEW.started_at IS NOT NULL THEN
            NEW.uptime_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.started_at));
        END IF;
        NEW.stopped_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for container uptime
CREATE TRIGGER trigger_container_uptime
    BEFORE UPDATE ON container_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_container_uptime();

-- Function to auto-archive old container jobs (cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_container_data()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER := 0;
BEGIN
    -- Archive completed jobs older than 30 days
    WITH archived AS (
        DELETE FROM container_jobs
        WHERE status IN ('completed', 'failed') 
        AND completed_at < NOW() - INTERVAL '30 days'
        RETURNING *
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    -- Clean up old metrics (keep aggregated data)
    DELETE FROM container_metrics
    WHERE metric_type = 'real_time'
    AND timestamp < NOW() - INTERVAL '7 days';
    
    -- Clean up old scaling events
    DELETE FROM container_scaling_events
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ===== VIEWS FOR ANALYTICS =====

-- Real-time container dashboard view
CREATE OR REPLACE VIEW container_dashboard AS
SELECT 
    ci.container_type,
    COUNT(CASE WHEN ci.status IN ('ready', 'busy') THEN 1 END) as active_instances,
    COUNT(CASE WHEN ci.status = 'ready' THEN 1 END) as ready_instances,
    COUNT(CASE WHEN ci.status = 'busy' THEN 1 END) as busy_instances,
    COUNT(CASE WHEN cj.status = 'pending' THEN 1 END) as pending_jobs,
    COUNT(CASE WHEN cj.status = 'processing' THEN 1 END) as processing_jobs,
    AVG(ci.cpu_usage_percent) as avg_cpu_usage,
    AVG(ci.memory_usage_percent) as avg_memory_usage,
    SUM(ci.active_jobs_count) as total_active_jobs
FROM container_instances ci
LEFT JOIN container_jobs cj ON cj.container_id = ci.id AND cj.status IN ('pending', 'processing')
WHERE ci.status != 'stopped'
GROUP BY ci.container_type;

-- Job performance metrics view
CREATE OR REPLACE VIEW job_performance_metrics AS
SELECT 
    cj.type as container_type,
    DATE_TRUNC('hour', cj.created_at) as hour,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN cj.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN cj.status = 'failed' THEN 1 END) as failed_jobs,
    AVG(cj.processing_time_seconds) as avg_processing_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cj.processing_time_seconds) as median_processing_time,
    SUM(cj.estimated_cost_usd) as total_cost
FROM container_jobs cj
WHERE cj.created_at > NOW() - INTERVAL '24 hours'
GROUP BY cj.type, DATE_TRUNC('hour', cj.created_at)
ORDER BY hour DESC;

-- Cost analysis view
CREATE OR REPLACE VIEW container_cost_analysis AS
SELECT 
    cc.container_type,
    cc.date,
    SUM(cc.total_cost_usd) as daily_cost,
    SUM(cc.total_job_count) as daily_job_count,
    CASE 
        WHEN SUM(cc.total_job_count) > 0 
        THEN SUM(cc.total_cost_usd) / SUM(cc.total_job_count)
        ELSE 0 
    END as cost_per_job,
    SUM(cc.total_instance_hours) as total_instance_hours
FROM container_costs cc
WHERE cc.date > CURRENT_DATE - INTERVAL '30 days'
GROUP BY cc.container_type, cc.date
ORDER BY cc.date DESC, cc.container_type;

-- ===== ROW LEVEL SECURITY =====

-- Enable RLS
ALTER TABLE container_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for container jobs (users can only see their organization's jobs)
CREATE POLICY container_jobs_organization_access ON container_jobs
    FOR ALL
    TO authenticated
    USING (
        organization_id = (
            SELECT organization_id 
            FROM users 
            WHERE id = auth.uid()
        )
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'super_admin')
        )
    );

-- Policy for container instances (admin access required)
CREATE POLICY container_instances_admin_access ON container_instances
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'super_admin', 'operator')
        )
    );

-- ===== INITIAL DATA =====

-- Insert default container configurations
INSERT INTO container_configurations (container_type, version, image_uri, instance_type, status, description) VALUES
('video-processing', 'v1.0', 'pitchey/video-processor:latest', 'standard-2', 'active', 'Video processing and transcoding'),
('document-processing', 'v1.0', 'pitchey/document-processor:latest', 'standard-1', 'active', 'Document processing and OCR'),
('ai-inference', 'v1.0', 'pitchey/ai-inference:latest', 'standard-4', 'active', 'AI model inference and analysis'),
('media-transcoding', 'v1.0', 'pitchey/media-transcoder:latest', 'standard-2', 'active', 'Media transcoding and optimization'),
('code-execution', 'v1.0', 'pitchey/code-executor:latest', 'lite', 'active', 'Sandboxed code execution')
ON CONFLICT DO NOTHING;

-- ===== MAINTENANCE COMMANDS =====

-- Manual cleanup command (run weekly)
-- SELECT cleanup_old_container_data();

-- Vacuum and analyze for performance
-- VACUUM ANALYZE container_jobs;
-- VACUUM ANALYZE container_instances;
-- VACUUM ANALYZE container_metrics;

-- Check container job statistics
-- SELECT type, status, COUNT(*) FROM container_jobs GROUP BY type, status ORDER BY type, status;

-- Monitor active containers
-- SELECT * FROM container_dashboard;

COMMENT ON TABLE container_jobs IS 'Tracks all containerized processing jobs with full lifecycle management';
COMMENT ON TABLE container_instances IS 'Active container instances with health and resource monitoring';
COMMENT ON TABLE container_metrics IS 'Time-series metrics for performance analysis and cost tracking';
COMMENT ON TABLE container_scaling_events IS 'Auto-scaling decisions and events for capacity management';
COMMENT ON TABLE dlq_entries IS 'Dead letter queue entries for failed job recovery';
COMMENT ON TABLE container_costs IS 'Detailed cost tracking by container type and time period';
COMMENT ON TABLE container_configurations IS 'Container deployment configurations and versioning';

-- Enable statement-level statistics collection
SELECT pg_stat_statements_reset();