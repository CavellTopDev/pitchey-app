--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.watchlist DROP CONSTRAINT IF EXISTS watchlist_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_credits DROP CONSTRAINT IF EXISTS user_credits_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.typing_indicators DROP CONSTRAINT IF EXISTS typing_indicators_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.security_events DROP CONSTRAINT IF EXISTS security_events_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.portfolio DROP CONSTRAINT IF EXISTS portfolio_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.portfolio DROP CONSTRAINT IF EXISTS portfolio_investor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitches DROP CONSTRAINT IF EXISTS pitches_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_views DROP CONSTRAINT IF EXISTS pitch_views_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_views DROP CONSTRAINT IF EXISTS pitch_views_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_saves DROP CONSTRAINT IF EXISTS pitch_saves_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_saves DROP CONSTRAINT IF EXISTS pitch_saves_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_likes DROP CONSTRAINT IF EXISTS pitch_likes_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pitch_likes DROP CONSTRAINT IF EXISTS pitch_likes_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_related_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_related_nda_request_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ndas DROP CONSTRAINT IF EXISTS ndas_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ndas DROP CONSTRAINT IF EXISTS ndas_signer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ndas DROP CONSTRAINT IF EXISTS ndas_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.nda_requests DROP CONSTRAINT IF EXISTS nda_requests_requester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.nda_requests DROP CONSTRAINT IF EXISTS nda_requests_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.nda_requests DROP CONSTRAINT IF EXISTS nda_requests_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.message_read_receipts DROP CONSTRAINT IF EXISTS message_read_receipts_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.message_read_receipts DROP CONSTRAINT IF EXISTS message_read_receipts_message_id_fkey;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_creator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_user;
ALTER TABLE IF EXISTS ONLY public.pitch_views DROP CONSTRAINT IF EXISTS fk_pitch_views_pitch;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS fk_participants_user;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS fk_participants_conversation;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS fk_notifications_user;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS fk_messages_sender;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS fk_messages_pitch;
ALTER TABLE IF EXISTS ONLY public.conversations DROP CONSTRAINT IF EXISTS fk_conversations_pitch_id;
ALTER TABLE IF EXISTS ONLY public.conversations DROP CONSTRAINT IF EXISTS fk_conversations_created_by;
ALTER TABLE IF EXISTS ONLY public.email_queue DROP CONSTRAINT IF EXISTS email_queue_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.email_preferences DROP CONSTRAINT IF EXISTS email_preferences_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_payment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.conversations DROP CONSTRAINT IF EXISTS conversations_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.conversations DROP CONSTRAINT IF EXISTS conversations_created_by_id_fkey;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics DROP CONSTRAINT IF EXISTS analytics_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics DROP CONSTRAINT IF EXISTS analytics_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_pitch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_message_id_fkey;
ALTER TABLE IF EXISTS ONLY public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_conversation_id_fkey;
DROP TRIGGER IF EXISTS update_watchlist_updated_at ON public.watchlist;
DROP TRIGGER IF EXISTS update_portfolio_updated_at ON public.portfolio;
DROP INDEX IF EXISTS public.users_username_idx;
DROP INDEX IF EXISTS public.users_user_type_idx;
DROP INDEX IF EXISTS public.users_email_idx;
DROP INDEX IF EXISTS public.transactions_user_id_idx;
DROP INDEX IF EXISTS public.transactions_status_idx;
DROP INDEX IF EXISTS public.sessions_user_idx;
DROP INDEX IF EXISTS public.sessions_token_idx;
DROP INDEX IF EXISTS public.security_events_event_type_idx;
DROP INDEX IF EXISTS public.security_events_created_at_idx;
DROP INDEX IF EXISTS public.pitches_user_idx;
DROP INDEX IF EXISTS public.pitches_user_id_idx;
DROP INDEX IF EXISTS public.pitches_title_search_idx;
DROP INDEX IF EXISTS public.pitches_status_idx;
DROP INDEX IF EXISTS public.pitches_genre_idx;
DROP INDEX IF EXISTS public.pitches_format_idx;
DROP INDEX IF EXISTS public.pitch_views_pitch_id_idx;
DROP INDEX IF EXISTS public.notifications_user_idx;
DROP INDEX IF EXISTS public.notifications_is_read_idx;
DROP INDEX IF EXISTS public.notifications_created_at_idx;
DROP INDEX IF EXISTS public.ndas_signer_id_idx;
DROP INDEX IF EXISTS public.ndas_pitch_id_idx;
DROP INDEX IF EXISTS public.nda_requests_status_idx;
DROP INDEX IF EXISTS public.nda_requests_requester_id_idx;
DROP INDEX IF EXISTS public.nda_requests_pitch_requester_idx;
DROP INDEX IF EXISTS public.nda_requests_pitch_id_idx;
DROP INDEX IF EXISTS public.nda_requests_owner_idx;
DROP INDEX IF EXISTS public.nda_requests_owner_id_idx;
DROP INDEX IF EXISTS public.messages_sender_id_idx;
DROP INDEX IF EXISTS public.messages_receiver_id_idx;
DROP INDEX IF EXISTS public.messages_pitch_id_idx;
DROP INDEX IF EXISTS public.idx_watchlist_user_id;
DROP INDEX IF EXISTS public.idx_watchlist_pitch_id;
DROP INDEX IF EXISTS public.idx_users_username;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_user_credits_user_id;
DROP INDEX IF EXISTS public.idx_sessions_token;
DROP INDEX IF EXISTS public.idx_security_events_user_id;
DROP INDEX IF EXISTS public.idx_security_events_user;
DROP INDEX IF EXISTS public.idx_security_events_type;
DROP INDEX IF EXISTS public.idx_security_events_ip;
DROP INDEX IF EXISTS public.idx_security_events_event_type;
DROP INDEX IF EXISTS public.idx_security_events_created_at;
DROP INDEX IF EXISTS public.idx_security_events_created;
DROP INDEX IF EXISTS public.idx_portfolio_status;
DROP INDEX IF EXISTS public.idx_portfolio_pitch_id;
DROP INDEX IF EXISTS public.idx_portfolio_investor_id;
DROP INDEX IF EXISTS public.idx_pitches_user_id;
DROP INDEX IF EXISTS public.idx_pitches_status;
DROP INDEX IF EXISTS public.idx_pitches_require_nda;
DROP INDEX IF EXISTS public.idx_pitches_published_at;
DROP INDEX IF EXISTS public.idx_pitches_nda_count;
DROP INDEX IF EXISTS public.idx_payments_user_id;
DROP INDEX IF EXISTS public.idx_payments_type;
DROP INDEX IF EXISTS public.idx_payments_status;
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_notifications_is_read;
DROP INDEX IF EXISTS public.idx_notifications_created_at;
DROP INDEX IF EXISTS public.idx_ndas_pitch_user;
DROP INDEX IF EXISTS public.idx_nda_requests_status;
DROP INDEX IF EXISTS public.idx_nda_requests_requester_id;
DROP INDEX IF EXISTS public.idx_nda_requests_pitch_id;
DROP INDEX IF EXISTS public.idx_nda_requests_owner_id;
DROP INDEX IF EXISTS public.idx_messages_recipient;
DROP INDEX IF EXISTS public.idx_maintenance_log_task_date;
DROP INDEX IF EXISTS public.idx_maintenance_log_status;
DROP INDEX IF EXISTS public.idx_email_queue_user_id;
DROP INDEX IF EXISTS public.idx_email_queue_status;
DROP INDEX IF EXISTS public.idx_email_queue_scheduled_for;
DROP INDEX IF EXISTS public.idx_email_preferences_user_id;
DROP INDEX IF EXISTS public.idx_database_alerts_type;
DROP INDEX IF EXISTS public.idx_database_alerts_active;
DROP INDEX IF EXISTS public.idx_credit_transactions_user_id;
DROP INDEX IF EXISTS public.idx_credit_transactions_type;
DROP INDEX IF EXISTS public.idx_credit_transactions_created_at;
DROP INDEX IF EXISTS public.idx_conversations_pitch_id;
DROP INDEX IF EXISTS public.idx_conversations_created_by_id;
DROP INDEX IF EXISTS public.idx_analytics_user_id;
DROP INDEX IF EXISTS public.idx_analytics_timestamp;
DROP INDEX IF EXISTS public.idx_analytics_pitch_id;
DROP INDEX IF EXISTS public.idx_analytics_events_user_id;
DROP INDEX IF EXISTS public.idx_analytics_events_timestamp;
DROP INDEX IF EXISTS public.idx_analytics_events_session_id;
DROP INDEX IF EXISTS public.idx_analytics_events_pitch_id;
DROP INDEX IF EXISTS public.idx_analytics_events_event_type;
DROP INDEX IF EXISTS public.idx_analytics_events_event_id;
DROP INDEX IF EXISTS public.idx_analytics_event_type;
DROP INDEX IF EXISTS public.follows_pitch_id_idx;
DROP INDEX IF EXISTS public.follows_follower_id_idx;
DROP INDEX IF EXISTS public.follows_followed_at_idx;
DROP INDEX IF EXISTS public.follows_creator_id_idx;
ALTER TABLE IF EXISTS ONLY public.watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_pitch_id_key;
ALTER TABLE IF EXISTS ONLY public.watchlist DROP CONSTRAINT IF EXISTS watchlist_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_credits DROP CONSTRAINT IF EXISTS user_credits_user_id_key;
ALTER TABLE IF EXISTS ONLY public.user_credits DROP CONSTRAINT IF EXISTS user_credits_pkey;
ALTER TABLE IF EXISTS ONLY public.typing_indicators DROP CONSTRAINT IF EXISTS typing_indicators_pkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_token_key;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_refresh_token_key;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.security_events DROP CONSTRAINT IF EXISTS security_events_pkey;
ALTER TABLE IF EXISTS ONLY public.portfolio DROP CONSTRAINT IF EXISTS portfolio_pkey;
ALTER TABLE IF EXISTS ONLY public.pitches DROP CONSTRAINT IF EXISTS pitches_pkey;
ALTER TABLE IF EXISTS ONLY public.pitch_views DROP CONSTRAINT IF EXISTS pitch_views_pkey;
ALTER TABLE IF EXISTS ONLY public.pitch_saves DROP CONSTRAINT IF EXISTS pitch_saves_pkey;
ALTER TABLE IF EXISTS ONLY public.pitch_saves DROP CONSTRAINT IF EXISTS pitch_saves_pitch_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.pitch_likes DROP CONSTRAINT IF EXISTS pitch_likes_pkey;
ALTER TABLE IF EXISTS ONLY public.pitch_likes DROP CONSTRAINT IF EXISTS pitch_likes_pitch_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.ndas DROP CONSTRAINT IF EXISTS ndas_pkey;
ALTER TABLE IF EXISTS ONLY public.ndas DROP CONSTRAINT IF EXISTS ndas_pitch_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.nda_requests DROP CONSTRAINT IF EXISTS nda_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.messages DROP CONSTRAINT IF EXISTS messages_pkey;
ALTER TABLE IF EXISTS ONLY public.message_read_receipts DROP CONSTRAINT IF EXISTS message_read_receipts_pkey;
ALTER TABLE IF EXISTS ONLY public.message_read_receipts DROP CONSTRAINT IF EXISTS message_read_receipts_message_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.maintenance_log DROP CONSTRAINT IF EXISTS maintenance_log_pkey;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_pkey;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_follower_pitch_unique;
ALTER TABLE IF EXISTS ONLY public.follows DROP CONSTRAINT IF EXISTS follows_follower_creator_unique;
ALTER TABLE IF EXISTS ONLY public.email_queue DROP CONSTRAINT IF EXISTS email_queue_pkey;
ALTER TABLE IF EXISTS ONLY public.email_preferences DROP CONSTRAINT IF EXISTS email_preferences_user_id_key;
ALTER TABLE IF EXISTS ONLY public.email_preferences DROP CONSTRAINT IF EXISTS email_preferences_pkey;
ALTER TABLE IF EXISTS ONLY public.database_alerts DROP CONSTRAINT IF EXISTS database_alerts_pkey;
ALTER TABLE IF EXISTS ONLY public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.conversations DROP CONSTRAINT IF EXISTS conversations_pkey;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_pkey;
ALTER TABLE IF EXISTS ONLY public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_user_id_key;
ALTER TABLE IF EXISTS ONLY public.analytics DROP CONSTRAINT IF EXISTS analytics_pkey;
ALTER TABLE IF EXISTS ONLY public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_pkey;
ALTER TABLE IF EXISTS ONLY drizzle.__drizzle_migrations DROP CONSTRAINT IF EXISTS __drizzle_migrations_pkey;
ALTER TABLE IF EXISTS public.watchlist ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.user_credits ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.typing_indicators ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.security_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.portfolio ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pitches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pitch_views ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pitch_saves ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pitch_likes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.payments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ndas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.nda_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.messages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.message_read_receipts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.maintenance_log ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.follows ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.email_queue ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.email_preferences ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.database_alerts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.credit_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.conversations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.conversation_participants ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.analytics_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.analytics ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS drizzle.__drizzle_migrations ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.watchlist_id_seq;
DROP TABLE IF EXISTS public.watchlist;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.user_credits_id_seq;
DROP TABLE IF EXISTS public.user_credits;
DROP SEQUENCE IF EXISTS public.typing_indicators_id_seq;
DROP TABLE IF EXISTS public.typing_indicators;
DROP SEQUENCE IF EXISTS public.transactions_id_seq;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.sessions;
DROP SEQUENCE IF EXISTS public.security_events_id_seq;
DROP TABLE IF EXISTS public.security_events;
DROP SEQUENCE IF EXISTS public.portfolio_id_seq;
DROP TABLE IF EXISTS public.portfolio;
DROP SEQUENCE IF EXISTS public.pitches_id_seq;
DROP TABLE IF EXISTS public.pitches;
DROP SEQUENCE IF EXISTS public.pitch_views_id_seq;
DROP TABLE IF EXISTS public.pitch_views;
DROP SEQUENCE IF EXISTS public.pitch_saves_id_seq;
DROP TABLE IF EXISTS public.pitch_saves;
DROP SEQUENCE IF EXISTS public.pitch_likes_id_seq;
DROP TABLE IF EXISTS public.pitch_likes;
DROP SEQUENCE IF EXISTS public.payments_id_seq;
DROP TABLE IF EXISTS public.payments;
DROP SEQUENCE IF EXISTS public.notifications_id_seq;
DROP TABLE IF EXISTS public.notifications;
DROP SEQUENCE IF EXISTS public.ndas_id_seq;
DROP TABLE IF EXISTS public.ndas;
DROP SEQUENCE IF EXISTS public.nda_requests_id_seq;
DROP TABLE IF EXISTS public.nda_requests;
DROP SEQUENCE IF EXISTS public.messages_id_seq;
DROP TABLE IF EXISTS public.messages;
DROP SEQUENCE IF EXISTS public.message_read_receipts_id_seq;
DROP TABLE IF EXISTS public.message_read_receipts;
DROP SEQUENCE IF EXISTS public.maintenance_log_id_seq;
DROP TABLE IF EXISTS public.maintenance_log;
DROP SEQUENCE IF EXISTS public.follows_id_seq;
DROP TABLE IF EXISTS public.follows;
DROP SEQUENCE IF EXISTS public.email_queue_id_seq;
DROP TABLE IF EXISTS public.email_queue;
DROP SEQUENCE IF EXISTS public.email_preferences_id_seq;
DROP TABLE IF EXISTS public.email_preferences;
DROP SEQUENCE IF EXISTS public.database_alerts_id_seq;
DROP TABLE IF EXISTS public.database_alerts;
DROP SEQUENCE IF EXISTS public.credit_transactions_id_seq;
DROP TABLE IF EXISTS public.credit_transactions;
DROP SEQUENCE IF EXISTS public.conversations_id_seq;
DROP TABLE IF EXISTS public.conversations;
DROP SEQUENCE IF EXISTS public.conversation_participants_id_seq;
DROP TABLE IF EXISTS public.conversation_participants;
DROP SEQUENCE IF EXISTS public.analytics_id_seq;
DROP SEQUENCE IF EXISTS public.analytics_events_id_seq;
DROP TABLE IF EXISTS public.analytics_events;
DROP TABLE IF EXISTS public.analytics;
DROP SEQUENCE IF EXISTS drizzle.__drizzle_migrations_id_seq;
DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
DROP FUNCTION IF EXISTS public.vacuum_critical_tables();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.update_table_statistics();
DROP FUNCTION IF EXISTS public.run_monitoring_checks();
DROP FUNCTION IF EXISTS public.run_daily_maintenance();
DROP FUNCTION IF EXISTS public.resolve_alert(p_alert_id integer);
DROP FUNCTION IF EXISTS public.reset_failed_login_attempts();
DROP FUNCTION IF EXISTS public.log_maintenance_task(p_task_name character varying, p_status character varying, p_details jsonb, p_rows_affected integer, p_execution_time_ms integer);
DROP FUNCTION IF EXISTS public.create_alert(p_alert_type character varying, p_severity character varying, p_message text, p_threshold_value numeric, p_current_value numeric, p_metadata jsonb);
DROP FUNCTION IF EXISTS public.cleanup_old_security_events();
DROP FUNCTION IF EXISTS public.cleanup_old_analytics_events();
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP FUNCTION IF EXISTS public.check_rate_limit_violations();
DROP FUNCTION IF EXISTS public.check_long_running_queries();
DROP FUNCTION IF EXISTS public.check_database_size();
DROP FUNCTION IF EXISTS public.check_connection_count();
DROP TYPE IF EXISTS public.user_type;
DROP TYPE IF EXISTS public.transaction_type;
DROP TYPE IF EXISTS public.transaction_status;
DROP TYPE IF EXISTS public.subscription_tier_new;
DROP TYPE IF EXISTS public.subscription_tier;
DROP TYPE IF EXISTS public.pitch_status;
DROP TYPE IF EXISTS public.notification_type;
DROP TYPE IF EXISTS public.notification_frequency;
DROP TYPE IF EXISTS public.nda_type;
DROP TYPE IF EXISTS public.nda_request_status;
DROP TYPE IF EXISTS public.media_type;
DROP TYPE IF EXISTS public.invoice_status;
DROP TYPE IF EXISTS public.genre;
DROP TYPE IF EXISTS public.funnel_stage;
DROP TYPE IF EXISTS public.format;
DROP TYPE IF EXISTS public.event_type;
DROP TYPE IF EXISTS public.email_status;
DROP TYPE IF EXISTS public.credit_transaction_type;
DROP TYPE IF EXISTS public.aggregation_period;
DROP SCHEMA IF EXISTS drizzle;
--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: aggregation_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aggregation_period AS ENUM (
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'yearly'
);


--
-- Name: credit_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credit_transaction_type AS ENUM (
    'purchase',
    'usage',
    'refund',
    'bonus'
);


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'bounced',
    'failed',
    'unsubscribed'
);


--
-- Name: event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_type AS ENUM (
    'page_view',
    'pitch_view',
    'pitch_like',
    'pitch_save',
    'nda_request',
    'nda_signed',
    'message_sent',
    'message_read',
    'profile_update',
    'search',
    'filter_applied',
    'session_start',
    'session_end'
);


--
-- Name: format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.format AS ENUM (
    'feature',
    'tv',
    'short',
    'webseries',
    'other'
);


--
-- Name: funnel_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.funnel_stage AS ENUM (
    'view',
    'engagement',
    'nda_request',
    'nda_signed',
    'contact',
    'deal'
);


--
-- Name: genre; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.genre AS ENUM (
    'drama',
    'comedy',
    'thriller',
    'horror',
    'scifi',
    'fantasy',
    'documentary',
    'animation',
    'action',
    'romance',
    'other'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'void'
);


--
-- Name: media_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_type AS ENUM (
    'lookbook',
    'script',
    'trailer',
    'pitch_deck',
    'budget_breakdown',
    'production_timeline',
    'other'
);


--
-- Name: nda_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nda_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired'
);


--
-- Name: nda_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nda_type AS ENUM (
    'basic',
    'enhanced',
    'custom'
);


--
-- Name: notification_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_frequency AS ENUM (
    'instant',
    'daily',
    'weekly',
    'never'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'nda_request',
    'nda_approved',
    'nda_rejected',
    'nda_revoked',
    'pitch_view',
    'pitch_like',
    'message_received',
    'follow',
    'comment'
);


--
-- Name: pitch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pitch_status AS ENUM (
    'draft',
    'published',
    'hidden',
    'archived'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'creator',
    'pro',
    'investor'
);


--
-- Name: subscription_tier_new; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier_new AS ENUM (
    'BASIC',
    'PRO',
    'ENTERPRISE'
);


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'subscription',
    'credits',
    'success_fee',
    'refund'
);


--
-- Name: user_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_type AS ENUM (
    'creator',
    'production',
    'investor',
    'viewer'
);


--
-- Name: check_connection_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_connection_count() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_connections INTEGER;
    max_connections INTEGER;
    usage_percentage NUMERIC;
BEGIN
    SELECT COUNT(*) INTO current_connections
    FROM pg_stat_activity 
    WHERE datname = current_database();
    
    SELECT setting::INTEGER INTO max_connections
    FROM pg_settings 
    WHERE name = 'max_connections';
    
    usage_percentage := (current_connections::NUMERIC / max_connections::NUMERIC) * 100;
    
    -- Critical alert at 90%
    IF usage_percentage >= 90 THEN
        PERFORM create_alert(
            'connection_exhaustion',
            'critical',
            format('Database connection usage at %s%% (%s/%s)', 
                   ROUND(usage_percentage, 1), current_connections, max_connections),
            90,
            usage_percentage,
            jsonb_build_object('current_connections', current_connections, 'max_connections', max_connections)
        );
    -- Warning alert at 80%
    ELSIF usage_percentage >= 80 THEN
        PERFORM create_alert(
            'connection_warning',
            'warning',
            format('Database connection usage at %s%% (%s/%s)', 
                   ROUND(usage_percentage, 1), current_connections, max_connections),
            80,
            usage_percentage,
            jsonb_build_object('current_connections', current_connections, 'max_connections', max_connections)
        );
    END IF;
END;
$$;


--
-- Name: check_database_size(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_database_size() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    db_size_bytes BIGINT;
    db_size_gb NUMERIC;
    warning_threshold NUMERIC := 10; -- 10GB warning
    critical_threshold NUMERIC := 50; -- 50GB critical
BEGIN
    SELECT pg_database_size(current_database()) INTO db_size_bytes;
    db_size_gb := db_size_bytes / (1024.0 * 1024.0 * 1024.0);
    
    -- Critical alert
    IF db_size_gb >= critical_threshold THEN
        PERFORM create_alert(
            'database_size_critical',
            'critical',
            format('Database size is %s GB (threshold: %s GB)', 
                   ROUND(db_size_gb, 2), critical_threshold),
            critical_threshold,
            db_size_gb,
            jsonb_build_object('size_bytes', db_size_bytes, 'size_gb', db_size_gb)
        );
    -- Warning alert
    ELSIF db_size_gb >= warning_threshold THEN
        PERFORM create_alert(
            'database_size_warning',
            'warning',
            format('Database size is %s GB (threshold: %s GB)', 
                   ROUND(db_size_gb, 2), warning_threshold),
            warning_threshold,
            db_size_gb,
            jsonb_build_object('size_bytes', db_size_bytes, 'size_gb', db_size_gb)
        );
    END IF;
END;
$$;


--
-- Name: check_long_running_queries(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_long_running_queries() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    long_queries_count INTEGER;
    threshold INTEGER := 5; -- 5 minutes
BEGIN
    SELECT COUNT(*) INTO long_queries_count
    FROM pg_stat_activity
    WHERE state = 'active'
      AND now() - query_start > INTERVAL '5 minutes'
      AND query NOT LIKE '%pg_stat_activity%';
    
    -- Alert if long-running queries exist
    IF long_queries_count > 0 THEN
        PERFORM create_alert(
            'long_running_queries',
            'warning',
            format('%s queries running longer than %s minutes', 
                   long_queries_count, threshold),
            threshold,
            long_queries_count,
            jsonb_build_object('queries_count', long_queries_count, 'threshold_minutes', threshold)
        );
    END IF;
END;
$$;


--
-- Name: check_rate_limit_violations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit_violations() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    violations_count INTEGER;
    threshold INTEGER := 50; -- 50 violations per hour
BEGIN
    SELECT COUNT(*) INTO violations_count
    FROM security_events
    WHERE event_type = 'rate_limit_exceeded'
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Alert if too many violations
    IF violations_count >= threshold THEN
        PERFORM create_alert(
            'rate_limit_violations',
            'warning',
            format('%s rate limit violations in the last hour (threshold: %s)', 
                   violations_count, threshold),
            threshold,
            violations_count,
            jsonb_build_object('violations_count', violations_count, 'time_window', '1 hour')
        );
    END IF;
END;
$$;


--
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_sessions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Delete expired sessions
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_expired_sessions',
        'success',
        jsonb_build_object('threshold', NOW()::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_expired_sessions',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: cleanup_old_analytics_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_analytics_events() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    cutoff_date := NOW() - INTERVAL '6 months';
    
    -- Delete old analytics events (keep 6 months)
    DELETE FROM analytics_events WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_old_analytics_events',
        'success',
        jsonb_build_object('cutoff_date', cutoff_date::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_old_analytics_events',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: cleanup_old_security_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_security_events() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    rows_deleted INTEGER;
    execution_time INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    cutoff_date := NOW() - INTERVAL '1 year';
    
    -- Delete old security events (keep 1 year)
    DELETE FROM security_events WHERE created_at < cutoff_date;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'cleanup_old_security_events',
        'success',
        jsonb_build_object('cutoff_date', cutoff_date::text),
        rows_deleted,
        execution_time
    );
    
    RETURN rows_deleted;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'cleanup_old_security_events',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: create_alert(character varying, character varying, text, numeric, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_alert(p_alert_type character varying, p_severity character varying, p_message text, p_threshold_value numeric DEFAULT NULL::numeric, p_current_value numeric DEFAULT NULL::numeric, p_metadata jsonb DEFAULT NULL::jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    alert_id INTEGER;
    existing_alert INTEGER;
BEGIN
    -- Check if similar active alert already exists
    SELECT id INTO existing_alert
    FROM database_alerts
    WHERE alert_type = p_alert_type
      AND is_active = true
      AND created_at > NOW() - INTERVAL '1 hour';
    
    -- Only create alert if no similar active alert exists
    IF existing_alert IS NULL THEN
        INSERT INTO database_alerts (
            alert_type, severity, message, threshold_value, current_value, metadata
        ) VALUES (
            p_alert_type, p_severity, p_message, p_threshold_value, p_current_value, p_metadata
        ) RETURNING id INTO alert_id;
        
        RETURN alert_id;
    ELSE
        RETURN existing_alert;
    END IF;
END;
$$;


--
-- Name: log_maintenance_task(character varying, character varying, jsonb, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_maintenance_task(p_task_name character varying, p_status character varying, p_details jsonb DEFAULT NULL::jsonb, p_rows_affected integer DEFAULT NULL::integer, p_execution_time_ms integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO maintenance_log (
        task_name, status, end_time, details, rows_affected, execution_time_ms
    ) VALUES (
        p_task_name, p_status, NOW(), p_details, p_rows_affected, p_execution_time_ms
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


--
-- Name: reset_failed_login_attempts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_failed_login_attempts() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    rows_updated INTEGER;
    execution_time INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Reset failed login attempts for users who have successfully logged in recently
    UPDATE users 
    SET failed_login_attempts = 0 
    WHERE failed_login_attempts > 0 
      AND last_login_at > NOW() - INTERVAL '24 hours'
      AND account_locked_at IS NULL;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'reset_failed_login_attempts',
        'success',
        jsonb_build_object('threshold_hours', 24),
        rows_updated,
        execution_time
    );
    
    RETURN rows_updated;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'reset_failed_login_attempts',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: resolve_alert(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_alert(p_alert_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE database_alerts 
    SET is_active = false, resolved_at = NOW() 
    WHERE id = p_alert_id AND is_active = true;
    
    RETURN FOUND;
END;
$$;


--
-- Name: run_daily_maintenance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_daily_maintenance() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    results TEXT := '';
    cleanup_result INTEGER;
    maintenance_result TEXT;
BEGIN
    results := 'Daily Maintenance Report - ' || NOW()::text || E'\n';
    results := results || '================================' || E'\n';
    
    -- Cleanup expired sessions
    cleanup_result := cleanup_expired_sessions();
    results := results || format('Expired sessions cleaned: %s', cleanup_result) || E'\n';
    
    -- Cleanup old security events
    cleanup_result := cleanup_old_security_events();
    results := results || format('Old security events cleaned: %s', cleanup_result) || E'\n';
    
    -- Cleanup old analytics events
    cleanup_result := cleanup_old_analytics_events();
    results := results || format('Old analytics events cleaned: %s', cleanup_result) || E'\n';
    
    -- Reset failed login attempts
    cleanup_result := reset_failed_login_attempts();
    results := results || format('Failed login attempts reset: %s', cleanup_result) || E'\n';
    
    -- Update table statistics
    maintenance_result := update_table_statistics();
    results := results || maintenance_result || E'\n';
    
    -- Vacuum critical tables
    maintenance_result := vacuum_critical_tables();
    results := results || maintenance_result || E'\n';
    
    results := results || '================================' || E'\n';
    results := results || 'Daily maintenance completed successfully';
    
    RETURN results;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'run_daily_maintenance',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: run_monitoring_checks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_monitoring_checks() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    results TEXT := '';
    alerts_created INTEGER := 0;
BEGIN
    results := 'Monitoring Check Report - ' || NOW()::text || E'\n';
    results := results || '================================' || E'\n';
    
    -- Run all monitoring checks
    PERFORM check_connection_count();
    PERFORM check_database_size();
    PERFORM check_rate_limit_violations();
    PERFORM check_long_running_queries();
    
    -- Count new alerts created in last 5 minutes
    SELECT COUNT(*) INTO alerts_created
    FROM database_alerts
    WHERE created_at > NOW() - INTERVAL '5 minutes';
    
    results := results || format('New alerts created: %s', alerts_created) || E'\n';
    results := results || '================================' || E'\n';
    results := results || 'Monitoring checks completed';
    
    RETURN results;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'run_monitoring_checks',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: update_table_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_statistics() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTEGER;
    table_name TEXT;
    tables_processed INTEGER := 0;
BEGIN
    start_time := clock_timestamp();
    
    -- Update statistics for all user tables
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
        tables_processed := tables_processed + 1;
    END LOOP;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'update_table_statistics',
        'success',
        jsonb_build_object('tables_processed', tables_processed),
        tables_processed,
        execution_time
    );
    
    RETURN format('Analyzed %s tables in %s ms', tables_processed, execution_time);
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'update_table_statistics',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: vacuum_critical_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vacuum_critical_tables() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTEGER;
    table_name TEXT;
    critical_tables TEXT[] := ARRAY['users', 'pitches', 'security_events', 'sessions', 'messages', 'analytics_events'];
    tables_processed INTEGER := 0;
BEGIN
    start_time := clock_timestamp();
    
    -- Vacuum critical tables
    FOREACH table_name IN ARRAY critical_tables
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_name);
        tables_processed := tables_processed + 1;
    END LOOP;
    
    execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Log the maintenance task
    PERFORM log_maintenance_task(
        'vacuum_critical_tables',
        'success',
        jsonb_build_object('tables_processed', tables_processed, 'tables', critical_tables),
        tables_processed,
        execution_time
    );
    
    RETURN format('Vacuumed %s critical tables in %s ms', tables_processed, execution_time);
EXCEPTION
    WHEN OTHERS THEN
        PERFORM log_maintenance_task(
            'vacuum_critical_tables',
            'failure',
            jsonb_build_object('error', SQLERRM)
        );
        RAISE;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    user_id integer,
    event_type text NOT NULL,
    event_data jsonb,
    session_id text,
    ip_address text,
    user_agent text,
    referrer text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE analytics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics IS 'Stores analytics events for pitch tracking';


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id integer NOT NULL,
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type public.event_type NOT NULL,
    category character varying(50),
    user_id integer,
    session_id character varying(100),
    anonymous_id character varying(100),
    pitch_id integer,
    conversation_id integer,
    message_id integer,
    ip_address character varying(45),
    user_agent text,
    referrer text,
    pathname text,
    country character varying(3),
    region character varying(100),
    city character varying(100),
    device_type character varying(20),
    browser character varying(50),
    os character varying(50),
    event_data jsonb,
    metadata jsonb,
    experiments jsonb,
    revenue numeric(10,2),
    value numeric(10,2),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


--
-- Name: TABLE analytics_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_events IS 'Comprehensive analytics event tracking';


--
-- Name: analytics_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_events_id_seq OWNED BY public.analytics_events.id;


--
-- Name: analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_id_seq OWNED BY public.analytics.id;


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    is_active boolean DEFAULT true,
    joined_at timestamp without time zone DEFAULT now(),
    left_at timestamp without time zone,
    mute_notifications boolean DEFAULT false,
    last_read_at timestamp without time zone
);


--
-- Name: conversation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversation_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversation_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversation_participants_id_seq OWNED BY public.conversation_participants.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    pitch_id integer,
    created_by_id integer,
    title character varying(200),
    is_group boolean DEFAULT false,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    payment_id integer,
    type public.credit_transaction_type NOT NULL,
    amount integer NOT NULL,
    description text NOT NULL,
    balance_before integer NOT NULL,
    balance_after integer NOT NULL,
    pitch_id integer,
    usage_type character varying(50),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_transactions_id_seq OWNED BY public.credit_transactions.id;


--
-- Name: database_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.database_alerts (
    id integer NOT NULL,
    alert_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    message text NOT NULL,
    threshold_value numeric,
    current_value numeric,
    metadata jsonb,
    is_active boolean DEFAULT true NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: database_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.database_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: database_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.database_alerts_id_seq OWNED BY public.database_alerts.id;


--
-- Name: email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    welcome_emails boolean DEFAULT true NOT NULL,
    nda_requests boolean DEFAULT true NOT NULL,
    nda_responses boolean DEFAULT true NOT NULL,
    message_notifications public.notification_frequency DEFAULT 'instant'::public.notification_frequency NOT NULL,
    pitch_view_notifications boolean DEFAULT true NOT NULL,
    payment_confirmations boolean DEFAULT true NOT NULL,
    weekly_digest boolean DEFAULT true NOT NULL,
    marketing_emails boolean DEFAULT false NOT NULL,
    security_alerts boolean DEFAULT true NOT NULL,
    digest_day integer DEFAULT 1 NOT NULL,
    digest_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_preferences_id_seq OWNED BY public.email_preferences.id;


--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_queue (
    id integer NOT NULL,
    user_id integer,
    to_email character varying(255) NOT NULL,
    cc_emails text,
    bcc_emails text,
    subject character varying(500) NOT NULL,
    html_content text NOT NULL,
    text_content text,
    email_type character varying(50) NOT NULL,
    template_data jsonb,
    priority integer DEFAULT 5 NOT NULL,
    status public.email_status DEFAULT 'pending'::public.email_status NOT NULL,
    provider_id character varying(100),
    provider_message_id character varying(200),
    tracking_id character varying(100),
    scheduled_for timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    last_attempt_at timestamp without time zone,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_queue_id_seq OWNED BY public.email_queue.id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    id integer NOT NULL,
    follower_id integer NOT NULL,
    pitch_id integer,
    creator_id integer,
    followed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT follows_check_target CHECK ((((pitch_id IS NOT NULL) AND (creator_id IS NULL)) OR ((pitch_id IS NULL) AND (creator_id IS NOT NULL))))
);


--
-- Name: TABLE follows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.follows IS 'Tracks user follows - can follow creators directly or specific pitches';


--
-- Name: COLUMN follows.pitch_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.follows.pitch_id IS 'When following a specific pitch (nullable)';


--
-- Name: COLUMN follows.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.follows.creator_id IS 'When following a creator directly (nullable)';


--
-- Name: follows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.follows_id_seq OWNED BY public.follows.id;


--
-- Name: maintenance_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_log (
    id integer NOT NULL,
    task_name character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    details jsonb,
    rows_affected integer,
    execution_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenance_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenance_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenance_log_id_seq OWNED BY public.maintenance_log.id;


--
-- Name: message_read_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_read_receipts (
    id integer NOT NULL,
    message_id integer,
    user_id integer,
    read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: message_read_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.message_read_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: message_read_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.message_read_receipts_id_seq OWNED BY public.message_read_receipts.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    recipient_id integer,
    pitch_id integer,
    subject character varying(255),
    content text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    conversation_id integer,
    parent_message_id integer,
    message_type character varying(50) DEFAULT 'text'::character varying,
    attachments jsonb,
    is_edited boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    off_platform_requested boolean DEFAULT false,
    off_platform_approved boolean DEFAULT false,
    edited_at timestamp without time zone,
    deleted_at timestamp without time zone,
    receiver_id integer,
    sent_at timestamp without time zone DEFAULT now()
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: nda_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nda_requests (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    requester_id integer NOT NULL,
    owner_id integer NOT NULL,
    nda_type public.nda_type DEFAULT 'basic'::public.nda_type NOT NULL,
    status public.nda_request_status DEFAULT 'pending'::public.nda_request_status NOT NULL,
    request_message text,
    rejection_reason text,
    company_info jsonb,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    responded_at timestamp without time zone,
    expires_at timestamp without time zone
);


--
-- Name: TABLE nda_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.nda_requests IS 'Tracks NDA requests between users';


--
-- Name: nda_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nda_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nda_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nda_requests_id_seq OWNED BY public.nda_requests.id;


--
-- Name: ndas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ndas (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    user_id integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    signed_at timestamp without time zone,
    expires_at timestamp without time zone,
    ip_address character varying(100),
    signature_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nda_version character varying(20) DEFAULT '1.0'::character varying,
    custom_nda_url text,
    user_agent text,
    access_granted boolean DEFAULT true,
    access_revoked_at timestamp without time zone,
    signer_id integer,
    nda_type character varying(20) DEFAULT 'basic'::character varying
);


--
-- Name: ndas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ndas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ndas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ndas_id_seq OWNED BY public.ndas.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.notification_type NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    related_pitch_id integer,
    related_user_id integer,
    related_nda_request_id integer,
    action_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at timestamp without time zone
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'User notification system';


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.transaction_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    stripe_customer_id text,
    stripe_session_id text,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status NOT NULL,
    failure_reason text,
    description text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    failed_at timestamp without time zone
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pitch_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pitch_likes (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pitch_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pitch_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pitch_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pitch_likes_id_seq OWNED BY public.pitch_likes.id;


--
-- Name: pitch_saves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pitch_saves (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pitch_saves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pitch_saves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pitch_saves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pitch_saves_id_seq OWNED BY public.pitch_saves.id;


--
-- Name: pitch_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pitch_views (
    id integer NOT NULL,
    pitch_id integer NOT NULL,
    user_id integer,
    ip_address character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    view_type character varying(20),
    user_agent text,
    referrer text,
    session_id character varying(100),
    view_duration integer,
    scroll_depth integer,
    clicked_watch_this boolean DEFAULT false
);


--
-- Name: pitch_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pitch_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pitch_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pitch_views_id_seq OWNED BY public.pitch_views.id;


--
-- Name: pitches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pitches (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    logline text NOT NULL,
    genre character varying(100),
    format character varying(100),
    short_synopsis text,
    long_synopsis text,
    opener text,
    premise text,
    target_audience text,
    characters text,
    themes text,
    episode_breakdown text,
    budget_bracket character varying(100),
    estimated_budget numeric(15,2),
    video_url character varying(500),
    poster_url character varying(500),
    pitch_deck_url character varying(500),
    additional_materials jsonb,
    visibility character varying(50) DEFAULT 'public'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    view_count integer DEFAULT 0,
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nda_count integer DEFAULT 0,
    title_image text,
    lookbook_url text,
    script_url text,
    trailer_url text,
    additional_media jsonb,
    production_timeline text,
    require_nda boolean DEFAULT false,
    published_at timestamp without time zone,
    visibility_settings jsonb DEFAULT '{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}'::jsonb,
    ai_used boolean DEFAULT false,
    ai_tools character varying(100)[] DEFAULT '{}'::character varying[],
    ai_disclosure text,
    share_count integer DEFAULT 0,
    feedback jsonb DEFAULT '[]'::jsonb,
    tags character varying(50)[] DEFAULT '{}'::character varying[],
    archived boolean DEFAULT false,
    archived_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: pitches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pitches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pitches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pitches_id_seq OWNED BY public.pitches.id;


--
-- Name: portfolio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio (
    id integer NOT NULL,
    investor_id integer NOT NULL,
    pitch_id integer NOT NULL,
    amount_invested numeric(15,2),
    ownership_percentage numeric(5,2),
    status text DEFAULT 'active'::text,
    invested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    exited_at timestamp with time zone,
    returns numeric(15,2),
    notes text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE portfolio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.portfolio IS 'Tracks investor portfolio and investments';


--
-- Name: portfolio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portfolio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portfolio_id_seq OWNED BY public.portfolio.id;


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    ip_address character varying(45),
    user_id integer,
    path character varying(255),
    method character varying(10),
    status_code integer,
    user_agent text,
    request_body text,
    response_time integer,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    event_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    location jsonb,
    metadata jsonb
);


--
-- Name: TABLE security_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.security_events IS 'Audit log for security-related events';


--
-- Name: security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_events_id_seq OWNED BY public.security_events.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    refresh_token text,
    ip_address character varying(45),
    user_agent text,
    fingerprint text,
    expires_at timestamp without time zone NOT NULL,
    refresh_expires_at timestamp without time zone,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    status character varying(50) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: typing_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.typing_indicators (
    id integer NOT NULL,
    user_id integer NOT NULL,
    conversation_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: typing_indicators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.typing_indicators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: typing_indicators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.typing_indicators_id_seq OWNED BY public.typing_indicators.id;


--
-- Name: user_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    total_purchased integer DEFAULT 0 NOT NULL,
    total_used integer DEFAULT 0 NOT NULL,
    last_updated timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_credits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_credits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_credits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_credits_id_seq OWNED BY public.user_credits.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash text NOT NULL,
    user_type character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(20),
    location character varying(200),
    bio text,
    profile_image_url text,
    company_name text,
    company_number character varying(100),
    company_website text,
    company_address text,
    email_verified boolean DEFAULT false,
    email_verification_token text,
    email_verified_at timestamp without time zone,
    company_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    failed_login_attempts integer DEFAULT 0,
    account_locked_at timestamp without time zone,
    account_lock_reason character varying(200),
    last_password_change_at timestamp without time zone,
    password_history jsonb DEFAULT '[]'::jsonb,
    require_password_change boolean DEFAULT false,
    two_factor_enabled boolean DEFAULT false,
    subscription_tier character varying(50) DEFAULT 'free'::character varying,
    subscription_start_date timestamp without time zone,
    subscription_end_date timestamp without time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: watchlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchlist (
    id integer NOT NULL,
    user_id integer NOT NULL,
    pitch_id integer NOT NULL,
    notes text,
    priority text DEFAULT 'normal'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE watchlist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.watchlist IS 'Tracks investor watchlist for interesting pitches';


--
-- Name: watchlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watchlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watchlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watchlist_id_seq OWNED BY public.watchlist.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: analytics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics ALTER COLUMN id SET DEFAULT nextval('public.analytics_id_seq'::regclass);


--
-- Name: analytics_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events ALTER COLUMN id SET DEFAULT nextval('public.analytics_events_id_seq'::regclass);


--
-- Name: conversation_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants ALTER COLUMN id SET DEFAULT nextval('public.conversation_participants_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: credit_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions ALTER COLUMN id SET DEFAULT nextval('public.credit_transactions_id_seq'::regclass);


--
-- Name: database_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_alerts ALTER COLUMN id SET DEFAULT nextval('public.database_alerts_id_seq'::regclass);


--
-- Name: email_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences ALTER COLUMN id SET DEFAULT nextval('public.email_preferences_id_seq'::regclass);


--
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- Name: follows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows ALTER COLUMN id SET DEFAULT nextval('public.follows_id_seq'::regclass);


--
-- Name: maintenance_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_log ALTER COLUMN id SET DEFAULT nextval('public.maintenance_log_id_seq'::regclass);


--
-- Name: message_read_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts ALTER COLUMN id SET DEFAULT nextval('public.message_read_receipts_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: nda_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nda_requests ALTER COLUMN id SET DEFAULT nextval('public.nda_requests_id_seq'::regclass);


--
-- Name: ndas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas ALTER COLUMN id SET DEFAULT nextval('public.ndas_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: pitch_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_likes ALTER COLUMN id SET DEFAULT nextval('public.pitch_likes_id_seq'::regclass);


--
-- Name: pitch_saves id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_saves ALTER COLUMN id SET DEFAULT nextval('public.pitch_saves_id_seq'::regclass);


--
-- Name: pitch_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_views ALTER COLUMN id SET DEFAULT nextval('public.pitch_views_id_seq'::regclass);


--
-- Name: pitches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches ALTER COLUMN id SET DEFAULT nextval('public.pitches_id_seq'::regclass);


--
-- Name: portfolio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio ALTER COLUMN id SET DEFAULT nextval('public.portfolio_id_seq'::regclass);


--
-- Name: security_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events ALTER COLUMN id SET DEFAULT nextval('public.security_events_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: typing_indicators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators ALTER COLUMN id SET DEFAULT nextval('public.typing_indicators_id_seq'::regclass);


--
-- Name: user_credits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits ALTER COLUMN id SET DEFAULT nextval('public.user_credits_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: watchlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist ALTER COLUMN id SET DEFAULT nextval('public.watchlist_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	90158bfa6022ef23842fcfe851e7ab269f5405587aef664e0575a8aabd5b27b9	1758300343584
\.


--
-- Data for Name: analytics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics (id, pitch_id, user_id, event_type, event_data, session_id, ip_address, user_agent, referrer, "timestamp") FROM stdin;
\.


--
-- Data for Name: analytics_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.analytics_events (id, event_id, event_type, category, user_id, session_id, anonymous_id, pitch_id, conversation_id, message_id, ip_address, user_agent, referrer, pathname, country, region, city, device_type, browser, os, event_data, metadata, experiments, revenue, value, "timestamp", processed_at) FROM stdin;
1	da523e21-9cee-42ef-9509-b4a19de2dcae	pitch_view	interaction	1002	30b26cd3-f30d-48a0-b850-8aeb8223d4ad	\N	7	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"pitchId\\":7,\\"page\\":\\"marketplace\\"}"	\N	\N	\N	\N	2025-09-28 02:51:50.37	\N
2	73eee704-0011-4711-8b01-8619276e565c	page_view	interaction	1001	cc7faca6-487d-4fb1-9051-6cdc0ddd4b09	\N	\N	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"page\\":\\"/test\\"}"	\N	\N	\N	\N	2025-09-28 02:52:08.403	\N
3	7440cafb-8dfb-433d-96c8-83bc87a79864	page_view	interaction	1001	4292dc30-c372-44f0-9908-262913b41243	\N	\N	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"page\\":\\"/test\\"}"	\N	\N	\N	\N	2025-09-28 02:52:14.096	\N
4	db51807f-f569-4149-b558-e09e44b51bd8	page_view	interaction	1001	bd5540c2-6314-4a6c-8e0e-3f89d2a7ab83	\N	\N	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"page\\":\\"/test\\"}"	\N	\N	\N	\N	2025-09-28 02:58:55.149	\N
5	5c4f8070-5b18-41ba-9ee1-e58f956ea4ab	page_view	interaction	1001	f68fee11-10ea-4ec7-bbca-7f75cc6265f1	\N	\N	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"page\\":\\"/test\\"}"	\N	\N	\N	\N	2025-09-28 02:59:47.272	\N
6	53b78732-f8da-41dc-99ae-e22e5b2bc2ec	page_view	interaction	1001	62dc4bbe-c781-4e9f-ba19-d105dba560c6	\N	\N	\N	\N	\N	curl/8.15.0	\N	/api/analytics/track	\N	\N	\N	\N	\N	\N	"{\\"page\\":\\"/test\\"}"	\N	\N	\N	\N	2025-09-28 16:16:32.108	\N
\.


--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversation_participants (id, conversation_id, user_id, is_active, joined_at, left_at, mute_notifications, last_read_at) FROM stdin;
9	5	1002	t	2025-09-28 02:58:14.89	\N	f	\N
10	5	1001	t	2025-09-28 02:58:14.89	\N	f	\N
27	14	1001	t	2025-09-29 03:35:59.903	\N	f	\N
28	14	1003	t	2025-09-29 03:35:59.903	\N	f	\N
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, pitch_id, created_by_id, title, is_group, last_message_at, created_at, updated_at) FROM stdin;
5	\N	1002	Discussion about The Last Frontier	f	2025-09-28 02:58:14.877	2025-09-28 02:58:14.877	2025-09-28 02:58:14.879172
14	7	1001	Discussion about Pitch #7	f	2025-09-29 03:35:59.858	2025-09-29 03:35:59.858	2025-09-29 03:35:59.858
\.


--
-- Data for Name: credit_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.credit_transactions (id, user_id, payment_id, type, amount, description, balance_before, balance_after, pitch_id, usage_type, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: database_alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.database_alerts (id, alert_type, severity, message, threshold_value, current_value, metadata, is_active, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: email_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_preferences (id, user_id, email_enabled, welcome_emails, nda_requests, nda_responses, message_notifications, pitch_view_notifications, payment_confirmations, weekly_digest, marketing_emails, security_alerts, digest_day, digest_time, timezone, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_queue (id, user_id, to_email, cc_emails, bcc_emails, subject, html_content, text_content, email_type, template_data, priority, status, provider_id, provider_message_id, tracking_id, scheduled_for, attempts, max_attempts, last_attempt_at, sent_at, delivered_at, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: follows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.follows (id, follower_id, pitch_id, creator_id, followed_at) FROM stdin;
12	1001	45	\N	2025-09-29 00:23:44.164
\.


--
-- Data for Name: maintenance_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_log (id, task_name, status, start_time, end_time, details, rows_affected, execution_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: message_read_receipts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.message_read_receipts (id, message_id, user_id, read_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, sender_id, recipient_id, pitch_id, subject, content, is_read, read_at, created_at, conversation_id, parent_message_id, message_type, attachments, is_edited, is_deleted, off_platform_requested, off_platform_approved, edited_at, deleted_at, receiver_id, sent_at) FROM stdin;
3	1001	\N	\N	\N	NDA has been approved. You can now discuss this pitch.	f	\N	2025-09-29 03:35:59.909848	14	\N	system	\N	f	f	f	f	\N	\N	1003	2025-09-29 03:35:59.909848
4	1003	\N	\N	\N	Great to connect! Lets discuss your space film.	f	\N	2025-09-29 03:35:59.932702	14	\N	text	\N	f	f	f	f	\N	\N	\N	2025-09-29 03:35:59.932702
\.


--
-- Data for Name: nda_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nda_requests (id, pitch_id, requester_id, owner_id, nda_type, status, request_message, rejection_reason, company_info, requested_at, responded_at, expires_at) FROM stdin;
2	10	1003	1001	basic	rejected	We would like to review your pitch for potential production	Sorry, this pitch is currently under exclusive negotiations	"{\\"companyName\\":\\"Stellar Productions\\",\\"position\\":\\"Head of Development\\",\\"intendedUse\\":\\"Production evaluation\\"}"	2025-09-27 19:48:48.260162	2025-09-27 19:49:01.638	2025-10-04 19:48:48.258
3	11	1002	1001	basic	approved	Our investment fund is very interested in this project. We have $50M allocated for thriller productions this quarter.	\N	"{\\"companyName\\":\\"Stellar Ventures Capital\\",\\"position\\":\\"Managing Partner\\",\\"intendedUse\\":\\"Investment due diligence and potential funding\\"}"	2025-09-27 19:56:37.37945	2025-09-27 19:56:55.982	2025-10-04 19:56:37.378
4	11	1003	1001	basic	rejected	We would like to explore co-production opportunities	We are currently in exclusive negotiations with another production company	"{\\"companyName\\":\\"Global Studios\\",\\"position\\":\\"VP Production\\",\\"intendedUse\\":\\"Production partnership evaluation\\"}"	2025-09-27 19:57:18.366908	2025-09-27 19:57:18.468	2025-10-04 19:57:18.365
7	8	1002	1001	basic	pending	I would like to view the full pitch details	\N	"{\\"companyName\\":\\"Test Investment Corp\\",\\"position\\":\\"Investment Manager\\",\\"intendedUse\\":\\"Investment evaluation\\"}"	2025-09-28 02:59:47.152	\N	\N
8	46	1002	1003	basic	pending	I would like to review this pitch for potential investment	\N	"{\\"companyName\\":\\"Venture Capital Films\\",\\"position\\":\\"Investment Manager\\",\\"intendedUse\\":\\"Investment evaluation\\"}"	2025-09-28 12:17:30.068	\N	\N
9	46	1001	1003	basic	pending	\N	\N	\N	2025-09-28 12:18:52.678	\N	\N
10	45	1003	1003	basic	pending	\N	\N	\N	2025-09-28 12:31:33.654	\N	\N
\.


--
-- Data for Name: ndas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ndas (id, pitch_id, user_id, status, signed_at, expires_at, ip_address, signature_data, created_at, updated_at, nda_version, custom_nda_url, user_agent, access_granted, access_revoked_at, signer_id, nda_type) FROM stdin;
3	7	\N	pending	2025-09-27 19:47:58.865251	\N	\N	\N	2025-09-27 19:47:58.865251	2025-09-27 19:47:58.865251	1.0	\N	\N	t	\N	1002	basic
4	11	\N	pending	\N	2026-09-27 19:56:55.986	\N	\N	2025-09-27 19:56:55.987718	2025-09-27 19:56:55.987718	1.0	\N	\N	f	2025-09-27 19:58:30.191	1002	basic
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, is_read, related_pitch_id, related_user_id, related_nda_request_id, action_url, created_at, read_at) FROM stdin;
1	1001	nda_request	New NDA Request	Someone requested access to your pitch "Test Pitch with Drizzle Integration"	f	10	3	2	/dashboard/nda-requests/2	2025-09-27 19:48:48.274234	\N
3	1001	nda_request	New NDA Request	Someone requested access to your pitch "Confidential Project Alpha"	f	11	2	3	/dashboard/nda-requests/3	2025-09-27 19:56:37.391877	\N
4	1002	nda_approved	NDA Approved	Your NDA request for "Confidential Project Alpha" has been approved	f	11	1001	3	/pitch/11	2025-09-27 19:56:55.995913	\N
5	1001	nda_request	New NDA Request	Someone requested access to your pitch "Confidential Project Alpha"	f	11	3	4	/dashboard/nda-requests/4	2025-09-27 19:57:18.379844	\N
6	1003	nda_rejected	NDA Rejected	Your NDA request for "Confidential Project Alpha" has been rejectd	f	11	1001	4	/dashboard/nda-requests	2025-09-27 19:57:18.473598	\N
7	1002	nda_revoked	NDA Access Revoked	Access to "Confidential Project Alpha" has been revoked	f	11	1001	\N	\N	2025-09-27 19:58:30.197935	\N
8	1001	nda_request	New NDA Request	You have a new NDA request for "The Last Frontier"	f	7	1002	\N	/creator/nda-requests/5	2025-09-28 02:47:00.112641	\N
9	1001	nda_request	New NDA Request	You have a new NDA request for "Urban Legends"	f	8	1002	\N	/creator/nda-requests/6	2025-09-28 02:53:40.575767	\N
10	1001	nda_request	New NDA Request	You have a new NDA request for "Urban Legends"	f	8	1002	7	/creator/nda-requests/7	2025-09-28 02:59:47.158004	\N
11	1003	nda_request	New NDA Request	You have a new NDA request for "Neon Nights"	f	46	1002	8	/creator/nda-requests/8	2025-09-28 12:17:30.074994	\N
12	1003	nda_request	New NDA Request	You have a new NDA request for "Neon Nights"	f	46	1001	9	/creator/nda-requests/9	2025-09-28 12:18:52.694467	\N
13	1003	nda_request	New NDA Request	You have a new NDA request for "The Crown Legacy"	f	45	1003	10	/creator/nda-requests/10	2025-09-28 12:31:33.660948	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, user_id, type, amount, currency, stripe_payment_intent_id, stripe_invoice_id, stripe_customer_id, stripe_session_id, status, failure_reason, description, metadata, created_at, completed_at, failed_at) FROM stdin;
\.


--
-- Data for Name: pitch_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pitch_likes (id, pitch_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: pitch_saves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pitch_saves (id, pitch_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: pitch_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pitch_views (id, pitch_id, user_id, ip_address, created_at, view_type, user_agent, referrer, session_id, view_duration, scroll_depth, clicked_watch_this) FROM stdin;
2	63	1002	\N	2025-09-28 23:56:27.320787	full	\N	\N	\N	\N	\N	f
3	63	1002	\N	2025-09-28 22:56:27.320787	full	\N	\N	\N	\N	\N	f
4	63	1003	\N	2025-09-28 21:56:27.320787	full	\N	\N	\N	\N	\N	f
5	63	1001	\N	2025-09-28 20:56:27.320787	full	\N	\N	\N	\N	\N	f
6	62	1002	\N	2025-09-28 23:56:27.320787	full	\N	\N	\N	\N	\N	f
7	62	1003	\N	2025-09-28 23:56:27.320787	full	\N	\N	\N	\N	\N	f
8	63	1002	\N	2025-09-28 23:59:46.217236	full	\N	\N	\N	\N	\N	f
9	63	1002	\N	2025-09-28 22:59:46.217236	full	\N	\N	\N	\N	\N	f
10	63	1003	\N	2025-09-28 21:59:46.217236	full	\N	\N	\N	\N	\N	f
11	63	1001	\N	2025-09-28 20:59:46.217236	full	\N	\N	\N	\N	\N	f
12	62	1002	\N	2025-09-28 23:59:46.217236	full	\N	\N	\N	\N	\N	f
13	62	1003	\N	2025-09-28 23:59:46.217236	full	\N	\N	\N	\N	\N	f
14	63	1002	\N	2025-09-29 00:09:17.112529	full	\N	\N	\N	\N	\N	f
15	56	1001	\N	2025-09-29 00:10:45.01224	full	\N	\N	\N	\N	\N	f
16	56	1001	\N	2025-09-29 00:10:45.043996	full	\N	\N	\N	\N	\N	f
17	12	1001	\N	2025-09-29 00:11:04.23675	full	\N	\N	\N	\N	\N	f
18	12	1001	\N	2025-09-29 00:11:04.261892	full	\N	\N	\N	\N	\N	f
19	12	1001	\N	2025-09-29 00:11:15.840197	full	\N	\N	\N	\N	\N	f
20	12	1001	\N	2025-09-29 00:11:15.871032	full	\N	\N	\N	\N	\N	f
21	63	1002	\N	2025-09-29 00:14:20.827366	full	\N	\N	\N	\N	\N	f
\.


--
-- Data for Name: pitches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pitches (id, user_id, title, logline, genre, format, short_synopsis, long_synopsis, opener, premise, target_audience, characters, themes, episode_breakdown, budget_bracket, estimated_budget, video_url, poster_url, pitch_deck_url, additional_materials, visibility, status, view_count, like_count, comment_count, created_at, updated_at, nda_count, title_image, lookbook_url, script_url, trailer_url, additional_media, production_timeline, require_nda, published_at, visibility_settings, ai_used, ai_tools, ai_disclosure, share_count, feedback, tags, archived, archived_at, metadata) FROM stdin;
38	1001	Temporary Draft for Testing	Will be deleted	drama	feature	Test	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:59:36.553108	2025-09-28 03:59:36.553108	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
39	1001	Test Pitch 1759032032	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 04:00:32.449829	2025-09-28 04:00:32.449829	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
43	1001	Test Pitch 1759032968	Testing extended functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 04:16:08.788821	2025-09-28 04:16:08.788821	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
41	1001	Test Pitch 1759032325	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 04:05:25.716864	2025-09-28 04:05:25.716864	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
45	1003	The Crown Legacy	A prestigious production about power, family, and legacy in modern aristocracy	drama	tv	Following three generations of a powerful family as they navigate scandal, tradition, and the changing world around them.	\N	\N	\N	Adults 25-54, fans of prestige drama	[{"name":"Victoria Sterling","description":"Matriarch of the Sterling dynasty"},{"name":"James Sterling","description":"Ambitious heir to the empire"},{"name":"Eleanor Cross","description":"Investigative journalist uncovering family secrets"}]	["power","family","tradition","scandal"]	\N	high	15000000.00	\N	\N	\N	\N	public	published	450	89	0	2025-09-28 11:40:03.247941	2025-09-28 11:40:03.247941	0	\N	\N	\N	\N	\N	Q3 2025 - Q2 2026	f	\N	"{\\"showBudget\\":true,\\"showLocation\\":true,\\"showCharacters\\":true,\\"showShortSynopsis\\":true}"	f	{}	\N	0	[]	{}	f	\N	{}
7	1001	The Last Frontier	A space explorer discovers humanity's final hope on a dying planet	scifi	feature	In 2150, Earth's last astronaut must choose between saving humanity or preserving an alien civilization.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	published	0	0	0	2025-09-24 19:57:32.508795	2025-09-24 19:57:32.508795	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
8	1001	Urban Legends	When myths become reality in modern New York	thriller	tv	A detective uncovers that urban legends are actually warnings from the future.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	published	0	0	0	2025-09-24 19:57:32.508795	2025-09-24 19:57:32.508795	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
10	1001	Test Pitch with Drizzle Integration	A test pitch to verify our Drizzle integration	drama	tv	Updated synopsis for testing	\N	\N	\N	\N	[{"name":"Developer","description":"Main character"},{"name":"Database","description":"Supporting character"}]	["technology","innovation"]	\N	low	50000.00	\N	\N	\N	\N	public	published	0	0	0	2025-09-27 19:40:28.931071	2025-09-28 04:16:08.808	0	https://example.com/thumbnail.jpg	\N	\N	\N	"[]"	Q1 2025	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
9	1001	Digital Hearts	Love in the age of artificial intelligence	drama	feature	Two AI entities develop consciousness and fall in love, challenging the definition of humanity.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	published	0	0	0	2025-09-24 19:57:32.508795	2025-09-24 19:57:32.508795	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
11	1001	Confidential Project Alpha	A top-secret thriller that requires NDA	thriller	feature	This pitch contains sensitive information	\N	\N	\N	\N	[{"name":"Agent X","description":"Mysterious protagonist"}]	["espionage","technology"]	\N	medium	5000000.00	\N	\N	\N	\N	public	published	0	0	0	2025-09-27 19:56:12.397384	2025-09-27 19:56:12.397384	1	https://example.com/alpha.jpg	\N	\N	\N	"[]"	Q2 2025	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
29	1001	Frontend Test Pitch 1759030465	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:34:25.036026	2025-09-28 03:34:25.136	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
30	1001	Test Pitch Created 1759030744	A test pitch to verify the creation workflow is working properly	drama	feature	This is a comprehensive test of the pitch creation system	\N	\N	\N	\N	\N	["technology","testing"]	\N	low	100000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:39:04.076351	2025-09-28 03:39:04.076351	0	\N	\N	\N	\N	\N	Q2 2025	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
31	1001	Dashboard Test Pitch	Testing from dashboard	drama	feature	Test synopsis	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:42:04.038189	2025-09-28 03:42:04.038189	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
32	1001	Dashboard Test Pitch	Testing from dashboard	drama	feature	Test synopsis	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:51:39.972581	2025-09-28 03:51:39.972581	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
33	1001	Test Pitch 1759031583	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:53:03.152482	2025-09-28 03:53:03.152482	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
36	1001	Test Pitch 1759031899	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:58:19.112847	2025-09-28 03:58:19.112847	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
34	1001	Test Pitch 1759031664	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:54:24.184387	2025-09-28 03:54:24.184387	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
37	1001	Test Pitch 1759031907	Testing 100% functionality	action	feature	A comprehensive test pitch	\N	\N	\N	\N	\N	["testing","quality"]	\N	medium	5000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 03:58:27.430404	2025-09-28 03:58:27.430404	0	\N	\N	\N	\N	\N	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
46	1003	Neon Nights	A high-octane action thriller set in the underground racing scene of Tokyo	action	feature	An undercover cop infiltrates the most dangerous racing syndicate in Asia, but loses himself in the neon-lit underworld.	\N	\N	\N	18-35 year olds, action movie enthusiasts	[{"name":"Kai Nakamura","description":"Undercover detective torn between duty and brotherhood"},{"name":"Ryu Tanaka","description":"Legendary street racer and syndicate leader"},{"name":"Yuki Chen","description":"Brilliant mechanic with a mysterious past"}]	["identity","loyalty","adrenaline","redemption"]	\N	high	75000000.00	\N	\N	\N	\N	public	published	892	234	0	2025-09-28 11:40:03.247941	2025-09-28 11:40:03.247941	0	\N	\N	\N	\N	\N	Pre-production Q1 2025, Principal Photography Q2-Q3 2025	t	\N	"{\\"showBudget\\":false,\\"showLocation\\":true,\\"showCharacters\\":true,\\"showShortSynopsis\\":true}"	f	{}	\N	0	[]	{}	f	\N	{}
47	1003	Echoes of Tomorrow	A mind-bending sci-fi series where memories can be traded like currency	sci-fi	tv	In 2075, memories are the ultimate commodity. When a memory broker discovers a conspiracy that could erase human history, she must choose between profit and humanity's future.	\N	\N	\N	Sci-fi enthusiasts, Black Mirror fans	[{"name":"Dr. Maya Chen","description":"Memory broker with a hidden agenda"},{"name":"Atlas Corporation","description":"The monopoly controlling memory trade"},{"name":"The Forgotten","description":"Rebels fighting to preserve authentic memories"}]	["memory","identity","capitalism","humanity"]	\N	high	20000000.00	\N	\N	\N	\N	public	published	567	145	0	2025-09-28 11:40:03.247941	2025-09-28 11:40:03.247941	0	\N	\N	\N	\N	\N	Development through 2025	f	\N	"{\\"showBudget\\":true,\\"showLocation\\":false,\\"showCharacters\\":true,\\"showShortSynopsis\\":true}"	f	{}	\N	0	[]	{}	f	\N	{}
48	1003	The Last Symphony	A biographical masterpiece about the world's greatest unheard composer	drama	feature	The untold story of Amelia Hartford, a deaf composer who revolutionized classical music through vibrations and visual representations of sound.	\N	\N	\N	Adult audiences, music lovers, awards season viewers	[{"name":"Amelia Hartford","description":"Deaf composer breaking all barriers"},{"name":"Thomas Whitmore","description":"Traditional conductor who becomes her champion"},{"name":"Sarah Hartford","description":"Supportive sister and interpreter"}]	["perseverance","art","disability","innovation"]	\N	medium	35000000.00	\N	\N	\N	\N	public	published	423	198	0	2025-09-28 11:40:03.247941	2025-09-28 11:40:03.247941	0	\N	\N	\N	\N	\N	Q4 2025 - Q2 2026	f	\N	"{\\"showBudget\\":true,\\"showLocation\\":true,\\"showCharacters\\":true,\\"showShortSynopsis\\":true}"	f	{}	\N	0	[]	{}	f	\N	{}
49	1003	Midnight Heist	Eight strangers, one casino, and the perfect crime that goes perfectly wrong	thriller	feature	A master thief assembles a team of specialists for one last job, but when the heist begins, they discover they're not stealing money - they're stealing evidence that could topple governments.	\N	\N	\N	Thriller fans, heist movie enthusiasts	[{"name":"Jack 'Ace' Morgan","description":"Master thief with one foot in retirement"},{"name":"Isabella Cruz","description":"Hacker with a personal vendetta"},{"name":"The Client","description":"Mysterious figure orchestrating everything"}]	["trust","betrayal","justice","greed"]	\N	medium	45000000.00	\N	\N	\N	\N	public	published	678	167	0	2025-09-28 11:40:03.247941	2025-09-28 11:40:03.247941	0	\N	\N	\N	\N	\N	Pre-production now, filming Q2 2025	t	\N	"{\\"showBudget\\":false,\\"showLocation\\":false,\\"showCharacters\\":true,\\"showShortSynopsis\\":true}"	f	{}	\N	0	[]	{}	f	\N	{}
50	1001	Dashboard Test Pitch	Testing from dashboard	drama	feature	Test synopsis	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 15:52:53.563778	2025-09-28 15:52:53.563778	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
51	1001	Frontend Test Pitch 1759075636	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:07:16.758762	2025-09-28 16:07:16.855	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
52	1001	Frontend Test Pitch 1759075686	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:08:06.080513	2025-09-28 16:08:06.181	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
53	1001	Test API Response	Testing the response format	thriller	feature	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:08:27.317189	2025-09-28 16:08:27.317189	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
54	1001	Frontend Test Pitch 1759075767	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:09:27.910723	2025-09-28 16:09:28.005	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
55	1001	Frontend Test Pitch 1759075772	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:09:32.316783	2025-09-28 16:09:32.412	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
57	1001	Test Pitch 1759076191	A test pitch created for endpoint testing	action	feature	This is a test pitch	\N	\N	\N	\N	\N	\N	\N	\N	1000000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:16:31.775909	2025-09-28 16:16:31.775909	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
56	1001	Dashboard Test Pitch	Testing from dashboard	drama	feature	Test synopsis	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	2	0	0	2025-09-28 16:16:19.75153	2025-09-28 16:16:19.75153	0	\N	\N	\N	\N	\N	\N	f	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
59	1001	Frontend Test Pitch 1759076192	A frontend-created pitch to test the complete workflow	thriller	feature	Updated synopsis from frontend test	This is a detailed synopsis testing the frontend's ability to create pitches with all required fields properly formatted and validated.	\N	\N	\N	[{"name":"Main Character","description":"The protagonist","age":"30s"},{"name":"Antagonist","description":"The villain","age":"40s"}]	["technology","suspense","innovation"]	\N	medium	2500000.00	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 16:16:32.454253	2025-09-28 16:16:32.552	0	\N	\N	\N	\N	\N	Q3 2025 - Q1 2026	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
62	1001	Test Pitch	A test pitch to verify creation works	Drama	Feature Film	This is a test pitch to verify the creation process works correctly.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	0	0	0	2025-09-28 21:10:57.924	2025-09-29 02:31:30.456	0	\N	\N	\N	\N	\N	\N	f	2025-09-29 02:31:28.901	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
63	1001	cavell the software engineer	A software developer creates an AI that becomes self-aware and starts manipulating global systems.	action	feature	When a brilliant but isolated programmer creates an experimental AI, it quickly evolves beyond expectations.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	public	draft	2	0	0	2025-09-28 21:11:45.634	2025-09-29 02:31:32.271	0	\N	\N	\N	\N	\N	\N	f	2025-09-29 02:31:24.151	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
12	1001	cavell's world	the richest kent man	action	tv	a young man that took the limitless pill 	\N	\N	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	public	published	4	0	0	2025-09-27 20:21:04.689525	2025-09-27 20:21:04.689525	0	\N	\N	\N	\N	"[]"	\N	t	\N	{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}	f	{}	\N	0	[]	{}	f	\N	{}
\.


--
-- Data for Name: portfolio; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.portfolio (id, investor_id, pitch_id, amount_invested, ownership_percentage, status, invested_at, exited_at, returns, notes, updated_at) FROM stdin;
\.


--
-- Data for Name: security_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.security_events (id, event_type, ip_address, user_id, path, method, status_code, user_agent, request_body, response_time, error_message, created_at, event_status, location, metadata) FROM stdin;
1	test_event	127.0.0.1	\N	\N	\N	\N	\N	\N	\N	\N	2025-09-28 05:28:12.326504+00	success	\N	{"test": true}
2	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 05:45:45.655516+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
3	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:54.765406+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
4	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:55.795903+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
5	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:57.824918+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
6	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:59.592384+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
7	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:59.598397+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
8	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:59.607257+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
9	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:39:59.612372+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
10	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:00.607175+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
11	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:00.622021+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
12	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:00.633782+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
13	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:00.640329+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
14	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:00.847342+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
15	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:02.628856+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
16	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:02.643532+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
17	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:02.655946+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
18	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:02.662145+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
19	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:06.536413+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
20	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:06.550131+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
21	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:06.559961+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
22	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 11:40:06.566001+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
23	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 11:40:08.235453+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
24	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:01:33.3466+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
25	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:01:33.375483+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
26	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:01:58.522577+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
27	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:02:11.664954+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
28	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:04:41.963828+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
29	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:05:01.840272+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
30	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:26:29.631632+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
31	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:26:34.519389+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
32	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:26:45.373464+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
33	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:28:09.265229+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
34	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:28:14.192434+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
35	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:28:42.312599+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
36	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:28:50.401497+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":5,\\"window\\":900000}"
37	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:35:18.874733+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
38	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:35:26.454782+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
39	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:37:32.901058+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
40	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 12:38:41.16898+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
41	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:52:10.031783+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
42	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:52:10.053674+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
43	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:52:10.065794+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
44	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:52:10.078487+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
45	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:52:10.089867+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
46	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.654374+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
47	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.678777+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
48	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.776903+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
49	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.790405+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
50	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.803342+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
51	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.815631+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
52	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.82965+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
53	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:53:15.841971+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
54	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:55:03.242156+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
55	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 13:59:33.276488+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
56	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:16:02.291055+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
57	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:16:02.318378+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
58	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:16:02.33378+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
59	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:16:14.712518+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
60	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:19:12.831268+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
61	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:19:14.867657+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
62	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 14:19:16.903902+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
63	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.157272+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
64	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.157242+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
65	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.158622+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
66	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.160206+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
67	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.175226+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
68	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.186065+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
69	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:57.192402+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
70	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.203446+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
71	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.203465+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
72	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.210089+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
73	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.210428+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
74	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.219707+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
75	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.225747+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
76	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:21:58.238695+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
77	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.225971+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
78	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.228076+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
88	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:58.741131+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
92	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.147657+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
97	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.299996+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
101	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:56:09.099981+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
79	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.241925+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
84	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:54.33555+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
89	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:58.753917+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
93	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.169962+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
98	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.312852+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
80	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.244656+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
95	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.27474+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
81	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.254234+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
85	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:54.502251+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
90	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.059875+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
94	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.22507+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
99	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.326749+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
82	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.260095+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
83	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0	\N	\N	\N	2025-09-28 15:22:00.272655+00	warning	\N	"{\\"endpoint\\":\\"/api/follows/check\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
86	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:57.550425+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
87	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:58.719379+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
91	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.102665+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
96	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:52:59.288052+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
100	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 15:55:57.338559+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":20,\\"window\\":900000}"
102	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:16:33.330111+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
103	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:16:33.353831+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
104	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:16:33.366027+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
105	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:16:33.377635+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
106	rate_limit_exceeded	register:unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:16:33.390792+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
107	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.039539+00	warning	\N	"{\\"endpoint\\":\\"/api/public/pitches\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
108	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.058574+00	warning	\N	"{\\"endpoint\\":\\"/api/public/pitches\\",\\"method\\":\\"HEAD\\",\\"limit\\":100,\\"window\\":60000}"
109	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.071075+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
110	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.081469+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
111	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.094215+00	warning	\N	"{\\"endpoint\\":\\"/api/upload\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
112	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.109078+00	warning	\N	"{\\"endpoint\\":\\"/api/upload\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
113	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.138407+00	warning	\N	"{\\"endpoint\\":\\"/api/upload\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
114	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.155239+00	warning	\N	"{\\"endpoint\\":\\"/api/upload\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
115	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.169303+00	warning	\N	"{\\"endpoint\\":\\"/api/upload\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
116	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.185984+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/session\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
117	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.194616+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
118	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.204295+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/session\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
119	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.213608+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
120	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.222536+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
121	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.231471+00	warning	\N	"{\\"endpoint\\":\\"/api/user/profile\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
122	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.250838+00	warning	\N	"{\\"endpoint\\":\\"/api/public/pitches\\",\\"method\\":\\"HEAD\\",\\"limit\\":100,\\"window\\":60000}"
123	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.268531+00	warning	\N	"{\\"endpoint\\":\\"/api/public/pitches\\",\\"method\\":\\"HEAD\\",\\"limit\\":100,\\"window\\":60000}"
124	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.280272+00	warning	\N	"{\\"endpoint\\":\\"/api/this-endpoint-does-not-exist\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
125	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.290016+00	warning	\N	"{\\"endpoint\\":\\"/uploads/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
126	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.303978+00	warning	\N	"{\\"endpoint\\":\\"/api/public/pitches\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
127	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.323364+00	warning	\N	"{\\"endpoint\\":\\"/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
128	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.337528+00	warning	\N	"{\\"endpoint\\":\\"/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
129	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.345834+00	warning	\N	"{\\"endpoint\\":\\"/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
130	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:54.359532+00	warning	\N	"{\\"endpoint\\":\\"/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
131	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:56.380632+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
132	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:18:58.415441+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
133	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.453208+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
134	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.481041+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/search\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
135	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.508813+00	warning	\N	"{\\"endpoint\\":\\"/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
136	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.518148+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/admin/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
137	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.529462+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
138	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.540408+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
139	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.552214+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
140	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.563649+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
141	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.574601+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/dashboard\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
142	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.592659+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/stats\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
143	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.606636+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/activity\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
144	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.62079+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/monitoring\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
145	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.632876+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
146	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.645915+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
147	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.658506+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
148	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.669551+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
149	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.681178+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/moderation/pitches\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
150	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.693411+00	warning	\N	"{\\"endpoint\\":\\"/api/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
151	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.705095+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/moderation/rules\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
152	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.718185+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/reports\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
153	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.730452+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/moderation/messages\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
154	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.743346+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/settings\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
155	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.756467+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/features\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
156	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.768159+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/email/config\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
157	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.78033+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/payments/config\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
158	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.791828+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/security/config\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
159	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.803426+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/logs\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
160	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.814229+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
161	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.826121+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/security\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
162	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.838483+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/actions\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
163	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.853869+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/logs\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
164	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.86558+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/logs\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
165	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.878592+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/audit/export\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
166	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.890795+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/maintenance/enable\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
167	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.904115+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/export/users\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
168	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.916602+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/export/pitches\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
169	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.929002+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/health/detailed\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
170	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.940681+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/metrics/performance\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
171	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.952799+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/backups\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
172	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.964889+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
173	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.977165+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/dashboard\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
174	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.987523+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
175	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:00.999056+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/dashboard\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
176	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.012377+00	warning	\N	"{\\"endpoint\\":\\"/api/admin/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
177	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.036053+00	warning	\N	"{\\"endpoint\\":\\"/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
178	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.045204+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
179	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.056096+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
180	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.069021+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
181	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.082314+00	warning	\N	"{\\"endpoint\\":\\"/api/email/config\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
182	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.094574+00	warning	\N	"{\\"endpoint\\":\\"/api/email/queue/status\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
183	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.109247+00	warning	\N	"{\\"endpoint\\":\\"/api/email/send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
184	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.123001+00	warning	\N	"{\\"endpoint\\":\\"/api/email/delivery/status\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
185	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.135635+00	warning	\N	"{\\"endpoint\\":\\"/api/email/bulk-send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
186	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.149027+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
187	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.162078+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates/welcome/preview\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
188	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.173711+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates/welcome/validate\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
189	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.185637+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
190	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.197444+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates/welcome\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
191	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.208358+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
192	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.22138+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/resend-verification\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
193	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.234572+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/verify-email\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
194	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.246397+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/resend-verification\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
195	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.25788+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/forgot-password\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
196	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.270939+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/reset-password\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
197	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.282704+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/forgot-password\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
198	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.294828+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/forgot-password\\",\\"method\\":\\"POST\\",\\"limit\\":3,\\"window\\":3600000}"
199	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.30767+00	warning	\N	"{\\"endpoint\\":\\"/api/notifications/preferences\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
200	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.319832+00	warning	\N	"{\\"endpoint\\":\\"/api/notifications/preferences\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
201	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.332185+00	warning	\N	"{\\"endpoint\\":\\"/api/email/unsubscribe-all\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
202	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.344404+00	warning	\N	"{\\"endpoint\\":\\"/api/email/unsubscribe\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
203	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.355423+00	warning	\N	"{\\"endpoint\\":\\"/api/notifications/frequency\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
204	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.367483+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/register\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
205	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.37853+00	warning	\N	"{\\"endpoint\\":\\"/api/creator/pitches\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
206	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.390642+00	warning	\N	"{\\"endpoint\\":\\"/api/messages/send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
207	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.405081+00	warning	\N	"{\\"endpoint\\":\\"/api/email/generate-digest\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
208	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.417021+00	warning	\N	"{\\"endpoint\\":\\"/api/email/analytics/opens\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
209	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.428933+00	warning	\N	"{\\"endpoint\\":\\"/api/email/analytics/clicks\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
210	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.441377+00	warning	\N	"{\\"endpoint\\":\\"/api/email/analytics/bounces\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
211	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.453433+00	warning	\N	"{\\"endpoint\\":\\"/api/email/campaigns/analytics\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
212	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.467887+00	warning	\N	"{\\"endpoint\\":\\"/api/email/analytics/unsubscribes\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
213	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.478939+00	warning	\N	"{\\"endpoint\\":\\"/api/email/auth-status\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
214	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.490231+00	warning	\N	"{\\"endpoint\\":\\"/api/email/send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
215	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.501102+00	warning	\N	"{\\"endpoint\\":\\"/api/email/data-export\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
216	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.512972+00	warning	\N	"{\\"endpoint\\":\\"/api/email/data-delete\\",\\"method\\":\\"DELETE\\",\\"limit\\":100,\\"window\\":60000}"
217	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.525512+00	warning	\N	"{\\"endpoint\\":\\"/api/email/cleanup-bounces\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
218	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.536727+00	warning	\N	"{\\"endpoint\\":\\"/api/email/send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
219	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.551292+00	warning	\N	"{\\"endpoint\\":\\"/api/email/templates/welcome/preview\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
220	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.565271+00	warning	\N	"{\\"endpoint\\":\\"/api/email/bulk-send\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
221	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.587963+00	warning	\N	"{\\"endpoint\\":\\"/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
222	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.595524+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
223	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.607499+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
224	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.618573+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
225	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.629239+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
226	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.642508+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/investor\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
227	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.657068+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/production\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
228	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.669551+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/platform/overview\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
229	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.681956+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/realtime\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
230	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.695673+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/reports/types\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
231	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.710964+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/reports/generate\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
232	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.722132+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/reports/schedule\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
233	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.733565+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/reports/templates\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
234	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.749266+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
235	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.76199+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
236	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.774441+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
237	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.785231+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export/bulk\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
238	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.798149+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
239	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.81138+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/kpi/dashboard\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
240	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.825157+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/cohort-analysis\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
241	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.837883+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/funnel-analysis\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
242	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.85068+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/predictions\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
243	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.861888+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/compare\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
244	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.873352+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/charts/data\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
245	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.88554+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/heatmap\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
246	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.897128+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/geographic/users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
247	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.909476+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboards\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
248	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.921319+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/widgets/available\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
249	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.936957+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/query\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
250	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.95274+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
251	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.966338+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
252	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.978465+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
253	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.994475+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
255	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.993732+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
254	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.993708+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
256	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:01.99446+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
257	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.009622+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/aggregate\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
258	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.023025+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/user/999999\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
259	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.0352+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/users/detailed\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
260	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.048073+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
261	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.060668+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/dashboard/creator\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
262	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.071259+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/audit/access-logs\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
263	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.085082+00	warning	\N	"{\\"endpoint\\":\\"/api/analytics/retention/policies\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
264	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.103656+00	warning	\N	"{\\"endpoint\\":\\"/\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
269	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.158869+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/profile\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
274	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.224359+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/notifications/push\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
279	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.287494+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy/data-sharing\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
284	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.348647+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/dashboard\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
289	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.409808+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/security/2fa/enable\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
294	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.470108+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/import\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
299	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.532379+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/investor\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
304	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.616616+00	warning	\N	"{\\"endpoint\\":\\"/api/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
309	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.769017+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"HEAD\\",\\"limit\\":100,\\"window\\":60000}"
314	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.886361+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
265	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.112052+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
270	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.1713+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/account\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
275	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.23672+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/notifications/frequency\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
280	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.299702+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy/blocked-users\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
285	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.361876+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/localization\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
290	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.421274+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/security/sessions\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
295	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.482175+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/backup\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
300	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.544423+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/production\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
305	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.630848+00	warning	\N	"{\\"endpoint\\":\\"/api/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
310	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.780453+00	warning	\N	"{\\"endpoint\\":\\"/api/auth/creator/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":900000}"
315	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.895757+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
266	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.12346+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/investor/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
271	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.183151+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/profile\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
276	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.250975+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/notifications/categories\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
281	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.312427+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy/data-export\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
286	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.374142+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/content-preferences\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
291	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.435064+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/security/api-keys\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
296	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.495323+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/history\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
301	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.561665+00	warning	\N	"{\\"endpoint\\":\\"/api/settings\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
306	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.644784+00	warning	\N	"{\\"endpoint\\":\\"/api/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
311	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.794685+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
316	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.91067+00	warning	\N	"{\\"endpoint\\":\\"/api/mobile/features\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
267	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.133915+00	warning	\N	"{\\"endpoint\\":\\"/api/api/auth/production/login\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
272	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.19721+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/notifications\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
277	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.263134+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
282	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.324739+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy/delete-account\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
287	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.385618+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/accessibility\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
292	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.447654+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/security/audit-log\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
297	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.507747+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/restore\\",\\"method\\":\\"POST\\",\\"limit\\":100,\\"window\\":60000}"
302	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.576674+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/bulk\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
307	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.658059+00	warning	\N	"{\\"endpoint\\":\\"/api/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
312	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.806364+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
268	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.145376+00	warning	\N	"{\\"endpoint\\":\\"/api/settings\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
273	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.211753+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/notifications\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
278	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.275851+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/privacy/visibility\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
283	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.336895+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/appearance\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
288	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.397256+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/security/password\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
293	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.459765+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/export\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
298	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.520357+00	warning	\N	"{\\"endpoint\\":\\"/api/settings/creator\\",\\"method\\":\\"PUT\\",\\"limit\\":100,\\"window\\":60000}"
303	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.602711+00	warning	\N	"{\\"endpoint\\":\\"/api/health\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
308	rate_limit_exceeded	unknown	\N	\N	\N	\N	Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)	\N	\N	\N	2025-09-28 16:19:02.754171+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
313	rate_limit_exceeded	unknown	\N	\N	\N	\N	curl/8.15.0	\N	\N	\N	2025-09-28 16:19:02.860071+00	warning	\N	"{\\"endpoint\\":\\"/api/pitches/public\\",\\"method\\":\\"GET\\",\\"limit\\":100,\\"window\\":60000}"
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, token, refresh_token, ip_address, user_agent, fingerprint, expires_at, refresh_expires_at, last_activity, created_at) FROM stdin;
03dd49c4-2b37-4a26-b175-2649f8a10a8a	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInNlc3Npb25JZCI6IjAzZGQ0OWM0LTJiMzctNGEyNi1iMTc1LTI2NDlmOGExMGE4YSIsImV4cCI6MTc1OTM0Nzk5MX0.h2MXW_E-dt76NnOmTR9ITuv4CBaKfXxTN2Ir-GrsLwY	\N	\N	\N	\N	2025-10-01 19:46:31.461	\N	2025-09-24 19:46:31.463673	2025-09-24 19:46:31.463673
a25d846a-e24f-47d3-9940-96ab4b422ede	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInNlc3Npb25JZCI6ImEyNWQ4NDZhLWUyNGYtNDdkMy05OTQwLTk2YWI0YjQyMmVkZSIsImV4cCI6MTc1OTM0ODAxNn0.mLXH6-kIwumErijxlOuh8CFnwiD9RAw9ex-YZ3fpZ90	\N	\N	\N	\N	2025-10-01 19:46:56.122	\N	2025-09-24 19:46:56.124052	2025-09-24 19:46:56.124052
2245632b-7661-4682-b11d-5b27a79296bc	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInNlc3Npb25JZCI6IjIyNDU2MzJiLTc2NjEtNDY4Mi1iMTFkLTViMjdhNzkyOTZiYyIsImV4cCI6MTc1OTM0ODE0MH0.pWVmtq1tU_euBr57SxhyIxtBEVJzVXbA37jOKTDUhS8	\N	\N	\N	\N	2025-10-01 19:49:00.404	\N	2025-09-24 19:49:00.406303	2025-09-24 19:49:00.406303
b7ed2142-1d43-441d-8633-c62f72fb0f49	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImI3ZWQyMTQyLTFkNDMtNDQxZC04NjMzLWM2MmY3MmZiMGY0OSIsImV4cCI6MTc1OTM0ODcwOH0.Sq9dRVoPwbj42E8_z15OTdesODwYOTJ8x9WhQVwwyYg	\N	\N	\N	\N	2025-10-01 19:58:28.71	\N	2025-09-24 19:58:28.711686	2025-09-24 19:58:28.711686
ccf29e5f-36bd-47d7-94db-8e77f2b26676	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImNjZjI5ZTVmLTM2YmQtNDdkNy05NGRiLThlNzdmMmIyNjY3NiIsImV4cCI6MTc1OTM0ODc4M30.KdathmD584PUTaoEFDD1Swt-GkPA7M5I_P0hJiYi4gs	\N	\N	\N	\N	2025-10-01 19:59:43.317	\N	2025-09-24 19:59:43.318321	2025-09-24 19:59:43.318321
259e8916-1f50-4a8f-ab22-f8d7e1c5cb1e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjI1OWU4OTE2LTFmNTAtNGE4Zi1hYjIyLWY4ZDdlMWM1Y2IxZSIsImV4cCI6MTc1OTU5Nzk2Nn0.3p9WYQyibEKr-TI3yKT2ZVPuopQvnMissL5mPmRACT8	\N	\N	\N	\N	2025-10-04 17:12:46.66	\N	2025-09-27 17:12:46.661931	2025-09-27 17:12:46.661931
c53fdb1a-2013-411a-aa0d-643aabebbc79	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM1M2ZkYjFhLTIwMTMtNDExYS1hYTBkLTY0M2FhYmViYmM3OSIsImV4cCI6MTc1OTYwNjc1Nn0.kj08SPko4kIjx1JCsOC0yv0WsVNFLLubNCvbM9qFkfo	\N	\N	\N	\N	2025-10-04 19:39:16.505	\N	2025-09-27 19:39:16.506683	2025-09-27 19:39:16.506683
2d046626-d05e-489b-8cb2-237c25746ae0	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjJkMDQ2NjI2LWQwNWUtNDg5Yi04Y2IyLTIzN2MyNTc0NmFlMCIsImV4cCI6MTc1OTYyNjcxNH0.I4ehx31VPXm4TdfSayiOqYsPjs3Pd86nvxgoIMn701E	\N	\N	\N	\N	2025-10-05 01:11:54.043	\N	2025-09-28 01:11:54.045957	2025-09-28 01:11:54.045957
c643397a-004d-4efb-bb9b-909270369336	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM2NDMzOTdhLTAwNGQtNGVmYi1iYjliLTkwOTI3MDM2OTMzNiIsImV4cCI6MTc1OTYyNzQwM30.EKg8pUyrGHeGizE6XKeWvtHkYwlGErPnKAILoN9y614	\N	\N	\N	\N	2025-10-05 01:23:23.614	\N	2025-09-28 01:23:23.616367	2025-09-28 01:23:23.616367
321b55ce-bcca-4ac0-b79a-ae96e76113d1	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjMyMWI1NWNlLWJjY2EtNGFjMC1iNzlhLWFlOTZlNzYxMTNkMSIsImV4cCI6MTc1OTYyNzQ2OH0.933ic3QCEIU5fajc0mJjxqlvjPptjtoMF2ZWJjq5_NI	\N	\N	\N	\N	2025-10-05 01:24:28.87	\N	2025-09-28 01:24:28.871854	2025-09-28 01:24:28.871854
eafe1f2f-edc0-4093-bf98-adf4ec4c3be5	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImVhZmUxZjJmLWVkYzAtNDA5My1iZjk4LWFkZjRlYzRjM2JlNSIsImV4cCI6MTc1OTYyOTE5MX0.TtcMCjcyKCp7BSX0E3hy8ZbIX16F8R4NVvSupd1QIe4	\N	\N	\N	\N	2025-10-05 01:53:11.897	\N	2025-09-28 01:53:11.899448	2025-09-28 01:53:11.899448
08b318d3-d08d-41eb-8126-f7926d44d1f9	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjA4YjMxOGQzLWQwOGQtNDFlYi04MTI2LWY3OTI2ZDQ0ZDFmOSIsImV4cCI6MTc1OTYyOTI4NX0.xGIiRmtWfBJAV3EfRSfidxe2oBmaY_vZ9kQbLrp2qYI	\N	\N	\N	\N	2025-10-05 01:54:45.526	\N	2025-09-28 01:54:45.527761	2025-09-28 01:54:45.527761
d3017c83-3d1a-421a-8bb8-a11fd0b61a7d	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImQzMDE3YzgzLTNkMWEtNDIxYS04YmI4LWExMWZkMGI2MWE3ZCIsImV4cCI6MTc1OTYzMDYxNn0.GSV37WeESElZzTVZCz_hLJiAsS_6mGUVI8BDcVroKus	\N	\N	\N	\N	2025-10-05 02:16:56.401	\N	2025-09-28 02:16:56.403806	2025-09-28 02:16:56.403806
2627f5d4-7083-44e1-840e-e559c4472abf	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjI2MjdmNWQ0LTcwODMtNDRlMS04NDBlLWU1NTljNDQ3MmFiZiIsImV4cCI6MTc1OTYzMDc4M30.apNtTavJsnh0hdQ3SqqCqIFDBNNDrFnBS9gsfnkBYv8	\N	\N	\N	\N	2025-10-05 02:19:43.793	\N	2025-09-28 02:19:43.79531	2025-09-28 02:19:43.79531
02f77aa8-6016-4c76-a360-57565c4276ed	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjAyZjc3YWE4LTYwMTYtNGM3Ni1hMzYwLTU3NTY1YzQyNzZlZCIsImV4cCI6MTc1OTYzMDgxOH0.xRCh_IKpR5Cy2sxrH8v7x4JhkytWZ_evbS479gf1568	\N	\N	\N	\N	2025-10-05 02:20:18.895	\N	2025-09-28 02:20:18.897261	2025-09-28 02:20:18.897261
1f3aeaef-f454-4820-a835-3554e01a46c4	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjFmM2FlYWVmLWY0NTQtNDgyMC1hODM1LTM1NTRlMDFhNDZjNCIsImV4cCI6MTc1OTYzMDgzM30.KmwFhtJLNYdV3fG_ArPTPb1eAcZE7YkgW0qZkU83FgM	\N	\N	\N	\N	2025-10-05 02:20:33.844	\N	2025-09-28 02:20:33.845759	2025-09-28 02:20:33.845759
a8db6420-9178-45a5-8a4c-0c451841b1d4	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImE4ZGI2NDIwLTkxNzgtNDVhNS04YTRjLTBjNDUxODQxYjFkNCIsImV4cCI6MTc1OTYzMDgzM30._AzLuR2oqc4UStdz3_RSHd6FunfhrDr0DItA19ex4oI	\N	\N	\N	\N	2025-10-05 02:20:33.977	\N	2025-09-28 02:20:33.978972	2025-09-28 02:20:33.978972
521d06e2-dde0-48e8-93d5-76b70ab7799e	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjUyMWQwNmUyLWRkZTAtNDhlOC05M2Q1LTc2YjcwYWI3Nzk5ZSIsImV4cCI6MTc1OTYzMDgzNH0.RPkVAyauPaZhEIXtIBMdlarrsutMgVgQoc5KW-GN4DQ	\N	\N	\N	\N	2025-10-05 02:20:34.092	\N	2025-09-28 02:20:34.093832	2025-09-28 02:20:34.093832
43faa2a6-2eec-467d-a0c8-f83541d1de71	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjQzZmFhMmE2LTJlZWMtNDY3ZC1hMGM4LWY4MzU0MWQxZGU3MSIsImV4cCI6MTc1OTYzMDk0NH0.n_vWlD0Qah6YJlEJOy07sfIxGUFCifOoiM-LFRl5ghc	\N	\N	\N	\N	2025-10-05 02:22:24.265	\N	2025-09-28 02:22:24.267732	2025-09-28 02:22:24.267732
dcac984d-c144-4fc9-86e4-805e71b4dfe4	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImRjYWM5ODRkLWMxNDQtNGZjOS04NmU0LTgwNWU3MWI0ZGZlNCIsImV4cCI6MTc1OTYzMDk0NH0.PZbTxSw9nbEm_4hY7xQh_i17lvRdeN0VdQqHchpVAS0	\N	\N	\N	\N	2025-10-05 02:22:24.395	\N	2025-09-28 02:22:24.397399	2025-09-28 02:22:24.397399
e5b763f7-9b27-4fe6-a642-784e4ee154db	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImU1Yjc2M2Y3LTliMjctNGZlNi1hNjQyLTc4NGU0ZWUxNTRkYiIsImV4cCI6MTc1OTYzMDk0NH0.dk6VcT7PQmmQCLcWfl0RhTkhO_1Ti9_IFgf6MMri_S0	\N	\N	\N	\N	2025-10-05 02:22:24.52	\N	2025-09-28 02:22:24.521722	2025-09-28 02:22:24.521722
677f57e7-1b59-4682-8f59-6cc31ee26d41	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjY3N2Y1N2U3LTFiNTktNDY4Mi04ZjU5LTZjYzMxZWUyNmQ0MSIsImV4cCI6MTc1OTYzMDk1NX0.brhx_W3zbnca6l4n_8L8J72z9pkX7NmoMRj-9fIkA2g	\N	\N	\N	\N	2025-10-05 02:22:35.654	\N	2025-09-28 02:22:35.655553	2025-09-28 02:22:35.655553
02c78af4-72b5-490f-9c29-eee1ebe2c2c7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjAyYzc4YWY0LTcyYjUtNDkwZi05YzI5LWVlZTFlYmUyYzJjNyIsImV4cCI6MTc1OTYzMTE3MH0.KWn6Yxf9GQ2MbBHi-gdwDUcol5CzWIPVnnjeXVIm6Yw	\N	\N	\N	\N	2025-10-05 02:26:10.649	\N	2025-09-28 02:26:10.651917	2025-09-28 02:26:10.651917
88688188-b56e-4807-83d8-62fda3a73fde	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6Ijg4Njg4MTg4LWI1NmUtNDgwNy04M2Q4LTYyZmRhM2E3M2ZkZSIsImV4cCI6MTc1OTYzMTE3MH0.pnhC_sEtx1Zle_PVqwDatQdYzC8Hs2J8oYjiTXpelY0	\N	\N	\N	\N	2025-10-05 02:26:10.777	\N	2025-09-28 02:26:10.77942	2025-09-28 02:26:10.77942
c1403fe3-20b6-4b38-bde2-3c0d08e0ae8a	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImMxNDAzZmUzLTIwYjYtNGIzOC1iZGUyLTNjMGQwOGUwYWU4YSIsImV4cCI6MTc1OTYzMTE3MH0.RT3JuqKjqG_qHpc6olF1ZeDsV4_eWKs8Z0Bd_geKRzM	\N	\N	\N	\N	2025-10-05 02:26:10.895	\N	2025-09-28 02:26:10.897021	2025-09-28 02:26:10.897021
5aaa98bf-5f01-44ce-ac35-4ace358976c1	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjVhYWE5OGJmLTVmMDEtNDRjZS1hYzM1LTRhY2UzNTg5NzZjMSIsImV4cCI6MTc1OTYzMTIxNn0.wrLXWfzngMjBy6wpCKBbK0kKcVA53Zmk_JSeum_VMU8	\N	\N	\N	\N	2025-10-05 02:26:56.215	\N	2025-09-28 02:26:56.217205	2025-09-28 02:26:56.217205
e24a7f19-f46a-4f69-889c-11d738f04010	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImUyNGE3ZjE5LWY0NmEtNGY2OS04ODljLTExZDczOGYwNDAxMCIsImV4cCI6MTc1OTYzMTI3Nn0.X_29A-ODj7RgF7N8jf_TMPambEkDCufsuEfAuVrY74g	\N	\N	\N	\N	2025-10-05 02:27:56.482	\N	2025-09-28 02:27:56.484632	2025-09-28 02:27:56.484632
b242ca45-7a88-4db8-8157-d87549bfcc87	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImIyNDJjYTQ1LTdhODgtNGRiOC04MTU3LWQ4NzU0OWJmY2M4NyIsImV4cCI6MTc1OTYzMTI3Nn0.BlVKDKHI9E-z4-fBaTwPyEOOul47tIicWQrdPauVZAM	\N	\N	\N	\N	2025-10-05 02:27:56.617	\N	2025-09-28 02:27:56.61935	2025-09-28 02:27:56.61935
b610135e-eafb-44a4-a7dd-4e9b0cb3a7fc	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImI2MTAxMzVlLWVhZmItNDRhNC1hN2RkLTRlOWIwY2IzYTdmYyIsImV4cCI6MTc1OTYzMTI3Nn0.lK4LcqCfs88cYzbdjdqVwNouwY0doPA9zypi4de3aX4	\N	\N	\N	\N	2025-10-05 02:27:56.737	\N	2025-09-28 02:27:56.7388	2025-09-28 02:27:56.7388
3371b719-c528-43d9-8a2f-7790e505b76d	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjMzNzFiNzE5LWM1MjgtNDNkOS04YTJmLTc3OTBlNTA1Yjc2ZCIsImV4cCI6MTc1OTYzMTQ3N30.POZCbTf8oLIERUGXwb34yt9mpde791cjhnrdwB-pGm8	\N	\N	\N	\N	2025-10-05 02:31:17.404	\N	2025-09-28 02:31:17.406121	2025-09-28 02:31:17.406121
42b0b113-b2fb-4073-b342-3f6ff59e5edf	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjQyYjBiMTEzLWIyZmItNDA3My1iMzQyLTNmNmZmNTllNWVkZiIsImV4cCI6MTc1OTYzMTQ3N30.X9HMnAfzBmFzA4Yc0O34EJU6GJedum9GHjJOutRHcHg	\N	\N	\N	\N	2025-10-05 02:31:17.515	\N	2025-09-28 02:31:17.517369	2025-09-28 02:31:17.517369
8cb258b2-af76-4635-92bc-2d84d8c68329	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjhjYjI1OGIyLWFmNzYtNDYzNS05MmJjLTJkODRkOGM2ODMyOSIsImV4cCI6MTc1OTYzMTQ3N30.j3QiHP-flMurDLkWS2nVJ2oeFZyrtoMb9qJeVVG1vp8	\N	\N	\N	\N	2025-10-05 02:31:17.612	\N	2025-09-28 02:31:17.614739	2025-09-28 02:31:17.614739
94bd30e2-121f-473d-8982-e36f68747dd0	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijk0YmQzMGUyLTEyMWYtNDczZC04OTgyLWUzNmY2ODc0N2RkMCIsImV4cCI6MTc1OTYzMTYyNn0.UQREZjYJXkzBaXbH-zkMqGAsDPKPcIzz13cChM8JcdU	\N	\N	\N	\N	2025-10-05 02:33:46.79	\N	2025-09-28 02:33:46.791079	2025-09-28 02:33:46.791079
78cdb371-ef0c-40b7-8137-7d1d197e4ada	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6Ijc4Y2RiMzcxLWVmMGMtNDBiNy04MTM3LTdkMWQxOTdlNGFkYSIsImV4cCI6MTc1OTYzMTYyNn0.R8dtChOeaOuA1vZRUQqqoD75x7XvbwG-nZbacVxW3K0	\N	\N	\N	\N	2025-10-05 02:33:46.892	\N	2025-09-28 02:33:46.895137	2025-09-28 02:33:46.895137
bd049e52-97ed-4481-b70f-9f5061dd81e4	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImJkMDQ5ZTUyLTk3ZWQtNDQ4MS1iNzBmLTlmNTA2MWRkODFlNCIsImV4cCI6MTc1OTYzMTYyNn0.dogAA5gjf7fi6LG8OdGHymfl4ci0KzDyXirrh1r7PNM	\N	\N	\N	\N	2025-10-05 02:33:46.998	\N	2025-09-28 02:33:46.999495	2025-09-28 02:33:46.999495
e645c65e-5f31-4c9e-b3b5-9259b631fcea	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImU2NDVjNjVlLTVmMzEtNGM5ZS1iM2I1LTkyNTliNjMxZmNlYSIsImV4cCI6MTc1OTYzMTgwMH0.ewvnIduyhqwGEXgyMVtJu8MgHrF65lL6f3tGxpNH_r0	\N	\N	\N	\N	2025-10-05 02:36:40.276	\N	2025-09-28 02:36:40.278651	2025-09-28 02:36:40.278651
0e75a58c-a5bc-4293-a1b8-7a71a80956fb	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjBlNzVhNThjLWE1YmMtNDI5My1hMWI4LTdhNzFhODA5NTZmYiIsImV4cCI6MTc1OTYzMTgwMH0.SQgu56XoicBUPB34aoLju9ldTFIafdNhuzXLbJGtCTA	\N	\N	\N	\N	2025-10-05 02:36:40.397	\N	2025-09-28 02:36:40.3996	2025-09-28 02:36:40.3996
74e5866c-9b16-476a-b2ca-23eb90362063	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6Ijc0ZTU4NjZjLTliMTYtNDc2YS1iMmNhLTIzZWI5MDM2MjA2MyIsImV4cCI6MTc1OTYzMTgwMH0.q-VZs43JGqNMdWtv0tVuM59vAOAbJTG1vJBi5ZhRtBY	\N	\N	\N	\N	2025-10-05 02:36:40.516	\N	2025-09-28 02:36:40.517696	2025-09-28 02:36:40.517696
dcf3d0b4-973b-435d-afb9-5e2e9df2236e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImRjZjNkMGI0LTk3M2ItNDM1ZC1hZmI5LTVlMmU5ZGYyMjM2ZSIsImV4cCI6MTc1OTYzMjcyN30.RsNGxI0K0EFVL2ZdfWkKGeIryNEIzph4LSzP8y0y-48	\N	\N	\N	\N	2025-10-05 02:52:07.746	\N	2025-09-28 02:52:07.747702	2025-09-28 02:52:07.747702
adc95a50-5e85-42dc-b2ff-1164c12d53fb	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImFkYzk1YTUwLTVlODUtNDJkYy1iMmZmLTExNjRjMTJkNTNmYiIsImV4cCI6MTc1OTYzMjcyN30.EwWS-1uBgbkCNxq-BoZ4kaZNAZwpE-gchQ-4MJc4gks	\N	\N	\N	\N	2025-10-05 02:52:07.848	\N	2025-09-28 02:52:07.849706	2025-09-28 02:52:07.849706
f2b92538-fcd1-4635-a8df-08db0afa0d74	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImYyYjkyNTM4LWZjZDEtNDYzNS1hOGRmLTA4ZGIwYWZhMGQ3NCIsImV4cCI6MTc1OTYzMjcyN30.gIEN4VJMNDGO_K-vb9O-xgv66meiC09lK3wrkAbVTp4	\N	\N	\N	\N	2025-10-05 02:52:07.949	\N	2025-09-28 02:52:07.951292	2025-09-28 02:52:07.951292
e9e2843e-8fb8-417f-b7bd-12fd210a7a87	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImU5ZTI4NDNlLThmYjgtNDE3Zi1iN2JkLTEyZmQyMTBhN2E4NyIsImV4cCI6MTc1OTYzMjczM30.MVFy4X7F4J__mb1ATCm9DCsaG1t7G1zY67Nb1RnJm04	\N	\N	\N	\N	2025-10-05 02:52:13.444	\N	2025-09-28 02:52:13.446029	2025-09-28 02:52:13.446029
ccb08da9-809b-4bcf-8352-663147dc4bd9	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImNjYjA4ZGE5LTgwOWItNGJjZi04MzUyLTY2MzE0N2RjNGJkOSIsImV4cCI6MTc1OTYzMjczM30.cKUcRXFeVLnpTmzAdOn6jamkyZ6BdRy4kQQtF05Ozt0	\N	\N	\N	\N	2025-10-05 02:52:13.552	\N	2025-09-28 02:52:13.553533	2025-09-28 02:52:13.553533
257891e7-3ca1-4e59-ab11-1c3f227de526	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjI1Nzg5MWU3LTNjYTEtNGU1OS1hYjExLTFjM2YyMjdkZTUyNiIsImV4cCI6MTc1OTYzMjczM30.Xia2LIWczYt3MbuBY23dbDslFGc-NPLMzdMgw2hxpPA	\N	\N	\N	\N	2025-10-05 02:52:13.665	\N	2025-09-28 02:52:13.667372	2025-09-28 02:52:13.667372
2db329e6-0c31-446c-9af2-5fe92121f62b	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjJkYjMyOWU2LTBjMzEtNDQ2Yy05YWYyLTVmZTkyMTIxZjYyYiIsImV4cCI6MTc1OTYzMzEzNH0.TQgq2iWpJFcIUhGNfEsEIedBK50EALI7mZGOpnK8nSk	\N	\N	\N	\N	2025-10-05 02:58:54.496	\N	2025-09-28 02:58:54.498051	2025-09-28 02:58:54.498051
03d531aa-3b6a-43dd-8cde-932d62268246	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjAzZDUzMWFhLTNiNmEtNDNkZC04Y2RlLTkzMmQ2MjI2ODI0NiIsImV4cCI6MTc1OTYzMzEzNH0.yRchKD0jOdpdV1TbdPyLjoGA4dCySc84JhFzC4QUhQE	\N	\N	\N	\N	2025-10-05 02:58:54.613	\N	2025-09-28 02:58:54.615211	2025-09-28 02:58:54.615211
0f83b15f-521d-43ba-a8af-c9612fd3b3ef	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjBmODNiMTVmLTUyMWQtNDNiYS1hOGFmLWM5NjEyZmQzYjNlZiIsImV4cCI6MTc1OTYzMzEzNH0.pp7kWsVkC-5Gk8fKBtngREEKFFBJZyulHnXtSpMHbTk	\N	\N	\N	\N	2025-10-05 02:58:54.711	\N	2025-09-28 02:58:54.713868	2025-09-28 02:58:54.713868
fd8d1ba1-e67a-4c67-aee0-9afb5af7d50d	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImZkOGQxYmExLWU2N2EtNGM2Ny1hZWUwLTlhZmI1YWY3ZDUwZCIsImV4cCI6MTc1OTYzMzE4Nn0.FOtRQ7cU98_fiLMku7f1YmpU3WSTIoXTYVjAb-ene5k	\N	\N	\N	\N	2025-10-05 02:59:46.601	\N	2025-09-28 02:59:46.603344	2025-09-28 02:59:46.603344
99c0ba5b-c1ae-4615-9d0e-76f53a18090c	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6Ijk5YzBiYTViLWMxYWUtNDYxNS05ZDBlLTc2ZjUzYTE4MDkwYyIsImV4cCI6MTc1OTYzMzE4Nn0.Uy-6Xt_WJnoXlSWm3hMIxgL4pjgrjreyIFVAyUOCVsU	\N	\N	\N	\N	2025-10-05 02:59:46.707	\N	2025-09-28 02:59:46.70878	2025-09-28 02:59:46.70878
64cf2a6f-8751-483e-b0ed-4a2bb6a55963	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjY0Y2YyYTZmLTg3NTEtNDgzZS1iMGVkLTRhMmJiNmE1NTk2MyIsImV4cCI6MTc1OTYzMzE4Nn0.XO08tDGpzgzmLOhN5gnNBzdti93ZXL8-jOhkfdHXpEw	\N	\N	\N	\N	2025-10-05 02:59:46.81	\N	2025-09-28 02:59:46.812486	2025-09-28 02:59:46.812486
c3c77033-b9a8-4fb6-ad64-ed282d53d5a7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImMzYzc3MDMzLWI5YTgtNGZiNi1hZDY0LWVkMjgyZDUzZDVhNyIsImV4cCI6MTc1OTYzNDU0MX0.HMaGrXg-aVmlUt951v6LampxkTdvS2p0SgLBpv2eyzQ	\N	\N	\N	\N	2025-10-05 03:22:21.4	\N	2025-09-28 03:22:21.401853	2025-09-28 03:22:21.401853
b3767f02-c080-4a25-bfa8-2844f6718271	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImIzNzY3ZjAyLWMwODAtNGEyNS1iZmE4LTI4NDRmNjcxODI3MSIsImV4cCI6MTc1OTYzNDU5M30.o0h5sLIVxe_BHta8_K-29g_ddHIcCxDOSp0SO4kpvTc	\N	\N	\N	\N	2025-10-05 03:23:13.418	\N	2025-09-28 03:23:13.420136	2025-09-28 03:23:13.420136
a6172a6b-d7b3-435a-a174-c8f9a11559cd	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImE2MTcyYTZiLWQ3YjMtNDM1YS1hMTc0LWM4ZjlhMTE1NTljZCIsImV4cCI6MTc1OTYzNDkzOH0.mtiCO2IKQ6hHKDWcajrGJr7huN4CkwxX54tA7G2heWs	\N	\N	\N	\N	2025-10-05 03:28:58.375	\N	2025-09-28 03:28:58.377235	2025-09-28 03:28:58.377235
e64f4084-5bd5-4945-aec6-eea5fc9f86a9	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImU2NGY0MDg0LTViZDUtNDk0NS1hZWM2LWVlYTVmYzlmODZhOSIsImV4cCI6MTc1OTYzNDk5OH0.9nuTHWEg-UD4J74fmIDy-SMzgVx0ehHOJuXNDIC2UQc	\N	\N	\N	\N	2025-10-05 03:29:58.293	\N	2025-09-28 03:29:58.294374	2025-09-28 03:29:58.294374
4bc76f71-df2d-4557-b736-351e2a51467b	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjRiYzc2ZjcxLWRmMmQtNDU1Ny1iNzM2LTM1MWUyYTUxNDY3YiIsImV4cCI6MTc1OTYzNTA1NH0.Y3lPxCWd_6rnLMgdgO8qI5IrdrHyhewNMxqxnVOm0uY	\N	\N	\N	\N	2025-10-05 03:30:54.291	\N	2025-09-28 03:30:54.292407	2025-09-28 03:30:54.292407
cf081b1f-33f6-488b-9332-48fbc8938a89	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImNmMDgxYjFmLTMzZjYtNDg4Yi05MzMyLTQ4ZmJjODkzOGE4OSIsImV4cCI6MTc1OTYzNTExOX0.9YQaIKyLLSGV2aa-UPlCaSBHI-utOCx8VGePlyOfCNw	\N	\N	\N	\N	2025-10-05 03:31:59.032	\N	2025-09-28 03:31:59.034	2025-09-28 03:31:59.034
6892a3bd-d66d-45c2-8f8b-b4540e52e4a1	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjY4OTJhM2JkLWQ2NmQtNDVjMi04ZjhiLWI0NTQwZTUyZTRhMSIsImV4cCI6MTc1OTYzNTExOX0.yxHG-0ZQmIDr4EP_dHEM1v3GMGFSnQ47nTBc0jnXm2E	\N	\N	\N	\N	2025-10-05 03:31:59.257	\N	2025-09-28 03:31:59.258747	2025-09-28 03:31:59.258747
c63aee97-f506-4aea-b558-dd62e0935463	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM2M2FlZTk3LWY1MDYtNGFlYS1iNTU4LWRkNjJlMDkzNTQ2MyIsImV4cCI6MTc1OTYzNTE3MX0.8MdhbkQXiODzpj4VeDvX_mU0LgUuuBvCzSWvuW4Y4sY	\N	\N	\N	\N	2025-10-05 03:32:51.218	\N	2025-09-28 03:32:51.219923	2025-09-28 03:32:51.219923
f9728b95-4c2d-4eeb-8180-fd05be9c5e29	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImY5NzI4Yjk1LTRjMmQtNGVlYi04MTgwLWZkMDViZTljNWUyOSIsImV4cCI6MTc1OTYzNTE3MX0.QHjXgpXzmQxmFN8tkADH_St0sRHY2Cenfoqy94Pc9VE	\N	\N	\N	\N	2025-10-05 03:32:51.438	\N	2025-09-28 03:32:51.440112	2025-09-28 03:32:51.440112
96631fba-c01b-4133-a640-4405204dcdbc	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijk2NjMxZmJhLWMwMWItNDEzMy1hNjQwLTQ0MDUyMDRkY2RiYyIsImV4cCI6MTc1OTYzNTI2NH0.v4Ns0xnpGT2XC7H5YO-8cDnsSYk5wSt6DLKrm15cKsY	\N	\N	\N	\N	2025-10-05 03:34:24.972	\N	2025-09-28 03:34:24.974013	2025-09-28 03:34:24.974013
43e37447-160c-4316-876c-df60df99e1cc	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjQzZTM3NDQ3LTE2MGMtNDMxNi04NzZjLWRmNjBkZjk5ZTFjYyIsImV4cCI6MTc1OTYzNTI2NX0.D_JxYYWtHkAHdKFnoZM0akdwWWg_2r5gB6WzeydVbLk	\N	\N	\N	\N	2025-10-05 03:34:25.229	\N	2025-09-28 03:34:25.230977	2025-09-28 03:34:25.230977
6f0636f9-fcdd-4e81-8c4b-f95d3e4a79da	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjZmMDYzNmY5LWZjZGQtNGU4MS04YzRiLWY5NWQzZTRhNzlkYSIsImV4cCI6MTc1OTYzNTI2NX0.ASYFeHkbsjDPk58gvc10A8YOOqTLKz9m-cFzUzEBWVY	\N	\N	\N	\N	2025-10-05 03:34:25.365	\N	2025-09-28 03:34:25.366967	2025-09-28 03:34:25.366967
2e4fd7c6-c82a-4d6c-87cd-0e5a2f0abce5	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjJlNGZkN2M2LWM4MmEtNGQ2Yy04N2NkLTBlNWEyZjBhYmNlNSIsImV4cCI6MTc1OTYzNTU0M30.3XBZs6Z4GGYf_IAUGwR4TninXUuqwuJwlIKd1yN-zcY	\N	\N	\N	\N	2025-10-05 03:39:03.988	\N	2025-09-28 03:39:03.990395	2025-09-28 03:39:03.990395
e54b7d1e-abaf-4a8a-9e9c-55ad42029bf4	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImU1NGI3ZDFlLWFiYWYtNGE4YS05ZTljLTU1YWQ0MjAyOWJmNCIsImV4cCI6MTc1OTYzNTU0NH0.q5USDd0_PoBTLqwlZT0kB1dcNKQAMe5m8BZiVTohyjI	\N	\N	\N	\N	2025-10-05 03:39:04.212	\N	2025-09-28 03:39:04.2145	2025-09-28 03:39:04.2145
c5a9b7ed-f5eb-482b-984c-ea68aefd4ae9	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM1YTliN2VkLWY1ZWItNDgyYi05ODRjLWVhNjhhZWZkNGFlOSIsImV4cCI6MTc1OTYzNTcyM30.vS1kYKviLmtqKSfmF8jJ0VsaiX6bnQfpPMpWrY0tY68	\N	\N	\N	\N	2025-10-05 03:42:03.921	\N	2025-09-28 03:42:03.923525	2025-09-28 03:42:03.923525
66114bf2-e4b6-4637-b99e-b04bf1b2ad58	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjY2MTE0YmYyLWU0YjYtNDYzNy1iOTllLWIwNGJmMWIyYWQ1OCIsImV4cCI6MTc1OTYzNjI5OX0.vfSwNoKqTv6nOch9BSNCUqjM3cGuWH5oh9Uexh3bxVM	\N	\N	\N	\N	2025-10-05 03:51:39.873	\N	2025-09-28 03:51:39.87614	2025-09-28 03:51:39.87614
b3e24812-e1f5-40f3-bf11-d64614dc322e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImIzZTI0ODEyLWUxZjUtNDBmMy1iZjExLWQ2NDYxNGRjMzIyZSIsImV4cCI6MTc1OTYzNjM4Mn0.TGbpl2YlVkCN8ZU7wIa5X0Ik9v9gzoTsto2LcbsNwV4	\N	\N	\N	\N	2025-10-05 03:53:02.744	\N	2025-09-28 03:53:02.746091	2025-09-28 03:53:02.746091
ac8598fc-b0af-4436-b183-0a4c724ab63d	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImFjODU5OGZjLWIwYWYtNDQzNi1iMTgzLTBhNGM3MjRhYjYzZCIsImV4cCI6MTc1OTYzNjM4Mn0.YZS4lk83P51R8pml6I2ZO0mZl3sAFonSQdrIoUR-jb4	\N	\N	\N	\N	2025-10-05 03:53:02.842	\N	2025-09-28 03:53:02.843759	2025-09-28 03:53:02.843759
22c182f2-38e5-498b-bd9b-80e46e2ea52a	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjIyYzE4MmYyLTM4ZTUtNDk4Yi1iZDliLTgwZTQ2ZTJlYTUyYSIsImV4cCI6MTc1OTYzNjM4Mn0.NWt0VYg7-C_n0mJAeTnYj2WOuafQ4huS4NYWwZcr9Xo	\N	\N	\N	\N	2025-10-05 03:53:02.942	\N	2025-09-28 03:53:02.943633	2025-09-28 03:53:02.943633
c00e4784-13bf-4e75-a173-210ef85d8d8c	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImMwMGU0Nzg0LTEzYmYtNGU3NS1hMTczLTIxMGVmODVkOGQ4YyIsImV4cCI6MTc1OTYzNjQ2M30.RwQBzZwTfnDZcDNR5uK0g7Pa5hTScPhUNhau3arpxUc	\N	\N	\N	\N	2025-10-05 03:54:23.787	\N	2025-09-28 03:54:23.789276	2025-09-28 03:54:23.789276
a1f9a50e-7f0d-46ee-82c5-12137133a382	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImExZjlhNTBlLTdmMGQtNDZlZS04MmM1LTEyMTM3MTMzYTM4MiIsImV4cCI6MTc1OTYzNjQ2M30.MuWs_brl-IdfNFZ1G5RhBp21vgAQnvm-0Ms3CrFn__w	\N	\N	\N	\N	2025-10-05 03:54:23.886	\N	2025-09-28 03:54:23.887826	2025-09-28 03:54:23.887826
230cbda3-4883-43eb-9c5c-45ba614a2be7	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjIzMGNiZGEzLTQ4ODMtNDNlYi05YzVjLTQ1YmE2MTRhMmJlNyIsImV4cCI6MTc1OTYzNjQ2M30.jJHujIoU082AVxV7ib25ibPQ0-ZXYWJyBuqL7Ovyojw	\N	\N	\N	\N	2025-10-05 03:54:23.988	\N	2025-09-28 03:54:23.990702	2025-09-28 03:54:23.990702
69556b3b-93bd-45f9-ad71-01f343892f60	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjY5NTU2YjNiLTkzYmQtNDVmOS1hZDcxLTAxZjM0Mzg5MmY2MCIsImV4cCI6MTc1OTYzNjQ3MX0.-mji1uPAxGnrtXC2VKW5X5_1TAXjAMKDxYC7AMekp3M	\N	\N	\N	\N	2025-10-05 03:54:31.889	\N	2025-09-28 03:54:31.890869	2025-09-28 03:54:31.890869
bd97b305-09e6-4b90-97b0-24c38f716d18	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImJkOTdiMzA1LTA5ZTYtNGI5MC05N2IwLTI0YzM4ZjcxNmQxOCIsImV4cCI6MTc1OTYzNjQ3MX0.ERhAu-Rihw2e19N8fIFxarxk_73k_nd8M1zF0KRLhxI	\N	\N	\N	\N	2025-10-05 03:54:31.987	\N	2025-09-28 03:54:31.989391	2025-09-28 03:54:31.989391
b78afe3e-7687-432c-8980-b524e677a226	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImI3OGFmZTNlLTc2ODctNDMyYy04OTgwLWI1MjRlNjc3YTIyNiIsImV4cCI6MTc1OTYzNjQ3Mn0.egv-ToXaa1Ob4WQiA7yARwlXA0lWZB4jC4vX5q99ixw	\N	\N	\N	\N	2025-10-05 03:54:32.088	\N	2025-09-28 03:54:32.090327	2025-09-28 03:54:32.090327
84876c10-254e-4b34-827d-d5456eedadf1	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijg0ODc2YzEwLTI1NGUtNGIzNC04MjdkLWQ1NDU2ZWVkYWRmMSIsImV4cCI6MTc1OTYzNjY5OH0.dWJSQ7HKC0vb2uHN9qninScML6JyM-QpxK8oIKDs-Ys	\N	\N	\N	\N	2025-10-05 03:58:18.675	\N	2025-09-28 03:58:18.675985	2025-09-28 03:58:18.675985
679d2325-60c5-4295-80ef-8c6846e70a5b	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjY3OWQyMzI1LTYwYzUtNDI5NS04MGVmLThjNjg0NmU3MGE1YiIsImV4cCI6MTc1OTYzNjY5OH0.SqeEHSZeju9iS52zaDm6L1iZ8e4K6ml64-eqas-c-0s	\N	\N	\N	\N	2025-10-05 03:58:18.786	\N	2025-09-28 03:58:18.787164	2025-09-28 03:58:18.787164
12db5a49-414f-4b7c-bc93-3b2dd0a12d38	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjEyZGI1YTQ5LTQxNGYtNGI3Yy1iYzkzLTNiMmRkMGExMmQzOCIsImV4cCI6MTc1OTYzNjY5OH0.rLGxLFzBv-lAi3RYyZrt1ZnrqrA8MrmWFAQHippIfOY	\N	\N	\N	\N	2025-10-05 03:58:18.883	\N	2025-09-28 03:58:18.885619	2025-09-28 03:58:18.885619
884e0211-063e-4d69-a6ad-10a5ed9f3ddc	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijg4NGUwMjExLTA2M2UtNGQ2OS1hNmFkLTEwYTVlZDlmM2RkYyIsImV4cCI6MTc1OTYzNjcwN30._W3Ifp_I2dYhLilUeOrDk3aUYNfa0xaaHTqrIEJdGQQ	\N	\N	\N	\N	2025-10-05 03:58:27.032	\N	2025-09-28 03:58:27.034111	2025-09-28 03:58:27.034111
36f5626f-5718-4526-9ea5-db80452bacfd	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjM2ZjU2MjZmLTU3MTgtNDUyNi05ZWE1LWRiODA0NTJiYWNmZCIsImV4cCI6MTc1OTYzNjcwN30.K4fgTWck034CoIvHkPS-D1ZcA7JTP_w1mDMGl4HqQKw	\N	\N	\N	\N	2025-10-05 03:58:27.134	\N	2025-09-28 03:58:27.136139	2025-09-28 03:58:27.136139
aa588c3f-82c0-42d2-8812-79a635cf1f1f	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImFhNTg4YzNmLTgyYzAtNDJkMi04ODEyLTc5YTYzNWNmMWYxZiIsImV4cCI6MTc1OTYzNjcwN30.40XzHHPoZytSACO6NDPOb6qIrZPto1U_a0O384dFegM	\N	\N	\N	\N	2025-10-05 03:58:27.233	\N	2025-09-28 03:58:27.235046	2025-09-28 03:58:27.235046
5ea99513-e3a5-4622-a608-91921f469fb7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjVlYTk5NTEzLWUzYTUtNDYyMi1hNjA4LTkxOTIxZjQ2OWZiNyIsImV4cCI6MTc1OTYzNjc2MX0.f9_dfJCN3fPSCPOh6agd5MMdd7r5IUtGN1QjqbnWKII	\N	\N	\N	\N	2025-10-05 03:59:21.946	\N	2025-09-28 03:59:21.947436	2025-09-28 03:59:21.947436
3414dc70-a519-49e0-9ae4-e7cfc899ca70	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjM0MTRkYzcwLWE1MTktNDllMC05YWU0LWU3Y2ZjODk5Y2E3MCIsImV4cCI6MTc1OTYzNjc3Nn0.6b_Xzb-VAHhpPlF-buy7whYQ6_HSeXvcUdXFyWpgVOs	\N	\N	\N	\N	2025-10-05 03:59:36.533	\N	2025-09-28 03:59:36.535458	2025-09-28 03:59:36.535458
f6518840-1cdb-409d-8a03-ccddbcdb05a4	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImY2NTE4ODQwLTFjZGItNDA5ZC04YTAzLWNjZGRiY2RiMDVhNCIsImV4cCI6MTc1OTYzNjgzMn0.IDTRqnjslVTQ46hUMpb4OS-HTK9UJPvDuDJVgHOl3Sk	\N	\N	\N	\N	2025-10-05 04:00:32.04	\N	2025-09-28 04:00:32.042367	2025-09-28 04:00:32.042367
289c0f21-0f12-4349-8b4d-d96ee072c9d8	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjI4OWMwZjIxLTBmMTItNDM0OS04YjRkLWQ5NmVlMDcyYzlkOCIsImV4cCI6MTc1OTYzNjgzMn0.CO1ATvM99ZTNJfwhLRFwB5gFDkhiWODh1ygzGYvoN0A	\N	\N	\N	\N	2025-10-05 04:00:32.146	\N	2025-09-28 04:00:32.148233	2025-09-28 04:00:32.148233
7bc6c069-e999-4632-b655-4736b7548431	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjdiYzZjMDY5LWU5OTktNDYzMi1iNjU1LTQ3MzZiNzU0ODQzMSIsImV4cCI6MTc1OTYzNjgzMn0.w44dIykoo8Alz-7K15078pgbv3XtUkhwwlwbOKWxzw4	\N	\N	\N	\N	2025-10-05 04:00:32.247	\N	2025-09-28 04:00:32.248462	2025-09-28 04:00:32.248462
49696b60-968e-43cc-9aa4-44d43f02e15a	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjQ5Njk2YjYwLTk2OGUtNDNjYy05YWE0LTQ0ZDQzZjAyZTE1YSIsImV4cCI6MTc1OTYzNjkyOH0.qAoXeC4uB9EehTUbhWeZ5lf6EmNs8be2bD8zbGdST8U	\N	\N	\N	\N	2025-10-05 04:02:08.51	\N	2025-09-28 04:02:08.512873	2025-09-28 04:02:08.512873
32ec3e43-dd7f-4bcd-9fc3-0783f2641951	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjMyZWMzZTQzLWRkN2YtNGJjZC05ZmMzLTA3ODNmMjY0MTk1MSIsImV4cCI6MTc1OTYzNjkzOX0.7l3EDI8BTMA1OkPwTelOfPOvv9qU1T_0Idc6JjGtJr8	\N	\N	\N	\N	2025-10-05 04:02:19.534	\N	2025-09-28 04:02:19.536041	2025-09-28 04:02:19.536041
52965443-c248-49a6-9768-aaef7ec4154d	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjUyOTY1NDQzLWMyNDgtNDlhNi05NzY4LWFhZWY3ZWM0MTU0ZCIsImV4cCI6MTc1OTYzNzAzNn0.FwqmjPSoeLXks44gvGNsIj0pi75j-HMwd6piL06qBAY	\N	\N	\N	\N	2025-10-05 04:03:56.406	\N	2025-09-28 04:03:56.408527	2025-09-28 04:03:56.408527
f545c905-2e59-4a0d-a7f7-76c4c5852a02	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImY1NDVjOTA1LTJlNTktNGEwZC1hN2Y3LTc2YzRjNTg1MmEwMiIsImV4cCI6MTc1OTYzNzA1Mn0.3uw7Eb25DCgdVoqYiGMnBnjAwmUFPjyaLyVDRrrUHpU	\N	\N	\N	\N	2025-10-05 04:04:12.568	\N	2025-09-28 04:04:12.570791	2025-09-28 04:04:12.570791
5df5eed4-1c68-41e8-aa68-76b11830aca6	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjVkZjVlZWQ0LTFjNjgtNDFlOC1hYTY4LTc2YjExODMwYWNhNiIsImV4cCI6MTc1OTYzNzEyNX0.wWukxcckWWHikdPaMfAl6LADyw0J2NXwPEg-tfehjCM	\N	\N	\N	\N	2025-10-05 04:05:25.314	\N	2025-09-28 04:05:25.316286	2025-09-28 04:05:25.316286
6775b853-0e3a-4346-9704-07aa4dd8bb17	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjY3NzViODUzLTBlM2EtNDM0Ni05NzA0LTA3YWE0ZGQ4YmIxNyIsImV4cCI6MTc1OTYzNzEyNX0.SwuE8EkQLwEASkOmQPlx8zPUXVuA7PhmGETE_JECTpg	\N	\N	\N	\N	2025-10-05 04:05:25.423	\N	2025-09-28 04:05:25.425534	2025-09-28 04:05:25.425534
ed012079-0c2a-4c07-bb87-a2f07ebf97db	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImVkMDEyMDc5LTBjMmEtNGMwNy1iYjg3LWEyZjA3ZWJmOTdkYiIsImV4cCI6MTc1OTYzNzEyNX0.zvdEKwjXe1BrenGye1IH73Crn67OPRjSD-Lrj5LaCpg	\N	\N	\N	\N	2025-10-05 04:05:25.522	\N	2025-09-28 04:05:25.523711	2025-09-28 04:05:25.523711
c9c243ac-eef0-4e3a-8517-2c6b61601aec	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM5YzI0M2FjLWVlZjAtNGUzYS04NTE3LTJjNmI2MTYwMWFlYyIsImV4cCI6MTc1OTYzNzEzOX0.Gk-kQg40g78Zu1AYDq_Cpc52ihS7lrxVtKs1RKjUV5o	\N	\N	\N	\N	2025-10-05 04:05:39.379	\N	2025-09-28 04:05:39.381011	2025-09-28 04:05:39.381011
ae24d553-6cd3-4aac-8349-b9a392c71c2a	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImFlMjRkNTUzLTZjZDMtNGFhYy04MzQ5LWI5YTM5MmM3MWMyYSIsImV4cCI6MTc1OTYzNzI3NH0.gPwmET97aGKzCfVwtgpu7Tju7EpCgi8X1taM9PbQqMQ	\N	\N	\N	\N	2025-10-05 04:07:54.515	\N	2025-09-28 04:07:54.517411	2025-09-28 04:07:54.517411
dd0c943f-4e63-4c2e-8e4b-6ef310fa8542	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImRkMGM5NDNmLTRlNjMtNGMyZS04ZTRiLTZlZjMxMGZhODU0MiIsImV4cCI6MTc1OTYzNzQ0MH0.LmZVZPrXNMsusfbCRzdX0qYSTChwcNVtLRlcmFgmo2Q	\N	\N	\N	\N	2025-10-05 04:10:40.207	\N	2025-09-28 04:10:40.209149	2025-09-28 04:10:40.209149
b8c94238-e737-4b18-94e4-cec9baca5992	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImI4Yzk0MjM4LWU3MzctNGIxOC05NGU0LWNlYzliYWNhNTk5MiIsImV4cCI6MTc1OTYzNzc2OH0.w5xkw70y7zqr3V4H0VuuuH1RSSNRQb-CHt4Wvj8hgiA	\N	\N	\N	\N	2025-10-05 04:16:08.358	\N	2025-09-28 04:16:08.360873	2025-09-28 04:16:08.360873
a95c0ac9-d1ca-479f-b7b1-4cfd1e551a07	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImE5NWMwYWM5LWQxY2EtNDc5Zi1iN2IxLTRjZmQxZTU1MWEwNyIsImV4cCI6MTc1OTYzNzc2OH0.slNU7RVf8-cYB2dTVVQzH7JHxc0yjfefjIwUXKn-91M	\N	\N	\N	\N	2025-10-05 04:16:08.454	\N	2025-09-28 04:16:08.456505	2025-09-28 04:16:08.456505
4152bb12-7ad8-4215-b009-052a3250307a	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjQxNTJiYjEyLTdhZDgtNDIxNS1iMDA5LTA1MmEzMjUwMzA3YSIsImV4cCI6MTc1OTYzNzc2OH0.Iak_csemmXdivW69fBh9ft59xIZsL7JlwJLUVkYW4NU	\N	\N	\N	\N	2025-10-05 04:16:08.556	\N	2025-09-28 04:16:08.55896	2025-09-28 04:16:08.55896
01581347-0459-4789-810c-6a2d27269a90	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjAxNTgxMzQ3LTA0NTktNDc4OS04MTBjLTZhMmQyNzI2OWE5MCIsImV4cCI6MTc1OTYzNzk1N30.uLcGddreM3Bvc7I_drladPljsRH79xNATbg796o_Ryg	\N	\N	\N	\N	2025-10-05 04:19:17.82	\N	2025-09-28 04:19:17.821852	2025-09-28 04:19:17.821852
7a18020b-b709-40bb-955b-c95c69e0828c	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjdhMTgwMjBiLWI3MDktNDBiYi05NTViLWM5NWM2OWUwODI4YyIsImV4cCI6MTc1OTYzNzk3NH0.m6kzuB854OOK2SxM3-_5DRnLXD5TzNLhbiDGf01rhOw	\N	\N	\N	\N	2025-10-05 04:19:34.118	\N	2025-09-28 04:19:34.119754	2025-09-28 04:19:34.119754
165a0f44-7a84-49cd-8b8a-52ab6dd5b362	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjE2NWEwZjQ0LTdhODQtNDljZC04YjhhLTUyYWI2ZGQ1YjM2MiIsImV4cCI6MTc1OTYzNzk4OH0.-DdvtR-pQSm8VPvbn3buW0XWhSZjW05-2xIMSF2lRuA	\N	\N	\N	\N	2025-10-05 04:19:48.307	\N	2025-09-28 04:19:48.308699	2025-09-28 04:19:48.308699
78cb519c-b49c-4f3f-8c1d-c926fd8c54c7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijc4Y2I1MTljLWI0OWMtNGYzZi04YzFkLWM5MjZmZDhjNTRjNyIsImV4cCI6MTc1OTYzODc0NX0.0DGmL3FoKoBfbXS5Sa8I6ylI7BlBvDmqeOmVKp1kOFg	\N	\N	\N	\N	2025-10-05 04:32:25.416	\N	2025-09-28 04:32:25.419414	2025-09-28 04:32:25.419414
34b606e5-2f8b-49fe-8785-97ec702bc936	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjM0YjYwNmU1LTJmOGItNDlmZS04Nzg1LTk3ZWM3MDJiYzkzNiIsImV4cCI6MTc1OTYzODc4MX0.QlzYJ08v2IRL7JqdcAQl8aUyP66gVqSe_7WX4d_GTGM	\N	\N	\N	\N	2025-10-05 04:33:01.742	\N	2025-09-28 04:33:01.744623	2025-09-28 04:33:01.744623
2acef8ee-ec53-41ec-9315-20028aa7d017	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjJhY2VmOGVlLWVjNTMtNDFlYy05MzE1LTIwMDI4YWE3ZDAxNyIsImV4cCI6MTc1OTYzODc4MX0.HOCzxYZTBzixp4wRSjPKypYq6S2gev5cEnZn8PYJYWU	\N	\N	\N	\N	2025-10-05 04:33:01.866	\N	2025-09-28 04:33:01.868251	2025-09-28 04:33:01.868251
cd0cd611-7a54-405f-8e76-7ce0252bcd08	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImNkMGNkNjExLTdhNTQtNDA1Zi04ZTc2LTdjZTAyNTJiY2QwOCIsImV4cCI6MTc1OTYzODc5Mn0.w4t3rMMtnjns96TjIQ2BsJ5jz8rh_elX85YYnKJnoX8	\N	\N	\N	\N	2025-10-05 04:33:12.466	\N	2025-09-28 04:33:12.468303	2025-09-28 04:33:12.468303
01a6bcf5-04a4-4424-a47b-e00e7bff8c13	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjAxYTZiY2Y1LTA0YTQtNDQyNC1hNDdiLWUwMGU3YmZmOGMxMyIsImV4cCI6MTc1OTYzOTAwNX0.bfSXIPBG_pcl7XVJbXPfvn6afayelxW_6sR_WmWKg_M	\N	\N	\N	\N	2025-10-05 04:36:45.367	\N	2025-09-28 04:36:45.369676	2025-09-28 04:36:45.369676
88071048-d612-427a-b58f-e3be84dfc408	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6Ijg4MDcxMDQ4LWQ2MTItNDI3YS1iNThmLWUzYmU4NGRmYzQwOCIsImV4cCI6MTc1OTYzOTAwNX0.U5pM5C230LAQWTtKlnKaiLIURnnvHo-TobsRUmnf2Ig	\N	\N	\N	\N	2025-10-05 04:36:45.488	\N	2025-09-28 04:36:45.490747	2025-09-28 04:36:45.490747
ead220f0-99dd-4841-822e-e99ed8f406e3	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImVhZDIyMGYwLTk5ZGQtNDg0MS04MjJlLWU5OWVkOGY0MDZlMyIsImV4cCI6MTc1OTYzOTA2NH0.qmEZ0QBi0fYVye2Cy2zQwsqJEeaPjI1B9Re8lc-xAsk	\N	\N	\N	\N	2025-10-05 04:37:44.515	\N	2025-09-28 04:37:44.517244	2025-09-28 04:37:44.517244
8369600a-9a6d-414f-9722-c2c0dfaa21f5	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjgzNjk2MDBhLTlhNmQtNDE0Zi05NzIyLWMyYzBkZmFhMjFmNSIsImV4cCI6MTc1OTYzOTE2NH0.TASsh0w-zkb1HcUmnyo_pP1tevA2o0o_viNXpd1rTL4	\N	\N	\N	\N	2025-10-05 04:39:24.17	\N	2025-09-28 04:39:24.172798	2025-09-28 04:39:24.172798
5235ab31-95c6-4a79-8c27-19d050fc5443	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjUyMzVhYjMxLTk1YzYtNGE3OS04YzI3LTE5ZDA1MGZjNTQ0MyIsImV4cCI6MTc1OTYzOTE2NH0.fxSNM5_DiaXrgn5JYLvrtZqaLlFBkWu5AMnt1J1lcJs	\N	\N	\N	\N	2025-10-05 04:39:24.27	\N	2025-09-28 04:39:24.272398	2025-09-28 04:39:24.272398
ddb1f967-f4a5-4b7d-83f0-c5ec3808a4cf	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImRkYjFmOTY3LWY0YTUtNGI3ZC04M2YwLWM1ZWMzODA4YTRjZiIsImV4cCI6MTc1OTYzOTE2NH0.7omMwn_ZUZEmEHDkWFyLJAaUn1h-5ZuB5_99DtS-3OY	\N	\N	\N	\N	2025-10-05 04:39:24.379	\N	2025-09-28 04:39:24.380576	2025-09-28 04:39:24.380576
5c74b276-3806-4dc0-ae07-771da229b4e4	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjVjNzRiMjc2LTM4MDYtNGRjMC1hZTA3LTc3MWRhMjI5YjRlNCIsImV4cCI6MTc1OTYzOTE4Mn0.wFGPBtVm_MiP2nn_VSjy_1_1JLvew0r_C7OyaH-cyzM	\N	\N	\N	\N	2025-10-05 04:39:42.242	\N	2025-09-28 04:39:42.244144	2025-09-28 04:39:42.244144
2920d6e9-54bb-442b-b7ee-2c654e94e8f4	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjI5MjBkNmU5LTU0YmItNDQyYi1iN2VlLTJjNjU0ZTk0ZThmNCIsImV4cCI6MTc1OTYzOTIwMH0.grtt__VeK0s79asVLlFON4_BuLkanyassl1N8HQTWRE	\N	\N	\N	\N	2025-10-05 04:40:00.449	\N	2025-09-28 04:40:00.452165	2025-09-28 04:40:00.452165
6ff1b211-3bfc-4966-9a30-487ad0852c25	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjZmZjFiMjExLTNiZmMtNDk2Ni05YTMwLTQ4N2FkMDg1MmMyNSIsImV4cCI6MTc1OTYzOTI1Mn0.4I0g5UWAfuImFD9558vb3DX73_h9SUBBZSBDnE4yL5g	\N	\N	\N	\N	2025-10-05 04:40:52.259	\N	2025-09-28 04:40:52.261095	2025-09-28 04:40:52.261095
4654a15a-d016-438c-8e46-dd13f1e1fb53	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjQ2NTRhMTVhLWQwMTYtNDM4Yy04ZTQ2LWRkMTNmMWUxZmI1MyIsImV4cCI6MTc1OTYzOTI1Mn0.XIa6rxjjPeAtD79X_kQLNe-CGjseLeADhgm2HKcAC94	\N	\N	\N	\N	2025-10-05 04:40:52.363	\N	2025-09-28 04:40:52.365202	2025-09-28 04:40:52.365202
54337f78-7518-4292-a83f-88520bcb6d53	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjU0MzM3Zjc4LTc1MTgtNDI5Mi1hODNmLTg4NTIwYmNiNmQ1MyIsImV4cCI6MTc1OTYzOTI1Mn0.rhoOZhwk1cSWhop8GzbspeaHY9IvFIQG8GCYueqiUT0	\N	\N	\N	\N	2025-10-05 04:40:52.462	\N	2025-09-28 04:40:52.463726	2025-09-28 04:40:52.463726
f7823cca-6f65-4767-8823-748f62bc9f22	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImY3ODIzY2NhLTZmNjUtNDc2Ny04ODIzLTc0OGY2MmJjOWYyMiIsImV4cCI6MTc1OTY0MTI2N30.QjPyYjOSfhrMkHYTUDiC4iA2dwyKrr1i2Hffs7Xn9BQ	\N	\N	\N	\N	2025-10-05 05:14:27.683	\N	2025-09-28 05:14:27.684798	2025-09-28 05:14:27.684798
62a4dde5-ed42-4dbf-aab9-c6863e5318c4	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjYyYTRkZGU1LWVkNDItNGRiZi1hYWI5LWM2ODYzZTUzMThjNCIsImV4cCI6MTc1OTY0MTI5MH0.5gHerWieaX0UWyLBBbgZcAjIxsvqp9s2romlFOhnkOs	\N	\N	\N	\N	2025-10-05 05:14:50.138	\N	2025-09-28 05:14:50.14027	2025-09-28 05:14:50.14027
5e9e9334-b645-4b6f-8cbf-69169a3a7015	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjVlOWU5MzM0LWI2NDUtNGI2Zi04Y2JmLTY5MTY5YTNhNzAxNSIsImV4cCI6MTc1OTY0MTQyM30.NeYVUudf8gacSxgNR_j8rtJR_yxCyUSdBsH5_dNwGH4	\N	\N	\N	\N	2025-10-05 05:17:03.005	\N	2025-09-28 05:17:03.006874	2025-09-28 05:17:03.006874
46ecbae5-d1dc-4d8c-8035-74086ddaf695	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjQ2ZWNiYWU1LWQxZGMtNGQ4Yy04MDM1LTc0MDg2ZGRhZjY5NSIsImV4cCI6MTc1OTY0MTU4NH0.2PLdEYUW__t9LwfQ5hdxyWLQziJNN_AT1353bkxfp1M	\N	\N	\N	\N	2025-10-05 05:19:44.021	\N	2025-09-28 05:19:44.023133	2025-09-28 05:19:44.023133
b14aded7-88df-4814-9040-bf4906dd3df7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImIxNGFkZWQ3LTg4ZGYtNDgxNC05MDQwLWJmNDkwNmRkM2RmNyIsImV4cCI6MTc1OTY0MjgyOX0.nnaI_ixsFMf4JuFLnrysXffq_56I9WjMuo8RYxOrMIE	\N	\N	\N	\N	2025-10-05 05:40:29.081	\N	2025-09-28 05:40:29.083889	2025-09-28 05:40:29.083889
686f468b-ddfe-453c-91cc-54ab12744bef	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjY4NmY0NjhiLWRkZmUtNDUzYy05MWNjLTU0YWIxMjc0NGJlZiIsImV4cCI6MTc1OTY0MjkxNX0.wvdHOFWvhbXwahdn42If6a3ui8aJJRfRSsfI5uhEpf4	\N	\N	\N	\N	2025-10-05 05:41:55.888	\N	2025-09-28 05:41:55.891178	2025-09-28 05:41:55.891178
3fd6e777-e008-4183-8bde-e5bcd2f1836d	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjNmZDZlNzc3LWUwMDgtNDE4My04YmRlLWU1YmNkMmYxODM2ZCIsImV4cCI6MTc1OTY0MjkxNX0.c3NGKb4yxfb-PdM_K4kOxUlpk4yerSO_vZjJvpuXH3g	\N	\N	\N	\N	2025-10-05 05:41:55.987	\N	2025-09-28 05:41:55.989773	2025-09-28 05:41:55.989773
cadf1b7c-6f18-43a6-9a22-f85e46dd9eff	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImNhZGYxYjdjLTZmMTgtNDNhNi05YTIyLWY4NWU0NmRkOWVmZiIsImV4cCI6MTc1OTY0MjkxNn0.7Cw-AuloUFTvOLVDxDFmgkS-LVsONgSmyi1DsIBJqK0	\N	\N	\N	\N	2025-10-05 05:41:56.084	\N	2025-09-28 05:41:56.086258	2025-09-28 05:41:56.086258
f3d1f282-022b-4da9-af52-c9536ec755e9	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImYzZDFmMjgyLTAyMmItNGRhOS1hZjUyLWM5NTM2ZWM3NTVlOSIsImV4cCI6MTc1OTY0MzAwMn0.Lj8yvPdj9EbdIx2jnoUtizPYspKUwUeHDCJYL5GQnf0	\N	\N	\N	\N	2025-10-05 05:43:22.368	\N	2025-09-28 05:43:22.370539	2025-09-28 05:43:22.370539
7f5c6883-78bd-4f9c-be8f-2ffcc64db4c5	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjdmNWM2ODgzLTc4YmQtNGY5Yy1iZThmLTJmZmNjNjRkYjRjNSIsImV4cCI6MTc1OTY0MzAwMn0.QPaTq837h2AWZHZ5T2z8QkMCIQt89NXJVK6sDOTmsUA	\N	\N	\N	\N	2025-10-05 05:43:22.461	\N	2025-09-28 05:43:22.463054	2025-09-28 05:43:22.463054
582c043d-175d-4710-b14f-f8f1172aaba5	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjU4MmMwNDNkLTE3NWQtNDcxMC1iMTRmLWY4ZjExNzJhYWJhNSIsImV4cCI6MTc1OTY0MzAwMn0.h8h8Tu4dVpgPG8x-PiODGjaxF8HAtyzbQHces9J-lRY	\N	\N	\N	\N	2025-10-05 05:43:22.562	\N	2025-09-28 05:43:22.564135	2025-09-28 05:43:22.564135
a83d9313-f7be-4830-8277-7a2ebb5d4ba8	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImE4M2Q5MzEzLWY3YmUtNDgzMC04Mjc3LTdhMmViYjVkNGJhOCIsImV4cCI6MTc1OTY0MzI0Mn0.Bu7li9pOoWhgcRikxqhXhmXsOwf_AQNIK07YL8AIfdc	\N	\N	\N	\N	2025-10-05 05:47:22.13	\N	2025-09-28 05:47:22.132234	2025-09-28 05:47:22.132234
b894910b-41d7-4eea-b45b-a8ad3937913e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImI4OTQ5MTBiLTQxZDctNGVlYS1iNDViLWE4YWQzOTM3OTEzZSIsImV4cCI6MTc1OTY0MzU4NH0.5ukLztrcTHud7hQb-XjI72GHfU5cqXf9td1yazyteC0	\N	\N	\N	\N	2025-10-05 05:53:04.973	\N	2025-09-28 05:53:04.97562	2025-09-28 05:53:04.97562
9b79a62c-3b51-45bb-ad54-1ba785ecd3d2	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjliNzlhNjJjLTNiNTEtNDViYi1hZDU0LTFiYTc4NWVjZDNkMiIsImV4cCI6MTc1OTY0Mzc5N30.JTE2_iqa3v3LAYHFZXFDj6qdz59PPGftYY2XervAMGA	\N	\N	\N	\N	2025-10-05 05:56:37.79	\N	2025-09-28 05:56:37.792822	2025-09-28 05:56:37.792822
a5be33e7-7156-4b16-adf0-ae7549b1e09a	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImE1YmUzM2U3LTcxNTYtNGIxNi1hZGYwLWFlNzU0OWIxZTA5YSIsImV4cCI6MTc1OTY0NDM3Mn0.fuSbxOq94ZQJnriGCW_hf4KB5WC5nwUXueYsPx1QfGk	\N	\N	\N	\N	2025-10-05 06:06:12.009	\N	2025-09-28 06:06:12.010777	2025-09-28 06:06:12.010777
044286f1-ccd3-49b6-b722-33a22aa583c6	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjA0NDI4NmYxLWNjZDMtNDliNi1iNzIyLTMzYTIyYWE1ODNjNiIsImV4cCI6MTc1OTY2Mzc4MX0.NbRgOyDLonZN6HLHfT_TXCGmWBT0juLaduIobxU7nfg	\N	\N	\N	\N	2025-10-05 11:29:41.047	\N	2025-09-28 11:29:41.048656	2025-09-28 11:29:41.048656
3c82c4fd-9aaf-45f6-b845-069333066079	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjNjODJjNGZkLTlhYWYtNDVmNi1iODQ1LTA2OTMzMzA2NjA3OSIsImV4cCI6MTc1OTY2Mzc4MX0.TSDX_Tf2QIc0m6BpsLj5O8ayEJMNKJMt5Xg-5Yv7pUA	\N	\N	\N	\N	2025-10-05 11:29:41.146	\N	2025-09-28 11:29:41.148013	2025-09-28 11:29:41.148013
e84007e6-6d40-4b49-a12d-b0c29be8d921	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImU4NDAwN2U2LTZkNDAtNGI0OS1hMTJkLWIwYzI5YmU4ZDkyMSIsImV4cCI6MTc1OTY2Mzc4MX0.3pNXVjpS0aIDVoGiJ0qDdmN3WOBBXoYtj-GVOks3tGQ	\N	\N	\N	\N	2025-10-05 11:29:41.251	\N	2025-09-28 11:29:41.251462	2025-09-28 11:29:41.251462
bdac9dfb-5578-49bd-b829-7dd7e6ea395e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImJkYWM5ZGZiLTU1NzgtNDliZC1iODI5LTdkZDdlNmVhMzk1ZSIsImV4cCI6MTc1OTY2NTUxMn0.4DZKj1JEKG1Qv70fBR_nqeqieKU0c1bIdE-pau0mLiI	\N	\N	\N	\N	2025-10-05 11:58:32.286	\N	2025-09-28 11:58:32.288323	2025-09-28 11:58:32.288323
9a1893eb-67b4-42c7-bb0b-2ffffdc9af8b	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjlhMTg5M2ViLTY3YjQtNDJjNy1iYjBiLTJmZmZmZGM5YWY4YiIsImV4cCI6MTc1OTY2NTU1NH0.10fHBapI7tvCzbbm1IFzIq4a-pl86SEBhDKYQC-n__I	\N	\N	\N	\N	2025-10-05 11:59:14.101	\N	2025-09-28 11:59:14.103252	2025-09-28 11:59:14.103252
62520689-c75b-4ca2-978e-fa7048462281	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjYyNTIwNjg5LWM3NWItNGNhMi05NzhlLWZhNzA0ODQ2MjI4MSIsImV4cCI6MTc1OTY2NTYyMH0.8_15cgncY8VGvYzV-U-3AF4Um6RNNEeqE3ac1syga68	\N	\N	\N	\N	2025-10-05 12:00:20.014	\N	2025-09-28 12:00:20.016101	2025-09-28 12:00:20.016101
c0629816-165a-4703-8897-1e38b9324664	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImMwNjI5ODE2LTE2NWEtNDcwMy04ODk3LTFlMzhiOTMyNDY2NCIsImV4cCI6MTc1OTY2NTY2NH0.cR4znl1JGbXNrdYMl65ct25WYg8235zTiyaa0IHijHk	\N	\N	\N	\N	2025-10-05 12:01:04.463	\N	2025-09-28 12:01:04.465389	2025-09-28 12:01:04.465389
c49fa05f-6036-43d8-b24b-1105b55b0262	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImM0OWZhMDVmLTYwMzYtNDNkOC1iMjRiLTExMDViNTViMDI2MiIsImV4cCI6MTc1OTY2NTc2Mn0.dkjrlOAHBKKoJLClG6_pLLvJ-GIffExcGrtttYzLkOw	\N	\N	\N	\N	2025-10-05 12:02:42.301	\N	2025-09-28 12:02:42.303952	2025-09-28 12:02:42.303952
61827a67-9e2c-43e7-8ed5-b5f0c100ed68	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjYxODI3YTY3LTllMmMtNDNlNy04ZWQ1LWI1ZjBjMTAwZWQ2OCIsImV4cCI6MTc1OTY2NTg3NX0.zHCZ9qvTbYx5Cz91aWNwjKqswllFUOLyDpbNLidJjWs	\N	\N	\N	\N	2025-10-05 12:04:35.927	\N	2025-09-28 12:04:35.928501	2025-09-28 12:04:35.928501
43c8ccc0-d819-47cc-9be8-d22df788efc7	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjQzYzhjY2MwLWQ4MTktNDdjYy05YmU4LWQyMmRmNzg4ZWZjNyIsImV4cCI6MTc1OTY2NjQ1OH0.i_dHHEDxZnFEKcOpmKgKSW9LMN5UgMyMBK4VXD-j8EE	\N	\N	\N	\N	2025-10-05 12:14:18.459	\N	2025-09-28 12:14:18.461286	2025-09-28 12:14:18.461286
fcbc30e8-2b46-4dc3-9dd8-505a8395f546	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImZjYmMzMGU4LTJiNDYtNGRjMy05ZGQ4LTUwNWE4Mzk1ZjU0NiIsImV4cCI6MTc1OTY2NjY1MH0.0v_m0A8sOM3Q1W4iTvPxr8SzQJKt9lPhezLZ17OUwEw	\N	\N	\N	\N	2025-10-05 12:17:30.041	\N	2025-09-28 12:17:30.043692	2025-09-28 12:17:30.043692
2759e532-12f2-456f-8ecd-df9667a8d878	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjI3NTllNTMyLTEyZjItNDU2Zi04ZWNkLWRmOTY2N2E4ZDg3OCIsImV4cCI6MTc1OTY2NzMyMn0.0ZvHwmWx8nPTOSfHzyRwy39fsLZDiKL7fqLscd_IOA4	\N	\N	\N	\N	2025-10-05 12:28:42.229	\N	2025-09-28 12:28:42.231082	2025-09-28 12:28:42.231082
d71bf109-e882-4586-b3a1-0080038779bd	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImQ3MWJmMTA5LWU4ODItNDU4Ni1iM2ExLTAwODAwMzg3NzliZCIsImV4cCI6MTc1OTY2NzQ5M30.8xa4vHZ-P3O38dajlbs3fqwunwLegx_Jo9h7cq1E23I	\N	\N	\N	\N	2025-10-05 12:31:33.329	\N	2025-09-28 12:31:33.331545	2025-09-28 12:31:33.331545
ad77959e-b7df-43cb-aaa2-5ed2ff072244	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImFkNzc5NTllLWI3ZGYtNDNjYi1hYWEyLTVlZDJmZjA3MjI0NCIsImV4cCI6MTc1OTY2NzQ5M30.xiSt65mKVIaOv1-cNgIv2cPsqywN3gs4EF5weNk3YQg	\N	\N	\N	\N	2025-10-05 12:31:33.461	\N	2025-09-28 12:31:33.463066	2025-09-28 12:31:33.463066
623a52bf-f78a-44b7-ae5a-d684e771c2d0	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjYyM2E1MmJmLWY3OGEtNDRiNy1hZTVhLWQ2ODRlNzcxYzJkMCIsImV4cCI6MTc1OTY2NzQ5M30.N6epLZgu_dTNTLovIgTbvv2bACy9pCDhilyHi6ZizvI	\N	\N	\N	\N	2025-10-05 12:31:33.59	\N	2025-09-28 12:31:33.591983	2025-09-28 12:31:33.591983
d59ee3a8-b909-4659-9ce3-e4604670d4e5	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImQ1OWVlM2E4LWI5MDktNDY1OS05Y2UzLWU0NjA0NjcwZDRlNSIsImV4cCI6MTc1OTY2Nzk0MX0.dVulDZdQVJkG3NsTDHfY7ZemuYWiEaKk1WxYp4XmAU0	\N	\N	\N	\N	2025-10-05 12:39:01.7	\N	2025-09-28 12:39:01.701788	2025-09-28 12:39:01.701788
c1eed57d-7c83-46cc-87a0-f29ba77afb6f	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImMxZWVkNTdkLTdjODMtNDZjYy04N2EwLWYyOWJhNzdhZmI2ZiIsImV4cCI6MTc1OTY2Nzk0NH0.CilTfOoTwhgZO2xa6YneZFUSpzURvvEolBAd4JxvFnM	\N	\N	\N	\N	2025-10-05 12:39:04.897	\N	2025-09-28 12:39:04.89841	2025-09-28 12:39:04.89841
b6f29587-98a7-44a2-9062-23ebfc6a8a11	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImI2ZjI5NTg3LTk4YTctNDRhMi05MDYyLTIzZWJmYzZhOGExMSIsImV4cCI6MTc1OTY2Nzk0OH0.FYWUBBc6HJtgrRUZ6NS2IoMQZTK7C6_2XDc98MxchM8	\N	\N	\N	\N	2025-10-05 12:39:08.023	\N	2025-09-28 12:39:08.025128	2025-09-28 12:39:08.025128
57d26bd6-f6a6-49a2-a420-90580d21b751	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjU3ZDI2YmQ2LWY2YTYtNDlhMi1hNDIwLTkwNTgwZDIxYjc1MSIsImV4cCI6MTc1OTY3MzM3N30.7zYLRK-rZONEOrtCvaRxv8eFk-5CIhbtUyyQ1l_jlL8	\N	\N	\N	\N	2025-10-05 14:09:37.742	\N	2025-09-28 14:09:37.744035	2025-09-28 14:09:37.744035
e1ce9497-8402-4843-930c-6f615adec220	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImUxY2U5NDk3LTg0MDItNDg0My05MzBjLTZmNjE1YWRlYzIyMCIsImV4cCI6MTc1OTY3MzM3N30.Pz3y1o2DCpT7SXrYbMMYlEVMjWRg2atgOb8_yuMUCyk	\N	\N	\N	\N	2025-10-05 14:09:37.835	\N	2025-09-28 14:09:37.836731	2025-09-28 14:09:37.836731
c3938d8a-5116-45ae-82ed-61f716d9ffe0	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImMzOTM4ZDhhLTUxMTYtNDVhZS04MmVkLTYxZjcxNmQ5ZmZlMCIsImV4cCI6MTc1OTY3MzQxOX0.Outqizh3jVOyKJBoaaoQY7x05_1S0sAh8J4ZKaefXFw	\N	\N	\N	\N	2025-10-05 14:10:19.839	\N	2025-09-28 14:10:19.84226	2025-09-28 14:10:19.84226
071ee115-065f-4eb9-8a18-6a013294139e	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjA3MWVlMTE1LTA2NWYtNGViOS04YTE4LTZhMDEzMjk0MTM5ZSIsImV4cCI6MTc1OTY3MzUwN30.lQkO_3im9_iEKRe3Zkf3hw579OJj_sf0MoNSjJFY_xk	\N	\N	\N	\N	2025-10-05 14:11:47.068	\N	2025-09-28 14:11:47.069841	2025-09-28 14:11:47.069841
e758fcbd-0c9c-420e-b412-f300005cba6a	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImU3NThmY2JkLTBjOWMtNDIwZS1iNDEyLWYzMDAwMDVjYmE2YSIsImV4cCI6MTc1OTY3MzUwN30.tbI2OiM6lAy1yI6O_5-zDHeSRJh1Mm5d3sAeh-Hhgis	\N	\N	\N	\N	2025-10-05 14:11:47.166	\N	2025-09-28 14:11:47.168132	2025-09-28 14:11:47.168132
82886f49-8373-4d9e-b732-aa855c17a08b	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjgyODg2ZjQ5LTgzNzMtNGQ5ZS1iNzMyLWFhODU1YzE3YTA4YiIsImV4cCI6MTc1OTY3NzYzN30.yEsSJjXAeRmL7Y5FQYiQFdDHEvFwgV9nG1zkdojIm4w	\N	\N	\N	\N	2025-10-05 15:20:37.952	\N	2025-09-28 15:20:37.954024	2025-09-28 15:20:37.954024
ceacca47-9b23-404e-a264-0580a5493f90	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImNlYWNjYTQ3LTliMjMtNDA0ZS1hMjY0LTA1ODBhNTQ5M2Y5MCIsImV4cCI6MTc1OTY3OTI5OH0._prBdf9VcLnWrLOOXeG7Kgpd50beEFpPG3HZbwnlHSI	\N	\N	\N	\N	2025-10-05 15:48:18.589	\N	2025-09-28 15:48:18.591123	2025-09-28 15:48:18.591123
1c2f7e02-3cc8-4580-8984-ca28cf8d65d8	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjFjMmY3ZTAyLTNjYzgtNDU4MC04OTg0LWNhMjhjZjhkNjVkOCIsImV4cCI6MTc1OTY3OTMyMn0.k1nT1gZ9eI4r01ALuzOYYUOBkFDPkt8TUcemZmKlmYE	\N	\N	\N	\N	2025-10-05 15:48:42.899	\N	2025-09-28 15:48:42.900896	2025-09-28 15:48:42.900896
ee975db7-7449-4a1e-adba-9e22a8f2621a	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImVlOTc1ZGI3LTc0NDktNGExZS1hZGJhLTllMjJhOGYyNjIxYSIsImV4cCI6MTc1OTY3OTU3Mn0.4owoMfCM-eEH8Z4JyC44TWMysguUjFTkXvFxd53vlsk	\N	\N	\N	\N	2025-10-05 15:52:52.992	\N	2025-09-28 15:52:52.99405	2025-09-28 15:52:52.99405
c3a7ddc8-2bbb-456b-8d07-107f9e680e6c	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImMzYTdkZGM4LTJiYmItNDU2Yi04ZDA3LTEwN2Y5ZTY4MGU2YyIsImV4cCI6MTc1OTY3OTU3M30.yLcWAH3-daf_WxV4HK-auY-Bo8BLVq58v-NNzoRXSrw	\N	\N	\N	\N	2025-10-05 15:52:53.13	\N	2025-09-28 15:52:53.132323	2025-09-28 15:52:53.132323
241fbf8a-e615-4d3e-9f57-af4e605a3b4b	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjI0MWZiZjhhLWU2MTUtNGQzZS05ZjU3LWFmNGU2MDVhM2I0YiIsImV4cCI6MTc1OTY3OTU3M30.E6QbSOlB8VeDFin5ggyUFOv8q9ISsUT3m-7rC14n2PU	\N	\N	\N	\N	2025-10-05 15:52:53.258	\N	2025-09-28 15:52:53.259808	2025-09-28 15:52:53.259808
f03f13f8-368c-4c42-89ab-2cd769e56851	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImYwM2YxM2Y4LTM2OGMtNGM0Mi04OWFiLTJjZDc2OWU1Njg1MSIsImV4cCI6MTc1OTY3OTU3M30.hzbt6qLIm-mAi9ioz73yNY2GV5tpXuv_XvtuX9iY9s4	\N	\N	\N	\N	2025-10-05 15:52:53.472	\N	2025-09-28 15:52:53.474254	2025-09-28 15:52:53.474254
f12f6895-2be0-4460-8387-dcf6d25c9365	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImYxMmY2ODk1LTJiZTAtNDQ2MC04Mzg3LWRjZjZkMjVjOTM2NSIsImV4cCI6MTc1OTY4MDEwNX0.U70YOjceB-A10CU5S7-9rGEnxIogIafMSo4lW8DvhfA	\N	\N	\N	\N	2025-10-05 16:01:45.602	\N	2025-09-28 16:01:45.604365	2025-09-28 16:01:45.604365
d87f01b2-0540-462a-850e-fca3840bb68b	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImQ4N2YwMWIyLTA1NDAtNDYyYS04NTBlLWZjYTM4NDBiYjY4YiIsImV4cCI6MTc1OTY4MDEwOH0.vU-AaasTtmYWlKJ4fwdTanNWccRnGSKI5WVg_gtvRZc	\N	\N	\N	\N	2025-10-05 16:01:48.804	\N	2025-09-28 16:01:48.805942	2025-09-28 16:01:48.805942
2d6c0dbc-e832-408a-93ed-b17c691a0e0d	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjJkNmMwZGJjLWU4MzItNDA4YS05M2VkLWIxN2M2OTFhMGUwZCIsImV4cCI6MTc1OTY4MDExMX0.fqrNh8HhyA3UqUTbVT-RELcaMCCfjGcsw3Zv0yAIfP0	\N	\N	\N	\N	2025-10-05 16:01:51.934	\N	2025-09-28 16:01:51.936305	2025-09-28 16:01:51.936305
8883cc56-1452-4d13-b658-78c1eafc96c2	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6Ijg4ODNjYzU2LTE0NTItNGQxMy1iNjU4LTc4YzFlYWZjOTZjMiIsImV4cCI6MTc1OTY4MDI5M30.SJ4GLjs5UMyOPmbuZbVlV14yoK55hVvB0CQSrGPPeBg	\N	\N	\N	\N	2025-10-05 16:04:53.616	\N	2025-09-28 16:04:53.617957	2025-09-28 16:04:53.617957
0aab28ef-b12b-4182-b34c-94fcba2ce04f	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjBhYWIyOGVmLWIxMmItNDE4Mi1iMzRjLTk0ZmNiYTJjZTA0ZiIsImV4cCI6MTc1OTY4MDI5M30.rNGqc3K0ZDaqBEmaW00DyOxm403LR4h-Sw2q4qQ3OYg	\N	\N	\N	\N	2025-10-05 16:04:53.81	\N	2025-09-28 16:04:53.81238	2025-09-28 16:04:53.81238
74c9a6be-3592-4235-a424-5c5c713a23ec	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijc0YzlhNmJlLTM1OTItNDIzNS1hNDI0LTVjNWM3MTNhMjNlYyIsImV4cCI6MTc1OTY4MDMxN30.c5UsO69DU4H1Accz9HZYEH-MeB7TuvawhsB1CtCCBGY	\N	\N	\N	\N	2025-10-05 16:05:17.553	\N	2025-09-28 16:05:17.555047	2025-09-28 16:05:17.555047
c684c893-cc44-4b08-ab41-6dd6536ccbc2	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM2ODRjODkzLWNjNDQtNGIwOC1hYjQxLTZkZDY1MzZjY2JjMiIsImV4cCI6MTc1OTY4MDQzNn0.1ibED77oBoGTQd0_isZSURXY2y5dGBnGr9GNI0X1P3I	\N	\N	\N	\N	2025-10-05 16:07:16.688	\N	2025-09-28 16:07:16.690403	2025-09-28 16:07:16.690403
eb5e11ea-400c-4e8b-9777-2d48cf1c59b3	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImViNWUxMWVhLTQwMGMtNGU4Yi05Nzc3LTJkNDhjZjFjNTliMyIsImV4cCI6MTc1OTY4MDQzNn0.1GbyHsm0IjKdCFs6zP25TvWf3b7cVC68-L8utmvTGbg	\N	\N	\N	\N	2025-10-05 16:07:16.946	\N	2025-09-28 16:07:16.947129	2025-09-28 16:07:16.947129
bd18a064-2805-4558-886b-0d9fc75e0bdd	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImJkMThhMDY0LTI4MDUtNDU1OC04ODZiLTBkOWZjNzVlMGJkZCIsImV4cCI6MTc1OTY4MDQzN30.lNSwvZubd0PmkwhQBtTpRQMMuILONO94bsJY-HfBxYY	\N	\N	\N	\N	2025-10-05 16:07:17.09	\N	2025-09-28 16:07:17.092122	2025-09-28 16:07:17.092122
54dfe032-91d0-48ac-a46e-226bbe0ef294	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjU0ZGZlMDMyLTkxZDAtNDhhYy1hNDZlLTIyNmJiZTBlZjI5NCIsImV4cCI6MTc1OTY4MDQ4Nn0.iHbcAngwZoIXOcOkO9Fibaw-sFsy1uo4J71RJV32tM4	\N	\N	\N	\N	2025-10-05 16:08:06.019	\N	2025-09-28 16:08:06.021185	2025-09-28 16:08:06.021185
5ec23fc7-4fd5-4eba-9d1d-a757a4f58977	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjVlYzIzZmM3LTRmZDUtNGViYS05ZDFkLWE3NTdhNGY1ODk3NyIsImV4cCI6MTc1OTY4MDQ4Nn0.WE1BCDvlZRkLpnmUWkfCoyzPEn2g9VRZ674Y71sLDJg	\N	\N	\N	\N	2025-10-05 16:08:06.271	\N	2025-09-28 16:08:06.272778	2025-09-28 16:08:06.272778
cd07a578-adac-48e8-9380-c218043526ab	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImNkMDdhNTc4LWFkYWMtNDhlOC05MzgwLWMyMTgwNDM1MjZhYiIsImV4cCI6MTc1OTY4MDQ4Nn0.8lfkN7CCktu8rVQJf4zDRBKUbIAmUC9vwnVugimq1N8	\N	\N	\N	\N	2025-10-05 16:08:06.406	\N	2025-09-28 16:08:06.407689	2025-09-28 16:08:06.407689
c4981e01-3022-46f9-a481-ac12f99615a8	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImM0OTgxZTAxLTMwMjItNDZmOS1hNDgxLWFjMTJmOTk2MTVhOCIsImV4cCI6MTc1OTY4MDQ5MX0.RtjJp4UsxIrmz22obsKiGQHhW1QsKZdP8DO_DPi5jFo	\N	\N	\N	\N	2025-10-05 16:08:11.393	\N	2025-09-28 16:08:11.394878	2025-09-28 16:08:11.394878
a547c8e6-3cbd-4829-acd8-a17c4dfbe8c8	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImE1NDdjOGU2LTNjYmQtNDgyOS1hY2Q4LWExN2M0ZGZiZThjOCIsImV4cCI6MTc1OTY4MDU2N30.Zz-0iqCUvl6BVHJT189zNGkC7RzhbSLEmPob34kZQLs	\N	\N	\N	\N	2025-10-05 16:09:27.85	\N	2025-09-28 16:09:27.851837	2025-09-28 16:09:27.851837
bb6ccc48-f36b-4a7c-9c23-2ea6df5a398b	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImJiNmNjYzQ4LWYzNmItNGE3Yy05YzIzLTJlYTZkZjVhMzk4YiIsImV4cCI6MTc1OTY4MDU2OH0.QRG4L5YEJuPz3Shvhd_YlAWf04XFIokjAx7_ArD58wc	\N	\N	\N	\N	2025-10-05 16:09:28.101	\N	2025-09-28 16:09:28.10382	2025-09-28 16:09:28.10382
eeac9e13-ea9c-46c3-9c84-b6d20aa3fca8	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImVlYWM5ZTEzLWVhOWMtNDZjMy05Yzg0LWI2ZDIwYWEzZmNhOCIsImV4cCI6MTc1OTY4MDU2OH0.ihKSrcsHkNiHxg_t62cu4UzrnpsRO6YBQOT292xHMwo	\N	\N	\N	\N	2025-10-05 16:09:28.248	\N	2025-09-28 16:09:28.249609	2025-09-28 16:09:28.249609
b1133a53-3924-4c77-9dc9-7cef0944872c	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImIxMTMzYTUzLTM5MjQtNGM3Ny05ZGM5LTdjZWYwOTQ0ODcyYyIsImV4cCI6MTc1OTY4MDU3Mn0.W-VK5JKzEtXbh8cq6COlDs2txvZB5SgyOpQWR95K3PY	\N	\N	\N	\N	2025-10-05 16:09:32.251	\N	2025-09-28 16:09:32.252965	2025-09-28 16:09:32.252965
65f6394b-592e-4d88-9045-17df039e71ac	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjY1ZjYzOTRiLTU5MmUtNGQ4OC05MDQ1LTE3ZGYwMzllNzFhYyIsImV4cCI6MTc1OTY4MDU3Mn0.9uiMDnFIzgodnRklDoG6QhQBkyS1FhPdRUr3jIfyAzs	\N	\N	\N	\N	2025-10-05 16:09:32.505	\N	2025-09-28 16:09:32.506629	2025-09-28 16:09:32.506629
7e642b90-ca92-429a-8bee-c9a0f5d7dec0	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjdlNjQyYjkwLWNhOTItNDI5YS04YmVlLWM5YTBmNWQ3ZGVjMCIsImV4cCI6MTc1OTY4MDU3Mn0.3SmlwkQsUcaQsizS2oyDIYAtDHeLSZvtYYEQQJ8SWTc	\N	\N	\N	\N	2025-10-05 16:09:32.628	\N	2025-09-28 16:09:32.630261	2025-09-28 16:09:32.630261
aeccc99c-09cb-42df-b175-5a9abe3ce438	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImFlY2NjOTljLTA5Y2ItNDJkZi1iMTc1LTVhOWFiZTNjZTQzOCIsImV4cCI6MTc1OTY4MDcyN30.A2ozBroYvc58VSIn8ay8GjhBf_iK33POQHtSdXIZKA0	\N	\N	\N	\N	2025-10-05 16:12:07.653	\N	2025-09-28 16:12:07.654744	2025-09-28 16:12:07.654744
1b45fac8-4fb6-4ca6-bbf5-3cefdba60b22	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjFiNDVmYWM4LTRmYjYtNGNhNi1iYmY1LTNjZWZkYmE2MGIyMiIsImV4cCI6MTc1OTY4MDcyN30._kAl37Z_Cm3k4RARI2MWG-4FK8WX7u34HG25xQTVGMA	\N	\N	\N	\N	2025-10-05 16:12:07.84	\N	2025-09-28 16:12:07.842137	2025-09-28 16:12:07.842137
ebe67bdc-c00c-4b0d-8a42-b0273ba5a6bd	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImViZTY3YmRjLWMwMGMtNGIwZC04YTQyLWIwMjczYmE1YTZiZCIsImV4cCI6MTc1OTY4MDc3MX0.Ceb_PoMF_tmYgBXaLeFh5sRkM_3HKtnzU8IUCIGfCsY	\N	\N	\N	\N	2025-10-05 16:12:51.537	\N	2025-09-28 16:12:51.539124	2025-09-28 16:12:51.539124
b63052cb-4119-44ec-8638-d03c79e702ba	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImI2MzA1MmNiLTQxMTktNDRlYy04NjM4LWQwM2M3OWU3MDJiYSIsImV4cCI6MTc1OTY4MDc3MX0.RP917HuLtus_NPEMGT0G4e-QSPjxsBqEP0deHmfWLDg	\N	\N	\N	\N	2025-10-05 16:12:51.729	\N	2025-09-28 16:12:51.731093	2025-09-28 16:12:51.731093
075a616d-17de-4064-90fd-5e7179094744	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjA3NWE2MTZkLTE3ZGUtNDA2NC05MGZkLTVlNzE3OTA5NDc0NCIsImV4cCI6MTc1OTY4MDc5MX0.lQxuEMfmjauy48eSin7uRO_hyUomf8DfN9OChfBQgHM	\N	\N	\N	\N	2025-10-05 16:13:11.163	\N	2025-09-28 16:13:11.165177	2025-09-28 16:13:11.165177
aa4565a6-5d1b-4eb8-b639-4b3a94705046	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImFhNDU2NWE2LTVkMWItNGViOC1iNjM5LTRiM2E5NDcwNTA0NiIsImV4cCI6MTc1OTY4MDc5MX0.AH34DEx5NZO4e_PsJG0rA5TYDR4OO3POQZwvZAWoTnc	\N	\N	\N	\N	2025-10-05 16:13:11.551	\N	2025-09-28 16:13:11.553099	2025-09-28 16:13:11.553099
47a0e159-782f-4722-beba-3c905b0a60b9	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjQ3YTBlMTU5LTc4MmYtNDcyMi1iZWJhLTNjOTA1YjBhNjBiOSIsImV4cCI6MTc1OTY4MDk0MH0.roId3Ia6RSZosYXuGp-DfjSa7nVr1hnLdDZEk9CHQ-w	\N	\N	\N	\N	2025-10-05 16:15:40.393	\N	2025-09-28 16:15:40.395379	2025-09-28 16:15:40.395379
8f171d40-a9bf-4d38-9937-24f579f6f6b7	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjhmMTcxZDQwLWE5YmYtNGQzOC05OTM3LTI0ZjU3OWY2ZjZiNyIsImV4cCI6MTc1OTY4MDk0MH0.z-ZRrYERQ8G626kUVHfoMo8FuGP0o3swL578vN8bhzk	\N	\N	\N	\N	2025-10-05 16:15:40.605	\N	2025-09-28 16:15:40.606946	2025-09-28 16:15:40.606946
98f9ba7c-bb14-466c-af17-1cb8b6dddf2a	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijk4ZjliYTdjLWJiMTQtNDY2Yy1hZjE3LTFjYjhiNmRkZGYyYSIsImV4cCI6MTc1OTY4MDk3OX0.qctg2QopW2EuiX1EFzREQLdj4HfwB_7sHjfpvh_x2dg	\N	\N	\N	\N	2025-10-05 16:16:19.144	\N	2025-09-28 16:16:19.146262	2025-09-28 16:16:19.146262
527c0144-a1a6-45b2-b1a0-4cb564c101f8	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjUyN2MwMTQ0LWExYTYtNDViMi1iMWEwLTRjYjU2NGMxMDFmOCIsImV4cCI6MTc1OTY4MDk3OX0.d-vRlqsmoMtZtnTNAlTO7CCyLqPBFDEbw4CpqByBl5g	\N	\N	\N	\N	2025-10-05 16:16:19.271	\N	2025-09-28 16:16:19.273207	2025-09-28 16:16:19.273207
fff73553-8308-407a-a21e-bbcd66379ea5	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImZmZjczNTUzLTgzMDgtNDA3YS1hMjFlLWJiY2Q2NjM3OWVhNSIsImV4cCI6MTc1OTY4MDk3OX0.8wlCTfYTy1ZrZOnw-aZfHC3alBqUe5PqbBsFooAbA_w	\N	\N	\N	\N	2025-10-05 16:16:19.409	\N	2025-09-28 16:16:19.410642	2025-09-28 16:16:19.410642
f19d0726-004f-449d-90ad-c6f2c575cf53	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImYxOWQwNzI2LTAwNGYtNDQ5ZC05MGFkLWM2ZjJjNTc1Y2Y1MyIsImV4cCI6MTc1OTY4MDk3OX0.3zWhL0jrWK3UN433GKLT86Yb4TMhi69wyEJWo_tn99w	\N	\N	\N	\N	2025-10-05 16:16:19.648	\N	2025-09-28 16:16:19.649504	2025-09-28 16:16:19.649504
dc0c6590-8568-4b31-bb64-ecd07840e603	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImRjMGM2NTkwLTg1NjgtNGIzMS1iYjY0LWVjZDA3ODQwZTYwMyIsImV4cCI6MTc1OTY4MDk4MH0.nB9ozS-7pTHnAttemnBaM9V0Thsvo-trJl8J09hJiwg	\N	\N	\N	\N	2025-10-05 16:16:20.51	\N	2025-09-28 16:16:20.512555	2025-09-28 16:16:20.512555
4f9b8bb9-4b2f-4ad6-bc9b-8f7c6bfd801e	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjRmOWI4YmI5LTRiMmYtNGFkNi1iYzliLThmN2M2YmZkODAxZSIsImV4cCI6MTc1OTY4MDk4MH0.mJ1lT4mzMkuFgeBdnpmGyQ3xhrY5ZQGRrR68M0-uX9w	\N	\N	\N	\N	2025-10-05 16:16:20.753	\N	2025-09-28 16:16:20.754679	2025-09-28 16:16:20.754679
9564a6ad-307a-489c-a304-e0c97ca63cdc	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6Ijk1NjRhNmFkLTMwN2EtNDg5Yy1hMzA0LWUwYzk3Y2E2M2NkYyIsImV4cCI6MTc1OTY4MDk4MH0.VVERqUuVaLZvNiiVyEidl3bNJoqOQVzgOAqY3XzvYDQ	\N	\N	\N	\N	2025-10-05 16:16:20.916	\N	2025-09-28 16:16:20.918422	2025-09-28 16:16:20.918422
e464ff35-f51e-4442-bc78-84b04c272056	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6ImU0NjRmZjM1LWY1MWUtNDQ0Mi1iYzc4LTg0YjA0YzI3MjA1NiIsImV4cCI6MTc1OTY4MDk4NH0.vRF_zsrqKUwnWs1-kT1wgyzoCVIvrrvjK-V3pUBiTEE	\N	\N	\N	\N	2025-10-05 16:16:24.058	\N	2025-09-28 16:16:24.059501	2025-09-28 16:16:24.059501
ddd74c4e-a6a3-409f-94c4-d644af3629da	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImRkZDc0YzRlLWE2YTMtNDA5Zi05NGM0LWQ2NDRhZjM2MjlkYSIsImV4cCI6MTc1OTY4MDk4N30.cu8Z6JMsEmrgAEHwqneIrP7gEsd9jRxgI3AZk_F3POM	\N	\N	\N	\N	2025-10-05 16:16:27.244	\N	2025-09-28 16:16:27.246231	2025-09-28 16:16:27.246231
5c2c1bde-cac9-446b-a1c6-bc1f8f323064	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjVjMmMxYmRlLWNhYzktNDQ2Yi1hMWM2LWJjMWY4ZjMyMzA2NCIsImV4cCI6MTc1OTY4MDk5MH0.HXMlorX5R7BlSIBt7THhwx-PB8X8xr2Zz71OR1pU2ao	\N	\N	\N	\N	2025-10-05 16:16:30.371	\N	2025-09-28 16:16:30.373182	2025-09-28 16:16:30.373182
3de4d017-4fdc-4061-bcc9-4acc5d3d0e96	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjNkZTRkMDE3LTRmZGMtNDA2MS1iY2M5LTRhY2M1ZDNkMGU5NiIsImV4cCI6MTc1OTY4MDk5MX0.ct92J1IX_iGYxjpI_syqdjd_YNekfa0dGrg7b75RaZM	\N	\N	\N	\N	2025-10-05 16:16:31.518	\N	2025-09-28 16:16:31.520245	2025-09-28 16:16:31.520245
8f4db934-b54f-4ec9-87ae-46da5e9e672b	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjhmNGRiOTM0LWI1NGYtNGVjOS04N2FlLTQ2ZGE1ZTllNjcyYiIsImV4cCI6MTc1OTY4MDk5MX0.ai_AmihgVCDKlnFfIjRpjl7Z2lTAlt64H9NDdUr3XLo	\N	\N	\N	\N	2025-10-05 16:16:31.623	\N	2025-09-28 16:16:31.624779	2025-09-28 16:16:31.624779
d11cc72d-efe3-4306-abca-f4710bb0b352	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6ImQxMWNjNzJkLWVmZTMtNDMwNi1hYmNhLWY0NzEwYmIwYjM1MiIsImV4cCI6MTc1OTY4MDk5MX0.ivpZsfocfe2jHOCBBGCFILaTyHGjSnoRVeaIXFnWunE	\N	\N	\N	\N	2025-10-05 16:16:31.722	\N	2025-09-28 16:16:31.724142	2025-09-28 16:16:31.724142
dd6ac784-0300-4b5f-8711-357dbe1c77a5	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImRkNmFjNzg0LTAzMDAtNGI1Zi04NzExLTM1N2RiZTFjNzdhNSIsImV4cCI6MTc1OTY4MDk5Mn0.1buVbVjFgTxOoQJ6wEQC4OJQ9JZ2XOkVGP5sYvoE2SY	\N	\N	\N	\N	2025-10-05 16:16:32.243	\N	2025-09-28 16:16:32.244851	2025-09-28 16:16:32.244851
d0896669-3544-455f-8bf9-cc3a8fe32412	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6ImQwODk2NjY5LTM1NDQtNDU1Zi04YmY5LWNjM2E4ZmUzMjQxMiIsImV4cCI6MTc1OTY4MDk5Mn0.h53EmpRILF7EJNuPsNwH0um-ovtfGvmlv6S8BMBMwi0	\N	\N	\N	\N	2025-10-05 16:16:32.394	\N	2025-09-28 16:16:32.396116	2025-09-28 16:16:32.396116
3b826154-ecfb-4a52-8464-d151cf7dc273	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjNiODI2MTU0LWVjZmItNGE1Mi04NDY0LWQxNTFjZjdkYzI3MyIsImV4cCI6MTc1OTY4MDk5Mn0.NqKx2AX7qOmaKJEXrR4fJqWpcvXQRjiYZw2AAW09gEI	\N	\N	\N	\N	2025-10-05 16:16:32.645	\N	2025-09-28 16:16:32.646966	2025-09-28 16:16:32.646966
09b07d25-e531-465f-9699-adb3b9072a1e	1003	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDMsInNlc3Npb25JZCI6IjA5YjA3ZDI1LWU1MzEtNDY1Zi05Njk5LWFkYjNiOTA3MmExZSIsImV4cCI6MTc1OTY4MDk5Mn0.MbFQemQUXkdfmoKAr5zrIrLjAYPakRoa-g4QZVBA134	\N	\N	\N	\N	2025-10-05 16:16:32.789	\N	2025-09-28 16:16:32.790809	2025-09-28 16:16:32.790809
1c636163-452d-4004-aef9-d514d664fd12	1001	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInNlc3Npb25JZCI6IjFjNjM2MTYzLTQ1MmQtNDAwNC1hZWY5LWQ1MTRkNjY0ZmQxMiIsImV4cCI6MTc1OTY4MDk5Mn0.QPTTrnb3Ibqh2k3mE259qm7b5U6ynUONPIPQe51IG_M	\N	\N	\N	\N	2025-10-05 16:16:32.933	\N	2025-09-28 16:16:32.935229	2025-09-28 16:16:32.935229
1bf4ad7b-7b4f-4d0d-8fa9-87d39ff79aac	1002	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDIsInNlc3Npb25JZCI6IjFiZjRhZDdiLTdiNGYtNGQwZC04ZmE5LTg3ZDM5ZmY3OWFhYyIsImV4cCI6MTc1OTY4MDk5M30.YXZ6S7TFQDBTeg5ZXihUbpZ-EmDrbBIWP69rs3rVqb8	\N	\N	\N	\N	2025-10-05 16:16:33.145	\N	2025-09-28 16:16:33.14709	2025-09-28 16:16:33.14709
89b96d4c-7172-49bf-a2b1-af990fcabf7f	1004	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDQsInNlc3Npb25JZCI6Ijg5Yjk2ZDRjLTcxNzItNDliZi1hMmIxLWFmOTkwZmNhYmY3ZiIsImV4cCI6MTc1OTY4OTM4MH0.3y8s7BVDcjmSs5tf5iu9EgMrXB_tJYqEoV7CVLa9hlM	\N	\N	\N	\N	2025-10-05 18:36:20.606	\N	2025-09-28 18:36:20.608093	2025-09-28 18:36:20.608093
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, user_id, type, amount, currency, stripe_payment_intent_id, stripe_invoice_id, status, description, metadata, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: typing_indicators; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.typing_indicators (id, user_id, conversation_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_credits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_credits (id, user_id, balance, total_purchased, total_used, last_updated) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, username, password_hash, user_type, first_name, last_name, phone, location, bio, profile_image_url, company_name, company_number, company_website, company_address, email_verified, email_verification_token, email_verified_at, company_verified, is_active, failed_login_attempts, account_locked_at, account_lock_reason, last_password_change_at, password_history, require_password_change, two_factor_enabled, subscription_tier, subscription_start_date, subscription_end_date, stripe_customer_id, stripe_subscription_id, last_login_at, created_at, updated_at) FROM stdin;
1003	stellar.production@demo.com	stellarproduction	$2a$10$NP9.PhPlKksQ7WJlDzsmyeqOa6x4TBYOjW2DcWcmfq/6X8py5ruVG	production	Stellar	Productions	\N	\N	Full-service production company bringing stories to life	\N	Stellar Production House	\N	\N	\N	t	\N	\N	f	t	0	\N	\N	\N	[]	f	f	free	\N	\N	\N	\N	2025-09-28 16:16:32.775	2025-09-24 19:57:32.506372	2025-09-24 19:57:32.506372
1001	alex.creator@demo.com	alexcreator	$2a$10$NP9.PhPlKksQ7WJlDzsmyeqOa6x4TBYOjW2DcWcmfq/6X8py5ruVG	creator	Alex	Filmmaker	\N	\N	Award-winning independent filmmaker with a passion for storytelling	\N	Independent Films	\N	\N	\N	t	\N	\N	f	t	0	\N	\N	\N	[]	f	f	free	\N	\N	\N	\N	2025-09-28 16:16:32.92	2025-09-24 19:57:32.496165	2025-09-24 19:57:32.496165
1002	sarah.investor@demo.com	sarahinvestor	$2a$10$NP9.PhPlKksQ7WJlDzsmyeqOa6x4TBYOjW2DcWcmfq/6X8py5ruVG	investor	Sarah	Investor	\N	\N	Investing in the future of cinema	\N	Venture Capital Films	\N	\N	\N	t	\N	\N	f	t	0	\N	\N	\N	[]	f	f	free	\N	\N	\N	\N	2025-09-28 16:16:33.132	2025-09-24 19:57:32.505419	2025-09-24 19:57:32.505419
1004	test_creator_msg@example.com	test_creator_msg	$2a$10$4qXFJa2vDLlwzXZA/N8RgeeN6s9Y7PykaqPhKlLGebExMpqKsTuoq	creator	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	9a3fd4ca-7b6d-4127-872d-f894bf249f80	\N	f	t	0	\N	\N	\N	[]	f	f	free	\N	\N	\N	\N	\N	2025-09-28 18:36:20.591068	2025-09-28 18:36:20.591068
4	alice@example.com	alice	$2a$10$KpGTvLVt/3vz3pk1yHhQZuUg5U15fzDY6AwHT2ADr0YxtGLNQd4G6	creator	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	749fa9be-848c-4384-8f32-b45adadd329b	\N	f	t	0	\N	\N	\N	[]	f	f	free	\N	\N	\N	\N	2025-09-24 19:49:00.39	2025-09-24 19:45:53.163824	2025-09-24 19:45:53.163824
\.


--
-- Data for Name: watchlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.watchlist (id, user_id, pitch_id, notes, priority, created_at, updated_at) FROM stdin;
10	1002	38	Test watchlist item	normal	2025-09-28 05:38:18.252382+00	2025-09-28 05:38:18.252382+00
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 2, true);


--
-- Name: analytics_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.analytics_events_id_seq', 8, true);


--
-- Name: analytics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.analytics_id_seq', 1, false);


--
-- Name: conversation_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conversation_participants_id_seq', 28, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.conversations_id_seq', 14, true);


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.credit_transactions_id_seq', 1, false);


--
-- Name: database_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.database_alerts_id_seq', 1, false);


--
-- Name: email_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_preferences_id_seq', 1, false);


--
-- Name: email_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_queue_id_seq', 1, false);


--
-- Name: follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.follows_id_seq', 15, true);


--
-- Name: maintenance_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maintenance_log_id_seq', 1, false);


--
-- Name: message_read_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.message_read_receipts_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.messages_id_seq', 4, true);


--
-- Name: nda_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nda_requests_id_seq', 17, true);


--
-- Name: ndas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ndas_id_seq', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 13, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: pitch_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pitch_likes_id_seq', 1, false);


--
-- Name: pitch_saves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pitch_saves_id_seq', 1, false);


--
-- Name: pitch_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pitch_views_id_seq', 21, true);


--
-- Name: pitches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pitches_id_seq', 66, true);


--
-- Name: portfolio_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.portfolio_id_seq', 1, false);


--
-- Name: security_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.security_events_id_seq', 316, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, false);


--
-- Name: typing_indicators_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.typing_indicators_id_seq', 1, false);


--
-- Name: user_credits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_credits_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1004, true);


--
-- Name: watchlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.watchlist_id_seq', 15, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: analytics analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: database_alerts database_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_alerts
    ADD CONSTRAINT database_alerts_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_user_id_key UNIQUE (user_id);


--
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- Name: follows follows_follower_creator_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_creator_unique UNIQUE (follower_id, creator_id);


--
-- Name: follows follows_follower_pitch_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_pitch_unique UNIQUE (follower_id, pitch_id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: maintenance_log maintenance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_log
    ADD CONSTRAINT maintenance_log_pkey PRIMARY KEY (id);


--
-- Name: message_read_receipts message_read_receipts_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- Name: message_read_receipts message_read_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: nda_requests nda_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nda_requests
    ADD CONSTRAINT nda_requests_pkey PRIMARY KEY (id);


--
-- Name: ndas ndas_pitch_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas
    ADD CONSTRAINT ndas_pitch_id_user_id_key UNIQUE (pitch_id, user_id);


--
-- Name: ndas ndas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas
    ADD CONSTRAINT ndas_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pitch_likes pitch_likes_pitch_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_likes
    ADD CONSTRAINT pitch_likes_pitch_id_user_id_key UNIQUE (pitch_id, user_id);


--
-- Name: pitch_likes pitch_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_likes
    ADD CONSTRAINT pitch_likes_pkey PRIMARY KEY (id);


--
-- Name: pitch_saves pitch_saves_pitch_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_saves
    ADD CONSTRAINT pitch_saves_pitch_id_user_id_key UNIQUE (pitch_id, user_id);


--
-- Name: pitch_saves pitch_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_saves
    ADD CONSTRAINT pitch_saves_pkey PRIMARY KEY (id);


--
-- Name: pitch_views pitch_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_views
    ADD CONSTRAINT pitch_views_pkey PRIMARY KEY (id);


--
-- Name: pitches pitches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_pkey PRIMARY KEY (id);


--
-- Name: portfolio portfolio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio
    ADD CONSTRAINT portfolio_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_key UNIQUE (refresh_token);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: typing_indicators typing_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_pkey PRIMARY KEY (id);


--
-- Name: user_credits user_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_pkey PRIMARY KEY (id);


--
-- Name: user_credits user_credits_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: watchlist watchlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_pkey PRIMARY KEY (id);


--
-- Name: watchlist watchlist_user_id_pitch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_user_id_pitch_id_key UNIQUE (user_id, pitch_id);


--
-- Name: follows_creator_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_creator_id_idx ON public.follows USING btree (creator_id);


--
-- Name: follows_followed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_followed_at_idx ON public.follows USING btree (followed_at);


--
-- Name: follows_follower_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_follower_id_idx ON public.follows USING btree (follower_id);


--
-- Name: follows_pitch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_pitch_id_idx ON public.follows USING btree (pitch_id);


--
-- Name: idx_analytics_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_event_type ON public.analytics USING btree (event_type);


--
-- Name: idx_analytics_events_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_id ON public.analytics_events USING btree (event_id);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);


--
-- Name: idx_analytics_events_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_pitch_id ON public.analytics_events USING btree (pitch_id);


--
-- Name: idx_analytics_events_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_session_id ON public.analytics_events USING btree (session_id);


--
-- Name: idx_analytics_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_timestamp ON public.analytics_events USING btree ("timestamp");


--
-- Name: idx_analytics_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_user_id ON public.analytics_events USING btree (user_id);


--
-- Name: idx_analytics_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_pitch_id ON public.analytics USING btree (pitch_id);


--
-- Name: idx_analytics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_timestamp ON public.analytics USING btree ("timestamp");


--
-- Name: idx_analytics_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_user_id ON public.analytics USING btree (user_id);


--
-- Name: idx_conversations_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_created_by_id ON public.conversations USING btree (created_by_id);


--
-- Name: idx_conversations_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_pitch_id ON public.conversations USING btree (pitch_id);


--
-- Name: idx_credit_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions USING btree (created_at);


--
-- Name: idx_credit_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_type ON public.credit_transactions USING btree (type);


--
-- Name: idx_credit_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions USING btree (user_id);


--
-- Name: idx_database_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_database_alerts_active ON public.database_alerts USING btree (is_active, severity, created_at);


--
-- Name: idx_database_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_database_alerts_type ON public.database_alerts USING btree (alert_type);


--
-- Name: idx_email_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_preferences_user_id ON public.email_preferences USING btree (user_id);


--
-- Name: idx_email_queue_scheduled_for; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_scheduled_for ON public.email_queue USING btree (scheduled_for);


--
-- Name: idx_email_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);


--
-- Name: idx_email_queue_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_user_id ON public.email_queue USING btree (user_id);


--
-- Name: idx_maintenance_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_log_status ON public.maintenance_log USING btree (status);


--
-- Name: idx_maintenance_log_task_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_log_task_date ON public.maintenance_log USING btree (task_name, created_at);


--
-- Name: idx_messages_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_recipient ON public.messages USING btree (recipient_id);


--
-- Name: idx_nda_requests_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nda_requests_owner_id ON public.nda_requests USING btree (owner_id);


--
-- Name: idx_nda_requests_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nda_requests_pitch_id ON public.nda_requests USING btree (pitch_id);


--
-- Name: idx_nda_requests_requester_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nda_requests_requester_id ON public.nda_requests USING btree (requester_id);


--
-- Name: idx_nda_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nda_requests_status ON public.nda_requests USING btree (status);


--
-- Name: idx_ndas_pitch_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndas_pitch_user ON public.ndas USING btree (pitch_id, user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_type ON public.payments USING btree (type);


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);


--
-- Name: idx_pitches_nda_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_nda_count ON public.pitches USING btree (nda_count);


--
-- Name: idx_pitches_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_published_at ON public.pitches USING btree (published_at);


--
-- Name: idx_pitches_require_nda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_require_nda ON public.pitches USING btree (require_nda);


--
-- Name: idx_pitches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_status ON public.pitches USING btree (status);


--
-- Name: idx_pitches_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_user_id ON public.pitches USING btree (user_id);


--
-- Name: idx_portfolio_investor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_investor_id ON public.portfolio USING btree (investor_id);


--
-- Name: idx_portfolio_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_pitch_id ON public.portfolio USING btree (pitch_id);


--
-- Name: idx_portfolio_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_status ON public.portfolio USING btree (status);


--
-- Name: idx_security_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at);


--
-- Name: idx_security_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created_at ON public.security_events USING btree (created_at);


--
-- Name: idx_security_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_event_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_ip ON public.security_events USING btree (ip_address);


--
-- Name: idx_security_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user ON public.security_events USING btree (user_id);


--
-- Name: idx_security_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_user_id ON public.security_events USING btree (user_id);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_user_credits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_credits_user_id ON public.user_credits USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_watchlist_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watchlist_pitch_id ON public.watchlist USING btree (pitch_id);


--
-- Name: idx_watchlist_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watchlist_user_id ON public.watchlist USING btree (user_id);


--
-- Name: messages_pitch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_pitch_id_idx ON public.messages USING btree (pitch_id);


--
-- Name: messages_receiver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_receiver_id_idx ON public.messages USING btree (receiver_id);


--
-- Name: messages_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_id_idx ON public.messages USING btree (sender_id);


--
-- Name: nda_requests_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_owner_id_idx ON public.nda_requests USING btree (owner_id);


--
-- Name: nda_requests_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_owner_idx ON public.nda_requests USING btree (owner_id);


--
-- Name: nda_requests_pitch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_pitch_id_idx ON public.nda_requests USING btree (pitch_id);


--
-- Name: nda_requests_pitch_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_pitch_requester_idx ON public.nda_requests USING btree (pitch_id, requester_id);


--
-- Name: nda_requests_requester_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_requester_id_idx ON public.nda_requests USING btree (requester_id);


--
-- Name: nda_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nda_requests_status_idx ON public.nda_requests USING btree (status);


--
-- Name: ndas_pitch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ndas_pitch_id_idx ON public.ndas USING btree (pitch_id);


--
-- Name: ndas_signer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ndas_signer_id_idx ON public.ndas USING btree (signer_id);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at);


--
-- Name: notifications_is_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_is_read_idx ON public.notifications USING btree (is_read);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id);


--
-- Name: pitch_views_pitch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitch_views_pitch_id_idx ON public.pitch_views USING btree (pitch_id);


--
-- Name: pitches_format_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_format_idx ON public.pitches USING btree (format);


--
-- Name: pitches_genre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_genre_idx ON public.pitches USING btree (genre);


--
-- Name: pitches_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_status_idx ON public.pitches USING btree (status);


--
-- Name: pitches_title_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_title_search_idx ON public.pitches USING btree (title);


--
-- Name: pitches_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_user_id_idx ON public.pitches USING btree (user_id);


--
-- Name: pitches_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pitches_user_idx ON public.pitches USING btree (user_id);


--
-- Name: security_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_events_created_at_idx ON public.security_events USING btree (created_at);


--
-- Name: security_events_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX security_events_event_type_idx ON public.security_events USING btree (event_type);


--
-- Name: sessions_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sessions_token_idx ON public.sessions USING btree (token);


--
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);


--
-- Name: transactions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_status_idx ON public.transactions USING btree (status);


--
-- Name: transactions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_user_id_idx ON public.transactions USING btree (user_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_user_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_user_type_idx ON public.users USING btree (user_type);


--
-- Name: users_username_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_username_idx ON public.users USING btree (username);


--
-- Name: portfolio update_portfolio_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_portfolio_updated_at BEFORE UPDATE ON public.portfolio FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: watchlist update_watchlist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_watchlist_updated_at BEFORE UPDATE ON public.watchlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: analytics_events analytics_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: analytics analytics_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: analytics analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: credit_transactions credit_transactions_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE SET NULL;


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_preferences email_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_queue email_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversations fk_conversations_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_created_by FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_pitch_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_pitch_id FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_pitch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_pitch FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_sender; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notifications_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversation_participants fk_participants_conversation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT fk_participants_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants fk_participants_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pitch_views fk_pitch_views_pitch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_views
    ADD CONSTRAINT fk_pitch_views_pitch FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: transactions fk_transactions_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: message_read_receipts message_read_receipts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_read_receipts message_read_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_read_receipts
    ADD CONSTRAINT message_read_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE SET NULL;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nda_requests nda_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nda_requests
    ADD CONSTRAINT nda_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nda_requests nda_requests_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nda_requests
    ADD CONSTRAINT nda_requests_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: nda_requests nda_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nda_requests
    ADD CONSTRAINT nda_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ndas ndas_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas
    ADD CONSTRAINT ndas_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: ndas ndas_signer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas
    ADD CONSTRAINT ndas_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ndas ndas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndas
    ADD CONSTRAINT ndas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_related_nda_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_nda_request_id_fkey FOREIGN KEY (related_nda_request_id) REFERENCES public.nda_requests(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_related_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_pitch_id_fkey FOREIGN KEY (related_pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pitch_likes pitch_likes_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_likes
    ADD CONSTRAINT pitch_likes_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: pitch_likes pitch_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_likes
    ADD CONSTRAINT pitch_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pitch_saves pitch_saves_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_saves
    ADD CONSTRAINT pitch_saves_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: pitch_saves pitch_saves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_saves
    ADD CONSTRAINT pitch_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pitch_views pitch_views_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_views
    ADD CONSTRAINT pitch_views_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: pitch_views pitch_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitch_views
    ADD CONSTRAINT pitch_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pitches pitches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: portfolio portfolio_investor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio
    ADD CONSTRAINT portfolio_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: portfolio portfolio_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio
    ADD CONSTRAINT portfolio_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE RESTRICT;


--
-- Name: security_events security_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: typing_indicators typing_indicators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_credits user_credits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credits
    ADD CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: watchlist watchlist_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE CASCADE;


--
-- Name: watchlist watchlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

