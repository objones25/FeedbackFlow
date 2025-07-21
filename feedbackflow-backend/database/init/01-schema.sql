-- FeedbackFlow Database Schema
-- This script initializes the database schema for the FeedbackFlow application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create feedback_sources table
CREATE TABLE feedback_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('reddit', 'reddit_enhanced', 'news', 'file_upload', 'api', 'manual')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback_entries table
CREATE TABLE feedback_entries (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES feedback_sources(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    author VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sentences table
CREATE TABLE sentences (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES feedback_entries(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    sentiment_label VARCHAR(20) CHECK (sentiment_label IN ('positive', 'negative', 'neutral')),
    categories TEXT[] DEFAULT '{}',
    embedding FLOAT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback_groups table
CREATE TABLE feedback_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    sentence_ids INTEGER[] DEFAULT '{}',
    trend_score FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processing_jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('sentiment_analysis', 'clustering', 'trend_detection')),
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('sentiment_shift', 'volume_spike', 'new_issue_detected')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add deduplication constraints for Reddit posts
ALTER TABLE feedback_entries ADD CONSTRAINT unique_reddit_post 
    UNIQUE (source_id, (metadata->>'postId')) DEFERRABLE INITIALLY DEFERRED;

-- Create indexes for better performance
CREATE INDEX idx_feedback_entries_source_id ON feedback_entries(source_id);
CREATE INDEX idx_feedback_entries_processing_status ON feedback_entries(processing_status);
CREATE INDEX idx_feedback_entries_created_at ON feedback_entries(created_at);
CREATE INDEX idx_feedback_entries_timestamp ON feedback_entries(timestamp);

-- Index for deduplication performance
CREATE INDEX idx_feedback_entries_reddit_dedup ON feedback_entries (source_id, (metadata->>'postId'));

CREATE INDEX idx_sentences_entry_id ON sentences(entry_id);
CREATE INDEX idx_sentences_sentiment_label ON sentences(sentiment_label);
CREATE INDEX idx_sentences_created_at ON sentences(created_at);

CREATE INDEX idx_feedback_groups_created_at ON feedback_groups(created_at);
CREATE INDEX idx_feedback_groups_trend_score ON feedback_groups(trend_score);

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);

CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_is_read ON alerts(is_read);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_feedback_sources_updated_at 
    BEFORE UPDATE ON feedback_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_entries_updated_at 
    BEFORE UPDATE ON feedback_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_groups_updated_at 
    BEFORE UPDATE ON feedback_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW sentiment_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_sentences,
    COUNT(*) FILTER (WHERE sentiment_label = 'positive') as positive_count,
    COUNT(*) FILTER (WHERE sentiment_label = 'negative') as negative_count,
    COUNT(*) FILTER (WHERE sentiment_label = 'neutral') as neutral_count,
    AVG(sentiment_score) as avg_sentiment_score
FROM sentences 
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE VIEW recent_feedback AS
SELECT 
    fe.id,
    fe.raw_text,
    fe.author,
    fe.timestamp,
    fs.name as source_name,
    fs.type as source_type,
    fe.processing_status,
    fe.created_at
FROM feedback_entries fe
JOIN feedback_sources fs ON fe.source_id = fs.id
ORDER BY fe.created_at DESC;

-- Grant permissions (adjust as needed for your security requirements)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT USAGE ON SCHEMA public TO admin;

-- Insert initial data
INSERT INTO feedback_sources (name, type, metadata) VALUES 
    ('Manual Entry', 'manual', '{"description": "Manually entered feedback"}'),
    ('File Upload', 'file_upload', '{"description": "Feedback from uploaded files"}'),
    ('API Integration', 'api', '{"description": "Feedback from external APIs"}');

COMMENT ON TABLE feedback_sources IS 'Sources of feedback data (Reddit, News, Files, etc.)';
COMMENT ON TABLE feedback_entries IS 'Raw feedback entries from various sources';
COMMENT ON TABLE sentences IS 'Individual sentences extracted from feedback entries with sentiment analysis';
COMMENT ON TABLE feedback_groups IS 'Clustered groups of similar feedback sentences';
COMMENT ON TABLE processing_jobs IS 'Background processing jobs for NLP tasks';
COMMENT ON TABLE alerts IS 'System alerts for significant changes or issues';
