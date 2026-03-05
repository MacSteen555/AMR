


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "authz";


ALTER SCHEMA "authz" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "app"."audit_entity_type" AS ENUM (
    'team',
    'user',
    'location',
    'review',
    'competitor',
    'subscription',
    'credit',
    'insight',
    'competitive_run'
);


ALTER TYPE "app"."audit_entity_type" OWNER TO "postgres";


CREATE TYPE "app"."credit_event_type" AS ENUM (
    'monthly_grant',
    'topup',
    'adjustment',
    'reply_generate',
    'reply_regenerate',
    'insight_run',
    'competitive_run',
    'refund'
);


ALTER TYPE "app"."credit_event_type" OWNER TO "postgres";


CREATE TYPE "app"."idempotency_status" AS ENUM (
    'started',
    'completed',
    'failed'
);


ALTER TYPE "app"."idempotency_status" OWNER TO "postgres";


CREATE TYPE "app"."location_status" AS ENUM (
    'active',
    'paused',
    'disconnected',
    'archived'
);


ALTER TYPE "app"."location_status" OWNER TO "postgres";


CREATE TYPE "app"."membership_role" AS ENUM (
    'admin',
    'member'
);


ALTER TYPE "app"."membership_role" OWNER TO "postgres";


CREATE TYPE "app"."reply_status" AS ENUM (
    'none',
    'draft',
    'posted',
    'synced_external',
    'post_failed',
    'dismissed'
);


ALTER TYPE "app"."reply_status" OWNER TO "postgres";


CREATE TYPE "app"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'unpaid',
    'canceling'
);


ALTER TYPE "app"."subscription_status" OWNER TO "postgres";


CREATE TYPE "app"."subscription_tier" AS ENUM (
    'FREE',
    'PRO',
    'ENTERPRISE',
    'BUSINESS'
);


ALTER TYPE "app"."subscription_tier" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "app"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "app"."teams" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."create_team"("p_name" "text", "p_slug" "text") RETURNS "app"."teams"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_team app.teams;
BEGIN
  INSERT INTO app.teams (name, slug, created_by)
  VALUES (p_name, p_slug, auth.uid())
  RETURNING * INTO v_team;

  RETURN v_team;
END;
$$;


ALTER FUNCTION "app"."create_team"("p_name" "text", "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."rls_debug"() RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  SELECT json_build_object(
    'auth_uid', auth.uid(),
    'authz_uid', authz.current_user_id(),
    'role', current_user
  );
$$;


ALTER FUNCTION "app"."rls_debug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."tg_credit_tx_apply_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO app.team_credit_balances(team_id, balance, updated_at)
  VALUES (NEW.team_id, NEW.amount, now())
  ON CONFLICT (team_id) DO UPDATE
    SET balance = app.team_credit_balances.balance + EXCLUDED.balance,
        updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "app"."tg_credit_tx_apply_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."tg_set_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "app"."tg_set_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "app"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."whoami"() RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  SELECT json_build_object(
    'auth_uid', auth.uid(),
    'current_role', current_user,
    'app_user_id_setting', current_setting('app.user_id', true)
  );
$$;


ALTER FUNCTION "app"."whoami"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."bypass_rls"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.bypass_rls', true), ''), 'false')::boolean
$$;


ALTER FUNCTION "authz"."bypass_rls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."can_access_location"("p_location_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    authz.bypass_rls()
    OR EXISTS (
      SELECT 1
      FROM app.locations l
      WHERE l.id = p_location_id
        AND (
          authz.is_team_admin(l.team_id)
          OR EXISTS (
            SELECT 1
            FROM app.location_access la
            WHERE la.location_id = p_location_id
              AND la.user_id = authz.current_user_id()
              AND la.can_manage = true
          )
        )
    )
$$;


ALTER FUNCTION "authz"."can_access_location"("p_location_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."current_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.uid()
$$;


ALTER FUNCTION "authz"."current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."is_team_admin"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    authz.bypass_rls()
    OR EXISTS (
      SELECT 1
      FROM app.team_memberships tm
      WHERE tm.team_id = p_team_id
        AND tm.user_id = authz.current_user_id()
        AND tm.role = 'admin'
    )
$$;


ALTER FUNCTION "authz"."is_team_admin"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."is_team_member"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    authz.bypass_rls()
    OR EXISTS (
      SELECT 1
      FROM app.team_memberships tm
      WHERE tm.team_id = p_team_id
        AND tm.user_id = authz.current_user_id()
    )
$$;


ALTER FUNCTION "authz"."is_team_member"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."whoami"() RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  SELECT json_build_object(
    'auth_uid', auth.uid(),
    'rls_uid', authz.current_user_id(),
    'jwt_sub', current_setting('request.jwt.claim.sub', true)
  );
$$;


ALTER FUNCTION "authz"."whoami"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "app"."audit_entity_type",
    "entity_id" "uuid",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."competitive_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid",
    "name" "text",
    "period_start" "date",
    "period_end" "date",
    "owned_location_ids" "uuid"[] NOT NULL,
    "competitor_ids" "uuid"[] NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model" "text",
    "prompt_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "competitive_runs_competitor_ids_check" CHECK ((("array_length"("competitor_ids", 1) >= 1) AND ("array_length"("competitor_ids", 1) <= 3))),
    CONSTRAINT "competitive_runs_owned_location_ids_check" CHECK ((("array_length"("owned_location_ids", 1) >= 1) AND ("array_length"("owned_location_ids", 1) <= 3)))
);


ALTER TABLE "app"."competitive_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."competitor_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "serpapi_review_id" "text" NOT NULL,
    "rating" integer,
    "reviewer_name" "text",
    "reviewer_profile_url" "text",
    "reviewer_contributor_id" "text",
    "reviewer_is_local_guide" boolean,
    "reviewer_reviews_count" integer,
    "reviewer_photos_count" integer,
    "comment" "text",
    "review_date" timestamp with time zone,
    "review_date_text" "text",
    "review_url" "text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "details" "jsonb",
    "likes" integer,
    "owner_response" "jsonb",
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "competitor_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "app"."competitor_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "categories" "text"[],
    "rating" numeric(3,2),
    "review_count" integer,
    "business_id" "text",
    "place_id" "text",
    "data_id" "text",
    "phone" "text",
    "website" "text",
    "latitude" double precision,
    "longitude" double precision,
    "opening_hours" "jsonb",
    "topics" "jsonb",
    "raw_payload" "jsonb",
    "last_serp_sync_at" timestamp with time zone,
    "last_serp_sync_status" "text",
    "last_serp_sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "app"."competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."credit_topup_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "credits" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_topup_products_credits_check" CHECK (("credits" > 0))
);


ALTER TABLE "app"."credit_topup_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."google_location_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_identity_id" "uuid" NOT NULL,
    "google_location_id" "text" NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."google_location_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."google_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "google_review_id" "text" NOT NULL,
    "rating" integer NOT NULL,
    "reviewer_name" "text",
    "reviewer_profile_url" "text",
    "comment" "text",
    "review_date" timestamp with time zone,
    "review_url" "text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reply_status" "app"."reply_status" DEFAULT 'none'::"app"."reply_status" NOT NULL,
    "replied_at" timestamp with time zone,
    "replied_by_user_id" "uuid",
    "reply_text" "text",
    "reply_source" "text",
    "draft_text" "text",
    "draft_updated_at" timestamp with time zone,
    "llm_last_generated_at" timestamp with time zone,
    "llm_model" "text",
    "llm_prompt_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "app"."google_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."google_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_identity_id" "uuid" NOT NULL,
    "encrypted_refresh_token" "text" NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."google_tokens" OWNER TO "postgres";


COMMENT ON COLUMN "app"."google_tokens"."encrypted_refresh_token" IS 'Base64-encoded encrypted refresh token (encrypted with Node.js crypto, not pgcrypto)';



CREATE TABLE IF NOT EXISTS "app"."idempotency_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "key" "text" NOT NULL,
    "route" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "status" "app"."idempotency_status" DEFAULT 'started'::"app"."idempotency_status" NOT NULL,
    "response" "jsonb",
    "error" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "location_id" "uuid",
    "period_start" "date",
    "period_end" "date",
    "kind" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_by_user_id" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model" "text",
    "prompt_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_window" "text",
    CONSTRAINT "insights_check" CHECK (((("team_id" IS NOT NULL) AND ("location_id" IS NULL)) OR (("team_id" IS NULL) AND ("location_id" IS NOT NULL))))
);


ALTER TABLE "app"."insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."location_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "can_manage" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."location_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "status" "app"."location_status" DEFAULT 'active'::"app"."location_status" NOT NULL,
    "google_location_id" "text" NOT NULL,
    "google_account_hint" "text",
    "name" "text" NOT NULL,
    "phone" "text",
    "website" "text",
    "address" "text",
    "city" "text",
    "region" "text",
    "country" "text",
    "postal_code" "text",
    "latitude" double precision,
    "longitude" double precision,
    "timezone" "text",
    "brand_voice" "text",
    "positive_sentiment" "text",
    "negative_sentiment" "text",
    "reply_language" "text",
    "signature" "text",
    "last_google_sync_at" timestamp with time zone,
    "last_google_sync_status" "text",
    "last_google_sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "app"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."reply_post_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "attempted_by_user_id" "uuid",
    "used_identity_id" "uuid",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "success" boolean DEFAULT false NOT NULL,
    "google_error_code" "text",
    "google_error_message" "text",
    "request_payload" "jsonb",
    "response_payload" "jsonb"
);


ALTER TABLE "app"."reply_post_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."review_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "author_user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."review_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."stripe_events" (
    "event_id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb"
);


ALTER TABLE "app"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier" "app"."subscription_tier" NOT NULL,
    "monthly_credits" integer DEFAULT 0 NOT NULL,
    "insights_enabled" boolean DEFAULT false NOT NULL,
    "competitive_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."team_credit_balances" (
    "team_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."team_credit_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."team_credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "event_type" "app"."credit_event_type" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text",
    "reference_type" "app"."audit_entity_type",
    "reference_id" "uuid",
    "actor_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_credit_transactions_amount_check" CHECK (("amount" <> 0))
);


ALTER TABLE "app"."team_credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."team_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "invited_email" "public"."citext" NOT NULL,
    "role" "app"."membership_role" DEFAULT 'member'::"app"."membership_role" NOT NULL,
    "invited_by" "uuid",
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."team_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."team_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "app"."membership_role" DEFAULT 'member'::"app"."membership_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."team_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."team_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "tier" "app"."subscription_tier" DEFAULT 'FREE'::"app"."subscription_tier" NOT NULL,
    "status" "app"."subscription_status" DEFAULT 'active'::"app"."subscription_status" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "monthly_credits" integer DEFAULT 0 NOT NULL,
    "insights_enabled" boolean DEFAULT false NOT NULL,
    "competitive_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."team_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."user_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_user_id" "text" NOT NULL,
    "provider_email" "public"."citext",
    "access_token_ref" "text",
    "refresh_token_ref" "text",
    "token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app"."user_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "app"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "public"."citext",
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "app"."users" OWNER TO "postgres";


ALTER TABLE ONLY "app"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."competitive_runs"
    ADD CONSTRAINT "competitive_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."competitor_reviews"
    ADD CONSTRAINT "competitor_reviews_competitor_id_serpapi_review_id_key" UNIQUE ("competitor_id", "serpapi_review_id");



ALTER TABLE ONLY "app"."competitor_reviews"
    ADD CONSTRAINT "competitor_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."credit_topup_products"
    ADD CONSTRAINT "credit_topup_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."credit_topup_products"
    ADD CONSTRAINT "credit_topup_products_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "app"."google_location_entitlements"
    ADD CONSTRAINT "google_location_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."google_location_entitlements"
    ADD CONSTRAINT "google_location_entitlements_user_identity_id_google_locati_key" UNIQUE ("user_identity_id", "google_location_id");



ALTER TABLE ONLY "app"."google_reviews"
    ADD CONSTRAINT "google_reviews_location_id_google_review_id_key" UNIQUE ("location_id", "google_review_id");



ALTER TABLE ONLY "app"."google_reviews"
    ADD CONSTRAINT "google_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."google_tokens"
    ADD CONSTRAINT "google_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."google_tokens"
    ADD CONSTRAINT "google_tokens_user_identity_id_key" UNIQUE ("user_identity_id");



ALTER TABLE ONLY "app"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_user_id_key_key" UNIQUE ("user_id", "key");



ALTER TABLE ONLY "app"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."location_access"
    ADD CONSTRAINT "location_access_location_id_user_id_key" UNIQUE ("location_id", "user_id");



ALTER TABLE ONLY "app"."location_access"
    ADD CONSTRAINT "location_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."locations"
    ADD CONSTRAINT "locations_team_id_google_location_id_key" UNIQUE ("team_id", "google_location_id");



ALTER TABLE ONLY "app"."reply_post_attempts"
    ADD CONSTRAINT "reply_post_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."review_drafts"
    ADD CONSTRAINT "review_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "app"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_tier_key" UNIQUE ("tier");



ALTER TABLE ONLY "app"."team_credit_balances"
    ADD CONSTRAINT "team_credit_balances_pkey" PRIMARY KEY ("team_id");



ALTER TABLE ONLY "app"."team_credit_transactions"
    ADD CONSTRAINT "team_credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."team_invites"
    ADD CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."team_invites"
    ADD CONSTRAINT "team_invites_team_id_invited_email_key" UNIQUE ("team_id", "invited_email");



ALTER TABLE ONLY "app"."team_memberships"
    ADD CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."team_memberships"
    ADD CONSTRAINT "team_memberships_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "app"."team_subscriptions"
    ADD CONSTRAINT "team_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."team_subscriptions"
    ADD CONSTRAINT "team_subscriptions_team_id_key" UNIQUE ("team_id");



ALTER TABLE ONLY "app"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."teams"
    ADD CONSTRAINT "teams_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "app"."user_identities"
    ADD CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "app"."user_identities"
    ADD CONSTRAINT "user_identities_provider_provider_user_id_key" UNIQUE ("provider", "provider_user_id");



ALTER TABLE ONLY "app"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "app"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_team_time" ON "app"."audit_log" USING "btree" ("team_id", "created_at" DESC);



CREATE INDEX "idx_competitive_runs_team_created" ON "app"."competitive_runs" USING "btree" ("team_id", "created_at" DESC);



CREATE INDEX "idx_competitor_reviews_comp_date" ON "app"."competitor_reviews" USING "btree" ("competitor_id", "review_date" DESC);



CREATE INDEX "idx_competitors_business_id" ON "app"."competitors" USING "btree" ("business_id");



CREATE INDEX "idx_competitors_data_id" ON "app"."competitors" USING "btree" ("data_id");



CREATE INDEX "idx_competitors_place_id" ON "app"."competitors" USING "btree" ("place_id");



CREATE INDEX "idx_competitors_team" ON "app"."competitors" USING "btree" ("team_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_gle_identity" ON "app"."google_location_entitlements" USING "btree" ("user_identity_id");



CREATE INDEX "idx_gle_location_id" ON "app"."google_location_entitlements" USING "btree" ("google_location_id");



CREATE INDEX "idx_google_reviews_location_date" ON "app"."google_reviews" USING "btree" ("location_id", "review_date" DESC);



CREATE INDEX "idx_google_reviews_location_status" ON "app"."google_reviews" USING "btree" ("location_id", "reply_status");



CREATE INDEX "idx_google_tokens_identity" ON "app"."google_tokens" USING "btree" ("user_identity_id");



CREATE INDEX "idx_idem_team_time" ON "app"."idempotency_keys" USING "btree" ("team_id", "created_at" DESC);



CREATE INDEX "idx_idem_user_route" ON "app"."idempotency_keys" USING "btree" ("user_id", "route");



CREATE INDEX "idx_insights_location_period" ON "app"."insights" USING "btree" ("location_id", "period_start", "period_end");



CREATE INDEX "idx_insights_team_period" ON "app"."insights" USING "btree" ("team_id", "period_start", "period_end");



CREATE INDEX "idx_location_access_location" ON "app"."location_access" USING "btree" ("location_id");



CREATE INDEX "idx_location_access_user" ON "app"."location_access" USING "btree" ("user_id");



CREATE INDEX "idx_locations_google_location_id" ON "app"."locations" USING "btree" ("google_location_id");



CREATE INDEX "idx_locations_team" ON "app"."locations" USING "btree" ("team_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_reply_post_attempts_review" ON "app"."reply_post_attempts" USING "btree" ("review_id");



CREATE INDEX "idx_review_drafts_review" ON "app"."review_drafts" USING "btree" ("review_id");



CREATE INDEX "idx_team_credit_tx_team_time" ON "app"."team_credit_transactions" USING "btree" ("team_id", "created_at" DESC);



CREATE INDEX "idx_team_invites_team" ON "app"."team_invites" USING "btree" ("team_id");



CREATE INDEX "idx_team_memberships_team" ON "app"."team_memberships" USING "btree" ("team_id");



CREATE INDEX "idx_team_memberships_user" ON "app"."team_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_user_identities_user" ON "app"."user_identities" USING "btree" ("user_id");



CREATE UNIQUE INDEX "ux_competitors_team_business_id" ON "app"."competitors" USING "btree" ("team_id", "business_id") WHERE (("business_id" IS NOT NULL) AND ("business_id" <> ''::"text"));



CREATE UNIQUE INDEX "ux_competitors_team_data_id" ON "app"."competitors" USING "btree" ("team_id", "data_id") WHERE (("data_id" IS NOT NULL) AND ("data_id" <> ''::"text"));



CREATE UNIQUE INDEX "ux_competitors_team_place_id" ON "app"."competitors" USING "btree" ("team_id", "place_id") WHERE (("place_id" IS NOT NULL) AND ("place_id" <> ''::"text"));



CREATE OR REPLACE TRIGGER "trg_competitive_runs_updated_at" BEFORE UPDATE ON "app"."competitive_runs" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_competitor_reviews_updated_at" BEFORE UPDATE ON "app"."competitor_reviews" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_competitors_updated_at" BEFORE UPDATE ON "app"."competitors" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_credit_topup_products_updated_at" BEFORE UPDATE ON "app"."credit_topup_products" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_credit_tx_apply_balance" AFTER INSERT ON "app"."team_credit_transactions" FOR EACH ROW EXECUTE FUNCTION "app"."tg_credit_tx_apply_balance"();



CREATE OR REPLACE TRIGGER "trg_google_reviews_updated_at" BEFORE UPDATE ON "app"."google_reviews" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_google_tokens_updated_at" BEFORE UPDATE ON "app"."google_tokens" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_idempotency_keys_updated_at" BEFORE UPDATE ON "app"."idempotency_keys" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_insights_updated_at" BEFORE UPDATE ON "app"."insights" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_locations_updated_at" BEFORE UPDATE ON "app"."locations" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscription_plans_updated_at" BEFORE UPDATE ON "app"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_team_memberships_updated_at" BEFORE UPDATE ON "app"."team_memberships" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_team_subscriptions_updated_at" BEFORE UPDATE ON "app"."team_subscriptions" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_teams_set_created_by" BEFORE INSERT ON "app"."teams" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_created_by"();



CREATE OR REPLACE TRIGGER "trg_teams_updated_at" BEFORE UPDATE ON "app"."teams" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_identities_updated_at" BEFORE UPDATE ON "app"."user_identities" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "app"."users" FOR EACH ROW EXECUTE FUNCTION "app"."tg_set_updated_at"();



ALTER TABLE ONLY "app"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."audit_log"
    ADD CONSTRAINT "audit_log_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."competitive_runs"
    ADD CONSTRAINT "competitive_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."competitive_runs"
    ADD CONSTRAINT "competitive_runs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."competitor_reviews"
    ADD CONSTRAINT "competitor_reviews_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "app"."competitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."competitors"
    ADD CONSTRAINT "competitors_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."google_location_entitlements"
    ADD CONSTRAINT "google_location_entitlements_user_identity_id_fkey" FOREIGN KEY ("user_identity_id") REFERENCES "app"."user_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."google_reviews"
    ADD CONSTRAINT "google_reviews_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "app"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."google_reviews"
    ADD CONSTRAINT "google_reviews_replied_by_user_id_fkey" FOREIGN KEY ("replied_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."google_tokens"
    ADD CONSTRAINT "google_tokens_user_identity_id_fkey" FOREIGN KEY ("user_identity_id") REFERENCES "app"."user_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."insights"
    ADD CONSTRAINT "insights_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."insights"
    ADD CONSTRAINT "insights_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "app"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."insights"
    ADD CONSTRAINT "insights_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."location_access"
    ADD CONSTRAINT "location_access_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "app"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."location_access"
    ADD CONSTRAINT "location_access_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."location_access"
    ADD CONSTRAINT "location_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."locations"
    ADD CONSTRAINT "locations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."reply_post_attempts"
    ADD CONSTRAINT "reply_post_attempts_attempted_by_user_id_fkey" FOREIGN KEY ("attempted_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."reply_post_attempts"
    ADD CONSTRAINT "reply_post_attempts_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "app"."google_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."reply_post_attempts"
    ADD CONSTRAINT "reply_post_attempts_used_identity_id_fkey" FOREIGN KEY ("used_identity_id") REFERENCES "app"."user_identities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."review_drafts"
    ADD CONSTRAINT "review_drafts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."review_drafts"
    ADD CONSTRAINT "review_drafts_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "app"."google_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_credit_balances"
    ADD CONSTRAINT "team_credit_balances_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_credit_transactions"
    ADD CONSTRAINT "team_credit_transactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."team_credit_transactions"
    ADD CONSTRAINT "team_credit_transactions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_invites"
    ADD CONSTRAINT "team_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."team_invites"
    ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_memberships"
    ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_memberships"
    ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."team_subscriptions"
    ADD CONSTRAINT "team_subscriptions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "app"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "app"."user_identities"
    ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE;



CREATE POLICY "audit_insert_member" ON "app"."audit_log" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR (("team_id" IS NOT NULL) AND "authz"."is_team_member"("team_id"))));



ALTER TABLE "app"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_select_member" ON "app"."audit_log" FOR SELECT USING ((("team_id" IS NULL) OR "authz"."is_team_member"("team_id")));



ALTER TABLE "app"."competitive_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitive_runs_delete_admin" ON "app"."competitive_runs" FOR DELETE USING ("authz"."is_team_admin"("team_id"));



CREATE POLICY "competitive_runs_insert_member" ON "app"."competitive_runs" FOR INSERT WITH CHECK ("authz"."is_team_member"("team_id"));



CREATE POLICY "competitive_runs_select_member" ON "app"."competitive_runs" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "competitive_runs_update_admin" ON "app"."competitive_runs" FOR UPDATE USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



ALTER TABLE "app"."competitor_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitor_reviews_select_member" ON "app"."competitor_reviews" FOR SELECT USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."competitors" "c"
  WHERE (("c"."id" = "competitor_reviews"."competitor_id") AND "authz"."is_team_member"("c"."team_id"))))));



CREATE POLICY "competitor_reviews_write_admin_or_bypass" ON "app"."competitor_reviews" USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."competitors" "c"
  WHERE (("c"."id" = "competitor_reviews"."competitor_id") AND "authz"."is_team_admin"("c"."team_id")))))) WITH CHECK (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."competitors" "c"
  WHERE (("c"."id" = "competitor_reviews"."competitor_id") AND "authz"."is_team_admin"("c"."team_id"))))));



ALTER TABLE "app"."competitors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitors_select_member" ON "app"."competitors" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "competitors_write_admin" ON "app"."competitors" USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "credit_bal_select_member" ON "app"."team_credit_balances" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "credit_bal_write_admin_or_bypass" ON "app"."team_credit_balances" USING (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id"))) WITH CHECK (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id")));



ALTER TABLE "app"."credit_topup_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_tx_insert_admin_or_bypass" ON "app"."team_credit_transactions" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id")));



CREATE POLICY "credit_tx_select_member" ON "app"."team_credit_transactions" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "gle_select_self" ON "app"."google_location_entitlements" FOR SELECT USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_location_entitlements"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"()))))));



CREATE POLICY "gle_write_self" ON "app"."google_location_entitlements" USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_location_entitlements"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"())))))) WITH CHECK (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_location_entitlements"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"()))))));



ALTER TABLE "app"."google_location_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."google_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."google_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "google_tokens_select_self" ON "app"."google_tokens" FOR SELECT USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_tokens"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"()))))));



CREATE POLICY "google_tokens_write_self" ON "app"."google_tokens" USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_tokens"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"())))))) WITH CHECK (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."user_identities" "ui"
  WHERE (("ui"."id" = "google_tokens"."user_identity_id") AND ("ui"."user_id" = "authz"."current_user_id"()))))));



CREATE POLICY "idem_select_self" ON "app"."idempotency_keys" FOR SELECT USING (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"())));



CREATE POLICY "idem_write_bypass_only" ON "app"."idempotency_keys" USING ("authz"."bypass_rls"()) WITH CHECK ("authz"."bypass_rls"());



ALTER TABLE "app"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "identities_delete_self" ON "app"."user_identities" FOR DELETE USING (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"())));



CREATE POLICY "identities_insert_self" ON "app"."user_identities" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"())));



CREATE POLICY "identities_select_self" ON "app"."user_identities" FOR SELECT USING (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"())));



CREATE POLICY "identities_update_self" ON "app"."user_identities" FOR UPDATE USING (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"()))) WITH CHECK (("authz"."bypass_rls"() OR ("user_id" = "authz"."current_user_id"())));



ALTER TABLE "app"."insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insights_select" ON "app"."insights" FOR SELECT USING (("authz"."bypass_rls"() OR (("team_id" IS NOT NULL) AND "authz"."is_team_member"("team_id")) OR (("location_id" IS NOT NULL) AND "authz"."can_access_location"("location_id"))));



CREATE POLICY "insights_write_admin_or_bypass" ON "app"."insights" USING (("authz"."bypass_rls"() OR (("team_id" IS NOT NULL) AND "authz"."is_team_admin"("team_id")) OR (("location_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "app"."locations" "l"
  WHERE (("l"."id" = "insights"."location_id") AND "authz"."is_team_admin"("l"."team_id"))))))) WITH CHECK (("authz"."bypass_rls"() OR (("team_id" IS NOT NULL) AND "authz"."is_team_admin"("team_id")) OR (("location_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "app"."locations" "l"
  WHERE (("l"."id" = "insights"."location_id") AND "authz"."is_team_admin"("l"."team_id")))))));



CREATE POLICY "invites_all_admin" ON "app"."team_invites" USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "la_select_member" ON "app"."location_access" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "la_write_admin" ON "app"."location_access" USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



ALTER TABLE "app"."location_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_delete_admin" ON "app"."locations" FOR DELETE USING ("authz"."is_team_admin"("team_id"));



CREATE POLICY "locations_insert_admin" ON "app"."locations" FOR INSERT WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "locations_select_access" ON "app"."locations" FOR SELECT USING (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id") OR (EXISTS ( SELECT 1
   FROM "app"."location_access" "la"
  WHERE (("la"."location_id" = "la"."id") AND ("la"."user_id" = "authz"."current_user_id"()) AND ("la"."can_manage" = true))))));



CREATE POLICY "locations_update_admin" ON "app"."locations" FOR UPDATE USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "plans_select_any" ON "app"."subscription_plans" FOR SELECT USING (("authz"."bypass_rls"() OR ("authz"."current_user_id"() IS NOT NULL)));



CREATE POLICY "plans_write_bypass_only" ON "app"."subscription_plans" USING ("authz"."bypass_rls"()) WITH CHECK ("authz"."bypass_rls"());



ALTER TABLE "app"."reply_post_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."review_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_drafts_insert_access" ON "app"."review_drafts" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR (("author_user_id" = "authz"."current_user_id"()) AND (EXISTS ( SELECT 1
   FROM "app"."google_reviews" "r"
  WHERE (("r"."id" = "review_drafts"."review_id") AND "authz"."can_access_location"("r"."location_id")))))));



CREATE POLICY "review_drafts_select_access" ON "app"."review_drafts" FOR SELECT USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."google_reviews" "r"
  WHERE (("r"."id" = "review_drafts"."review_id") AND "authz"."can_access_location"("r"."location_id"))))));



CREATE POLICY "reviews_insert_admin_or_bypass" ON "app"."google_reviews" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."locations" "l"
  WHERE (("l"."id" = "google_reviews"."location_id") AND "authz"."is_team_admin"("l"."team_id"))))));



CREATE POLICY "reviews_select_location_access" ON "app"."google_reviews" FOR SELECT USING ("authz"."can_access_location"("location_id"));



CREATE POLICY "reviews_update_location_access" ON "app"."google_reviews" FOR UPDATE USING ("authz"."can_access_location"("location_id")) WITH CHECK ("authz"."can_access_location"("location_id"));



CREATE POLICY "rpa_insert_access" ON "app"."reply_post_attempts" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR (("attempted_by_user_id" = "authz"."current_user_id"()) AND (EXISTS ( SELECT 1
   FROM "app"."google_reviews" "r"
  WHERE (("r"."id" = "reply_post_attempts"."review_id") AND "authz"."can_access_location"("r"."location_id")))))));



CREATE POLICY "rpa_select_access" ON "app"."reply_post_attempts" FOR SELECT USING (("authz"."bypass_rls"() OR (EXISTS ( SELECT 1
   FROM "app"."google_reviews" "r"
  WHERE (("r"."id" = "reply_post_attempts"."review_id") AND "authz"."can_access_location"("r"."location_id"))))));



ALTER TABLE "app"."stripe_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_events_bypass_only" ON "app"."stripe_events" USING ("authz"."bypass_rls"()) WITH CHECK ("authz"."bypass_rls"());



ALTER TABLE "app"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."team_credit_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."team_credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."team_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."team_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."team_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_subscriptions_select_member" ON "app"."team_subscriptions" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "team_subscriptions_write_admin_or_bypass" ON "app"."team_subscriptions" USING (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id"))) WITH CHECK (("authz"."bypass_rls"() OR "authz"."is_team_admin"("team_id")));



ALTER TABLE "app"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete_admin" ON "app"."teams" FOR DELETE USING ("authz"."is_team_admin"("id"));



CREATE POLICY "teams_insert_authenticated" ON "app"."teams" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "teams_select_creator" ON "app"."teams" FOR SELECT USING (("created_by" = "authz"."current_user_id"()));



CREATE POLICY "teams_select_member" ON "app"."teams" FOR SELECT USING ("authz"."is_team_member"("id"));



CREATE POLICY "teams_update_admin" ON "app"."teams" FOR UPDATE USING ("authz"."is_team_admin"("id")) WITH CHECK ("authz"."is_team_admin"("id"));



CREATE POLICY "tm_delete_admin" ON "app"."team_memberships" FOR DELETE USING ("authz"."is_team_admin"("team_id"));



CREATE POLICY "tm_insert_admin" ON "app"."team_memberships" FOR INSERT WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "tm_insert_team_creator_bootstrap" ON "app"."team_memberships" FOR INSERT WITH CHECK (("authz"."bypass_rls"() OR (("user_id" = "authz"."current_user_id"()) AND (EXISTS ( SELECT 1
   FROM "app"."teams" "t"
  WHERE (("t"."id" = "team_memberships"."team_id") AND ("t"."created_by" = "authz"."current_user_id"())))))));



CREATE POLICY "tm_select_member" ON "app"."team_memberships" FOR SELECT USING ("authz"."is_team_member"("team_id"));



CREATE POLICY "tm_update_admin" ON "app"."team_memberships" FOR UPDATE USING ("authz"."is_team_admin"("team_id")) WITH CHECK ("authz"."is_team_admin"("team_id"));



CREATE POLICY "topups_select_authenticated" ON "app"."credit_topup_products" FOR SELECT USING (("authz"."bypass_rls"() OR ("authz"."current_user_id"() IS NOT NULL)));



CREATE POLICY "topups_write_bypass_only" ON "app"."credit_topup_products" USING ("authz"."bypass_rls"()) WITH CHECK ("authz"."bypass_rls"());



ALTER TABLE "app"."user_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "app"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_self" ON "app"."users" FOR SELECT USING (("authz"."bypass_rls"() OR ("id" = "authz"."current_user_id"())));



CREATE POLICY "users_update_self" ON "app"."users" FOR UPDATE USING (("authz"."bypass_rls"() OR ("id" = "authz"."current_user_id"()))) WITH CHECK (("authz"."bypass_rls"() OR ("id" = "authz"."current_user_id"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "app" TO "anon";
GRANT USAGE ON SCHEMA "app" TO "authenticated";
GRANT USAGE ON SCHEMA "app" TO "service_role";



GRANT USAGE ON SCHEMA "authz" TO "authenticated";
GRANT USAGE ON SCHEMA "authz" TO "anon";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"("inet") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "anon";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."teams" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."teams" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."teams" TO "service_role";



GRANT ALL ON FUNCTION "app"."create_team"("p_name" "text", "p_slug" "text") TO "authenticated";



GRANT ALL ON FUNCTION "app"."rls_debug"() TO "anon";
GRANT ALL ON FUNCTION "app"."rls_debug"() TO "authenticated";



GRANT ALL ON FUNCTION "app"."whoami"() TO "anon";
GRANT ALL ON FUNCTION "app"."whoami"() TO "authenticated";



GRANT ALL ON FUNCTION "authz"."bypass_rls"() TO "authenticated";
GRANT ALL ON FUNCTION "authz"."bypass_rls"() TO "anon";



GRANT ALL ON FUNCTION "authz"."can_access_location"("p_location_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "authz"."can_access_location"("p_location_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "authz"."current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "authz"."current_user_id"() TO "anon";



GRANT ALL ON FUNCTION "authz"."is_team_admin"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "authz"."is_team_admin"("p_team_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "authz"."is_team_member"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "authz"."is_team_member"("p_team_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "authz"."whoami"() TO "anon";
GRANT ALL ON FUNCTION "authz"."whoami"() TO "authenticated";

























































































































































GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."audit_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."audit_log" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."audit_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_runs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_runs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_runs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitor_reviews" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitor_reviews" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitor_reviews" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitors" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitors" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitors" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."credit_topup_products" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."credit_topup_products" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."credit_topup_products" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_location_entitlements" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_location_entitlements" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_location_entitlements" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_reviews" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_reviews" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_reviews" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_tokens" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_tokens" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."google_tokens" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."idempotency_keys" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."idempotency_keys" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."idempotency_keys" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."insights" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."insights" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."insights" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."location_access" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."location_access" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."location_access" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."locations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."locations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."locations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."reply_post_attempts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."reply_post_attempts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."reply_post_attempts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."review_drafts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."review_drafts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."review_drafts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."stripe_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."stripe_events" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."stripe_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."subscription_plans" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."subscription_plans" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."subscription_plans" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_balances" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_balances" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_balances" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_transactions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_transactions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_credit_transactions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_invites" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_invites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_invites" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_memberships" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_memberships" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_memberships" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_subscriptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_subscriptions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."team_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."user_identities" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."user_identities" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."user_identities" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."users" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."users" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."users" TO "service_role";















ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "authz" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "authz" GRANT ALL ON FUNCTIONS TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































