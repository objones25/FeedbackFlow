'use client';

import React, { useState } from 'react';

interface StructuredFeedback {
  sentiment: {
    primary: 'positive' | 'negative' | 'neutral';
    confidence: number;
    emotions: string[];
  };
  category: 'bug_report' | 'feature_request' | 'complaint' | 'praise' | 'question' | 'discussion';
  themes: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestedResponse?: string;
  actionItems: string[];
  keyPhrases: string[];
}

interface EnhancedAnalysisResult {
  processedCount: number;
  sentencesCount: number;
  clustersCount: number;
  outlierCount: number;
  processingTimeMs: number;
  structuredAnalyses?: StructuredFeedback[];
}

const EnhancedFeedbackAnalysis: React.FC = () => {
  const [subreddit, setSubreddit] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnhancedAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!subreddit.trim()) {
      setError('Please enter a subreddit name');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/feedback/process/reddit-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: subreddit.trim(),
          options: {
            batchSize: 5,
            useGeminiAnalysis: true,
          },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Analysis failed');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      bug_report: 'bg-red-100 text-red-800',
      feature_request: 'bg-blue-100 text-blue-800',
      complaint: 'bg-orange-100 text-orange-800',
      praise: 'bg-green-100 text-green-800',
      question: 'bg-purple-100 text-purple-800',
      discussion: 'bg-gray-100 text-gray-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getUrgencyColor = (urgency: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[urgency as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentColor = (sentiment: string) => {
    const colors = {
      positive: 'bg-green-100 text-green-800',
      negative: 'bg-red-100 text-red-800',
      neutral: 'bg-gray-100 text-gray-800',
    };
    return colors[sentiment as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        🤖 Enhanced Feedback Analysis (Gemini AI)
      </h2>

      <div className="mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            placeholder="Enter subreddit name (e.g., javascript, webdev)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !subreddit.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Analyze with Gemini'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.processedCount}</div>
              <div className="text-sm text-blue-800">Posts Processed</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.sentencesCount}</div>
              <div className="text-sm text-green-800">Analyses</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{result.clustersCount}</div>
              <div className="text-sm text-purple-800">Categories</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{result.outlierCount}</div>
              <div className="text-sm text-orange-800">Outliers</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{Math.round(result.processingTimeMs / 1000)}s</div>
              <div className="text-sm text-gray-800">Processing Time</div>
            </div>
          </div>

          {/* Structured Analyses */}
          {result.structuredAnalyses && result.structuredAnalyses.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Detailed Analysis Results
              </h3>
              <div className="space-y-4">
                {result.structuredAnalyses.map((analysis, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6">
                    {/* Header with badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(analysis.category)}`}>
                        {analysis.category.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(analysis.urgency)}`}>
                        {analysis.urgency.toUpperCase()} URGENCY
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(analysis.sentiment.primary)}`}>
                        {analysis.sentiment.primary.toUpperCase()} ({Math.round(analysis.sentiment.confidence * 100)}%)
                      </span>
                    </div>

                    {/* Summary */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                      <p className="text-gray-700">{analysis.summary}</p>
                    </div>

                    {/* Themes */}
                    {analysis.themes.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Key Themes</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.themes.map((theme, themeIndex) => (
                            <span key={themeIndex} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Emotions */}
                    {analysis.sentiment.emotions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Detected Emotions</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.sentiment.emotions.map((emotion, emotionIndex) => (
                            <span key={emotionIndex} className="px-2 py-1 bg-pink-50 text-pink-700 rounded text-sm">
                              {emotion}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {analysis.actionItems.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Recommended Actions</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {analysis.actionItems.map((item, itemIndex) => (
                            <li key={itemIndex} className="text-gray-700">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Response */}
                    {analysis.suggestedResponse && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Suggested Response</h4>
                        <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                          <p className="text-green-800">{analysis.suggestedResponse}</p>
                        </div>
                      </div>
                    )}

                    {/* Key Phrases */}
                    {analysis.keyPhrases.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Key Phrases</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.keyPhrases.map((phrase, phraseIndex) => (
                            <span key={phraseIndex} className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-sm border">
                              &quot;{phrase}&quot;
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedFeedbackAnalysis;
