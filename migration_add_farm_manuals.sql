CREATE TABLE IF NOT EXISTS "farm_manuals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"segment" text NOT NULL,
	"content_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
