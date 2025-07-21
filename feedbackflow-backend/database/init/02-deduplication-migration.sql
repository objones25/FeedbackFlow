-- Migration to add deduplication support and constraints
-- This script adds necessary columns and constraints to prevent duplicate posts

-- Add external_id column to feedback_entries for tracking Reddit post IDs
ALTER TABLE feedback_entries 
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- Add unique constraint to prevent duplicate Reddit posts
-- Using a partial index to only apply to Reddit sources
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_entries_reddit_dedup 
ON feedback_entries (external_id, source_id) 
WHERE external_id IS NOT NULL;

-- Add index for efficient duplicate checking
CREATE INDEX IF NOT EXISTS idx_feedback_entries_external_id 
ON feedback_entries (external_id) 
WHERE external_id IS NOT NULL;

-- Add structured_analysis column to store Gemini Pro analysis results
ALTER TABLE feedback_entries 
ADD COLUMN IF NOT EXISTS structured_analysis JSONB DEFAULT '{}';

-- Add index for structured analysis queries
CREATE INDEX IF NOT EXISTS idx_feedback_entries_structured_analysis 
ON feedback_entries USING GIN (structured_analysis);

-- Add index for category filtering (will be in structured_analysis)
CREATE INDEX IF NOT EXISTS idx_feedback_entries_category 
ON feedback_entries ((structured_analysis->>'category'));

-- Add index for urgency filtering
CREATE INDEX IF NOT EXISTS idx_feedback_entries_urgency 
ON feedback_entries ((structured_analysis->>'urgency'));

-- Update existing Reddit entries to populate external_id from metadata
UPDATE feedback_entries 
SET external_id = metadata->>'postId' 
WHERE external_id IS NULL 
  AND metadata->>'postId' IS NOT NULL 
  AND source_id IN (
    SELECT id FROM feedback_sources WHERE type = 'reddit'
  );

-- Create a function to clean up exact duplicates
CREATE OR REPLACE FUNCTION cleanup_duplicate_entries()
RETURNS INTEGER AS $$
DECLARE
    duplicate_count INTEGER := 0;
    rec RECORD;
BEGIN
    -- Find and remove exact duplicates based on external_id and source_id
    FOR rec IN 
        SELECT external_id, source_id, MIN(id) as keep_id, array_agg(id ORDER BY id) as all_ids
        FROM feedback_entries 
        WHERE external_id IS NOT NULL
        GROUP BY external_id, source_id
        HAVING COUNT(*) > 1
    LOOP
        -- Delete sentences associated with duplicate entries
        DELETE FROM sentences 
        WHERE entry_id = ANY(rec.all_ids[2:]);
        
        -- Delete duplicate entries (keep the first one)
        DELETE FROM feedback_entries 
        WHERE id = ANY(rec.all_ids[2:]);
        
        duplicate_count := duplicate_count + array_length(rec.all_ids, 1) - 1;
    END LOOP;
    
    RETURN duplicate_count;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup function
SELECT cleanup_duplicate_entries() as duplicates_removed;

-- Add comments for documentation
COMMENT ON COLUMN feedback_entries.external_id IS 'External identifier (e.g., Reddit permalink) for deduplication';
COMMENT ON COLUMN feedback_entries.structured_analysis IS 'Gemini Pro structured analysis results';
COMMENT ON INDEX idx_feedback_entries_reddit_dedup IS 'Prevents duplicate Reddit posts';
