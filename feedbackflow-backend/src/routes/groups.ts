import express from 'express';
import { DatabaseService } from '../services/database';
import { ValidationError } from '../utils/errors';

const router = express.Router();
const db = DatabaseService.getInstance();

/**
 * @route GET /api/groups/:groupId/sentences
 * @desc Get sentences for a specific feedback group
 * @access Public
 */
router.get('/:groupId/sentences', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId || isNaN(parseInt(groupId))) {
      throw new ValidationError('Valid group ID is required');
    }
    
    const groupIdNum = parseInt(groupId);
    
    // Get the group first to verify it exists
    const groupQuery = `
      SELECT id, name, description, sentence_ids, trend_score, created_at, updated_at
      FROM feedback_groups 
      WHERE id = $1
    `;
    
    const groupResult = await db.query(groupQuery, [groupIdNum]);
    
    if (groupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: `Group with ID ${groupId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const group = groupResult.rows[0];
    if (!group) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: `Group with ID ${groupId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const sentenceIds = group.sentence_ids || [];
    
    if (sentenceIds.length === 0) {
      return res.json({
        success: true,
        data: {
          group: {
            id: group.id,
            name: group.name,
            description: group.description,
            trendScore: group.trend_score,
            createdAt: group.created_at,
            updatedAt: group.updated_at
          },
          sentences: []
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Get sentences for this group
    const sentencesQuery = `
      SELECT 
        s.id,
        s.entry_id,
        s.text,
        s.sentiment_score,
        s.sentiment_label,
        s.categories,
        s.created_at,
        fe.author,
        fe.timestamp as entry_timestamp,
        fe.metadata
      FROM sentences s
      LEFT JOIN feedback_entries fe ON s.entry_id = fe.id
      WHERE s.id = ANY($1)
      ORDER BY s.created_at DESC
    `;
    
    const sentencesResult = await db.query(sentencesQuery, [sentenceIds]);
    
    const sentences = sentencesResult.rows.map(row => ({
      id: row.id,
      entryId: row.entry_id,
      text: row.text,
      sentimentScore: row.sentiment_score,
      sentimentLabel: row.sentiment_label,
      categories: row.categories || [],
      createdAt: row.created_at,
      author: row.author,
      entryTimestamp: row.entry_timestamp,
      metadata: row.metadata
    }));
    
    return res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          trendScore: group.trend_score,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        },
        sentences
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.error('Failed to get group sentences:', error);
    return res.status(500).json({
      success: false,
      error: {
        type: 'internal_server_error',
        message: 'Failed to get group sentences'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/groups/stats
 * @desc Get overall statistics about feedback groups
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_groups,
        AVG(trend_score) as avg_trend_score,
        MAX(trend_score) as max_trend_score,
        MIN(trend_score) as min_trend_score,
        SUM(array_length(sentence_ids, 1)) as total_sentences_in_groups
      FROM feedback_groups
    `;
    
    const sentimentStatsQuery = `
      SELECT 
        sentiment_label,
        COUNT(*) as count,
        AVG(sentiment_score) as avg_score
      FROM sentences
      GROUP BY sentiment_label
    `;
    
    const [statsResult, sentimentResult] = await Promise.all([
      db.query(statsQuery),
      db.query(sentimentStatsQuery)
    ]);
    
    const stats = statsResult.rows[0];
    if (!stats) {
      return res.json({
        success: true,
        data: {
          totalGroups: 0,
          avgTrendScore: 0,
          maxTrendScore: 0,
          minTrendScore: 0,
          totalSentencesInGroups: 0,
          sentimentDistribution: {}
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const sentimentStats = sentimentResult.rows.reduce((acc, row) => {
      acc[row.sentiment_label] = {
        count: parseInt(row.count),
        avgScore: parseFloat(row.avg_score)
      };
      return acc;
    }, {} as Record<string, { count: number; avgScore: number }>);
    
    return res.json({
      success: true,
      data: {
        totalGroups: parseInt(stats.total_groups),
        avgTrendScore: parseFloat(stats.avg_trend_score) || 0,
        maxTrendScore: parseFloat(stats.max_trend_score) || 0,
        minTrendScore: parseFloat(stats.min_trend_score) || 0,
        totalSentencesInGroups: parseInt(stats.total_sentences_in_groups) || 0,
        sentimentDistribution: sentimentStats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to get group stats:', error);
    return res.status(500).json({
      success: false,
      error: {
        type: 'internal_server_error',
        message: 'Failed to get group statistics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
