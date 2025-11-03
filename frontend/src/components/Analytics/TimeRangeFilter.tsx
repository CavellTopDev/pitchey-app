import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface TimeRangeFilterProps {
  onChange: (range: TimeRange) => void;
  defaultRange?: TimeRange;
}

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({ 
  onChange, 
  defaultRange = '30d' 
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(defaultRange);

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onChange(range);
  };

  const ranges: { label: string; value: TimeRange }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: '1 Year', value: '1y' }
  ];

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1">
      <Calendar className="w-4 h-4 text-gray-400 ml-2" />
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => handleRangeChange(range.value)}
          className={`px-3 py-1 rounded-md text-xs transition-all duration-300 ${
            selectedRange === range.value
              ? 'bg-purple-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};