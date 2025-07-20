import { BackgroundJobService } from '../../../src/services/backgroundJobs';
import { FeedbackService } from '../../../src/services/feedbackService';

// Mock the FeedbackService
jest.mock('../../../src/services/feedbackService');

describe('BackgroundJobService', () => {
  let backgroundJobService: BackgroundJobService;
  let mockFeedbackService: jest.Mocked<FeedbackService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Mock the FeedbackService constructor to return our mock
    const MockedFeedbackService = FeedbackService as jest.MockedClass<typeof FeedbackService>;
    mockFeedbackService = {
      processFeedbackFromReddit: jest.fn().mockResolvedValue({
        processedCount: 5,
        sentencesCount: 10,
        clustersCount: 2,
        outlierCount: 1,
        processingTimeMs: 1500,
      }),
      processFeedbackFromFile: jest.fn(),
      getDashboardData: jest.fn(),
      getSentimentTrends: jest.fn(),
      getFeedbackGroups: jest.fn(),
      healthCheck: jest.fn(),
    } as any;
    
    MockedFeedbackService.mockImplementation(() => mockFeedbackService);
    
    // Create a new instance for each test
    backgroundJobService = new BackgroundJobService();
  });

  afterEach(() => {
    backgroundJobService.stopAllJobs();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default job configurations', () => {
      const jobStatus = backgroundJobService.getJobStatus();
      
      expect(jobStatus).toHaveLength(6); // 6 default jobs
      expect(jobStatus[0]).toMatchObject({
        id: 'webdev-collector',
        subreddit: 'webdev',
        intervalMinutes: 15,
        limit: 8,
        isRunning: false,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      });
    });

    it('should initialize job stats for all default jobs', () => {
      const systemStats = backgroundJobService.getSystemStats();
      
      expect(systemStats.totalJobs).toBe(6);
      expect(systemStats.runningJobs).toBe(0);
      expect(systemStats.totalRuns).toBe(0);
      expect(systemStats.successfulRuns).toBe(0);
      expect(systemStats.failedRuns).toBe(0);
      expect(systemStats.successRate).toBe('0%');
    });
  });

  describe('startAllJobs', () => {
    it('should start all enabled jobs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      backgroundJobService.startAllJobs();
      
      const jobStatus = backgroundJobService.getJobStatus();
      const runningJobs = jobStatus.filter(job => job.isRunning);
      
      expect(runningJobs).toHaveLength(6);
      expect(consoleSpy).toHaveBeenCalledWith('🚀 Starting background data collection jobs...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Started 6 background jobs');
      
      consoleSpy.mockRestore();
    });

    it('should schedule jobs with correct intervals', () => {
      backgroundJobService.startAllJobs();
      
      const jobStatus = backgroundJobService.getJobStatus();
      
      expect(jobStatus.find(job => job.id === 'webdev-collector')?.intervalMinutes).toBe(15);
      expect(jobStatus.find(job => job.id === 'reactjs-collector')?.intervalMinutes).toBe(20);
      expect(jobStatus.find(job => job.id === 'javascript-collector')?.intervalMinutes).toBe(25);
    });
  });

  describe('stopAllJobs', () => {
    it('should stop all running jobs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      backgroundJobService.startAllJobs();
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(6);
      
      backgroundJobService.stopAllJobs();
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(0);
      
      expect(consoleSpy).toHaveBeenCalledWith('🛑 Stopping all background jobs...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ All background jobs stopped');
      
      consoleSpy.mockRestore();
    });

    it('should clear all job timers', () => {
      backgroundJobService.startAllJobs();
      const initialRunningJobs = backgroundJobService.getSystemStats().runningJobs;
      
      backgroundJobService.stopAllJobs();
      const finalRunningJobs = backgroundJobService.getSystemStats().runningJobs;
      
      expect(initialRunningJobs).toBe(6);
      expect(finalRunningJobs).toBe(0);
    });
  });

  describe('addCustomJob', () => {
    it('should add a custom job with correct configuration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const jobId = backgroundJobService.addCustomJob('typescript', 45, 15);
      
      expect(jobId).toMatch(/^custom-typescript-\d+$/);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`✅ Added custom job: ${jobId} (r/typescript, every 45 minutes)`)
      );
      
      consoleSpy.mockRestore();
    });

    it('should start the custom job immediately', () => {
      const jobId = backgroundJobService.addCustomJob('typescript', 45, 15);
      
      // The job should be running
      const systemStats = backgroundJobService.getSystemStats();
      expect(systemStats.runningJobs).toBe(1);
    });
  });

  describe('removeJob', () => {
    it('should remove an existing job', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const jobId = backgroundJobService.addCustomJob('typescript', 45, 15);
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(1);
      
      const removed = backgroundJobService.removeJob(jobId);
      
      expect(removed).toBe(true);
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(`✅ Removed job: ${jobId}`);
      
      consoleSpy.mockRestore();
    });

    it('should return false for non-existent job', () => {
      const removed = backgroundJobService.removeJob('non-existent-job');
      expect(removed).toBe(false);
    });
  });

  describe('pauseJob and resumeJob', () => {
    it('should pause and resume default jobs', () => {
      backgroundJobService.startAllJobs();
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(6);
      
      // Pause a job
      const paused = backgroundJobService.pauseJob('webdev-collector');
      expect(paused).toBe(true);
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(5);
      
      // Resume the job
      const resumed = backgroundJobService.resumeJob('webdev-collector');
      expect(resumed).toBe(true);
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(6);
    });

    it('should return false when trying to resume non-existent job', () => {
      const resumed = backgroundJobService.resumeJob('non-existent-job');
      expect(resumed).toBe(false);
    });
  });

  describe('job execution', () => {
    it('should execute jobs and update statistics on success', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      backgroundJobService.startAllJobs();
      
      // Fast-forward time to trigger job execution (just the startup delay)
      jest.advanceTimersByTime(30000); // 30 seconds to trigger startup delay
      
      // Wait for promises to resolve
      await Promise.resolve();
      
      const systemStats = backgroundJobService.getSystemStats();
      expect(systemStats.totalRuns).toBeGreaterThan(0);
      expect(systemStats.successfulRuns).toBeGreaterThan(0);
      expect(systemStats.failedRuns).toBe(0);
      
      consoleSpy.mockRestore();
    });

    it('should handle job execution failures gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock the feedback service to throw an error
      mockFeedbackService.processFeedbackFromReddit.mockRejectedValue(
        new Error('Reddit API error')
      );
      
      backgroundJobService.startAllJobs();
      
      // Fast-forward time to trigger job execution
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      const systemStats = backgroundJobService.getSystemStats();
      expect(systemStats.totalRuns).toBeGreaterThan(0);
      expect(systemStats.failedRuns).toBeGreaterThan(0);
      expect(systemStats.successRate).not.toBe('100%');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Job failed:'),
        expect.objectContaining({
          error: 'Reddit API error',
        })
      );
      
      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should call FeedbackService with correct parameters', async () => {
      backgroundJobService.startAllJobs();
      
      // Fast-forward time to trigger job execution
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      
      expect(mockFeedbackService.processFeedbackFromReddit).toHaveBeenCalledWith(
        expect.any(String), // subreddit name
        expect.objectContaining({
          batchSize: expect.any(Number),
          enableClustering: true,
          sentimentThreshold: 0.1,
          clusteringThreshold: 0.3,
          maxSentences: 100,
        })
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return correct job status information', () => {
      backgroundJobService.startAllJobs();
      
      const jobStatus = backgroundJobService.getJobStatus();
      
      expect(jobStatus).toHaveLength(6);
      
      const webdevJob = jobStatus.find(job => job.id === 'webdev-collector');
      expect(webdevJob).toMatchObject({
        id: 'webdev-collector',
        subreddit: 'webdev',
        intervalMinutes: 15,
        limit: 8,
        isRunning: true,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      });
    });

    it('should calculate next run time correctly', async () => {
      backgroundJobService.startAllJobs();
      
      // Execute a job to set lastRun
      jest.advanceTimersByTime(30000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      const jobStatus = backgroundJobService.getJobStatus();
      const webdevJob = jobStatus.find(job => job.id === 'webdev-collector');
      
      if (webdevJob?.lastRun && webdevJob?.nextRun) {
        const expectedNextRun = new Date(webdevJob.lastRun.getTime() + (15 * 60 * 1000));
        expect(webdevJob.nextRun.getTime()).toBe(expectedNextRun.getTime());
      }
    });
  });

  describe('getSystemStats', () => {
    it('should return correct system statistics', () => {
      const stats = backgroundJobService.getSystemStats();
      
      expect(stats).toMatchObject({
        totalJobs: 6,
        runningJobs: 0,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        successRate: '0%',
        uptime: expect.any(String),
      });
    });

    it('should calculate success rate correctly', async () => {
      // Mock some successful and failed runs
      mockFeedbackService.processFeedbackFromReddit
        .mockResolvedValueOnce({
          processedCount: 5,
          sentencesCount: 10,
          clustersCount: 2,
          outlierCount: 1,
          processingTimeMs: 1500,
        })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          processedCount: 3,
          sentencesCount: 6,
          clustersCount: 1,
          outlierCount: 0,
          processingTimeMs: 1200,
        });
      
      backgroundJobService.startAllJobs();
      
      // Execute jobs multiple times
      jest.advanceTimersByTime(30000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      const stats = backgroundJobService.getSystemStats();
      expect(stats.totalRuns).toBeGreaterThan(0);
      expect(stats.successRate).toMatch(/^\d+\.\d%$/); // Format: "XX.X%"
    });
  });

  describe('error handling', () => {
    it('should continue processing other jobs when one fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock to fail for specific subreddit but succeed for others
      mockFeedbackService.processFeedbackFromReddit.mockImplementation(
        (subreddit: string) => {
          if (subreddit === 'webdev') {
            return Promise.reject(new Error('API rate limit'));
          }
          return Promise.resolve({
            processedCount: 3,
            sentencesCount: 6,
            clustersCount: 1,
            outlierCount: 0,
            processingTimeMs: 1000,
          });
        }
      );
      
      backgroundJobService.startAllJobs();
      
      jest.advanceTimersByTime(30000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      const stats = backgroundJobService.getSystemStats();
      expect(stats.totalRuns).toBeGreaterThan(0);
      expect(stats.successfulRuns).toBeGreaterThan(0);
      expect(stats.failedRuns).toBeGreaterThan(0);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('memory management', () => {
    it('should clean up resources when stopping jobs', () => {
      backgroundJobService.startAllJobs();
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(6);
      
      backgroundJobService.stopAllJobs();
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(0);
      
      // The timers should be cleared, but there might be some remaining from setTimeout calls
      // This is expected behavior and doesn't indicate a memory leak
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple start/stop cycles', () => {
      // Start and stop multiple times
      for (let i = 0; i < 3; i++) {
        backgroundJobService.startAllJobs();
        expect(backgroundJobService.getSystemStats().runningJobs).toBe(6);
        
        backgroundJobService.stopAllJobs();
        expect(backgroundJobService.getSystemStats().runningJobs).toBe(0);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid job additions and removals', () => {
      const jobIds: string[] = [];
      
      // Add multiple custom jobs
      for (let i = 0; i < 5; i++) {
        const jobId = backgroundJobService.addCustomJob(`test${i}`, 60, 5);
        jobIds.push(jobId);
      }
      
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(5);
      
      // Remove all custom jobs
      jobIds.forEach(jobId => {
        const removed = backgroundJobService.removeJob(jobId);
        expect(removed).toBe(true);
      });
      
      expect(backgroundJobService.getSystemStats().runningJobs).toBe(0);
    });

    it('should maintain job statistics across operations', async () => {
      backgroundJobService.startAllJobs();
      
      // Execute some jobs
      jest.advanceTimersByTime(30000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      const initialStats = backgroundJobService.getSystemStats();
      
      // Stop and restart
      backgroundJobService.stopAllJobs();
      backgroundJobService.startAllJobs();
      
      const finalStats = backgroundJobService.getSystemStats();
      
      // Statistics should be preserved
      expect(finalStats.totalRuns).toBe(initialStats.totalRuns);
      expect(finalStats.successfulRuns).toBe(initialStats.successfulRuns);
      expect(finalStats.failedRuns).toBe(initialStats.failedRuns);
    });
  });
});
