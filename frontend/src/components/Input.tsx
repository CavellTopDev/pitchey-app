import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  'data-testid'?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  success,
  helperText,
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  showPasswordToggle = false,
  type = 'text',
  className = '',
  disabled,
  required,
  'data-testid': testId,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = showPasswordToggle && type === 'password' 
    ? (showPassword ? 'text' : 'password')
    : type;

  const hasError = Boolean(error);
  const hasSuccess = Boolean(success);
  const hasLeftIcon = Boolean(leftIcon);
  const hasRightIcon = Boolean(rightIcon) || showPasswordToggle || hasError || hasSuccess;

  const baseClasses = 'block w-full rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const stateClasses = hasError
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : hasSuccess
    ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
    : isFocused
    ? 'border-purple-300 focus:border-purple-500 focus:ring-purple-500'
    : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500';

  const paddingClasses = [
    hasLeftIcon ? (size === 'sm' ? 'pl-9' : size === 'lg' ? 'pl-12' : 'pl-10') : '',
    hasRightIcon ? (size === 'sm' ? 'pr-9' : size === 'lg' ? 'pr-12' : 'pr-10') : ''
  ].filter(Boolean).join(' ');

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
  const iconPositionClasses = size === 'sm' 
    ? 'left-2.5 top-1.5' 
    : size === 'lg' 
    ? 'left-3 top-3.5' 
    : 'left-3 top-2.5';

  const rightIconPositionClasses = size === 'sm'
    ? 'right-2.5 top-1.5'
    : size === 'lg'
    ? 'right-3 top-3.5'
    : 'right-3 top-2.5';

  const combinedClasses = [
    baseClasses,
    sizeClasses[size],
    stateClasses,
    paddingClasses,
    fullWidth ? 'w-full' : '',
    className
  ].filter(Boolean).join(' ');

  const inputId = props.id || testId || Math.random().toString(36).substr(2, 9);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label 
          htmlFor={inputId}
          className={`block text-sm font-medium mb-2 ${
            hasError ? 'text-red-700' : hasSuccess ? 'text-green-700' : 'text-gray-700'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {hasLeftIcon && (
          <div className={`absolute ${iconPositionClasses} pointer-events-none`}>
            <div className={`${hasError ? 'text-red-400' : hasSuccess ? 'text-green-400' : 'text-gray-400'}`}>
              {leftIcon}
            </div>
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={combinedClasses}
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-testid={testId}
          aria-invalid={hasError}
          aria-describedby={
            [
              error && `${inputId}-error`,
              success && `${inputId}-success`,
              helperText && `${inputId}-help`
            ].filter(Boolean).join(' ') || undefined
          }
          {...props}
        />

        {hasRightIcon && (
          <div className={`absolute ${rightIconPositionClasses} flex items-center`}>
            {showPasswordToggle && type === 'password' ? (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`p-1 rounded transition-colors ${
                  hasError ? 'text-red-400 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'
                }`}
                data-testid={`${testId}-password-toggle`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
              </button>
            ) : hasError ? (
              <AlertCircle 
                size={iconSize} 
                className="text-red-400" 
                aria-hidden="true"
              />
            ) : hasSuccess ? (
              <Check 
                size={iconSize} 
                className="text-green-400" 
                aria-hidden="true"
              />
            ) : rightIcon ? (
              <div className="text-gray-400">
                {rightIcon}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {error && (
        <p 
          id={`${inputId}-error`}
          className="mt-1 text-sm text-red-600 flex items-center gap-1"
          role="alert"
          data-testid={`${testId}-error`}
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}

      {success && !error && (
        <p 
          id={`${inputId}-success`}
          className="mt-1 text-sm text-green-600 flex items-center gap-1"
          data-testid={`${testId}-success`}
        >
          <Check size={14} aria-hidden="true" />
          {success}
        </p>
      )}

      {helperText && !error && !success && (
        <p 
          id={`${inputId}-help`}
          className="mt-1 text-sm text-gray-500"
          data-testid={`${testId}-help`}
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;