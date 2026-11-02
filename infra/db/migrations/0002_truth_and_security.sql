ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_user_id" ON "bookings" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_status" ON "bookings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_store_id" ON "bookings" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_trail_booking_id" ON "booking_trail" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_codes_lookup" ON "otp_codes" USING btree ("email", "purpose", "verified");
