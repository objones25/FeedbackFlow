import express from 'express';
import { backgroundJobService } from '../services/backgroundJobs';
import { ValidationError } from '../utils/errors';

const router = express.Router();

/**
 * @route GET /api/jobs/status
 * @desc Get status of all background jobs
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const jobStatus = backgroundJobService.getJobStatus();
    const systemStats = backgroundJobService.getSystemStats();
    
    res.json({
      success: true,
      data: {
        jobs: jobStatus,
        systemStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get job status:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_server_error',
        message: 'Failed to get job status',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /api/jobs/start
 * @desc Start all background jobs
 * @access Public
 */
router.post('/start', async (req, res) => {
  try {
    backgroundJobService.startAllJobs();
    
    res.json({
      success: true,
      data: {
        message: 'All background jobs started successfully',
        runningJobs: backgroundJobService.getSystemStats().runningJobs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to start jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_server_error',
        message: 'Failed to start background jobs',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /api/jobs/stop
 * @desc Stop all background jobs
 * @access Public
 */
router.post('/stop', async (req, res) => {
  try {
    backgroundJobService.stopAllJobs();
    
    res.json({
      success: true,
      data: {
        message: 'All background jobs stopped successfully',
        runningJobs: backgroundJobService.getSystemStats().runningJobs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to stop jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_server_error',
        message: 'Failed to stop background jobs',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /api/jobs/custom
 * @desc Add a custom background job
 * @access Public
 */
router.post('/custom', async (req, res) => {
  try {
    const { subreddit, intervalMinutes, limit } = req.body;
    
    // Validate input
    if (!subreddit || typeof subreddit !== 'string' || subreddit.trim() === '') {
      throw new ValidationError('Subreddit name is required');
    }
    
    if (!intervalMinutes || typeof intervalMinutes !== 'number' || intervalMinutes < 5 || intervalMinutes > 1440) {
      throw new ValidationError('Interval must be between 5 and 1440 minutes');
    }
    
    if (!limit || typeof limit !== 'number' || limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }
    
    const jobId = backgroundJobService.addCustomJob(subreddit, intervalMinutes, limit);
    
    return res.json({
      success: true,
      data: {
        jobId,
        message: `Custom job created for r/${subreddit}`,
        subreddit,
        intervalMinutes,
        limit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Failed to create custom job:', error);
      return res.status(500).json({
        success: false,
        error: {
          type: 'internal_server_error',
          message: 'Failed to create custom job',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

/**
 * @route DELETE /api/jobs/:jobId
 * @desc Remove a background job
 * @access Public
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
      throw new ValidationError('Job ID is required');
    }
    
    const removed = backgroundJobService.removeJob(jobId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: `Job with ID '${jobId}' not found`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return res.json({
      success: true,
      data: {
        message: `Job '${jobId}' removed successfully`,
        jobId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Failed to remove job:', error);
      return res.status(500).json({
        success: false,
        error: {
          type: 'internal_server_error',
          message: 'Failed to remove job',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

/**
 * @route POST /api/jobs/:jobId/pause
 * @desc Pause a background job
 * @access Public
 */
router.post('/:jobId/pause', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
      throw new ValidationError('Job ID is required');
    }
    
    const paused = backgroundJobService.pauseJob(jobId);
    
    if (!paused) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: `Job with ID '${jobId}' not found or already paused`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return res.json({
      success: true,
      data: {
        message: `Job '${jobId}' paused successfully`,
        jobId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Failed to pause job:', error);
      return res.status(500).json({
        success: false,
        error: {
          type: 'internal_server_error',
          message: 'Failed to pause job',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

/**
 * @route POST /api/jobs/:jobId/resume
 * @desc Resume a paused background job
 * @access Public
 */
router.post('/:jobId/resume', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
      throw new ValidationError('Job ID is required');
    }
    
    const resumed = backgroundJobService.resumeJob(jobId);
    
    if (!resumed) {
      return res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: `Job with ID '${jobId}' not found or already running`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return res.json({
      success: true,
      data: {
        message: `Job '${jobId}' resumed successfully`,
        jobId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Failed to resume job:', error);
      return res.status(500).json({
        success: false,
        error: {
          type: 'internal_server_error',
          message: 'Failed to resume job',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

export default router;
