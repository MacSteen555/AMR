drop extension if exists "pg_net";


  create table "app"."theme_dictionary" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid not null,
    "label" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "app"."google_reviews" add column "themes" text[];

alter table "app"."team_credit_balances" add column "reports_generated" integer;

CREATE INDEX idx_theme_dictionary_team_id ON app.theme_dictionary USING btree (team_id);

CREATE UNIQUE INDEX theme_dictionary_pkey ON app.theme_dictionary USING btree (id);

CREATE UNIQUE INDEX theme_dictionary_team_id_label_key ON app.theme_dictionary USING btree (team_id, label);

alter table "app"."theme_dictionary" add constraint "theme_dictionary_pkey" PRIMARY KEY using index "theme_dictionary_pkey";

alter table "app"."theme_dictionary" add constraint "theme_dictionary_team_id_fkey" FOREIGN KEY (team_id) REFERENCES app.teams(id) ON DELETE CASCADE not valid;

alter table "app"."theme_dictionary" validate constraint "theme_dictionary_team_id_fkey";

alter table "app"."theme_dictionary" add constraint "theme_dictionary_team_id_label_key" UNIQUE using index "theme_dictionary_team_id_label_key";

grant delete on table "app"."theme_dictionary" to "anon";

grant insert on table "app"."theme_dictionary" to "anon";

grant select on table "app"."theme_dictionary" to "anon";

grant update on table "app"."theme_dictionary" to "anon";

grant delete on table "app"."theme_dictionary" to "authenticated";

grant insert on table "app"."theme_dictionary" to "authenticated";

grant select on table "app"."theme_dictionary" to "authenticated";

grant update on table "app"."theme_dictionary" to "authenticated";

grant delete on table "app"."theme_dictionary" to "service_role";

grant insert on table "app"."theme_dictionary" to "service_role";

grant select on table "app"."theme_dictionary" to "service_role";

grant update on table "app"."theme_dictionary" to "service_role";


