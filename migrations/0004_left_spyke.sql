CREATE TABLE "farm_accounts_payable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"invoice_id" varchar,
	"expense_id" varchar,
	"supplier" text NOT NULL,
	"description" text,
	"total_amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0',
	"currency" text DEFAULT 'USD' NOT NULL,
	"installment_number" integer DEFAULT 1,
	"total_installments" integer DEFAULT 1,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" text DEFAULT 'aberto' NOT NULL,
	"cash_transaction_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_accounts_receivable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"romaneio_id" varchar,
	"buyer" text NOT NULL,
	"description" text,
	"total_amount" numeric(15, 2) NOT NULL,
	"received_amount" numeric(15, 2) DEFAULT '0',
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" timestamp NOT NULL,
	"received_date" timestamp,
	"status" text DEFAULT 'pendente' NOT NULL,
	"cash_transaction_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_bank_statements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" text NOT NULL,
	"matched_transaction_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"import_batch" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"season_id" varchar,
	"category" text NOT NULL,
	"planned_amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_cash_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"bank_name" text,
	"account_type" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"initial_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_cash_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"payment_method" text,
	"expense_id" varchar,
	"invoice_id" varchar,
	"reference_type" text DEFAULT 'manual' NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_expense_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'saida' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_expense_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" varchar NOT NULL,
	"item_name" text NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"unit" text,
	"unit_price" numeric(15, 4) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_romaneios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"plot_id" varchar,
	"property_id" varchar,
	"season_id" varchar,
	"buyer" text NOT NULL,
	"crop" text NOT NULL,
	"delivery_date" timestamp NOT NULL,
	"gross_weight" numeric(15, 2) NOT NULL,
	"tare" numeric(15, 2) NOT NULL,
	"net_weight" numeric(15, 2) NOT NULL,
	"moisture" numeric(5, 2),
	"impurities" numeric(5, 2),
	"moisture_discount" numeric(15, 2) DEFAULT '0',
	"impurity_discount" numeric(15, 2) DEFAULT '0',
	"final_weight" numeric(15, 2) NOT NULL,
	"price_per_ton" numeric(15, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_value" numeric(15, 2),
	"truck_plate" text,
	"ticket_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_whatsapp_pending_context" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"step" text NOT NULL,
	"expense_id" varchar,
	"invoice_id" varchar,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_applications" ADD COLUMN "dose_per_ha" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "equipment_id" varchar;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "image_base64" text;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "payment_status" text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "payment_type" text DEFAULT 'a_vista' NOT NULL;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "installments" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "installments_paid" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD COLUMN "paid_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text DEFAULT 'pt-BR';--> statement-breakpoint
ALTER TABLE "farm_accounts_payable" ADD CONSTRAINT "farm_accounts_payable_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_payable" ADD CONSTRAINT "farm_accounts_payable_invoice_id_farm_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."farm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_payable" ADD CONSTRAINT "farm_accounts_payable_expense_id_farm_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."farm_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_payable" ADD CONSTRAINT "farm_accounts_payable_cash_transaction_id_farm_cash_transactions_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."farm_cash_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_receivable" ADD CONSTRAINT "farm_accounts_receivable_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_receivable" ADD CONSTRAINT "farm_accounts_receivable_romaneio_id_farm_romaneios_id_fk" FOREIGN KEY ("romaneio_id") REFERENCES "public"."farm_romaneios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_accounts_receivable" ADD CONSTRAINT "farm_accounts_receivable_cash_transaction_id_farm_cash_transactions_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."farm_cash_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_bank_statements" ADD CONSTRAINT "farm_bank_statements_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_bank_statements" ADD CONSTRAINT "farm_bank_statements_account_id_farm_cash_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."farm_cash_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_bank_statements" ADD CONSTRAINT "farm_bank_statements_matched_transaction_id_farm_cash_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."farm_cash_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_budgets" ADD CONSTRAINT "farm_budgets_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_budgets" ADD CONSTRAINT "farm_budgets_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_cash_accounts" ADD CONSTRAINT "farm_cash_accounts_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_cash_transactions" ADD CONSTRAINT "farm_cash_transactions_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_cash_transactions" ADD CONSTRAINT "farm_cash_transactions_account_id_farm_cash_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."farm_cash_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_cash_transactions" ADD CONSTRAINT "farm_cash_transactions_expense_id_farm_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."farm_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_cash_transactions" ADD CONSTRAINT "farm_cash_transactions_invoice_id_farm_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."farm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expense_categories" ADD CONSTRAINT "farm_expense_categories_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expense_items" ADD CONSTRAINT "farm_expense_items_expense_id_farm_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."farm_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD CONSTRAINT "farm_romaneios_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD CONSTRAINT "farm_romaneios_plot_id_farm_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."farm_plots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD CONSTRAINT "farm_romaneios_property_id_farm_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."farm_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_romaneios" ADD CONSTRAINT "farm_romaneios_season_id_farm_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."farm_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_whatsapp_pending_context" ADD CONSTRAINT "farm_whatsapp_pending_context_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_whatsapp_pending_context" ADD CONSTRAINT "farm_whatsapp_pending_context_expense_id_farm_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."farm_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_whatsapp_pending_context" ADD CONSTRAINT "farm_whatsapp_pending_context_invoice_id_farm_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."farm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_expenses" ADD CONSTRAINT "farm_expenses_equipment_id_farm_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."farm_equipment"("id") ON DELETE no action ON UPDATE no action;