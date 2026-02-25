CREATE TABLE IF NOT EXISTS "farm_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'Ativo',
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "farm_applications" ADD COLUMN IF NOT EXISTS "equipment_id" varchar;
ALTER TABLE "farm_applications" ADD COLUMN IF NOT EXISTS "horimeter" integer;
ALTER TABLE "farm_applications" ADD COLUMN IF NOT EXISTS "odometer" integer;
ALTER TABLE "farm_applications" ALTER COLUMN "plot_id" DROP NOT NULL;

ALTER TABLE "farm_pdv_terminals" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'estoque' NOT NULL;

-- Foregin keys
DO $$ BEGIN
 ALTER TABLE "farm_equipment" ADD CONSTRAINT "farm_equipment_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "farm_applications" ADD CONSTRAINT "farm_applications_equipment_id_farm_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."farm_equipment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;