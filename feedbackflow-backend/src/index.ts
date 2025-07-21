import express from 'express';
import cors from 'cors';
import { config } from '@/config';
import feedbackRoutes from '@/routes/feedback';
import processRoutes from '@/routes/process';
import jobsRoutes from '@/routes/jobs';
import groupsRoutes from '@/routes/groups';
import { ValidationError, ExternalApiError, DatabaseError } from '@/utils/errors';
import { backgroundJobService } from '@/services/backgroundJobs';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://feedbackflow.vercel.app'] // Production frontend URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'], // Development URLs
  credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // Support large file uploads
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/feedback', feedbackRoutes);
app.use('/api/process', processRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/groups', groupsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FeedbackFlow API',
    version: '1.0.0',
    description: 'AI-powered feedback analysis and sentiment monitoring platform',
    endpoints: {
      health: '/health',
      dashboard: '/api/feedback/dashboard',
      trends: '/api/feedback/trends',
      groups: '/api/feedback/groups',
      processReddit: '/api/feedback/process/reddit',
      processFile: '/api/feedback/process/file',
      analyze: '/api/feedback/analyze',
      healthCheck: '/api/feedback/health',
    },
    documentation: 'https://github.com/your-username/feedbackflow',
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
    timestamp: new Date(),
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);

  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
      timestamp: new Date(),
    });
    return;
  }

  if (error instanceof ExternalApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: 'EXTERNAL_API_ERROR',
        message: error.message,
        details: { service: error.service },
      },
      timestamp: new Date(),
    });
    return;
  }

  if (error instanceof DatabaseError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      },
      timestamp: new Date(),
    });
    return;
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: new Date(),
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const PORT = config.port || 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 FeedbackFlow API server running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📖 API docs: http://${HOST}:${PORT}/`);
  
  // ✅ Start background jobs
  backgroundJobService.startAllJobs();
});

export default app;
