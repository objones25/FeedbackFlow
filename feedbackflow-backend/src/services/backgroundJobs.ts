import { FeedbackService } from "@/services/feedbackService";

interface JobConfig {
  readonly id: string;
  readonly subreddit: string;
  readonly intervalMinutes: number;
  readonly limit: number;
  readonly enabled: boolean;
}

interface JobStatus {
  readonly id: string;
  readonly subreddit: string;
  readonly intervalMinutes: number;
  readonly limit: number;
  readonly isRunning: boolean;
  readonly lastRun: Date | undefined;
  readonly nextRun: Date | undefined;
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly failedRuns: number;
}

export class BackgroundJobService {
  private readonly feedbackService: FeedbackService;
  private readonly jobs: Map<string, NodeJS.Timeout> = new Map();
  private readonly jobStats: Map<
    string,
    {
      totalRuns: number;
      successfulRuns: number;
      failedRuns: number;
      lastRun?: Date;
    }
  > = new Map();

  private readonly defaultJobs: readonly JobConfig[] = [
    {
      id: "webdev-collector",
      subreddit: "webdev",
      intervalMinutes: 30,
      limit: 15,
      enabled: true,
    },
    {
      id: "reactjs-collector",
      subreddit: "reactjs",
      intervalMinutes: 35,
      limit: 12,
      enabled: true,
    },
    {
      id: "javascript-collector",
      subreddit: "javascript",
      intervalMinutes: 40,
      limit: 18,
      enabled: true,
    },
    {
      id: "programming-collector",
      subreddit: "programming",
      intervalMinutes: 45,
      limit: 20,
      enabled: true,
    },
    {
      id: "frontend-collector",
      subreddit: "Frontend",
      intervalMinutes: 50,
      limit: 10,
      enabled: true,
    },
    {
      id: "nodejs-collector",
      subreddit: "node",
      intervalMinutes: 55,
      limit: 12,
      enabled: true,
    },
    {
      id: "nextjs-collector",
      subreddit: "nextjs",
      intervalMinutes: 60,
      limit: 8,
      enabled: true,
    },
    {
      id: "typescript-collector",
      subreddit: "typescript",
      intervalMinutes: 65,
      limit: 10,
      enabled: true,
    },
  ];

  constructor() {
    this.feedbackService = new FeedbackService();

    // Initialize job stats
    this.defaultJobs.forEach((job) => {
      this.jobStats.set(job.id, {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      });
    });
  }

  public startAllJobs(): void {
    console.log("🚀 Starting background data collection jobs...");

    this.defaultJobs.forEach((jobConfig) => {
      if (jobConfig.enabled) {
        this.startJob(jobConfig);
      }
    });

    console.log(`✅ Started ${this.jobs.size} background jobs`);
    this.logJobSchedule();
  }

  public stopAllJobs(): void {
    console.log("🛑 Stopping all background jobs...");

    this.jobs.forEach((timeout, jobId) => {
      clearInterval(timeout);
      console.log(`   Stopped job: ${jobId}`);
    });

    this.jobs.clear();
    console.log("✅ All background jobs stopped");
  }

  private startJob(jobConfig: JobConfig): void {
    // Run immediately (with a small delay to stagger startup)
    const startupDelay = Math.random() * 30000; // 0-30 seconds
    setTimeout(() => {
      this.executeJob(jobConfig);
    }, startupDelay);

    // Schedule recurring execution
    const intervalMs = jobConfig.intervalMinutes * 60 * 1000;
    const timeout = setInterval(() => {
      this.executeJob(jobConfig);
    }, intervalMs);

    this.jobs.set(jobConfig.id, timeout);

    console.log(
      `   📅 Scheduled job: ${jobConfig.id} (every ${jobConfig.intervalMinutes} minutes)`
    );
  }

  private async executeJob(jobConfig: JobConfig): Promise<void> {
    const stats = this.jobStats.get(jobConfig.id);
    if (!stats) return;

    try {
      console.log(
        `🔄 Executing job: ${jobConfig.id} (r/${jobConfig.subreddit}, limit: ${jobConfig.limit})`
      );

      const startTime = Date.now();

      const result =
        await this.feedbackService.processRedditWithStructuredAnalysis(
          jobConfig.subreddit,
          {
            batchSize: jobConfig.limit,
            useGeminiAnalysis: true,
          }
        );

      const duration = Date.now() - startTime;

      // Update stats
      stats.totalRuns++;
      stats.successfulRuns++;
      stats.lastRun = new Date();

      console.log(`✅ Job completed: ${jobConfig.id}`, {
        processedEntries: result.processedCount,
        analyzedSentences: result.sentencesCount,
        clustersFound: result.clustersCount,
        processingTimeMs: duration,
        totalRuns: stats.totalRuns,
        successRate: `${((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1)}%`,
      });
    } catch (error) {
      // Update stats
      stats.totalRuns++;
      stats.failedRuns++;
      stats.lastRun = new Date();

      console.error(`❌ Job failed: ${jobConfig.id}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        totalRuns: stats.totalRuns,
        failureRate: `${((stats.failedRuns / stats.totalRuns) * 100).toFixed(1)}%`,
      });

      // Continue with other jobs even if one fails
    }
  }

  public getJobStatus(): JobStatus[] {
    return this.defaultJobs.map((jobConfig) => {
      const stats = this.jobStats.get(jobConfig.id);
      const isRunning = this.jobs.has(jobConfig.id);

      let nextRun: Date | undefined;
      if (isRunning && stats?.lastRun) {
        nextRun = new Date(
          stats.lastRun.getTime() + jobConfig.intervalMinutes * 60 * 1000
        );
      }

      return {
        id: jobConfig.id,
        subreddit: jobConfig.subreddit,
        intervalMinutes: jobConfig.intervalMinutes,
        limit: jobConfig.limit,
        isRunning,
        lastRun: stats?.lastRun,
        nextRun,
        totalRuns: stats?.totalRuns || 0,
        successfulRuns: stats?.successfulRuns || 0,
        failedRuns: stats?.failedRuns || 0,
      };
    });
  }

  public addCustomJob(
    subreddit: string,
    intervalMinutes: number,
    limit: number
  ): string {
    const jobId = `custom-${subreddit}-${Date.now()}`;
    const jobConfig: JobConfig = {
      id: jobId,
      subreddit,
      intervalMinutes,
      limit,
      enabled: true,
    };

    // Initialize stats
    this.jobStats.set(jobId, {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
    });

    this.startJob(jobConfig);
    console.log(
      `✅ Added custom job: ${jobId} (r/${subreddit}, every ${intervalMinutes} minutes)`
    );

    return jobId;
  }

  public removeJob(jobId: string): boolean {
    const timeout = this.jobs.get(jobId);

    if (timeout) {
      clearInterval(timeout);
      this.jobs.delete(jobId);
      this.jobStats.delete(jobId);
      console.log(`✅ Removed job: ${jobId}`);
      return true;
    }

    return false;
  }

  public pauseJob(jobId: string): boolean {
    return this.removeJob(jobId);
  }

  public resumeJob(jobId: string): boolean {
    const jobConfig = this.defaultJobs.find((job) => job.id === jobId);
    if (jobConfig && !this.jobs.has(jobId)) {
      this.startJob(jobConfig);
      return true;
    }
    return false;
  }

  private logJobSchedule(): void {
    console.log("\n📋 Background Job Schedule:");
    console.log(
      "┌─────────────────────────┬─────────────┬─────────┬──────────┐"
    );
    console.log(
      "│ Job ID                  │ Subreddit   │ Limit   │ Interval │"
    );
    console.log(
      "├─────────────────────────┼─────────────┼─────────┼──────────┤"
    );

    this.defaultJobs.forEach((job) => {
      if (job.enabled) {
        const jobId = job.id.padEnd(23);
        const subreddit = `r/${job.subreddit}`.padEnd(11);
        const limit = job.limit.toString().padEnd(7);
        const interval = `${job.intervalMinutes}min`.padEnd(8);
        console.log(`│ ${jobId} │ ${subreddit} │ ${limit} │ ${interval} │`);
      }
    });

    console.log(
      "└─────────────────────────┴─────────────┴─────────┴──────────┘\n"
    );
  }

  public getSystemStats(): {
    totalJobs: number;
    runningJobs: number;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: string;
    uptime: string;
  } {
    const allStats = Array.from(this.jobStats.values());
    const totalRuns = allStats.reduce((sum, stats) => sum + stats.totalRuns, 0);
    const successfulRuns = allStats.reduce(
      (sum, stats) => sum + stats.successfulRuns,
      0
    );
    const failedRuns = allStats.reduce(
      (sum, stats) => sum + stats.failedRuns,
      0
    );

    return {
      totalJobs: this.defaultJobs.length,
      runningJobs: this.jobs.size,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate:
        totalRuns > 0
          ? `${((successfulRuns / totalRuns) * 100).toFixed(1)}%`
          : "0%",
      uptime:
        process.uptime() > 0
          ? `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`
          : "0s",
    };
  }
}

// Global instance
export const backgroundJobService = new BackgroundJobService();

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, stopping background jobs...");
  backgroundJobService.stopAllJobs();
});

process.on("SIGINT", () => {
  console.log("SIGINT received, stopping background jobs...");
  backgroundJobService.stopAllJobs();
});
