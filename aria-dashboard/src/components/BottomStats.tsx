import React from 'react';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { type FeedItem } from '../services/claude';

interface BottomStatsProps {
  liveFeed?: FeedItem[];
}

const BottomStats: React.FC<BottomStatsProps> = ({ liveFeed = [] }) => {
  const { reallocations, traps, uptimeLabel } = useActivityFeed(liveFeed);

  const stats = [
    { label: 'Reallocations Executed', value: reallocations > 0 ? String(reallocations) : '—' },
    { label: 'Traps Flagged',          value: traps > 0          ? String(traps)          : '—' },
    { label: 'Agent Uptime',           value: uptimeLabel },
    { label: 'Network',                value: 'Mantle' },
  ];

  return (
    <div className="py-6 flex flex-wrap gap-8 md:gap-16 justify-between items-center text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-16 w-full">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="font-semibold tracking-wider text-text-secondary uppercase text-[10px]">
              {stat.label}
            </span>
            <span className="font-mono text-text-primary text-base font-medium">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BottomStats;
