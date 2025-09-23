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
    <div className={`text-center py-12 px-4 ${className}`}>
      <div className="max-w-md mx-auto">
        {Icon && (
          <div className="mb-4">
            <Icon className="w-16 h-16 text-gray-300 mx-auto" />
          </div>
        )}
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-gray-500 mb-6">
          {description}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              action.variant === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
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