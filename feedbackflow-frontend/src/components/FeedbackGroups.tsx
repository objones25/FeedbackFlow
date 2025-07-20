'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FeedbackGroup {
  id: number;
  name: string;
  description: string;
  sentenceIds: number[];
  trendScore: number;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackGroupsProps {
  groups: FeedbackGroup[];
}

export function FeedbackGroups({ groups }: FeedbackGroupsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getTrendIcon = (trendScore: number) => {
    if (trendScore > 0.1) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (trendScore < -0.1) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    } else {
      return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trendScore: number) => {
    if (trendScore > 0.1) return 'text-green-600';
    if (trendScore < -0.1) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatTrendScore = (score: number) => {
    const percentage = (score * 100).toFixed(1);
    return `${score > 0 ? '+' : ''}${percentage}%`;
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Feedback Groups</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m8 0V4a1 1 0 00-1-1H9a1 1 0 00-1 1v1" />
            </svg>
          </div>
          <p className="text-gray-500">No feedback groups found</p>
          <p className="text-sm text-gray-400 mt-1">Groups will appear here once feedback is processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Feedback Groups</h3>
        <span className="text-sm text-gray-500">{groups.length} groups found</span>
      </div>
      
      <div className="space-y-4">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          
          return (
            <div
              key={group.id}
              className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-md font-medium text-gray-900">{group.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(group.trendScore)}
                        <span className={`text-sm font-medium ${getTrendColor(group.trendScore)}`}>
                          {formatTrendScore(group.trendScore)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {group.sentenceIds.length} sentences
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {isExpanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                  <div className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Sentences:</span>
                        <span className="ml-2 text-gray-600">{group.sentenceIds.length}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Updated:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(group.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <span className="font-medium text-gray-700">Sentence IDs:</span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {group.sentenceIds.slice(0, 10).map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            #{id}
                          </span>
                        ))}
                        {group.sentenceIds.length > 10 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            +{group.sentenceIds.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
