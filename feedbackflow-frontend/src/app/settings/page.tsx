'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Settings as SettingsIcon, Database, Activity, Bell } from 'lucide-react';

interface CustomJob {
  subreddit: string;
  intervalMinutes: number;
  limit: number;
}

export default function SettingsPage() {
  const [customJob, setCustomJob] = useState<CustomJob>({
    subreddit: '',
    intervalMinutes: 30,
    limit: 10
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddCustomJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/jobs/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customJob),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Custom job created for r/${customJob.subreddit}` });
        setCustomJob({ subreddit: '', intervalMinutes: 30, limit: 10 });
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Failed to create custom job' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to create custom job' });
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => {
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    if (message) {
      clearMessage();
    }
  }, [message]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure data sources, job settings, and system preferences</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="space-y-8">
          {/* Data Sources Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-6">
              <Database className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Data Sources</h2>
            </div>

            {/* Add Custom Job */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Custom Reddit Source</h3>
              
              <form onSubmit={handleAddCustomJob} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="subreddit" className="block text-sm font-medium text-gray-700 mb-1">
                      Subreddit
                    </label>
                    <input
                      type="text"
                      id="subreddit"
                      value={customJob.subreddit}
                      onChange={(e) => setCustomJob({ ...customJob, subreddit: e.target.value })}
                      placeholder="e.g., reactjs"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter subreddit name without &#39;r/&#39;</p>
                  </div>

                  <div>
                    <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-1">
                      Interval (minutes)
                    </label>
                    <input
                      type="number"
                      id="interval"
                      value={customJob.intervalMinutes}
                      onChange={(e) => setCustomJob({ ...customJob, intervalMinutes: parseInt(e.target.value) })}
                      min="5"
                      max="1440"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">5-1440 minutes</p>
                  </div>

                  <div>
                    <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
                      Posts Limit
                    </label>
                    <input
                      type="number"
                      id="limit"
                      value={customJob.limit}
                      onChange={(e) => setCustomJob({ ...customJob, limit: parseInt(e.target.value) })}
                      min="1"
                      max="50"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">1-50 posts per run</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  {loading ? 'Creating...' : 'Add Custom Job'}
                </button>
              </form>
            </div>

            {/* Current Sources Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Default Sources</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
                <div>• r/webdev (15min, 8 posts)</div>
                <div>• r/reactjs (20min, 6 posts)</div>
                <div>• r/javascript (25min, 10 posts)</div>
                <div>• r/programming (30min, 12 posts)</div>
                <div>• r/Frontend (35min, 6 posts)</div>
                <div>• r/node (40min, 8 posts)</div>
              </div>
            </div>
          </div>

          {/* Processing Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-6">
              <Activity className="h-6 w-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Processing Settings</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">NLP Configuration</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Sentiment Threshold</span>
                    <span className="text-sm font-medium text-gray-900">0.5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Clustering Threshold</span>
                    <span className="text-sm font-medium text-gray-900">0.3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Max Sentences per Entry</span>
                    <span className="text-sm font-medium text-gray-900">1000</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Performance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Batch Size</span>
                    <span className="text-sm font-medium text-gray-900">25</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Clustering Enabled</span>
                    <span className="text-sm font-medium text-green-600">✓ Yes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Background Processing</span>
                    <span className="text-sm font-medium text-green-600">✓ Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-6">
              <SettingsIcon className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">System Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">API Endpoints</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Backend API</span>
                    <span className="text-green-600 font-medium">✓ Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Database</span>
                    <span className="text-green-600 font-medium">✓ Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Redis Cache</span>
                    <span className="text-green-600 font-medium">✓ Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Hugging Face API</span>
                    <span className="text-green-600 font-medium">✓ Connected</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Environment</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Environment</span>
                    <span className="text-gray-900 font-medium">Development</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Frontend Port</span>
                    <span className="text-gray-900 font-medium">3000</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Backend Port</span>
                    <span className="text-gray-900 font-medium">3001</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Database Port</span>
                    <span className="text-gray-900 font-medium">5432</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-6">
              <Bell className="h-6 w-6 text-yellow-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Job Failure Alerts</h3>
                  <p className="text-sm text-gray-500">Get notified when background jobs fail</p>
                </div>
                <button className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
                  <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Sentiment Anomalies</h3>
                  <p className="text-sm text-gray-500">Alert on significant sentiment changes</p>
                </div>
                <button className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
                  <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Daily Reports</h3>
                  <p className="text-sm text-gray-500">Receive daily summary reports</p>
                </div>
                <button className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2">
                  <span className="translate-x-0 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
