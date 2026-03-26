create table "public"."github_oauth_tokens" (
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid,
    "access_token" text,
    "updated_at" timestamp with time zone default now(),
    "id" uuid not null default gen_random_uuid()
);

alter table "public"."github_oauth_tokens" enable row level security;

CREATE UNIQUE INDEX github_oauth_tokens_pkey ON public.github_oauth_tokens USING btree (id);
CREATE UNIQUE INDEX github_oauth_tokens_user_id_key ON public.github_oauth_tokens USING btree (user_id);

alter table "public"."github_oauth_tokens" add constraint "github_oauth_tokens_pkey" PRIMARY KEY using index "github_oauth_tokens_pkey";
alter table "public"."github_oauth_tokens" add constraint "github_oauth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) on delete cascade not valid;
alter table "public"."github_oauth_tokens" validate constraint "github_oauth_tokens_user_id_fkey";
alter table "public"."github_oauth_tokens" add constraint "github_oauth_tokens_user_id_key" UNIQUE using index "github_oauth_tokens_user_id_key";

-- Grant basic permissions
grant select, insert, update, delete on table "public"."github_oauth_tokens" to "authenticated";
grant select, insert, update, delete on table "public"."github_oauth_tokens" to "service_role";

-- Policies
create policy "Users can manage their own github tokens"
on "public"."github_oauth_tokens"
as permissive
for all
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));

create policy "Service role has full access to github tokens"
on "public"."github_oauth_tokens"
as permissive
for all
to service_role
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));
