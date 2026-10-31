CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'PICKUP_EN_ROUTE', 'PICKUP_OTP_SENT', 'IN_TRANSIT', 'CUSTODY_OTP_SENT', 'IN_REPAIR', 'REPAIR_COMPLETE', 'RETURN_EN_ROUTE', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('LOGIN', 'PICKUP', 'CUSTODY');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CONSUMER', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "booking_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" text NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"triggered_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"tracking_code" text NOT NULL,
	"user_id" uuid,
	"store_id" text NOT NULL,
	"assigned_employee_id" uuid,
	"technician_id" uuid,
	"brand" text NOT NULL,
	"device_model" text NOT NULL,
	"issue_type" text NOT NULL,
	"issue_description" text,
	"scheduled_date" text NOT NULL,
	"scheduled_time" text NOT NULL,
	"pickup_lat" numeric(9, 6),
	"pickup_lng" numeric(9, 6),
	"pickup_address" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"estimated_cost_paise" integer,
	"final_cost_paise" integer,
	"payment_method" text DEFAULT 'QR',
	"payment_status" text DEFAULT 'UNPAID',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"part_name" text NOT NULL,
	"sku" text,
	"compatible_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_threshold" integer DEFAULT 5 NOT NULL,
	"unit_cost_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"phone" text,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"booking_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"address" text NOT NULL,
	"landmark" text,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"phone" text,
	"open_time" text,
	"close_time" text,
	"hours" text,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rating" numeric(3, 2) DEFAULT '4.80',
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'CONSUMER' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"google_id" text,
	"avatar_url" text,
	"store_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "booking_trail" ADD CONSTRAINT "booking_trail_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_trail" ADD CONSTRAINT "booking_trail_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_employee_id_users_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_addresses" ADD CONSTRAINT "saved_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trail_booking_id" ON "booking_trail" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_trail_created_at" ON "booking_trail" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_user_id" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_store_id" ON "bookings" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_assigned_emp" ON "bookings" USING btree ("assigned_employee_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_created_at" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_store_id" ON "inventory_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_sku" ON "inventory_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_otp_email_purpose" ON "otp_codes" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "idx_otp_booking_id" ON "otp_codes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_otp_expires_at" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_saved_addresses_user_id" ON "saved_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stores_city" ON "stores" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_stores_active" ON "stores" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_store_id" ON "users" USING btree ("store_id");