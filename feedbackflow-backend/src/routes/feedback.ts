import { Router, Request, Response, NextFunction } from 'express';
import { FeedbackService } from '@/services/feedbackService';
import { ValidationError, ExternalApiError } from '@/utils/errors';
import { ApiResponse } from '@/types';

const router = Router();
const feedbackService = new FeedbackService();

// Helper functions to create API responses
const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  timestamp: new Date(),
});

const createErrorResponse = (
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<never> => ({
  success: false,
  error: details ? { code, message, details } : { code, message },
  timestamp: new Date(),
});

// Error handler middleware
const handleError = (error: unknown, res: Response): void => {
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    res.status(400).json(createErrorResponse('VALIDATION_ERROR', error.message));
    return;
  }

  if (error instanceof ExternalApiError) {
    res.status(error.statusCode).json(createErrorResponse(
      'EXTERNAL_API_ERROR',
      error.message,
      { service: error.service }
    ));
    return;
  }

  // Generic error
  res.status(500).json(createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred'
  ));
};

// GET /api/feedback/dashboard - Get dashboard overview
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    if (typeof timeframe !== 'string') {
      throw new ValidationError('Timeframe must be a string');
    }

    const data = await feedbackService.getDashboardData(timeframe);
    res.json(createSuccessResponse(data));
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/feedback/trends - Get sentiment trends
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    if (typeof timeframe !== 'string') {
      throw new ValidationError('Timeframe must be a string');
    }

    const trends = await feedbackService.getSentimentTrends(timeframe);
    res.json(createSuccessResponse(trends));
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/feedback/groups - Get feedback groups
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new ValidationError('Limit must be a valid number between 1 and 1000');
    }

    const groups = await feedbackService.getFeedbackGroups(limitNum);
    res.json(createSuccessResponse(groups));
  } catch (error) {
    handleError(error, res);
  }
});

// POST /api/feedback/process/reddit - Process Reddit feedback
router.post('/process/reddit', async (req: Request, res: Response) => {
  try {
    const { subreddit, options = {} } = req.body;

    if (!subreddit || typeof subreddit !== 'string') {
      throw new ValidationError('Subreddit is required and must be a string');
    }

    // Validate options if provided
    if (options && typeof options !== 'object') {
      throw new ValidationError('Options must be an object');
    }

    const result = await feedbackService.processFeedbackFromReddit(subreddit, options);
    res.json(createSuccessResponse(result));
  } catch (error) {
    handleError(error, res);
  }
});

// POST /api/feedback/process/file - Process file feedback
router.post('/process/file', async (req: Request, res: Response) => {
  try {
    const { content, sourceName, options = {} } = req.body;

    if (!content || typeof content !== 'string') {
      throw new ValidationError('Content is required and must be a string');
    }

    if (!sourceName || typeof sourceName !== 'string') {
      throw new ValidationError('Source name is required and must be a string');
    }

    // Validate options if provided
    if (options && typeof options !== 'object') {
      throw new ValidationError('Options must be an object');
    }

    const result = await feedbackService.processFeedbackFromFile(content, sourceName, options);
    res.json(createSuccessResponse(result));
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/feedback/health - Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await feedbackService.healthCheck();
    
    // Set appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(createSuccessResponse(health));
  } catch (error) {
    handleError(error, res);
  }
});

// POST /api/feedback/analyze - Generic analysis endpoint
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { source, query, options = {} } = req.body;

    if (!source || typeof source !== 'string') {
      throw new ValidationError('Source is required and must be a string');
    }

    if (!query || typeof query !== 'string') {
      throw new ValidationError('Query is required and must be a string');
    }

    let result;
    
    switch (source.toLowerCase()) {
      case 'reddit':
        result = await feedbackService.processFeedbackFromReddit(query, options);
        break;
      case 'file':
        if (!options.sourceName) {
          throw new ValidationError('Source name is required for file processing');
        }
        result = await feedbackService.processFeedbackFromFile(query, options.sourceName, options);
        break;
      default:
        throw new ValidationError(`Unsupported source: ${source}. Supported sources: reddit, file`);
    }

    res.json(createSuccessResponse(result));
  } catch (error) {
    handleError(error, res);
  }
});

// GET /api/feedback/status/:jobId - Get processing job status (placeholder for future async processing)
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      throw new ValidationError('Job ID is required');
    }

    // Placeholder implementation - would integrate with job queue in production
    const mockStatus = {
      id: jobId,
      status: 'completed' as const,
      progress: 100,
      result: {
        processedCount: 10,
        sentencesCount: 50,
        clustersCount: 3,
        outlierCount: 2,
        processingTimeMs: 5000,
      },
      createdAt: new Date(),
      completedAt: new Date(),
    };

    res.json(createSuccessResponse(mockStatus));
  } catch (error) {
    handleError(error, res);
  }
});

// Error handling middleware for this router
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  handleError(error, res);
});

export default router;
