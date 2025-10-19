// Simple logging service to replace Sentry
// Provides console-based logging with proper context and formatting

export interface LogContext {
  [key: string]: any;
}

export class LoggingService {
  // Log an error with context
  static logError(error: any, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    console.error(`[${timestamp}] ERROR: ${errorMessage}`);
    
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    if (context && Object.keys(context).length > 0) {
      console.error('Context:', context);
    }
  }

  // Log a warning message
  static logWarning(message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARNING: ${message}`);
    
    if (context && Object.keys(context).length > 0) {
      console.warn('Context:', context);
    }
  }

  // Log an info message
  static logInfo(message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`);
    
    if (context && Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
  }

  // Add breadcrumb-style logging (just logs the breadcrumb)
  static addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: "debug" | "info" | "warning" | "error";
    data?: Record<string, any>;
  }) {
    const timestamp = new Date().toISOString();
    const level = breadcrumb.level || 'info';
    const category = breadcrumb.category || 'general';
    
    console.log(`[${timestamp}] BREADCRUMB [${level.toUpperCase()}] ${category}: ${breadcrumb.message}`);
    
    if (breadcrumb.data && Object.keys(breadcrumb.data).length > 0) {
      console.log('Data:', breadcrumb.data);
    }
  }

  // Set user context (just logs it for debugging)
  static setUser(user: { id?: string | number; email?: string; username?: string }) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] USER CONTEXT: ${user.email || user.id || user.username}`);
  }

  // Set tag (just logs it for debugging)
  static setTag(key: string, value: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] TAG: ${key}=${value}`);
  }
}

// Export convenience functions for drop-in replacement
export const captureException = (error: Error, context?: LogContext) => 
  LoggingService.logError(error, context);

export const captureMessage = (message: string, level?: "info" | "warning" | "error") => {
  if (level === 'error') {
    LoggingService.logError(message);
  } else if (level === 'warning') {
    LoggingService.logWarning(message);
  } else {
    LoggingService.logInfo(message);
  }
};

export const setUser = (user: { id?: string | number; email?: string; username?: string }) =>
  LoggingService.setUser(user);

export const setTag = (key: string, value: string) =>
  LoggingService.setTag(key, value);

export const addBreadcrumb = (breadcrumb: any) =>
  LoggingService.addBreadcrumb(breadcrumb);

// Export the service as default
export default LoggingService;