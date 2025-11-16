// Storage service interfaces and types
export type { 
  StorageProvider, 
  UploadResult, 
  UploadOptions, 
  PresignedUploadResult 
} from "./interface.ts";

// Storage providers
export { LocalStorageProvider } from "./local-provider.ts";
export { S3StorageProvider } from "./s3-provider.ts";
export { R2StorageProvider } from "./r2-provider.ts";

// Storage factory
export { StorageFactory } from "./factory.ts";

// Import the factory for use in utility functions
import { StorageFactory } from "./factory.ts";

/**
 * Get the configured storage provider instance
 * This is the main entry point for using the storage service
 */
export const getStorageProvider = () => StorageFactory.getProvider();

/**
 * Utility function to get storage information
 */
export const getStorageInfo = () => StorageFactory.getStorageInfo();

/**
 * Utility function to validate storage configuration
 */
export const validateStorageConfig = () => StorageFactory.validateConfiguration();