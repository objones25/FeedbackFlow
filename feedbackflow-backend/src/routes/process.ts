import { Router } from 'express';
import { FeedbackService } from '@/services/feedbackService';
import { RedditService } from '@/services/redditService';
import { ValidationError, ExternalApiError } from '@/utils/errors';

const router = Router();
const feedbackService = new FeedbackService();
const redditService = new RedditService();

// Process Reddit data for a specific subreddit
router.post('/reddit', async (req, res) => {
  try {
    const { subreddit, limit = 10 } = req.body;

    if (!subreddit) {
      throw new ValidationError('Subreddit is required');
    }

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    console.log(`🚀 Starting Reddit data processing for r/${subreddit} (limit: ${limit})`);

    // Process Reddit data with real sentiment analysis
    const result = await feedbackService.processFeedbackFromReddit(subreddit, {
      batchSize: limit,
      enableClustering: true,
      sentimentThreshold: 0.1, // Process most sentiment results
      clusteringThreshold: 0.3,
      maxSentences: 200
    });

    console.log(`✅ Processing complete:`, result);

    return res.json({
      success: true,
      data: {
        subreddit: `r/${subreddit}`,
        processedEntries: result.processedCount,
        analyzedSentences: result.sentencesCount,
        clustersFound: result.clustersCount,
        outliers: result.outlierCount,
        processingTimeMs: result.processingTimeMs,
        processingTimeSeconds: Math.round(result.processingTimeMs / 1000),
        message: `Successfully processed ${result.processedCount} posts from r/${subreddit}`
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Reddit processing error:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message
        },
        timestamp: new Date()
      });
    }

    if (error instanceof ExternalApiError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: {
          type: 'external_api_error',
          service: error.service,
          message: error.message
        },
        timestamp: new Date()
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'An unexpected error occurred during processing'
      },
      timestamp: new Date()
    });
  }
});

// Process text data from file upload or direct input
router.post('/text', async (req, res) => {
  try {
    const { text, sourceName = 'Direct Input' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new ValidationError('Text content is required');
    }

    if (text.length > 50000) {
      throw new ValidationError('Text content must be less than 50,000 characters');
    }

    console.log(`🚀 Starting text processing for "${sourceName}" (${text.length} characters)`);

    // Process text with real sentiment analysis
    const result = await feedbackService.processFeedbackFromFile(text, sourceName, {
      enableClustering: true,
      sentimentThreshold: 0.1,
      clusteringThreshold: 0.3,
      maxSentences: 200
    });

    console.log(`✅ Processing complete:`, result);

    return res.json({
      success: true,
      data: {
        sourceName,
        textLength: text.length,
        analyzedSentences: result.sentencesCount,
        clustersFound: result.clustersCount,
        outliers: result.outlierCount,
        processingTimeMs: result.processingTimeMs,
        processingTimeSeconds: Math.round(result.processingTimeMs / 1000),
        message: `Successfully processed ${result.sentencesCount} sentences from "${sourceName}"`
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Text processing error:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message
        },
        timestamp: new Date()
      });
    }

    if (error instanceof ExternalApiError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: {
          type: 'external_api_error',
          service: error.service,
          message: error.message
        },
        timestamp: new Date()
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'An unexpected error occurred during processing'
      },
      timestamp: new Date()
    });
  }
});

// Debug endpoint to test NLP service directly
router.post('/debug/nlp', async (req, res) => {
  try {
    const { text = "This is a test message for sentiment analysis." } = req.body;
    
    console.log(`🔍 Testing NLP service with text: "${text}"`);
    
    const nlpService = new (require('@/services/nlpService').NLPService)();
    
    // Test sentiment analysis
    const sentiment = await nlpService.analyzeSentiment(text);
    console.log(`📊 Sentiment result:`, sentiment);
    
    // Test sentence splitting
    const sentences = nlpService.splitIntoSentences(text);
    console.log(`📝 Sentences:`, sentences);
    
    // Test embedding
    const embedding = await nlpService.embedText(text);
    console.log(`🧠 Embedding length:`, embedding.length);
    
    return res.json({
      success: true,
      data: {
        originalText: text,
        sentiment,
        sentences,
        embeddingLength: embedding.length,
        embeddingPreview: embedding.slice(0, 5), // First 5 dimensions
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ NLP debug error:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        type: 'nlp_debug_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: new Date()
    });
  }
});

// Get processing status and recent jobs
router.get('/status', async (req, res) => {
  try {
    // Get basic health check
    const healthCheck = await feedbackService.healthCheck();
    
    return res.json({
      success: true,
      data: {
        status: healthCheck.status,
        services: healthCheck.services,
        message: `System is ${healthCheck.status}`,
        availableEndpoints: [
          'POST /api/process/reddit - Process Reddit data',
          'POST /api/process/text - Process text data',
          'GET /api/process/status - Get processing status'
        ]
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to get processing status'
      },
      timestamp: new Date()
    });
  }
});

export default router;
