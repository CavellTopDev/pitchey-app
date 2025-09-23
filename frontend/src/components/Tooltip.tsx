import React, { useState, useRef, ReactNode } from 'react';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
  disabled?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
  delay = 500,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showTimeout, setShowTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    
    setShowTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    if (showTimeout) {
      clearTimeout(showTimeout);
      setShowTimeout(null);
    }

    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 100);
    
    setHideTimeout(timeout);
  };

  const getPositionClasses = () => {
    const positions = {
      top: {
        tooltip: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
        arrow: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900'
      },
      bottom: {
        tooltip: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
        arrow: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900'
      },
      left: {
        tooltip: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
        arrow: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900'
      },
      right: {
        tooltip: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
        arrow: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
      }
    };

    return positions[position];
  };

  const positionClasses = getPositionClasses();

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && !disabled && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap ${positionClasses.tooltip}`}
          role="tooltip"
        >
          {content}
          
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${positionClasses.arrow}`}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;