'use client';
import { useState, useEffect } from 'react';
import { Search, Users, MessageSquare, Calendar } from 'lucide-react';

interface FeedbackGroup {
  id: number;
  name: string;
  description: string;
  sentenceIds: number[];
  trendScore: number;
  createdAt: string;
  updatedAt: string;
}

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

interface Sentence {
  id: number;
  entryId: number;
  text: string;
  sentimentScore: number;
  sentimentLabel: string;
  categories: string[];
  author?: string;
  entryTimestamp?: string;
  metadata?: Record<string, unknown>;
  rawText?: string;
  sourceName?: string;
  sourceType?: string;
  structuredAnalysis?: StructuredFeedback;
  redditData?: {
    title?: string;
    subreddit?: string;
    score?: number;
    numComments?: number;
    permalink?: string;
  };
}

export default function DataPage() {
  const [groups, setGroups] = useState<FeedbackGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FeedbackGroup | null>(null);
  const [groupSentences, setGroupSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('trendScore');

  const fetchGroups = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/feedback/groups`);
      const data = await response.json();
      
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (group: FeedbackGroup) => {
    try {
      setSelectedGroup(group);
      
      // Fetch real sentences from the API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/groups/${group.id}/sentences`);
      const data = await response.json();
      console.log('group details', data);
      
      if (data.success && data.data && data.data.sentences) {
        const sentences: Sentence[] = data.data.sentences.map((sentence: Record<string, unknown>) => ({
          id: sentence.id as number,
          entryId: sentence.entryId as number,
          text: sentence.text as string,
          sentimentScore: sentence.sentimentScore as number,
          sentimentLabel: sentence.sentimentLabel as string,
          categories: (sentence.categories as string[]) || [],
          author: sentence.author as string | undefined,
          entryTimestamp: sentence.entryTimestamp as string | undefined,
          metadata: sentence.metadata as Record<string, unknown> | undefined,
          rawText: sentence.rawText as string | undefined,
          sourceName: sentence.sourceName as string | undefined,
          sourceType: sentence.sourceType as string | undefined,
          structuredAnalysis: sentence.structuredAnalysis as StructuredFeedback | undefined,
          redditData: sentence.redditData as {
            title?: string;
            subreddit?: string;
            score?: number;
            numComments?: number;
            permalink?: string;
          } | undefined
        }));
        setGroupSentences(sentences);
      } else {
        console.error('Failed to fetch sentences:', data.error);
        setGroupSentences([]);
      }
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      setGroupSentences([]);
    }
  };

  const filteredGroups = groups
    .filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'trendScore':
          return b.trendScore - a.trendScore;
        case 'size':
          return b.sentenceIds.length - a.sentenceIds.length;
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'positive':
        return 'text-green-600 bg-green-100';
      case 'negative':
        return 'text-red-600 bg-red-100';
      case 'neutral':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
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

  useEffect(() => {
    fetchGroups();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-8 w-8 animate-pulse text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading feedback data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Explorer</h1>
          <p className="text-gray-600">Explore feedback clusters, sentiment analysis, and detailed insights</p>
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
              {filteredGroups.length} groups found
            </span>
            <span>
              Total items: {filteredGroups.reduce((sum, group) => sum + group.sentenceIds.length, 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Groups List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Search and Filters */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="trendScore">Trend Score</option>
                    <option value="size">Group Size</option>
                    <option value="recent">Most Recent</option>
                  </select>
                </div>
              </div>

              {/* Groups List */}
              <div className="max-h-[600px] overflow-y-auto">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => fetchGroupDetails(group)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedGroup?.id === group.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm truncate flex-1">
                        {group.name}
                      </h3>
                      <span className={`text-xs font-medium ${getTrendScoreColor(group.trendScore)}`}>
                        {(group.trendScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {group.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {group.sentenceIds.length} items
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(group.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Group Details */}
          <div className="lg:col-span-2">
            {selectedGroup ? (
              <div className="bg-white rounded-lg shadow-sm">
                {/* Group Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {selectedGroup.name}
                      </h2>
                      <p className="text-gray-600 mb-4">{selectedGroup.description}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getTrendScoreColor(selectedGroup.trendScore)}`}>
                        {(selectedGroup.trendScore * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">Trend Score</div>
                    </div>
                  </div>

                  {/* Group Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedGroup.sentenceIds.length}
                      </div>
                      <div className="text-sm text-gray-500">Total Items</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">
                        {new Date(selectedGroup.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">Created</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">
                        {new Date(selectedGroup.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">Updated</div>
                    </div>
                  </div>
                </div>

                {/* Sentences List */}
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Feedback Items ({groupSentences.length})
                  </h3>
                  
                  <div className="space-y-4">
                    {groupSentences.map((sentence) => (
                      <div key={sentence.id} className="border border-gray-200 rounded-lg p-4">
                        {/* Reddit Post Header (if available) */}
                        {(sentence.sourceType === 'reddit' || sentence.redditData) && (
                          <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-gray-900 text-sm">
                                Reddit Post {sentence.rawText ? `- ${sentence.rawText.split('\n')[0]}` : ''}
                              </h4>
                              {sentence.metadata && 'url' in sentence.metadata && sentence.metadata.url ? (
                                <a
                                  href={`https://reddit.com${sentence.metadata.url as string}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  View on Reddit
                                </a>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              {(sentence.redditData?.subreddit || (sentence.metadata && 'subreddit' in sentence.metadata && String(sentence.metadata.subreddit))) && (
                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  r/{sentence.redditData?.subreddit || (sentence.metadata && 'subreddit' in sentence.metadata ? String(sentence.metadata.subreddit) : '')}
                                </span>
                              )}
                              {sentence.author && (
                                <span>by u/{sentence.author}</span>
                              )}
                              {(sentence.redditData?.score !== undefined || (sentence.metadata && 'score' in sentence.metadata && sentence.metadata.score !== undefined)) && (
                                <span>{sentence.redditData?.score || (sentence.metadata && 'score' in sentence.metadata ? Number(sentence.metadata.score) : 0)} points</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sentence Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">
                              #{sentence.id}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(sentence.sentimentLabel)}`}>
                              {sentence.sentimentLabel}
                            </span>
                            {sentence.sourceType && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                {sentence.sourceType}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Score: {sentence.sentimentScore.toFixed(3)}
                          </div>
                        </div>
                        
                        {/* Sentence Text */}
                        <p className="text-gray-900 mb-3">{sentence.text}</p>
                        
                        {/* Enhanced Gemini Analysis (if available) */}
                        {sentence.structuredAnalysis && (
                          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-semibold text-blue-900">🤖 Gemini AI Analysis</span>
                            </div>
                            
                            {/* Analysis Badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(sentence.structuredAnalysis.category)}`}>
                                {sentence.structuredAnalysis.category.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUrgencyColor(sentence.structuredAnalysis.urgency)}`}>
                                {sentence.structuredAnalysis.urgency.toUpperCase()} URGENCY
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentColor(sentence.structuredAnalysis.sentiment.primary)}`}>
                                {sentence.structuredAnalysis.sentiment.primary.toUpperCase()} ({Math.round(sentence.structuredAnalysis.sentiment.confidence * 100)}%)
                              </span>
                            </div>

                            {/* Summary */}
                            <div className="mb-3">
                              <h6 className="text-sm font-semibold text-gray-800 mb-1">Summary</h6>
                              <p className="text-sm text-gray-700">{sentence.structuredAnalysis.summary}</p>
                            </div>

                            {/* Themes */}
                            {sentence.structuredAnalysis.themes.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-sm font-semibold text-gray-800 mb-1">Key Themes</h6>
                                <div className="flex flex-wrap gap-1">
                                  {sentence.structuredAnalysis.themes.map((theme, index) => (
                                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                      {theme}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Emotions */}
                            {sentence.structuredAnalysis.sentiment.emotions.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-sm font-semibold text-gray-800 mb-1">Emotions</h6>
                                <div className="flex flex-wrap gap-1">
                                  {sentence.structuredAnalysis.sentiment.emotions.map((emotion, index) => (
                                    <span key={index} className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded">
                                      {emotion}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Items */}
                            {sentence.structuredAnalysis.actionItems.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-sm font-semibold text-gray-800 mb-1">Action Items</h6>
                                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                                  {sentence.structuredAnalysis.actionItems.map((item, index) => (
                                    <li key={index}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Suggested Response */}
                            {sentence.structuredAnalysis.suggestedResponse && (
                              <div className="mb-3">
                                <h6 className="text-sm font-semibold text-gray-800 mb-1">Suggested Response</h6>
                                <div className="bg-green-100 border border-green-300 rounded p-2">
                                  <p className="text-sm text-green-800">{sentence.structuredAnalysis.suggestedResponse}</p>
                                </div>
                              </div>
                            )}

                            {/* Key Phrases */}
                            {sentence.structuredAnalysis.keyPhrases.length > 0 && (
                              <div>
                                <h6 className="text-sm font-semibold text-gray-800 mb-1">Key Phrases</h6>
                                <div className="flex flex-wrap gap-1">
                                  {sentence.structuredAnalysis.keyPhrases.map((phrase, index) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border">
                                      &quot;{phrase}&quot;
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Raw Text (Full Reddit Post Content) */}
                        {sentence.rawText && sentence.rawText !== sentence.text && (
                          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Full Reddit Post:</h5>
                            <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {sentence.rawText}
                            </div>
                          </div>
                        )}
                        
                        {/* Author and Timestamp (if not Reddit post) */}
                        {sentence.author && !sentence.redditData?.title && (
                          <div className="text-xs text-gray-500 mb-2">
                            by {sentence.author}
                            {sentence.entryTimestamp && (
                              <span className="ml-2">
                                • {new Date(sentence.entryTimestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Categories */}
                        {sentence.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {sentence.categories.map((category) => (
                              <span
                                key={category}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Source Information */}
                        {sentence.sourceName && (
                          <div className="text-xs text-gray-400 border-t pt-2 mt-2">
                            Source: {sentence.sourceName}
                            {sentence.entryTimestamp && (
                              <span className="ml-2">
                                • {new Date(sentence.entryTimestamp).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Feedback Group
                </h3>
                <p className="text-gray-600">
                  Choose a group from the left panel to view detailed feedback items and analysis
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
