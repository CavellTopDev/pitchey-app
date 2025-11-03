import React, { ReactNode, ElementType } from 'react';

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  children?: ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  children,
  className = ''
}) => {
  return (
    <div 
      className={`text-center py-12 px-4 ${className}`}
      data-testid="empty-state"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md mx-auto">
        {Icon && (
          <div className="mb-4">
            <Icon className="w-16 h-16 text-gray-300 mx-auto" aria-hidden="true" />
          </div>
        )}
        
        <h3 className="text-lg font-medium text-gray-900 mb-2" data-testid="empty-state-title">
          {title}
        </h3>
        
        <p className="text-gray-500 mb-6" data-testid="empty-state-description">
          {description}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className={`px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              action.variant === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500'
                : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
            }`}
            data-testid="empty-state-action"
          >
            {action.label}
          </button>
        )}

        {children}
      </div>
    </div>
  );
};

export default EmptyState;