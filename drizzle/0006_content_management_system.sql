-- Migration for Content Management System Tables
-- Creates all CMS tables with proper relationships and indexes
-- Compatible with existing Drizzle ORM setup

-- Content Types table - defines the structure for different content types
CREATE TABLE IF NOT EXISTS "content_types" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL UNIQUE,
    "description" text,
    "schema" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Content Items table - stores actual content
CREATE TABLE IF NOT EXISTS "content_items" (
    "id" serial PRIMARY KEY NOT NULL,
    "content_type_id" integer,
    "key" varchar(200) NOT NULL,
    "portal_type" varchar(50),
    "locale" varchar(10) DEFAULT 'en',
    "content" jsonb NOT NULL,
    "metadata" jsonb DEFAULT '{}',
    "status" varchar(20) DEFAULT 'active',
    "version" integer DEFAULT 1,
    "created_by" integer,
    "updated_by" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Feature Flags table - for A/B testing and feature rollouts
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL UNIQUE,
    "description" text,
    "is_enabled" boolean DEFAULT false,
    "portal_type" varchar(50),
    "user_type" varchar(50),
    "rollout_percentage" integer DEFAULT 0,
    "conditions" jsonb DEFAULT '{}',
    "metadata" jsonb DEFAULT '{}',
    "created_by" integer,
    "updated_by" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Portal Configurations table - per-portal settings
CREATE TABLE IF NOT EXISTS "portal_configurations" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_type" varchar(50) NOT NULL,
    "config_key" varchar(100) NOT NULL,
    "config_value" jsonb NOT NULL,
    "is_secret" boolean DEFAULT false,
    "description" text,
    "validation_schema" jsonb,
    "category" varchar(50),
    "updated_by" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Translation Keys table - for internationalization
CREATE TABLE IF NOT EXISTS "translation_keys" (
    "id" serial PRIMARY KEY NOT NULL,
    "key_path" varchar(200) NOT NULL UNIQUE,
    "default_value" text NOT NULL,
    "description" text,
    "context" varchar(100),
    "category" varchar(50),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Translations table - actual translations for different locales
CREATE TABLE IF NOT EXISTS "translations" (
    "id" serial PRIMARY KEY NOT NULL,
    "translation_key_id" integer,
    "locale" varchar(10) NOT NULL,
    "value" text NOT NULL,
    "is_approved" boolean DEFAULT false,
    "translated_by" integer,
    "approved_by" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Navigation Menus table - dynamic navigation management
CREATE TABLE IF NOT EXISTS "navigation_menus" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_type" varchar(50) NOT NULL,
    "menu_type" varchar(50) NOT NULL,
    "items" jsonb NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "updated_by" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Content Approvals table - workflow for content approval
CREATE TABLE IF NOT EXISTS "content_approvals" (
    "id" serial PRIMARY KEY NOT NULL,
    "content_item_id" integer,
    "requested_by" integer,
    "reviewed_by" integer,
    "status" varchar(20) DEFAULT 'pending',
    "comments" text,
    "requested_at" timestamp DEFAULT now() NOT NULL,
    "reviewed_at" timestamp
);

-- Add foreign key constraints
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_content_type_id_fkey" 
    FOREIGN KEY ("content_type_id") REFERENCES "content_types"("id") ON DELETE CASCADE;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_fkey" 
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_updated_by_fkey" 
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_created_by_fkey" 
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" 
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "portal_configurations" ADD CONSTRAINT "portal_configurations_updated_by_fkey" 
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "translations" ADD CONSTRAINT "translations_translation_key_id_fkey" 
    FOREIGN KEY ("translation_key_id") REFERENCES "translation_keys"("id") ON DELETE CASCADE;
ALTER TABLE "translations" ADD CONSTRAINT "translations_translated_by_fkey" 
    FOREIGN KEY ("translated_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "translations" ADD CONSTRAINT "translations_approved_by_fkey" 
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "navigation_menus" ADD CONSTRAINT "navigation_menus_updated_by_fkey" 
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "content_approvals" ADD CONSTRAINT "content_approvals_content_item_id_fkey" 
    FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE;
ALTER TABLE "content_approvals" ADD CONSTRAINT "content_approvals_requested_by_fkey" 
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "content_approvals" ADD CONSTRAINT "content_approvals_reviewed_by_fkey" 
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- Add unique constraints as defined in schema
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_key_portal_locale" 
    UNIQUE ("key", "portal_type", "locale");

ALTER TABLE "portal_configurations" ADD CONSTRAINT "portal_configurations_portal_key" 
    UNIQUE ("portal_type", "config_key");

ALTER TABLE "translations" ADD CONSTRAINT "translations_key_locale" 
    UNIQUE ("translation_key_id", "locale");

ALTER TABLE "navigation_menus" ADD CONSTRAINT "navigation_menus_portal_type" 
    UNIQUE ("portal_type", "menu_type");

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_content_items_portal_type" ON "content_items"("portal_type");
CREATE INDEX IF NOT EXISTS "idx_content_items_key" ON "content_items"("key");
CREATE INDEX IF NOT EXISTS "idx_content_items_status" ON "content_items"("status");
CREATE INDEX IF NOT EXISTS "idx_content_items_locale" ON "content_items"("locale");

CREATE INDEX IF NOT EXISTS "idx_feature_flags_portal_type" ON "feature_flags"("portal_type");
CREATE INDEX IF NOT EXISTS "idx_feature_flags_is_enabled" ON "feature_flags"("is_enabled");
CREATE INDEX IF NOT EXISTS "idx_feature_flags_user_type" ON "feature_flags"("user_type");

CREATE INDEX IF NOT EXISTS "idx_portal_configurations_portal_type" ON "portal_configurations"("portal_type");
CREATE INDEX IF NOT EXISTS "idx_portal_configurations_category" ON "portal_configurations"("category");

CREATE INDEX IF NOT EXISTS "idx_translation_keys_category" ON "translation_keys"("category");
CREATE INDEX IF NOT EXISTS "idx_translation_keys_context" ON "translation_keys"("context");

CREATE INDEX IF NOT EXISTS "idx_translations_locale" ON "translations"("locale");
CREATE INDEX IF NOT EXISTS "idx_translations_is_approved" ON "translations"("is_approved");

CREATE INDEX IF NOT EXISTS "idx_navigation_menus_portal_type" ON "navigation_menus"("portal_type");
CREATE INDEX IF NOT EXISTS "idx_navigation_menus_is_active" ON "navigation_menus"("is_active");

CREATE INDEX IF NOT EXISTS "idx_content_approvals_status" ON "content_approvals"("status");
CREATE INDEX IF NOT EXISTS "idx_content_approvals_requested_at" ON "content_approvals"("requested_at");

-- Insert initial seed data

-- 1. Content Types
INSERT INTO "content_types" ("name", "description", "schema") VALUES
('portal_description', 'Portal description and welcome content', '{"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "welcomeMessage": {"type": "string"}}}'),
('navigation_item', 'Navigation menu item structure', '{"type": "object", "properties": {"label": {"type": "string"}, "url": {"type": "string"}, "icon": {"type": "string"}, "children": {"type": "array"}}}'),
('feature_configuration', 'Feature configuration settings', '{"type": "object", "properties": {"enabled": {"type": "boolean"}, "settings": {"type": "object"}}}'),
('branding_config', 'Branding and styling configuration', '{"type": "object", "properties": {"logo": {"type": "string"}, "colors": {"type": "object"}, "fonts": {"type": "object"}}}');

-- 2. Feature Flags
INSERT INTO "feature_flags" ("name", "description", "is_enabled", "portal_type", "rollout_percentage") VALUES
('real_time_notifications', 'Enable real-time WebSocket notifications', true, null, 100),
('draft_auto_sync', 'Enable automatic draft synchronization', true, 'creator', 100),
('advanced_analytics', 'Enable advanced analytics dashboard', true, 'creator', 100),
('investor_portfolio', 'Enable investor portfolio tracking', true, 'investor', 100),
('production_tools', 'Enable production company tools', true, 'production', 100),
('messaging_system', 'Enable internal messaging system', true, null, 100),
('nda_workflow', 'Enable NDA request workflow', true, null, 100),
('search_suggestions', 'Enable search suggestions and autocomplete', true, null, 80),
('mobile_app_integration', 'Enable mobile app integration features', false, null, 0),
('ai_content_suggestions', 'Enable AI-powered content suggestions', false, 'creator', 10);

-- 3. Portal Configurations
INSERT INTO "portal_configurations" ("portal_type", "config_key", "config_value", "category", "description") VALUES
-- Creator Portal
('creator', 'branding.theme_color', '"#4F46E5"', 'branding', 'Primary theme color for creator portal'),
('creator', 'features.draft_sync_interval', '5000', 'features', 'Draft auto-sync interval in milliseconds'),
('creator', 'features.max_pitch_uploads', '10', 'features', 'Maximum number of pitches per creator'),
('creator', 'dashboard.widgets', '["recent_pitches", "analytics", "notifications"]', 'dashboard', 'Default dashboard widgets'),

-- Investor Portal  
('investor', 'branding.theme_color', '"#059669"', 'branding', 'Primary theme color for investor portal'),
('investor', 'features.portfolio_tracking', 'true', 'features', 'Enable portfolio tracking features'),
('investor', 'features.deal_flow_alerts', 'true', 'features', 'Enable deal flow alert notifications'),
('investor', 'dashboard.widgets', '["watchlist", "portfolio", "trending_pitches"]', 'dashboard', 'Default dashboard widgets'),

-- Production Portal
('production', 'branding.theme_color', '"#DC2626"', 'branding', 'Primary theme color for production portal'),
('production', 'features.project_management', 'true', 'features', 'Enable project management tools'),
('production', 'features.talent_discovery', 'true', 'features', 'Enable talent discovery features'),
('production', 'dashboard.widgets', '["active_projects", "talent_pool", "industry_news"]', 'dashboard', 'Default dashboard widgets'),

-- Global configurations
('global', 'system.maintenance_mode', 'false', 'system', 'Global maintenance mode toggle'),
('global', 'system.registration_enabled', 'true', 'system', 'Enable new user registration'),
('global', 'notifications.websocket_enabled', 'true', 'notifications', 'Enable WebSocket notifications');

-- 4. Translation Keys
INSERT INTO "translation_keys" ("key_path", "default_value", "description", "context", "category") VALUES
-- Authentication
('auth.login.title', 'Sign In', 'Login page title', 'authentication', 'ui'),
('auth.login.email_placeholder', 'Enter your email', 'Email input placeholder', 'authentication', 'ui'),
('auth.login.password_placeholder', 'Enter your password', 'Password input placeholder', 'authentication', 'ui'),
('auth.login.submit_button', 'Sign In', 'Login submit button text', 'authentication', 'ui'),
('auth.register.title', 'Create Account', 'Registration page title', 'authentication', 'ui'),

-- Navigation
('nav.dashboard', 'Dashboard', 'Dashboard navigation item', 'navigation', 'ui'),
('nav.pitches', 'Pitches', 'Pitches navigation item', 'navigation', 'ui'),
('nav.messages', 'Messages', 'Messages navigation item', 'navigation', 'ui'),
('nav.profile', 'Profile', 'Profile navigation item', 'navigation', 'ui'),
('nav.settings', 'Settings', 'Settings navigation item', 'navigation', 'ui'),

-- Pitch Management
('pitch.create.title', 'Create New Pitch', 'Create pitch page title', 'pitch_management', 'ui'),
('pitch.edit.title', 'Edit Pitch', 'Edit pitch page title', 'pitch_management', 'ui'),
('pitch.status.draft', 'Draft', 'Draft status label', 'pitch_management', 'ui'),
('pitch.status.published', 'Published', 'Published status label', 'pitch_management', 'ui'),

-- Notifications
('notification.nda_request', 'New NDA request received', 'NDA request notification', 'notifications', 'ui'),
('notification.message_received', 'You have a new message', 'Message notification', 'notifications', 'ui'),
('notification.pitch_viewed', 'Your pitch was viewed', 'Pitch view notification', 'notifications', 'ui'),

-- Errors
('error.network', 'Network connection error', 'Generic network error message', 'errors', 'error'),
('error.unauthorized', 'You are not authorized to perform this action', 'Authorization error', 'errors', 'error'),
('error.server', 'Server error occurred', 'Generic server error', 'errors', 'error');

-- 5. Translations (English only for now)
INSERT INTO "translations" ("translation_key_id", "locale", "value", "is_approved") 
SELECT "id", 'en', "default_value", true FROM "translation_keys";

-- 6. Navigation Menus
INSERT INTO "navigation_menus" ("portal_type", "menu_type", "items", "is_active", "sort_order") VALUES
-- Creator Portal Navigation
('creator', 'header', '[
    {"label": "Dashboard", "url": "/dashboard", "icon": "dashboard"},
    {"label": "My Pitches", "url": "/pitches", "icon": "movie"},
    {"label": "Analytics", "url": "/analytics", "icon": "chart"},
    {"label": "Messages", "url": "/messages", "icon": "message", "badge": "unread"},
    {"label": "Profile", "url": "/profile", "icon": "user"}
]', true, 1),

-- Investor Portal Navigation  
('investor', 'header', '[
    {"label": "Dashboard", "url": "/dashboard", "icon": "dashboard"},
    {"label": "Discover", "url": "/discover", "icon": "search"},
    {"label": "Watchlist", "url": "/watchlist", "icon": "bookmark"},
    {"label": "Portfolio", "url": "/portfolio", "icon": "briefcase"},
    {"label": "Messages", "url": "/messages", "icon": "message", "badge": "unread"},
    {"label": "Profile", "url": "/profile", "icon": "user"}
]', true, 1),

-- Production Portal Navigation
('production', 'header', '[
    {"label": "Dashboard", "url": "/dashboard", "icon": "dashboard"},
    {"label": "Projects", "url": "/projects", "icon": "folder"},
    {"label": "Talent", "url": "/talent", "icon": "users"},
    {"label": "Discover", "url": "/discover", "icon": "search"},
    {"label": "Messages", "url": "/messages", "icon": "message", "badge": "unread"},
    {"label": "Profile", "url": "/profile", "icon": "user"}
]', true, 1),

-- Creator Sidebar Navigation
('creator', 'sidebar', '[
    {"label": "Overview", "url": "/dashboard", "icon": "home"},
    {"label": "Create Pitch", "url": "/pitches/create", "icon": "plus"},
    {"label": "Draft Pitches", "url": "/pitches/drafts", "icon": "edit"},
    {"label": "Published", "url": "/pitches/published", "icon": "check"},
    {"label": "Analytics", "url": "/analytics", "icon": "chart"},
    {"label": "Settings", "url": "/settings", "icon": "settings"}
]', true, 2),

-- Investor Sidebar Navigation
('investor', 'sidebar', '[
    {"label": "Overview", "url": "/dashboard", "icon": "home"},
    {"label": "Browse Pitches", "url": "/discover", "icon": "search"},
    {"label": "Saved Pitches", "url": "/watchlist", "icon": "bookmark"},
    {"label": "My Investments", "url": "/portfolio", "icon": "trending-up"},
    {"label": "Deal Flow", "url": "/deal-flow", "icon": "flow"},
    {"label": "Settings", "url": "/settings", "icon": "settings"}
]', true, 2);

-- 7. Content Items
INSERT INTO "content_items" ("content_type_id", "key", "portal_type", "locale", "content", "status") VALUES
-- Portal Descriptions
((SELECT id FROM content_types WHERE name = 'portal_description'), 'portal.creator.welcome', 'creator', 'en', 
'{"title": "Welcome to Creator Portal", "description": "Transform your creative vision into compelling pitches that connect with investors and production companies.", "welcomeMessage": "Start creating your next breakthrough project today."}', 'active'),

((SELECT id FROM content_types WHERE name = 'portal_description'), 'portal.investor.welcome', 'investor', 'en',
'{"title": "Welcome to Investor Portal", "description": "Discover exceptional entertainment projects and connect with talented creators worldwide.", "welcomeMessage": "Find your next investment opportunity in the entertainment industry."}', 'active'),

((SELECT id FROM content_types WHERE name = 'portal_description'), 'portal.production.welcome', 'production', 'en',
'{"title": "Welcome to Production Portal", "description": "Source premium content, manage productions, and discover new talent for your next project.", "welcomeMessage": "Streamline your production workflow and find the perfect projects."}', 'active'),

-- Feature Configurations
((SELECT id FROM content_types WHERE name = 'feature_configuration'), 'features.realtime_notifications', 'global', 'en',
'{"enabled": true, "settings": {"reconnectInterval": 5000, "maxReconnectAttempts": 5, "showToasts": true}}', 'active'),

((SELECT id FROM content_types WHERE name = 'feature_configuration'), 'features.draft_autosave', 'creator', 'en',
'{"enabled": true, "settings": {"interval": 5000, "showIndicator": true, "conflictResolution": "prompt"}}', 'active');

-- Add table comments for documentation
COMMENT ON TABLE "content_types" IS 'Defines content type schemas for CMS';
COMMENT ON TABLE "content_items" IS 'Stores actual content with versioning support';
COMMENT ON TABLE "feature_flags" IS 'Feature flag system for A/B testing and rollouts';
COMMENT ON TABLE "portal_configurations" IS 'Portal-specific configuration settings';
COMMENT ON TABLE "translation_keys" IS 'Internationalization key definitions';
COMMENT ON TABLE "translations" IS 'Translated content for different locales';
COMMENT ON TABLE "navigation_menus" IS 'Dynamic navigation menu management';
COMMENT ON TABLE "content_approvals" IS 'Content approval workflow tracking';

COMMENT ON MIGRATION IS 'Content Management System tables with initial seed data for portal management, feature flags, and internationalization';