// Logger TypeScript stub for Worker environment
type LogData = Record<string, unknown>;

export interface Logger {
  info(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  debug(message: string, data?: LogData): void;
}

export const logger: Logger = {
  info: (message: string, data?: LogData) => console.log(message, data),
  error: (message: string, data?: LogData) => console.error(message, data),
  warn: (message: string, data?: LogData) => console.warn(message, data),
  debug: (message: string, data?: LogData) => console.log(message, data),
};
