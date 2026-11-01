ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'TECHNICIAN';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_admins" UNIQUE("store_id", "user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_admins" ADD CONSTRAINT "store_admins_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_admins" ADD CONSTRAINT "store_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_store_admins_store_id" ON "store_admins" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_store_admins_user_id" ON "store_admins" USING btree ("user_id");
