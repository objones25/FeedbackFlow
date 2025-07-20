'use client';

import { useState, useEffect, useCallback } from 'react';
import { SentimentChart } from '@/components/SentimentChart';
import { FeedbackGroups } from '@/components/FeedbackGroups';
import { MetricsCards } from '@/components/MetricsCards';
import { AlertPanel } from '@/components/AlertPanel';
import { RefreshCw, Calendar } from 'lucide-react';

interface DashboardData {
  metrics: {
    totalSources: number;
    totalEntries: number;
    totalSentences: number;
    totalGroups: number;
    sentimentDistribution: {
      positive: number;
      negative: number;
      neutral?: number;
    };
  };
  trends: Array<{
    date: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>;
  groups: Array<{
    id: number;
    name: string;
    description: string;
    sentenceIds: number[];
    trendScore: number;
    createdAt: string;
    updatedAt: string;
  }>;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  timeframe: string;
  lastUpdated: string;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (selectedTimeframe: string = timeframe) => {
    try {
      setRefreshing(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/feedback/dashboard?timeframe=${selectedTimeframe}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      
      // Set mock data for development
      setDashboardData({
        metrics: {
          totalSources: 5,
          totalEntries: 1250,
          totalSentences: 4800,
          totalGroups: 12,
          sentimentDistribution: {
            positive: 2880,
            negative: 960,
            neutral: 960
          }
        },
        trends: [
          { date: '2024-01-15', positive: 45, negative: 15, neutral: 20, total: 80 },
          { date: '2024-01-16', positive: 52, negative: 12, neutral: 18, total: 82 },
          { date: '2024-01-17', positive: 48, negative: 18, neutral: 22, total: 88 },
          { date: '2024-01-18', positive: 55, negative: 10, neutral: 25, total: 90 },
          { date: '2024-01-19', positive: 60, negative: 8, neutral: 27, total: 95 },
          { date: '2024-01-20', positive: 58, negative: 14, neutral: 23, total: 95 },
          { date: '2024-01-21', positive: 62, negative: 11, neutral: 25, total: 98 }
        ],
        groups: [
          {
            id: 1,
            name: 'UI/UX Issues',
            description: 'User interface and experience related feedback',
            sentenceIds: [1, 2, 3, 4, 5, 6, 7, 8],
            trendScore: -0.15,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-21T15:30:00Z'
          },
          {
            id: 2,
            name: 'Performance Concerns',
            description: 'Application speed and performance feedback',
            sentenceIds: [9, 10, 11, 12, 13],
            trendScore: -0.08,
            createdAt: '2024-01-16T14:20:00Z',
            updatedAt: '2024-01-21T12:15:00Z'
          },
          {
            id: 3,
            name: 'Feature Requests',
            description: 'New feature suggestions and requests',
            sentenceIds: [14, 15, 16, 17, 18, 19, 20, 21, 22],
            trendScore: 0.22,
            createdAt: '2024-01-17T09:45:00Z',
            updatedAt: '2024-01-21T16:00:00Z'
          }
        ],
        alerts: [
          {
            id: '1',
            type: 'warning',
            title: 'Sentiment Decline Detected',
            message: 'Negative sentiment has increased by 15% in the last 24 hours',
            timestamp: '2024-01-21T14:30:00Z',
            severity: 'medium'
          },
          {
            id: '2',
            type: 'info',
            title: 'New Feedback Source Added',
            message: 'Reddit r/webdev has been successfully connected',
            timestamp: '2024-01-21T10:15:00Z',
            severity: 'low'
          }
        ],
        timeframe: selectedTimeframe,
        lastUpdated: new Date().toISOString()
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe);
    fetchDashboardData(newTimeframe);
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const timeframeOptions = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FeedbackFlow Dashboard</h1>
              <p className="text-sm text-gray-500">
                Last updated: {dashboardData ? new Date(dashboardData.lastUpdated).toLocaleString() : 'Never'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Timeframe Selector */}
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <select
                  value={timeframe}
                  onChange={(e) => handleTimeframeChange(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {timeframeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Connection Issue:</strong> {error}. Showing demo data instead.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardData && <MetricsCards data={dashboardData.metrics} />}
          </div>

          {/* Charts and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {dashboardData && <SentimentChart data={dashboardData.trends} />}
            {dashboardData && <AlertPanel alerts={dashboardData.alerts} />}
          </div>

          {/* Feedback Groups */}
          {dashboardData && <FeedbackGroups groups={dashboardData.groups} />}
        </div>
      </div>
    </div>
  );
}
