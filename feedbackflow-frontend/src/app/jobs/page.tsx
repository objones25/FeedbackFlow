'use client';
import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, CheckCircle, XCircle, Activity } from 'lucide-react';

interface Job {
  id: string;
  subreddit: string;
  intervalMinutes: number;
  limit: number;
  isRunning: boolean;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRun?: string;
  nextRun?: string;
}

interface SystemStats {
  totalJobs: number;
  runningJobs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: string;
  uptime: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobsStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/jobs/status`);
      const data = await response.json();
      
      if (data.success) {
        setJobs(data.data.jobs);
        setSystemStats(data.data.systemStats);
      }
    } catch (error) {
      console.error('Failed to fetch jobs status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAllJobs = async () => {
    setActionLoading('start-all');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/jobs/start`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchJobsStatus();
      }
    } catch (error) {
      console.error('Failed to start jobs:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopAllJobs = async () => {
    setActionLoading('stop-all');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/jobs/stop`, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchJobsStatus();
      }
    } catch (error) {
      console.error('Failed to stop jobs:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartJobs = async () => {
    setActionLoading('restart');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/jobs/stop`, { method: 'POST' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetch(`${apiUrl}/api/jobs/start`, { method: 'POST' });
      await fetchJobsStatus();
    } catch (error) {
      console.error('Failed to restart jobs:', error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchJobsStatus();
    const interval = setInterval(fetchJobsStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading jobs status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Management</h1>
          <p className="text-gray-600">Monitor and control background data collection jobs</p>
        </div>

        {/* System Stats */}
        {systemStats && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemStats.totalJobs}</div>
                <div className="text-sm text-gray-500">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{systemStats.runningJobs}</div>
                <div className="text-sm text-gray-500">Running</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{systemStats.totalRuns}</div>
                <div className="text-sm text-gray-500">Total Runs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{systemStats.successfulRuns}</div>
                <div className="text-sm text-gray-500">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{systemStats.failedRuns}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemStats.successRate}</div>
                <div className="text-sm text-gray-500">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{systemStats.uptime}</div>
                <div className="text-sm text-gray-500">Uptime</div>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Controls</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleStartAllJobs}
              disabled={actionLoading === 'start-all'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              {actionLoading === 'start-all' ? 'Starting...' : 'Start All Jobs'}
            </button>
            
            <button
              onClick={handleStopAllJobs}
              disabled={actionLoading === 'stop-all'}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pause className="h-4 w-4" />
              {actionLoading === 'stop-all' ? 'Stopping...' : 'Stop All Jobs'}
            </button>
            
            <button
              onClick={handleRestartJobs}
              disabled={actionLoading === 'restart'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-4 w-4" />
              {actionLoading === 'restart' ? 'Restarting...' : 'Restart All Jobs'}
            </button>
            
            <button
              onClick={fetchJobsStatus}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Activity className="h-4 w-4" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Individual Jobs</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subreddit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Runs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {job.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        r/{job.subreddit}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {job.isRunning ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm text-green-600 font-medium">Running</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-sm text-red-600 font-medium">Stopped</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        {job.intervalMinutes}m
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.limit} posts
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="text-center">
                        <div className="text-sm font-medium">{job.totalRuns}</div>
                        <div className="text-xs text-gray-500">
                          ✓{job.successfulRuns} ✗{job.failedRuns}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${job.totalRuns > 0 ? (job.successfulRuns / job.totalRuns) * 100 : 0}%`
                            }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">
                          {job.totalRuns > 0 ? Math.round((job.successfulRuns / job.totalRuns) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
