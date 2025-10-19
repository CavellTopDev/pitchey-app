import type { StorageProvider } from "./interface.ts";
import { LocalStorageProvider } from "./local-provider.ts";
import { S3StorageProvider } from "./s3-provider.ts";

/**
 * Storage factory that creates the appropriate storage provider based on environment configuration
 */
export class StorageFactory {
  private static instance: StorageProvider | null = null;

  /**
   * Get storage provider instance (singleton)
   */
  static getProvider(): StorageProvider {
    if (!this.instance) {
      this.instance = this.createProvider();
    }
    return this.instance;
  }

  /**
   * Create a new storage provider based on environment configuration
   */
  static createProvider(): StorageProvider {
    const storageProvider = Deno.env.get("STORAGE_PROVIDER")?.toLowerCase() || "local";
    
    // Check if AWS credentials are available
    const hasAwsCredentials = !!(
      Deno.env.get("AWS_ACCESS_KEY_ID") && 
      Deno.env.get("AWS_SECRET_ACCESS_KEY") && 
      Deno.env.get("AWS_S3_BUCKET")
    );

    console.log(`Storage Factory: Requested provider: ${storageProvider}, AWS credentials available: ${hasAwsCredentials}`);

    switch (storageProvider) {
      case "s3":
        if (!hasAwsCredentials) {
          console.warn("Storage Factory: S3 provider requested but AWS credentials not available, falling back to local storage");
          return new LocalStorageProvider();
        }
        try {
          console.log("Storage Factory: Creating S3 storage provider");
          return new S3StorageProvider();
        } catch (error) {
          console.error("Storage Factory: Failed to create S3 provider, falling back to local storage:", error);
          return new LocalStorageProvider();
        }

      case "local":
        console.log("Storage Factory: Creating local storage provider");
        return new LocalStorageProvider();

      case "hybrid":
        // Hybrid mode: try S3 first, fall back to local
        if (hasAwsCredentials) {
          try {
            console.log("Storage Factory: Creating S3 storage provider (hybrid mode)");
            return new S3StorageProvider();
          } catch (error) {
            console.error("Storage Factory: Failed to create S3 provider in hybrid mode, falling back to local storage:", error);
            return new LocalStorageProvider();
          }
        } else {
          console.log("Storage Factory: No AWS credentials available for hybrid mode, using local storage");
          return new LocalStorageProvider();
        }

      default:
        console.warn(`Storage Factory: Unknown storage provider '${storageProvider}', defaulting to local storage`);
        return new LocalStorageProvider();
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Get information about the current storage configuration
   */
  static getStorageInfo(): {
    provider: string;
    hasAwsCredentials: boolean;
    awsBucket?: string;
    awsRegion?: string;
    cloudFrontUrl?: string;
  } {
    const storageProvider = Deno.env.get("STORAGE_PROVIDER")?.toLowerCase() || "local";
    const hasAwsCredentials = !!(
      Deno.env.get("AWS_ACCESS_KEY_ID") && 
      Deno.env.get("AWS_SECRET_ACCESS_KEY") && 
      Deno.env.get("AWS_S3_BUCKET")
    );

    const info: ReturnType<typeof StorageFactory.getStorageInfo> = {
      provider: storageProvider,
      hasAwsCredentials,
    };

    if (hasAwsCredentials) {
      info.awsBucket = Deno.env.get("AWS_S3_BUCKET");
      info.awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";
      info.cloudFrontUrl = Deno.env.get("CLOUDFRONT_URL");
    }

    return info;
  }

  /**
   * Validate storage configuration
   */
  static validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const storageProvider = Deno.env.get("STORAGE_PROVIDER")?.toLowerCase() || "local";

    // Check if storage provider is valid
    const validProviders = ["local", "s3", "hybrid"];
    if (!validProviders.includes(storageProvider)) {
      warnings.push(`Unknown storage provider '${storageProvider}', will default to 'local'`);
    }

    // Check AWS configuration if S3 is requested
    if (storageProvider === "s3" || storageProvider === "hybrid") {
      const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
      const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
      const awsS3Bucket = Deno.env.get("AWS_S3_BUCKET");

      if (!awsAccessKeyId) {
        if (storageProvider === "s3") {
          errors.push("AWS_ACCESS_KEY_ID is required for S3 storage provider");
        } else {
          warnings.push("AWS_ACCESS_KEY_ID not set, will fall back to local storage in hybrid mode");
        }
      }

      if (!awsSecretAccessKey) {
        if (storageProvider === "s3") {
          errors.push("AWS_SECRET_ACCESS_KEY is required for S3 storage provider");
        } else {
          warnings.push("AWS_SECRET_ACCESS_KEY not set, will fall back to local storage in hybrid mode");
        }
      }

      if (!awsS3Bucket) {
        if (storageProvider === "s3") {
          errors.push("AWS_S3_BUCKET is required for S3 storage provider");
        } else {
          warnings.push("AWS_S3_BUCKET not set, will fall back to local storage in hybrid mode");
        }
      }

      // Check optional CloudFront configuration
      const cloudFrontUrl = Deno.env.get("CLOUDFRONT_URL");
      const distributionId = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID");

      if (cloudFrontUrl && !distributionId) {
        warnings.push("CLOUDFRONT_URL is set but CLOUDFRONT_DISTRIBUTION_ID is missing, cache invalidation will not work");
      }

      if (!cloudFrontUrl && distributionId) {
        warnings.push("CLOUDFRONT_DISTRIBUTION_ID is set but CLOUDFRONT_URL is missing");
      }
    }

    // Check file size limits
    const maxFileSize = parseInt(Deno.env.get("MAX_FILE_SIZE_MB") || "50");
    const maxImageSize = parseInt(Deno.env.get("MAX_IMAGE_SIZE_MB") || "10");
    const maxVideoSize = parseInt(Deno.env.get("MAX_VIDEO_SIZE_MB") || "500");

    if (maxImageSize > maxFileSize) {
      warnings.push("MAX_IMAGE_SIZE_MB is larger than MAX_FILE_SIZE_MB");
    }

    if (maxVideoSize < 100) {
      warnings.push("MAX_VIDEO_SIZE_MB is very small (< 100MB), consider increasing for video files");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}