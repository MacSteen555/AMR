-- Competitive Groups: named sets of locations + competitors for quick switching
CREATE TABLE IF NOT EXISTS "app"."competitive_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid",
    "name" "text" NOT NULL,
    "owned_location_ids" "uuid"[] NOT NULL DEFAULT '{}',
    "competitor_ids" "uuid"[] NOT NULL DEFAULT '{}',
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "competitive_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competitive_groups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "app"."teams"("id") ON DELETE CASCADE,
    CONSTRAINT "competitive_groups_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "competitive_groups_owned_location_ids_check" CHECK (("array_length"("owned_location_ids", 1) IS NULL OR "array_length"("owned_location_ids", 1) <= 3)),
    CONSTRAINT "competitive_groups_competitor_ids_check" CHECK (("array_length"("competitor_ids", 1) IS NULL OR "array_length"("competitor_ids", 1) <= 3))
);

ALTER TABLE "app"."competitive_groups" OWNER TO "postgres";

-- Add group_id to competitive_runs so runs are linked to a group
ALTER TABLE "app"."competitive_runs" ADD COLUMN IF NOT EXISTS "group_id" "uuid" REFERENCES "app"."competitive_groups"("id") ON DELETE SET NULL;

-- RLS
ALTER TABLE "app"."competitive_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their groups"
    ON "app"."competitive_groups" FOR SELECT
    USING ("team_id" IN (SELECT "team_id" FROM "app"."team_memberships" WHERE "user_id" = "auth"."uid"()));

CREATE POLICY "Team members can insert groups"
    ON "app"."competitive_groups" FOR INSERT
    WITH CHECK ("team_id" IN (SELECT "team_id" FROM "app"."team_memberships" WHERE "user_id" = "auth"."uid"()));

CREATE POLICY "Team members can update groups"
    ON "app"."competitive_groups" FOR UPDATE
    USING ("team_id" IN (SELECT "team_id" FROM "app"."team_memberships" WHERE "user_id" = "auth"."uid"()));

CREATE POLICY "Team members can delete groups"
    ON "app"."competitive_groups" FOR DELETE
    USING ("team_id" IN (SELECT "team_id" FROM "app"."team_memberships" WHERE "user_id" = "auth"."uid"()));

-- Grants
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_groups" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_groups" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "app"."competitive_groups" TO "service_role";
