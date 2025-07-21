'use client';

import { TrendingUp, MessageSquare, Users, Target } from 'lucide-react';

interface MetricsData {
  totalSources: number;
  totalEntries: number;
  totalSentences: number;
  totalGroups: number;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral?: number;
  };
}

interface MetricsCardsProps {
  data: MetricsData;
}

export function MetricsCards({ data }: MetricsCardsProps) {
  const totalSentiments = data.sentimentDistribution.positive + 
                         data.sentimentDistribution.negative + 
                         (data.sentimentDistribution.neutral || 0);

  const positivePercentage = totalSentiments > 0 
    ? ((data.sentimentDistribution.positive / totalSentiments) * 100).toFixed(1)
    : '0';

  const cards = [
    {
      title: 'Total Sources',
      value: data.totalSources.toLocaleString(),
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      description: 'Active feedback sources'
    },
    {
      title: 'Feedback Entries',
      value: data.totalEntries.toLocaleString(),
      icon: MessageSquare,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      description: 'Total feedback collected'
    },
    {
      title: 'Sentences Analyzed',
      value: data.totalSentences.toLocaleString(),
      icon: Target,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      description: 'Individual sentences processed'
    },
    {
      title: 'Positive Sentiment',
      value: `${positivePercentage}%`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      description: 'Overall positive feedback'
    }
  ];

  return (
    <>
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <div
            key={`metric-${card.title}-${index}`}
            className={`${card.bgColor} p-6 rounded-lg shadow-lg border border-gray-200 transition-all duration-200 hover:shadow-xl hover:scale-105`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <p className={`text-3xl font-bold ${card.textColor} mb-1`}>
                  {card.value}
                </p>
                <p className="text-xs text-gray-500">
                  {card.description}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-full`}>
                <IconComponent className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
