// Validation schemas for all API endpoints
// Uses the validation utility to ensure data integrity

import { ValidationSchema } from "../utils/validation.ts";
import { 
  validateEmail, 
  validatePassword, 
  validateUsername,
  validateAndSanitizeText,
  validateURL,
  validateUUID
} from "../utils/validation.ts";

// User registration schema
export const registrationSchema: ValidationSchema = {
  email: {
    required: true,
    type: "string",
    custom: (value) => validateEmail(value),
  },
  password: {
    required: true,
    type: "string",
    custom: (value) => validatePassword(value),
  },
  name: {
    required: true,
    type: "string",
    minLength: 2,
    maxLength: 100,
    custom: (value) => validateAndSanitizeText(value, 100),
  },
  role: {
    required: true,
    type: "string",
    enum: ["creator", "investor", "production"],
  },
  company: {
    required: false,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  bio: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
};

// Login schema
export const loginSchema: ValidationSchema = {
  email: {
    required: true,
    type: "string",
    custom: (value) => validateEmail(value),
  },
  password: {
    required: true,
    type: "string",
    minLength: 1,
    maxLength: 200,
  },
};

// Pitch creation schema
export const pitchCreationSchema: ValidationSchema = {
  title: {
    required: true,
    type: "string",
    minLength: 3,
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  genre: {
    required: true,
    type: "string",
    enum: [
      "Action", "Comedy", "Drama", "Horror", "Sci-Fi", 
      "Thriller", "Romance", "Documentary", "Animation", "Other"
    ],
  },
  format: {
    required: true,
    type: "string",
    enum: ["Feature Film", "TV Series", "Web Series", "Short Film", "Documentary", "Other"],
  },
  logline: {
    required: true,
    type: "string",
    minLength: 10,
    maxLength: 300,
    custom: (value) => validateAndSanitizeText(value, 300),
  },
  shortSynopsis: {
    required: false,
    type: "string",
    maxLength: 1000,
    custom: (value) => validateAndSanitizeText(value, 1000),
  },
  fullSynopsis: {
    required: false,
    type: "string",
    maxLength: 5000,
    custom: (value) => validateAndSanitizeText(value, 5000),
  },
  budget: {
    required: false,
    type: "string",
    pattern: /^\$?[\d,]+(\.\d{2})?$/,
  },
  targetAudience: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
  comparableTitles: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
  productionTimeline: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
  attachedTalent: {
    required: false,
    type: "string",
    maxLength: 1000,
    custom: (value) => validateAndSanitizeText(value, 1000),
  },
  distributionStrategy: {
    required: false,
    type: "string",
    maxLength: 1000,
    custom: (value) => validateAndSanitizeText(value, 1000),
  },
};

// Pitch update schema (similar to creation but all fields optional)
export const pitchUpdateSchema: ValidationSchema = {
  ...pitchCreationSchema,
  title: { ...pitchCreationSchema.title, required: false },
  genre: { ...pitchCreationSchema.genre, required: false },
  format: { ...pitchCreationSchema.format, required: false },
  logline: { ...pitchCreationSchema.logline, required: false },
};

// Message schema
export const messageSchema: ValidationSchema = {
  recipientId: {
    required: true,
    type: "string",
    custom: (value) => validateUUID(value),
  },
  subject: {
    required: false,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  content: {
    required: true,
    type: "string",
    minLength: 1,
    maxLength: 5000,
    custom: (value) => validateAndSanitizeText(value, 5000),
  },
  pitchId: {
    required: false,
    type: "number",
    min: 1,
  },
};

// NDA request schema
export const ndaRequestSchema: ValidationSchema = {
  pitchId: {
    required: true,
    type: "number",
    min: 1,
  },
  requestorId: {
    required: true,
    type: "string",
    custom: (value) => validateUUID(value),
  },
  requestorType: {
    required: true,
    type: "string",
    enum: ["investor", "production"],
  },
  message: {
    required: false,
    type: "string",
    maxLength: 1000,
    custom: (value) => validateAndSanitizeText(value, 1000),
  },
  companyName: {
    required: true,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  companyAddress: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
  signatoryName: {
    required: true,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  signatoryTitle: {
    required: true,
    type: "string",
    maxLength: 100,
    custom: (value) => validateAndSanitizeText(value, 100),
  },
};

// Payment schema
export const paymentSchema: ValidationSchema = {
  amount: {
    required: true,
    type: "number",
    min: 0.01,
    max: 999999.99,
  },
  currency: {
    required: true,
    type: "string",
    enum: ["USD", "EUR", "GBP"],
  },
  paymentMethodId: {
    required: true,
    type: "string",
    pattern: /^pm_[a-zA-Z0-9_]+$/,
  },
  description: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
};

// Subscription schema
export const subscriptionSchema: ValidationSchema = {
  planId: {
    required: true,
    type: "string",
    enum: ["basic", "pro", "enterprise"],
  },
  paymentMethodId: {
    required: true,
    type: "string",
    pattern: /^pm_[a-zA-Z0-9_]+$/,
  },
};

// Profile update schema
export const profileUpdateSchema: ValidationSchema = {
  name: {
    required: false,
    type: "string",
    minLength: 2,
    maxLength: 100,
    custom: (value) => validateAndSanitizeText(value, 100),
  },
  bio: {
    required: false,
    type: "string",
    maxLength: 500,
    custom: (value) => validateAndSanitizeText(value, 500),
  },
  company: {
    required: false,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  website: {
    required: false,
    type: "string",
    custom: (value) => validateURL(value),
  },
  socialMedia: {
    required: false,
    type: "object",
    custom: (value) => {
      const errors: string[] = [];
      const sanitized: any = {};
      
      const allowedPlatforms = ["twitter", "linkedin", "instagram", "facebook", "imdb"];
      
      for (const [platform, url] of Object.entries(value)) {
        if (!allowedPlatforms.includes(platform)) {
          errors.push(`Invalid social media platform: ${platform}`);
          continue;
        }
        
        if (typeof url !== "string") {
          errors.push(`${platform} URL must be a string`);
          continue;
        }
        
        const urlValidation = validateURL(url as string);
        if (!urlValidation.isValid) {
          errors.push(`Invalid ${platform} URL`);
        } else {
          sanitized[platform] = urlValidation.sanitized;
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? sanitized : undefined,
      };
    },
  },
};

// Search/filter schema
export const searchSchema: ValidationSchema = {
  query: {
    required: false,
    type: "string",
    maxLength: 200,
    custom: (value) => validateAndSanitizeText(value, 200),
  },
  genre: {
    required: false,
    type: "string",
    enum: [
      "Action", "Comedy", "Drama", "Horror", "Sci-Fi", 
      "Thriller", "Romance", "Documentary", "Animation", "Other"
    ],
  },
  format: {
    required: false,
    type: "string",
    enum: ["Feature Film", "TV Series", "Web Series", "Short Film", "Documentary", "Other"],
  },
  minBudget: {
    required: false,
    type: "number",
    min: 0,
  },
  maxBudget: {
    required: false,
    type: "number",
    max: 1000000000,
  },
  status: {
    required: false,
    type: "string",
    enum: ["draft", "published", "archived", "optioned"],
  },
  sortBy: {
    required: false,
    type: "string",
    enum: ["createdAt", "updatedAt", "viewCount", "likeCount", "title"],
  },
  sortOrder: {
    required: false,
    type: "string",
    enum: ["asc", "desc"],
  },
  page: {
    required: false,
    type: "number",
    min: 1,
    max: 1000,
  },
  limit: {
    required: false,
    type: "number",
    min: 1,
    max: 100,
  },
};

// Password reset request schema
export const passwordResetRequestSchema: ValidationSchema = {
  email: {
    required: true,
    type: "string",
    custom: (value) => validateEmail(value),
  },
};

// Password reset confirmation schema
export const passwordResetConfirmSchema: ValidationSchema = {
  token: {
    required: true,
    type: "string",
    minLength: 32,
    maxLength: 64,
    pattern: /^[a-zA-Z0-9]+$/,
  },
  newPassword: {
    required: true,
    type: "string",
    custom: (value) => validatePassword(value),
  },
};

// Email verification schema
export const emailVerificationSchema: ValidationSchema = {
  token: {
    required: true,
    type: "string",
    minLength: 32,
    maxLength: 64,
    pattern: /^[a-zA-Z0-9]+$/,
  },
};

// Follow/unfollow schema
export const followSchema: ValidationSchema = {
  targetId: {
    required: true,
    type: "string",
    custom: (value) => validateUUID(value),
  },
  targetType: {
    required: true,
    type: "string",
    enum: ["user", "pitch"],
  },
};

// Analytics event schema
export const analyticsEventSchema: ValidationSchema = {
  event: {
    required: true,
    type: "string",
    enum: ["view", "like", "share", "comment", "click", "download"],
  },
  entityType: {
    required: true,
    type: "string",
    enum: ["pitch", "profile", "document"],
  },
  entityId: {
    required: true,
    type: "string",
  },
  metadata: {
    required: false,
    type: "object",
    custom: (value) => {
      // Limit metadata object size
      const jsonString = JSON.stringify(value);
      if (jsonString.length > 1000) {
        return {
          isValid: false,
          errors: ["Metadata object is too large"],
        };
      }
      
      return {
        isValid: true,
        errors: [],
        sanitized: value,
      };
    },
  },
};

// Comment schema
export const commentSchema: ValidationSchema = {
  pitchId: {
    required: true,
    type: "number",
    min: 1,
  },
  content: {
    required: true,
    type: "string",
    minLength: 1,
    maxLength: 1000,
    custom: (value) => validateAndSanitizeText(value, 1000),
  },
  parentId: {
    required: false,
    type: "number",
    min: 1,
  },
};

// Rating schema
export const ratingSchema: ValidationSchema = {
  pitchId: {
    required: true,
    type: "number",
    min: 1,
  },
  rating: {
    required: true,
    type: "number",
    min: 1,
    max: 5,
  },
  review: {
    required: false,
    type: "string",
    maxLength: 2000,
    custom: (value) => validateAndSanitizeText(value, 2000),
  },
};