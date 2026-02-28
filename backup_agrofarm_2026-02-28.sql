--
-- PostgreSQL database dump
--

\restrict W0fI0unebfVXSKtvdadhj4jkR5Hy9XRVRUKyN7iQJ0qPXfPUVrJzcqofrCYZ9xa

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_plan_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    plan_id character varying NOT NULL,
    consultor_id character varying NOT NULL,
    description text NOT NULL,
    category_id character varying,
    client_id character varying,
    deadline timestamp without time zone NOT NULL,
    expected_value numeric(15,2) NOT NULL,
    actual_value numeric(15,2),
    status text DEFAULT 'pendente'::text NOT NULL,
    notes text,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: action_plan_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_plan_participants (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    plan_id character varying NOT NULL,
    user_id character varying NOT NULL
);


--
-- Name: action_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_plans (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    manager_id character varying NOT NULL,
    season_id character varying NOT NULL,
    title text NOT NULL,
    meeting_date timestamp without time zone NOT NULL,
    target_amount numeric(15,2) NOT NULL,
    current_amount numeric(15,2) NOT NULL,
    status text DEFAULT 'planejado'::text NOT NULL,
    strengths text,
    challenges text,
    opportunities text,
    next_meeting_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: alert_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    goal_alerts boolean DEFAULT true NOT NULL,
    opportunity_alerts boolean DEFAULT true NOT NULL,
    season_deadline_alerts boolean DEFAULT true NOT NULL,
    goal_threshold_percent numeric(5,2) DEFAULT 80.00 NOT NULL,
    email text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    related_id character varying,
    related_type text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id character varying NOT NULL,
    changes jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    trigger text NOT NULL,
    action text NOT NULL,
    config jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: barter_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barter_products (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    principio_ativo text,
    dose_per_ha text,
    unit text NOT NULL,
    fabricante text,
    price_usd numeric(10,2) NOT NULL,
    price_vermelha numeric(10,2),
    price_amarela numeric(10,2),
    price_verde numeric(10,2),
    season_id character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: barter_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barter_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: barter_simulation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barter_simulation_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    simulation_id character varying NOT NULL,
    product_id character varying NOT NULL,
    product_name text NOT NULL,
    category text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit text NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    total_usd numeric(15,2) NOT NULL
);


--
-- Name: barter_simulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barter_simulations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    client_id character varying NOT NULL,
    client_name text NOT NULL,
    area_ha numeric(10,2) NOT NULL,
    total_usd numeric(15,2) NOT NULL,
    sack_price_usd numeric(10,2) NOT NULL,
    buffer_percentage numeric(5,2) NOT NULL,
    grain_quantity_kg numeric(15,2) NOT NULL,
    grain_quantity_sacks numeric(15,3) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    green_commission numeric(5,3) NOT NULL,
    green_margin_min numeric(5,2) NOT NULL,
    yellow_commission numeric(5,3) NOT NULL,
    yellow_margin_min numeric(5,2) NOT NULL,
    yellow_margin_max numeric(5,2) NOT NULL,
    red_commission numeric(5,3) NOT NULL,
    red_margin_min numeric(5,2) NOT NULL,
    red_margin_max numeric(5,2) NOT NULL,
    below_list_commission numeric(5,3) NOT NULL,
    default_iva numeric(4,2) DEFAULT 10.00 NOT NULL
);


--
-- Name: checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklists (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    visit_id character varying NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: client_application_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_application_tracking (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    client_id character varying NOT NULL,
    season_id character varying NOT NULL,
    global_application_id character varying NOT NULL,
    categoria text NOT NULL,
    application_number integer NOT NULL,
    total_value numeric(12,2) NOT NULL,
    status text,
    is_lost_to_competitor boolean DEFAULT false NOT NULL,
    sold_value numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: client_category_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_category_pipeline (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    category_id character varying NOT NULL,
    season_id character varying NOT NULL,
    user_id character varying NOT NULL,
    status text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: client_family_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_family_relations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    related_client_id character varying NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: client_market_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_market_rates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    category_id character varying NOT NULL,
    user_id character varying NOT NULL,
    season_id character varying NOT NULL,
    investment_per_ha numeric(10,2) NOT NULL,
    subcategories jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: client_market_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_market_values (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    category_id character varying NOT NULL,
    user_id character varying NOT NULL,
    season_id character varying NOT NULL,
    market_value numeric(12,2) DEFAULT 0.00 NOT NULL,
    subcategories jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    region_id character varying NOT NULL,
    planting_area numeric(10,2) NOT NULL,
    cultures jsonb DEFAULT '[]'::jsonb NOT NULL,
    planting_progress numeric(5,2) DEFAULT 0.00 NOT NULL,
    is_top80_20 boolean DEFAULT false NOT NULL,
    include_in_market_area boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    user_id character varying
);


--
-- Name: external_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_purchases (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    client_id character varying NOT NULL,
    category_id character varying NOT NULL,
    season_id character varying NOT NULL,
    amount numeric(15,2) NOT NULL,
    company text,
    subcategories jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: farm_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_applications (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    product_id text NOT NULL,
    plot_id text,
    property_id text NOT NULL,
    quantity numeric(15,4) NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL,
    applied_by text,
    notes text,
    synced_from_offline boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    equipment_id character varying,
    horimeter integer,
    odometer integer
);


--
-- Name: farm_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_equipment (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    farmer_id character varying NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'Ativo'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: farm_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_expenses (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    plot_id text,
    property_id text,
    category text NOT NULL,
    description text,
    amount numeric(15,2) NOT NULL,
    expense_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'confirmed'::text
);


--
-- Name: farm_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_invoice_items (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    invoice_id text NOT NULL,
    product_id text,
    product_code text,
    product_name text NOT NULL,
    unit text,
    quantity numeric(15,4) NOT NULL,
    unit_price numeric(15,4) NOT NULL,
    discount numeric(15,2) DEFAULT 0,
    total_price numeric(15,2) NOT NULL,
    batch text,
    expiry_date timestamp without time zone
);


--
-- Name: farm_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_invoices (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    invoice_number text,
    supplier text,
    issue_date timestamp without time zone,
    currency text DEFAULT 'USD'::text,
    total_amount numeric(15,2),
    status text DEFAULT 'pending'::text NOT NULL,
    raw_pdf_data text,
    created_at timestamp without time zone DEFAULT now(),
    season_id text,
    skip_stock_entry boolean DEFAULT false NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    source_email_id text,
    source_email_from text,
    pdf_base64 text
);


--
-- Name: farm_manuals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_manuals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    segment text NOT NULL,
    content_text text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: farm_pdv_terminals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_pdv_terminals (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    name text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    property_id text,
    is_online boolean DEFAULT false,
    last_heartbeat timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    type text DEFAULT 'estoque'::text NOT NULL
);


--
-- Name: farm_plots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_plots (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    property_id text NOT NULL,
    name text NOT NULL,
    area_ha numeric(12,2) NOT NULL,
    crop text,
    created_at timestamp without time zone DEFAULT now(),
    coordinates text
);


--
-- Name: farm_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_price_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    farmer_id character varying NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    supplier text,
    product_name text NOT NULL,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    active_ingredient text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: farm_products_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_products_catalog (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    dose_per_ha numeric(12,4),
    category text,
    active_ingredient text,
    created_at timestamp without time zone DEFAULT now(),
    image_url text,
    image_base64 text,
    status text DEFAULT 'active'::text NOT NULL,
    is_draft boolean DEFAULT false NOT NULL
);


--
-- Name: farm_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_properties (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    name text NOT NULL,
    location text,
    total_area_ha numeric(12,2),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: farm_seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_seasons (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    name text NOT NULL,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: farm_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_stock (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    product_id text NOT NULL,
    quantity numeric(15,4) DEFAULT 0 NOT NULL,
    average_cost numeric(15,4) DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: farm_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farm_stock_movements (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    farmer_id text NOT NULL,
    product_id text NOT NULL,
    type text NOT NULL,
    quantity numeric(15,4) NOT NULL,
    unit_cost numeric(15,4),
    reference_type text,
    reference_id text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    season_id text
);


--
-- Name: farms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.farms (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    client_id character varying NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    address text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fields (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    farm_id character varying NOT NULL,
    area numeric(10,2),
    crop text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: global_management_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_management_applications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    season_id character varying NOT NULL,
    categoria text NOT NULL,
    application_number integer NOT NULL,
    product_id character varying NOT NULL,
    price_tier text NOT NULL,
    price_per_ha numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    product_code text NOT NULL,
    product_name text NOT NULL,
    package_type text,
    quantity numeric(10,2) NOT NULL,
    uploaded_by character varying NOT NULL,
    upload_session_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: manager_team_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manager_team_rates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    manager_id character varying NOT NULL,
    season_id character varying NOT NULL,
    category_id character varying NOT NULL,
    investment_per_ha numeric(10,2) NOT NULL,
    subcategories jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: market_benchmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_benchmarks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    category_id character varying NOT NULL,
    season_id character varying NOT NULL,
    market_percentage numeric(5,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: market_investment_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_investment_rates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    category_id character varying NOT NULL,
    investment_per_ha numeric(10,2) NOT NULL,
    subcategories jsonb
);


--
-- Name: master_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_clients (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    region_id character varying,
    planting_area numeric(10,2),
    cultures jsonb DEFAULT '[]'::jsonb,
    credit_line numeric(12,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    used_at timestamp without time zone
);


--
-- Name: pending_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    product_code text NOT NULL,
    product_name text NOT NULL,
    package_type text,
    quantity_pending numeric(10,2) NOT NULL,
    client_name text NOT NULL,
    consultor_name text,
    order_code text,
    uploaded_by character varying NOT NULL,
    upload_session_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: planning_global_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_global_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    season_id uuid,
    product_ids jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: planning_products_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_products_base (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    segment text,
    dose_per_ha numeric(10,3),
    price numeric(10,2),
    unit text,
    season_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    package_size text
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_id character varying NOT NULL,
    subcategory_id character varying,
    description text,
    marca text,
    package_size numeric(10,2),
    segment text,
    timac_points numeric(10,2) DEFAULT 0.00,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: products_price_table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_price_table (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    mercaderia text NOT NULL,
    principio_ativo text,
    categoria text NOT NULL,
    subcategory text,
    dose text,
    fabricante text,
    preco_verde numeric(10,2) NOT NULL,
    preco_amarela numeric(10,2) NOT NULL,
    preco_vermelha numeric(10,2) NOT NULL,
    unidade text DEFAULT '$/ha'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    client_id character varying NOT NULL,
    season_id character varying,
    season_name text NOT NULL,
    source_file text NOT NULL,
    import_date timestamp without time zone DEFAULT now() NOT NULL,
    total_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: purchase_history_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_history_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    purchase_history_id character varying NOT NULL,
    product_code text NOT NULL,
    product_name text NOT NULL,
    package_type text,
    quantity numeric(10,2) NOT NULL,
    total_price numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    order_code text
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    country text DEFAULT 'Paraguay'::text NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    product_id character varying NOT NULL,
    category_id character varying NOT NULL,
    season_id character varying NOT NULL,
    user_id character varying NOT NULL,
    sale_date timestamp without time zone NOT NULL,
    due_date timestamp without time zone NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    quantity numeric(15,2),
    margin numeric(5,2) NOT NULL,
    iva_rate numeric(4,2) NOT NULL,
    commission_rate numeric(5,3) NOT NULL,
    commission_amount numeric(15,2) NOT NULL,
    commission_tier text NOT NULL,
    timac_points numeric(10,2),
    is_manual boolean DEFAULT false NOT NULL,
    import_batch_id character varying,
    order_code character varying,
    pdf_file_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    season_id character varying NOT NULL,
    total_sales numeric(15,2) NOT NULL,
    total_commissions numeric(15,2) NOT NULL,
    products_sold jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: sales_planning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_planning (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    user_id character varying NOT NULL,
    season_id character varying NOT NULL,
    total_planting_area numeric(10,2),
    fungicides_area numeric(10,2) DEFAULT 0.00,
    insecticides_area numeric(10,2) DEFAULT 0.00,
    herbicides_area numeric(10,2) DEFAULT 0.00,
    seed_treatment_area numeric(10,2) DEFAULT 0.00,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_planning_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_planning_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    planning_id character varying NOT NULL,
    product_id character varying NOT NULL,
    quantity numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL
);


--
-- Name: sales_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_targets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    client_id character varying NOT NULL,
    season_id character varying NOT NULL,
    segmento text NOT NULL,
    valor_capturado numeric(12,2) NOT NULL,
    subcategories jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: season_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_goals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    season_id character varying NOT NULL,
    goal_amount numeric(15,2) NOT NULL,
    meta_agroquimicos numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_especialidades numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_sementes_milho numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_sementes_soja numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_sementes_trigo numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_sementes_diversas numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_fertilizantes numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    meta_corretivos numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    user_id character varying NOT NULL
);


--
-- Name: season_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_parameters (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    due_date_month integer NOT NULL,
    due_date_day integer NOT NULL,
    label_pattern text NOT NULL
);


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    year integer NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: stock_analysis_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_analysis_results (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    product_code text NOT NULL,
    product_name text NOT NULL,
    stock_quantity numeric(10,2) NOT NULL,
    orders_quantity numeric(10,2) NOT NULL,
    status text NOT NULL,
    percentage numeric(5,2),
    clients_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    upload_session_id character varying NOT NULL,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcategories (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category_id character varying NOT NULL,
    display_order integer DEFAULT 0 NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    allow_user_registration boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: telemetry_gps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetry_gps (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    trip_id character varying,
    ts timestamp without time zone NOT NULL,
    lat numeric(10,7) NOT NULL,
    lng numeric(10,7) NOT NULL,
    speed_kmh numeric(5,2),
    accuracy_m numeric(6,2)
);


--
-- Name: timac_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timac_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    consultor_value numeric(10,2) DEFAULT 0.76 NOT NULL,
    gerentes_value numeric(10,2) DEFAULT 0.76 NOT NULL,
    faturistas_value numeric(10,2) DEFAULT 0.76 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    visit_id character varying,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    start_odometer integer,
    end_odometer integer,
    distance_km numeric(10,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: upload_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    session_name text NOT NULL,
    inventory_file_name text,
    order_files_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: user_client_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_client_links (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    master_client_id character varying NOT NULL,
    custom_name text,
    planting_area numeric(10,2),
    cultures jsonb,
    planting_progress numeric(5,2) DEFAULT 0.00,
    is_top80_20 boolean DEFAULT false NOT NULL,
    include_in_market_area boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'consultor'::text NOT NULL,
    manager_id character varying,
    whatsapp_number text,
    whatsapp_extra_numbers text,
    email text,
    document text,
    property_size numeric(12,2),
    main_culture text,
    region text,
    farm_latitude numeric(10,7),
    farm_longitude numeric(10,7),
    farm_city text,
    bulletin_enabled boolean DEFAULT true,
    invoice_email text,
    accountant_email text
);


--
-- Name: COLUMN users.whatsapp_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.whatsapp_number IS 'Número de WhatsApp do usuário no formato: 5511999999999 (sem +)';


--
-- Name: visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visits (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    farm_id character varying,
    field_id character varying,
    scheduled_at timestamp without time zone,
    window_start timestamp without time zone,
    window_end timestamp without time zone,
    status text DEFAULT 'PLANEJADA'::text NOT NULL,
    assignee character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: action_plan_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_plan_items (id, plan_id, consultor_id, description, category_id, client_id, deadline, expected_value, actual_value, status, notes, completed_at, created_at) FROM stdin;
\.


--
-- Data for Name: action_plan_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_plan_participants (id, plan_id, user_id) FROM stdin;
\.


--
-- Data for Name: action_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_plans (id, manager_id, season_id, title, meeting_date, target_amount, current_amount, status, strengths, challenges, opportunities, next_meeting_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: alert_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alert_settings (id, user_id, email_enabled, notifications_enabled, goal_alerts, opportunity_alerts, season_deadline_alerts, goal_threshold_percent, email, updated_at) FROM stdin;
\.


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alerts (id, user_id, type, title, message, severity, related_id, related_type, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, user_id, action, entity_type, entity_id, changes, created_at) FROM stdin;
\.


--
-- Data for Name: automations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.automations (id, user_id, trigger, action, config, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: barter_products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.barter_products (id, name, category, principio_ativo, dose_per_ha, unit, fabricante, price_usd, price_vermelha, price_amarela, price_verde, season_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: barter_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.barter_settings (id, key, value, description, updated_at) FROM stdin;
\.


--
-- Data for Name: barter_simulation_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.barter_simulation_items (id, simulation_id, product_id, product_name, category, quantity, unit, price_usd, total_usd) FROM stdin;
\.


--
-- Data for Name: barter_simulations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.barter_simulations (id, user_id, client_id, client_name, area_ha, total_usd, sack_price_usd, buffer_percentage, grain_quantity_kg, grain_quantity_sacks, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, type, green_commission, green_margin_min, yellow_commission, yellow_margin_min, yellow_margin_max, red_commission, red_margin_min, red_margin_max, below_list_commission, default_iva) FROM stdin;
cat-fertilizantes	Fertilizantes	fertilizantes	0.300	7.00	0.200	6.00	6.99	0.180	4.00	4.99	0.150	10.00
cat-sem-diversas	Sementes Diversas	sementes	1.000	13.00	0.700	10.00	12.99	0.400	8.00	9.99	0.150	10.00
cat-agroquimicos	Agroquímicos	agroquimicos	1.000	13.00	0.700	10.00	12.99	0.400	7.00	9.99	0.150	10.00
cat-especialidades	Especialidades	especialidades	4.000	25.00	3.000	20.00	24.99	2.000	15.00	19.99	1.000	10.00
cat-sem-trigo	Sementes Trigo	sementes	1.000	13.00	0.700	10.00	12.99	0.400	8.00	9.99	0.150	10.00
cat-sem-milho	Sementes Milho	sementes	2.500	20.00	2.000	15.00	19.99	1.500	10.00	14.99	0.500	10.00
cat-sem-soja	Sementes Soja	sementes	2.500	20.00	2.000	15.00	19.99	1.500	10.00	14.99	0.500	10.00
6704c025-303a-404a-b9a4-706c4a7358c8	Outros	outros	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
cat-corretivos	Corretivos	corretivos	0.300	7.00	0.200	6.00	6.99	0.180	4.00	4.99	0.150	10.00
a97219b6-ba11-47da-821d-fe68ad9fa4b9	DESSECAÇÃO	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
e9a85e67-3876-4bdd-aef5-f1d549772a71	INSETICIDAS	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
0e9176a0-ddf6-4768-b708-17fd37af7d82	Inseticida	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	Fungicida	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
8b1c8883-111e-4f4d-a395-bc32ac42aee5	Herbicida (não recomendado para soja)	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
a3f5cd8f-e9cf-48ec-a19e-d714b254312b	FUNGICIDAS	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
c4aeda2a-63a3-4644-a6be-455c0fb64f84	Herbicida	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
73150ef0-92a3-4605-aff6-e4207ccb0503	Inseticida (tratamento de sementes)	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
ada9b09c-0f76-49d4-b7be-186be1e4865c	Herbicida (Dessecação)	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
794b31aa-0c80-4bdf-9b89-0c8453ee4b6a	Aditivo (óleo metilado)	agroquimicos	0.000	0.00	0.000	0.00	0.00	0.000	0.00	0.00	0.000	10.00
\.


--
-- Data for Name: checklists; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.checklists (id, visit_id, data, created_at) FROM stdin;
\.


--
-- Data for Name: client_application_tracking; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_application_tracking (id, user_id, client_id, season_id, global_application_id, categoria, application_number, total_value, status, is_lost_to_competitor, sold_value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: client_category_pipeline; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_category_pipeline (id, client_id, category_id, season_id, user_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: client_family_relations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_family_relations (id, client_id, related_client_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: client_market_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_market_rates (id, client_id, category_id, user_id, season_id, investment_per_ha, subcategories, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: client_market_values; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_market_values (id, client_id, category_id, user_id, season_id, market_value, subcategories, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, region_id, planting_area, cultures, planting_progress, is_top80_20, include_in_market_area, is_active, user_id) FROM stdin;
\.


--
-- Data for Name: external_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.external_purchases (id, user_id, client_id, category_id, season_id, amount, company, subcategories, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: farm_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_applications (id, farmer_id, product_id, plot_id, property_id, quantity, applied_at, applied_by, notes, synced_from_offline, created_at, equipment_id, horimeter, odometer) FROM stdin;
2cb0e821-2367-4776-a716-c78315032870	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-11 21:28:21.023	PDV	\N	f	2026-02-11 21:28:21.022953	\N	\N	\N
0cfbb3a1-651c-41ae-bd48-6f6124c1586b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	200.0000	2026-02-11 21:28:21.977	PDV	\N	f	2026-02-11 21:28:21.977746	\N	\N	\N
79bb1bda-76b2-4e35-81f5-459fe0117012	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 16:32:55.9	PDV		f	2026-02-12 16:32:55.901548	\N	\N	\N
467f32d4-9cf3-470f-9452-a7a16cc699c3	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 16:32:56.126	PDV	\N	f	2026-02-12 16:32:56.126499	\N	\N	\N
b24d8872-1ebf-4f24-b152-02195b828ea0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 16:56:15.792	PDV		f	2026-02-12 16:56:15.794255	\N	\N	\N
27857eba-1c56-4d2a-b295-4c2e620fa3cf	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 16:56:16.003	PDV	\N	f	2026-02-12 16:56:16.004983	\N	\N	\N
230a2803-50ad-4eaf-8c31-e24d7dc784b9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 16:57:42.278	PDV		f	2026-02-12 16:57:42.27901	\N	\N	\N
24d03b70-9c9c-40d0-9fd9-ca723e5c926f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 17:35:47.143	PDV		f	2026-02-12 17:35:47.145267	\N	\N	\N
b204ed2b-4669-449b-9a97-08efe39bb9a1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 17:35:47.334	PDV	\N	f	2026-02-12 17:35:47.334534	\N	\N	\N
f106d404-5828-493e-847d-6bc328b32478	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 17:35:47.515	PDV	\N	f	2026-02-12 17:35:47.515995	\N	\N	\N
4e5023c1-2b43-4b1d-8f6c-3fac985b2c2d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-12 17:35:47.698	PDV	\N	f	2026-02-12 17:35:47.699223	\N	\N	\N
ca9a8221-728a-4d33-b67c-7d53e2ea54fb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-12 21:50:15.992	PDV		f	2026-02-12 21:50:15.993918	\N	\N	\N
cf3895c1-27ce-437f-9cdc-bb6a75f5aa69	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-12 21:50:16.175	PDV	\N	f	2026-02-12 21:50:16.176448	\N	\N	\N
65e4e331-a258-4b21-aa59-2f21c0a72241	53d9be2f-7343-4c53-89ee-b6e886daf5fb	dfa2a7ef-f2ff-4193-8989-581573145a67	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	10.0000	2026-02-13 02:56:19.896	PDV		f	2026-02-13 02:56:19.900445	\N	\N	\N
58f7b2a1-2d9a-48a2-8371-9affeebe6b09	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 11:40:42.553	PDV		f	2026-02-13 11:40:42.553208	\N	\N	\N
2e0d7ab1-64c1-4f41-aef5-961021e654d0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 11:40:42.937	PDV	\N	f	2026-02-13 11:40:42.932371	\N	\N	\N
bbe13ead-159c-48b3-a7dc-13baab82435b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 13:11:32.333	PDV		f	2026-02-13 13:11:32.326637	\N	\N	\N
b559076c-13c6-47fa-8dca-8129dbb646e1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 13:11:32.592	PDV	\N	f	2026-02-13 13:11:32.58547	\N	\N	\N
e17f8c62-fbd4-485d-838e-7635f9ccb315	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-13 17:28:53.572	PDV		f	2026-02-13 17:28:53.57475	\N	\N	\N
41305e50-d191-45ad-bd7f-610a8456549e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-13 17:28:53.898	PDV	\N	f	2026-02-13 17:28:53.900586	\N	\N	\N
6f237869-9c88-42f9-942e-8058f146d8d2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-13 17:28:54.1	PDV	\N	f	2026-02-13 17:28:54.104083	\N	\N	\N
f8e1dc49-77cf-4e00-b9e7-46d828bb671e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 22:28:04.025	PDV		f	2026-02-13 22:28:04.031646	\N	\N	\N
4ee03ad3-f88b-414e-98b6-5a0bc43eb084	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-13 22:28:04.337	PDV	\N	f	2026-02-13 22:28:04.341544	\N	\N	\N
b0a5eec2-0eda-482d-a81b-7c920a161076	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 02:12:55.754	PDV		f	2026-02-15 02:12:55.757088	\N	\N	\N
8b5a7aec-8d6c-495b-bdee-11fb88003f58	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 02:12:55.978	PDV	\N	f	2026-02-15 02:12:55.979964	\N	\N	\N
47e00e49-e99f-4afe-ae64-d8ac07c3e875	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 02:13:53.817	PDV		f	2026-02-15 02:13:53.818942	\N	\N	\N
3684ed0e-7ec8-441c-beba-fd8be41c4f60	53d9be2f-7343-4c53-89ee-b6e886daf5fb	29e3eff9-f2be-483e-bf85-48620e4cdf92	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 02:13:54.04	PDV	\N	f	2026-02-15 02:13:54.042474	\N	\N	\N
2de2a5db-81da-454c-8c83-1a4aacf8ca57	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-15 02:48:41.118	PDV		f	2026-02-15 02:48:41.119655	\N	\N	\N
15021ae9-0856-4924-817b-c94d105edb97	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 03:10:05.556	PDV		f	2026-02-15 03:10:05.56415	\N	\N	\N
623cfc10-977d-46ce-9a21-837a792fb21c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 03:11:53.658	PDV		f	2026-02-15 03:11:53.665757	\N	\N	\N
3d6a093d-d383-4ced-a4e8-94078c42df94	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-15 14:28:30.546	PDV		f	2026-02-15 14:28:30.542159	\N	\N	\N
90373ee2-46ab-41be-8500-f67f95873b03	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	200.0000	2026-02-17 12:57:27.744	PDV		f	2026-02-17 12:57:27.7478	\N	\N	\N
9c5b58ba-8d54-433c-8124-7b6b3a24f406	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-17 12:57:27.935	PDV	\N	f	2026-02-17 12:57:27.934876	\N	\N	\N
90fb3308-919e-4515-a279-f3e933fe393e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	3.0000	2026-02-17 13:01:43.057	PDV		f	2026-02-17 13:01:43.056679	\N	\N	\N
39b05c17-de6d-48e6-9bb3-8f9292086559	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-17 13:16:09.97	PDV		f	2026-02-17 13:16:09.966828	\N	\N	\N
ed4e6d31-80a6-4d6f-847a-d1d4fbe2d879	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-17 13:16:10.149	PDV	\N	f	2026-02-17 13:16:10.145813	\N	\N	\N
476732ad-a77a-4b83-a6d0-c59164acca5a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	42.0000	2026-02-19 11:25:47.682	PDV		f	2026-02-19 11:25:47.679321	\N	\N	\N
e9f47b2d-0dff-4de9-862a-d237f53cc824	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	58.0000	2026-02-19 11:25:47.916	PDV	\N	f	2026-02-19 11:25:47.91302	\N	\N	\N
94405fce-3702-4bf4-946d-54209188efac	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	50.0000	2026-02-19 11:25:48.124	PDV	\N	f	2026-02-19 11:25:48.121304	\N	\N	\N
cc98e2d9-47d6-45dc-b2e0-f0fa951ead03	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	50.0000	2026-02-19 11:25:48.294	PDV	\N	f	2026-02-19 11:25:48.290945	\N	\N	\N
eab2ec83-af44-47b1-9a5f-bd38279b1c77	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-20 00:14:50.775	PDV		f	2026-02-20 00:14:50.776753	\N	\N	\N
8980e04e-a1d0-4dad-a361-f4a501a65123	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-20 02:19:16.456	PDV		f	2026-02-20 02:19:16.464272	\N	\N	\N
c389c35c-e07c-47a8-963a-f66d01952904	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	140.0000	2026-02-20 03:17:26.592	PDV		f	2026-02-20 03:17:26.59421	\N	\N	\N
333b02bc-5e05-44bb-b77e-75d369e88250	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	10.0000	2026-02-20 03:34:10.185	PDV		f	2026-02-20 03:34:10.18903	\N	\N	\N
f7ce7ae4-1bee-4835-b800-ac1af3234613	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	10.0000	2026-02-20 03:34:10.419	PDV	\N	f	2026-02-20 03:34:10.421107	\N	\N	\N
0ff4031b-cffe-45f1-92c1-930eebeeb1c5	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-20 10:54:02.377	PDV		f	2026-02-20 10:54:02.378775	\N	\N	\N
88011d51-a7ad-4fa6-80b5-7c4459fa67ce	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	30.0000	2026-02-21 01:56:03.117	PDV		f	2026-02-21 01:56:03.120592	\N	\N	\N
f0ee37c8-a96e-4ba6-b2bb-f07df47565e2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-21 16:19:52.392	PDV		f	2026-02-21 16:19:52.394611	\N	\N	\N
262f21e7-04c7-4f76-a9cd-059305ceaa24	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	5.0000	2026-02-21 16:35:47.05	PDV		f	2026-02-21 16:35:47.056051	\N	\N	\N
41638b09-9479-470a-b57f-946556b0d5d4	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-21 16:54:06.71	PDV		f	2026-02-21 16:54:06.712547	\N	\N	\N
8643438d-6fbd-4a56-ac63-19313dacba9f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-21 23:47:35.734	PDV		f	2026-02-21 23:47:35.735149	\N	\N	\N
f6d22289-53ed-4cce-86f3-bcb500ada284	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	1.0000	2026-02-23 01:06:40.799	PDV		f	2026-02-23 01:06:40.801218	\N	\N	\N
61b96dcd-725c-4728-8b9f-720a94df0fb9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	50.0000	2026-02-23 18:03:34.204	PDV		f	2026-02-23 18:03:34.206405	\N	\N	\N
f8f18bf5-9b90-4f5d-a558-bd0d350dc567	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	50.0000	2026-02-23 18:03:34.396	PDV	\N	f	2026-02-23 18:03:34.397635	\N	\N	\N
3dac4355-cc9e-4f33-b021-9deb47a7a050	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	3.0000	2026-02-23 18:03:34.582	PDV	\N	f	2026-02-23 18:03:34.583063	\N	\N	\N
304e3446-d776-4cad-90ba-4c3c53ec4763	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	2.0000	2026-02-23 18:03:34.779	PDV	\N	f	2026-02-23 18:03:34.782777	\N	\N	\N
32428987-d362-46d8-937b-3f2fda2fcb23	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-24 12:57:24.215	PDV		f	2026-02-24 12:57:24.213794	\N	\N	\N
e1a87db2-6dc2-4659-b800-8fe1947ddabe	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	3.0000	2026-02-24 13:07:21.229	PDV		f	2026-02-24 13:07:21.227513	\N	\N	\N
29908651-21cb-4f54-b09a-c31fe435e9af	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-24 13:40:21.776	PDV		f	2026-02-24 13:40:21.776004	\N	\N	\N
4cbc49d5-54ee-49ce-88a0-567e69a8e561	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	200.0000	2026-02-24 13:41:14.349	PDV		f	2026-02-24 13:41:14.349574	\N	\N	\N
daee585e-30a4-495f-bc8d-cc126350079c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-25 12:08:22.48	PDV		f	2026-02-25 12:08:22.49005	\N	\N	\N
f8dc2c3d-37bf-4f91-a83e-0b9b8a8919cc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-25 13:28:36.805	PDV		f	2026-02-25 13:28:36.81299	\N	\N	\N
d67f8c63-03c9-4c29-8999-a3cc12e0d519	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	10.0000	2026-02-25 17:51:00.92	PDV		f	2026-02-25 17:51:00.919017	\N	\N	\N
908ba1f6-fa5d-47f9-b6df-16b865945b70	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2c15dd42-d6a8-41fd-86a7-6050ed111ab1	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	10.0000	2026-02-26 01:04:46.902	PDV		f	2026-02-26 01:04:46.906279	\N	\N	\N
1332e170-4f7e-412d-aa5a-88bbf0e59877	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	58.0000	2026-02-26 19:51:49.042	PDV		f	2026-02-26 19:51:49.050335	\N	\N	\N
92c1a23c-6be4-4bab-bc66-b454d1158220	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	42.0000	2026-02-26 19:51:49.63	PDV	\N	f	2026-02-26 19:51:49.635536	\N	\N	\N
a9834b5f-7770-4b2e-8782-7a19bbf73a7d	b1f7c63d-e398-42fc-893c-733221086476	70211750-9cd3-4b50-aeb0-5e370783c55f	3ae46447-1724-4015-a161-cc8aa4c5dd26	8fea32a5-5604-42cd-a3cd-62e126c49fee	3.0000	2026-02-27 12:44:55.976	PDV		f	2026-02-27 12:44:55.990946	\N	\N	\N
dd747825-d3a8-43fb-b45d-c64e17b5373f	b1f7c63d-e398-42fc-893c-733221086476	f90f1c7a-33e8-4ca7-ae20-b733790a3d30	3ae46447-1724-4015-a161-cc8aa4c5dd26	8fea32a5-5604-42cd-a3cd-62e126c49fee	4.0000	2026-02-27 12:44:56.183	PDV	\N	f	2026-02-27 12:44:56.195961	\N	\N	\N
cfc9eb30-1c70-4ef7-9748-b5efc504d39c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-27 15:16:06.138	PDV		f	2026-02-27 15:16:06.150593	\N	\N	\N
c9e33a18-2f9a-4859-a78a-a964b7075d16	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	100.0000	2026-02-27 17:33:38.283	PDV		f	2026-02-27 17:33:38.285411	\N	\N	\N
\.


--
-- Data for Name: farm_equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_equipment (id, farmer_id, name, type, status, created_at) FROM stdin;
1857336e-c937-4658-9439-9dfade7a7019	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Johm Deere 5630	Trator	Ativo	2026-02-26 01:00:58.154136
\.


--
-- Data for Name: farm_expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_expenses (id, farmer_id, plot_id, property_id, category, description, amount, expense_date, created_at, status) FROM stdin;
\.


--
-- Data for Name: farm_invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_invoice_items (id, invoice_id, product_id, product_code, product_name, unit, quantity, unit_price, discount, total_price, batch, expiry_date) FROM stdin;
50a02517-7274-4d34-906d-e7fd8d1805e9	f5b59084-34c4-4373-b4ba-3e8ce07fe792	e07176ba-6431-4768-a5bd-2cdd8e151d80	\N	GLIFOGROP FUL DMA - 20LTS	LT	125.0000	67.6000	0.00	8450.00	C4695/25	\N
c9e6ef9e-ff20-4bef-9222-7dda03cdab6b	f5b59084-34c4-4373-b4ba-3e8ce07fe792	29e3eff9-f2be-483e-bf85-48620e4cdf92	\N	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	\N
9ae9e38b-a6de-4793-a2eb-1bd92c5358a9	f5b59084-34c4-4373-b4ba-3e8ce07fe792	89030455-82c7-4cba-96a1-8e8543ab3b1f	\N	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	60.0000	100.0000	0.00	6000.00	PJF240088-1	\N
c44e670a-35e2-4c7f-8623-5b831be7ed22	f5b59084-34c4-4373-b4ba-3e8ce07fe792	57e58101-08e8-4f23-b74c-33060547e5f2	\N	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	29.0000	156.0000	0.00	4524.00	20240515	\N
18fc55e3-9708-4b1b-b29b-07d388a36452	f5b59084-34c4-4373-b4ba-3e8ce07fe792	ec245551-8240-4165-b9c8-fc441671b17c	\N	CENTURION- CLETODIM 24%- 5 LTS.	UNI	280.0000	32.5000	0.00	9100.00	20250510	\N
179d0f66-83ad-4802-b15d-99dde8b47f1b	f5b59084-34c4-4373-b4ba-3e8ce07fe792	ecbbde55-7311-4124-9587-588dd1671bf9	\N	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	25.0000	55.0000	0.00	1375.00	548/25	\N
eca59bcc-f4fd-4d76-bda2-34a47ab5962d	9ee55fa5-5848-4882-b9a6-584c803e3bbd	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	\N	CONTACT 72 - 20LTS	LT	5.0000	110.0000	0.00	550.00	3524/25	\N
741b0cea-a433-437b-a529-2092361ed2ce	9ee55fa5-5848-4882-b9a6-584c803e3bbd	dfa2a7ef-f2ff-4193-8989-581573145a67	\N	SPHERE MAX SC - 5LTS	UNI	2.0000	290.0000	0.00	580.00	LA40007795	\N
8b1f8d9c-9768-4b1f-af0b-1df6da89d92b	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	e07176ba-6431-4768-a5bd-2cdd8e151d80	922019	GLIFOGROP FUL DMA - 20LTS	LT	2500.0000	3.3800	0.00	8450.00	C4695/25	2028-08-18 00:00:00
42a2b618-3d50-4a18-a240-1b5d7a5096da	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	29e3eff9-f2be-483e-bf85-48620e4cdf92	925258	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	2027-05-25 00:00:00
e42a54a1-7a41-4baf-9c87-3b1743fbe8aa	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	89030455-82c7-4cba-96a1-8e8543ab3b1f	925420	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	300.0000	20.0000	0.00	6000.00	PJF240088-1	2026-05-05 00:00:00
587c392c-2e55-47f9-8dda-c12721319e5b	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	57e58101-08e8-4f23-b74c-33060547e5f2	925380	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	580.0000	7.8000	0.00	4524.00	20240515	2026-05-14 00:00:00
2fe59fc1-b275-4466-bca0-820ffb7a8d61	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	ec245551-8240-4165-b9c8-fc441671b17c	925164	CENTURION- CLETODIM 24%- 5 LTS.	UNI	1400.0000	6.5000	0.00	9100.00	20250510	2027-05-09 00:00:00
d8933afb-8895-4bc2-aeb1-2b992fc5d2ca	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	ecbbde55-7311-4124-9587-588dd1671bf9	921273	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	500.0000	2.7500	0.00	1375.00	548/25	2030-06-01 00:00:00
b7bf1e0c-fa0d-40b4-8a29-3f1088a44f58	be256ffd-aac0-4650-835b-a33a83370c5c	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	924877	CONTACT 72 - 20LTS	LT	100.0000	5.5000	0.00	550.00	3524/25	2027-11-30 00:00:00
5936e33f-475b-4766-b4a0-d1cb7d5283d3	be256ffd-aac0-4650-835b-a33a83370c5c	dfa2a7ef-f2ff-4193-8989-581573145a67	921400	SPHERE MAX SC - 5LTS	UNI	10.0000	58.0000	0.00	580.00	LA40007795	2029-07-18 00:00:00
d968a22e-3a3c-4cfb-b33a-29981ce5a3ed	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	cea6052e-f6fa-47c2-ac3d-30ee483ce887	924616	ONLY 75 WG-1KG	UNI	21.0000	10.0000	0.00	210.00	\N	\N
57fbb3ec-ced8-4bc9-b184-f0ff7df6ca4d	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	6089865b-4aac-433b-a750-c7db5f6e84ca	924261	AMPLIGO - 1L	LT	120.0000	30.0000	0.00	3600.00	\N	\N
c29cd527-eef9-4b31-af5b-c4ce198625dd	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	4dec0a65-f945-47a5-b3cf-831f389348b9	924919	PIXXARO-5LTS	UNI	5.0000	42.0000	0.00	210.00	\N	\N
bb9a6218-ee59-4259-865a-0e9bd6f35473	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	ecbbde55-7311-4124-9587-588dd1671bf9	921273	2,4 D 72% -2,4 D AMINA TM-20LTS	LT	80.0000	2.9000	0.00	232.00	\N	\N
05604dde-12a1-463c-b9cf-5e5b013b6dc2	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	921336	HUSSAR EVOLUTION EC 96-5 LTS	UNI	25.0000	15.0000	0.00	375.00	\N	\N
ea5784ea-7949-431a-921e-d9405653a729	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	89030455-82c7-4cba-96a1-8e8543ab3b1f	925420	EXTRAZONE- SULFENTRAZONE 50%-5LT	UNI	25.0000	18.0000	0.00	450.00	\N	\N
c01d10a7-237d-417f-abbc-f539daddfe9c	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	d920bc05-6b7f-4e76-9741-8bca2b12d81c	925333	DANKE-DIFENO 20%+ TEBUCO 20%-5LTS.	UNI	5.0000	7.0000	0.00	35.00	\N	\N
15044dd5-3cc1-4d27-9886-bce73dee9be6	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	2c15dd42-d6a8-41fd-86a7-6050ed111ab1	924642	KURIN 48-5LTS	UNI	60.0000	15.0000	0.00	900.00	\N	\N
d4016ebc-7a00-4386-af88-86a75a6b2f37	1228a1a3-9fec-4363-98da-ee79f1bc96e4	e07176ba-6431-4768-a5bd-2cdd8e151d80	922019	GLIFOGROP FUL DMA - 20LTS	LT	2500.0000	3.3800	0.00	8450.00	C4695/25	2028-08-18 00:00:00
2e18a127-e672-4fd2-9f55-802f263d9f48	1228a1a3-9fec-4363-98da-ee79f1bc96e4	29e3eff9-f2be-483e-bf85-48620e4cdf92	925258	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	2027-05-25 00:00:00
5ef0c239-bd6e-4f7a-ae36-dbb0b094f013	1228a1a3-9fec-4363-98da-ee79f1bc96e4	89030455-82c7-4cba-96a1-8e8543ab3b1f	925420	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	300.0000	20.0000	0.00	6000.00	PJF240088-1	2026-05-05 00:00:00
771ea87c-e2fd-4ca1-8f29-d5b6ad76574e	1228a1a3-9fec-4363-98da-ee79f1bc96e4	57e58101-08e8-4f23-b74c-33060547e5f2	925380	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	580.0000	7.8000	0.00	4524.00	20240515	2026-05-14 00:00:00
4dfab00d-bf56-46ee-87b4-922c482e6d54	1228a1a3-9fec-4363-98da-ee79f1bc96e4	ec245551-8240-4165-b9c8-fc441671b17c	925164	CENTURION- CLETODIM 24%- 5 LTS.	UNI	1400.0000	6.5000	0.00	9100.00	20250510	2027-05-09 00:00:00
be80ce9e-eb57-4c8b-a698-8e9964046873	1228a1a3-9fec-4363-98da-ee79f1bc96e4	ecbbde55-7311-4124-9587-588dd1671bf9	921273	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	500.0000	2.7500	0.00	1375.00	548/25	2030-06-01 00:00:00
e5a9922b-3b78-46de-8c52-1881f5146899	5c045cae-98c7-44e9-a808-fff518aa6580	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	\N	CONTACT 72 - 20LTS	LT	5.0000	110.0000	0.00	550.00	3524/25	\N
8a53394d-41bf-4595-8ce8-bc2f665c55d1	5c045cae-98c7-44e9-a808-fff518aa6580	dfa2a7ef-f2ff-4193-8989-581573145a67	\N	SPHERE MAX SC - 5LTS	UNI	2.0000	290.0000	0.00	580.00	LA40007795	\N
dbc991b4-ceb6-4008-a137-ca459327df94	cfa6b822-6425-44ae-ae5a-50ae382d1525	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	\N	CONTACT 72 - 20LTS	LT	5.0000	110.0000	0.00	550.00	3524/25	\N
d4e8f991-68ea-4fe7-8215-1b0051eacd8b	cfa6b822-6425-44ae-ae5a-50ae382d1525	dfa2a7ef-f2ff-4193-8989-581573145a67	\N	SPHERE MAX SC - 5LTS	UNI	2.0000	290.0000	0.00	580.00	LA40007795	\N
241f4783-5236-4417-8871-c1f765eeac03	49fa3336-d723-4112-9786-7f573f1455a1	bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	924801	FERT PHYSALG LITHOFORTE - TIMAC - BB	KG	40.0000	0.8800	0.00	35200.00	\N	\N
a08d263f-64b7-42e1-9a82-f5e2911fbbfe	8a401e27-ae99-4f10-924e-82085485fd36	ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	924476	PARAGROP 24 - 20LTS	LT	500.0000	2.2000	0.00	1100.00	\N	\N
1fd03ea6-dbe5-4219-bd5c-fcee9507d497	72c4b852-48ed-4445-82c9-9f21828b1724	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	924877	CONTACT 72 - 20LTS	LT	100.0000	5.5000	0.00	550.00	3524/25	2027-11-30 00:00:00
9ef4b42c-be1c-4e66-8d6f-5d6aadf34054	72c4b852-48ed-4445-82c9-9f21828b1724	dfa2a7ef-f2ff-4193-8989-581573145a67	921400	SPHERE MAX SC - 5LTS	UNI	10.0000	58.0000	0.00	580.00	LA40007795	2029-07-18 00:00:00
7d25e7c9-bb91-4474-bd35-7c8a073ebf4f	35be8657-7e6c-43a0-8e9b-e98285539c08	e07176ba-6431-4768-a5bd-2cdd8e151d80	922019	GLIFOGROP FUL DMA - 20LTS	LT	2500.0000	3.3800	0.00	8450.00	C4695/25	2028-08-18 00:00:00
6743b9fd-1765-4d2d-af8e-12d763510bd4	35be8657-7e6c-43a0-8e9b-e98285539c08	29e3eff9-f2be-483e-bf85-48620e4cdf92	925258	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	2027-05-25 00:00:00
e64fafb7-0509-45e8-9c60-f868a16af96a	35be8657-7e6c-43a0-8e9b-e98285539c08	89030455-82c7-4cba-96a1-8e8543ab3b1f	925420	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	300.0000	20.0000	0.00	6000.00	PJF240088-1	2026-05-05 00:00:00
211689ea-f0f6-489a-b66c-cfd6bbb2d320	35be8657-7e6c-43a0-8e9b-e98285539c08	57e58101-08e8-4f23-b74c-33060547e5f2	925380	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	580.0000	7.8000	0.00	4524.00	20240515	2026-05-14 00:00:00
3d5a0151-04c8-4128-bb98-997fa33ee10b	35be8657-7e6c-43a0-8e9b-e98285539c08	ec245551-8240-4165-b9c8-fc441671b17c	925164	CENTURION- CLETODIM 24%- 5 LTS.	UNI	1400.0000	6.5000	0.00	9100.00	20250510	2027-05-09 00:00:00
0b937463-6b06-42f8-b29d-b94f39d4cb45	35be8657-7e6c-43a0-8e9b-e98285539c08	ecbbde55-7311-4124-9587-588dd1671bf9	921273	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	500.0000	2.7500	0.00	1375.00	548/25	2030-06-01 00:00:00
696dd811-77c5-43f8-98a8-b2b6e73fad32	b5796412-4eec-4d1b-bc97-96a5556daa9d	0a8a5127-d7f0-4a39-bd1e-55f18b323ae7	924908	DERMACOR-1L	LT	10.0000	140.0000	0.00	1400.00	\N	\N
fb6c147b-5eb1-47cb-a030-c588927830b8	46010e20-59b9-417b-afb4-44110ae4165a	57e58101-08e8-4f23-b74c-33060547e5f2	925380	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	160.0000	7.8000	0.00	1248.00	\N	\N
bd0cbdfb-9b41-4266-9dfd-c21498512238	46010e20-59b9-417b-afb4-44110ae4165a	bbc3fa23-bb42-4267-94e3-d02ba049e3c8	924642	KURIN 48 - 5LTS	UNI	15.0000	18.8000	0.00	282.00	C4534/25	2027-07-14 00:00:00
4b1f04e6-348b-4045-9705-09dae976ab8c	785a478c-a6d8-453f-826b-fa43a7460c20	c94e57d4-8a9b-4afd-a43b-e6a378bae500		(38)BIFENTAM 40 MAX_(BIFENTRINA 40%)	LT	1500.0000	13.2000	0.00	0.00	\N	\N
e5bd9efa-8140-4d9d-937e-1a63788b9778	567b07a9-0266-45fb-977e-eb95afaa5bc1	e07176ba-6431-4768-a5bd-2cdd8e151d80	\N	GLIFOGROP FUL DMA - 20LTS	LT	125.0000	67.6000	0.00	8450.00	C4695/25	\N
9a4fc843-dbcb-4bb1-90d2-6608ee60f094	567b07a9-0266-45fb-977e-eb95afaa5bc1	29e3eff9-f2be-483e-bf85-48620e4cdf92	\N	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	\N
093730ff-d01b-4b05-a8e4-f65990fc0a06	567b07a9-0266-45fb-977e-eb95afaa5bc1	89030455-82c7-4cba-96a1-8e8543ab3b1f	\N	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	60.0000	100.0000	0.00	6000.00	PJF240088-1	\N
02830114-40b6-4eb8-bffe-a8afbcc978be	567b07a9-0266-45fb-977e-eb95afaa5bc1	57e58101-08e8-4f23-b74c-33060547e5f2	\N	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	29.0000	156.0000	0.00	4524.00	20240515	\N
cc3233ed-66fe-41f5-bda3-42ca1e929d6d	567b07a9-0266-45fb-977e-eb95afaa5bc1	ec245551-8240-4165-b9c8-fc441671b17c	\N	CENTURION- CLETODIM 24%- 5 LTS.	UNI	280.0000	32.5000	0.00	9100.00	20250510	\N
e608aed3-7a29-4afe-b02a-194b51cdfa43	567b07a9-0266-45fb-977e-eb95afaa5bc1	ecbbde55-7311-4124-9587-588dd1671bf9	\N	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	25.0000	55.0000	0.00	1375.00	548/25	\N
d6bfd39a-19f9-421c-a40f-80eb3e9ff8aa	51a78790-8348-4ffa-a6de-2bbb54db94aa	e07176ba-6431-4768-a5bd-2cdd8e151d80	922019	GLIFOGROP FUL DMA - 20LTS	LT	2500.0000	3.3800	0.00	8450.00	C4695/25	2028-08-18 00:00:00
b0667161-8c38-44e7-971c-27f035429b63	51a78790-8348-4ffa-a6de-2bbb54db94aa	251c1ac5-8cec-4654-81f2-a0675563799d	925258	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	12.0000	94.0000	0.00	1128.00	25052601	2027-05-25 00:00:00
5a2c23f7-0b28-4a3b-9640-951768c17011	51a78790-8348-4ffa-a6de-2bbb54db94aa	89030455-82c7-4cba-96a1-8e8543ab3b1f	925420	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	300.0000	20.0000	0.00	6000.00	PJF240088-1	2026-05-05 00:00:00
d753ff7d-6d21-4caa-bef4-843662b0d76f	51a78790-8348-4ffa-a6de-2bbb54db94aa	57e58101-08e8-4f23-b74c-33060547e5f2	925380	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	580.0000	7.8000	0.00	4524.00	20240515	2026-05-14 00:00:00
e54c1b68-ab74-4ce4-ad83-25a6ddf13aa5	51a78790-8348-4ffa-a6de-2bbb54db94aa	ec245551-8240-4165-b9c8-fc441671b17c	925164	CENTURION- CLETODIM 24%- 5 LTS.	UNI	1400.0000	6.5000	0.00	9100.00	20250510	2027-05-09 00:00:00
493d22f1-e593-431e-8b05-2179e6b8e632	51a78790-8348-4ffa-a6de-2bbb54db94aa	ecbbde55-7311-4124-9587-588dd1671bf9	921273	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	500.0000	2.7500	0.00	1375.00	548/25	2030-06-01 00:00:00
47ba8de5-8c82-4ff7-a0b4-5645b24fb49d	4a0fe410-5e29-403a-947a-dce14f707e26	f90f1c7a-33e8-4ca7-ae20-b733790a3d30	45689	DULIA BIO	LT	4.0000	150.0000	0.00	0.00	\N	\N
8520b59c-43cc-405a-a263-99b60e3ec361	4a0fe410-5e29-403a-947a-dce14f707e26	70211750-9cd3-4b50-aeb0-5e370783c55f	45690	CONGREGGA PRO	KG	3.0000	80.0000	0.00	0.00	\N	\N
\.


--
-- Data for Name: farm_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_invoices (id, farmer_id, invoice_number, supplier, issue_date, currency, total_amount, status, raw_pdf_data, created_at, season_id, skip_stock_entry, source, source_email_id, source_email_from, pdf_base64) FROM stdin;
8d301f1a-b354-4ff9-b4ab-6fc1c7818bde	c80eb6a1-51de-4d27-b6ab-9ce7667c5718	16120194	C.VALE SA	2026-02-05 00:00:00	USD	0.00	confirmed	e-vale\nKuOE de F1ctur1 El1ctr6nlc1\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRICOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI • CANINDEYU\nTelffono: 0983191051\nEmall: cvaleeeQcvale.com.py\nREG. SENAVE: 1018\nNombre o Razón Soclal: SERGIO DE JESUS PIRES DE ALMEIDA\nRUCIOocumento de ldtntldad NO: 2408547-2\nFecha y hora: 05-02-2026 15:16:05\nDlrtcclón : CORPUS CHRISTI\nTelefono: +595973884413\nCorreo Elec:trônlco: facturas@grupoplresagto.com\nCod. Descrlpcl6n\n92.008 OERMACOR • 1L\nl"edklo: 9251808021095\n"9glltn, SEN~W: 00000000000000006, 27\nLote C.ntld1d Venclmlento\n~ 28871<05\nSub Total:\noescuento global:\nCondlclón de Venta: Crédito\nMoneda: us Dollar Cambio: 6602\nOperaclón: Venta de mercadería\nCuot11: 1 Venclmlento: 31-08-2026\nUNI Cantldad Preclo Unltarfo Dtscuento\nLT 10 140,00\nTotal a pagar Dólares Americanos· Mil cuatrocientos\nTotal en guaraníes\nLiquídación IVA (5%) 0,00 (10%) 127,27\nConsulte esta Factura Electr6nica con el número lmpreso abajo:\nhttps://ekuatla.set.gov.py/consultas/0180029558700500100055032202602051375684221 o\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nRUC: 80029558-7\nTimbrado Nº: 16120194\nInicio de vlgencla: 03-01·2023\nCódigo Interno: 127261\nFACTURA ELECTRÔNICA\nNº: 005-001-0005503\nValor de Venta\nExentas 10-1.\n1.400,00\n1.400,00\n1.400.00\n9.242.800\nTotal IVA 127,27\nSi su documento electróníco presenta a/gun e solicitar la cancelacíón dentro de las 48 horas síguientes de la emisión de este\ncomprobante.\nredy2f,by o,.\nJ;- oi,, ?-6\nSistema proveido por l)atapar\nPágina 1 de 1\n\n	2026-02-11 13:42:57.404404	\N	f	manual	\N	\N	\N
3dcdec8f-aa5d-48d8-b39f-539b6b87c994	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0004624\n125191\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 09-09-2025 18:50:37\nCALLE, CALLE BOQUERON NUMERO #9009Dirección:\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 7125\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n8.450,0067,60125LTGLIFOGROP FUL DMA - 20LTS922019\nPedido: 9251808020989\nC4695/25 125 18-08-2028\nVencimientoCantidadLote\n1.128,0094,0012UNIFLUMITOP 48 SC FLUMIOXAZIM 48%925258\nPedido: 9251808020989\n25052601 12 25-05-2027\nVencimientoCantidadLote\n6.000,00100,0060UNIEXTRAZONE- SULFENTRAZONE 50%- 5LT925420\nPedido: 9251808020989\nPJF240088-1 60 05-05-2026\nVencimientoCantidadLote\n4.524,00156,0029LTCLOMAZERB 48- CLOMAZONE 48% EC-20LT925380\nPedido: 9251808020989\n20240515 29 14-05-2026\nVencimientoCantidadLote\n9.100,0032,50280UNICENTURION- CLETODIM 24%- 5 LTS.925164\nPedido: 9251808020989\n20250510 280 09-05-2027\nVencimientoCantidadLote\n1.375,0055,0025LT2,4 D 72% - 2,4 D AMINA TM - 20LTS921273\nPedido: 9251808020989\nRegistro SENAVE: 2435\n548/25 25 01-06-2030\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Treinta mil quinientos setenta y siete\n30.577,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 2.779,73 2.779,730,00Liquidación IVA\n217.861.125\n30.577,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000462422025090919092329236\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\n\n	2026-02-11 21:25:31.225229	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
be256ffd-aac0-4650-835b-a33a83370c5c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005200	C.VALE SA	2025-12-24 00:00:00	USD	1130.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0005200\n126488\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 24-12-2025 07:45:12\nDirección : CALLE, BOQUERON NUMERO 9009\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 6774\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n550,00110,005LTCONTACT 72 - 20LTS924877\nPedido: 9251808021061\nRegistro SENAVE: 00000000000000004410\n3524/25 5 30-11-2027\nVencimientoCantidadLote\n580,00290,002UNISPHERE MAX SC - 5LTS921400\nPedido: 9251808021061\nRegistro SENAVE: 4040\nLA40007795 2 18-07-2029\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Mil ciento treinta\n1.130,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 102,73 102,730,00Liquidación IVA\n7.654.620\n1.130,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000520022025122416865769520\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\nSistema proveído por\n\n	2026-02-12 19:20:18.337795	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
149db96b-ab02-4f32-b6d4-2028bbd1d3dc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005545	C.VALE SA	2026-02-11 00:00:00	USD	6012.00	confirmed	Extracted via Gemini Vision	2026-02-12 21:36:46.049871	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
1228a1a3-9fec-4363-98da-ee79f1bc96e4	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0004624\n125191\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 09-09-2025 18:50:37\nCALLE, CALLE BOQUERON NUMERO #9009Dirección:\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 7125\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n8.450,0067,60125LTGLIFOGROP FUL DMA - 20LTS922019\nPedido: 9251808020989\nC4695/25 125 18-08-2028\nVencimientoCantidadLote\n1.128,0094,0012UNIFLUMITOP 48 SC FLUMIOXAZIM 48%925258\nPedido: 9251808020989\n25052601 12 25-05-2027\nVencimientoCantidadLote\n6.000,00100,0060UNIEXTRAZONE- SULFENTRAZONE 50%- 5LT925420\nPedido: 9251808020989\nPJF240088-1 60 05-05-2026\nVencimientoCantidadLote\n4.524,00156,0029LTCLOMAZERB 48- CLOMAZONE 48% EC-20LT925380\nPedido: 9251808020989\n20240515 29 14-05-2026\nVencimientoCantidadLote\n9.100,0032,50280UNICENTURION- CLETODIM 24%- 5 LTS.925164\nPedido: 9251808020989\n20250510 280 09-05-2027\nVencimientoCantidadLote\n1.375,0055,0025LT2,4 D 72% - 2,4 D AMINA TM - 20LTS921273\nPedido: 9251808020989\nRegistro SENAVE: 2435\n548/25 25 01-06-2030\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Treinta mil quinientos setenta y siete\n30.577,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 2.779,73 2.779,730,00Liquidación IVA\n217.861.125\n30.577,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000462422025090919092329236\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\n\n	2026-02-13 01:14:17.319734	\N	f	manual	\N	\N	\N
49fa3336-d723-4112-9786-7f573f1455a1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005332	C.VALE SA	2026-01-15 00:00:00	USD	35200.00	confirmed	Extracted via Gemini Vision	2026-02-16 12:43:41.707154	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
8a401e27-ae99-4f10-924e-82085485fd36	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005556	C.VALE SA	2026-02-12 00:00:00	USD	1100.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0005556\n127389\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nSERGIO DE JESUS PIRES DE ALMEIDANombre o Razón Social:\nFecha y hora: 12-02-2026 09:29:40\nDirección : CORPUS CHRISTI\nRUC/Documento de Identidad Nº: 2408547-2\nCorreo Electrónico:\nTeléfono: +595973884413\nfacturas@grupopiresagro.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 30-04-2026\nCambio: 6576\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n1.100,0044,0025LTPARAGROP 24 - 20LTS924476\nPedido: 9251808021094\nRegistro SENAVE: 00000000000000004860\nC 5018/25 25 03-12-2028\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Mil Cien\n1.100,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 100,00 100,000,00Liquidación IVA\n7.233.600\n1.100,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000555622026021219092329230\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\nSistema proveído por\n\n	2026-02-17 12:44:58.172772	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
72c4b852-48ed-4445-82c9-9f21828b1724	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005200	C.VALE SA	2025-12-24 00:00:00	USD	1130.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0005200\n126488\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 24-12-2025 07:45:12\nDirección : CALLE, BOQUERON NUMERO 9009\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 6774\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n550,00110,005LTCONTACT 72 - 20LTS924877\nPedido: 9251808021061\nRegistro SENAVE: 00000000000000004410\n3524/25 5 30-11-2027\nVencimientoCantidadLote\n580,00290,002UNISPHERE MAX SC - 5LTS921400\nPedido: 9251808021061\nRegistro SENAVE: 4040\nLA40007795 2 18-07-2029\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Mil ciento treinta\n1.130,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 102,73 102,730,00Liquidación IVA\n7.654.620\n1.130,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000520022025122416865769520\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\nSistema proveído por\n\n	2026-02-23 00:10:29.26458	57362904-6c1d-452f-b2e7-1e9803f09d48	t	manual	\N	\N	\N
35be8657-7e6c-43a0-8e9b-e98285539c08	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0004624\n125191\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 09-09-2025 18:50:37\nCALLE, CALLE BOQUERON NUMERO #9009Dirección:\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 7125\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n8.450,0067,60125LTGLIFOGROP FUL DMA - 20LTS922019\nPedido: 9251808020989\nC4695/25 125 18-08-2028\nVencimientoCantidadLote\n1.128,0094,0012UNIFLUMITOP 48 SC FLUMIOXAZIM 48%925258\nPedido: 9251808020989\n25052601 12 25-05-2027\nVencimientoCantidadLote\n6.000,00100,0060UNIEXTRAZONE- SULFENTRAZONE 50%- 5LT925420\nPedido: 9251808020989\nPJF240088-1 60 05-05-2026\nVencimientoCantidadLote\n4.524,00156,0029LTCLOMAZERB 48- CLOMAZONE 48% EC-20LT925380\nPedido: 9251808020989\n20240515 29 14-05-2026\nVencimientoCantidadLote\n9.100,0032,50280UNICENTURION- CLETODIM 24%- 5 LTS.925164\nPedido: 9251808020989\n20250510 280 09-05-2027\nVencimientoCantidadLote\n1.375,0055,0025LT2,4 D 72% - 2,4 D AMINA TM - 20LTS921273\nPedido: 9251808020989\nRegistro SENAVE: 2435\n548/25 25 01-06-2030\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Treinta mil quinientos setenta y siete\n30.577,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 2.779,73 2.779,730,00Liquidación IVA\n217.861.125\n30.577,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000462422025090919092329236\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\n\n	2026-02-23 00:11:32.17042	57362904-6c1d-452f-b2e7-1e9803f09d48	t	manual	\N	\N	\N
b5796412-4eec-4d1b-bc97-96a5556daa9d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005503	C.VALE SA	2026-02-05 00:00:00	USD	1400.00	confirmed	Extracted via Gemini Vision	2026-02-24 12:17:01.422699	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
46010e20-59b9-417b-afb4-44110ae4165a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004733	C.VALE SA	2025-09-26 00:00:00	USD	1530.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0004733\n125438\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 26-09-2025 16:13:30\nCALLE, CALLE BOQUERON NUMERO #9009Dirección:\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 7063\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n1.248,00156,008LTCLOMAZERB 48- CLOMAZONE 48% EC-20LT925380\nPedido: 9251808021002\nPJF 250070-3 8 01-04-2027\nVencimientoCantidadLote\n282,0094,003UNIKURIN 48 - 5LTS924642\nPedido: 9251808021002\nRegistro SENAVE: 5855\nC4534/25 3 14-07-2027\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Mil quinientos treinta\n1.530,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 139,09 139,090,00Liquidación IVA\n10.806.390\n1.530,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000473322025092617070943920\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\n\n	2026-02-24 12:50:43.981866	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
4a0fe410-5e29-403a-947a-dce14f707e26	b1f7c63d-e398-42fc-893c-733221086476	003-001-0003564	CENTRO DEL AGRO SA	2026-02-25 00:00:00	USD	840.00	confirmed	Extracted via Gemini Vision	2026-02-27 12:38:06.570344	a51c401d-aaee-4e66-9cad-b7379e3f85f1	f	manual	\N	\N	\N
51a78790-8348-4ffa-a6de-2bbb54db94aa	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	confirmed	Página 1 de 1\nKuDE de Factura Electrónica\n80029558-7\n16120194\n03-01-2023\nRUC:\nInicio de vigencia:\nTimbrado Nº:\nFACTURA ELECTRÓNICA\nCódigo interno:\nN°: 005-001-0004624\n125191\nC.VALE SA\nCOMERCIO AL POR MAYOR DE MATERIAS PRIMAS AGRÍCOLAS\nCOL. ANAHI 9002 CAMINO A CORPUS A 1.000MTS RUTA X\nCORPUS CHRISTI - CANINDEYU\nTeléfono: 0983191051\nEmail: cvalesa@cvale.com.py\nREG. SENAVE: 1016\nGUSTAVO ENRIQUE MARCHIORO DE CONTONombre o Razón Social:\nFecha y hora: 09-09-2025 18:50:37\nCALLE, CALLE BOQUERON NUMERO #9009Dirección:\nRUC/Documento de Identidad Nº: 5373046-1\nCorreo Electrónico:\nTeléfono: +5950981376503\ngest_contservices@hotmail.com\nCondición de Venta: Crédito\n1Cuotas:\nMoneda: US Dollar\nVencimiento: 01-04-2026\nCambio: 7125\nOperación: Venta de mercadería\nCod. Descripción UNI Cantidad Precio Unitario Descuento Exentas 5% 10%\nValor de Venta\n8.450,0067,60125LTGLIFOGROP FUL DMA - 20LTS922019\nPedido: 9251808020989\nC4695/25 125 18-08-2028\nVencimientoCantidadLote\n1.128,0094,0012UNIFLUMITOP 48 SC FLUMIOXAZIM 48%925258\nPedido: 9251808020989\n25052601 12 25-05-2027\nVencimientoCantidadLote\n6.000,00100,0060UNIEXTRAZONE- SULFENTRAZONE 50%- 5LT925420\nPedido: 9251808020989\nPJF240088-1 60 05-05-2026\nVencimientoCantidadLote\n4.524,00156,0029LTCLOMAZERB 48- CLOMAZONE 48% EC-20LT925380\nPedido: 9251808020989\n20240515 29 14-05-2026\nVencimientoCantidadLote\n9.100,0032,50280UNICENTURION- CLETODIM 24%- 5 LTS.925164\nPedido: 9251808020989\n20250510 280 09-05-2027\nVencimientoCantidadLote\n1.375,0055,0025LT2,4 D 72% - 2,4 D AMINA TM - 20LTS921273\nPedido: 9251808020989\nRegistro SENAVE: 2435\n548/25 25 01-06-2030\nVencimientoCantidadLote\nTotal a pagar Dólares Americanos - Treinta mil quinientos setenta y siete\n30.577,00\nDescuento global:\nTotal en guaraníes\n(5%) (10%) 2.779,73 2.779,730,00Liquidación IVA\n217.861.125\n30.577,00\nSub Total:\nTotal IVA\nhttps://ekuatia.set.gov.py/consultas/01800295587005001000462422025090919092329236\nConsulte esta Factura Electrónica con el número impreso abajo:\nESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)\nSi su documento electrónico presenta algun error solicitar la cancelación dentro de las 48 horas siguientes de la emisión de este\ncomprobante.\n\n	2026-02-26 16:53:18.296999	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
785a478c-a6d8-453f-826b-fa43a7460c20	53d9be2f-7343-4c53-89ee-b6e886daf5fb	001-005-0000082	TAMPA PARAGUAY S.A.	2026-02-18 00:00:00	USD	19800.00	confirmed	Extracted via Gemini Vision	2026-02-27 17:29:35.224963	57362904-6c1d-452f-b2e7-1e9803f09d48	f	manual	\N	\N	\N
f5b59084-34c4-4373-b4ba-3e8ce07fe792	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	pending	Subject: fatura\nFrom: thiago.fregolao@gmail.com\nFile: fact 4624.pdf	2026-02-28 02:40:35.992651	57362904-6c1d-452f-b2e7-1e9803f09d48	f	email_import	<CANA5YKvt9-hGhBifMO8ecC7cYOcykZDmgtJHoKCDW-qB3CyzzQ@mail.gmail.com>-fact 4624.pdf	thiago.fregolao@gmail.com	\N
5c045cae-98c7-44e9-a808-fff518aa6580	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005200	C.VALE SA	2025-12-24 00:00:00	USD	1130.00	pending	Subject: fatura\nFrom: thiago.fregolao@gmail.com\nFile: fact 5200.pdf	2026-02-28 02:47:37.229638	57362904-6c1d-452f-b2e7-1e9803f09d48	f	email_import	<CANA5YKtijOBmhx41F_t2L0oMTmFiBYDxVzz-jVXBQF5XLvGgig@mail.gmail.com>-fact 5200.pdf	thiago.fregolao@gmail.com	\N
567b07a9-0266-45fb-977e-eb95afaa5bc1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0004624	C.VALE SA	2025-09-09 00:00:00	USD	30577.00	pending	Subject: fatura\nFrom: thiago.fregolao@gmail.com\nFile: fact 4624.pdf	2026-02-28 03:03:05.762444	57362904-6c1d-452f-b2e7-1e9803f09d48	f	email_import	<CANA5YKt=E=SDsTOpVvQ0-ywo1_WkZEmDk_VUTDZbUVkdyGvoHw@mail.gmail.com>-fact 4624.pdf	thiago.fregolao@gmail.com	\N
9ee55fa5-5848-4882-b9a6-584c803e3bbd	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005200	C.VALE SA	2025-12-24 00:00:00	USD	1130.00	pending	Subject: fatura\nFrom: thiago.fregolao@gmail.com\nFile: fact 5200.pdf	2026-02-28 03:27:08.090723	57362904-6c1d-452f-b2e7-1e9803f09d48	f	email_import	<CANA5YKsKJopCdHPxEMVcQjazxRhbibtfHO4nmFQYvgyfzOK75g@mail.gmail.com>-fact 5200.pdf	thiago.fregolao@gmail.com	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U3BhY2U8PC9DUy9EZXZpY2VSR0I+Pi9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXS9Gb250PDwvRjEgMiAwIFIvRjIgMyAwIFIvRjMgOCAwIFI+Pi9YT2JqZWN0PDwvWGYxIDYgMCBSL2ltZzQgMTAgMCBSL2ltZzMgOSAwIFIvaW1nMiA3IDAgUi9pbWcxIDUgMCBSL2ltZzAgNCAwIFI+Pj4+L1BhcmVudCAxMiAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdPj4KZW5kb2JqCjEzIDAgb2JqClsxIDAgUi9YWVogMCA4NTIgMF0KZW5kb2JqCjIgMCBvYmoKPDwvU3VidHlwZS9UeXBlMS9UeXBlL0ZvbnQvQmFzZUZvbnQvSGVsdmV0aWNhL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagozIDAgb2JqCjw8L1N1YnR5cGUvVHlwZTEvVHlwZS9Gb250L0Jhc2VGb250L0hlbHZldGljYS1Cb2xkL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iago4IDAgb2JqCjw8L1N1YnR5cGUvVHlwZTEvVHlwZS9Gb250L0Jhc2VGb250L0hlbHZldGljYS1PYmxpcXVlL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagoxMiAwIG9iago8PC9LaWRzWzEgMCBSXS9UeXBlL1BhZ2VzL0NvdW50IDEvSVRYVCgyLjEuNyk+PgplbmRvYmoKMTQgMCBvYmoKPDwvTmFtZXNbKEpSX1BBR0VfQU5DSE9SXzBfMSkgMTMgMCBSXT4+CmVuZG9iagoxNSAwIG9iago8PC9EZXN0cyAxNCAwIFI+PgplbmRvYmoKMTYgMCBvYmoKPDwvTmFtZXMgMTUgMCBSL1R5cGUvQ2F0YWxvZy9QYWdlcyAxMiAwIFIvVmlld2VyUHJlZmVyZW5jZXM8PC9QcmludFNjYWxpbmcvQXBwRGVmYXVsdD4+Pj4KZW5kb2JqCjE3IDAgb2JqCjw8L01vZERhdGUoRDoyMDI1MTIyNDA3NDYxNS0wMycwMCcpL0NyZWF0b3IoSmFzcGVyUmVwb3J0cyBMaWJyYXJ5IHZlcnNpb24gNi40LjApL0NyZWF0aW9uRGF0ZShEOjIwMjUxMjI0MDc0NjE1LTAzJzAwJykvUHJvZHVjZXIoaVRleHQgMi4xLjcgYnkgMVQzWFQpPj4KZW5kb2JqCnhyZWYKMCAxOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwNzA5OTAgMDAwMDAgbiAKMDAwMDA3MTM2NSAwMDAwMCBuIAowMDAwMDcxNDUzIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMjU4NiAwMDAwMCBuIAowMDAwMDA2NjY5IDAwMDAwIG4gCjAwMDAwMzA1MDggMDAwMDAgbiAKMDAwMDA3MTU0NiAwMDAwMCBuIAowMDAwMDMxNDYyIDAwMDAwIG4gCjAwMDAwNDg2MjYgMDAwMDAgbiAKMDAwMDA2NjkwNCAwMDAwMCBuIAowMDAwMDcxNjQyIDAwMDAwIG4gCjAwMDAwNzEzMjkgMDAwMDAgbiAKMDAwMDA3MTcwNiAwMDAwMCBuIAowMDAwMDcxNzYyIDAwMDAwIG4gCjAwMDAwNzE3OTYgMDAwMDAgbiAKMDAwMDA3MTkwMiAwMDAwMCBuIAp0cmFpbGVyCjw8L0luZm8gMTcgMCBSL0lEIFs8NDY5Y2JmZGQ2MTMyNTVkYjkwYmZlZjBhMDA5NjhkMWU+PDc1Y2EwYzhlNmI0YmJjZjU4MjFhZDFhN2Q0ZDc4MWNiPl0vUm9vdCAxNiAwIFIvU2l6ZSAxOD4+CnN0YXJ0eHJlZgo3MjA3MAolJUVPRgo=
cfa6b822-6425-44ae-ae5a-50ae382d1525	53d9be2f-7343-4c53-89ee-b6e886daf5fb	005-001-0005200	C.VALE SA	2025-12-24 00:00:00	USD	1130.00	pending	Subject: fatura\nFrom: thiago.fregolao@gmail.com\nFile: fact 5200.pdf	2026-02-28 12:11:14.382589	57362904-6c1d-452f-b2e7-1e9803f09d48	f	email_import	<CANA5YKtJQSZ1Na-7+1_9j4Gg=LyHzJJ0qGefq=qoo2+wFgaDMQ@mail.gmail.com>-fact 5200.pdf	thiago.fregolao@gmail.com	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U3BhY2U8PC9DUy9EZXZpY2VSR0I+Pi9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXS9Gb250PDwvRjEgMiAwIFIvRjIgMyAwIFIvRjMgOCAwIFI+Pi9YT2JqZWN0PDwvWGYxIDYgMCBSL2ltZzQgMTAgMCBSL2ltZzMgOSAwIFIvaW1nMiA3IDAgUi9pbWcxIDUgMCBSL2ltZzAgNCAwIFI+Pj4+L1BhcmVudCAxMiAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdPj4KZW5kb2JqCjEzIDAgb2JqClsxIDAgUi9YWVogMCA4NTIgMF0KZW5kb2JqCjIgMCBvYmoKPDwvU3VidHlwZS9UeXBlMS9UeXBlL0ZvbnQvQmFzZUZvbnQvSGVsdmV0aWNhL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagozIDAgb2JqCjw8L1N1YnR5cGUvVHlwZTEvVHlwZS9Gb250L0Jhc2VGb250L0hlbHZldGljYS1Cb2xkL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iago4IDAgb2JqCjw8L1N1YnR5cGUvVHlwZTEvVHlwZS9Gb250L0Jhc2VGb250L0hlbHZldGljYS1PYmxpcXVlL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagoxMiAwIG9iago8PC9LaWRzWzEgMCBSXS9UeXBlL1BhZ2VzL0NvdW50IDEvSVRYVCgyLjEuNyk+PgplbmRvYmoKMTQgMCBvYmoKPDwvTmFtZXNbKEpSX1BBR0VfQU5DSE9SXzBfMSkgMTMgMCBSXT4+CmVuZG9iagoxNSAwIG9iago8PC9EZXN0cyAxNCAwIFI+PgplbmRvYmoKMTYgMCBvYmoKPDwvTmFtZXMgMTUgMCBSL1R5cGUvQ2F0YWxvZy9QYWdlcyAxMiAwIFIvVmlld2VyUHJlZmVyZW5jZXM8PC9QcmludFNjYWxpbmcvQXBwRGVmYXVsdD4+Pj4KZW5kb2JqCjE3IDAgb2JqCjw8L01vZERhdGUoRDoyMDI1MTIyNDA3NDYxNS0wMycwMCcpL0NyZWF0b3IoSmFzcGVyUmVwb3J0cyBMaWJyYXJ5IHZlcnNpb24gNi40LjApL0NyZWF0aW9uRGF0ZShEOjIwMjUxMjI0MDc0NjE1LTAzJzAwJykvUHJvZHVjZXIoaVRleHQgMi4xLjcgYnkgMVQzWFQpPj4KZW5kb2JqCnhyZWYKMCAxOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwNzA5OTAgMDAwMDAgbiAKMDAwMDA3MTM2NSAwMDAwMCBuIAowMDAwMDcxNDUzIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMjU4NiAwMDAwMCBuIAowMDAwMDA2NjY5IDAwMDAwIG4gCjAwMDAwMzA1MDggMDAwMDAgbiAKMDAwMDA3MTU0NiAwMDAwMCBuIAowMDAwMDMxNDYyIDAwMDAwIG4gCjAwMDAwNDg2MjYgMDAwMDAgbiAKMDAwMDA2NjkwNCAwMDAwMCBuIAowMDAwMDcxNjQyIDAwMDAwIG4gCjAwMDAwNzEzMjkgMDAwMDAgbiAKMDAwMDA3MTcwNiAwMDAwMCBuIAowMDAwMDcxNzYyIDAwMDAwIG4gCjAwMDAwNzE3OTYgMDAwMDAgbiAKMDAwMDA3MTkwMiAwMDAwMCBuIAp0cmFpbGVyCjw8L0luZm8gMTcgMCBSL0lEIFs8NDY5Y2JmZGQ2MTMyNTVkYjkwYmZlZjBhMDA5NjhkMWU+PDc1Y2EwYzhlNmI0YmJjZjU4MjFhZDFhN2Q0ZDc4MWNiPl0vUm9vdCAxNiAwIFIvU2l6ZSAxOD4+CnN0YXJ0eHJlZgo3MjA3MAolJUVPRgo=
\.


--
-- Data for Name: farm_manuals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_manuals (id, title, segment, content_text, created_at) FROM stdin;
0496efd1-cc14-4f7c-bed4-5bb6e099234a	Guia do manejo de plantas daninhas de difícil controle	Plantas Daninhas	#E-BOOK\nGuia do manejo\nde plantas daninhas\nde difícil controle\nlavoura\n#E-BOOK\nSOBRE O EBOOK\nEsse Ebook é feito para ajudar produtores rurais\nno manejo de plantas daninhas de difícil controle,\nespecialmente nas culturas de grãos.\nPortanto, os produtores já estão familiarizados com\nos temas da agricultura.\nAqui explicamos e ensinamos com maior aprofunda-\nmento os assuntos. Devido a tudo isso, este Ebook\né considerado de nível intermediário.\nO Guia de Manejo de Plantas Daninhas de Difícil\nControle é totalmente interativo!\nVocê vai encontrar links para outros sites, textos ou\nmateriais para saber ainda mais sobre um assunto\nespecífico. Os link aparecerão desse jeito aqui.\nClique em um tópico do índice que lhe interessa\nmais e vá diretamente para esse assunto.\nFique à vontade também para dar zoom e poder\nvisualizar melhor as informações.\nBoa leitura!\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n#E-BOOK\nSOBRE OS AUTORES\nDanielle Gaiotto\nJornalista e especialista em assessoria de comuni-\ncação.\nHenrique Fabrício Placido\nEngenheiro Agrônomo pela UFPR e mestre pela\nEsalq-USP.\nMaiara Maria Franzoni, editora\nEngenheira Agrônoma e mestra pela Esalq-USP.\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n03\n#E-BOOK\nSUMÁRIO\nIntrodução\npág. 05\nConyza spp.: Buva\npág. 06\nDigitaria insularis: Capim-amargoso\npág. 11\nAmaranthus palmeri: Caruru-palmeri\npág. 17\nSida spp.: Guanxuma\npág. 24\nPanicum maximum Jacq.: Capim-colonião\npág. 29\nEleusine indica: Capim-pé-de-galinha\npág. 34\nDigitaria spp.: Capim-colchão\npág. 40\nCommelina spp.: Trapoeraba\npág. 45\nPlanta tiguera\npág. 50\nConclusão\npág. 54\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n04\n#E-BOOK\nINTRODUÇÃO\nPensamos em criar esse Ebook para te ajudar a\nmelhorar o manejo de plantas daninhas em sua\nlavoura.\nAqui você verá como identificar as características das\nervas daninhas que causam mais danos econômi-\ncos e/ou têm difícil controle: buva, capim-amargoso,\ncaruru Amaranthus palmeri, guanxuma, capim-co-\nlonião, capim-pé-de-galinha, trapoeraba e plantas\ntigueras.\nVocê também vai encontrar todas as informações\ndas melhores épocas para controle de cada espécie\ne quais herbicidas trazem melhores resultados (em\ndessecação, pré ou pós-emergência), principalmente\nnas culturas de grãos, como soja e milho.\nlavoura\nCom essas estratégias, esperamos que você evite\na seleção de resistência na sua lavoura e tenha\nsucesso em sua produção!\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n#E-BOOK\nConyza spp.: Buva\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nlavoura\n#E-BOOK\nCONYZA SPP.: BUVA\nA buva é uma planta daninha que precisa de luz para\ngerminar. Por isso, é comum pensar que o plantio\ndireto, com a palha sobre o solo, inibiria infestações\npor essa planta.\nE, com uma profundidade de enterrio de apenas\n0,5 cm, por exemplo, ocorre inibição de 100% da\nemergência da buva.\nsequenciais.\nÉ muito importante realizar o correto controle da\nMas o que ocorreu foi justamente o contrário: a buva\nbuva no período de pousio, pois ela pode ser “ponte\nganhou mais importância no cultivo de grãos a par-verde" para pragas e doenças que afetam culturas\ntir da década de 1990, com a expansão do plantio\ndireto no país. Isso porque a maioria dos produto-\nres não faz o SPD em sua totalidade, resultando em\npalha insuficiente sobre o solo para inibir a germi-\nnação da buva.\nJá no cultivo convencional, a inversão da leiva fazia\ncom que parte das sementes fossem enterradas.\n•\n•\nPara garantir que não haja seleção de resistência,\né essencial que você siga estas dicas:\n• Conheça o histórico de resistência da área e\nregião\nRealize rotação de mecanismo de ação de\nherbicidas\nInclua herbicidas pré-emergentes no manejo\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n•\n•\n• Siga os princípios básicos da tecnologia de\naplicação adequada\nRealize aplicações em pós-emergência sobre\nplantas pequenas\nRealize corretamente aplicações sequenciais\n•\nPriorize controle na entressafra\n•\n•\nRealize rotação de culturas e adubação verde\nRealize limpeza correta de máquinas ou\nimplementos antes de utilizá-los em novas\náreas\nsão maiores. Já plantas com mais de 16 cm prova- Glifosato\nvelmente precisarão de um manejo sequencial com\nherbicidas sistêmicos e de contato.\nHerbicidas Pós-Emergentes\nParaquat\nPode ser utilizado em plantas pequenas (< 10 cm)\nou em manejo sequencial para controle da rebrota\nde plantas maiores. Recomendável dose de 1,5 a\n2,0 L ha-1.\nMesmo não sendo efetivo para a maioria das popu-\nlações, pode ser usado para controle de outras\nplantas daninhas.\nO glifosato, quando associado a outros\nprodutos, pode ter efeito sinérgico no\ncontrole de populações resistentes (ex:\nsaflufenacil), ou efeito de antagonismo\n(ex.: paraquat).\nControle da buva na\nentressafra do sistema\nsoja-milho\nA entressafra é o período ideal para realizar um bom\nmanejo da buva. É fundamental que a aplicação ocorra\nem plantas de até 10 cm. Assim, as chances de sucesso\nChlorimuron\nUtilizado na primeira aplicação do manejo sequencial,\ngeralmente associado a outros herbicidas sistêmicos\n(ex: glifosato), e fornece efeito residual. É recomen-\ndável dose de 60 a 80 g ha-1.\nGlufosinato de amônio\nPode ser utilizado em plantas pequenas (< 10 cm)\nou em manejo sequencial para controle de rebrota\nde plantas maiores, na dose de 2,5 a 3,0 L ha-1.\nlavoura\n08\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nSaflufenacil\nPode ser utilizado em plantas pequenas (< 10 cm)\nou em manejo sequencial para controle de rebrota\nde plantas maiores. Recomendação de dose de 35\na 100 g ha-1.\n2,4 D\nUtilizado em primeiras aplicações de manejo sequen-\ncial, geralmente associado a outros herbicidas sistê-\nCuidado com problemas de\nincompatibilidade no tanque (principalmente\ngraminicidas). Quando utilizar 2,4 D próximo\nà semeadura de soja, deixe um intervalo\nentre a aplicação e a semeadura de 1 dia\npara cada 100 mL ha-1 de produto utilizado.\nmicos (ex: glifosato) ou pré-emergentes. Recomen- aplique plante da soja. Recomendações de dose de\ndável a dose de 1,2 a 2 L ha-1.\nHerbicidas Pré-Emergentes\nDiclosulam\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato e 2,4 D). O solo deve estar úmido. Reco-\nmendações de dose de 29,8 a 41,7 g ha-1.\nFlumioxazin\nProduto com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato, 2,4 D e imazetapir) ou no sistema de\n40 a 120 g ha-1.\nSulfentrazone\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato, 2,4 D e chlorimuron). Recomenda-se\ndose de até 0,5 L ha-1, pois apresenta grande varia-\nção na seletividade de cultivares de soja.\nControle da buva na pós-\nemergência da soja e milho\nO manejo da buva na pós-emergência da soja é\npouco recomendado. Existem poucas opções que\npodem ser utilizadas e, devido a seu estádio de\ndesenvolvimento, apenas seguram seu crescimento.\nlavoura\n09\n#E-BOOK\nCloransulam\nUtilizado em pós-emergência da soja, na dose de\n35,7 g ha-1.\nImazetapir\nUtilizado em pós-emergência precoce da buva e na\nsoja com até 2 trifólios, na dose de 0,8 a 1,0 L ha-1.\nNa pós-emergência do milho safrinha, pode-se uti-\nlizar para controle de buva a associação de atrazina\n2,5 L ha-1 e tembotrione 0,18 L ha-1.\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n10\n#E-BOOK\nDigitaria insularis:\nCapim-amargoso\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nlavoura\n#E-BOOK\nDIGITARIA INSULARIS: CAPIM-AMARGOSO\nO capim-amargoso (Digitaria insularis) tem ciclo de Sua ampla dispersão está associada à capacidade\nvida que pode durar mais de 2 anos.\nde produzir grande quantidade de sementes (mais\nde 100 mil sementes por inflorescência), que são\ndisseminadas pelo vento durante todo o ano.\nEle se reproduz através de sementes e produz estru-\nturas de reserva subterrâneas (rizomas) formadas a\npartir dos 45 dias após emergência. Isso lhe confere\numa grande capacidade de recuperação da parte\naérea após danos causados por corte mecânico ou\nação de herbicidas.\nO capim-amargoso é adaptado a quase todo o ter-\nritório nacional, infestando a maioria dos cultivos de\ngrãos do Brasil.\nEstima-se que, atualmente, infeste uma área de 8,2\nmilhões de ha em nosso país.\nlavoura\nAs sementes têm germinação indiferente à luz, ou\nseja, podem germinar no escuro ou no claro. Porém,\ntêm maior porcentagem de germinação na presença\nda luz.\nA profundidade de enterrio pode influenciar a capa-\ncidade de emergência das sementes. Profundidades\na partir a 4 cm podem diminuir sua emergência em\nmais de 90%.\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nP\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n•\n•\n•\nResistência do capim-amargoso\nO capim-amargoso começou a ter\nimportância econômica a partir da década\nde 90, com a expansão do plantio direto.\nCom o aumento da infestação dessa\ndaninha em áreas de grãos e o uso\nindiscriminado do glifosato, houve seleção\nde plantas resistentes em 2008.\n• Em 2016, foi relatado o primeiro caso de\ncapim-amargoso resistente a graminicidas\n(fenoxaprop e haloxyfop). Por sorte, estas\npopulações foram selecionadas em áreas\nde produção convencional de soja e não\napresentavam resistência a glifosato.\nDevido à larga utilização destes herbicidas,\nexistem fortes indícios de que populações\ncom resistência múltipla ao glifosato e\ngraminicidas serão identificadas em breve.\nControle na entressafra do\nsistema soja-milho\nA entressafra é período ideal para realizar um bom\nmanejo porque existe um número maior de opções\na serem utilizadas. O ideal é que a aplicação ocorra\nem plantas com até 2 perfilhos.\nComo o capim-amargoso produz estruturas de\nreserva e os herbicidas geralmente não conse-\nguem afetá-las –, o controle tardio demandará apli-\ncações sequenciais para esgotar estas reservas e\nimpedir a rebrota.\nEm geral, as aplicações sequenciais envolvem uma\nprimeira aplicação com herbicidas sistêmicos (ex:\nglifosato e graminicidas) e aplicações sequenciais\ncom herbicidas de contato (glufosinato de amônio\ne paraquat).\nPorém, dependendo das condições edafoclimáticas\n(solo e clima), é comum que sejam necessárias até\n3 aplicações para controlar plantas perenizadas.\nO intervalo é determinado através do tamanho da\nrebrota após a aplicação. O ideal é aplicar com uma\nrebrota entre 10 cm e 20 cm.\nHerbicidas Pós-Emergentes\nCletodim\nPossui ótimo controle de plantas daninhas pequenas\n(até 2 perfilhos). Pode ser utilizado na primeira apli-\ncação do manejo sequencial (geralmente associado\nlavoura\n13\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\na glifosato), na dose de 0,5 a 1,0 L ha-1. Adicionar cação do manejo sequencial (geralmente associado Paraquat\nóleo mineral 0,5 a 1,0 % v v-1.\nHaloxyfop\nPossui ótimo controle de plantas daninhas pequenas\n(até 2 perfilhos). Pode ser utilizado na primeira apli-\nEste são os exemplos mais comuns de\ngraminicidas utilizados, porém existem outros\nprodutos para controle químico com ótimo\ndesempenho e que seguem a mesma lógica\nde manejo.\nNovas formulações de graminicidas vêm\nsendo lançadas com maior concentração do\ningrediente ativo (responsável pela morte da\nplanta) e com adjuvante incluso. (Ex: Verdict\nmax®, Targa max® e Select one pack®)\na glifosato), na dose de 0,55 a 1,2 L ha-1. Adicionar\nóleo mineral 0,5 a 1,0 % v v-1.\nGlifosato\nMesmo não sendo efetivo para a maioria das popu-\nlações, pode ser usado no manejo para controle de\noutras plantas daninhas. Ainda que o capim-amar-\ngoso seja resistente à associação de glifosato a gra-\nminicidas, melhora o controle.\nQuando forem misturados 2,4D e graminicidas, deve-\n-se aumentar a dose do graminicida em 20%, pois\neste herbicida reduz sua eficiência.\nPode ser utilizado em plantas pequenas (até 2 per-\nfilhos) provenientes de sementes ou em manejo\nsequencial para controle da rebrota de plantas maio-\nres. Recomendada dose de 1,5 a 2,0 L ha-1. Adicio-\nnar adjuvante não iônico 0,5 a 1,0% v.v. Haloxyfop\nPossui ótimo controle de plantas daninhas pequenas\n(até 2 perfilhos). Pode ser utilizado na primeira apli-\ncação do manejo sequencial (geralmente associado\na glifosato), na dose de 0,55 a 1,2 L ha-1. Adicionar\nóleo mineral 0,5 a 1,0 % v v-1.\nGlufosinato de amônio\nPode ser utilizado em plantas pequenas (até 2 per-\nfilhos) provenientes de sementes ou em manejo\nsequencial para controle de rebrota de plantas maio-\nlavoura\n14\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nres. Indicada dose de 2,5 a 3,0 L ha-1. Adicionar óleo\nmineral 2,0% v.v.\nHerbicidas Pré-Emergentes\nDiclosulam\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato e graminicidas), solo deve estar úmido.\nRecomendações de dose de 29,8 a 41,7 g ha-1.\nFlumioxazin\nHerbicida com ação residual. Utilizado na primeira\naplicação do manejo outonal associado a herbicidas\nsistêmicos (ex: glifosato, graminicidas e imazetapir)\nou no sistema de aplique plante da soja. Recomen- Controle na pós-emergência\ndações de dose de 70 a 120 g ha-1.\nS-metolachlor\nHerbicida com ação residual utilizado no sistema de\naplique plante da soja. Recomendável dose de 1,5 a\n2,0 L ha-1. Não deve ser aplicado em solos arenosos.\nTrifluralina\nHerbicida com ação residual utilizado na primeira\naplicação do manejo outonal associado a herbicidas\nsistêmicos (ex: glifosato, graminicidas). Recomendá-\nvel dose de 1,2 a 4,0 L ha-1, dependendo da planta\ndaninha a ser controlada e nível de cobertura do\nsolo. Deve ser aplicado em solo úmido e livre de\ntorrões.\nda soja\nPara plantas pequenas ou rebrota, temos como opção\neficiente somente o uso de graminicidas (clethodim,\nhaloxyfop e outros). Em caso de soja RR, podem ser\nassociados ao glifosato.\nEm áreas com grande infestação, devem ser utili-\nzados herbicidas pré-emergentes no sistema de\n"aplique plante” para diminuir o banco de semen-\ntes e o número de aplicações em pós-emergência\n(diclosulam, flumioxazin e s-metolachlor).\nA inclusão de pré-emergentes em diferentes eta-\npas do manejo de plantas daninhas é fundamental,\nprincipalmente em áreas com grandes infestações.\nlavoura\n15\n#E-BOOK\nEles trazem ótimo custo-benefício ao produtor, pois\ndiminuem a necessidade de aplicações em pós-emer-\ngência e previnem a seleção de plantas resistentes.\nControle do capim-amargoso no milho\nExistem poucas opções que sejam seletivas\nao milho e controlem o capim-amargoso.\nDentre elas temos:\n•\nherbicidas pré-emergentes aplicados\nem sistema de “aplique plante” - como\ntrifluralina, s-metolachlor e isoxaflutole;\n• herbicidas utilizados em pós-emergência\nprecoce - como nicosulfuron, tembotrione\ne mesotrione).\nPorém, não há opções eficientes para\ncontrole de plantas mais desenvolvidas\nou perenizadas.\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n16\n#E-BOOK\nAmaranthus palmeri:\nCaruru-palmeri\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nlavoura\n#E-BOOK\nAMARANTHUS PALMERI: CARURU-PALMERI\nO caruru-palmeri (Amaranthus palmeri) é uma planta Além disso, sua capacidade de dispersão é muito\ndaninha exótica que teve seu primeiro relato no Bra-alta. As plantas fêmeas podem produzir de 200\nsil em 2015, no Mato Grosso.\nO que mais preocupa é o histórico de infestação e\nagressividade que esta planta apresenta, associados\na uma grande capacidade de selecionar resistência\na herbicidas.\nNo Brasil existem relatos de que o caruru-palmeri\ntenha taxa de crescimento de 4 cm a 6 cm por dia,\npodendo atingir mais de 2 m de altura. Desta forma,\nnão existe cultura que consiga competir com esta\nplanta daninha, podendo ser prejudicial em diversas\nfases do ciclo do cultivo. Foram registradas perdas\nrendimento de até 90% na soja e 79% no milho.\nmil a 1 milhão de sementes por planta. Um detalhe\nimportante é que as plantas fêmeas podem produ-\nzir sementes viáveis, mesmo não sendo polinizadas\npelas plantas macho.\nAs sementes de caruru Amaranthus palmeri pos-\nsuem tamanho muito pequeno, sendo facilmente\ndispersadas pelo vento, por animais e por imple-\nmentos agrícolas.\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nComo identificar o\ncaruru-palmeri\n•\n•\n•\n•\n•\nFolhas possuem lâminas foliares de formato\nvariado, entre o formato de ovado a rômbico-\novada.\nNão possui pilosidade (presença de pelos) em\nqualquer superfície da planta.\n• Comprimento dos pecíolos das folhas costuma\nser maior ou igual ao comprimento do limbo\nfoliar, principalmente em folhas mais velhas.\nPossui flores femininas e masculinas em plantas\nseparadas, diferente das espécies nativas do\nBrasil, que possuem os dois sexos na mesma\nplanta.\nPlantas fêmeas possuem brácteas rudimentares,\nque envolvem a inflorescência.\nPodem (mas não obrigatoriamente) ocorrer\nmarcas d'água em formato de “V” no limbo foliar\ne presença de um pequeno pelo no término do\nlimbo foliar.\nA espécie mais facilmente confundida com o caruru-\n-palmeri é o caruru-de-espinhos (Amaranthus spino-\nsus). Mesmo algumas espécies possuindo algumas\n(Fonte: Purdue Extension)\ndas características citadas acima, você deve analisar\no conjunto para a correta identificação.\nResistência do caruru-palmeri\nCasos de resistência simples a herbicidas:\n•\nInibidor da EPSPs (ex: Glifosato)\n•\nInibidor da tubulina (ex: Trifluralina)\n•\nInibidor do Fotossistema II (ex: Atrazina)\n•\nInibidores de ácidos graxos de cadeia longa\n(ex: S-metolachlor)\n•\nAuxinas sintéticas (ex: 2,4 D)\n•\nInibidor da ALS (ex: Chlorimuron)\n•\nInibidor da HPPD (ex: Mesotrione)\nlavoura\n19\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nCasos de resistência múltipla a herbicidas:\n•\n•\n•\n•\n•\n•\nInibidor da EPSPs (ex: Glifosato) + Inibidor da\nALS (ex: Chlorimuron)\nInibidor da ALS (ex: Chlorimuron) + Inibidor da\nProtox (ex: fomesafen)\nFotossistema II (ex: Atrazina) + Inibidor da\nHPPD (ex: Mesotrione)\nInibidor da ALS (ex: Chlorimuron) + Inibidor da\nHPPD (ex: Mesotrione)\nInibidor da EPSPs (ex: Glifosato) + Inibidor da\nProtox (ex: fomesafen)\nInibidor da EPSPs (ex: Glifosato) +\nFotossistema II (ex: Atrazina)\nInibidor da ALS (ex: Chlorimuron) + Inibidor\ndo Fotossistema II (ex: Atrazina) + Inibidor da\nHPPD (ex: Mesotrione)\n•\n•\n•\nInibidor da EPSPs (ex: Glifosato) + Inibidor\nda ALS (ex: Chlorimuron) + Inibidor do\nFotossistema II (ex: Atrazina)\nInibidor da EPSPs (ex: Glifosato) + Inibidor da\nALS (ex: Chlorimuron) + Inibidor da Protox (ex:\nfomesafen) + Inibidores de ácidos graxos de\ncadeia longa (ex: S-metolachlor)\nInibidor da EPSPs (ex: Glifosato) + Inibidor da\nALS (ex: Chlorimuron) + Fotossistema II (ex:\nAtrazina) + Inibidor da HPPD (ex: Mesotrione) +\nAuxinas sintéticas (ex: 2,4 D)\nControle na entressafra\ndo sistema soja-milho\nO ponto primordial no manejo do caruru-palmeri é\no estádio de desenvolvimento. Por se tratar de uma\nplanta daninha de difícil controle, é recomendado\nque aplicação ocorra até, no máximo, 5 cm.\nPlantas com mais de 8 cm apresentam menor sus-\ncetibilidade a herbicidas. E, devido à sua taxa de\ncrescimento altíssima, isso ocorre em poucos dias\napós a emergência.\nApós perenizadas, deve-se realizar um manejo com\naplicações sequenciais espaçadas em 15 dias.\nDevido a estas características, o uso de herbicidas\naplicados em pré-emergência é primordial para um\nbom controle.\nAinda não existem herbicidas registrados para con-\ntrole de caruru Amaranthus palmeri disponíveis no\nmercado no Brasil. Por isso, é muito importante que\nao suspeitar/identificar esta planta daninha em sua\nlavoura, comunique ao МАРА.\nlavoura\n20\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nHerbicidas Pós-Emergentes\nGlufosinato de amônio\nPode ser utilizado em plantas pequenas (até 5 cm)\nou em manejo sequencial para controle de rebrota\nde plantas maiores. Recomendável dose de 2,5 a\n3,0 L ha-1.\nParaquat\nPode ser utilizado em plantas pequenas (até 5 cm)\nou em manejo sequencial para controle da rebrota\nde plantas maiores, na dose de 1,5 a 2,0 L ha-1.\n2,4 D\nUtilizado em primeiras aplicações de manejo sequen-\ncial, geralmente associado a outros herbicidas sistê-\nmicos (ex: glifosato) ou pré- emergentes. Recomen- Dicamba\ndável dose de 1,2 a 2 L ha-1.\nCuidado com problemas de incompatibilidade no\ntanque (principalmente graminicidas). Quando utilizar\n2,4 D próximo à semeadura de soja, deve-se deixar\num intervalo entre a aplicação e a semeadura de 1\ndia para cada 100 g i.a. ha-1 de produto utilizado.\nSaflufenacil\nUtilizado em primeiras aplicações de manejo sequen-\ncial, geralmente associado a outros herbicidas sis-\ntêmicos (ex: glifosato) ou pré-emergentes, na dose\nde 1,0 a 1,5 L ha-1.\nDeve-se ocorrer um intervalo mínimo de 30 dias\nentre a aplicação do produto e a semeadura da soja,\npara que não ocasione danos ao cultivo.\nPode ser utilizado em plantas pequenas (até 5 cm) Glifosato\nou em manejo sequencial para controle de rebrota\nde plantas maiores. Indicada dose de 35 a 100 g\nha-1.\nMesmo não sendo efetivo para as populações pre-\nsentes no país, pode ser usado no manejo para con-\ntrole de outras plantas daninhas.\nlavoura\n21\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nHerbicidas Pré-Emergentes\nFlumioxazin\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato e 2,4 D) ou no sistema de aplique plante\nda soja. Recomendada dose de 120 g ha-1.\nS-metolachlor\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado no sistema de aplique plante\nda soja e milho, na dose de 1,5 a 2,0 L ha-1. Não\ndeve ser aplicado em solos arenosos.\nControle na pós-emergência\nda soja\nEste herbicida provoca muitos sintomas de fitoin-\ntoxicação nas folhas cultura. Após um período de\nalgumas semanas, porém, estes sintomas desapa-\nrecem e as perdas no crescimento costumam ser\ncompensadas por maior engalhamento da cultura!\nControle na pós-emergência\ndo milho\nSulfentrazone\nHerbicida com ação residual para controle de banco\nde sementes. Utilizado na primeira aplicação do\nmanejo outonal associado a herbicidas sistêmicos\n(ex: glifosato e 2,4 D). Recomenda-se dose de até\n0,5 L ha-1, pois apresenta grande variação na sele-\ntividade de cultivares de soja.\nFomesafen\nRealizar uma aplicação de 20 a 30 dias após emer-\ngência da cultura, na dose de 0,9 a 1,0 L ha-1.\nLactofen\nRealizar uma aplicação no estádio inicial de desen-\nvolvimento da cultura, na dose de 0,62 a 0,75 L ha-1.\nAtrazine\nPode ser aplicado na pré-emergência da cultura\nimediatamente antes da semeadura, simultanea-\nmente ou logo após a semeadura. Em aplicações\nem pós-emergência da cultura e plantas daninhas\ndeve-se acrescentar óleo vegetal. Recomendações\nde dose de 3 a 5L ha-1, dependendo das caracte-\nrísticas do solo e plantas daninhas presentes. Pode\nlavoura\n22\n#E-BOOK\nser misturado com: glifosato (se misturado em pós-\n-emergência - milho RR), mesotrione, nicosulfuron,\nS-metolachlor.\nGlufosinato de amônio\nNo caso de milho Liberty Link! Pode ser utilizado em\nplantas pequenas (até 5 cm) ou em manejo sequen-\ncial para controle de rebrota de plantas maiores, na\ndose de 2,5 a 3,0 L ha-1.\nlavoura\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n23\n#E-BOOK\nSida spp.:\nGuanxuma\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nlavoura\n#E-BOOK\nSIDA SPP.: GUANXUMA\nA guanxuma é um grande problema na lavoura.\nEla causa interferência direta na plantação, redu-\nzindo o rendimento de grãos e pode indicar uma\npossível compactação do solo, demonstrando que\no cultivo está suscetível à seca e ao tombamento.\nPesquisas demonstram que 10 plantas de guan-\nxuma por m² podem reduzir em 6% o rendimento\nde grãos da cultura da soja.\nAlém dos problemas de interferência direta, essa\nplanta daninha pode ser hospedeira de pragas e\ndoenças, como nematoides das galhas e das lesões.\nA guanxuma produz em média 510 sementes por\nplanta, podendo a chegar até 28 mil sementes m²,\nlavoura\nque são indiferentes à luz. Ou seja, são capazes de\ngerminar no claro e no escuro.\nSua germinação é favorecida com alternância de\ntemperatura em 20°C a 30°C e, mesmo com profun-\ndidade de 5 cm de enterrio, as sementes possuem\nboa germinação!\nPor outro lado, a deposição de matéria orgânica na\nsuperfície do solo (palhada) dificulta a emergência\ndas sementes devido à baixa quantidade de reserva\nnas sementes. Nestas condições, a plântula gasta\numa grande quantidade de reserva para atravessar\nessa barreira. Isso a torna mais suscetível ao efeito\nde herbicidas.\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\n#E-BOOK\nGuia de Manejo de Plantas\nDaninhas de Difícil Controle\nEssa planta daninha possui características morfo-\nlógicas que dificulta seu manejo quando está em\nestágio de desenvolvimento avançado.\nQuando adulta, suas folhas possuem maior acúmulo\nde tricomas (pelos) e ceras, o que dificulta a absor-\nção e transporte do herbicida na planta. Por isso,\nNo Brasil, as espécies mais comuns de guanxuma\nsão:\nSida glaziovii\nOcorre frequentemente em solos arenosos e infesta\nprincipalmente áreas de pastagens, beiras de estrada,\ncarreadores pomares e culturas perenes em geral.\né importante que o controle seja feito com plantas É uma das principais infestantes em áreas de novos\npequenas de até 4 folhas de 2 m de altura.\nNo Brasil, não foram registrados casos de\nresistência a herbicidas para as espécies\nde guanxuma. Mundialmente, registrou-se\napenas um caso, nos Estados Unidos, para a\nespécie Sida spinosa resistente a imazaquin.\nSida rhombifolia\nÉ a mais comum em áreas cultivadas do país. Infesta\nprincipalmente lavouras anuais e perenes, pomares\ne pastagens. É mais frequente em cultivos de cere-\nais em sistema de plantio direto.\nÉ curiosamente conhecida como relógio devido à\npontualidade com que suas flores se abrem e se\ncanaviais no cerrado. Pode ser reconhecida pela fecham diariamente.\ncoloração prateada de suas folhas.\nSida spinosa\nPlanta medianamente frequente. Infesta geralmente\ncultivos anuais ou perenes, pomares e pastagens,\nnas regiões centro e sul do país. Muito comum em\náreas de solo arenoso e tolera solos ácidos e pobres.\nControle na entressafra\ndo sistema soja-milho\nHerbicidas Pós-Emergentes\nO principal ponto no manejo eficiente de guanxuma\nem	2026-02-25 17:10:40.146158
f71afc68-2abb-4e99-b54c-4a653bcf1fa7	Manejo de plantas daninhas PR	Plantas Daninhas	MANEJO\nINTEGRADO E\nSUSTENTÁVEL\nDE PLANTAS\nDANINHAS\nSISTEMA FAEP.\nSENAR\nPARANÁ\nFAEP\nFEDERAÇÃO DA AGRICULTURA\nDO ESTADO DO PARANÁ\nANOS\nSINDICATO\nRURAL\nPR.0379\nSENAR - ADMINISTRAÇÃO REGIONAL DO ESTADO DO PARANÁ\nCONSELHO ADMINISTRATIVO\nPresidente: Ágide Meneguette\nMembros Titulares\nRosanne Curi Zarattini\nNelson Costa\nDarci Piana\nAlexandre Leal dos Santos\nMembros Suplentes\nLivaldo Gemin\nRobson Mafioletti\nAri Faria Bittencourt\nIvone Francisca de Souza\nCONSELHO FISCAL\nMembros Titulares\nSebastião Olímpio Santaroza\nPaulo José Buso Júnior\nCarlos Alberto Gabiatto\nMembros Suplentes\nAna Thereza da Costa Ribeiro\nAristeu Sakamoto\nAparecido Callegari\nSuperintendente\nPedro Carlos Carmona Gallego\nALFREDO JUNIOR PAIOLA ALBRECHT\nARTHUR ARROBAS MARTINS BARROSO\nDIONÍSIO LUIZ PISA GAZZIERO\nLEANDRO PAIOLA ALBRECHT\nMANEJO INTEGRADO E\nSUSTENTÁVEL DE PLANTAS DANINHAS\nCURITIBA\nSENAR-AR/PR\n2024\nDepósito legal na CENAGRI, conforme Portaria Interministerial n.º 164, datada de\n22 de julho de 1994, junto à Biblioteca Nacional e ao SENAR-AR/PR.\nNenhuma parte desta publicação poderá ser reproduzida, por qualquer meio, sem a\nautorização do editor.\nAutores: Alfredo Junior Paiola Albrecht, Arthur Arrobas Martins Barroso, Dionísio Luiz\nPisa Gazziero, Leandro Paiola Albrecht.\nOrganização: Paulo Roberto Castellem Junior\nCoordenação pedagógica: Marcia Pereira Salles\nCoordenação gráfica: Carlos Manoel Machado Guimarães Filho\nDiagramação: Sincronia Design Gráfico Ltda.\nNormalização e revisão final: CEDITEC - SENAR-AR/PR\nCatalogação no Centro de Editoração, Documentação e\nInformação Técnica do SENAR-AR/PR\nA341\nAlbrecht, Alfredo Junior Paiola\nManejo integrado e sustentável de plantas daninhas\n[livro eletrônico] / Alfredo Junior Paiola Albrecht ... [et al.].\nCuritiba : SENAR AR/PR, 2024.\n15360 KB; PDF.\nISBN 978-85-7565-229-9\n1. Plantas daninhas. 2. Ervas daninhas. 3. Ervas\ndaninhas - Controle. 4. Ervas daninhas - Manejo. 5.\nHerbicidas. I. Barroso, Arthur Arrobas Martins. II.\nGazziero, Dionísio Luiz Pisa. III. Albrecht, Leandro\nPaiola. IV. Título.\nCDD: 632.58\nBibliotecária responsável: Luzia Glinski Kintopp - CRB/9-1535\nIMPRESSO NO BRASIL – DISTRIBUIÇÃO GRATUITA\nAPRESENTAÇÃO\nO Serviço Nacional de Aprendizagem Rural – SENAR – é uma instituição prevista\nna Constituição Federal e criada pela Lei n.º 8.315, de 23.12.1991. Tem como objetivo\na formação profissional e a promoção social do homem do campo para que ele melhore\no resultado do seu trabalho e com isso aumente sua renda e a sua condição social.\nNo Paraná, o SENAR é administrado pela Federação da Agricultura do Estado\ndo Paraná – FAEP e vem respondendo por um amplo e diversificado programa de\ntreinamento.\nTodos os cursos ministrados pelo SENAR são coordenados pelos Sindicatos\nRurais e contam com a colaboração de outras instituições governamentais e\nparticulares, Prefeituras Municipais, Cooperativas e empresas privadas.\nO material didático de cada curso levado pelo SENAR-PR é preparado de forma\ncriteriosa e exclusiva para seu público-alvo, a exemplo deste manual. O intuito não\né outro senão o de assegurar que os benefícios dos treinamentos se consolidem e\nse estendam. Afinal, quanto maior o número de trabalhadores e produtores rurais\nqualificados, melhor será o resultado para a economia e para a sociedade em geral.\nSUMÁRIO\n1. INTRODUÇÃO AO MANEJO INTEGRADO E SUSTENTÁVEL DE PLANTAS DANINHAS ... 7\n2. PLANTAS DANINHAS..\n2.1 CONCEITOS\n2.1.1 Desenvolvimento\n2.1.2 Reprodução\n2.1.3 Maneiras de interação\n2.1.4 Interferência\n2.1.5 Competição.\n2.1.6 Alelopatia\n2.2 IDENTIFICAÇÃO\n2.2.1 Por que saber identificar as plantas daninhas?\n2.2.2 Identificação visual de plantas jovens e adultas\n9\n9\n10\n11\n12\n12\n14\n16\n17\n17\n18\n2.2.3 Identificação do banco de sementes das espécies infestantes\n2.2.4 Identificação por novas tecnologias\n20\n20\n2.3 PRINCIPAIS FAMÍLIAS DE PLANTAS DANINHAS E COMO IDENTIFICÁ-LAS\n22\n2.3.1 Poaceae\n22\n2.3.2 Asteraceae.\n24\n2.3.3 Amaranthaceae.\n25\n2.3.4 Commelinaceae\n26\n2.3.5 Convolvulaceae\n27\n2.3.6 Brassicaceae..\n28\n2.3.7 Euphorbiaceae\n29\n2.3.8 Fabaceae\n30\n2.3.9 Identificação e notificação de plantas resistentes..\n31\n3. MÉTODOS DE CONTROLE\n35\n3.1\nCONTROLE PREVENTIVO\n35\n3.2 CONTROLE FÍSICO\n38\n3.3 CONTROLE MECÂNICO\n41\n3.4 CONTROLE BIOLÓGICO\n44\n3.5 CONTROLE CULTURAL\n46\n3.5.1 Seleção de genótipos\n47\n3.5.2 Arranjo espacial e zoneamento agroclimático\n47\n3.5.3 Rotação de culturas\n48\n3.5.4 Nutrição\n49\n3.5.5 Controle de pragas e doenças\n49\n3.6 CONTROLE QUÍMICO\n50\n3.6.1 Classificação dos herbicidas por seletividade\n51\n3.6.2 Classificação dos herbicidas quanto à época de aplicação\n52\n3.6.3 Classificação dos herbicidas quanto à translocação\n52\n3.6.4 Comportamento de herbicidas no ambiente\n53\n3.6.5 Cuidados com herbicidas pós emergentes no ambiente\n54\n3.6.6 Cuidados com a aplicação de pré-emergentes\n57\n3.6.7 Propriedades físico-químicas dos herbicidas\n59\n4. MECANISMOS DE AÇÃO DE HERBICIDAS\n63\n4.1 INIBIDORES DA EPSPS.\n63\n4.2 INIBIDORES DA ACCASE\n4.3 INIBIDORES DA ALS\n4.4 INIBIDORES DA GS\n4.5 AUXINAS SINTÉTICAS\n65\n67\n70\n72\n4.6 INIBIDORES DO FSII.\n74\n4.7 ATUANTES NO FSI...\n76\n4.8 INIBIDORES DA PROTOX\n79\n4.9 INIBIDORES DA SÍNTESE DE CAROTENOIDES\n81\n4.10 INIBIDORES DA SÍNTESE DE ÁCIDOS GRAXOS DE CADEIA MUITO LONGA.\n83\n4.11 INIBIDORES DA SÍNTESE DE CELULOSE\n84\n4.12 ATUANTES NOS MICROTÚBULOS.\n85\n4.13 MECANISMOS DE AÇÃO DESCONHECIDOS\n87\n5. RESISTÊNCIA DE PLANTAS DANINHAS E CULTIVOS A HERBICIDAS\n89\n6. MANEJO INTEGRADO E SUSTENTÁVEL DE PLANTAS DANINHAS (MISPD)\nREFERÊNCIAS\n91\n95\nSENAR-AR/PR\n7\n1.\nINTRODUÇÃO AO MANEJO INTEGRADO E SUSTENTÁVEL DE\nPLANTAS DANINHAS\nO controle de plantas daninhas no Brasil tem muito a evoluir. Isso porque ao\nlongo do tempo foram introduzidas novas espécies e/ou ocorreu a seleção de espécies\nde difícil controle nas lavouras. Como consequência, nos últimos anos aumentou\na quantidade de herbicidas aplicados por área. Além do impacto nos custos e na\nrentabilidade do sistema ao agricultor e dos preços ao consumidor, o maior uso de\nherbicidas aumenta as chances de problemas ambientais e de casos de intoxicação\nhumana.\nEntre os principais motivos para esse aumento está a resistência de plantas\ndaninhas a herbicidas. No início de 2024, havia no Brasil relato de 29 espécies\nresistentes a oito dos mecanismos de ação de herbicidas registrados para uso nas\nprincipais culturas. Dados atualizados podem ser consultados nos QR Codes a seguir.\nQR CODE\nPara consultar dados no site oficial da Sociedade Norte-americana de Plantas Da-\nninhas, acesse o QR Code à esquerda; para consultar dados do Comitê de Ação à\nResistência de Plantas Daninhas no Brasil (HRAC-BR), acesse o QR Code à direita.\nLigue a câmera do seu celular, aponte para o QR Code e acesse o link. Caso não\nfuncione, baixe um aplicativo leitor de QR Code.\nMas o que falta para convencer os agentes envolvidos na produção de alimentos\nde que precisamos mudar essa situação, e logo? Muitas vezes o problema é conhecido,\nmas não se identificam opções para mudar aquilo que vem sendo feito ou cria-se a\nesperança do surgimento de um herbicida ou método de controle milagroso, como\no herbicida glifosato. As chances para isso acontecer são muito baixas, e a real\nmudança está em usar cada ferramenta de maneira integrada e técnica, mas também\nsustentável.\nA principal mudança para que possamos ter uma nova realidade é\ncomportamental, tornando o controle efetivo duradouro, diminuindo os problemas\nno campo e aumentando as soluções possíveis para o manejo integrado e, agora,\nsustentável de plantas daninhas (MISPD).\n8 SENAR-AR/PR\nEsta cartilha traz informações básicas, mas fundamentais para o entendimento\nda ciência das plantas daninhas. Essas recomendações serão utilizadas para compor\ncinco grandes grupos de atividades obrigatórias, a saber: controle preventivo, uso da\ncorreta tecnologia de aplicação, planejamento e monitoramento do controle químico\nde plantas daninhas, controle cultural e outros métodos não químicos de controle\n(Figura 1). Podemos resumir esse entendimento em algumas ações: prefira não ter\nproblemas com plantas daninhas de difícil controle. Se tiver, faça de tudo para que\nsua cultura expresse seu máximo potencial produtivo frente a essas espécies que\nserão controladas de maneira integrada, usando métodos químicos e não químicos.\nPor fim, ambos devem se apresentar diversificados ao longo do tempo.\nFigura 1 - Princípios do Manejo Integrado Sustentável de Plantas Daninhas (MISPD).\nControle cultural\nOutros métodos de controle\nnão químicos\nTecnologia de aplicação\nFonte - Os autores, 2024.\nPrevenção\nPrincípios a\nseres seguidos\nMISPD\nControle químico\nSENAR-AR/PR 9\n2.\nPLANTAS DANINHAS\n2.1 CONCEITOS\nQuando falamos em plantas-daninhas nos referimos a um vegetal que em\ndeterminado local e momento está agindo contra os interesses de alguma atividade-\nfim humana.\nPARA SABER MAIS\nSe uma árvore de eucalipto sombreia o gado, ajuda a elevar seu ganho de peso diário\nem uma pastagem e isso traz retorno ao pecuarista, ela não é uma planta daninha.\nSe, por outro lado, ela sombreia o milho e reduz sua produtividade, ela passa a ser\numa planta daninha. Dependendo do momento, a árvore pode ou não atrapalhar. Por\noutro lado, se a mudarmos de local pensando na produção de madeira, ela não será\nmais considerada daninha (a não ser que esteja em densidade incorreta de plantio e/\nou prejudique o crescimento de outra).\nÉ importante, nessa conceituação, considerar a questão ambiental junto à econômica.\nExemplificando esse conceito de modo simples: o eucalipto pode atrapalhar a\nprodutividade do milho, mas fixa carbono e eleva a sustentabilidade do sistema\ndurante a entressafra, certificando o produtor, que ganha um bônus na venda de\nseus produtos, superando as perdas que teve no milho. Outra questão que envolve\na presença dos eucaliptos é que o produtor pode perder um pouco da produtividade\ndo milho, mas em consequência não tem sua área invadida por plantas daninhas\nresistentes.\nATENÇÃO\nPrecisamos, cada vez mais, pensar no sistema de produção e não apenas em\numa safra.\n10 SENAR-AR/PR\nDesde que deixou de ser nômade, o ser humano passou a selecionar espécies\nque o interessavam frente a outras que julgava sem valor. Mas as espécies não\nselecionadas foram se adaptando a mudanças climáticas e distúrbios ambientais,\nmuito antes de o ser humano começou a praticar a agricultura. Isso conferiu a essas\nespécies características de agressividade (sobrevivência) (Figura 2), que passaram a\ndificultar seu controle.\nFigura 2 - Características de agressividade de plantas daninhas.\nDesenvolvimento\nReprodução\nFonte - Os autores, 2024.\nCaracterísticas\nque conferem\nagressividade as\nplantas daninhas\n2.1.1 Desenvolvimento\nAs espécies consideradas daninhas têm elevada plasticidade genotípica\n(diferenças genéticas dentro da mesma população), o que lhes permite crescer muito\nou pouco, encerrar seu ciclo rápido ou devagar, produzir folhas de diferentes tamanhos\ne formas, sobreviver à seca, à salinidade, a solos pobres e variar sua resposta aos\nmétodos de controle aplicados.\n? VOCÊ SABIA?\nPor que a plasticidade das plantas daninhas influencia o manejo de controle\nadotado?\nPorque as plantas daninhas variam seu comportamento conforme o método de manejo\nadotado contra elas, adaptando-se a alagamentos, geadas, ao baixo crescimento etc.\nPor causa dessa sua característica é obrigatório ao produtor variar o método de\ncontrole empregado no campo, a fim de não selecionar plantas resistentes.\nPARA SABER MAIS\nSENAR-AR/PR 11\nImagine se tivéssemos de esvaziar uma sala de aula e que o critério para isso fosse\nretirar todos os alunos com menos de 1,80 m de altura. Existem grandes chances\nde sobrar algum aluno dentro da classe. Se quisermos diminuir essa probabilidade,\nprecisamos inserir novos filtros, gradativamente. Por exemplo: retirar da sala alunos\ncom menos de 1,80 que tenham cabelos claros ou mais de 20 anos. Isso aumenta as\nchances de não sobrar ninguém.\n2.1.2 Reprodução\nAs plantas daninhas têm a capacidade de produzir sementes muito rapidamente\ne em grandes quantidades. Algumas chegam a produzir mais de 500 mil sementes.\nEstas, por sua vez, muitas vezes têm características que facilitam sua disseminação,\nseja no espaço, seja no tempo. Por exemplo, no espaço, os “ganchos” presentes na\nsemente do capim-carrapicho ou os “papilos” da semente da buva são transportados\npelos homens/animais ou pelo vento, respectivamente. No tempo, apresentam\numa característica denominada dormência, que é a não germinação de sementes,\nmesmo que haja todas as condições ambientais para tal (água, temperatura e luz\netc.), bem como elevada longevidade (algumas sementes ficam viáveis no solo por\nmais de 50 anos ou passam ilesas pelo trato digestório de animais). Com isso, a\nespécie garante vários fluxos de emergência no campo, que encontrarão diferentes\ncondições edafoclimáticas.\nIL PARA SABER MAIS\nPara entender o que é a dormência, imagine se toda hora chegasse à sala de aula um\naluno atrasado, "escapando” dos métodos de controle que apresentamos no exemplo\nanterior.\nFora as sementes, muitas espécies apresentam reprodução alternativa por\nmeio de estruturas vegetativas, tais como bulbos, tubérculos, estolões e rizomas. Por\nfim, existem espécies que produzem sementes sem a necessidade de fecundação,\ntanto subterrâneas (como é o caso da trapoeraba) quanto aéreas (plantas femininas\ndo caruru-palmeri). A soma dessas características facilita a ocorrência dessas\nplantas no meio das lavouras.\nUma vez identificado o tipo de reprodução das plantas daninhas, será possível\nescolher as melhores medidas de manejo a adotar. Por exemplo: uma espécie que\napresenta reprodução por bulbos ou tubérculos dificilmente será bem controlada por\num método de preparo do solo.\nQR CODE\nInformações mais detalhadas sobre esse assunto podem ser\nencontradas no Capítulo 2 do e-book gratuito Matologia,\nde Arthur Arrobas Martins Barroso e Afonso Takao Murata,\n2022.\nLigue a câmera do seu celular, aponte para o QR Code ao\nlado e acesse o link. Caso não funcione, baixe um aplicativo\nleitor de QR Code.\n2.1.3 Maneiras de interação\nA interação entre plantas pode ser positiva ou negativa. A interação positiva, tal\ncomo presente no consórcio milho-braquiária em sistemas integrados de produção\nagropecuária, traz diversos benefícios, como maior cobertura, melhorando os aspectos\nquímicos, físicos e biológicos do solo. A interação negativa refere-se à interferência de\numa planta no crescimento e desenvolvimento de outra, reduzindo a produtividade e\na qualidade de produção.\n2.1.4 Interferência\nComo visto anteriormente, a simples presença de uma planta não a torna\ndaninha. Existem características dessas espécies que são responsáveis por prejudicar\na quantidade e qualidade da produção que quando quantificadas são denominadas\ninterferência.\nA interferência da comunidade infestante nas espécies cultivadas pode ser\ndividida em dois grupos: diretas e indiretas (Figuras 3 e 4). A interferência indireta\ntem sido muito problemática na ponte verde, em que plantas daninhas servem de\nhospedeiras para pragas e doenças que se perpetuam de uma safra para outra, a\nexemplo da cigarrinha do milho em plantas daninhas da família das gramíneas.\nFigura 3 - Interferências diretas.\nNUTRIENTE\nLUZ\nALELOPATIA\nÁGUA\nESPAÇO\nPLANTA DANINHA\nCULTURA\nPLANTA DANINHA\nFonte - Adaptado de Silva et al., 2022.\nFigura 4 - Interferências indiretas.\nFerimentos e\nenvenenamentos\nAbrigo para animais\npeçonhentos\nFonte - Os autores, 2024.\nCo\n0,\nH₂O\nSENAR-AR/PR 13\nALELOPATIA\nInterferência indireta\nHospedeiro de pragas\ne doenças\nFacilidade de\nincêndios\nMenor eficácia de\ntrabalho\nA soma desses efeitos e sua intensidade será influenciada por vários fatores,\ncomo demonstrado na Figura 5.\nFigura 5 - Fatores que podem influenciar o grau de interferência entre plantas daninhas e cultivadas.\nCultivar\nÉpoca\nConvivência\nDuração\nEspécies\nEspaçamento\nCultura\nGrau de\ninterferência\nComunidade\nDensidade\nDensidade\nAmbiente\nSolo\nClima\nManejo\nFonte - Adaptado de Pitelli, 2014.\nDistribuição\nATENÇÃO\nPensando em diminuir o grau de interferência de plantas daninhas, é fundamental\notimizar a ocupação da cultura no espaço, diminuindo assim a probabilidade de\nocorrência de plantas daninhas.\n2.1.5 Competição\nÉ a interação entre indivíduos que têm a mesma necessidade de um recurso\nlimitado, resultando na limitação de desenvolvimento da espécie que for menos\nadaptada. Dois fatores influenciam a competição: habilidade competitiva e plasticidade\nfenotípica (Ex: Uma planta que consegue crescer muito com pouca água ou que\nconsegue modificar seu formato de folha para evapotranspirar menos na seca).\nEssas características determinam a capacidade da planta de captar recursos\ncomo água, luz, nutrientes e espaço. A espécie e o estádio fenológico da planta\nsão características que determinam sua demanda por recursos, além de períodos\nSENAR-AR/PR 15\nespecíficos em que a presença de plantas daninhas não prejudica a produtividade da\ncultura.\nO chamado Período Anterior à Interferência (PAI) se refere ao momento em\nque a presença de plantas daninhas na cultura não provoca perdas de produtividade. O\nPeríodo Total de Prevenção à Interferência (PTPI) caracteriza-se pelo momento em\nque se encerra a interferência entre plantas, que em geral coincide com o fechamento\nde entrelinhas. A diferença entre o PTPI e o PAl é chamada de Período Crítico de\nPrevenção à Interferência (PCPI) e representa o momento no qual o controle de\nplantas deve ocorrer (Figura 6).\nFigura 6 – Períodos de interferências na cultura.\nDIA 1\nDIA 15\nDIA 21\nCOLHEITA\nPAI\nPCPI\nPTPI\nFonte - Os autores, 2021.\nEm geral, esses períodos variam de acordo com o cultivo estabelecido. Plantas\ncom maiores espaçamentos, como a cana-de-açúcar, tendem a ter maiores períodos\nde controle do que plantas de alface, por exemplo. Quando falamos de eucalipto ou\npinus, o período de controle às vezes pode se estender por anos. Importante destacar\nque a aplicação de herbicidas, plantio direto, arranjo populacional e outros fatores\npodem diminuir o período necessário de controle dentro da lavoura.\nATENÇÃO\nConhecer a habilidade competitiva da cultura de interesse e ajustar o manejo\nde acordo com o ambiente e a densidade de plantas daninhas é essencial para\notimizar a produtividade e minimizar o uso de herbicidas, contribuindo para um\ncontrole mais sustentável das plantas daninhas.\n16 SENAR-AR/PR\n2.1.6 Alelopatia\nÉ o fenômeno biológico por meio do qual as plantas liberam substâncias\nquímicas chamadas aleloquímicos, afetando o crescimento, o desenvolvimento e a\nsobrevivência de outras plantas a seu redor. Esse processo pode ocorrer tanto em\nplantas de mesma espécie quanto de espécies diferentes e exerce papel significativo\nna ecologia, na agricultura e no manejo de plantas daninhas.\nOs aleloquímicos podem ser liberados por exsudação radicular (diretamente\npelas raízes ou pelos microrganismos associados a elas); lixiviação das folhas\n(alguns compostos provenientes da parte aérea das plantas podem ser levados até\no solo por meio de chuva ou orvalho); decomposição de resíduos vegetais (alguns\ntecidos e células se rompem, extravasando o conteúdo com potencial aleloquímico\npresente na planta) volatilização (liberação na forma de gás na atmosfera) (Figura 7).\nFigura 7 - Modos de liberação da aleloquímicos.\nLIXIVIAÇÃO\nVOLATILIZAÇÃO\nEXSUDAÇÃO RADICULAR\nDECOMPOSIÇÃO\nFonte - Os autores, 2024.\nSENAR-AR/PR 17\nOs compostos químicos podem afetar as plantas da mesma maneira como os\nherbicidas exercem sua função, inibindo o estabelecimento de plântulas, impedindo\nprocessos ligados à divisão e ao alongamento de células, bem como a absorção de\nnutrientes, a fotossíntese de plantas e muitos outros mecanismos.\nA compreensão dos mecanismos alelopáticos tem levado ao desenvolvimento de\nestratégias de manejo sustentável na agricultura, incluindo a síntese de moléculas\norgânicas para o controle de plantas daninhas.\nATENÇÃO\nAção prática de alelopatia entre as plantas é o uso de coberturas vegetais\npara controlar plantas daninhas. Plantas de cobertura, como centeio (Secale\ncereale) e trigo-mourisco (Fagopyrum esculentum), são cultivadas para liberar\naleloquímicos no solo, suprimindo o crescimento de plantas daninhas. Outro\nexemplo é a utilização de sorgo (Sorghum bicolor), uma espécie que contém em\nsua composição química o sorgoleone, aleloquímico produzido e liberado pelas\nraízes que age diretamente no processo fotossintético e na respiração de outras\nplantas.\nQR CODE\nQuer saber mais sobre alelopatia?\nLigue a câmera do seu celular, aponte para o QR Code e acesse o link. Caso não\nfuncione, baixe um aplicativo leitor de QR Code.\n2.2 IDENTIFICAÇÃO\n2.2.1 Por que saber identificar as plantas daninhas?\nIdentificar a espécie que está presente na propriedade é fundamental para fazer\no manejo mais adequado e assertivo possível. Cada planta responde diferente a um\nmanejo. Como exemplo temos o caso da erva-quente (Spermacoce latifólia), planta\nque tem tolerância ao herbicida glifosato, o que impede o produtor de realizar seu\n18 SENAR-AR/PR\ncontrole com esse herbicida. Outro exemplo é adotar o controle mecânico em áreas\ncom infestação de trapoeraba, que quanto mais cortes recebe no caule mais gera\npontos de rebrota, aumentando a infestação.\nATENÇÃO\nPor que é importante saber identificar plantas daninhas de difícil controle?\nÉ importante que o produtor saiba identificar plantas daninhas de difícil controle\na fim de fazer um controle preventivo e pensar no melhor manejo para que a\ninfestação da planta não aumente na área.\nQR CODE\nPara mais informações sobre esse assunto, consulte a cartilha gratuita Plantas da-\nninhas resistentes: biologia, identificação, ocorrência e controle, de Barroso et al.,\nproduzida pelo SENAR-PR em parceria com a UFPR e a EMBRAPA.\nLigue a câmera do seu celular, aponte para o QR Code e acesse o link. Caso não\nfuncione, baixe um aplicativo leitor de QR Code.\nTrês são os tipos de identificação de plantas daninhas que podem ser realizados\nem uma propriedade.\n2.2.2 Identificação visual de plantas jovens e adultas\nPode ser realizada por meio de manuais de identificação (livros e cartilhas) ou\naplicativos que fazem esse reconhecimento por meio de inteligência artificial. A seguir\nsão listados alguns exemplos que podem ser adquiridos pela internet ou em livrarias.\n☐\n☐\nManual de identificação e controle de plantas daninhas, de Harry Lorenzi, 201.\nManual de identificação de plantas infestantes, cultivos de verão, hortaliças\ne arroz, de Henrique José da Costa Moreira e Horlandezan Berlindes Nippes\nBragança, 2011.\nQR CODE\nSENAR-AR/PR 19\nAcessar pelos seguintes QR Codes.\nLigue a câmera do seu celular, aponte para o QR Code ao lado e acesse o link.\nCaso não funcione, baixe um aplicativo leitor de QR Code.\nOutro meio de fazer a identificação é por meio de aplicativos de celular, apenas\ntirando uma foto da planta. Na Figura 8 apresentamos sugestões de aplicativos que\npodem ser utilizados para essa funcionalidade e baixados nas lojas de aplicativos em\ncelulares e tablets.\nFigura 8 Aplicativos para identificação de plantas daninhas.\nA\n- BASF\nWe create chemistry\nAdama Alvo\nBASF Agro\nGoogle Lens\nFonte - Play Store, 2024.\nRessaltamos que nenhum deles é 100% assertivo, pois têm uma margem de erro.\nPor esse motivo é recomendado consultar mais de uma ferramenta de identificação e,\nna dúvida, uma instituição ou pesquisador da área.\n20 SENAR-AR/PR\n2.2.3 Identificação do banco de sementes das espécies infestantes\nEssa metodologia tem como objetivo trazer maior precisão ao manejo empregado\ne, consequentemente, a redução de custos e maior assertividade para questões\nambientais. Para o manejo integrado e sustentável de plantas daninhas, deve ser\nfeito o levantamento do banco de sementes de espécies de plantas daninhas no solo\nde forma adequada, considerando diversos fatores para fazer a amostragem de solo,\ncomo relacionar o comportamento das espécies ao longo do ano com os processos\nde manejo estabelecidos dentro de cada propriedade.\nPara determinar esse banco de sementes, podem ser adotadas as seguintes\nmetodologias:\n☐\nMetodologia 1: demarca-se uma parcela na área produtiva e avalia-se, ao\nlongo da safra, quais espécies são recorrentes naquele ambiente quando as\nplantas estiverem mais velhas.\nMetodologia 2: uma amostra do solo é retirada de diversos pontos da área\ncom um trado, a uma profundidade de pelo menos 10 cm. Essa amostra é\npassada por uma peneira para que toda a mostra escorra por ela, menos as\nsementes, para determinar as espécies ali presentes. Pode-se utilizar junto ao\nsolo solução de carbonato de cálcio para decantar o solo e boiar as sementes.\nMetodologia 3: uma amostra do solo é retirada de diversos pontos da área\ncom um trado, a uma profundidade de pelo menos 10 cm. Essa amostra é\ncolocada para germinar em uma bandeja a fim de se observar sua densidade\ne as espécies que nela germinam e dela emergem.\n2.2.4 Identificação por novas tecnologias\nOs drones são uma tecnologia inovadora que além de pulverizarem lavouras\ntambém são utilizados como ferramenta de identificação e mapeamento de focos de\nplantas daninhas por meio de fotografias (Figura 9). Essas fotos são georreferenciadas\nquando são tiradas, e posteriormente são gerados mapas (Figura 10) que servirão\ncomo manuais de aplicação de herbicidas. Esse mapeamento pode ser realizado por\nempresas que fornecem esse tipo de serviço ou pelo próprio produtor. Trata-se de\numa tecnologia em desenvolvimento, mas que em breve estará mais acessível.\nAs plantas também podem ser identificadas por sensores a laser do tipo\nWeedSeeker que separam as plantas verdes do solo ou da cobertura ou separam as\nespécies entre si.\nFigura 9 - Mapeamento e identificação de plantas daninhas por meio de drone.\nFonte - NetWord Agro, 2024.\nFigura 10 - Exemplo de mapa para identificação de plantas daninhas no talhão.\n200m\nFonte - iField, 2024.\nSENAR-AR/PR\n21\nLegenda\nTrepadeiras\n!!!!!!!\nÁrea de infestação\nDaninhas Indefinidas\n2.539 ha (6.54%)\nGramineas porte baixo\n2.008 ha\n(5.17%)\nOutras folhas largas\n0.06 ha\n(0.15%)\n0.019 ha\n(0.05%)\nInf. folhas largas\n0.079 ha (0.2%)\nInf. folhas estreitas\n2.008 ha (5.17%)\n.\nInfestação total:\n4.613 ha\n(11.88%)\nÁrea total:\n38.843 ha\n22 SENAR-AR/PR\n2.3 PRINCIPAIS FAMÍLIAS DE PLANTAS DANINHAS E COMO\nIDENTIFICÁ-LAS\n2.3.1 Poaceae\nEssa é uma família de plantas de grande valor econômico. Conhecida por\ngramíneas, ela engloba espécies cultivadas (como milho, trigo e arroz) e plantas\ndaninhas (capim-amargoso, capim-pé-de-galinha, capim-arroz, arroz-vermelho,\ncapim-colchão, capim-papua, capim-carrapicho, azevém, grama-seda, capim-\ncolonião, capim-rabo-de-burro, capim-amalote, capim-capeta, capim-annoni, entre\nmuitas outras espécies) (Figura 11).\nIdentificação:\n☐\nFolhas estreitas;\nAnuais ou perenes;\nHerbáceas de tamanhos variados;\nPossuem nós e entre-nós;\nPossuem folha com bainha, aurícula e lígula;\nReprodução por sementes ou, em alguns casos, por rizomas;\nInflorescência em forma de espiga, panícula ou rácemo.\nSENAR-AR/PR 23\nFigura 11 - Exemplos de espécies da família Poaceae. (A) Capim Pé de galinha (Eleusine indica),\n(B) Capim annoni (Eragrostis plana) e (C) Capim amargoso (Digitaria insularis).\nA\nFonte - Os autores, 2024.\nC\nB\n24 SENAR-AR/PR\n2.3.2 Asteraceae\nFamília de plantas extremamente importante para a agropecuária, com diversas\nespécies em todo o país. Apresenta entre 20 e 25 mil espécies. Fazem parte dessa\nfamília as plantas buva, picão-preto, cravorana, picão-branco, mentrasto, serralha e\nfalsa-serralha, entre outras (Figura 12).\nIdentificação:\n•\nFolhas largas;\n•\n•\n•\nInflorescência em formato de capítulo;\nReprodução por meio de sementes ou rizomas (losna-brava);\nEspécies anuais e perenes.\nFigura 12 - Exemplo de espécies da família Asteraceae. (A) Cravorama (Ambrosia artemissifolia),\n(B) Buva (Conyza spp.) e (C) Picão preto (Bidens subalternans).\nA\nC\nFonte - Rizzardi, 2020 (B); Os autores, 2024 (A е С).\nB\nSENAR-AR/PR 25\n2.3.3 Amaranthaceae\nAs plantas dessa família produzem sementes pequenas, mas em grande\nquantidade, podendo chegar a 500 mil por planta. Dela fazem parte as espécies de\ncaruru, a erva-de-jacaré e o apaga-fogo (Figura 13).\nIdentificação:\n☐\n☐\n☐\nFolhas largas;\nAnuais ou perenes;\nPorte variando de subarbustivo a herbáceo ereto ou prostrado;\nInflorescência do tipo espiga de glomérulos ou somente glomérulos.\nFigura 13 - Exemplo de espécies da família Amaranthaceae. (A) (B) e (C) Caruru (Amar	2026-02-25 18:20:16.312135
\.


--
-- Data for Name: farm_pdv_terminals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_pdv_terminals (id, farmer_id, name, username, password, property_id, is_online, last_heartbeat, created_at, type) FROM stdin;
0746179a-5f92-40a4-b76d-4d720ff0c44c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Bomba Diesel	Henrique	bf46bccd05248e8fe95f3e1600f5e274bff9c53f511f2b334c7e488d2235a34fa9dcc018501d8a8c834f9214e00ccaed0f949125fbf2b9bce63ef44efb5959a3.7bad54c819773582be7b3eef8e6873fe	\N	t	2026-02-27 20:05:58.578	2026-02-26 11:04:21.991758	diesel
4c7301b6-b06e-412e-b52e-07be95835c3b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Deposito Central	Thiago	c0dd5f816462c35e28fd710d803badc2a3a92766f8caa9f69870806e31f7bb3d9354595a19dd08e592530a770982b9bfc04a05dbc476b2ce090e9de5c87fa4c5.30d04e1839569e297fb87c53dd0c45db	\N	t	2026-02-28 00:22:10.063	2026-02-10 15:39:20.652505	estoque
85e3aa51-1170-4a5c-adc8-ed584a0f352b	b1f7c63d-e398-42fc-893c-733221086476	Deposito Central	Miotto	f5652831891db14046fb7fe9dddaba1cbbe85aa106d45f5a2753003a32218242b96b32d598ca71fafb4627b06399f077f587023c0775e9e0c097c0955cc85033.7aa58a927630571bccee40eaa6a90be2	8fea32a5-5604-42cd-a3cd-62e126c49fee	t	2026-02-27 12:44:56.484	2026-02-26 14:30:44.286753	estoque
\.


--
-- Data for Name: farm_plots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_plots (id, property_id, name, area_ha, crop, created_at, coordinates) FROM stdin;
542bcef0-f46a-480a-9895-e6c37233854a	33e03ff4-2d68-4bbd-90fd-81823b5eb882	Talhao 01	105.12	Soja	2026-02-11 21:14:23.639078	[{"lat":-24.14863537557348,"lng":-54.87795352935792},{"lat":-24.146442845774516,"lng":-54.87160205841065},{"lat":-24.148008942326303,"lng":-54.87005710601807},{"lat":-24.150240596753385,"lng":-54.86808300018311},{"lat":-24.15188494876135,"lng":-54.866752624511726},{"lat":-24.154351437096178,"lng":-54.86546516418458},{"lat":-24.15521273926599,"lng":-54.86507892608643},{"lat":-24.15760086491074,"lng":-54.86804008483887},{"lat":-24.15830554919344,"lng":-54.86932754516602},{"lat":-24.159323419627505,"lng":-54.870529174804695},{"lat":-24.1559957361997,"lng":-54.87417697906495},{"lat":-24.154351437096178,"lng":-54.87559318542481}]
ec36a4c1-1525-4b97-8661-11bbb5dfc632	cad25d1a-ebb5-44aa-b087-74363f1379c8	Somax	48.95		2026-02-13 02:12:19.961136	[{"lat":-24.100908848469707,"lng":-54.91651407450439},{"lat":-24.101672594700467,"lng":-54.91462579935789},{"lat":-24.103043409845117,"lng":-54.91217962473631},{"lat":-24.108311120076614,"lng":-54.91606346338989},{"lat":-24.108076133903566,"lng":-54.916556989848615},{"lat":-24.108213209223575,"lng":-54.91732946604492},{"lat":-24.108879001547706,"lng":-54.91782299250366},{"lat":-24.10977977388719,"lng":-54.91808048456909},{"lat":-24.110425976226672,"lng":-54.9178659078479},{"lat":-24.111267992562862,"lng":-54.92267242640257}]
de0806d1-8cb5-4134-bf38-535e365d1ccc	33e03ff4-2d68-4bbd-90fd-81823b5eb882	FERNANDO 	76.80		2026-02-17 12:38:48.015493	[{"lat":-24.162182800877385,"lng":-54.857976436615},{"lat":-24.15932379819057,"lng":-54.85301971435547},{"lat":-24.151181536549206,"lng":-54.85718250274659},{"lat":-24.15493956794301,"lng":-54.865036010742195},{"lat":-24.15491957468749,"lng":-54.86507892608643}]
e4da1b20-2fba-4331-ba5b-24d3c75b6e42	8fea32a5-5604-42cd-a3cd-62e126c49fee	somax	132.84		2026-02-26 13:42:13.014931	[{"lat":-24.123292733742847,"lng":-54.928979873657234},{"lat":-24.124232489835375,"lng":-54.91979598999024},{"lat":-24.12360598654064,"lng":-54.919967651367195},{"lat":-24.123096950354753,"lng":-54.92052555084229},{"lat":-24.122313813806606,"lng":-54.92061138153077},{"lat":-24.121452358067447,"lng":-54.92065429687501},{"lat":-24.120199321184725,"lng":-54.92108345031738},{"lat":-24.118946272032137,"lng":-54.92138385772706},{"lat":-24.11761489386392,"lng":-54.92142677307129},{"lat":-24.116518454384398,"lng":-54.920954704284675},{"lat":-24.115656959632364,"lng":-54.92056846618653},{"lat":-24.11503041435243,"lng":-54.919195175170906},{"lat":-24.114599662693394,"lng":-54.91782188415528},{"lat":-24.11369899544936,"lng":-54.91713523864747},{"lat":-24.11260252242473,"lng":-54.91713523864747},{"lat":-24.111231917936653,"lng":-54.91756439208985},{"lat":-24.110057102410195,"lng":-54.917950630187995},{"lat":-24.1090389202336,"lng":-54.917950630187995},{"lat":-24.108216536410517,"lng":-54.91726398468018},{"lat":-24.10825569766473,"lng":-54.916234016418464},{"lat":-24.10304714571887,"lng":-54.91202831268311},{"lat":-24.10108898869204,"lng":-54.91576194763184},{"lat":-24.100775680789475,"lng":-54.916534423828125},{"lat":-24.10292965714156,"lng":-54.91765022277833},{"lat":-24.111036116097576,"lng":-54.922671318054206},{"lat":-24.11228924269264,"lng":-54.923186302185066},{"lat":-24.115108732680167,"lng":-54.9237871170044}]
3ae46447-1724-4015-a161-cc8aa4c5dd26	8fea32a5-5604-42cd-a3cd-62e126c49fee	sede	119.52		2026-02-26 13:44:09.94777	[{"lat":-24.12221909953977,"lng":-54.916470050811775},{"lat":-24.110588949158736,"lng":-54.90260839462281},{"lat":-24.109257484060656,"lng":-54.90303754806519},{"lat":-24.107573552489075,"lng":-54.90436792373658},{"lat":-24.106437865203628,"lng":-54.90586996078492},{"lat":-24.10459724717749,"lng":-54.90930318832398},{"lat":-24.110549788618187,"lng":-54.914195537567146},{"lat":-24.11172459962342,"lng":-54.91363763809205},{"lat":-24.113134358598433,"lng":-54.91355180740357},{"lat":-24.114504942717183,"lng":-54.914238452911384},{"lat":-24.115914671071543,"lng":-54.91496801376343},{"lat":-24.117128591379203,"lng":-54.915440082550056},{"lat":-24.11849913272706,"lng":-54.91578340530396},{"lat":-24.11971302852078,"lng":-54.91655588150025},{"lat":-24.121201014107687,"lng":-54.91685628890992}]
9814e962-cd47-45b6-a6c7-c9b15a779b51	8fea32a5-5604-42cd-a3cd-62e126c49fee	peroba	47.60		2026-02-26 13:45:27.996905	[{"lat":-24.12663958387065,"lng":-54.90618109703065},{"lat":-24.12636549421375,"lng":-54.896246194839485},{"lat":-24.124955880988,"lng":-54.897211790084846},{"lat":-24.124427272024114,"lng":-54.897469282150276},{"lat":-24.122117029440894,"lng":-54.89837050437928},{"lat":-24.117692211095868,"lng":-54.89993691444398},{"lat":-24.11847537592851,"lng":-54.900516271591194},{"lat":-24.123428782466775,"lng":-54.90403532981873}]
a11675af-fb6b-48d2-b59b-76c55823ed49	8fea32a5-5604-42cd-a3cd-62e126c49fee	crempa	45.84		2026-02-26 13:46:57.612204	[{"lat":-24.129731479507146,"lng":-54.893767833709724},{"lat":-24.130240489294124,"lng":-54.90857362747193},{"lat":-24.13231566207704,"lng":-54.910075664520264},{"lat":-24.13223735428143,"lng":-54.906985759735115},{"lat":-24.133098737395812,"lng":-54.90702867507935},{"lat":-24.131924122619605,"lng":-54.89256620407105}]
930ad9eb-c5f0-4db3-b288-34e4f4ef71d7	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 01	151.17		2026-02-27 10:59:58.272885	[{"lat":-24.04007720805604,"lng":-54.87645149230958},{"lat":-24.048696212977767,"lng":-54.860873222351074},{"lat":-24.043172280933703,"lng":-54.857268333435066},{"lat":-24.036982060597154,"lng":-54.855637550354004},{"lat":-24.033299129754734,"lng":-54.864263534545906},{"lat":-24.034200282163415,"lng":-54.86460685729981},{"lat":-24.03572830875896,"lng":-54.865036010742195},{"lat":-24.037373855537314,"lng":-54.86490726470948},{"lat":-24.039567885119627,"lng":-54.864263534545906},{"lat":-24.041056669565087,"lng":-54.864349365234375},{"lat":-24.041840233394563,"lng":-54.865593910217285},{"lat":-24.04140927387991,"lng":-54.86688137054444},{"lat":-24.04011638665981,"lng":-54.86846923828126},{"lat":-24.03929363347125,"lng":-54.869542121887214},{"lat":-24.038862665412125,"lng":-54.8703145980835},{"lat":-24.039176096871252,"lng":-54.87121582031251},{"lat":-24.039802957495084,"lng":-54.871859550476074},{"lat":-24.04007720805604,"lng":-54.87293243408204},{"lat":-24.039489527565546,"lng":-54.873490333557136},{"lat":-24.039136917980674,"lng":-54.87447738647461},{"lat":-24.039607063878748,"lng":-54.87585067749024}]
ac934afd-316f-4a4a-98b4-ff0d48b16a54	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 02	104.60		2026-02-27 10:53:53.53087	[{"lat":-24.042993420657524,"lng":-54.85718250274659},{"lat":-24.041289178522003,"lng":-54.85087394714356},{"lat":-24.04083862797112,"lng":-54.85059499740601},{"lat":-24.04040766509574,"lng":-54.85018730163575},{"lat":-24.03995711145268,"lng":-54.849801063537605},{"lat":-24.039937522127985,"lng":-54.849050045013435},{"lat":-24.03997670077436,"lng":-54.848535060882575},{"lat":-24.03946737743941,"lng":-54.84746217727662},{"lat":-24.03590205754931,"lng":-54.8448657989502},{"lat":-24.030769383193743,"lng":-54.845080375671394},{"lat":-24.03362959708551,"lng":-54.856002330780036},{"lat":-24.035216400620104,"lng":-54.85587358474732},{"lat":-24.03725374926185,"lng":-54.85559463500977}]
bb0a768f-0f1c-4fa1-b4e0-3f32d7c4fe37	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 03	145.44		2026-02-27 11:01:56.868363	[{"lat":-24.021268083959704,"lng":-54.85392093658448},{"lat":-24.02436360992625,"lng":-54.85473632812501},{"lat":-24.02926144175758,"lng":-54.85598087310791},{"lat":-24.0334538375306,"lng":-54.85610961914063},{"lat":-24.030828708522662,"lng":-54.84520912170411},{"lat":-24.020915424373115,"lng":-54.84460830688477},{"lat":-24.018015742207393,"lng":-54.853277206420906}]
4d9a8307-27c9-4e4c-aba7-5f2bee76580c	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 04	42.50		2026-02-27 11:03:01.451362	[{"lat":-24.020683861622185,"lng":-54.84538078308106},{"lat":-24.0361608162904,"lng":-54.84499454498291},{"lat":-24.034554434274536,"lng":-54.84375000000001},{"lat":-24.033457381355934,"lng":-54.84319210052491},{"lat":-24.032321138101107,"lng":-54.843020439147956},{"lat":-24.031106522131513,"lng":-54.84267711639405},{"lat":-24.029970258088785,"lng":-54.84224796295167},{"lat":-24.028207069855977,"lng":-54.84173297882081},{"lat":-24.027070780176906,"lng":-54.84164714813233},{"lat":-24.02519000277125,"lng":-54.84211921691895},{"lat":-24.023387565266525,"lng":-54.842333793640144},{"lat":-24.02185939193271,"lng":-54.843320846557624},{"lat":-24.021075706253345,"lng":-54.84417915344239}]
72468719-3e46-40a8-98f7-4906f16a6c69	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 05	47.24		2026-02-27 11:07:57.006529	[{"lat":-24.03333485528867,"lng":-54.86404596080135},{"lat":-24.032355334904718,"lng":-54.863659722703204},{"lat":-24.03123867255871,"lng":-54.86295161952327},{"lat":-24.0305725886441,"lng":-54.8622006009991},{"lat":-24.029397138019522,"lng":-54.861642701524005},{"lat":-24.028417587619366,"lng":-54.86114917506525},{"lat":-24.027888627298804,"lng":-54.860741479295},{"lat":-24.03065095163679,"lng":-54.85606370677303},{"lat":-24.032335744420898,"lng":-54.85604224910091},{"lat":-24.034040105341372,"lng":-54.856128079789386},{"lat":-24.03545059383328,"lng":-54.85599933375667},{"lat":-24.03680229744052,"lng":-54.855677468674884}]
eda1c91e-a156-45b3-b67d-f142497556fd	4748c4d6-5029-4b4c-b14f-09eeb26590ae	Lote 06	55.56		2026-02-27 11:08:48.610516	[{"lat":-24.026045602602956,"lng":-54.87572193145753},{"lat":-24.03182494870546,"lng":-54.86679553985596},{"lat":-24.031433136843823,"lng":-54.866516590118415},{"lat":-24.03090418893555,"lng":-54.866259098052986},{"lat":-24.03053196502822,"lng":-54.86587285995484},{"lat":-24.030355648064234,"lng":-54.86520767211915},{"lat":-24.030336057275505,"lng":-54.86467123031617},{"lat":-24.030100967578008,"lng":-54.864242076873786},{"lat":-24.02943487776632,"lng":-54.863748550415046},{"lat":-24.028984285641847,"lng":-54.86364126205445},{"lat":-24.02179418889776,"lng":-54.87471342086793}]
\.


--
-- Data for Name: farm_price_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_price_history (id, farmer_id, purchase_date, supplier, product_name, quantity, unit_price, active_ingredient, created_at) FROM stdin;
5cef6bbd-d0f1-4d47-936e-0debc709a272	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	GLIFOGROP FUL DMA - 20LTS	2500.00	3.38	Glifosato Sal de DMA	2026-02-26 16:53:20.472233
1440f891-c018-45b6-8992-816fe2f278c5	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	FLUMITOP 48 SC FLUMIOXAZIM 48%	12.00	94.00	Flumioxazin 48%	2026-02-26 16:53:20.489722
42100a87-906f-4bf5-86ae-94e4a70e22c1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	EXTRAZONE- SULFENTRAZONE 50%- 5LT	300.00	20.00	\N	2026-02-26 16:53:20.498997
a8c8aea7-c187-4dbf-8dfe-e02686b9517a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	580.00	7.80	\N	2026-02-26 16:53:20.508543
17a95259-988e-497e-8674-b9ce6ddad2dc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	CENTURION- CLETODIM 24%- 5 LTS.	1400.00	6.50	Cletodim	2026-02-26 16:53:20.519141
bf2b03fc-b9b2-4ee2-8136-87ad20658881	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-09 00:00:00	C.VALE SA	2,4 D 72% - 2,4 D AMINA TM - 20LTS	500.00	2.75	Sal de dimetilamina de (2,4-dichlorophenoxy) acetic acid (2,4-D)..............806,0 g/L (80,6% m/v)	2026-02-26 16:53:20.53676
1e95d99d-afb7-4a90-a468-517f536bf5d5	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	KURIN 48-5LTS	60.00	15.00	\N	2026-02-26 17:59:51.484206
477a44ab-cf6f-46e4-8a85-6390e4b6cea9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-12 00:00:00	C.VALE SA	PARAGROP 24 - 20LTS	500.00	2.20	\N	2026-02-26 17:59:51.484206
9571dba6-efeb-4262-ac8e-5b0407175460	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	580.00	7.80	\N	2026-02-26 17:59:51.484206
55d98143-039b-442c-b1f4-05a541750919	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	GLIFOGROP FUL DMA - 20LTS	2500.00	3.38	Glifosato Sal de DMA	2026-02-26 17:59:51.484206
d35f3952-1031-4465-a0a2-6864c56d0462	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-12-24 00:00:00	C.VALE SA	CONTACT 72 - 20LTS	100.00	5.50	\N	2026-02-26 17:59:51.484206
6cd0ad86-89f3-47a6-9141-89bc7aa9085e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-12-24 00:00:00	C.VALE SA	CONTACT 72 - 20LTS	100.00	5.50	\N	2026-02-26 17:59:51.484206
ab927c20-5db3-4764-a85c-1ef4d8db9d12	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	EXTRAZONE- SULFENTRAZONE 50%-5LT	25.00	18.00	\N	2026-02-26 17:59:51.484206
3d5d7f79-0e57-430c-b8eb-557eed058123	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	AMPLIGO - 1L	120.00	30.00	\N	2026-02-26 17:59:51.484206
80b4fb24-4b36-4da0-92cd-26fa8cff2ccd	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	EXTRAZONE- SULFENTRAZONE 50%- 5LT	300.00	20.00	\N	2026-02-26 17:59:51.484206
a30207b6-727f-40b8-918f-0e38fbfe94ef	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-26 00:00:00	C.VALE SA	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	160.00	7.80	\N	2026-02-26 17:59:51.484206
ed154491-d4e9-4112-854d-f5862c7d335a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-09-26 00:00:00	C.VALE SA	KURIN 48 - 5LTS	15.00	18.80	\N	2026-02-26 17:59:51.484206
5966c784-ea5e-4739-bec3-f3671a355af0	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	FLUMITOP 48 SC FLUMIOXAZIM 48%	12.00	94.00	\N	2026-02-26 17:59:51.484206
41fe1e34-652a-41bc-8abb-c3169dc4e765	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	ONLY 75 WG-1KG	21.00	10.00	\N	2026-02-26 17:59:51.484206
e6afdca3-ce29-418d-8ae1-e417d79366ef	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	DANKE-DIFENO 20%+ TEBUCO 20%-5LTS.	5.00	7.00	DANKE-DIFENO 20%+ TEBUCO 20%	2026-02-26 17:59:51.484206
647603f9-d0aa-459b-9b8c-e7a309589740	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-12-24 00:00:00	C.VALE SA	SPHERE MAX SC - 5LTS	10.00	58.00		2026-02-26 17:59:51.484206
d2bc88be-9619-4ba8-9ed3-e68c4e94c528	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2025-12-24 00:00:00	C.VALE SA	SPHERE MAX SC - 5LTS	10.00	58.00		2026-02-26 17:59:51.484206
faaeb723-e502-4c1a-ad13-4018628be16b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-01-15 00:00:00	C.VALE SA	FERT PHYSALG LITHOFORTE - TIMAC - BB	40.00	0.88	\N	2026-02-26 17:59:51.484206
b1e7d562-596c-4cc1-8295-17dd9807a6c8	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	CENTURION- CLETODIM 24%- 5 LTS.	1400.00	6.50	Cletodim	2026-02-26 17:59:51.484206
742d25ee-2ace-48a3-92fc-70dbff572d89	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	2025-09-09 00:00:00	C.VALE SA	2,4 D 72% - 2,4 D AMINA TM - 20LTS	500.00	2.75	Sal de dimetilamina de (2,4-dichlorophenoxy) acetic acid (2,4-D)..............806,0 g/L (80,6% m/v)	2026-02-26 17:59:51.484206
2bd2c60d-4ff1-4311-a1a0-2afb6fa7d9cb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	PIXXARO-5LTS	5.00	42.00	\N	2026-02-26 17:59:51.484206
07b218d8-c839-4643-a46a-2c34218561cd	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-05 00:00:00	C.VALE SA	DERMACOR-1L	10.00	140.00	Clorantraniliprole	2026-02-26 17:59:51.484206
f9e4e261-8cfb-41ad-af48-8432c678188b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	HUSSAR EVOLUTION EC 96-5 LTS	25.00	15.00	\N	2026-02-26 17:59:51.484206
0a21ff6d-7ccb-4802-8236-1f0947dec886	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-11 00:00:00	C.VALE SA	2,4 D 72% -2,4 D AMINA TM-20LTS	80.00	2.90	Sal de dimetilamina de (2,4-dichlorophenoxy) acetic acid (2,4-D)..............806,0 g/L (80,6% m/v)	2026-02-26 17:59:51.484206
226712f8-aaba-48f4-a44a-50415f37f552	b1f7c63d-e398-42fc-893c-733221086476	2026-02-25 00:00:00	CENTRO DEL AGRO SA	DULIA BIO	4.00	150.00	Timac	2026-02-27 12:39:26.671474
0defd060-5466-4620-8b46-94bf6a1cab65	b1f7c63d-e398-42fc-893c-733221086476	2026-02-25 00:00:00	CENTRO DEL AGRO SA	CONGREGGA PRO	3.00	80.00	Extrato de plantas	2026-02-27 12:39:26.67699
4e8b429d-92bd-49f6-b857-388e82aa1f57	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2026-02-18 00:00:00	TAMPA PARAGUAY S.A.	(38)BIFENTAM 40 MAX_(BIFENTRINA 40%)	1500.00	13.20	\N	2026-02-27 17:30:28.313952
\.


--
-- Data for Name: farm_products_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_products_catalog (id, name, unit, dose_per_ha, category, active_ingredient, created_at, image_url, image_base64, status, is_draft) FROM stdin;
ed485e2e-18e8-4b7e-b787-c0e29d6eb432	CONTACT 72 - 20LTS	LT	\N	\N	\N	2026-02-10 16:30:21.998228	\N	\N	active	f
29e3eff9-f2be-483e-bf85-48620e4cdf92	FLUMITOP 48 SC FLUMIOXAZIM 48%	UNI	\N	\N	\N	2026-02-10 16:51:00.464882	\N	\N	active	f
89030455-82c7-4cba-96a1-8e8543ab3b1f	EXTRAZONE- SULFENTRAZONE 50%- 5LT	UNI	\N	\N	\N	2026-02-10 16:51:00.472839	\N	\N	active	f
57e58101-08e8-4f23-b74c-33060547e5f2	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	LT	\N	\N	\N	2026-02-10 16:51:00.478321	\N	\N	active	f
f456d35b-f0db-47fd-bfc4-d78458b19169	VERDICT ULTRA	LT	0.7500	Herbicidas	Haloxifop 93%	2026-02-24 12:20:16.573098	\N	\N	active	f
bbc3fa23-bb42-4267-94e3-d02ba049e3c8	KURIN 48 - 5LTS	UNI	\N	\N	\N	2026-02-10 18:24:23.505435	\N	\N	active	f
c1419a4c-3388-4946-b941-d0ab4a557e91	ZETAPIR	KG	0.1450	Herbicidas	Imazetapir 10%	2026-02-24 12:20:16.583732	\N	\N	active	f
ecbbde55-7311-4124-9587-588dd1671bf9	2,4 D 72% - 2,4 D AMINA TM - 20LTS	LT	1.5000	herbicida	Sal de dimetilamina de (2,4-dichlorophenoxy) acetic acid (2,4-D)..............806,0 g/L (80,6% m/v)	2026-02-10 16:51:00.490177	https://verdevale.agr.br/wp-content/uploads/2021/03/24-D-nortox-20l.jpg	\N	active	f
898315f5-07b7-482e-9ede-514266193b01	TECNOQUAT 24	LT	3.0000	Herbicidas	Paraquat 24%	2026-02-24 12:20:16.594076	\N	\N	active	f
ec245551-8240-4165-b9c8-fc441671b17c	CENTURION- CLETODIM 24%- 5 LTS.	LT	1.0000	herbicida	Cletodim	2026-02-10 16:51:00.483756	https://images.cws.digital/produtos/gg/57/93/cletodim-1x20-nortox-9569357-1670502605275.jpg	\N	active	f
e07176ba-6431-4768-a5bd-2cdd8e151d80	GLIFOGROP FUL DMA - 20LTS	LT	1.0000	herbicida	Glifosato Sal de DMA	2026-02-10 16:51:00.455476	\N	\N	active	f
cea6052e-f6fa-47c2-ac3d-30ee483ce887	ONLY 75 WG-1KG	UNI	\N	\N	\N	2026-02-12 21:36:46.05923	\N	\N	active	f
6089865b-4aac-433b-a750-c7db5f6e84ca	AMPLIGO - 1L	LT	\N	\N	\N	2026-02-12 21:36:46.063339	\N	\N	active	f
4dec0a65-f945-47a5-b3cf-831f389348b9	PIXXARO-5LTS	UNI	\N	\N	\N	2026-02-12 21:36:46.066692	\N	\N	active	f
8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	HUSSAR EVOLUTION EC 96-5 LTS	UNI	\N	\N	\N	2026-02-12 21:36:46.071705	\N	\N	active	f
2c15dd42-d6a8-41fd-86a7-6050ed111ab1	KURIN 48-5LTS	UNI	\N	\N	\N	2026-02-12 21:36:46.080282	\N	\N	active	f
dfa2a7ef-f2ff-4193-8989-581573145a67	SPHERE MAX SC - 5LTS	LT	0.2000	fungicida		2026-02-10 16:30:22.006998	\N	\N	active	f
ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	PARAGROP 24 - 20LTS	LT	1.0000	herbicida	\N	2026-02-17 12:44:58.214523	\N	\N	active	f
bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	FERT PHYSALG LITHOFORTE - TIMAC - BB	KG	\N	fertilizante	\N	2026-02-16 12:43:41.742374	\N	\N	active	f
d920bc05-6b7f-4e76-9741-8bca2b12d81c	DANKE-DIFENO 20%+ TEBUCO 20%-5LTS.	LT	0.5000	Fungicida	DANKE-DIFENO 20%+ TEBUCO 20%	2026-02-12 21:36:46.075585	\N	\N	active	f
0a8a5127-d7f0-4a39-bd1e-55f18b323ae7	DERMACOR-1L	LT	0.0200	Tratamento de Sementes	Clorantraniliprole	2026-02-24 12:10:58.703393	\N	\N	active	f
7431efcb-ef1d-496d-830c-94bbca5b9c17	DERMACOR	ML	\N	Tratamento de semente	Clorantraniliproli 62,5%	2026-02-24 12:20:16.293203	\N	\N	active	f
c08d5afd-86c3-44a3-bf74-837ce5b5d289	SUNATO	ML	\N	Tratamento de semente	Fipronil 18% + Imidacloprid 36%	2026-02-24 12:20:16.321526	\N	\N	active	f
515472d6-b525-49db-a3e6-826ab8a9dec6	HURACAN 25 FS	ML	\N	Tratamento de semente	Fipronil 25%	2026-02-24 12:20:16.337003	\N	\N	active	f
1333a70e-6056-46fb-8728-0741b14fceeb	CROPSTAR	ML	\N	Tratamento de semente	Imidacloprid + Thiodicarb	2026-02-24 12:20:16.352068	\N	\N	active	f
70151892-6152-48d0-b1c8-77f796d17902	RANCONA	ML	\N	Tratamento de semente	Ipconazole 2,5% + Metalaxil 2%	2026-02-24 12:20:16.358062	\N	\N	active	f
61942bcc-73a9-49f3-9187-d26a0236f4d2	EVERGOL ENERGY	ML	\N	Tratamento de semente	Penflufen 3,84% + Prothioc 7,68% + Metalax. 6,14%	2026-02-24 12:20:16.37366	\N	\N	active	f
76aaed94-e5fb-4892-a44a-55b9e2ecc1b6	MAXIN RFC	ML	\N	Tratamento de semente	Fludioxinil 2,5% + Metalaxil 3,75%	2026-02-24 12:20:16.40061	\N	\N	active	f
cf6d3298-d3bb-460b-8aae-49bad66532ab	RIZOLIQ TOP	ML	\N	Tratamento de semente	Bradirizobium 2x10^10	2026-02-24 12:20:16.410071	\N	\N	active	f
e0968ebc-1c34-4c09-aeda-e6ac52e8a3b2	RIZOSPIRILUM	ML	\N	Tratamento de semente	Rizospirillum 1x10^9	2026-02-24 12:20:16.428803	\N	\N	active	f
70b5c3ca-5007-4924-bb61-ad19e312040e	RIZODERMA MAX	ML	\N	Tratamento de semente	Tricoderma 1X10^9	2026-02-24 12:20:16.436877	\N	\N	active	f
85561907-216a-4035-8db3-82faf314ec88	VITAGROW TS	ML	\N	Tratamento de semente	Bioestimulante	2026-02-24 12:20:16.44507	\N	\N	active	f
e38fb62b-80f8-4e46-8711-8bc65ff20d80	2,4 D AMINA	LT	1.5000	Herbicidas	2,4D Dimetilamina 72%	2026-02-24 12:20:16.453145	\N	\N	active	f
2ddd482a-2691-4cd8-8f5e-fb7d343cf666	CLETODIN 24%	LT	0.7500	Herbicidas	Cletodim 24%	2026-02-24 12:20:16.460625	\N	\N	active	f
12e2ebaa-538d-49dd-bfda-5655d684a894	VIRTUE 50%	LT	1.6500	Herbicidas	Clomazone 50%	2026-02-24 12:20:16.468556	\N	\N	active	f
a6841bed-ab6b-4eb2-b24c-9913a428102b	TRIBO 84%	KG	41.7000	Herbicidas	Diclosulan 84%	2026-02-24 12:20:16.478146	\N	\N	active	f
a6aa7621-3b47-4fc7-8248-57ee8285e619	FOMEFLAG 25%	LT	1.0000	Herbicidas	Fomesafen 25%	2026-02-24 12:20:16.492102	\N	\N	active	f
251c1ac5-8cec-4654-81f2-a0675563799d	FLUMIOXAZIN 48%	LT	0.1000	Herbicidas	Flumioxazin 48%	2026-02-24 12:20:16.499382	\N	\N	active	f
0cd35809-a1e3-49c0-94ac-7965c66609ef	GLIFOSATO 60,8%	LT	3.0000	Herbicidas	Glifosato 60,8% Sal DMA	2026-02-24 12:20:16.509089	\N	\N	active	f
ecdffe13-d7e4-4dea-9d80-19227e039b88	TECNUP PREMIUM 2	LT	3.0000	Herbicidas	Glifosato 60,8% Sal DMA	2026-02-24 12:20:16.515634	\N	\N	active	f
43d13cef-64d3-4ed0-979a-6fe18548f39e	TECNUP XTRA	KG	2.5000	Herbicidas	Glifosato 75,6% WG	2026-02-24 12:20:16.529044	\N	\N	active	f
765709b1-827e-42cb-8257-442666f29e2e	GLUFOSINATO 40	LT	2.5000	Herbicidas	Glufosinato De Amonio 40%	2026-02-24 12:20:16.543248	\N	\N	active	f
adb46561-8556-4c0e-af53-c7dbd00bf82c	TEXARO	KG	0.0430	Herbicidas	Halauxifeno 11,5% + Diclosulan 58%	2026-02-24 12:20:16.552045	\N	\N	active	f
f9498acc-d2ff-4271-8ad5-3a80465ff0f1	PIXXARO	LT	0.3000	Herbicidas	Halauxifeno 1,2% + Fluroxipir 28%	2026-02-24 12:20:16.558282	\N	\N	active	f
071b7ac5-22eb-40d0-a34a-448e12297c3c	PARAQUAT 24%	LT	3.0000	Herbicidas	Paraquat 24%	2026-02-24 12:20:16.602136	\N	\N	active	f
6a092934-e40c-448a-8cf9-2325153a21ff	STRIM	LT	1.0000	Herbicidas	S-Metalachlor 96%	2026-02-24 12:20:16.617433	\N	\N	active	f
d79a9eef-542b-4af1-a010-5ed4eb481103	SAFLUFENACIL 70	KG	0.0750	Herbicidas	Saflufenacil 70%	2026-02-24 12:20:16.635854	\N	\N	active	f
a7965601-ea1d-44f5-a43b-f80ce9ccc44a	HEAT	KG	0.0750	Herbicidas	Saflufenacil 70%	2026-02-24 12:20:16.643372	\N	\N	active	f
bae7834a-0934-4235-b98e-9ebe163b7e65	SUNZONE XTRA	KG	0.4000	Herbicidas	Sulfentrazone 75%	2026-02-24 12:20:16.654437	\N	\N	active	f
d8ea8816-8e9c-4dce-a60d-6a70c64f12ff	TORAC	LT	0.6000	Herbicidas	Sulfentrazone 50%	2026-02-24 12:20:16.668853	\N	\N	active	f
4f7c2057-b20e-49d7-a9be-d49cd3d0037c	TRICLON	LT	1.5000	Herbicidas	Triclopir 66,74%	2026-02-24 12:20:16.675315	\N	\N	active	f
67a75e97-3b5e-42ee-8457-24bb200e9732	LASCAR	KG	0.9000	Inseticidas	Acefato 97%	2026-02-24 12:20:16.680038	\N	\N	active	f
1b811f60-6c57-4dbb-a6dc-8d2fd7300d88	BENZOATO NORTOX	KG	0.0800	Inseticidas	Benzoato 10%	2026-02-24 12:20:16.693899	\N	\N	active	f
77576741-6df5-434e-aa03-c2f446aaaed3	BULLDOCK	LT	0.0600	Inseticidas	Betaciflutrina 12,5%	2026-02-24 12:20:16.702279	\N	\N	active	f
f8e059b0-66b7-44ee-a67d-ec0c5e194826	TOXATRIM	LT	0.4000	Inseticidas	Bifentrin 20% + Tiametoxan 30%	2026-02-24 12:20:16.727478	\N	\N	active	f
1086ad91-9dfb-4825-87cf-79392d8f00d4	LOYER	LT	0.3500	Inseticidas	Lambda 20% + Dinotefuran 20%	2026-02-24 12:20:16.738905	\N	\N	active	f
ede4dcbc-93af-47a1-ae14-0d1805b19d6d	FENTHRIN 40	LT	0.1200	Inseticidas	Bifentrin 40%	2026-02-24 12:20:16.746286	\N	\N	active	f
c014e58d-d81d-4709-a9f8-c1d2524571f5	AMPLIGO	LT	0.2000	Inseticidas	Clorantra. 10% + Lambda. 5%	2026-02-24 12:20:16.761721	\N	\N	active	f
9c306dac-d51a-4861-b915-de3d60e6d96f	CAYENNE	LT	0.1200	Inseticidas	Imidacloprid 60%	2026-02-24 12:20:16.780599	\N	\N	active	f
14469012-e3fd-4d1d-aac7-54c6538d1e05	POINT 5	LT	0.3500	Inseticidas	Lufenuron 5%	2026-02-24 12:20:16.792363	\N	\N	active	f
faffa473-5b32-443f-b2b7-1ebc978a94ef	EXALT	LT	0.1000	Inseticidas	Spinetoran 12%	2026-02-24 12:20:16.803394	\N	\N	active	f
facfa9ba-a34a-4a35-8734-518cbf6299c6	SOYGUARD	LT	0.0300	Inseticidas	Teflubenzuron 30%	2026-02-24 12:20:16.815623	\N	\N	active	f
56e7d938-94dc-4bcb-915b-126bc90b2ac7	ONLY 60	LT	0.1250	Inseticidas	Tiametoxan 60%	2026-02-24 12:20:16.831584	\N	\N	active	f
c198fd71-b5ae-40ee-9fc5-448794b68d9b	ONLY 75	KG	0.1250	Inseticidas	Tiametoxan 75%	2026-02-24 12:20:16.849269	\N	\N	active	f
a96c68f8-1598-4ed6-9b4f-78ddd49e59eb	VESSARYA	LT	0.6000	Fungicidas	Benzovindiflupir 5% + Picoxistrobin 10%	2026-02-24 12:20:16.870934	\N	\N	active	f
b5953e44-1550-4e5a-915b-557721de40cc	MACONZEB 75%	KG	1.5000	Fungicidas	Mancozeb 75%	2026-02-24 12:20:16.890199	\N	\N	active	f
c9756b4c-c00d-4204-97a5-e819a5d2cd94	APROACH PRIMA	LT	0.6000	Fungicidas	Picoxistrobin 20% + Ciproconazole 8%	2026-02-24 12:20:16.90094	\N	\N	active	f
7a0e93b3-b948-45a0-915a-f77f1a80d056	TEBUCO 43 CHDS	LT	0.4000	Fungicidas	Tebuconazole 43%	2026-02-24 12:20:16.914581	\N	\N	active	f
4d6b7c8e-93f7-4181-8225-3277bad6e844	NATIVO	LT	0.5000	Fungicidas	Trifloxistrobin 10% + Tebuconazole 20%	2026-02-24 12:20:16.931475	\N	\N	active	f
68a1874f-651b-450a-9ebc-e02cfc5e0ff5	BALUART	LT	0.4000	Fungicidas	Trifloxistrobin 15% + Prothio. 17,5%	2026-02-24 12:20:16.945739	\N	\N	active	f
31dd6fa9-3a97-4295-a377-d5e4556700e4	RIZOIL M	LT	0.3000	Especialidades	Aceite Metilado De Soja	2026-02-24 12:20:16.956663	\N	\N	active	f
79cdff67-a34f-4629-8246-de9ab7e74d32	RASS 32	LT	\N	Especialidades	Limpa Tanque	2026-02-24 12:20:16.973542	\N	\N	active	f
41fdd002-53c0-40ff-b97c-53c5984a924c	VALEMAX	LT	0.0400	Especialidades	Adjuvante	2026-02-24 12:20:16.999984	\N	\N	active	f
a259731d-0147-4088-a5dd-8a162d4b47fd	U10 - INQUIMA	LT	0.0400	Especialidades	Adjuvante Redutor de PH	2026-02-24 12:20:17.027708	\N	\N	active	f
18d74081-771c-4269-9f58-10c36695da56	YARA VITTA FOLICARE	KG	3.5000	Fertilizantes	N 12% + K 39% + Mg 1,8% + S 2,8%	2026-02-24 12:20:17.060893	\N	\N	active	f
cff4b00a-b8b5-4c05-9042-67f1f256446d	YARA VITTA GLYTREL	LT	1.0000	Fertilizantes	P 6,6% + Mn 6,6%	2026-02-24 12:20:17.081189	\N	\N	active	f
70211750-9cd3-4b50-aeb0-5e370783c55f	ACRESCENT RAIZ F	ML	\N	Fertilizantes	Extrato de plantas	2026-02-24 12:20:17.103926	\N	\N	active	f
1c77c869-271f-4f42-be88-10413528fb9a	FERTILEADER VITAL 954	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.117333	\N	\N	active	f
5f4cdb54-c57d-48cd-bdbb-435c219f75ac	FERTIACTYL GZ	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.144791	\N	\N	active	f
f90f1c7a-33e8-4ca7-ae20-b733790a3d30	FERTIACTYL LEGUMINOSAS	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.167452	\N	\N	active	f
f158b147-fbc7-41a0-a5fb-04e6cb85af43	FERTACTYL SWEET	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.190544	\N	\N	active	f
573e9197-3c53-4844-b567-5d702fe6a17a	CLORANTE WG	KG	0.0300	Inseticidas	Clorantraniliproli 80%	2026-02-24 12:20:16.752381	\N	\N	active	f
0e8a322c-3159-40b5-9873-a266273cc34d	BELT	LT	0.0700	Inseticidas	Flubendiamida 48%	2026-02-24 12:20:16.770721	\N	\N	active	f
436fb711-a0cb-4e5d-a1d9-270dfbc1df2f	CORAZA	LT	0.1200	Inseticidas	Lambdacialotrina 25%	2026-02-24 12:20:16.784816	\N	\N	active	f
a485d6f3-a121-4128-8e58-823a35e3f476	INTREPID	LT	0.4500	Inseticidas	Metoxifenocide 24%	2026-02-24 12:20:16.799472	\N	\N	active	f
ff527250-6d0e-461d-806d-26e87d88f49a	QUINTAL XTRA	LT	0.2000	Inseticidas	Spinetoran 6 % + Metoxifenocide 30 %	2026-02-24 12:20:16.809152	\N	\N	active	f
82fb4135-528e-46aa-ba07-c26d42b0253f	THIODICARB 80 WP	KG	0.3000	Inseticidas	Thiodicarb 80%	2026-02-24 12:20:16.821128	\N	\N	active	f
afb11e32-a075-4b25-b1de-99e923cd7cac	THIAMEXPLANT	KG	0.1250	Inseticidas	Tiametoxan 75%	2026-02-24 12:20:16.843503	\N	\N	active	f
c6f1620c-8108-4bfa-897d-1ed4a844bdf4	ALSYSTIN	LT	0.0800	Inseticidas	Triflumuron 48%	2026-02-24 12:20:16.858663	\N	\N	active	f
f7971b8e-5b60-489d-bc03-594e8fde1389	CLOROTALONIL 72%	LT	1.0000	Fungicidas	Clorotalonil 72%	2026-02-24 12:20:16.877215	\N	\N	active	f
171cda08-cd32-4196-864a-f2539a172345	VIOVAN	LT	0.6000	Fungicidas	Picoxistrobin 10% + Prothioconazole 11,67%	2026-02-24 12:20:16.895115	\N	\N	active	f
0b6aa457-e462-4b6b-a86f-b6bd95b4abf0	DENALI	LT	0.5000	Fungicidas	Tebuco. 20% + Difeno. 20%	2026-02-24 12:20:16.908926	\N	\N	active	f
8ae57ce8-50dc-433d-b58f-2cc85f339eaf	CRIPTON XPRO SC	LT	0.5000	Fungicidas	TrifloxiS. 15% + Prothio. 17,5% + Bixafen 12,5%	2026-02-24 12:20:16.926748	\N	\N	active	f
082a7619-3dcf-4ec8-bc51-05f616c4d5ea	CRIPTON SC	LT	0.4000	Fungicidas	Trifloxistrobin 15% + Prothio. 17,5%	2026-02-24 12:20:16.938088	\N	\N	active	f
1a453fa6-2e6a-41a8-87a1-3389484c5fb9	SPHERE MAX SC	LT	0.2000	Fungicidas	Trifloxistrobina 37,5% + Ciproconazol 16%	2026-02-24 12:20:16.950545	\N	\N	active	f
93b60a49-755b-46b9-9fe9-fcd9297316a8	DIOIL	LT	0.5000	Especialidades	Aceite Vegetal	2026-02-24 12:20:16.964775	\N	\N	active	f
bb5eab3b-f50e-4b0a-bd0a-814a24cf749c	RIZOSPRAY XTREMO	LT	0.1500	Especialidades	Adjuvante + Aceite	2026-02-24 12:20:16.98203	\N	\N	active	f
f519a545-c420-4961-a881-c0cc250a921d	TA35 + ZINC	LT	0.0400	Especialidades	Adjuvante	2026-02-24 12:20:17.016987	\N	\N	active	f
ae664a64-ae6a-4d2d-bd6b-c7786e24c810	VITA GROW FOLIAR	LT	0.2000	Especialidades	Bioestimulante Foliar	2026-02-24 12:20:17.037219	\N	\N	active	f
2897d445-fe1a-43c9-b769-cc7cdd750e0c	YARA VITTA THIOTRAC	LT	0.5000	Fertilizantes	N 11,2% + S 25,7%	2026-02-24 12:20:17.072367	\N	\N	active	f
e1bdce07-5348-4d90-9b61-a1d2fb887582	YARA VITTA BORTRAC	LT	0.5000	Fertilizantes	B 10,95 + N 4%	2026-02-24 12:20:17.095631	\N	\N	active	f
feecd583-5148-480a-a982-3dbbe2fcb49b	ACRESCENT SOLLUS F	LT	2.0000	Fertilizantes	Extrato de Plantas	2026-02-24 12:20:17.110396	\N	\N	active	f
4100af26-345e-4f92-bf7c-247c2e9efe39	FERTILEADER GOLD BMO	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.131487	\N	\N	active	f
7e63a03d-face-451a-9055-8405152b1a1f	EUROFIT MAX	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.155112	\N	\N	active	f
2172f627-7a9f-47ca-a53f-6ee1cb399cdf	FERTILEADER AXIS NG	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.181789	\N	\N	active	f
9cf59530-d847-4021-807b-356db8d645a5	PROGEN DETOX	LT	\N	Fertilizantes	Timac	2026-02-24 12:20:17.197486	\N	\N	active	f
d778065d-8c3b-43af-966e-6fa01dc8b115	SPHERE MAX	LT	\N	Fungicida	Trifloxystrobin, ciproconazole	2026-02-24 23:44:50.304581	\N	\N	pending_review	t
0239905c-211e-412b-832e-00332a0339f0	2.4 D 72%-2.4 D AMINA TM-20LTS	LT	\N	\N	\N	2026-02-25 01:53:35.976387	\N	\N	pending_review	t
c13796cf-e516-4875-a36d-f5da16309710	PARAGROP 24	LT	\N	Herbicida	PARAQUAT	2026-02-25 12:21:40.734346	\N	\N	pending_review	t
aecbd53f-04bc-46f1-a499-a94f70fb2416	WETTER	LT	\N	Fungicida	Picoxystrobin metil, Tebuconazole, Mancozeb	2026-02-25 12:26:01.07141	\N	\N	pending_review	t
cf05a461-ab9a-4496-9c75-b327c47d6b33	GROW	LT	\N	Outro	EXTRACTO Y VEGETALES, LEVEDURA, FOSFATO DE CLORURO MONOAMÓNICO, CÁLCICO, SULFATO MAGNÉSICO, SULFATO POTÁSSICO, SULFATO FERROSO	2026-02-25 12:27:20.823579	\N	\N	pending_review	t
1d039e2b-70f4-40d0-b5de-b7e29740c263	GROW B SUBTILIS	LT	\N	Outro	Bacillus subtilis	2026-02-25 12:28:18.789998	\N	\N	pending_review	t
7a173b36-ffcd-4c90-95b7-51059064b00a	EXTERMINE 350	LT	\N	Inseticida	Dinotefuran, Bifentrin	2026-02-25 12:31:23.335249	\N	\N	pending_review	t
ffeffd8a-23b4-4cdc-930c-05b856f56583	EKOS 800 WDG	KG	\N	Inseticida	FIPRONIL	2026-02-25 12:33:19.276818	\N	\N	pending_review	t
1f9a6867-2603-4596-b833-9bd545a8bba0	KAMSA	KG	\N	Inseticida	Acefato	2026-02-25 12:40:15.353035	\N	\N	pending_review	t
381a9173-b1af-4df3-b23d-e3c3e15bec3a	KAC PHYTACTYL	KG	\N	Fertilizante	Não visível	2026-02-25 12:42:08.059055	\N	\N	pending_review	t
d039c5ea-4c04-472d-a27d-2783079a643b	ROUNDUP CONTROL MAX	KG	\N	Herbicida	glifosato	2026-02-25 12:53:19.241005	\N	\N	pending_review	t
4e501acf-6316-4d5c-910f-9be1b4a8f71e	ONLY TWG - IRG	UNI	\N	\N	\N	2026-02-25 14:42:39.115433	\N	\N	pending_review	t
04d0d474-d2b1-4d63-95ed-599545d37ae9	PIXCARO SLTS	UNI	\N	\N	\N	2026-02-25 14:42:39.136004	\N	\N	pending_review	t
3a724ccf-a30d-49b3-9041-06d2ef267b21	2.4 D 72% - 2.4 D AMINA TM - ZOLTB	LT	\N	\N	\N	2026-02-25 14:42:39.144166	\N	\N	pending_review	t
4caec40d-4c2b-4b81-bc11-379a78fbb506	KAR EVOLUTION EC W SLTS	UNI	\N	\N	\N	2026-02-25 14:42:39.154856	\N	\N	pending_review	t
b3b3c8e2-94f3-4b43-a7f3-4f77a954901b	EXTRAZONE - DIAFENTRAZONE 10% - GLT	UNI	\N	\N	\N	2026-02-25 14:42:39.165412	\N	\N	pending_review	t
45128a4f-f510-49c4-a942-0284c6238a5b	CANIKG - GFENG 20% TERUCO 10% - GLTS	UNA	\N	\N	\N	2026-02-25 14:42:39.177074	\N	\N	pending_review	t
d8c3611f-5e3d-4440-b70a-da9af6140d33	DANKE - DIFENO 20% + TEBUCO 20% - 5LTS.	UNI	\N	\N	\N	2026-02-25 15:39:01.926779	\N	\N	pending_review	t
10d6d587-b82d-4286-969d-cc4fb152c76d	KURIN 48- 5LTS	UNI	\N	\N	\N	2026-02-25 16:25:51.997746	\N	\N	pending_review	t
e6784bfd-5ed4-4689-a4bc-102d4469feaa	FERTIACTYL GZ	LT	\N	Outro	\N	2026-02-25 12:23:42.142611	\N	\N	pending_review	t
6eba85b4-497c-4825-8811-2a0a16484685	POLARIS MAX	LT	\N	Herbicida	GLIFOSATO SAL DIMETILAMINA	2026-02-27 12:06:13.391878	\N	\N	pending_review	t
63cc7164-4810-4665-bcdd-2c4892b9af20	MAGIC-OIL	LT	\N	Adjuvante	Aceite de Soja	2026-02-27 12:07:18.236727	\N	\N	pending_review	t
a4c4d632-f313-462f-946b-622e34ef428f	CLETOGROP	LT	\N	Herbicida	CLETODIM	2026-02-27 12:08:44.446229	\N	\N	pending_review	t
4edc8757-46d9-4741-b5a1-de15155aa53e	EXTRAZONE	LT	\N	Herbicida	Sulfentrazona	2026-02-27 12:10:01.252956	\N	\N	pending_review	t
e5a8a6d9-95a5-4634-9aca-75a3dfba27b8	DICAMBA DGA	LT	\N	Herbicida	Dicamba sal de diglicolamina	2026-02-27 12:10:44.760329	\N	\N	pending_review	t
a721f196-e022-4eff-a19c-017f7a7a829a	EUROFIT	LT	\N	Adjuvante	Não visível	2026-02-27 12:11:18.35523	\N	\N	pending_review	t
6e328e88-4317-43e2-b2f7-83626880b293	DESSE-KE	LT	\N	Herbicida	Paraquat: Dicloruro de 1,1'-dimetil-4,4'-bipiridilo	2026-02-27 12:12:22.247726	\N	\N	pending_review	t
8f7254b4-f601-42ea-9011-72e8a29f697e	SOLUB PHOS	LT	\N	Fertilizante	Não visível	2026-02-27 12:18:39.831194	\N	\N	pending_review	t
8d63f428-d0fc-4868-b7fd-66a29f45924f	INVICTO	LT	\N	Adjuvante	Zinc (Zn)	2026-02-27 12:20:01.931638	\N	\N	pending_review	t
1f5c6651-6fb0-4447-ab4c-0e8abb303433	HERBO SPRAY	LT	\N	Fertilizante	Nitrógeno, Fósforo	2026-02-27 12:21:14.297863	\N	\N	pending_review	t
049f62ac-16df-45e6-8dfe-ae744d98890d	FULMINANTE 25 FS	LT	\N	Inseticida	FIPRONIL	2026-02-27 12:23:55.039213	\N	\N	pending_review	t
d83cda7d-b89d-431f-b442-084f36413d55	TOXATRIN 50 SC	LT	\N	Inseticida	Tiametoxam + Bifentrina	2026-02-27 12:24:22.258515	\N	\N	pending_review	t
360cbca6-f7ae-4fec-9635-6dcaaa2da8c7	AGRO PLUS	KG	\N	Inseticida	Lufenuron + Emamectina Benzoato	2026-02-27 12:28:30.873764	\N	\N	pending_review	t
c9bf7c8f-b8d4-4fe5-aa2e-8a16e3cc7499	DULIA BIO	LT	0.1000	Nematicida	\N	2026-02-27 12:38:06.578069	\N	\N	active	f
0ad2e78d-8a19-401f-ae73-f402531d6f3d	LASCAR 97 DF	KG	\N	Inseticida	Acefato: O,S-dimetil acetil fosforoamidotioato	2026-02-27 12:25:03.472727	\N	\N	pending_review	t
e6abb404-91b7-4390-8e05-0f45dd3a73ae	ACADIAN	LT	\N	Fertilizante	Ascophyllum nodosum	2026-02-27 12:25:57.781036	\N	\N	pending_review	t
752f12d2-b1a0-435e-aa4f-2098827bb3b9	SNIPER	LT	\N	Inseticida	Bifentrina	2026-02-27 12:30:28.007402	\N	\N	pending_review	t
08235698-be2e-4727-9da0-5d9f5f86b47d	CONGREGGA PRO	KG	0.0750	Foliar	\N	2026-02-27 12:38:06.58018	\N	\N	active	f
83df66a7-74e0-4fd6-b9f2-886e975a4216	PRECENTOR	LT	\N	Inseticida	TEFLUBENZURON	2026-02-27 12:27:17.121908	\N	\N	pending_review	t
8bd31edd-5fdd-4b86-af09-81f0fdea11f4	POXXARO-SLTS	UNI	\N	\N	\N	2026-02-27 13:14:20.810798	\N	\N	pending_review	t
0e401efd-92c5-4c50-8e2a-bd0d833b2b28	KURIN 45-5LTS	UNI	\N	\N	\N	2026-02-27 13:14:20.824384	\N	\N	pending_review	t
c94e57d4-8a9b-4afd-a43b-e6a378bae500	(38)BIFENTAM 40 MAX_(BIFENTRINA 40%)	LT	\N	\N	\N	2026-02-27 17:29:35.24804	\N	\N	pending_review	t
\.


--
-- Data for Name: farm_properties; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_properties (id, farmer_id, name, location, total_area_ha, created_at) FROM stdin;
cad25d1a-ebb5-44aa-b087-74363f1379c8	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	Fazenda Modelo		500.00	2026-02-13 02:10:50.795344
33e03ff4-2d68-4bbd-90fd-81823b5eb882	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Fazenda Sede		210.00	2026-02-11 00:29:18.754943
875e5a05-d3f1-485a-99de-65f125cc0912	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Talhao 01		100.00	2026-02-21 02:23:00.746873
8fea32a5-5604-42cd-a3cd-62e126c49fee	b1f7c63d-e398-42fc-893c-733221086476	Fazenda Miotto	Corpus	340.00	2026-02-26 13:38:38.868366
4748c4d6-5029-4b4c-b14f-09eeb26590ae	04e14650-3676-4272-986f-16f3a64b954d	Fazenda São Francisco		700.00	2026-02-27 10:50:47.819917
\.


--
-- Data for Name: farm_seasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_seasons (id, farmer_id, name, start_date, end_date, is_active, created_at) FROM stdin;
57362904-6c1d-452f-b2e7-1e9803f09d48	53d9be2f-7343-4c53-89ee-b6e886daf5fb	Soja 26/27	2026-01-01 00:00:00	2026-12-31 00:00:00	t	2026-02-11 21:24:53.98014
0bc7dafb-b624-424d-811a-2090c791ce32	b1f7c63d-e398-42fc-893c-733221086476	Soja 26/27	2026-01-01 00:00:00	2027-01-31 00:00:00	t	2026-02-26 13:49:11.110838
a51c401d-aaee-4e66-9cad-b7379e3f85f1	b1f7c63d-e398-42fc-893c-733221086476	Milho Safrina 26	2026-01-01 00:00:00	2026-08-31 00:00:00	t	2026-02-26 13:50:14.773443
c96398b0-e500-4e24-b7b4-7aabacbf2327	b1f7c63d-e398-42fc-893c-733221086476	Soja Safrinha 26	2026-01-01 00:00:00	2026-06-30 00:00:00	t	2026-02-26 13:52:25.238056
\.


--
-- Data for Name: farm_stock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_stock (id, farmer_id, product_id, quantity, average_cost, updated_at) FROM stdin;
960f2a5b-ff48-49e9-a45b-1f4a6f4941af	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2c15dd42-d6a8-41fd-86a7-6050ed111ab1	50.0000	15.0000	2026-02-26 01:04:46.922
50adc424-ac05-4720-b2f2-97b8fc46005a	b1f7c63d-e398-42fc-893c-733221086476	4edc8757-46d9-4741-b5a1-de15155aa53e	10.0000	25.0000	2026-02-27 12:10:01.259525
0887486e-6f20-46d2-b193-dfbd0f4b28bc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	8599.0000	3.3800	2026-02-26 16:53:20.55
85842ecf-966c-41a7-8bb5-1ff0faa2d7a0	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	e07176ba-6431-4768-a5bd-2cdd8e151d80	2500.0000	3.3800	2026-02-13 01:15:08.689751
e46f578e-d9e5-4a2b-af01-70d3c4df431e	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	29e3eff9-f2be-483e-bf85-48620e4cdf92	12.0000	94.0000	2026-02-13 01:15:08.724464
3bb1bf0d-1bbb-4073-a4fa-bf343052ee3f	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	89030455-82c7-4cba-96a1-8e8543ab3b1f	300.0000	20.0000	2026-02-13 01:15:08.751953
f45345f2-5a6e-423a-b7ca-72c91145e1aa	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	57e58101-08e8-4f23-b74c-33060547e5f2	580.0000	7.8000	2026-02-13 01:15:08.76193
e9ac65a1-7f25-47cb-ad9b-1fd83701fb64	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	ec245551-8240-4165-b9c8-fc441671b17c	1400.0000	6.5000	2026-02-13 01:15:08.768721
3031603c-eff9-4a5f-9c0a-a8558bff1b14	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	ecbbde55-7311-4124-9587-588dd1671bf9	500.0000	2.7500	2026-02-13 01:15:08.780572
1e4a54d5-c7e3-46b6-a1af-60e957c154ee	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	10.0000	0.8800	2026-02-21 01:56:03.129
10ac2024-1f2d-4e18-a6ef-ae86d6429bfb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	dfa2a7ef-f2ff-4193-8989-581573145a67	2.0000	96.6667	2026-02-13 02:56:19.923
3ee48289-84b3-4278-a321-dcba3a3b35d6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	300.0000	2.2000	2026-02-24 13:41:14.359
f7fdad61-36bf-4b9c-88fe-50e109f7921d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	2.0000	9.5192	2026-02-21 16:54:06.722
58a41680-43d5-43ac-8513-752c374632da	04e14650-3676-4272-986f-16f3a64b954d	c13796cf-e516-4875-a36d-f5da16309710	360.0000	2.0000	2026-02-25 12:21:40.741961
a96da3c3-f250-4169-8798-703974f4346e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	24.0000	15.0000	2026-02-13 17:28:53.908
46048f61-06cb-4053-b85c-703ece2112a3	04e14650-3676-4272-986f-16f3a64b954d	5f4cdb54-c57d-48cd-bdbb-435c219f75ac	40.0000	28.0000	2026-02-25 12:24:52.518924
2d97abeb-33b0-4413-b548-59e562e5e08c	04e14650-3676-4272-986f-16f3a64b954d	aecbd53f-04bc-46f1-a499-a94f70fb2416	40.0000	22.0000	2026-02-25 12:26:01.081243
7f8f3667-cd44-42a8-815c-36fe6e45db77	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	0.0000	7.0000	2026-02-23 18:03:34.793
7dcf03f0-256a-48b2-84a1-0b7818e2bbe7	53d9be2f-7343-4c53-89ee-b6e886daf5fb	cea6052e-f6fa-47c2-ac3d-30ee483ce887	21.0000	10.0000	2026-02-12 21:38:06.631106
d37f81e0-1f47-43a7-87d1-e6b4fb17bfa6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	4dec0a65-f945-47a5-b3cf-831f389348b9	5.0000	42.0000	2026-02-12 21:38:06.649541
845a1bbc-59f9-4c94-a306-9be09c75cbee	04e14650-3676-4272-986f-16f3a64b954d	cf05a461-ab9a-4496-9c75-b327c47d6b33	40.0000	5.0000	2026-02-25 12:27:20.83176
501d7358-fcb5-4422-91f4-85c31e05619b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	1124.0000	19.9592	2026-02-27 17:33:38.303
bdf65614-7746-484e-940f-bbb4324d8d7f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	0a8a5127-d7f0-4a39-bd1e-55f18b323ae7	10.0000	140.0000	2026-02-24 12:17:32.750004
43db0add-f4b5-4515-996c-77fb5c44a801	04e14650-3676-4272-986f-16f3a64b954d	e6784bfd-5ed4-4689-a4bc-102d4469feaa	110.0000	28.0000	2026-02-27 11:09:05.612
9b0f81bc-b53b-4149-92f9-bbb90c69cba9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bbc3fa23-bb42-4267-94e3-d02ba049e3c8	30.0000	18.8000	2026-02-24 12:53:25.578
86ac9a83-42a1-43e7-87e9-e5065ab384f8	53d9be2f-7343-4c53-89ee-b6e886daf5fb	29e3eff9-f2be-483e-bf85-48620e4cdf92	23.0000	94.0000	2026-02-15 02:13:54.051
9d25d2ac-beec-41f9-a2f5-c18f371c5958	53d9be2f-7343-4c53-89ee-b6e886daf5fb	251c1ac5-8cec-4654-81f2-a0675563799d	24.0000	94.0000	2026-02-26 16:53:20.571
254d1563-c84d-4c34-b556-090cc959d17b	04e14650-3676-4272-986f-16f3a64b954d	1d039e2b-70f4-40d0-b5de-b7e29740c263	80.0000	10.0000	2026-02-25 12:28:18.794886
e75c4efc-b5eb-49cc-843d-f7bed7d5a49e	04e14650-3676-4272-986f-16f3a64b954d	7a173b36-ffcd-4c90-95b7-51059064b00a	30.0000	15.0000	2026-02-25 12:31:23.342538
97bca2f5-c8d9-4fd3-9ee9-53497bc4d9e8	04e14650-3676-4272-986f-16f3a64b954d	ffeffd8a-23b4-4cdc-930c-05b856f56583	6.0000	80.0000	2026-02-25 12:33:19.285985
d65881d3-e2f8-4141-b5b2-928d4b0c9e19	04e14650-3676-4272-986f-16f3a64b954d	171cda08-cd32-4196-864a-f2539a172345	260.0000	34.0000	2026-02-25 12:37:19.283598
8689966a-af6a-4e1b-ba0f-c518081c6579	04e14650-3676-4272-986f-16f3a64b954d	1f9a6867-2603-4596-b833-9bd545a8bba0	5.0000	9.0000	2026-02-25 12:40:15.368689
2a079c08-45a1-45bd-9f54-855a1675752f	04e14650-3676-4272-986f-16f3a64b954d	381a9173-b1af-4df3-b23d-e3c3e15bec3a	475.0000	5.5000	2026-02-25 12:42:08.065688
61c8fb92-2d44-43f8-b9e7-d18b1fd4fef2	04e14650-3676-4272-986f-16f3a64b954d	7e63a03d-face-451a-9055-8405152b1a1f	30.0000	29.0000	2026-02-25 12:44:10.661334
a7e560d0-13df-43c6-b30f-7c601f3d1f2d	04e14650-3676-4272-986f-16f3a64b954d	d039c5ea-4c04-472d-a27d-2783079a643b	1380.0000	6.5000	2026-02-25 12:53:19.249137
1ca86cfe-6399-4b29-830b-c566dcfd8693	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	-10.0000	30.0000	2026-02-25 17:51:00.938
65d85c78-0df2-4522-861d-6dd996d04d71	b1f7c63d-e398-42fc-893c-733221086476	c13796cf-e516-4875-a36d-f5da16309710	300.0000	2.1000	2026-02-27 12:04:55.358745
d405822f-71b7-4751-9b82-7b97d250a8e2	b1f7c63d-e398-42fc-893c-733221086476	63cc7164-4810-4665-bcdd-2c4892b9af20	30.0000	4.2000	2026-02-27 12:07:18.249673
c593f2a1-0cc0-4183-bce0-bf544e5ec466	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	1938.0000	7.8000	2026-02-26 16:53:20.609
c8683ced-47d1-43f4-8232-ad3c0d9caec2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	950.0000	2.7489	2026-02-26 16:53:20.63
761b777d-ae0f-4201-91da-b6d3edb5419d	b1f7c63d-e398-42fc-893c-733221086476	a4c4d632-f313-462f-946b-622e34ef428f	20.0000	10.0000	2026-02-27 12:08:44.452289
e868a214-5dc5-46db-97d5-00d57c9c5c3f	b1f7c63d-e398-42fc-893c-733221086476	a721f196-e022-4eff-a19c-017f7a7a829a	10.0000	28.0000	2026-02-27 12:11:18.360072
dc3a513e-b4f2-4182-a40e-3e9c90919786	b1f7c63d-e398-42fc-893c-733221086476	6e328e88-4317-43e2-b2f7-83626880b293	18.0000	2.1000	2026-02-27 12:12:22.252906
1a8ebbf6-01fc-4d9f-881b-f6762f3f0418	b1f7c63d-e398-42fc-893c-733221086476	e5a8a6d9-95a5-4634-9aca-75a3dfba27b8	45.0000	7.5000	2026-02-27 12:13:43.38
0887ce78-193d-43c2-a738-a985d6fe83ce	b1f7c63d-e398-42fc-893c-733221086476	6eba85b4-497c-4825-8811-2a0a16484685	100.0000	3.5000	2026-02-27 12:14:48.179
e326c35f-0c20-4662-b93d-928a32f2d2af	b1f7c63d-e398-42fc-893c-733221086476	79cdff67-a34f-4629-8246-de9ab7e74d32	5.0000	22.0000	2026-02-27 12:15:50.490514
f9908711-6642-4ce1-b246-42c3bc653fd2	b1f7c63d-e398-42fc-893c-733221086476	8f7254b4-f601-42ea-9011-72e8a29f697e	2.0000	180.0000	2026-02-27 12:18:39.838326
65004805-82e5-4314-a690-3ce1c5375f60	b1f7c63d-e398-42fc-893c-733221086476	8d63f428-d0fc-4868-b7fd-66a29f45924f	13.0000	19.0000	2026-02-27 12:20:01.953265
381e50cb-31b1-4446-9cde-4c242f04ca8e	b1f7c63d-e398-42fc-893c-733221086476	1f5c6651-6fb0-4447-ab4c-0e8abb303433	4.0000	19.0000	2026-02-27 12:21:14.30546
88494c2c-1dd0-4423-8c26-027a2b9ca1c1	b1f7c63d-e398-42fc-893c-733221086476	7a173b36-ffcd-4c90-95b7-51059064b00a	65.0000	16.0000	2026-02-27 12:22:34.736206
4b49ee3b-0ea6-4fd8-b6d9-80b095a6de78	b1f7c63d-e398-42fc-893c-733221086476	e6abb404-91b7-4390-8e05-0f45dd3a73ae	10.0000	30.0000	2026-02-27 12:25:57.786745
abc41206-49e8-4f86-8325-33f66956a731	b1f7c63d-e398-42fc-893c-733221086476	049f62ac-16df-45e6-8dfe-ae744d98890d	27.0000	25.0000	2026-02-27 12:23:55.042683
806f389b-80ce-40a4-9f0c-12c77b5ce363	b1f7c63d-e398-42fc-893c-733221086476	d83cda7d-b89d-431f-b442-084f36413d55	5.0000	12.5000	2026-02-27 12:24:22.26643
e4287f50-101a-4d0e-96da-0fecec96d34c	b1f7c63d-e398-42fc-893c-733221086476	0ad2e78d-8a19-401f-ae73-f402531d6f3d	5.0000	9.0000	2026-02-27 12:25:03.477834
974081d4-fd43-42d1-a391-f5cd53fa8747	b1f7c63d-e398-42fc-893c-733221086476	83df66a7-74e0-4fd6-b9f2-886e975a4216	4.0000	25.0000	2026-02-27 12:27:17.126029
3daf2d16-a50e-45d2-89e9-83781e480e12	b1f7c63d-e398-42fc-893c-733221086476	360cbca6-f7ae-4fec-9635-6dcaaa2da8c7	1.0000	28.0000	2026-02-27 12:28:30.878502
2f100bc0-cd1a-4c4c-806b-e192195bfe44	b1f7c63d-e398-42fc-893c-733221086476	9c306dac-d51a-4861-b915-de3d60e6d96f	9.0000	14.0000	2026-02-27 12:29:29.955045
f6e4189b-4cfc-4a92-ac94-8ce1e7787402	b1f7c63d-e398-42fc-893c-733221086476	752f12d2-b1a0-435e-aa4f-2098827bb3b9	5.0000	13.0000	2026-02-27 12:30:28.024912
1a07a064-66b7-47e3-833d-6a1d50751f48	b1f7c63d-e398-42fc-893c-733221086476	70211750-9cd3-4b50-aeb0-5e370783c55f	0.0000	80.0000	2026-02-27 12:44:55.983
6f83e29b-7004-41c6-8e99-d7781322552b	b1f7c63d-e398-42fc-893c-733221086476	f90f1c7a-33e8-4ca7-ae20-b733790a3d30	0.0000	150.0000	2026-02-27 12:44:56.187
cdabec80-3438-4b59-9a5d-43b6e3d78368	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	4043.0000	6.5000	2026-02-27 15:16:06.156
39c13d1b-b169-4c03-a26c-9ab5b245c30b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	c94e57d4-8a9b-4afd-a43b-e6a378bae500	1500.0000	13.2000	2026-02-27 17:30:28.342708
\.


--
-- Data for Name: farm_stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farm_stock_movements (id, farmer_id, product_id, type, quantity, unit_cost, reference_type, reference_id, notes, created_at, season_id) FROM stdin;
33a227df-a615-4134-93da-fafe88a4e465	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	entry	5.0000	110.0000	invoice	a06f25d6-9ef2-4438-80a1-8a3addd48727	Fatura item: CONTACT 72 - 20LTS	2026-02-10 16:30:36.704547	\N
c9ba3b81-e9ce-4a93-b158-f1e39c8c26a0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	dfa2a7ef-f2ff-4193-8989-581573145a67	entry	2.0000	290.0000	invoice	a06f25d6-9ef2-4438-80a1-8a3addd48727	Fatura item: SPHERE MAX SC - 5LTS	2026-02-10 16:30:36.732932	\N
621cb4c1-f4bb-4f74-a63f-9e54e4db813d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	entry	2500.0000	3.3800	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: GLIFOGROP FUL DMA - 20LTS	2026-02-10 16:51:13.77862	\N
72b28a66-123e-4909-95d5-a4f21a88bedd	53d9be2f-7343-4c53-89ee-b6e886daf5fb	29e3eff9-f2be-483e-bf85-48620e4cdf92	entry	12.0000	94.0000	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: FLUMITOP 48 SC FLUMIOXAZIM 48%	2026-02-10 16:51:13.798186	\N
182e024b-05a7-4b30-b2fe-a79f0b14173b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	300.0000	20.0000	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: EXTRAZONE- SULFENTRAZONE 50%- 5LT	2026-02-10 16:51:13.820848	\N
c7e17b15-fa99-4d56-b5b8-6c5d527c1050	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	580.0000	7.8000	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-10 16:51:13.83961	\N
b7697059-5388-44a7-9872-4cf3fe850615	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	entry	1400.0000	6.5000	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: CENTURION- CLETODIM 24%- 5 LTS.	2026-02-10 16:51:13.869851	\N
59b26d9a-d182-40f1-8355-645278738dd8	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	entry	500.0000	2.7500	invoice	a00e2f79-f27e-45e1-9932-a8d6ab72d02f	Fatura item: 2,4 D 72% - 2,4 D AMINA TM - 20LTS	2026-02-10 16:51:13.884576	\N
bbe5a5b4-1119-4222-b8ca-7db2a1c8a2bd	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	160.0000	7.8000	invoice	6b11d94f-1b97-4a70-be2a-f4fd1d0694a7	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-10 18:24:27.866832	\N
4187b03f-6a7f-422b-943f-054638186cb1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bbc3fa23-bb42-4267-94e3-d02ba049e3c8	entry	15.0000	18.8000	invoice	6b11d94f-1b97-4a70-be2a-f4fd1d0694a7	Fatura item: KURIN 48 - 5LTS	2026-02-10 18:24:27.885502	\N
0cecb208-9b5d-4b55-b820-45aeb4b3de58	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	b0af7390-7a96-4ebb-9f24-e56230688a15	Aplicação talhão: acc1d704-b874-40e0-a3ab-5ebfd7b48443	2026-02-11 00:24:08.146688	\N
901ef4c2-e00f-4ed0-bc91-f7580706878f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-220.0000	\N	pdv	32ef8ecc-6ccb-4f02-9d0b-d7b5ef23c049	Aplicação talhão: Talhao Cafezal	2026-02-11 01:39:51.070481	\N
ca5a9c83-7767-4b29-86e8-83cca8f8cfd9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	exit	-1000.0000	\N	pdv	2e17fd52-a267-49f2-85a0-985be3e5c283	Aplicação talhão: Talhao Cafezal	2026-02-11 01:39:51.294493	\N
e93c0c3f-b377-460d-8add-632c58d0abfb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-300.0000	\N	pdv	bd22b51e-fac9-416c-a38b-f2b4d861f178	Aplicação talhão: Talhao Cafezal	2026-02-11 01:39:51.513216	\N
03204c87-8d27-4ec6-b04d-a098122fb085	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-65.0000	\N	pdv	585d7762-b771-40bf-808e-9b9f7f4f37f7	Aplicação talhão: Talhao 01	2026-02-11 01:57:20.61764	\N
31f1007c-c8cb-497f-8985-ccfb7561ebdc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-135.0000	\N	pdv	6dd4c0a6-cd16-4038-adeb-5f970ae471d7	Aplicação talhão: Talhao Cafezal	2026-02-11 01:57:21.380132	\N
1ab30eae-aa53-486a-b33b-acae2a1a789d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	b712ab71-ebe6-4980-bd7b-4a40c8a9a5f0	Aplicação talhão: Talhao 01	2026-02-11 01:57:21.743424	\N
12cf255b-04b0-419a-8e57-bab93a98e391	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	1069b5bb-4637-4c3a-8319-87dd401bba9d	Aplicação talhão: Talhao Cafezal	2026-02-11 01:57:21.927075	\N
f582ac69-9f82-4ff8-9004-177371263f68	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-32.0000	\N	pdv	31e5efd5-3a0d-4aa9-9172-2ec483acc9a8	Aplicação talhão: Talhao 01	2026-02-11 13:35:43.051564	\N
fd48a317-da71-46fd-8ee3-851ffa30b163	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-68.0000	\N	pdv	1d04188a-4f91-4cce-b826-a6dace731920	Aplicação talhão: Talhao Cafezal	2026-02-11 13:35:43.342915	\N
14e56cd5-61b2-4c64-9d16-c4e57bfb65ac	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-32.0000	\N	pdv	69eea1e9-b254-4ab1-8a23-41b2c3d20c8c	Aplicação talhão: Talhao 01	2026-02-11 13:35:43.659774	\N
f6c5aea0-5250-4873-84ee-9c60472be57e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-68.0000	\N	pdv	869ba7bf-2d6c-497a-a183-2165cd368c98	Aplicação talhão: Talhao Cafezal	2026-02-11 13:35:43.867017	\N
c9786d03-4810-4000-bcc2-9ce95be00122	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	entry	2500.0000	3.3800	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: GLIFOGROP FUL DMA - 20LTS	2026-02-11 21:25:41.733086	\N
65aee832-7369-4c79-827f-23791715dad2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	29e3eff9-f2be-483e-bf85-48620e4cdf92	entry	12.0000	94.0000	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: FLUMITOP 48 SC FLUMIOXAZIM 48%	2026-02-11 21:25:41.749107	\N
75e6f0f8-b963-4ca9-8e79-13e759dfb492	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	300.0000	20.0000	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: EXTRAZONE- SULFENTRAZONE 50%- 5LT	2026-02-11 21:25:41.76176	\N
0f79b31a-0b7c-422b-9f2f-6c2c3148ed4c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	580.0000	7.8000	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-11 21:25:41.774763	\N
77eb0c96-d510-4560-9e9a-e5df5104e73d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	entry	1400.0000	6.5000	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: CENTURION- CLETODIM 24%- 5 LTS.	2026-02-11 21:25:41.789455	\N
14958290-1962-4793-addc-768d2f5191cc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	entry	500.0000	2.7500	invoice	3dcdec8f-aa5d-48d8-b39f-539b6b87c994	Fatura item: 2,4 D 72% - 2,4 D AMINA TM - 20LTS	2026-02-11 21:25:41.804981	\N
a3ca5a17-a9cf-483a-81f4-9cf5189ba225	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	2cb0e821-2367-4776-a716-c78315032870	Aplicação talhão: Talhao 01	2026-02-11 21:28:21.04164	\N
bd43948c-b460-4582-b302-e8a7b86fb668	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	exit	-200.0000	\N	pdv	0cfbb3a1-651c-41ae-bd48-6f6124c1586b	Aplicação talhão: Talhao 01	2026-02-11 21:28:21.995563	\N
3254442c-1050-4261-9679-7561678b6f29	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	79bb1bda-76b2-4e35-81f5-459fe0117012	Aplicação talhão: Talhao 01	2026-02-12 16:32:55.926	\N
ef1912a5-4c5b-411b-b0b3-662c4fd04751	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	467f32d4-9cf3-470f-9452-a7a16cc699c3	Aplicação talhão: Talhao 01	2026-02-12 16:32:56.14278	\N
fdcf31f1-e871-4786-bb24-5b43b6ccf967	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	b24d8872-1ebf-4f24-b152-02195b828ea0	Aplicação talhão: Talhao 01	2026-02-12 16:56:15.821333	\N
05e8db13-c9cb-4abe-9fdd-35765391aa4e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	27857eba-1c56-4d2a-b295-4c2e620fa3cf	Aplicação talhão: Talhao 01	2026-02-12 16:56:16.030362	\N
55df42a7-69c1-48ac-bb8b-edcb92639961	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	230a2803-50ad-4eaf-8c31-e24d7dc784b9	Aplicação talhão: Talhao 01	2026-02-12 16:57:42.297384	\N
0bce4a77-dc9d-4cf6-bf2a-3de28df50288	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	24d03b70-9c9c-40d0-9fd9-ca723e5c926f	Aplicação talhão: Talhao 01	2026-02-12 17:35:47.166732	\N
c0d88d1f-792e-4308-97cc-0d4e61a0668a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	b204ed2b-4669-449b-9a97-08efe39bb9a1	Aplicação talhão: Talhao 01	2026-02-12 17:35:47.349014	\N
d46e780e-dbd1-48a7-9858-7de36bd5bd71	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-1.0000	\N	pdv	f106d404-5828-493e-847d-6bc328b32478	Aplicação talhão: Talhao 01	2026-02-12 17:35:47.52832	\N
8a671aba-af0e-43f7-91ff-bb2bce544168	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	exit	-1.0000	\N	pdv	4e5023c1-2b43-4b1d-8f6c-3fac985b2c2d	Aplicação talhão: Talhao 01	2026-02-12 17:35:47.713344	\N
ed435b95-be38-41e4-96f6-9f91ea2bd978	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	entry	100.0000	5.5000	invoice	be256ffd-aac0-4650-835b-a33a83370c5c	Fatura item: CONTACT 72 - 20LTS	2026-02-12 19:20:30.060204	\N
f0b3d966-1559-449f-8c44-341700d1cd00	53d9be2f-7343-4c53-89ee-b6e886daf5fb	dfa2a7ef-f2ff-4193-8989-581573145a67	entry	10.0000	58.0000	invoice	be256ffd-aac0-4650-835b-a33a83370c5c	Fatura item: SPHERE MAX SC - 5LTS	2026-02-12 19:20:30.090341	\N
9537d624-1ea0-462e-ac3b-a76adcccbdd7	53d9be2f-7343-4c53-89ee-b6e886daf5fb	cea6052e-f6fa-47c2-ac3d-30ee483ce887	entry	21.0000	10.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: ONLY 75 WG-1KG	2026-02-12 21:38:06.63574	\N
f0411335-383c-4c8a-bf7e-15fd676194bb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	entry	120.0000	30.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: AMPLIGO - 1L	2026-02-12 21:38:06.644691	\N
fb341cf0-545c-4b9c-af34-c7b44b96cb54	53d9be2f-7343-4c53-89ee-b6e886daf5fb	4dec0a65-f945-47a5-b3cf-831f389348b9	entry	5.0000	42.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: PIXXARO-5LTS	2026-02-12 21:38:06.652292	\N
1ab3b71d-7387-40b4-a1e0-0634d3449ae6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	entry	80.0000	2.9000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: 2,4 D 72% -2,4 D AMINA TM-20LTS	2026-02-12 21:38:06.659581	\N
44b9b2a1-64a5-4b0f-983e-c10e844427aa	53d9be2f-7343-4c53-89ee-b6e886daf5fb	8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	entry	25.0000	15.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: HUSSAR EVOLUTION EC 96-5 LTS	2026-02-12 21:38:06.667062	\N
038b0033-681e-40d7-8718-7cf42ef4615f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	25.0000	18.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: EXTRAZONE- SULFENTRAZONE 50%-5LT	2026-02-12 21:38:06.674473	\N
2d4e84e4-c444-4ee6-84c7-3eb9cbe5ab11	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	entry	5.0000	7.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: DANKE-DIFENO 20%+ TEBUCO 20%-5LTS.	2026-02-12 21:38:06.682038	\N
9801d34a-3cb3-4dad-8156-45a1d813f2bb	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2c15dd42-d6a8-41fd-86a7-6050ed111ab1	entry	60.0000	15.0000	invoice	149db96b-ab02-4f32-b6d4-2028bbd1d3dc	Fatura item: KURIN 48-5LTS	2026-02-12 21:38:06.689369	\N
0b55f6b5-f9a8-4437-992e-59986a9cdbcf	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	ca9a8221-728a-4d33-b67c-7d53e2ea54fb	Aplicação talhão: Talhao 01	2026-02-12 21:50:16.005831	\N
cf9e27cf-69b3-4ef1-9867-9ce9aadebec0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	cf3895c1-27ce-437f-9cdc-bb6a75f5aa69	Aplicação talhão: Talhao 01	2026-02-12 21:50:16.185665	\N
c15d1bb3-e449-4a0b-b851-5fb40ae61daa	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	e07176ba-6431-4768-a5bd-2cdd8e151d80	entry	2500.0000	3.3800	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: GLIFOGROP FUL DMA - 20LTS	2026-02-13 01:15:08.702777	\N
9e0bf761-fcda-4df5-9261-5cc4946a3fd6	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	29e3eff9-f2be-483e-bf85-48620e4cdf92	entry	12.0000	94.0000	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: FLUMITOP 48 SC FLUMIOXAZIM 48%	2026-02-13 01:15:08.734296	\N
7a65a6f0-7f83-410a-9c38-366a8ab0c358	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	300.0000	20.0000	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: EXTRAZONE- SULFENTRAZONE 50%- 5LT	2026-02-13 01:15:08.755741	\N
882c6332-e87e-4d5d-8f24-6db8b749f4d3	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	57e58101-08e8-4f23-b74c-33060547e5f2	entry	580.0000	7.8000	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-13 01:15:08.764662	\N
f4de4260-1efb-4f35-8562-ea5e216b7325	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	ec245551-8240-4165-b9c8-fc441671b17c	entry	1400.0000	6.5000	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: CENTURION- CLETODIM 24%- 5 LTS.	2026-02-13 01:15:08.771913	\N
1aac0c66-e64c-47d2-92ea-cec61427b476	ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	ecbbde55-7311-4124-9587-588dd1671bf9	entry	500.0000	2.7500	invoice	1228a1a3-9fec-4363-98da-ee79f1bc96e4	Fatura item: 2,4 D 72% - 2,4 D AMINA TM - 20LTS	2026-02-13 01:15:08.786096	\N
34f8fa54-35f8-4ff7-9143-74289ef26aa5	53d9be2f-7343-4c53-89ee-b6e886daf5fb	dfa2a7ef-f2ff-4193-8989-581573145a67	exit	-10.0000	\N	pdv	65e4e331-a258-4b21-aa59-2f21c0a72241	Aplicação talhão: Talhao 01	2026-02-13 02:56:19.946615	\N
56d3f7f2-e427-4833-90a1-e7b476a22069	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	58f7b2a1-2d9a-48a2-8371-9affeebe6b09	Aplicação talhão: Talhao 01	2026-02-13 11:40:42.596014	\N
bee39004-073a-41ed-b0ca-8596002f4401	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	2e0d7ab1-64c1-4f41-aef5-961021e654d0	Aplicação talhão: Talhao 01	2026-02-13 11:40:42.958991	\N
a116b8ae-2c85-43db-908e-eb6bca1983a6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	exit	-100.0000	\N	pdv	bbe13ead-159c-48b3-a7dc-13baab82435b	Aplicação talhão: Talhao 01	2026-02-13 13:11:32.348864	\N
e597a007-1f6d-4731-8596-2971abb99e3f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	exit	-100.0000	\N	pdv	b559076c-13c6-47fa-8dca-8129dbb646e1	Aplicação talhão: Talhao 01	2026-02-13 13:11:32.599702	\N
6c84f4b3-f5a1-4f1f-ab40-3d38455307da	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	e17f8c62-fbd4-485d-838e-7635f9ccb315	Aplicação talhão: Talhao 01	2026-02-13 17:28:53.599592	\N
bafc18c7-a227-483a-8ac5-9985631c296c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	8c80d56c-7c8c-41fe-aaa1-26c3d6d6834d	exit	-1.0000	\N	pdv	41305e50-d191-45ad-bd7f-610a8456549e	Aplicação talhão: Talhao 01	2026-02-13 17:28:53.921337	\N
cdd3179c-e5b0-44ed-8819-ae2e9aa79162	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	exit	-1.0000	\N	pdv	6f237869-9c88-42f9-942e-8058f146d8d2	Aplicação talhão: Talhao 01	2026-02-13 17:28:54.131667	\N
b60d8baa-8da2-4423-801b-f85905a3eb1a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-100.0000	\N	pdv	f8e1dc49-77cf-4e00-b9e7-46d828bb671e	Aplicação talhão: Talhao 01	2026-02-13 22:28:04.052638	\N
1830d43c-fc31-46d8-a00e-844e600929c0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	4ee03ad3-f88b-414e-98b6-5a0bc43eb084	Aplicação talhão: Talhao 01	2026-02-13 22:28:04.356703	\N
853224e6-ca4a-478c-af69-6660deaaf803	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	b0a5eec2-0eda-482d-a81b-7c920a161076	Aplicação talhão: Talhao 01	2026-02-15 02:12:55.775716	\N
a0b4a66d-0939-416a-98b7-f0e72a9b0226	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-1.0000	\N	pdv	8b5a7aec-8d6c-495b-bdee-11fb88003f58	Aplicação talhão: Talhao 01	2026-02-15 02:12:55.99378	\N
bf86c2cb-a0cc-423e-bbd0-8d5657909d35	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	47e00e49-e99f-4afe-ae64-d8ac07c3e875	Aplicação talhão: Talhao 01	2026-02-15 02:13:53.842608	\N
c0697e37-5fa4-4a4a-a047-c7ba916b2a9c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	29e3eff9-f2be-483e-bf85-48620e4cdf92	exit	-1.0000	\N	pdv	3684ed0e-7ec8-441c-beba-fd8be41c4f60	Aplicação talhão: Talhao 01	2026-02-15 02:13:54.062166	\N
058901f9-6fbf-42eb-bb2e-6bf31c43a311	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	exit	-100.0000	\N	pdv	2de2a5db-81da-454c-8c83-1a4aacf8ca57	Aplicação talhão: Talhao 01	2026-02-15 02:48:41.139775	\N
efbe39d5-e4ff-4d95-9d5d-c65891b64782	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	15021ae9-0856-4924-817b-c94d105edb97	Aplicação talhão: Talhao 01	2026-02-15 03:10:05.576857	\N
fa1e15ff-d656-4e83-b3ac-a70410465aac	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	exit	-1.0000	\N	pdv	623cfc10-977d-46ce-9a21-837a792fb21c	Aplicação talhão: Talhao 01	2026-02-15 03:11:53.671255	\N
310d4883-218a-498c-ae7c-00a7e01ec40d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-1.0000	\N	pdv	3d6a093d-d383-4ced-a4e8-94078c42df94	Aplicação talhão: Talhao 01	2026-02-15 14:28:30.551347	\N
51c7a689-0a4a-4848-a76f-9da0dd9b866c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	entry	40.0000	0.8800	invoice	49fa3336-d723-4112-9786-7f573f1455a1	Fatura item: FERT PHYSALG LITHOFORTE - TIMAC - BB	2026-02-16 12:44:06.518605	\N
760a1fd9-1acb-4227-93d5-04cb74d1ab50	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	entry	500.0000	2.2000	invoice	8a401e27-ae99-4f10-924e-82085485fd36	Fatura item: PARAGROP 24 - 20LTS	2026-02-17 12:45:27.964496	\N
822c1b12-b9e1-41e7-9cf7-33651ed004a6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-200.0000	\N	pdv	90373ee2-46ab-41be-8500-f67f95873b03	Aplicação talhão: FERNANDO 	2026-02-17 12:57:27.756661	\N
e72261f0-d6c1-4a5a-a2a3-01f489df80c6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	9c5b58ba-8d54-433c-8124-7b6b3a24f406	Aplicação talhão: FERNANDO 	2026-02-17 12:57:27.942596	\N
a6003636-9bab-4f44-9fcc-2c41b07031a2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-3.0000	\N	pdv	90fb3308-919e-4515-a279-f3e933fe393e	Aplicação talhão: FERNANDO 	2026-02-17 13:01:43.064662	\N
587b77de-c32a-4c1d-a55f-1694b3742e5a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	39b05c17-de6d-48e6-9bb3-8f9292086559	Aplicação talhão: FERNANDO 	2026-02-17 13:16:09.975975	\N
7f928183-e9fd-4544-8b3b-60b3a0ac5a5e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-1.0000	\N	pdv	ed4e6d31-80a6-4d6f-847a-d1d4fbe2d879	Aplicação talhão: FERNANDO 	2026-02-17 13:16:10.153664	\N
0e667c53-5330-4a9a-925a-741004e3959f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-42.0000	\N	pdv	476732ad-a77a-4b83-a6d0-c59164acca5a	Aplicação talhão: FERNANDO 	2026-02-19 11:25:47.691403	\N
6c133580-7855-4d0f-bbf8-fbe632854265	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-58.0000	\N	pdv	e9f47b2d-0dff-4de9-862a-d237f53cc824	Aplicação talhão: Talhao 01	2026-02-19 11:25:47.919317	\N
855d300a-993e-410d-bf6e-d18463b8b41c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	94405fce-3702-4bf4-946d-54209188efac	Aplicação talhão: FERNANDO 	2026-02-19 11:25:48.127439	\N
f903d32c-95b0-42d3-acea-ff50390be17d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	cc98e2d9-47d6-45dc-b2e0-f0fa951ead03	Aplicação talhão: Talhao 01	2026-02-19 11:25:48.298692	\N
37c0c4e8-5054-41ba-8e56-d6e1f97f88cc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	exit	-100.0000	\N	pdv	eab2ec83-af44-47b1-9a5f-bd38279b1c77	Aplicação talhão: FERNANDO 	2026-02-20 00:14:50.802586	\N
10d749f8-c22a-4d50-a68e-caf2b792f804	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-1.0000	\N	pdv	8980e04e-a1d0-4dad-a361-f4a501a65123	Aplicação talhão: FERNANDO 	2026-02-20 02:19:16.475546	\N
e98c16f4-8fc6-472b-b447-988d3e520faa	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-140.0000	\N	pdv	c389c35c-e07c-47a8-963a-f66d01952904	Aplicação talhão: FERNANDO 	2026-02-20 03:17:26.614122	\N
ba93b77b-b285-4702-842c-e8b0afbbd8bf	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-10.0000	\N	pdv	333b02bc-5e05-44bb-b77e-75d369e88250	Aplicação talhão: Talhao 01	2026-02-20 03:34:10.214807	\N
958e25ee-4c26-4962-b5fa-a1d006f91ffe	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-10.0000	\N	pdv	f7ce7ae4-1bee-4835-b800-ac1af3234613	Aplicação talhão: Talhao 01	2026-02-20 03:34:10.443249	\N
4679168a-b54f-46d4-bc87-0ae41a4845e6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	0ff4031b-cffe-45f1-92c1-930eebeeb1c5	Aplicação talhão: FERNANDO 	2026-02-20 10:54:02.398861	\N
44714d88-7336-4250-9ee7-da90b6c647b3	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bb0b6be7-ce10-4c7c-b1a5-23cc156ab577	exit	-30.0000	\N	pdv	88011d51-a7ad-4fa6-80b5-7c4459fa67ce	Aplicação talhão: FERNANDO 	2026-02-21 01:56:03.136534	\N
4bbf875f-4489-4484-8066-21a9f8565011	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	exit	-1.0000	\N	pdv	f0ee37c8-a96e-4ba6-b2bb-f07df47565e2	Aplicação talhão: Talhao 01	2026-02-21 16:19:52.410769	\N
6a8c1ab6-5974-4ebb-b533-de6df014dd30	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-5.0000	\N	pdv	262f21e7-04c7-4f76-a9cd-059305ceaa24	Aplicação talhão: Talhao 01	2026-02-21 16:35:47.075239	\N
ac452810-0b35-4208-a2f2-beef76065a13	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ed485e2e-18e8-4b7e-b787-c0e29d6eb432	exit	-1.0000	\N	pdv	41638b09-9479-470a-b57f-946556b0d5d4	Aplicação talhão: Talhao 01	2026-02-21 16:54:06.731268	\N
b1732689-6798-4623-897b-bb53506da675	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	8643438d-6fbd-4a56-ac63-19313dacba9f	Aplicação talhão: Talhao 01	2026-02-21 23:47:35.753256	\N
185af6c6-a715-4582-beee-ee553037dde2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-1.0000	\N	pdv	f6d22289-53ed-4cce-86f3-bcb500ada284	Aplicação talhão: Talhao 01	2026-02-23 01:06:40.823618	\N
b3c9e3ab-4283-4286-8d82-7e9e655e3c46	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	61b96dcd-725c-4728-8b9f-720a94df0fb9	Aplicação talhão: FERNANDO 	2026-02-23 18:03:34.222072	\N
fa88f57b-1013-4e86-aec0-6a1b240543b8	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-50.0000	\N	pdv	f8f18bf5-9b90-4f5d-a558-bd0d350dc567	Aplicação talhão: Talhao 01	2026-02-23 18:03:34.410509	\N
dde961a2-3e0e-41ac-8bc8-0d8f216f2b00	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	exit	-3.0000	\N	pdv	3dac4355-cc9e-4f33-b021-9deb47a7a050	Aplicação talhão: FERNANDO 	2026-02-23 18:03:34.602526	\N
f4062ab5-eb5d-4d30-bfa5-374d14c84225	53d9be2f-7343-4c53-89ee-b6e886daf5fb	d920bc05-6b7f-4e76-9741-8bca2b12d81c	exit	-2.0000	\N	pdv	304e3446-d776-4cad-90ba-4c3c53ec4763	Aplicação talhão: Talhao 01	2026-02-23 18:03:34.817911	\N
7895dad8-5461-4abe-8da2-693a45676530	53d9be2f-7343-4c53-89ee-b6e886daf5fb	0a8a5127-d7f0-4a39-bd1e-55f18b323ae7	entry	10.0000	140.0000	invoice	b5796412-4eec-4d1b-bc97-96a5556daa9d	Fatura item: DERMACOR-1L	2026-02-24 12:17:32.756855	\N
3c89e97c-3313-477f-bf4c-7edd98dec130	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	160.0000	7.8000	invoice	46010e20-59b9-417b-afb4-44110ae4165a	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-24 12:53:25.565596	\N
bc3c0a5b-46f3-4820-884b-77c94a197d34	53d9be2f-7343-4c53-89ee-b6e886daf5fb	bbc3fa23-bb42-4267-94e3-d02ba049e3c8	entry	15.0000	18.8000	invoice	46010e20-59b9-417b-afb4-44110ae4165a	Fatura item: KURIN 48 - 5LTS	2026-02-24 12:53:25.58031	\N
f04e48e9-a1af-4a9b-b7d7-a3cd50b01eea	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	32428987-d362-46d8-937b-3f2fda2fcb23	Aplicação talhão: Talhao 01	2026-02-24 12:57:24.225188	\N
e06ce8d5-6c72-4746-9d90-7a5e6ab3be3a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-3.0000	\N	pdv	e1a87db2-6dc2-4659-b800-8fe1947ddabe	Aplicação talhão: Talhao 01	2026-02-24 13:07:21.239677	\N
d2d59ce4-7577-48bf-880e-93cf8f7ae5a1	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	exit	-100.0000	\N	pdv	29908651-21cb-4f54-b09a-c31fe435e9af	Aplicação talhão: FERNANDO 	2026-02-24 13:40:21.799913	\N
7fd2e71d-bf10-4c73-aac2-974ee6103e43	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ba1db2e8-eb89-4dc3-b5c9-b2a795b63711	exit	-200.0000	\N	pdv	4cbc49d5-54ee-49ce-88a0-567e69a8e561	Aplicação talhão: Talhao 01	2026-02-24 13:41:14.371472	\N
21ac3941-aacc-4e68-8b5c-72d5f45269a3	04e14650-3676-4272-986f-16f3a64b954d	d778065d-8c3b-43af-966e-6fa01dc8b115	entry	100.0000	48.0000	manual_entry	\N	Entrada manual avulsa	2026-02-24 23:44:50.327859	\N
bbc70e1b-73c8-4779-974d-8e832a657fdc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	daee585e-30a4-495f-bc8d-cc126350079c	Aplicação talhão: FERNANDO 	2026-02-25 12:08:22.50684	\N
f430c14c-7f33-4b5f-839e-f6c79f92d0a7	04e14650-3676-4272-986f-16f3a64b954d	c13796cf-e516-4875-a36d-f5da16309710	entry	360.0000	2.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:21:40.748253	\N
48a0186f-6029-4594-a48e-b7876f5a8d2c	04e14650-3676-4272-986f-16f3a64b954d	e6784bfd-5ed4-4689-a4bc-102d4469feaa	entry	110.0000	28.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:23:42.150366	\N
f3e8456d-7df1-4bec-824a-8b523c93d13f	04e14650-3676-4272-986f-16f3a64b954d	5f4cdb54-c57d-48cd-bdbb-435c219f75ac	entry	40.0000	28.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:24:52.525483	\N
e3ca3f61-6684-4bd4-99e0-d175c2a9a0eb	04e14650-3676-4272-986f-16f3a64b954d	aecbd53f-04bc-46f1-a499-a94f70fb2416	entry	40.0000	22.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:26:01.089748	\N
1833a8ee-00f0-42c8-b163-c5aa77c1dbb8	04e14650-3676-4272-986f-16f3a64b954d	cf05a461-ab9a-4496-9c75-b327c47d6b33	entry	40.0000	5.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:27:20.8351	\N
54f71d3d-50a8-43c6-8d97-655bebc54dd0	04e14650-3676-4272-986f-16f3a64b954d	1d039e2b-70f4-40d0-b5de-b7e29740c263	entry	80.0000	10.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:28:18.797853	\N
e6442720-b974-4c80-8a5b-1f505d5258d2	04e14650-3676-4272-986f-16f3a64b954d	7a173b36-ffcd-4c90-95b7-51059064b00a	entry	30.0000	15.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:31:23.345336	\N
11c08e96-8292-4e36-80b8-f2186a73fbfe	04e14650-3676-4272-986f-16f3a64b954d	ffeffd8a-23b4-4cdc-930c-05b856f56583	entry	6.0000	80.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:33:19.289726	\N
5afc0eea-e02d-42bd-90d2-dcd3121300ac	04e14650-3676-4272-986f-16f3a64b954d	171cda08-cd32-4196-864a-f2539a172345	entry	60.0000	34.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:34:59.330676	\N
c93d199c-f35d-48a9-b3e2-7bbd5656ba64	04e14650-3676-4272-986f-16f3a64b954d	171cda08-cd32-4196-864a-f2539a172345	entry	260.0000	34.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:37:19.286434	\N
6c736528-b040-4e6c-b006-9da857a5c7f1	04e14650-3676-4272-986f-16f3a64b954d	1f9a6867-2603-4596-b833-9bd545a8bba0	entry	5.0000	9.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:40:15.378458	\N
8258ffbe-7a2f-4fd9-b870-a90e2e622235	04e14650-3676-4272-986f-16f3a64b954d	381a9173-b1af-4df3-b23d-e3c3e15bec3a	entry	475.0000	5.5000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:42:08.067914	\N
8aef7f5a-f5fb-481e-a7bd-02e76e295d28	04e14650-3676-4272-986f-16f3a64b954d	7e63a03d-face-451a-9055-8405152b1a1f	entry	30.0000	29.0000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:44:10.664702	\N
6cb361bd-a8ee-4ad1-a4dd-8751c6af71ad	04e14650-3676-4272-986f-16f3a64b954d	d039c5ea-4c04-472d-a27d-2783079a643b	entry	1380.0000	6.5000	manual_entry	\N	Entrada manual avulsa	2026-02-25 12:53:19.258429	\N
c5e40300-2078-4153-b208-cfe59ab1d5a6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	f8dc2c3d-37bf-4f91-a83e-0b9b8a8919cc	Aplicação talhão: Talhao 01	2026-02-25 13:28:36.832496	\N
3c1d64ca-108e-454b-bbf5-79bbd271a79b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	6089865b-4aac-433b-a750-c7db5f6e84ca	exit	-10.0000	\N	pdv	d67f8c63-03c9-4c29-8999-a3cc12e0d519	Aplicação talhão: FERNANDO 	2026-02-25 17:51:00.949425	\N
dc43c29c-94d5-4644-aee7-e5ae8320293e	53d9be2f-7343-4c53-89ee-b6e886daf5fb	2c15dd42-d6a8-41fd-86a7-6050ed111ab1	exit	-10.0000	\N	pdv	908ba1f6-fa5d-47f9-b6df-16b865945b70	Aplicação talhão: Talhao 01	2026-02-26 01:04:46.950753	\N
84dbdc15-89f3-48c1-b4d4-b8cc60530470	b1f7c63d-e398-42fc-893c-733221086476	57e58101-08e8-4f23-b74c-33060547e5f2	entry	160.0000	7.8000	invoice	46dca54d-74ad-4641-8ad7-b134827b6670	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-26 14:00:32.11026	\N
cae39b10-5f76-4f6e-b50a-e4a8492a0db6	b1f7c63d-e398-42fc-893c-733221086476	bbc3fa23-bb42-4267-94e3-d02ba049e3c8	entry	15.0000	18.8000	invoice	46dca54d-74ad-4641-8ad7-b134827b6670	Fatura item: KURIN 48 - 5LTS	2026-02-26 14:00:32.138557	\N
4c9efdcf-65aa-4355-a4e8-f5c0a0771e99	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	entry	2500.0000	3.3800	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: GLIFOGROP FUL DMA - 20LTS	2026-02-26 16:32:10.700206	\N
521ebf31-6be1-49dc-bcdc-50316e094fe3	53d9be2f-7343-4c53-89ee-b6e886daf5fb	251c1ac5-8cec-4654-81f2-a0675563799d	entry	12.0000	94.0000	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: FLUMITOP 48 SC FLUMIOXAZIM 48%	2026-02-26 16:32:10.727697	\N
dfe33c70-a80e-4765-bd91-acef03e6b57d	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	300.0000	20.0000	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: EXTRAZONE- SULFENTRAZONE 50%- 5LT	2026-02-26 16:32:10.743333	\N
3abb5ccb-1912-4c95-8af4-97f5b70ec50c	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	580.0000	7.8000	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-26 16:32:10.757592	\N
371389f4-9833-4bf3-b3e2-a43506ca11b9	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	entry	1400.0000	6.5000	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: CENTURION- CLETODIM 24%- 5 LTS.	2026-02-26 16:32:10.774533	\N
5736a252-6200-4a22-a659-68db254dfef2	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	entry	500.0000	2.7500	invoice	3ead8d86-d2e7-48a1-b46f-18cd0907ce86	Fatura item: 2,4 D 72% - 2,4 D AMINA TM - 20LTS	2026-02-26 16:32:10.795564	\N
fabc7ab8-40ca-47f8-b246-5b2ca2e62b55	53d9be2f-7343-4c53-89ee-b6e886daf5fb	e07176ba-6431-4768-a5bd-2cdd8e151d80	entry	2500.0000	3.3800	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: GLIFOGROP FUL DMA - 20LTS	2026-02-26 16:53:20.562456	\N
029f3123-7e97-4dbc-ad8b-8808ce1b9e1a	53d9be2f-7343-4c53-89ee-b6e886daf5fb	251c1ac5-8cec-4654-81f2-a0675563799d	entry	12.0000	94.0000	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: FLUMITOP 48 SC FLUMIOXAZIM 48%	2026-02-26 16:53:20.575583	\N
e834f72a-b3b8-4f64-85fd-f411ff938a7b	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	entry	300.0000	20.0000	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: EXTRAZONE- SULFENTRAZONE 50%- 5LT	2026-02-26 16:53:20.591328	\N
85b771e8-03b8-417b-b3de-f14749119079	53d9be2f-7343-4c53-89ee-b6e886daf5fb	57e58101-08e8-4f23-b74c-33060547e5f2	entry	580.0000	7.8000	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: CLOMAZERB 48- CLOMAZONE 48% EC-20LT	2026-02-26 16:53:20.611511	\N
63433408-7095-42fc-8d3d-f384816e3e57	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	entry	1400.0000	6.5000	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: CENTURION- CLETODIM 24%- 5 LTS.	2026-02-26 16:53:20.622985	\N
959736f6-7637-42c5-b2be-5488925297e0	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ecbbde55-7311-4124-9587-588dd1671bf9	entry	500.0000	2.7500	invoice	51a78790-8348-4ffa-a6de-2bbb54db94aa	Fatura item: 2,4 D 72% - 2,4 D AMINA TM - 20LTS	2026-02-26 16:53:20.632831	\N
cc4fd6c0-9715-402a-80aa-cb7a6a59aa80	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-58.0000	\N	pdv	1332e170-4f7e-412d-aa5a-88bbf0e59877	Aplicação talhão: Talhao 01	2026-02-26 19:51:49.082203	\N
0cddce68-0dc9-42b6-bc7c-0c8448bca088	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-42.0000	\N	pdv	92c1a23c-6be4-4bab-bc66-b454d1158220	Aplicação talhão: FERNANDO 	2026-02-26 19:51:49.66219	\N
4d31da35-374a-4677-b11f-e37fefa88c62	04e14650-3676-4272-986f-16f3a64b954d	e6784bfd-5ed4-4689-a4bc-102d4469feaa	adjustment	0.0000	28.0000	manual_adjustment	\N	erro de nome	2026-02-27 11:09:05.608965	\N
18597d95-8faa-458a-a843-2ac6d9cc1744	b1f7c63d-e398-42fc-893c-733221086476	c13796cf-e516-4875-a36d-f5da16309710	entry	300.0000	2.1000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:04:55.36654	\N
5151a283-71cf-4a45-8b0b-0fc95fe6cf61	b1f7c63d-e398-42fc-893c-733221086476	6eba85b4-497c-4825-8811-2a0a16484685	entry	80.0000	3.5000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:06:13.413978	\N
298d2058-648f-490b-a109-2927474bf838	b1f7c63d-e398-42fc-893c-733221086476	63cc7164-4810-4665-bcdd-2c4892b9af20	entry	30.0000	4.2000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:07:18.258548	\N
f8c83804-4fa8-4495-8f54-0e3659c91414	b1f7c63d-e398-42fc-893c-733221086476	a4c4d632-f313-462f-946b-622e34ef428f	entry	20.0000	10.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:08:44.458321	\N
36fab189-4606-458b-aeab-f4afe643fecc	b1f7c63d-e398-42fc-893c-733221086476	4edc8757-46d9-4741-b5a1-de15155aa53e	entry	10.0000	25.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:10:01.26163	\N
6a4f5198-9f96-43e1-a603-8049fbd4c2f6	b1f7c63d-e398-42fc-893c-733221086476	e5a8a6d9-95a5-4634-9aca-75a3dfba27b8	entry	30.0000	7.5000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:10:44.765247	\N
783188ed-045d-45be-b3b5-6af82e92c2e7	b1f7c63d-e398-42fc-893c-733221086476	a721f196-e022-4eff-a19c-017f7a7a829a	entry	10.0000	28.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:11:18.361885	\N
163e60c1-e2c4-4825-9ccd-e102d3f305ca	b1f7c63d-e398-42fc-893c-733221086476	6e328e88-4317-43e2-b2f7-83626880b293	entry	18.0000	2.1000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:12:22.256433	\N
45ca9978-81fc-47b3-b2a5-28bb8e804e90	b1f7c63d-e398-42fc-893c-733221086476	e5a8a6d9-95a5-4634-9aca-75a3dfba27b8	adjustment	15.0000	7.5000	manual_adjustment	\N	Melix 15L	2026-02-27 12:13:43.383079	\N
6f319c0c-b810-4a3c-bb32-bb40c753b351	b1f7c63d-e398-42fc-893c-733221086476	6eba85b4-497c-4825-8811-2a0a16484685	adjustment	20.0000	3.5000	manual_adjustment	\N	Glifogroup 20 L	2026-02-27 12:14:48.19031	\N
64bbe947-33db-440f-b56d-0a2c071e8275	b1f7c63d-e398-42fc-893c-733221086476	79cdff67-a34f-4629-8246-de9ab7e74d32	entry	5.0000	22.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:15:50.493581	\N
64edb2a2-d77a-45af-86b8-4d4370a586fe	b1f7c63d-e398-42fc-893c-733221086476	8f7254b4-f601-42ea-9011-72e8a29f697e	entry	2.0000	180.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:18:39.844653	\N
5578ad6d-7491-4749-a175-5df7b0a93353	b1f7c63d-e398-42fc-893c-733221086476	8d63f428-d0fc-4868-b7fd-66a29f45924f	entry	13.0000	19.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:20:01.958498	\N
fe027355-f20b-4c2a-9631-7a620ab295a6	b1f7c63d-e398-42fc-893c-733221086476	1f5c6651-6fb0-4447-ab4c-0e8abb303433	entry	4.0000	19.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:21:14.315357	\N
155c4aec-c9da-4caf-ba31-db8f5b3f27cb	b1f7c63d-e398-42fc-893c-733221086476	7a173b36-ffcd-4c90-95b7-51059064b00a	entry	65.0000	16.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:22:34.746903	\N
61106b6d-ee37-453f-bc15-41109d6cd164	b1f7c63d-e398-42fc-893c-733221086476	049f62ac-16df-45e6-8dfe-ae744d98890d	entry	27.0000	25.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:23:55.045523	\N
73a89ed3-07ab-449c-951b-bc6de47a44e2	b1f7c63d-e398-42fc-893c-733221086476	83df66a7-74e0-4fd6-b9f2-886e975a4216	entry	4.0000	25.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:27:17.128071	\N
23b27d34-bef6-4173-a133-a6e4c7b67ead	b1f7c63d-e398-42fc-893c-733221086476	752f12d2-b1a0-435e-aa4f-2098827bb3b9	entry	5.0000	13.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:30:28.034297	\N
26858edd-6022-41f3-add3-b436a4c34dda	b1f7c63d-e398-42fc-893c-733221086476	70211750-9cd3-4b50-aeb0-5e370783c55f	exit	-3.0000	\N	pdv	a9834b5f-7770-4b2e-8782-7a19bbf73a7d	Aplicação talhão: sede	2026-02-27 12:44:56.00108	\N
d36b88cd-5b75-413e-a557-998d605a1155	b1f7c63d-e398-42fc-893c-733221086476	f90f1c7a-33e8-4ca7-ae20-b733790a3d30	exit	-4.0000	\N	pdv	dd747825-d3a8-43fb-b45d-c64e17b5373f	Aplicação talhão: sede	2026-02-27 12:44:56.203155	\N
0128b1c8-3158-429a-b701-2d302cbc3719	b1f7c63d-e398-42fc-893c-733221086476	d83cda7d-b89d-431f-b442-084f36413d55	entry	5.0000	12.5000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:24:22.270278	\N
cd65f3ab-7378-48a7-b7e5-222683926c4c	b1f7c63d-e398-42fc-893c-733221086476	360cbca6-f7ae-4fec-9635-6dcaaa2da8c7	entry	1.0000	28.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:28:30.885305	\N
b13845bf-473b-47ea-a850-4d09b6f93103	b1f7c63d-e398-42fc-893c-733221086476	9c306dac-d51a-4861-b915-de3d60e6d96f	entry	9.0000	14.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:29:29.963435	\N
383bf45c-15fa-4454-872f-e472391b3934	b1f7c63d-e398-42fc-893c-733221086476	0ad2e78d-8a19-401f-ae73-f402531d6f3d	entry	5.0000	9.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:25:03.479559	\N
1c7d9234-499f-4e1c-9e09-cc80765e6c71	b1f7c63d-e398-42fc-893c-733221086476	e6abb404-91b7-4390-8e05-0f45dd3a73ae	entry	10.0000	30.0000	manual_entry	\N	Entrada manual avulsa	2026-02-27 12:25:57.790538	\N
396d2809-9921-467e-b929-1adeb57a03d3	b1f7c63d-e398-42fc-893c-733221086476	f90f1c7a-33e8-4ca7-ae20-b733790a3d30	entry	4.0000	150.0000	invoice	4a0fe410-5e29-403a-947a-dce14f707e26	Fatura item: DULIA BIO	2026-02-27 12:39:26.683763	\N
75787952-041f-45ef-938c-a4de56f57324	b1f7c63d-e398-42fc-893c-733221086476	70211750-9cd3-4b50-aeb0-5e370783c55f	entry	3.0000	80.0000	invoice	4a0fe410-5e29-403a-947a-dce14f707e26	Fatura item: CONGREGGA PRO	2026-02-27 12:39:26.688659	\N
ed6bfd28-708b-4c26-aac9-8eea883a8a7f	53d9be2f-7343-4c53-89ee-b6e886daf5fb	ec245551-8240-4165-b9c8-fc441671b17c	exit	-100.0000	\N	pdv	cfc9eb30-1c70-4ef7-9748-b5efc504d39c	Aplicação talhão: FERNANDO 	2026-02-27 15:16:06.181539	\N
ff6ee80f-38bc-4a78-b141-60776096c7a6	53d9be2f-7343-4c53-89ee-b6e886daf5fb	c94e57d4-8a9b-4afd-a43b-e6a378bae500	entry	1500.0000	13.2000	invoice	785a478c-a6d8-453f-826b-fa43a7460c20	Fatura item: (38)BIFENTAM 40 MAX_(BIFENTRINA 40%)	2026-02-27 17:30:28.366632	\N
1ff66ff9-2f52-47f0-8d8b-09ffda6c6ffc	53d9be2f-7343-4c53-89ee-b6e886daf5fb	89030455-82c7-4cba-96a1-8e8543ab3b1f	exit	-100.0000	\N	pdv	c9e33a18-2f9a-4859-a78a-a964b7075d16	Aplicação talhão: FERNANDO 	2026-02-27 17:33:38.325208	\N
\.


--
-- Data for Name: farms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.farms (id, name, client_id, lat, lng, address, notes, created_at) FROM stdin;
\.


--
-- Data for Name: fields; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fields (id, name, farm_id, area, crop, notes, created_at) FROM stdin;
\.


--
-- Data for Name: global_management_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.global_management_applications (id, season_id, categoria, application_number, product_id, price_tier, price_per_ha, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_items (id, product_code, product_name, package_type, quantity, uploaded_by, upload_session_id, created_at) FROM stdin;
\.


--
-- Data for Name: manager_team_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.manager_team_rates (id, manager_id, season_id, category_id, investment_per_ha, subcategories, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: market_benchmarks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.market_benchmarks (id, user_id, category_id, season_id, market_percentage, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: market_investment_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.market_investment_rates (id, category_id, investment_per_ha, subcategories) FROM stdin;
\.


--
-- Data for Name: master_clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.master_clients (id, name, region_id, planting_area, cultures, credit_line, is_active, created_at, updated_at) FROM stdin;
55aaa737-fd19-4e5e-a76c-cbdd43eb59c1	ANASTACIO DE OLIVEIRA AMORIM	9c738932-9b21-4e5f-87d5-072c744d61d0	145.00	"[]"	\N	t	2025-10-08 05:11:40.098	2025-10-08 05:11:40.098
1b4c3cc6-becd-4229-9957-158d2c09a7fb	ANSES SOCIEDAD ANONIMA	115e5fde-281e-479f-a657-9971fa2baf60	\N	"[]"	\N	t	2025-10-08 05:11:40.288	2025-10-08 05:11:40.288
090d8bff-83bd-4e41-a17c-c6b80807bc4d	APARECIDO FRANCISCO DA COSTA	71ca46e1-042d-4b76-83ad-e0ca977f326e	145.20	"[]"	\N	t	2025-10-08 05:11:40.469	2025-10-08 05:11:40.469
11bd1f37-c420-40ba-ab9c-1feeeaceeffb	BERTAO ANDRE / THIAGO	9c738932-9b21-4e5f-87d5-072c744d61d0	700.00	"[]"	\N	t	2025-10-08 05:11:40.654	2025-10-08 05:11:40.654
0212e9c5-c1b9-40f5-a61a-494a522ddeb1	CLAUDEMIR CAMPANERUTTO	e25208fc-38f7-4b7b-91a7-4803956b554a	217.50	"[]"	\N	t	2025-10-08 05:11:40.833	2025-10-08 05:11:40.833
b1631331-52a6-4f4f-b602-2b9591a9edee	ANTONIO CAMPANERUTTO	e25208fc-38f7-4b7b-91a7-4803956b554a	217.50	"[]"	\N	t	2025-10-08 05:11:41.013	2025-10-08 05:11:41.013
3c869c3e-2402-4ad8-97ee-c67173576de2	LUIZ CARLOS DECONTO	56fee253-6882-49d1-871b-47d79bc1036c	1000.00	"[]"	\N	t	2025-10-08 05:11:41.191	2025-10-08 05:11:41.191
0123a563-f5c4-4fa9-a67d-ae46da0b0f28	DEIVSON BONFIN	9c738932-9b21-4e5f-87d5-072c744d61d0	420.00	"[]"	\N	t	2025-10-08 05:11:41.37	2025-10-08 05:11:41.37
e96a5557-4faf-40c3-87a1-976cb96c20eb	EDSON DE SOUZA DO BONFIM	9c738932-9b21-4e5f-87d5-072c744d61d0	420.00	"[]"	\N	t	2025-10-08 05:11:41.548	2025-10-08 05:11:41.548
4a6cffeb-e211-4514-9dbc-aecb7d5bf2ae	GULIANO SEIBT BESING	9c738932-9b21-4e5f-87d5-072c744d61d0	1700.00	"[]"	\N	t	2025-10-08 05:11:41.727	2025-10-08 05:11:41.727
f3da5477-00fa-451a-98da-6a9733c03301	MARCIO DAL BOSCO	9c738932-9b21-4e5f-87d5-072c744d61d0	2020.00	"[]"	\N	t	2025-10-08 05:11:41.908	2025-10-08 05:11:41.908
b13a1280-b905-4d4d-9db1-03257d4f2e80	SERGIO MIOTTO	71ca46e1-042d-4b76-83ad-e0ca977f326e	345.00	"[]"	\N	t	2025-10-08 05:11:42.086	2025-10-08 05:11:42.086
d1884ec9-d605-4765-93f7-3d0c6739dccd	DIEGO MIOTTO	71ca46e1-042d-4b76-83ad-e0ca977f326e	345.00	"[]"	\N	t	2025-10-08 05:11:42.263	2025-10-08 05:11:42.263
d824eb98-7b81-4991-aa82-a546959678c3	PETER PAUL RICHTER	71ca46e1-042d-4b76-83ad-e0ca977f326e	2900.00	"[]"	\N	t	2025-10-08 05:11:42.447	2025-10-08 05:11:42.447
b4cad117-1a08-46c6-82af-92f0f427ef1a	SERGIO DE JESUS PIRES DE ALMEIDA	71ca46e1-042d-4b76-83ad-e0ca977f326e	960.00	"[]"	\N	t	2025-10-08 05:11:42.625	2025-10-08 05:11:42.625
66959603-6568-4453-9532-6e1d0ec13e65	UNDINO FABRIS CARRADORE	e25208fc-38f7-4b7b-91a7-4803956b554a	800.00	"[]"	\N	t	2025-10-08 05:11:42.804	2025-10-08 05:11:42.804
71546b5b-c5d6-4bc3-97d5-07fb96aa2395	VALMOR MARCHIORO	b6df536b-84f5-468f-9fc5-330d61ebd906	629.20	"[]"	\N	t	2025-10-08 05:11:42.982	2025-10-08 05:11:42.982
eceda4b4-3b68-4fb9-bb0d-3a48a61e0474	TRENTIN JAIME	b6df536b-84f5-468f-9fc5-330d61ebd906	900.00	"[]"	\N	t	2025-10-09 17:03:49.932	2025-10-09 17:03:49.932
be127e6a-24c1-4326-b70c-425358527f5e	LUIS ANTONIO  VILLALBA PEDROZO	71ca46e1-042d-4b76-83ad-e0ca977f326e	1200.00	"[]"	\N	t	2025-10-08 05:11:43.163	2025-10-08 19:12:38.014
7cc81c42-3c6e-4d6c-ae96-99ee432c798f	RONALDO RAMIREZ MELATO	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:11.913	2025-10-08 19:19:11.913
4a67f5ce-2690-42a6-aca6-6c0227296455	THOMAS RICHTER	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:13.345	2025-10-08 19:19:13.345
d1432eab-306f-4939-90bf-976cd0d19062	PIRES E.A.S.	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:13.763	2025-10-08 19:19:13.763
6d95104d-d762-43ed-b7e2-7676acd2c169	KENIA TEIXEIRA DE ALMEIDA	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:19.013	2025-10-08 19:19:19.013
fb0aa440-56f8-4d37-94bc-1e60a5400849	PARAPORT S.R.L	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:21.01	2025-10-08 19:19:21.01
f8495217-4fb3-4a74-ac3c-4dbcc4f6c3c0	NILDO DAL BOSCO	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:24.827	2025-10-08 19:19:24.827
cd9f6b72-c52a-46ff-8ca8-aa60dec2e898	ANACORP S.R.L.	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:28.136	2025-10-08 19:19:28.136
c1a947e6-105f-49a9-88db-8b88c37b7246	GUSTAVO ENRIQUE MARCHIORO DE CONTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 19:19:30.972	2025-10-08 19:19:30.972
5ba0665d-9ea8-4e16-97b0-9fbdcd96914b	AGRIDESA S.A	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 20:02:31.055	2025-10-08 20:02:31.055
10b6bca8-a6ba-40e0-8a20-9c8845ef2b80	ODENIR BAUMANN	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 20:02:33.991	2025-10-08 20:02:33.991
2c071c21-a553-4567-9f40-774a9d9b3ae5	DEIVSON SOUZA BONFIM	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 20:02:43.018	2025-10-08 20:02:43.018
f91d5c94-ecb6-4507-8735-f3e926058318	DIEGO MIOTTO VILLANOVA	reg-alto-parana	\N	"[]"	\N	t	2025-10-08 20:02:45.258	2025-10-08 20:02:45.258
6ecb63cd-717d-4741-b17d-5219c2aff5a2	FILONIDIA BENITEZ DE MOSEMANN	532c538f-5a28-4478-bdff-713e20b4dc22	50.00	"[]"	\N	t	2025-10-09 17:03:46.55	2025-10-09 17:03:46.55
09379062-e344-495c-b3df-fe59cd569901	ROBERTO ROSEMBERGER	532c538f-5a28-4478-bdff-713e20b4dc22	116.00	"[]"	\N	t	2025-10-09 17:03:46.733	2025-10-09 17:03:46.733
05f96544-ecbe-49cc-8fbd-c5bc1f478121	ELCIO TOSTA BARBOSA	532c538f-5a28-4478-bdff-713e20b4dc22	145.00	"[]"	\N	t	2025-10-09 17:03:46.911	2025-10-09 17:03:46.911
63109bd8-5a58-4509-8fcb-69fbddaaa987	EDNILDO ROBSON PIRES PIRES	532c538f-5a28-4478-bdff-713e20b4dc22	70.00	"[]"	\N	t	2025-10-09 17:03:47.088	2025-10-09 17:03:47.088
ecd0c6ec-5383-443b-8903-23112376bdf3	PEDRO DOS SANTOS PIRES	532c538f-5a28-4478-bdff-713e20b4dc22	50.00	"[]"	\N	t	2025-10-09 17:03:47.268	2025-10-09 17:03:47.268
a9c728c9-be1d-463e-a03e-008add9f0a71	TIAGO BERTICELLI	b6df536b-84f5-468f-9fc5-330d61ebd906	240.00	"[]"	\N	t	2025-10-09 17:03:47.448	2025-10-09 17:03:47.448
d43f7c22-50c0-4ee8-bcc3-097d1fe26af8	CLOVIS VALDECIR DOTTA	b6df536b-84f5-468f-9fc5-330d61ebd906	340.00	"[]"	\N	t	2025-10-09 17:03:47.624	2025-10-09 17:03:47.624
8b26be9a-bde5-4aa4-a80a-596248f9b97e	ANTONIO TOMAZ	dc40ca27-1ebd-40c0-9fd4-9295eb9206b1	315.00	"[]"	\N	t	2025-10-09 17:03:47.863	2025-10-09 17:03:47.863
46d1b93c-bc85-4641-bf38-348c83a8b7f5	ADEMAR ROVEDDER	b6df536b-84f5-468f-9fc5-330d61ebd906	415.00	"[]"	\N	t	2025-10-09 17:03:48.036	2025-10-09 17:03:48.036
8f812ac4-ca67-4b17-a42d-3b24671f7f2b	ANDERSON FIORELO MELLA	532c538f-5a28-4478-bdff-713e20b4dc22	500.00	"[]"	\N	t	2025-10-09 17:03:48.215	2025-10-09 17:03:48.215
f3934aed-32bc-4460-b591-b484c9b8a353	VALDOMIRO FERREIRA	532c538f-5a28-4478-bdff-713e20b4dc22	500.00	"[]"	\N	t	2025-10-09 17:03:48.395	2025-10-09 17:03:48.395
2e2e8e1b-870a-497e-9dab-9a53427ad144	ALEXANDRO RICARDO BARAZETTI	976a3b5a-51b7-482d-8e03-5b1b11aff74b	950.00	"[]"	\N	t	2025-10-09 17:03:48.628	2025-10-09 17:03:48.628
d9b765db-998e-436f-bbc4-a5a62f3d93b9	ELCO BARAZETTI	976a3b5a-51b7-482d-8e03-5b1b11aff74b	600.00	"[]"	\N	t	2025-10-09 17:03:48.805	2025-10-09 17:03:48.805
ff47c4ab-ce50-48e6-be67-1f9fa18c4cd8	MARCOS ANTONIO BARAZETTI	976a3b5a-51b7-482d-8e03-5b1b11aff74b	200.00	"[]"	\N	t	2025-10-09 17:03:48.981	2025-10-09 17:03:48.981
1b0a4f71-0a18-4a85-95ec-7ce4296515d2	ESTANCIA JN SOCIEDAD ANONIMA	976a3b5a-51b7-482d-8e03-5b1b11aff74b	850.00	"[]"	\N	t	2025-10-09 17:03:49.156	2025-10-09 17:03:49.156
08ec611d-8e67-4a04-b1ea-367c0d9aeaf4	EVANDRO CARLOS SALVADEGO FRIGO	b6df536b-84f5-468f-9fc5-330d61ebd906	435.00	"[]"	\N	t	2025-10-09 17:03:49.34	2025-10-09 17:03:49.34
1d6ca9b1-f8ee-4c52-b581-4c2263182152	HERMES MARCELO SALVADEGO FRIGO	b6df536b-84f5-468f-9fc5-330d61ebd906	435.00	"[]"	\N	t	2025-10-09 17:03:49.515	2025-10-09 17:03:49.515
e5bba2c7-5c14-480f-835a-b18208df58c1	DINO FRASON	dfa12d63-bb3e-40d7-98bb-5084195beb1a	880.00	"[]"	\N	t	2025-10-09 17:03:49.747	2025-10-09 17:03:49.747
8d506138-57ae-4cbf-afd3-c3d624bde3cb	LUCIENE MARIA ROSSETT PUGAS	976a3b5a-51b7-482d-8e03-5b1b11aff74b	500.00	"[]"	\N	t	2025-10-09 17:03:50.109	2025-10-09 17:03:50.109
6e383453-ab0d-4c4b-ae26-9818b932a7b9	ANDERSON RODRIGUES PUGAS	976a3b5a-51b7-482d-8e03-5b1b11aff74b	500.00	"[]"	\N	t	2025-10-09 17:03:50.285	2025-10-09 17:03:50.285
9914c9de-1f52-467d-8fa6-45dd7eab00f9	LR AGROPECUARIA	a65a9cec-689e-49e2-b630-3e59ef61e0a3	900.00	"[]"	\N	t	2025-10-09 17:03:50.758	2025-10-09 17:03:50.758
22227844-7ed8-4ba0-8daf-2b2f9b068ccb	RAUBER S.A	dc40ca27-1ebd-40c0-9fd4-9295eb9206b1	2500.00	"[]"	\N	t	2025-10-09 17:03:51.112	2025-10-09 17:03:51.112
61583f00-d485-4ea9-9076-f6c7a7dd0432	CESAR MASCARELLO	dfa12d63-bb3e-40d7-98bb-5084195beb1a	2500.00	"[]"	\N	t	2025-10-09 17:03:51.465	2025-10-09 17:03:51.465
dde9e4ee-0415-4ede-9781-5714f9a2a9df	MEGA AGROGANADERA S.A	60de64d6-3e99-4c11-87e1-3058b00f6b60	5000.00	"[]"	\N	t	2025-10-09 17:03:51.937	2025-10-09 17:03:51.937
3c0a703f-6d6a-4706-ba62-b0279065156c	WENDLING SOCIEDAD ANONIMA	976a3b5a-51b7-482d-8e03-5b1b11aff74b	7000.00	"[]"	\N	t	2025-10-09 17:03:52.343	2025-10-09 17:03:52.343
7d88ddd3-6ed2-4bbf-8a01-975320e1230f	EDNILDO ROBINSON PIRES PIRES	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:28.049	2025-10-09 17:09:28.049
219a1e17-cf55-4a08-bd4b-a65fd9430276	JOSEPH RAY BEIDLER	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:37.245	2025-10-09 17:09:37.245
591b0dfc-8187-4550-8126-d6c96fa04c90	JOSE DEL ROSARIO ORUE OVELAR	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:42.899	2025-10-09 17:09:42.899
2c5bc14e-8770-4844-853f-8685ec67d9c4	CLAUDINEI BONOTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:14.051	2025-10-31 22:13:14.051
29e12781-642c-4bbe-8524-302a9d50e13e	CELSO MIOTTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:16.435	2025-10-31 22:13:16.435
aa573d3b-10cb-411f-980c-03b506a7522c	ALMIRO ROGELIO DALLABRIDA BLASIUS	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:19.455	2025-10-31 22:13:19.455
c11c77c0-bbe1-4ad1-bae4-4a7ccf057891	CELSO PAPA CAPARROZ	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:23.65	2025-10-31 22:13:23.65
e7453d41-cffc-4cfa-9473-2b39cd8f576b	WILSON BOTTINI	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:24.467	2025-10-31 22:13:24.467
98ac24c5-4d90-4cda-b8e0-cc0f7171663c	RODOLFO KOEHLER DELVALLE	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:25.898	2025-10-31 22:13:25.898
9d39c4a2-0bd3-430f-96e5-11b356163c17	CRISTIANO RAFAEL WENDLING	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:28.792	2025-10-31 22:13:28.792
4a87bf8b-b424-434d-9b53-1e71a109a844	PRODUMAX PARAGUAY S.R.L.	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:29.559	2025-10-31 22:13:29.559
5b1c6fd0-04a3-4c35-ab1a-062b381ee09e	RUI DA ROS	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:30.68	2025-10-31 22:13:30.68
a94ced72-43ad-4b56-a56b-957124958f59	WALDIR SCHMITT	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:31.449	2025-10-31 22:13:31.449
75496311-b4bc-4409-825c-f2bf1e9cb2c2	DOUGLAS SCHMITT DA SILVA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:32.185	2025-10-31 22:13:32.185
7b088aba-4c03-407d-9154-d17b0dfaafb9	BILLIG SOCIEDAD ANONIMA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:34.124	2025-10-31 22:13:34.124
4cc1e75f-3426-4a30-92d2-2fca20e50d9a	LR AGROPECUARIA SOCIEDAD ANONIMA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:38.181	2025-10-31 22:13:38.181
ebd593d7-591f-44ea-854d-f1cc548fc7c7	CLODOALDO FAVARIN DE OLIVEIRA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:39.784	2025-10-31 22:13:39.784
290116d5-94d5-426b-a848-6ae17a6ffdc5	KLEBER MATEUS SCHUH VILANOVA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:41.043	2025-10-31 22:13:41.043
cd422fa4-9626-4902-8c07-730b68f06f5c	JOELMIR MERTIN KOPSCH	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:42.682	2025-10-31 22:13:42.682
ef0d062e-c3be-40dc-b775-96b5c05e7eef	CLAUDIONOR BONOTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:49.573	2025-10-31 22:13:49.573
06b4238d-3cb9-4839-8056-a60668502c4b	TERCIO CHIODINI	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:52.14	2025-10-31 22:13:52.14
bd4be738-180e-478b-9928-6cb3d0cbde62	ESTANCIA DECONTO EAS	5ad733c9-5c42-4751-828b-043f0a2a337b	1250.00	"[]"	\N	t	2025-10-09 17:03:50.521	2025-10-09 17:03:50.521
92ef9f65-df02-49cd-b543-26250f5511b4	ESTANCIA JS SOCIEDAD ANONIMA	976a3b5a-51b7-482d-8e03-5b1b11aff74b	600.00	"[]"	\N	t	2025-10-09 17:03:50.935	2025-10-09 17:03:50.935
fe23eaae-a039-4ada-9194-12997726041c	LA VERONICA S.A	5ad733c9-5c42-4751-828b-043f0a2a337b	2500.00	"[]"	\N	t	2025-10-09 17:03:51.289	2025-10-09 17:03:51.289
5ec1a5d0-b1d6-418c-af36-dfd3e5706164	ITA-KYSE SOCIEDAD ANONIMA	0cebe7b8-2a66-4ea0-ac52-0745b424df63	3000.00	"[]"	\N	t	2025-10-09 17:03:51.702	2025-10-09 17:03:51.702
3f8d6666-a6bb-4583-9ca6-bda8eb3ae3df	ESTANCIA LAGUNITA S.A	8c693432-ac42-4ff5-a272-5b187ca9b958	5000.00	"[]"	\N	t	2025-10-09 17:03:52.169	2025-10-09 17:03:52.169
f11d5661-b3d7-4093-ace6-015ab9bb4222	DINO FRASSON	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:25.8	2025-10-09 17:09:25.8
feee2516-c1e8-426e-91cf-9ef8a8224efd	LA VERONICA S.A INMOBILIARIA GANADERA E INDUSTRIAL	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:33.211	2025-10-09 17:09:33.211
2bbf641e-0aa6-4801-a07d-73d19fa7ea6e	EDSON BURALI PIMENTEL	reg-alto-parana	\N	"[]"	\N	t	2025-10-09 17:09:39.952	2025-10-09 17:09:39.952
8357e1af-5372-40ae-af34-6c971ac323be	teste	reg-itapua	200.00	"[]"	\N	t	2025-10-30 14:31:35.833	2025-10-30 14:31:35.833
500d5f66-a942-4054-b7d8-4aa36e656dec	SANTIAGO DOTTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:16.069	2025-10-31 22:13:16.069
dc1ddd61-403d-47f4-9080-116e3b57a75d	ELIANE MARGARET MARIANI KLEIN	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:17.228	2025-10-31 22:13:17.228
62db5de7-1cf8-4442-b12c-9206de28e509	EDILSON FRANZ	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:21.283	2025-10-31 22:13:21.283
62b6144a-d3dc-4818-8d81-24ffc62d42a9	JOSE LUIZ MIOTTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:24.088	2025-10-31 22:13:24.088
0509b1d7-3b14-4c29-8238-0452cc29fb7a	LEONI JOAO WERNER	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:25.002	2025-10-31 22:13:25.002
7f5bc889-a394-4e82-a7a5-c7aa4aee3eeb	RAFAELI SRL IMPORTADORA Y EXPORTADORA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:28.386	2025-10-31 22:13:28.386
e22f3c2e-c367-4036-9dd3-09cb4c1264b0	ILVO SPIELMANN	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:29.178	2025-10-31 22:13:29.178
1fb50763-d0e5-415d-b318-c2cd660a1bf2	COOP.MULT.SERV.PROD.CONS. DURANGO LIMITADA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:30.262	2025-10-31 22:13:30.262
e93cf575-bcf1-4541-9591-e7b3802ff748	REGINALDO DE OLIVEIRA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:31.063	2025-10-31 22:13:31.063
2e870ba8-c8c2-43d0-8d9f-1794028fd1dd	CLEDIR SCHMITT	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:31.818	2025-10-31 22:13:31.818
99ed2097-5ee7-464c-913d-14c3f1c118f1	BRUNO FRANCISCO STEFFENS	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:32.547	2025-10-31 22:13:32.547
6a116067-ec74-44f5-9705-59e429dbe725	PAULO JOSE KUHN	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:36.375	2025-10-31 22:13:36.375
b0397c8f-ac4b-47cb-835b-0a51530aec8c	INES APARECIDA ZANETTE FREGNANI	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:39.403	2025-10-31 22:13:39.403
42720220-6fb3-402b-9414-f1f14fe7c95e	PAULO HENRIQUE MAXIMIANO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:40.153	2025-10-31 22:13:40.153
6e50170e-d281-4c22-b718-aadf2a657c89	FRANCISCO ARAUJO DA SILVA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:41.641	2025-10-31 22:13:41.641
cc6a205a-1889-4bf1-b533-20006f8dc027	ISMAEL SCHNEIDER FREY	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:45.42	2025-10-31 22:13:45.42
1aeb69a4-2c3b-4fb5-9381-f2d81d769f8b	ANTONIO DAROLT PEREIRA	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:50.508	2025-10-31 22:13:50.508
ef264a78-d770-4eec-b41b-0b365a81f5a2	ANDERSON DANIEL PEREIRA DREON	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:57.227	2025-10-31 22:13:57.227
f10180e2-fe57-4c45-8e25-f336200199e9	BELMIRO WAGNER	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:13:58.733	2025-10-31 22:13:58.733
20dbd21a-7e9e-44b9-bbd9-e119e2990d66	ERALDO SCHMIDT	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:04.14	2025-10-31 22:14:04.14
a1f4a473-3ec0-4f3c-b2f8-a9af6921a176	WALDEMIR PIEREZAN	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:07.253	2025-10-31 22:14:07.253
c1f858de-c4c4-4074-a466-e1511dc34ed4	HARDI ALOISIO KAEFER	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:07.863	2025-10-31 22:14:07.863
690ccc50-bc1e-47b9-bbe6-1fc5b296a948	VANESSA MARIA RAMIREZ MELATO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:12.394	2025-10-31 22:14:12.394
8d2f422a-7e8b-4ad8-98bf-80c2caad475c	ISAC NICOLAEV	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:14.797	2025-10-31 22:14:14.797
0da38b80-1751-46ee-8877-d5b4c0604c03	AGRO ALIANZA CORPUS CHRISTI S.A	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:20.133	2025-10-31 22:14:20.133
a5121f07-17c7-4abf-9cde-c86acf739672	ROELOF POHL	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:23.403	2025-10-31 22:14:23.403
38d22a8f-c278-45b7-833d-85e68241a19e	GILDO MIOTTO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:25.146	2025-10-31 22:14:25.146
092a8c82-fbd4-4400-bf87-1d5b11c00fe8	LUIS CARLOS CANDIDO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:30.815	2025-10-31 22:14:30.815
5977a22d-0298-4ef1-94d2-ab90357384b7	ANOR ZANCHETTE	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:14:34.306	2025-10-31 22:14:34.306
076b2ebb-e9bc-439e-9bc8-6e62bf514af0	BRAULIO ROBERTO PEGORARO VALESTRO	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:15:07.579	2025-10-31 22:15:07.579
b4f36373-2070-4389-b67b-9f7d133ff132	IRINEU SCHUSTER	reg-alto-parana	\N	"[]"	\N	t	2025-10-31 22:15:23.478	2025-10-31 22:15:23.478
77e7d5c1-9e6e-4e61-85e6-f521b9ec35d0	ALLEGRETTI S.A	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:10.667352	2026-01-23 00:38:10.667352
1740d88c-57bd-47bb-a8df-65f7c0818d73	ASSIOLI PEDRO CORAL	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:10.688625	2026-01-23 00:38:10.688625
3e041772-417b-4969-b200-702725a20416	DELCIO LAURO SCHMIDT	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:10.848172	2026-01-23 00:38:10.848172
6c0c18c9-aab5-4d64-b3e1-f1f3f6a44a99	AGROGANADERA PERES SA	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:11.315366	2026-01-23 00:38:11.315366
b8114c13-569e-4564-9acf-5c48fc39f691	WILTON ALMIR FICAGNA	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:11.471598	2026-01-23 00:38:11.471598
47d11a17-7c17-4e8f-bb39-dc05544f2f4e	MAIKEL DIEGO KAEFER	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:11.633031	2026-01-23 00:38:11.633031
44b01b4d-eb6f-48bd-8e2f-2bbb158e240e	RENATO ALBERTO ALLEGRETTI	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:11.717436	2026-01-23 00:38:11.717436
4b5dc72c-e47e-48a7-9588-3bcd40ff66fa	IMAPO S.R.L	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:38:11.986172	2026-01-23 00:38:11.986172
a7c1a77b-eae4-4326-bbf0-01f25aa15f7c	EDER JOSE MARIANI	9c738932-9b21-4e5f-87d5-072c744d61d0	\N	[]	\N	t	2026-01-23 00:39:10.660004	2026-01-23 00:39:10.660004
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, created_at, used_at) FROM stdin;
\.


--
-- Data for Name: pending_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_orders (id, product_code, product_name, package_type, quantity_pending, client_name, consultor_name, order_code, uploaded_by, upload_session_id, created_at) FROM stdin;
\.


--
-- Data for Name: planning_global_configurations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.planning_global_configurations (id, user_id, season_id, product_ids, updated_at) FROM stdin;
562b511e-2731-468b-bf8f-4b6221fac843	d0187ffd-ee55-4a37-bd77-c16404f484ab	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	[]	2026-01-26 02:11:52.41
\.


--
-- Data for Name: planning_products_base; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.planning_products_base (id, name, segment, dose_per_ha, price, unit, season_id, created_at, package_size) FROM stdin;
6f0f5fab-4842-41f7-8c11-1f5da979acec	ALSYSTIN 480SC - TRIFLUMURON 48% - 1L	Inseticida	0.050	30.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.270141	\N
71c3e4b8-11eb-409f-90f9-fe887a5f060e	APROACH POWER - PICOX. 9% + CIPRO 4% - 5LTS	Fungicida	0.800	24.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.301718	\N
343ffa4c-a4ad-4d61-9126-6c816ee57c06	ARVIS - 5 LTS	Inseticida	0.400	23.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.324295	\N
679f2713-5dcd-49ee-887d-22ba9816ab9c	BENZOATO 10% + LLUFENURON 40% - 1KG	Inseticida	0.025	31.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.36032	\N
3a7fd541-f32a-4047-8171-5763d6f6ee34	BIFENTRIN 25 + ETIPROLE 35 - 5 LTS	Inseticida	0.300	36.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.379949	\N
e65f8c6c-afdf-4bfa-95b8-65dfb4ac41d3	BIFENTRIN 40% - 5LTS	INSETICIDAS	0.120	13.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.398425	\N
50ff0d0d-d163-435a-8b5d-2cfb1b9c06bf	CLETODIN 24% - 20LTS	DESSECAÇÃO	0.750	7.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.428589	\N
8c150dba-6003-4745-bc7c-ec8337edaf4e	CLOMAZONE 48% - 20LTS	DESSECAÇÃO	1.000	7.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.445421	\N
f83eb856-5fba-4268-991b-dfa69085dce2	CLORANTRANILIPROL 80 % 1 KG	Inseticida	0.025	60.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.457958	\N
f33ff305-d1e1-427b-a626-7705744dff6e	CLOROTALONIL 72% - 20LTS	FUNGICIDAS	1.000	6.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.479214	\N
4500be07-a59c-493b-a900-5f561538974a	CRIPTON SUPRA SC360 - 5LTS	FUNGICIDAS	0.500	78.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.497783	\N
8a1cba06-37ec-4460-8d4f-7fbcbcca1884	CRIPTON ULTRA - 5 LTS	FUNGICIDAS	0.400	68.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.512173	\N
25c3f8ef-123d-4c21-8d3a-2a4f79bf6353	CRIPTON XPRO - PROTHIO. 17,5% + TRIFLOX. 15% + BIX	Fungicida	0.200	56.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.526871	\N
64fb2282-d2ef-43ab-be5b-0c2c137d1133	DICAMBA 70% WG - 2,5KG	Herbicida	0.650	20.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.542274	\N
fdec558b-02f4-432d-a892-0703cb92dc73	DICLOSULAN 84% - 500G	Herbicida	0.015	130.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.570031	\N
a93d863d-9f16-4845-aa51-67519aafb53e	EXALT - 1 LT	INSETICIDAS	0.100	140.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.589873	\N
133e7ad8-ed5c-4188-b804-a0faa6855ba3	FIPRONIL 25% - 5LTS	Inseticida (tratamento de sementes)	0.075	25.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.605921	\N
6f615fb3-921a-416f-af96-cfc48f5bc66f	FIPRONIL 80- 1 KG.	Inseticida (tratamento de sementes)	0.075	100.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.62701	\N
12f283a4-f62a-4c80-9585-780ea37c60dc	FLUMIOXAZIN 50% - 5LTS	Herbicida	0.020	20.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.640848	\N
9f339530-862a-402a-aa86-dda3be053671	FOMESAFEN 25% - 5LTS	Dessecação	0.900	7.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.657678	\N
a50499c8-70f3-4471-a09b-98f4840ac1bf	GLIFOSATO 60,8% - 20LTS	DESSECAÇÃO	2.750	4.40	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.670093	\N
b6abdce4-57c9-4ade-909e-2e13469cf1c3	GLUFOSINATO 40% TAMPA - 20LTS	DESSECAÇÃO	2.000	6.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.700718	\N
e2aeb4c4-94c0-4936-8714-7acbee23a2a9	IMIDACLOPRID 60% - 5 L	Inseticida (tratamento de sementes)	0.050	14.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.711912	\N
b85a0c39-d2ef-4314-b843-050a84ef79a1	INTREPID - 5 LTS	INSETICIDAS	0.200	25.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.725212	\N
d06eea4f-ebd3-48f5-80e7-acb495b2c6db	LOYER - LAMBDA 20 + DINOTE 20 - 5LTS	Inseticida	0.100	16.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.755975	\N
1eff7ad9-f49d-4773-a8f6-467d24c46fe1	LUFENURON 5% - 5LTS	Inseticida	0.040	9.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.775226	\N
e73aa529-80b5-46fe-9777-ee383a47c850	MANCOZEB 75% WG - 15KG	Fungicida	2.250	5.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.789755	\N
ce659384-1622-45b6-9a70-1b5a129163cc	METHOMYL SP - 1KG	Inseticida	1.150	12.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.801442	\N
652d70ae-b0a5-4aad-b7b9-7c1cccda74c0	NATIVO - TEBUCO. 20% + TRIFLOXIS. 10% - 5LTS	Fungicida	0.200	19.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.814608	\N
1ce2740c-6b61-4292-a035-9555eeb99c4e	PARAQUAT 24% - 20LTS	DESSECAÇÃO	2.750	2.80	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.833665	\N
8b7940dc-af3a-4eb2-ae2d-227a3a77b8a3	PIXXARO - FLUROXYPYR 34,91% + HALAUXYFEN 1,64% - 5	Herbicida	0.400	54.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.845289	\N
3f882fe8-739f-4cd9-9147-79f643e64107	PROTHIOC. 17,5% + TRIFLOXIS. 15% - 5LTS	Fungicida	0.100	16.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.861389	\N
00f3d832-3d67-4ea6-a94b-bd261a5b4218	PROTHIOC. 17,5% + TRIFLOXIS. 15% BIXAFEN 12,5% - 5LTS	Fungicida	0.300	32.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.871929	\N
d24fc05b-b53e-4829-a690-4bf3d783c9c2	SAFLUFENACIL - 350G	Herbicida	0.018	170.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.902108	\N
b14fdcfd-72d2-44ce-9c72-f0604d1660da	S-METOLACLORO 96% - 20LTS	Herbicida	1.000	8.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.912122	\N
fa50ba22-8337-4aae-8f39-08cfc3fbcade	SOLOMON - IMIDACLOPRID 21% + BETA CYFLUTRINA 9% -	Inseticida	0.025	32.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.92803	\N
ae1b45fb-4be6-4ef4-9d34-d4390fa43861	SPHERE MAX SC - TRIFLOXIS. 37,5% + CIPROCON. 16% -	Fungicida	0.075	58.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.938825	\N
f2954f80-4160-468b-a393-ee49f0d72113	STICKER OIL 20 LTS	Especialidades	0.500	3.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.949125	\N
90b39edf-6bbc-496c-afc6-7c53b59abd79	SULFENTRAZONE 75% - 5KGS	Herbicida	0.200	24.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.963969	\N
4dd9997b-305c-4ba5-8258-a20c3a4e2530	SUNATO - IMIDACLOPRID 18% + FIPRONIL36%-1L	Inseticida	0.040	55.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.978785	\N
9ce71a5a-39ad-4398-b8ca-241cefaba7e1	TEBU 20% + DIFENO 20% - 5LTS	Fungicida	0.500	8.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.990879	\N
9391aa58-2a62-46eb-8b4a-03bb84af30b4	ABAMECTINA 8,4% - 1L	INSETICIDAS	0.060	20.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.212177	\N
61b0e99d-9904-4598-9b12-182ae1ce4d4c	ACEFATO 97% DF - 5KG	Inseticida	0.700	8.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.226024	\N
c437be41-422c-48d0-bec8-b677f6130418	ACETAMIPRID 70% - 1KG	Inseticida	0.150	15.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.252068	\N
6bceb9cf-a9f7-4a27-bad5-74763d931884	TEBUCONAZOLE 43% - 5L	Fungicida	0.100	8.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.008813	\N
2c5c9470-d3d5-4650-9f26-ed0a8021f82a	TERBUTILAZINA 90% - 10 KG	Herbicida (não recomendado para soja)	1.750	7.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.046987	\N
c02ca5f4-2fe8-494f-902f-c052873835aa	TOXATRIN - THIAMETOXAN 30 + BIFEN 20 - 5LTS	Inseticida	0.400	13.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.08623	\N
566d13f3-ebc3-4c6c-a4d6-ef90c82b2143	VERDICT ULTRA 5L	DESSECAÇÃO	0.750	65.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.117158	\N
a79a8b68-3e68-4505-a368-f7fdd72c98ba	VICROYA - 5 LTS	Fungicida	0.600	0.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.145752	\N
c700b7cc-0e50-4013-8efc-565e543b237f	2,4D AMINA 72% - 20LTS	DESSECAÇÃO	1.500	3.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.182334	\N
2868179a-3336-4244-a92d-50460304e188	ATRAZINA 90% - 10 KG	Herbicida (não recomendado para soja)	0.000	6.60	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.342901	\N
ac1141f9-3c6b-428d-a67b-e70b895ace0b	GLIFOSATO 75% SG - 15KG	Herbicida (Dessecação)	3.000	6.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.687402	\N
b7ed0c62-6a68-4161-9033-b21b69ec9ccc	RIZOIL M - ACEITE METILADA - 10LTS	Aditivo (óleo metilado)	0.125	5.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:28.884392	\N
5e54ce83-950f-4572-b334-522a352858d2	TEFLUBEZUROM 30% - 1L	Inseticida	0.030	28.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.031819	\N
5e0a91e9-4b1e-4ffe-b8bf-cfab83e3a1f9	TEXARO - HALAUXIFEN 11.5% + DICLOS. 58% - 860GR	Herbicida	0.175	400.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.071292	\N
d5fde5db-8080-4c9c-a04a-5c473de84dcc	TRICLOPYR 48% - 20LT	Dessecação	1.500	8.50	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.099051	\N
cb1748c2-4140-4010-a26b-4591c976a725	VESSARYA - 6L	FUNGICIDAS	0.600	35.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.13544	\N
a3558140-55a8-47f3-9be5-8bc325780365	VIOVAN - 5L	FUNGICIDAS	0.600	32.00	L	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	2026-01-25 18:42:29.169399	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, category_id, subcategory_id, description, marca, package_size, segment, timac_points, is_active) FROM stdin;
0c78c4e6-4190-4665-a5c4-6ed6777ad22a	FERT 12-15-15 - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
b8dc677e-da87-4826-bbc9-20557f7d5b8a	RIZOLIQ TOP - BRADYRHIZOBIUM - 2LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	2.00	\N	0.00	t
a7d5f4d7-9d90-4604-8b29-dc2cf804ca6f	FERT TOP PHOS BALANCE - BB - 13 09 09	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
97f95490-3d3f-4fb5-aa71-6df01f3f3527	CYANTRANE 80WG 1KG	cat-agroquimicos	\N	TAMPA	TAMPA	1.00	\N	0.00	t
7f30b178-1b9b-4d0d-9b58-78ad6ee1543a	PORCELEN PLUS - BENZOATO 30 WG% - 1KG	cat-agroquimicos	\N	RAINBOW	RAINBOW	1.00	\N	0.00	t
32fb72a7-fbc0-4fe4-bc15-3222d655e845	ACRESCENT SOLUS F - NEMATICIDA - 20LTS	cat-especialidades	\N	CARBON	CARBON	20.00	\N	0.00	t
924b9063-a2dd-4bd7-9721-35a21597c54a	ACRESCENT RAIZ F - NEMATICIDA -  5LTS	cat-especialidades	\N	CARBON	CARBON	5.00	\N	0.00	t
c95cdd39-84f3-4315-8f8e-96c880d48da9	FERT PHYSALG ACTIMAX 13-09-09 - BB	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
8552703f-6803-486a-88e3-52749ae90e71	STICKER OIL 20 LTS	cat-especialidades	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
75b2fc62-f1d8-4df9-857a-b7b18cdf5f8d	RIZOSPRAY VALEMAX  - 1LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	1.00	\N	0.00	t
ea4cf8f2-2916-45d3-830e-eb94c36d9002	FERT 02-20-18 - BRFERTIL - BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	FERT 00-00-60 - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
e4111c42-14ec-47e2-8890-5b9c3f3e8023	FERT 04-30-10 + MICRO MOSAIC-  BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
440586d7-420d-4a11-9af4-21b78314eef8	FERT 00-00-60 - YARA - BB - KG	cat-fertilizantes	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	\N	\N	0.00	t
d71b7f9b-92e4-46b2-a1b0-0590b3c13660	FERT 02-20-18 MOSAIC - BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	FERT BASIDUO 135 TIMAC - BB	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
5a7c2266-28ce-41f6-be2f-95397d21d4f2	FERT SULFAMMO META 29 - TIMAC - BB - KG	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
0ec210da-3b4b-4346-a5d9-7cf28b90eb85	FERT 12-15-15 - BR FERTIL - BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
56f268e6-db73-4c5e-9a30-e928198d71cb	METYL OIL - ACEITE METILADA - 10LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	10.00	\N	0.00	t
26c7b142-88e6-4a76-bf32-c1e9ff889d3c	GESAPRIM 90 - ATRAZINA 90% WG - 10KG	cat-agroquimicos	\N	SYNGENTA PARAGUAY S.A.	SYNGENTA PARAGUAY S.A.	10.00	\N	0.00	t
c7cf53a9-7f3a-4ffa-8ee0-21a0528717a0	RASS 32 - 1L	cat-especialidades	\N	INQUIMA	INQUIMA	1.00	\N	0.00	t
0dd27eaf-2905-4593-b8b3-e3df3f46ad5a	TA35 + ZINC - ADJUVANTE - 5LTS	cat-especialidades	\N	INQUIMA	INQUIMA	5.00	\N	0.00	t
37e6e467-d925-40b2-aee5-ba4515c9c38f	RIZOIL M - ACEITE METILADA - 10LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	10.00	\N	0.00	t
135e89d3-a34c-479e-b759-e4a521d63fde	SEMILLA MAIZ DKB 360 VT3PRO - 60 MIL SEMILLAS	cat-sem-milho	\N	DEKALPAR	DEKALPAR	\N	\N	0.00	t
f843cba9-605b-461f-9830-47a59a7c1bf9	FERT 09-22-20 MOSAIC - BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
9f80b449-bbfa-41bd-92ab-e013577f5ba7	CLARTEX - METALDEIDO - 25KG	cat-agroquimicos	\N	RIZOBACTER	RIZOBACTER	25.00	\N	0.00	t
59c6b948-ace4-4671-8fe6-935b10c0b185	FERT 45-00-00 UREA - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
dfd25ecd-069d-4501-8a28-7dba3e36faa9	FERT FOST.MON.MAP GR 11-52 - MOSAIC - BB	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
47631d16-3b27-4880-af5a-7ac543919fe2	SEM. SORGO 1G100- BLS- CORTEVA	cat-sem-milho	\N	CORTEVA	CORTEVA	\N	\N	0.00	t
30eed411-63ba-4276-97ef-c99c2317387c	FERTIACTYL GRAMINEAS - 2LTS	cat-especialidades	\N	TIMAC	TIMAC	2.00	\N	3.00	t
a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	FERTIACTYL LEGUMINOSAS - 2LTS	cat-especialidades	\N	TIMAC	TIMAC	2.00	\N	3.00	t
366be9b7-51e7-41d2-98c3-02801fa01245	PROGEN DETOX - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
09e88507-4db3-4664-9e96-ffe81cb859b4	FERTILEADER 954 - VITAL - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
50e10459-8b27-4916-953f-b46636cada6a	FERTILEADER AXIS NG - 5L	cat-especialidades	\N	TIMAC	TIMAC	5.00	\N	1.00	t
4859161e-5b69-42e7-86e3-f9b6779da644	FERTIACTYL GZ - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
81581447-8003-440d-99f6-462d727b1ba1	FERTIACTYL LEGUMINOSAS - 5LTS	cat-especialidades	\N	TIMAC	TIMAC	5.00	\N	3.00	t
fe64d721-dff0-4e14-9dbe-f7b4e4c298d2	FERTILEADER GOLD BMO - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
9d25504a-802d-4d09-83ef-5e8a98018a61	CLORANTE 625 FS- 1LTS.	cat-agroquimicos	\N	TAMPA	TAMPA	1.00	\N	0.00	t
8b1b21a7-5e84-4c6f-bd88-68547f7156f0	TOXATRIN - THIAMETOXAN 30 + BIFEN 20 - 5LTS	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
13c21dc1-82d9-4a7b-89ea-8ef7ca50549f	DERMACOR - CLORANTRANILIPROLE 62,5% - 1L	cat-agroquimicos	\N	CORTEVA	CORTEVA	1.00	\N	0.00	t
c0ebf995-bf13-4507-83c1-4dd4662212bf	POLUX CLEAN - GLIFOSATO 60,8% - 20L	cat-agroquimicos	\N	CHDS	CHDS	20.00	\N	0.00	t
3158b5ad-a4f1-4e03-93c0-6492e5f0914c	CONFIRMM 84 WG - DICLOSULAN 84% - 500G	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	\N	\N	0.00	t
d91ac8fa-306c-4b9d-bbaa-edaf3d4b8223	BIFENTAM 40MAX_ (BIFENTRINA 40%)- 5 LT	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
be59ed75-9809-478c-84e8-4ff2280b8d5e	UTRISHA TM- 5KG.	cat-especialidades	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
ddc798d0-98db-4c51-ad9f-268f21a03774	FERT 08-20-10 FERTIPAR 5% CA + 8% S- BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
f0e65f8e-878b-4412-9535-a4da27184252	FERT 20-00-00 - BR FERTIL - BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
21842c4e-0c4b-4f49-afb9-1c89376568fd	PARAFUR- PARAQUAT 24%	cat-agroquimicos	\N	AGROFUTURO	AGROFUTURO	\N	\N	0.00	t
9d408d5b-d9df-4c51-9738-efd88e1f398c	FERTIACTYL GZ - 5LTS	cat-especialidades	\N	TIMAC	TIMAC	5.00	\N	1.00	t
89ae8ab9-5e2f-490d-8152-e5384bf295ae	FERTIACTYL SWEET- 10 LTS.	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
45e62da5-2272-41bf-802d-8f6d88b750ee	SEACTIV AXIS NG-10 LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
392adaa8-3853-429a-a1f3-8ff1af265208	FERT 08-20-10 - MOSAIC - BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
c9ff0590-018a-40a5-a7da-801b22b39235	EUROFIT MAX - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
c34db6db-36c5-495e-a3ef-e7b99f2b7208	TECNUP PREMIUM 2 - GLIFOSATO 60,8% - 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
68f79595-d9ba-4142-a36e-6a9d0582247c	SEACTIV VITAL 954 - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
5c499719-5efa-4656-a463-d9bda30082d3	FERT INRIZZA 490 03-26-00 TIMAC - BB	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
1c4bcfa3-8896-4a7b-a73e-d40176022714	YARA VITA FOLICARE - BLS 25KG	cat-especialidades	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	25.00	\N	0.00	t
58762fe6-7b30-4e3d-9e70-6ae895944671	CRONNOS - PICOX. + TEBU. + MACONZ. - 20LTS	cat-fertilizantes	\N	ADAMA	ADAMA	20.00	\N	0.00	t
ff4564d0-df57-4bc3-9f61-6d691b3dd3bf	U10 - INQUIMA - 1 L	cat-especialidades	\N	INQUIMA	INQUIMA	1.00	\N	0.00	t
1d83ca6a-a994-4bc9-81a7-fc121ba58394	FERT 00-00-60 - MOSAIC - BB	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	RANCONA - IPCONAZOLE 2,5% + METALAXIL 2% - 1L	cat-agroquimicos	\N	CORTEVA	CORTEVA	1.00	\N	0.00	t
d563beae-6141-4015-9cbe-b3453615146b	LOYER - DIFENOTEFURAN 20%  LAMBDACIA. 20% - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
1996648d-0411-4cd4-a022-5f25cebfed07	HUSSAR EVOLUTION EC 96 - 5 LTS	cat-agroquimicos	\N	BAYER	BAYER	5.00	\N	0.00	t
cdd5c40f-54f7-4e58-9118-85d4ca7678fc	TECNUP SG- GLIFOSATO 75%- 15KG	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	15.00	\N	0.00	t
cac7eb90-2489-4abd-87df-88b5eb91fa0a	GRAN MURALLA - METSULFUROM 60% - 0,5KG	cat-agroquimicos	\N	AGROPLUS	AGROPLUS	5.00	\N	0.00	t
67a734ca-f12c-416c-a3f8-4f7434db90f3	FERT TOP PHOS BASE - TIMAC - BB	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
b3e48baa-c384-4414-a421-8af3a430ea2d	FERT 20-00-00 - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
bfe773b8-b217-4103-90c9-9a57a5146e1c	GRASIDIM - CLETONDIM 24% - 5 LTS	cat-agroquimicos	\N	RAINBOW	RAINBOW	5.00	\N	0.00	t
367d0e74-d0b0-4318-9e55-622f4455fcca	ABAMEC - ABAMECTINA 8,4% - 1L	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	1.00	\N	0.00	t
3b3fa437-92c1-4423-acde-927cbfe519c1	SOYGUARD 30 - TEFLUBEZUROM 30% - 5LT.	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
b50d90e9-2757-4b16-9b07-4a15b8cf7794	SEMILLA DE MAIZ AG 8701 PRO4- BLS.	cat-sem-milho	\N	TECNOMYL	TECNOMYL	\N	\N	0.00	t
53844242-406c-46ef-9d69-91a26466190c	TECNOQUAT - PARAQUAT 24% - 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
90aba970-124d-4cc8-9039-5e77ae5a74e4	PIXXARO - FLUROXYPYR 34,91% + HALAUXYFEN 1,64%-5L	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
ab387b26-c9e7-47da-9870-e869fe1d1581	FERT PFALM 05-25-25 - MOSAIC - BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
587d814a-61fc-4bcd-9f49-d7f0a96174a6	APROACH PRIMA - 5LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
e0195b3f-ce67-4e2c-93dd-450db4cb864f	MERCOBLOC STANDARD -  25KG.	6704c025-303a-404a-b9a4-706c4a7358c8	\N	TIMAC	TIMAC	25.00	\N	0.00	t
744fbf89-39e5-4628-99ca-a188bc3540b3	SEM. SORGO 1G100- BLS- CORTEVA	cat-sem-diversas	\N	CORTEVA	CORTEVA	\N	\N	0.00	t
6eb21282-9882-4a66-88b4-542e3a938d29	BESULAR - 5LTS	cat-agroquimicos	\N	RAINBOW	RAINBOW	5.00	\N	0.00	t
b46b8044-9571-4484-9037-762799f02d5e	FERTIACTYL SWEET- 10 LTS.	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
8274a979-5d13-4535-97ae-8fe8a7baaf9e	DIGROP- DIQUAT 20% - 20LTS	cat-agroquimicos	\N	CIAGROPA	CIAGROPA	20.00	\N	0.00	t
893e0dbb-0e64-4ebc-ba39-79d72ed6faf7	THIAMEX PLANT - THIAMETOXAM - 1KG	cat-agroquimicos	\N	CHDS	CHDS	1.00	inseticida	0.00	t
3b17fa90-f1a1-4c37-b811-1e75a808e175	SPHERE MAX SC - TRIFLOXIS. 37,5% + CIPROCON. 16% -	cat-agroquimicos	\N	BAYER	BAYER	\N	fungicida	0.00	t
08527738-99af-4f17-9908-18bfe3f78861	RITIRAM CARB PLUS- 1L	cat-agroquimicos	\N	RIZOBACTER	RIZOBACTER	1.00	outros	0.00	t
ae3cd83f-31db-4ef6-9acd-7ff457725e90	FUSIL - FOMESAFEN 25% - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
62edd198-b767-4100-afd9-afadf0efa5da	VIOVAN- PICOXISTROBINA+ PROTIO- 10LT.	cat-agroquimicos	\N	CORTEVA	CORTEVA	10.00	\N	0.00	t
ee6b528f-6297-4aef-b2bf-78f4f50b5d17	PERITO ULTRA WG- ACEFATO 85%+ BIFEN 3%- 10KG.	cat-agroquimicos	\N	UPL	UPL	10.00	\N	0.00	t
15e3d29c-1e7e-45cc-829c-3b3c10ffe433	SUNATO - IMIDACLOPRID 36% + FIPRONIL18 %-1L	cat-agroquimicos	\N	BAYER	BAYER	1.00	\N	0.00	t
ab0563ee-2893-49e8-9b90-2647b1c51493	MURALLA - MANCOZEB 75% WG - 25 KG	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	25.00	\N	0.00	t
b686b85c-099a-4f6e-b27d-25cff7d1c67b	VIBRANCE MAX- 1L	cat-agroquimicos	\N	SYNGENTA PARAGUAY S.A.	SYNGENTA PARAGUAY S.A.	1.00	\N	0.00	t
5caa37ec-8450-48e2-a033-9a81ec9db4f5	TRICLOTAM- TRICLOPYR 48%- 20LT	cat-agroquimicos	\N	TAMPA	TAMPA	20.00	\N	0.00	t
0f1e6647-4e42-4b7b-b8a6-9ce17e9826ff	HURACAN 25 FS - FIPRONIL 25% - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
f14373fe-e339-4754-bfd0-0f74d5133ac5	FERT 11-52-00 - MAP - BRFERTIL BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
b95129bd-92dd-4580-80da-da1ce98fe4a0	TORBEN -TERBUTILAZINA 90% WG -10KG	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	10.00	outros	0.00	t
be6f0488-221f-4066-9609-9040322929c2	VESPER FIT WDG - 10% BENZOATO 40% LUFENURON - 1KG	6704c025-303a-404a-b9a4-706c4a7358c8	\N	\N	\N	\N	\N	0.00	t
94a9833c-7187-46a1-a9e8-0b1d78f35ad2	SNIPER - BIFENTRIN 40% - 5LTS	6704c025-303a-404a-b9a4-706c4a7358c8	\N	\N	\N	\N	\N	0.00	t
238b824b-8d61-4504-8103-d3246e94560c	DINOBIN - DINOTEFURAN 20% + BIFENTRIN 15% - 5LTS	6704c025-303a-404a-b9a4-706c4a7358c8	\N	\N	\N	\N	\N	0.00	t
8f54b10f-37fe-4b23-9193-2e0b9d841705	ACRESCENT RAIZ F - NEMATICIDA - 1L	cat-agroquimicos	\N	\N	\N	\N	outros	0.00	t
4a556efc-c08e-41ad-b924-f1ebd57cfee5	SEM. SOJA M6130 I2X - 125MIL SEM.- BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
3de5c394-7045-4429-b843-bd5d082c4891	ALSYSTIN 480SC - TRIFLUMURON 48% - 1L	cat-agroquimicos	\N	BAYER	BAYER	1.00	\N	0.00	t
69a854f3-573d-4ab7-90d5-7b3d7b793e1f	FIPRONIL NORTOX MAX- FIPRONIL 50%- 5LTS.	cat-agroquimicos	\N	NORTOX	NORTOX	5.00	\N	0.00	t
91ee0bc0-e9c8-49ca-928e-ef69cdf01269	MIND 900 - METOMIL 90% - 1KG	cat-agroquimicos	\N	IASA	IASA	1.00	\N	0.00	t
67660da4-6c7a-433a-a5f6-cee50e85c4ba	SEMILLA DE MAIZ AG8606 PRO4	cat-sem-milho	\N	TECNOMYL	TECNOMYL	\N	\N	0.00	t
68169cfb-4ad8-457c-8851-2ae04f2ad409	FERT SULFAMMO META S - TIMAC - BB - KG	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
87d1684a-8569-48f3-a433-18ecc72b12f7	FERT 15-15-15 - BR FERTIL - BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
94fef025-4f91-4f40-b521-e8e44e5a0676	ACTIVMAN - FOSFITO MANGANES - 5LTS	cat-especialidades	\N	AGRICHEM	AGRICHEM	5.00	\N	0.00	t
8adb91b8-973e-424b-b79a-7b498af0a840	RIZOSPRAY EXTREMO - 5 LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	5.00	\N	0.00	t
14366256-3dfd-42fe-8806-0f08cfae9106	FERT 20-00-20 FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
7a433be0-dbd4-4ce0-b4e8-cde2c4366793	FERT 02-20-20 - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
4341413f-cc3e-41c2-b70f-c93ff5fdd521	FASCINATE 40 SL- GLUFOSINATO - 20LTS	cat-agroquimicos	\N	UPL	UPL	20.00	\N	0.00	t
31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	TEBUDIFEN 40 - DIFENO 20%+ TEBUCONAZOLE 20%- 5L.	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
31da263e-8dc8-470e-823e-a98664693df6	VESSARYA - 10 LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	10.00	\N	0.00	t
c927cfdc-3199-45c4-b568-2864d57b87b7	GALIL SC- BIFENTRINA + IMIDA- 5 L	cat-agroquimicos	\N	ADAMA	ADAMA	5.00	\N	0.00	t
eb2718a5-b60a-4eba-a6d1-af1e8d087d3f	CENTURION- CLETODIM 24%- 5 LTS.	cat-agroquimicos	\N	UPL	UPL	5.00	\N	0.00	t
881fbd04-bea0-4542-86da-442e622acbf0	FERT 08-40-08 TME - YARA - BB - KG	cat-fertilizantes	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	\N	\N	0.00	t
971d36d8-a308-4156-95e7-aac5b0875e16	CRIPTON XPRO - PROTHIO. 17,5% + TRIFLOX. 15% + BIX	cat-agroquimicos	\N	BAYER	BAYER	\N	\N	0.00	t
87d3e1d2-afd2-4015-be36-a9d026e7db86	FERT TOP PHOS 280 HP - TIMAC -  BB	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
f5a5f777-ca8b-4cb4-bfdd-cddb3fb6a18b	ATIVUM - EPOX. 5% + FLUXAP. 5% + PIRA 8,1% - 5LTS	cat-agroquimicos	\N	BASF - GPSA	BASF - GPSA	5.00	\N	0.00	t
7b670399-1f79-4cd9-a542-608cac598bc4	GENESIS GRAM - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
e2c500d9-c30f-4c72-ba20-029545f1c4ee	ONLY 60 SC - THIAMETOXAN 60% - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
bf8c291a-cacd-465c-bab0-15b5b5d54841	FENTIPROL 60 SC- BIFENTRIN 25%+ ETIPROL 35%- 5LT	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
42cbc55a-b963-47ae-8666-fe631051994a	FERT 05-25-25 - FERTIPAR - BB- KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
f41d0117-fba6-4ed8-bc94-7d5a976ec4ba	CLORANTE 80 WG CLORANTRANILIPROL 80 % 1 KG	cat-agroquimicos	\N	TAMPA	TAMPA	1.00	ts	0.00	t
c012d775-30e4-4f62-ab40-5df174373798	ONLY - THIAMETOXAN 75% WG - 1KG	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	1.00	\N	0.00	t
2c57c0ac-c791-41d9-bbad-010ef0fc1f84	CRIPTON SUPRA SC360 - 5LTS	cat-agroquimicos	\N	BAYER	BAYER	5.00	\N	0.00	t
da64b040-ee6b-41e8-b0ae-0bbdfc3984ce	MERCOBLOC STANDARD -  25KG.	6704c025-303a-404a-b9a4-706c4a7358c8	\N	TIMAC	TIMAC	25.00	\N	0.00	t
b2b84ef0-b605-4115-a371-8541c0a8593d	MERCOBLOC STANDARD -  25KG.	6704c025-303a-404a-b9a4-706c4a7358c8	\N	TIMAC	TIMAC	25.00	\N	0.00	t
9f6c3d45-6185-4840-8a74-fce3e410debe	BALUART - PROTHIOC. 17,5% + TRIFLOXIS. 15% - 5LTS	cat-agroquimicos	\N	UPL	UPL	5.00	\N	0.00	t
8c18045e-556a-49ec-aa41-94db282862a9	OPTIMIZER EC765 - 5L	cat-agroquimicos	\N	BAYER	BAYER	5.00	outros	0.00	t
e4b4c186-aa6f-432d-96fa-136e30d98997	ATRANEX - ATRAZINA 90% WG - 15KGS	cat-agroquimicos	\N	ADAMA	ADAMA	15.00	herbicida	0.00	t
e3698c0b-c1af-4701-a8f2-9ff8098f85a6	RITIRAM CARB PLUS- 5L	cat-agroquimicos	\N	RIZOBACTER	RIZOBACTER	5.00	outros	0.00	t
23cfd085-6808-4957-804d-feeb6b2eacd2	BASAGRAN 600 - 5 L	cat-agroquimicos	\N	MATRISOJA	MATRISOJA	5.00	outros	0.00	t
1a584572-8d2b-459c-bdfa-781c76d49047	ONLY 60 TS - THIAMETOXAN 60% - 1L	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	1.00	\N	0.00	t
bec1c4e9-71ec-40a5-87f9-a9383fbc6301	FLOXY PROEXTRA-PROTIO17,5+TRIFLO15+BIXAFEN12,5- 5L	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
ca067208-c765-4cf6-b55d-d00b4f964342	TRICLON - TRICLOPYR 48% - 20LT	cat-agroquimicos	\N	UPL	UPL	20.00	\N	0.00	t
0439c052-8d9a-4c0d-9b6a-6159dccd23fa	SEM SOJA 57IX60 12X (TORQUE) - 5MM SEM.- BB	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
f468505a-821c-441f-af81-b8ad9f5d570b	ALLDRY- 25KG.	cat-agroquimicos	\N	FORQUIMICA	FORQUIMICA	25.00	\N	0.00	t
7228cbce-5cf2-4d09-964d-07aadfb0eb77	GLUFOSEC - GLUFOSINATO 40% TAMPA - 20LTS	cat-agroquimicos	\N	TAMPA	TAMPA	20.00	\N	0.00	t
646b17a8-af78-46ec-8c07-28e7c6c866a7	MAXIM RFC - METALAXIL 3,75 + FLUDIOXONIL 2,5% - 1L	cat-agroquimicos	\N	SYNGENTA PARAGUAY S.A.	SYNGENTA PARAGUAY S.A.	1.00	\N	0.00	t
b7202d06-e9f6-4801-acb7-bd297df76c97	CONTACT 72 - CLOROTALONIL 72% - 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
508c8cd9-f850-4df4-aa80-944ed1292142	UNIRON 10 - NOVALURON 10% - 1L	cat-agroquimicos	\N	UPL	UPL	1.00	outros	0.00	t
897b00fa-474e-4066-89c8-e9cd0aea2635	FERTILEADER AXIS NG - 5L	cat-fertilizantes	\N	\N	\N	\N	\N	0.00	t
94c84304-51e8-46d1-8c77-270f56a73198	SOYGUARD 30 - TEFLUBEZUROM 30% - 1L	6704c025-303a-404a-b9a4-706c4a7358c8	\N	\N	\N	\N	\N	0.00	t
99d4252c-d96d-453a-a711-5b217e20299a	ONLY - THIAMETOXAN 75% WG - 0,5KG	6704c025-303a-404a-b9a4-706c4a7358c8	\N	\N	\N	\N	\N	0.00	t
8ec566ba-7361-4440-80e0-f43485f795b5	FERTIACTYL SWEET- 10 LTS.	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	1.00	t
09e5ea57-00d9-4bd3-950b-367d29b63080	TEBUZOLE- TEBUCONAZOL 43%- 5LT	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
399eaa99-84b2-487c-a512-1ef4d6ef87af	VERDICT ULTRA 1L	cat-agroquimicos	\N	CORTEVA	CORTEVA	1.00	\N	0.00	t
df693222-739b-4a45-8c0b-e4eb675ab49b	VIOVAN - 5L	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
a428d955-8b21-4d52-ab04-c1baf9fcbeea	OBERON - 1L	cat-agroquimicos	\N	BAYER	BAYER	1.00	\N	0.00	t
3bb7cc9c-be60-45a6-9315-1e638d24a5b1	RAZANTE - PARAQUAT 24% - 20LTS	cat-agroquimicos	\N	CHDS	CHDS	20.00	\N	0.00	t
babdfdca-dd9c-4952-a31b-90ae7a385d89	CAYENNE 60 SC - IMIDACLOPRID 60% - 5 L	cat-agroquimicos	\N	CIAGROPA	CIAGROPA	5.00	\N	0.00	t
fbcc281f-3764-4ae5-8667-52f48e548db6	TORAC SC - SULFENTRAZONE 50%  - 5 LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
ec134e98-303f-4666-86be-953b02208331	LASCAR - ACEFATO 97% DF - 5KG	cat-agroquimicos	\N	UPL	UPL	5.00	\N	0.00	t
53576606-c0ef-40b6-b905-0266d5f038d1	AMPLIGO - CLORANTRA. 10% + LAMBDA. 5% - 1L	cat-agroquimicos	\N	SYNGENTA PARAGUAY S.A.	SYNGENTA PARAGUAY S.A.	1.00	\N	0.00	t
695b328e-d5d8-47b7-8502-e3119d7ece27	SPIREEL MIX- PROTIO17,5%+TRYFLO15%+BIXAFEN12,5- 5L	cat-agroquimicos	\N	RAINBOW	RAINBOW	5.00	\N	0.00	t
5a44e426-7ce9-479e-9dcd-6124d90f68d1	KURIN 48 - FLUMIOXAZIM 48% - 5LTS	cat-agroquimicos	\N	CIAGROPA	CIAGROPA	5.00	\N	0.00	t
3aec4026-0e65-47f7-8a6f-4a6ac87dd511	EUROFIT MAX - 5 LTS	cat-especialidades	\N	TIMAC	TIMAC	5.00	\N	0.00	t
ed9bcc96-5f89-41d0-ac13-116066da8594	FERT 00-28-00 MACROFERTIL - BB	cat-fertilizantes	\N	LDC	LDC	\N	\N	0.00	t
36c1882e-8e33-4490-8848-5bb874190289	FERT 04-30-10 + MICRO - FERTIPAR -  BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
624f3aad-efe1-4135-9a21-bdef0d713b85	FERT 04-24-10+CA 9% - S 6% - B 0,2% BB - KG	cat-fertilizantes	\N	COOPAVEL	COOPAVEL	\N	\N	0.00	t
da84ffce-bc90-4969-85dc-d201c75b5194	CYPRESS - CYPROCONAZOLE 15% + DIFENOCONAZOLE 25% -	cat-agroquimicos	\N	SYNGENTA PARAGUAY S.A.	SYNGENTA PARAGUAY S.A.	\N	\N	0.00	t
2bca2e1e-bba3-44a5-a8c9-fd05734783ae	STRIM - S-METOLACLORO 96% - 20LTS	cat-agroquimicos	\N	UPL	UPL	20.00	\N	0.00	t
d50b3606-e635-4c66-b3d9-1cacfc1bac72	RIZOLIQ DAKAR - BRADYRHIZOBIUM - 2LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	2.00	\N	0.00	t
c2835407-b6f8-4585-bf49-9cc7f864d90e	FERTIACTYL SWEET- 10 LTS.	cat-fertilizantes	\N	TIMAC	TIMAC	10.00	\N	0.00	t
d3b89984-9d04-4b67-ac8a-1966db9bbcd6	SEM SOJA M5947 IPRO - 125MIL SEM. BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
a1b69bc2-fc1e-4b83-b419-cd72ee8c616e	SEM SOJA 64IX66 RSF 12X (NEXUS)-125MILSEM-BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
eea6ba21-06d8-402a-a8f0-2b01580b2dac	FERT 00-18.5-00 - FERTIPAR - BB	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
b3f9348a-17de-403a-a320-0e603fccf01c	FERT 04-30-10 - FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
4877ba9e-5a8a-4f1d-9248-f946dc33019d	ACRESCENT RAIZ F - NEMATICIDA - 1L	cat-especialidades	\N	CARBON	CARBON	1.00	\N	0.00	t
cf44ae0a-af51-44b4-9152-9f695dc62de2	PULVERIZADOR SAFRAJET ELECTRICO 650L	cat-fertilizantes	\N	\N	\N	650.00	\N	0.00	t
3c0dca95-1a4e-4a2a-8ed5-6d4e8267e834	CALCAREO DOLOMÍTICO	cat-fertilizantes	\N	\N	\N	\N	\N	0.00	t
53cce7e1-a59a-45ff-b438-89634cff7d02	SEMILLA MAIZ DKB 260 PRO4+TSI - 60 MIL SEMILLAS	cat-sem-milho	\N	DEKALPAR	DEKALPAR	\N	\N	0.00	t
512a7e54-0223-4529-bfd9-971508c9efc8	FERT PFALM 12-15-15 - MOSAIC - BB	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
d115638d-0e3a-420f-8ab5-d18cba452e59	FERT SULFAMMO META 17 - TIMAC - BB - KG	cat-fertilizantes	\N	TIMAC	TIMAC	\N	\N	0.00	t
51105c77-fbb6-4443-9505-4093184ca723	SEMILLA MAIZ FS 533 VIP3 - BLS 60.000 SEMILLAS	cat-sem-milho	\N	FORSEED	FORSEED	\N	\N	0.00	t
8fe67e60-f497-4bf7-9574-293819b309f1	BELUGA- DIFLUBENZURON 48%- 1LT.	cat-agroquimicos	\N	TAMPA	TAMPA	1.00	\N	0.00	t
67aaaba4-bec8-45be-bc05-dee01dce609a	VIRTUE CLOMAZONE 50%  20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
b972bc89-0911-417e-842b-f0b4cb4e953c	BRACHIARIA RUZIZIENSIS NUA VC80- 20KG	cat-sem-diversas	\N	AZURE	AZURE	20.00	\N	0.00	t
db20cd6d-4b52-463b-b3b8-3c64cae61276	SEMILLA MAIZ FS 512 VIP3 - BLS 60.000 SEMILLAS	cat-sem-milho	\N	FORSEED	FORSEED	\N	\N	0.00	t
415302ec-446d-48ea-8f0b-2f6a9be39074	SELECT - CLETODIM 24% - 5LTS	cat-agroquimicos	\N	UPL	UPL	5.00	\N	0.00	t
e52ff46a-777a-49f5-91fa-bd8684caf7bd	VIRTUE CLOMAZONE 36% CS 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
1306df4f-966a-4c16-95b0-4a8c7359d8e0	BINGO - CLOTHIANIDINA 60 % - 1L	cat-agroquimicos	\N	CHDS	CHDS	1.00	\N	0.00	t
9c283d69-7f84-4cc1-a68a-179bc0292144	SEM SOJA BMX TORQUE I2X - NACIONAL - BB	cat-sem-soja	\N	\N	\N	\N	\N	0.00	t
a16429bf-3779-446b-a41c-cb2910696d88	VENOM- CHLORFFENAPYR 24% EC- 1LT.	cat-agroquimicos	\N	CHDS	CHDS	1.00	\N	0.00	t
2a12d9d3-6068-42b1-a3f8-7ca5194d384b	IPPON 60 SC - IMIDACLOPRID 60%  - 5L	cat-agroquimicos	\N	CHDS	CHDS	5.00	\N	0.00	t
4ee63895-91ed-4683-96ee-271cdab2ed0f	PYRI PANDA - PIRIPROXYFEN 35% - 5 L	cat-agroquimicos	\N	AGROPLUS	AGROPLUS	5.00	\N	0.00	t
c63d1533-f020-4dab-916f-ce90870db47e	METHOMYL SP - 1KG	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	1.00	\N	0.00	t
124f6ef2-001b-45a4-90c6-174c817dbc07	ATRAKING XTRA - ATRAZINA 90% - 10 KG	cat-agroquimicos	\N	RAINBOW	RAINBOW	10.00	\N	0.00	t
62164834-0ffe-4cbc-a87a-ee5e76e635ce	YARA VITA THIOTRAC - 10L	cat-especialidades	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	10.00	\N	0.00	t
486ced41-d45a-45c6-bc20-dbe92b52dbc8	CLOMAZERB 48- CLOMAZONE 48% EC-20LT	cat-agroquimicos	\N	TAMPA	TAMPA	20.00	\N	0.00	t
cfa09673-42b8-49ed-bf24-07eb500b9ed0	APROACH POWER - PICOX. 9% + CIPRO 4% - 5LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
f2ac9634-6d2f-4fb9-8adb-5214aadc9f51	INTREPID - METOXIFENOZIDA 24% - 5LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
c3575bc3-eb75-4f5e-9f65-0840da7c56a5	YARA VITA N-MOL - 20L	cat-especialidades	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	20.00	\N	0.00	t
2d60e0f3-7f0a-4afd-84e6-1c95c6508d5f	FERT 10-20-20 FERTIPAR - BB - KG	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
81e5e618-0467-47d2-b419-c17b61f3ef32	ZETHAPYR- IMAZETAPIR 10% - 5 LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
e5c7288a-d02c-4b3c-b11e-e51fcadd3838	SOBERAN - TEMBOTRIONA 42% - 5LTS	cat-agroquimicos	\N	BAYER	BAYER	5.00	\N	0.00	t
110113ab-7c6a-450e-a328-6578f4b53002	PARAGROP 24 - PARAQUAT 24% - 20LTS	cat-agroquimicos	\N	CIAGROPA	CIAGROPA	20.00	\N	0.00	t
76b35b55-585b-44d2-8a20-8caaa5d573ac	GLIFOGROP FUL DMA  - GLIFOSATO 60,8% - 20LTS	cat-agroquimicos	\N	CIAGROPA	CIAGROPA	20.00	\N	0.00	t
80ea8298-bf1b-416e-a7a1-217c0775ec9f	TA35 + ZINC - ADJUVANTE - 1L	cat-especialidades	\N	INQUIMA	INQUIMA	1.00	\N	0.00	t
498b9d0c-d157-4285-96c9-cf638da3b9e9	VESSARYA - 6L	cat-agroquimicos	\N	CORTEVA	CORTEVA	6.00	\N	0.00	t
4033c16a-5462-40cd-a24b-0c5000e018b5	FERT 02-20-20  MOSAIC - BB - KG	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
3b1994d3-cde7-4785-9e0e-f63683a01ae6	NATIVO - TEBUCO. 20% + TRIFLOXIS. 10% - 5LTS	cat-agroquimicos	\N	BAYER	BAYER	5.00	\N	0.00	t
03110e2f-9bf9-4f59-87ab-54fe35ae0b32	SEM SOJA 65I65 RSF IPRO(COMPACTA)-125MIL SEM.- BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
003b09fe-9073-4449-a223-928ba34a1834	SEM. SOJA M6130 I2X - 5MM SEM.- BB	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
1bfda8af-b959-46ea-81fd-d920ff3d3994	PROPICONAZOLE - PROPICONAZOLE 25% - 4 LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	4.00	\N	0.00	t
55a98dc5-3d30-47f6-a664-de4a52263d09	SILWET - 1L	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	1.00	\N	0.00	t
b1ce45e2-8fce-4124-bdda-94bf2ce2aa53	POLIPLUS XTRASHINE RED - 5LTS	cat-especialidades	\N	FORQUIMICA	FORQUIMICA	5.00	\N	0.00	t
22c8d8dd-add0-4510-bbc7-2486a5d4ca57	SEM SOJA M5947IPRO - 5MM SEM. - BB	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
c6a6965c-0ac6-442c-a973-98d35dd8c754	DYNAMITE- DICAMBA 57,8%- 20 LT.	cat-agroquimicos	\N	CHDS	CHDS	20.00	\N	0.00	t
80ed733c-2893-427c-be8d-c941167476d5	RIZODERMA MAX - TRICHODERMA- 2LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	2.00	\N	0.00	t
9dc09213-5dc7-48e4-82f7-6abc161bd789	FERT 04-30-10 - BRFERTIL - BB - KG	cat-fertilizantes	\N	BR FERTIL	BR FERTIL	\N	\N	0.00	t
0ee460dd-24e9-4279-9966-12c2ede565d6	LÍNEA PULVERIZADOR ROSCAVEL SAFRAJET	cat-fertilizantes	\N	\N	\N	\N	\N	0.00	t
88a97e1c-9068-4155-bb5d-19be8338312f	PULVERIZADOR SAFRAJET ELECTRICO 300L	cat-fertilizantes	\N	\N	\N	300.00	\N	0.00	t
a9e69fd5-cd26-40fa-949e-cf10f83e63e7	FERT 15-15-15 + 11% S - NPK - BB FERTIPAR	cat-fertilizantes	\N	FERTIPAR FERTILIZANTES	FERTIPAR FERTILIZANTES	\N	\N	0.00	t
5855b13b-ae18-4247-b9aa-f3f32a7e49c2	YARA VITA ZINTRAC - 10LTS	cat-especialidades	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	10.00	\N	0.00	t
c6d77238-e8b0-49bd-9f76-47b152c9f4ff	CLORPIRIFOS - NORTOX - 5 L	cat-agroquimicos	\N	NORTOX	NORTOX	5.00	\N	0.00	t
8da5b76f-fff1-472e-b014-7fb2954914ba	KSC PHYTACTYL V - BLS 25KG.	cat-especialidades	\N	TIMAC	TIMAC	25.00	\N	0.00	t
8cf0f02b-f215-4261-a3a5-438075cf9d00	FERTIACTYL LEGUMINOSAS - 10LTS	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	0.00	t
0db8ac66-34f3-41bf-8c9f-69dff846328c	SEM SOJA 57IX60 12X (TORQUE) - 125MIL SEM.- BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
08db4050-1ce4-4af3-a42c-78c28e233293	SEMILLA SOJA M5947 IPRO - PIRES - BB KG	cat-sem-soja	\N	PIRES	PIRES	\N	\N	0.00	t
9ae4008f-a8f3-436c-94f7-024de95c6e17	BRACHIARIA RUZIZIENSIS ADVANCED VC80- 10KG	cat-sem-diversas	\N	AZURE	AZURE	10.00	\N	0.00	t
546cf335-aa4a-4466-b56c-14538dd6e054	FERT-UREA-46 NUTREX-COFCO	cat-fertilizantes	\N	COFCO	COFCO	\N	\N	0.00	t
98a18c3e-c3cb-4289-8f18-927efeeea89e	SEM. SOJA M5921 I2X - 125MIL SEM.- BLS	cat-sem-soja	\N	CVALE	CVALE	\N	\N	0.00	t
a09aa18f-e8b1-4b97-857f-a4e7bd63cefa	YARA VITA COMO - 1LT	cat-especialidades	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	1.00	\N	0.00	t
b65c7596-f146-4883-890a-20469e058dbb	PACTO 840 - CLORANSULAM 84% - PAQ. 480GR.	cat-agroquimicos	\N	CORTEVA	CORTEVA	480.00	\N	0.00	t
80be705b-beea-4f97-90a9-c881c85ced4b	HOOLIGAN - CARFENTRAZONE 40% - 1LT	cat-agroquimicos	\N	CHDS	CHDS	1.00	\N	0.00	t
d855e7a3-d22c-46de-b106-e1491dd51fd8	AUSTRAL (PIROXALSUFONA) - 80% 500GR	cat-agroquimicos	\N	TAMPA	TAMPA	500.00	\N	0.00	t
a4f2dc1d-17e2-4c16-8782-33a29080525b	FATHAL- LUFENURON 40,5%+ BENZOATO 10%- 1KG.	cat-agroquimicos	\N	CHDS	CHDS	1.00	\N	0.00	t
d8af6973-cd5c-43e6-9b7f-a6847755cadd	FERT 10-15-15 TME - YARA - BB - KG	cat-fertilizantes	\N	YARA FERTILIZANTES	YARA FERTILIZANTES	\N	\N	0.00	t
d3967d6e-9d97-4c84-a3ad-1135ca487277	MERCOBLOC STANDARD -  25KG.	cat-especialidades	\N	TIMAC	TIMAC	25.00	\N	0.00	t
0f107bfa-ff63-420a-bf14-da350cf219ed	FERT 03-32-08 ATHOS MOSAIC - BB	cat-fertilizantes	\N	MOSAIC	MOSAIC	\N	\N	0.00	t
88d9bc90-4711-4361-a387-99d343b4c20a	QUINTAL XTRA - ESPINOT. 6% + ETOXIFENO. 30% - 1LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	1.00	\N	0.00	t
a5511a75-5a04-4698-80e9-c2f5a4aca27f	KSC PHYTACTYL II - BLS 25KG.	cat-especialidades	\N	TIMAC	TIMAC	25.00	\N	0.00	t
412c42bb-cf9f-4555-8341-1a53b7a53cbb	FERT 20-00-00 - BB - KG	cat-fertilizantes	\N	AGRIDESA	AGRIDESA	\N	\N	0.00	t
27314b08-b8e9-442f-af78-e960fc83b1d8	RIZOVERIA LIQ- 7,5 LT	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	5.00	\N	0.00	t
e55e9f7c-8904-4915-bb17-0d27e988cc9d	TEXARO - HALAUXIFEN 11.5% + DICLOS. 58% - 860GR	cat-agroquimicos	\N	CORTEVA	CORTEVA	860.00	\N	0.00	t
318cea20-e0f7-4da3-9a0d-1ec34c9238dc	RIZOSPIRILLIUM - 2LTS	cat-especialidades	\N	RIZOBACTER	RIZOBACTER	2.00	\N	0.00	t
39c1af59-5e33-44ae-8fad-c6fc6b564f70	EXTRAZONE- SULFENTRAZONE 50%- 5LT	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
7f0758d2-b395-4a5c-a7f4-a1adcf1034c1	EXPEDITION - SULFOXAFLOR 10% + LAMBDA. 15% - 5LTS	cat-agroquimicos	\N	CORTEVA	CORTEVA	5.00	\N	0.00	t
5d27eae6-afff-4738-97a2-54760b5c899c	TRIBO 840 - DICLOSULAN 84% - 500G	cat-agroquimicos	\N	IASA	IASA	\N	\N	0.00	t
d74311d6-72b8-4972-aa49-b8ae41ea7faf	HEAT - SAFLUFENACIL - 350G	cat-agroquimicos	\N	BASF - GPSA	BASF - GPSA	\N	\N	0.00	t
1a91917b-1d6e-486f-96a5-83ce6618ea29	SEACTIV GOLD BMO- 10LT.	cat-especialidades	\N	TIMAC	TIMAC	10.00	\N	0.00	t
3ec153fb-5149-4a2e-9306-173c0ec02d58	FLUMITOP 48 SC FLUMIOXAZIM 48%  5 LTS	cat-agroquimicos	\N	TAMPA	TAMPA	5.00	\N	0.00	t
fcc7e0ec-83fd-4a4c-8010-36b73ec995e3	BELT - FLUBENDIAMIDA 48% - 500ML	cat-agroquimicos	\N	BAYER	BAYER	\N	\N	0.00	t
685f866f-cc84-442c-a048-6e731593cb31	UNIZEB - MANCOZEB 80% WP - 25KG	cat-agroquimicos	\N	UPL	UPL	25.00	\N	0.00	t
925b3e38-77fe-437b-9395-ee7b16d8492e	SOLOMON - IMIDACLOPRID 21% + BETA CYFLUTRINA 9% -	cat-agroquimicos	\N	BAYER	BAYER	\N	\N	0.00	t
c4e64b3f-02cc-46e0-b886-a38e0291d809	SEM. SOJA NEO 610 IPRO- BLS	cat-sem-soja	\N	AGROFERTIL	AGROFERTIL	\N	\N	0.00	t
54fc4439-cbe4-4b54-acde-4f0402fcc9a1	FOMEFLAG - FOMESAFEN 25% - 5LTS	cat-agroquimicos	\N	RAINBOW	RAINBOW	5.00	\N	0.00	t
00fc835b-843d-481f-9372-133dce973bbc	CORAZA - LAMBDACIALOTRINA 25% - 5LTS	cat-agroquimicos	\N	CHDS	CHDS	5.00	\N	0.00	t
60005851-8f43-4521-9e84-f8d645836ee6	2,4D AMINA 72% - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
13d3cda8-88b8-4e28-bf0c-d4d80180c42f	ACEFATO 97% DF - 5KG	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
5c15bd26-ec88-418a-9058-aa9cdf16114b	ACETAMIPRID 70% - 1KG	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
a88b9115-20be-405f-8ee4-e94c38314943	ATRAZINA 90% - 10 KG	8b1c8883-111e-4f4d-a395-bc32ac42aee5	\N	\N	\N	\N	\N	0.00	t
2b42f23e-ea71-4ff8-b2b6-ad19f48bd43b	BENZOATO 10% + LLUFENURON 40% - 1KG	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
8072361c-a294-4b68-b316-9dc5d93a2c01	BIFENTRIN 25 + ETIPROLE 35 - 5 LTS	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
ec9f9624-adb9-40c0-b092-f83bc5fae234	BIFENTRIN 40% - 5LTS	e9a85e67-3876-4bdd-aef5-f1d549772a71	\N	\N	\N	\N	\N	0.00	t
99a96e68-3bb3-4cfb-883b-79dd234784cb	CLETODIN 24% - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
ede2cae3-fd07-45a9-a0eb-8ee4369d5152	CLOMAZONE 48% - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
89a9e2e1-4bac-4401-b21a-da175e6fc948	CLORANTRANILIPROL 80 % 1 KG	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
ae72dff1-9ccb-4c44-bf28-9519fe642232	CRIPTON ULTRA - 5 LTS	a3f5cd8f-e9cf-48ec-a19e-d714b254312b	\N	\N	\N	\N	\N	0.00	t
183ef823-5a44-4385-8597-ec007aea7745	DICAMBA 70% WG - 2,5KG	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
7fba6d19-5db2-4aae-a81f-26abf598bdb1	DICLOSULAN 84% - 500G	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
fcbd8f07-d399-4c43-a386-0cb085ab26b3	EXALT - 1 LT	e9a85e67-3876-4bdd-aef5-f1d549772a71	\N	\N	\N	\N	\N	0.00	t
e632ff2c-45eb-46c5-9358-fc500dd0422f	GLIFOSATO 75% SG - 15KG	ada9b09c-0f76-49d4-b7be-186be1e4865c	\N	\N	\N	\N	\N	0.00	t
b45d22fa-95b6-4879-8ad2-da0b34de53a2	GLUFOSINATO 40% TAMPA - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
7a9b78c3-8d3f-401e-ab55-9e17084dbddb	IMIDACLOPRID 60% - 5 L	73150ef0-92a3-4605-aff6-e4207ccb0503	\N	\N	\N	\N	\N	0.00	t
cab2c73a-bc1e-4edc-bc35-e7f424b64b85	INTREPID - 5 LTS	e9a85e67-3876-4bdd-aef5-f1d549772a71	\N	\N	\N	\N	\N	0.00	t
a28a02f1-c9c3-4f45-884e-00278f3f0c59	LOYER - LAMBDA 20 + DINOTE 20 - 5LTS	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
d4bc1322-6eee-44a6-92c8-4f2a4d1b8e7e	LUFENURON 5% - 5LTS	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
88d146ca-3dcd-4857-a30f-68464ea61b0c	MANCOZEB 75% WG - 15KG	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
343b40dd-b649-4569-8d71-34d8ad2dca1d	PARAQUAT 24% - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
50ea3db8-a7d3-4e6d-85f5-dd93a83fd709	PIXXARO - FLUROXYPYR 34,91% + HALAUXYFEN 1,64% - 5	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
08f86b4e-c262-4ecd-9d60-98e1302daa5a	PROTHIOC. 17,5% + TRIFLOXIS. 15% - 5LTS	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
bc2eea71-5f2f-4c43-9ae3-295945d6e57b	PROTHIOC. 17,5% + TRIFLOXIS. 15% BIXAFEN 12,5% - 5LTS	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
3b13bd02-bae0-410b-a1be-5813200b65c5	SAFLUFENACIL - 350G	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
46445bde-7004-4d81-99bf-1fdcc1e1fee6	S-METOLACLORO 96% - 20LTS	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
a75fc1d7-f152-4f9b-a50c-67dcc762bf21	VICROYA - 5 LTS	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
8932d9e4-2b64-44c9-babc-a818cadc4a07	RELEASE CLODINAFOP 24% - 1L	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	1.00	\N	0.00	t
03bc6a5e-b1fb-48f3-a837-684e116e2f38	CIPYR 253 SC_ (PIRACLOS.13.3%+ CIPROC.12%)	cat-agroquimicos	\N	TAMPA	TAMPA	\N	\N	0.00	t
bf26680f-d38c-4e59-af79-b4466bc9ed6e	TODYM 24 - 20 LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
002dbade-3475-4cb1-b586-cc9176223624	2,4 D AMINA TM - 2,4D AMINA 72% - 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
9c96eb8a-236d-484e-a079-60a9e2361c80	EXALT - SPINETORAM 12% - 1L	cat-agroquimicos	\N	CORTEVA	CORTEVA	1.00	\N	0.00	t
69cefb79-a15d-4963-b6dc-a5ccc48157ad	PODEROS 40 - GLUFOSINATO 40% - 20LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	20.00	\N	0.00	t
d247a049-407d-4afd-8c55-49fdfd847562	DANKE- DIFENO 20%+ TEBUCO 20%- 5LTS.	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
6656949a-2724-4f2e-9006-2a6e8d8ec499	TAMPRONIL SC- CLOROTALONIL 72%- 20L.	cat-agroquimicos	\N	TAMPA	TAMPA	20.00	\N	0.00	t
a4f2105b-1316-418d-87d1-15d2c73e2aca	CAMUS - PROPICONAZOL 50% - 5LTS	cat-agroquimicos	\N	CHDS	CHDS	5.00	\N	0.00	t
33c903b5-7614-4e73-8c3f-add95ea8936f	BARET DUO - DIFENO 25% + CIPROCONAZOL 15% - 5LTS	cat-agroquimicos	\N	TECNOMYL	TECNOMYL	5.00	\N	0.00	t
26ea181f-59a5-47cb-a289-74382a4f51ee	SEMILLA MAIZ AG9035PRO3 + TSI	cat-sem-milho	\N	TECNOMYL	TECNOMYL	\N	\N	0.00	t
5e274fbc-93a7-4087-8809-25085dea4fbc	ABAMECTINA 8,4% - 1L	e9a85e67-3876-4bdd-aef5-f1d549772a71	\N	\N	\N	\N	\N	0.00	t
9137576b-d919-4fa6-807c-e445890b0b36	ARVIS - 5 LTS	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
5f949423-82b1-4624-82d0-fa3e7f866726	CLOROTALONIL 72% - 20LTS	a3f5cd8f-e9cf-48ec-a19e-d714b254312b	\N	\N	\N	\N	\N	0.00	t
89cf0c75-e62f-4801-9d6e-e8052ef7e371	FIPRONIL 25% - 5LTS	73150ef0-92a3-4605-aff6-e4207ccb0503	\N	\N	\N	\N	\N	0.00	t
c031e72f-ca38-4f7c-a545-7addf0437080	FIPRONIL 80- 1 KG.	73150ef0-92a3-4605-aff6-e4207ccb0503	\N	\N	\N	\N	\N	0.00	t
3044744c-fabf-4c3f-ae71-339fa1c77338	FLUMIOXAZIN 50% - 5LTS	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
59915216-bf30-4288-a4ad-a0cf27ba6fc9	FOMESAFEN 25% - 5LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
6bea90cf-d6d4-4e7c-8624-1dbc305a1351	GLIFOSATO 60,8% - 20LTS	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
02248052-3031-41d9-9b05-a4f0ec26beff	SULFENTRAZONE 75% - 5KGS	c4aeda2a-63a3-4644-a6be-455c0fb64f84	\N	\N	\N	\N	\N	0.00	t
e66b0990-a83d-4635-89dc-bc8425e004e6	SUNATO - IMIDACLOPRID 18% + FIPRONIL36%-1L	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
0d979330-cde0-44ec-9b0a-f3ee338a107c	TEBU 20% + DIFENO 20% - 5LTS	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
d850fa23-15e7-425c-9978-c8bbe165a58c	TEBUCONAZOLE 43% - 5L	8e500fee-fb8a-4b4e-aa5f-e0d6661b3bb8	\N	\N	\N	\N	\N	0.00	t
3e81c19b-f271-43df-9f3f-5eebfeff88fb	TEFLUBEZUROM 30% - 1L	0e9176a0-ddf6-4768-b708-17fd37af7d82	\N	\N	\N	\N	\N	0.00	t
b0ade0c0-42b0-4f25-804a-19b371fd2e01	TERBUTILAZINA 90% - 10 KG	8b1c8883-111e-4f4d-a395-bc32ac42aee5	\N	\N	\N	\N	\N	0.00	t
049f471c-d5bb-4818-9031-3caac8946bca	TRICLOPYR 48% - 20LT	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
1fc772da-06b3-4d91-b1c4-4a687747d9ce	VERDICT ULTRA 5L	a97219b6-ba11-47da-821d-fe68ad9fa4b9	\N	\N	\N	\N	\N	0.00	t
\.


--
-- Data for Name: products_price_table; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products_price_table (id, mercaderia, principio_ativo, categoria, subcategory, dose, fabricante, preco_verde, preco_amarela, preco_vermelha, unidade, is_active, created_at, updated_at) FROM stdin;
cbdbf30f-9720-42ca-aff6-a80a749dbc5a	RIZOSPIRILUM - 2 L	Azospirillum 1x10^9	TS	\N	2ml/Kg	Rizobacter	37.00	33.50	30.00	$/ha	t	2026-01-23 01:18:34.718442	2026-01-23 01:18:34.718442
fc0d840f-f317-490e-9896-f0869979f3ca	VITAGROW TS - 1LT	Bioestimulante	TS	\N	1ml/Kg	Rizobacter	70.00	65.00	60.00	$/ha	t	2026-01-23 01:18:34.731041	2026-01-23 01:18:34.731041
0843eb8e-7b7c-427a-aa0a-a99d8b969176	RIZOLIQ TOP 2 LT	Bradirizobium 2x10^10	TS	\N	2ml/Kg	Rizobacter	23.00	21.00	19.00	$/ha	t	2026-01-23 01:18:34.734122	2026-01-23 01:18:34.734122
5479609d-f4c2-4235-b230-c684db920523	DERMACOR - 1 L	Clorantraniliproli 62,5%	TS	\N	0,5ml/Kg	Corteva	166.00	158.00	150.00	$/ha	t	2026-01-23 01:18:34.73688	2026-01-23 01:18:34.73688
a83b36be-23f8-4ca7-9158-0f9a933102ab	CLORANTE 62 - 1 L	Clorantraniliproli 62,5%	TS	\N	0,5ml/Kg	Tampa	65.00	62.50	60.00	$/ha	t	2026-01-23 01:18:34.742586	2026-01-23 01:18:34.742586
75280d41-b936-4200-aaec-da1e0b97dac5	HURACAN - 5LTS	Fipronil 25%	TS	\N	2ml/Kg	Tecnomyl	27.00	26.00	25.00	$/ha	t	2026-01-23 01:18:34.749386	2026-01-23 01:18:34.749386
b7ee9e7d-4679-4343-8081-5071204d24ea	MAXIN RFC - 1 L	Fludioxinil 2,5% + Metalaxil 3,75%	TS	\N	1ml/Kg	Syngenta	46.00	44.00	42.00	$/ha	t	2026-01-23 01:18:34.758174	2026-01-23 01:18:34.758174
12435d6c-0ba1-40ed-a7a7-72e595115de7	CROPSTAR - 5 LT	Imidacloprid + Thiodicarb	TS	\N	3ml/Kg	Bayer	52.00	50.00	48.00	$/ha	t	2026-01-23 01:18:34.763306	2026-01-23 01:18:34.763306
d793130c-55b0-4b1e-a6a5-335f51161c85	RANCONA - 1 L	Ipconazole 2,5% + Metalaxil 2%	TS	\N	1ml/Kg	Corteva	49.50	47.50	45.00	$/ha	t	2026-01-23 01:18:34.765951	2026-01-23 01:18:34.765951
d1ca42c4-4de7-4f28-bbb8-dd2f3998a272	EVERGOL - 5LTS	Metalaxil 6,14%  + Penflufen 3,84% + Protio 7,68%	TS	\N	0,9ml/Kg	Bayer	71.00	68.00	65.00	$/ha	t	2026-01-23 01:18:34.768532	2026-01-23 01:18:34.768532
12d80bb2-6a5c-4955-8c4f-3622b63821ba	RIZODERMA MAX - 2LT	Tricoderma 1X10^9	TS	\N	1ml/Kg	Rizobacter	66.00	61.50	58.50	$/ha	t	2026-01-23 01:18:34.772133	2026-01-23 01:18:34.772133
ad565861-09e0-4c0e-9b96-091d69a78901	2,4 D Amina - 20 LTS	2,4D Dimetilamina 72%	DESSECAÇÃO	\N	1 - 2Lt/Ha	Ciagropa	3.05	2.95	2.85	$/ha	t	2026-01-23 01:18:34.774592	2026-01-23 01:18:34.774592
e4a79992-d226-4454-b4be-792ca5d04ed7	CLETODIN 24% - 20 LTS	Cletodim 24%	DESSECAÇÃO	\N	0,5 - 1Lt/Ha	Rainbow	7.30	7.00	6.70	$/ha	t	2026-01-23 01:18:34.777171	2026-01-23 01:18:34.777171
15f8cea4-6dc6-47ca-b0e3-1dc684a429dd	CLOMAZERB 48 - 20 LTS	Clomazone 48%	DESSECAÇÃO	\N	1Lt/Há	Tampa	9.60	9.20	8.80	$/ha	t	2026-01-23 01:18:34.779229	2026-01-23 01:18:34.779229
12b2d8f0-a06e-4df9-987d-0b197da6ebd4	CONFIRM - 0,5Kg	Diclosulan 84%	DESSECAÇÃO	\N	0,043Kg/Há	Tecnomyl	150.00	145.00	140.00	$/ha	t	2026-01-23 01:18:34.785878	2026-01-23 01:18:34.785878
a324ce41-fbf8-451e-85dd-cfa0466f0d9e	APRESA - 20 LTS	Flumioxazin 4,2% + S-metalacloro 84%	DESSECAÇÃO	\N	1Lt/Há	Adama	17.20	16.60	16.00	$/ha	t	2026-01-23 01:18:34.788125	2026-01-23 01:18:34.788125
568e6ac7-2aae-4554-9060-d3638fdb0b0f	FLUMITOP - 5LTS	Flumioxazin 48%	DESSECAÇÃO	\N	0,1Lt/Há	Tampa	22.25	21.35	20.50	$/ha	t	2026-01-23 01:18:34.791507	2026-01-23 01:18:34.791507
08b344b1-c6c3-4e46-845b-3d110cdbd539	FOMEFLAG - 5 LTS	Fomesafen 25%	DESSECAÇÃO	\N	0,8 -1	Rainbow	8.80	8.40	8.00	$/ha	t	2026-01-23 01:18:34.803496	2026-01-23 01:18:34.803496
7c7a0a5a-6619-4d6b-8a79-b448dba40bef	GLIFOSATO 60,8% - 20 LTS	Glifosato 60,8% Sal DMA	DESSECAÇÃO	\N	2,5 - 3,5Lt/Ha	Ciagropa	3.75	3.60	3.45	$/ha	t	2026-01-23 01:18:34.806539	2026-01-23 01:18:34.806539
a396842e-b9c3-4a82-9c3c-45e0cc6ff079	TECNUP PREMIUM 2 - 20 LTS	Glifosato 60,8% Sal DMA	DESSECAÇÃO	\N	2,5 - 3,5Lt/Ha	Tecnomyl	3.80	3.65	3.50	$/ha	t	2026-01-23 01:18:34.809067	2026-01-23 01:18:34.809067
4289a666-b9ad-4e9f-9e58-0efc11e4caee	TECNUP XTRA - 15 KG	Glifosato 75,6% WG	DESSECAÇÃO	\N	2 - 3Kg/Ha	Tecnomyl	6.40	6.10	5.80	$/ha	t	2026-01-23 01:18:34.81189	2026-01-23 01:18:34.81189
41c1a64e-d7a0-425b-bf2a-bf2cd6f68d41	GLUFOSINATO 40 - 20 LTS	Glufosinato De Amonio 40%	DESSECAÇÃO	\N	2Lt/Há	Tampa	4.80	4.60	4.40	$/ha	t	2026-01-23 01:18:34.817418	2026-01-23 01:18:34.817418
4505055d-50c0-476e-967d-fc5188797f61	GLUFOSEC P40 - 20LTS	Glufosinato De Amonio 40% ATIVO	DESSECAÇÃO	\N	1,2Lt/Há	Tampa	9.20	8.85	8.50	$/ha	t	2026-01-23 01:18:34.820228	2026-01-23 01:18:34.820228
af3f3934-8ca3-49b6-a1c7-d51a154cca65	PIXXARO - 5 LTS	Halauxifeno 1,2% + Fluroxipir 28%	DESSECAÇÃO	\N	0,3Lt/Ha	Corteva	55.00	53.00	51.00	$/ha	t	2026-01-23 01:18:34.822497	2026-01-23 01:18:34.822497
69c01763-3fa3-4a3f-9bbd-f8d3765f66fd	TEXARO - 0,86KG	Halauxifeno 11,5% + Diclosulan 58%	DESSECAÇÃO	\N	0,043Kg/Ha	Corteva	478.00	460.00	442.00	$/ha	t	2026-01-23 01:18:34.828631	2026-01-23 01:18:34.828631
27bf2e53-6aeb-4a3d-a656-e7f0ce56a36b	VERDICT ULTRA - 5 LTS	Haloxifop 93%	DESSECAÇÃO	\N	0,75Lt/Ha	Corteva	71.00	69.00	67.00	$/ha	t	2026-01-23 01:18:34.832427	2026-01-23 01:18:34.832427
81307233-4a7e-4857-a0d9-236d15f45294	ZETAPIR - 5 LTS	Imazetapir 10%	DESSECAÇÃO	\N	0,145Kg/Ha	Tecnomyl	7.80	7.45	7.10	$/ha	t	2026-01-23 01:18:34.835484	2026-01-23 01:18:34.835484
90a2f251-7773-4e1c-a57f-6e4518945a17	PARAQUAT 24% - 20 LTS	Paraquat 24%	DESSECAÇÃO	\N	2,5 - 3,5Lt/Ha	Chds	2.06	1.98	1.90	$/ha	t	2026-01-23 01:18:34.839519	2026-01-23 01:18:34.839519
ffa60d02-d0c7-4709-97b5-270f29ba5ed5	SAFLUNEX - 0,35KG	Saflufenacil 70%	DESSECAÇÃO	\N	0,08Kg/Há	Tafirel	164.00	157.00	150.00	$/ha	t	2026-01-23 01:18:34.844205	2026-01-23 01:18:34.844205
3ef5ae67-ad69-4ea3-81d4-fc2088a07acf	STRIM - 20 LTS	S-Metalacloro 96%	DESSECAÇÃO	\N	1Lt/Há	Upl	8.70	8.30	7.90	$/ha	t	2026-01-23 01:18:34.847088	2026-01-23 01:18:34.847088
dd1525a4-343e-4faf-885c-1bcf9ed8d3f1	SUNZONE XTRA 5 KG	Sulfentrazone 75%	DESSECAÇÃO	\N	0,3 - 0,6Kg/Há	Rainbow	37.30	35.80	34.50	$/ha	t	2026-01-23 01:18:34.849601	2026-01-23 01:18:34.849601
7ccc985f-a9e5-404e-82f9-96af670bab37	TRICLON - 20 LTS	Triclopir 66,74%	DESSECAÇÃO	\N	1,5Lt/Ha	UPL	8.00	7.75	7.50	$/ha	t	2026-01-23 01:18:34.853138	2026-01-23 01:18:34.853138
cff543a5-bbfa-470c-86c7-7b0c15c06b71	LASCAR - 5 KG	Acefato 97%	INSETICIDAS	\N	0,8 - 1Kg/Ha	UPL	9.60	9.20	8.80	$/ha	t	2026-01-23 01:18:34.858799	2026-01-23 01:18:34.858799
63cc2d5a-7f18-43c5-8f9f-c3e876fd1df3	PERITO ULTRA - 5KG	Acefato 85% + Bifentrin 3%	INSETICIDAS	\N	1Kg/Há	UPL	10.80	10.40	10.00	$/ha	t	2026-01-23 01:18:34.862651	2026-01-23 01:18:34.862651
e5c39e73-d6a0-4a41-853b-8608d8837d57	ABAMEC 8,4 - 1 LT	Abamectina 8,4%	INSETICIDAS	\N	0,06Lt/Ha	Tecnomyl	23.60	22.80	22.00	$/ha	t	2026-01-23 01:18:34.865746	2026-01-23 01:18:34.865746
24844545-4669-49fd-94e1-9e47fb81cefc	BATTUS GOLD - 1KG	Acetamiprid 25% + Bifentrin 25%	INSETICIDAS	\N	0,2Kg/Há	UPL	23.00	22.00	21.00	$/ha	t	2026-01-23 01:18:34.86802	2026-01-23 01:18:34.86802
d7e79b94-3ae0-40bc-9002-a0c41f42111f	ACEGOAL XTRA - 1 KG	Acetamiprid 70%	INSETICIDAS	\N	0,1Kg/Há	Rainbow	17.10	16.30	15.50	$/ha	t	2026-01-23 01:18:34.869947	2026-01-23 01:18:34.869947
c1291953-2911-4eb6-8a6c-0c777ff5b5f9	AGUILA - 1 KG	Benzoato 10% + lufenuron 40%	INSETICIDAS	\N	0,125Kg/Há	Iasa	35.80	34.40	33.00	$/ha	t	2026-01-23 01:18:34.873261	2026-01-23 01:18:34.873261
f12838c5-79bb-41f3-b4e7-a5b208f1b6c0	MONITOR 30% - 1 KG	Benzoato 30%	INSETICIDAS	\N	0,08Kg/Ha	UPL	58.00	56.50	50.00	$/ha	t	2026-01-23 01:18:34.883476	2026-01-23 01:18:34.883476
12cfef84-511c-4844-ba2b-2d975c104af0	BULLDOCK - BETACIFLUTRINA 12,5% - 250 ML	Betaciflutrina 12,5%	INSETICIDAS	\N	0,06Lt/Ha	Bayer	48.75	46.30	44.00	$/ha	t	2026-01-23 01:18:34.89108	2026-01-23 01:18:34.89108
23d1a9a4-f687-4ffd-ab2f-98bb4e8ea681	TOXATRIM - 5 LTS	Bifentrin 20% + Tiametoxan 30%	INSETICIDAS	\N	0,4Lt/Ha	Tampa	15.50	0.00	0.00	$/ha	t	2026-01-23 01:18:34.893494	2026-01-23 01:18:34.893494
8591337f-99ab-431f-ab21-f74b9c6188ed	FENTHRIN 40 - 5 LT	Bifentrin 40%	INSETICIDAS	\N	0,12Lt/Ha	Tecnomyl	16.00	15.25	14.50	$/ha	t	2026-01-23 01:18:34.896014	2026-01-23 01:18:34.896014
d70799d4-4f7e-4e58-ad64-b0ee5c877f2e	GALIL - 5LTS	Bifentrin 5% + Imida 25%	INSETICIDAS	\N	0,4Lt/Ha	Adama	16.40	15.70	15.00	$/ha	t	2026-01-23 01:18:34.900014	2026-01-23 01:18:34.900014
794e1c4d-1db5-4823-a5a0-07f285a189c3	AMPLIGO - 1 L	Clorantra. 10% + Lambda. 5%	INSETICIDAS	\N	0,2Lt/Ha	Syngenta	44.00	42.00	40.00	$/ha	t	2026-01-23 01:18:34.906556	2026-01-23 01:18:34.906556
e16b68dd-254e-460a-a60b-dfc7d40c8dcb	CLORANTE WG - 1 kg	Clorantraniliproli 80%	INSETICIDAS	\N	0,03Kg/Ha	Tampa	83.00	79.00	75.00	$/ha	t	2026-01-23 01:18:34.909322	2026-01-23 01:18:34.909322
6a6c7533-dc85-4d6c-a9ad-7a6b6b0aaa68	FULMINANTE 80WG - 1Kg	Fipronil 80%	INSETICIDAS	\N		Chds	95.00	90.00	85.00	$/ha	t	2026-01-23 01:18:34.932929	2026-01-23 01:18:34.932929
71a15659-3247-45f6-8815-f386968be99a	POINT 5 - 5 LTS	Lufenuron 5%	INSETICIDAS	\N	0,3 - 0,4Lt/Ha	Tecnomyl	10.00	9.50	9.00	$/ha	t	2026-01-23 01:18:34.956574	2026-01-23 01:18:34.956574
83256429-ac40-4132-bbd8-e798612c3276	QUINTAL XTRA - 1 LT	Spinetoran 6 % + Metoxifenocide 30 %	INSETICIDAS	\N	0,2Lt/Ha	Cortveva	114.00	108.00	103.00	$/ha	t	2026-01-23 01:18:34.973472	2026-01-23 01:18:34.973472
3965ebfd-623d-4cbe-9307-43a003a544a8	THIAMEXPLANT - 1KG	Tiametoxan 75%	INSETICIDAS	\N	0,1 - 0,15Kg/Ha	Chds	12.80	12.20	11.70	$/ha	t	2026-01-23 01:18:34.990045	2026-01-23 01:18:34.990045
4e42b6bf-3a21-49b4-9943-1e684b794980	ARMERO - 10LTS	Mancozeb 50% + Protio 4%	FUNGICIDAS	\N	2Lt/Há	Adama	14.00	13.40	12.90	$/ha	t	2026-01-23 01:18:35.010581	2026-01-23 01:18:35.010581
a57dc66f-6151-4c1a-90e8-003ddec04561	AZIMUT - 5 LTS	Tebuco 20% + Azoxis 12%	FUNGICIDAS	\N	0,5Lt/Ha	Adama	17.00	16.30	15.60	$/ha	t	2026-01-23 01:18:35.024907	2026-01-23 01:18:35.024907
42b32198-ef76-42d0-8916-e253954d2920	NATIVO - 5 LTS	Trifloxistrobin 10% + Tebuconazole 20%	FUNGICIDAS	\N	0,5Lt/Ha	Bayer	25.00	24.00	23.00	$/ha	t	2026-01-23 01:18:35.057044	2026-01-23 01:18:35.057044
16e92e05-eb37-40d7-88cd-63fae402eca6	STICKER- 20L	Aceite Vegetal	ESPECIALIDADES	\N	0,5Lt/Ha	TECNOMYL	3.20	3.10	3.00	$/ha	t	2026-01-23 01:18:35.08254	2026-01-23 01:18:35.08254
e5cc3b34-2fc8-4f97-a9c0-461b23b4ebd7	U10 - INQUIMA - 1 L	Adjuvante Redutor de PH	ESPECIALIDADES	\N	0,04Lt/Ha	Inquima	24.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.114799	2026-01-23 01:18:35.114799
5697b0f7-9d01-40c0-bb09-74b092207223	YARA VITTA THIOTRAC - 10 LTS	N 11,2% + S 25,7%	ESPECIALIDADES	\N	0,5Lt/Ha	Yara	9.95	0.00	0.00	$/ha	t	2026-01-23 01:18:35.137463	2026-01-23 01:18:35.137463
ae144897-e965-41a8-873c-817130872ac8	ACRESCENT RAIZ F	Extrato de plantas	ESPECIALIDADES	\N	2ml/Kg	Carbom	99.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.151429	2026-01-23 01:18:35.151429
1f0c587c-2d2d-4015-a01e-958a755eacee	EUROFIT MAX		ESPECIALIDADES	\N		Timac	33.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.175885	2026-01-23 01:18:35.175885
883101c2-80ad-4264-99a0-453367067821	OVERTOP - 5LTS	Clorfenapir 24%	INSETICIDAS	\N	0,8 - 1Lt/Há	Tecnomyl	11.60	11.15	10.70	$/ha	t	2026-01-23 01:18:34.912831	2026-01-23 01:18:34.912831
4a52557c-e6c3-42d2-a8dd-b14df17f9540	BELT - FLUBENDIAMIDA 48% - 500ML	Flubendiamida 48%	INSETICIDAS	\N	0,07Lt/Ha	Bayer	127.00	121.00	115.00	$/ha	t	2026-01-23 01:18:34.942581	2026-01-23 01:18:34.942581
adbcd066-a66c-404a-95e3-c315d2867ae8	METOMYL 90%	Metomil 90%	INSETICIDAS	\N	0,4Kg/Ha	Iasa/Matrisoja	14.90	14.20	13.50	$/ha	t	2026-01-23 01:18:34.959979	2026-01-23 01:18:34.959979
bdb115ae-1120-4e79-9d60-567de601063a	EXPEDITION - 5 LTS	Sulfoxaflor 10% + Lambda 15%	INSETICIDAS	\N	0,4Lt/Ha	Corteva	43.00	41.00	39.00	$/ha	t	2026-01-23 01:18:34.977678	2026-01-23 01:18:34.977678
b34c1744-ec5a-410d-bb21-4ee9748e93b4	ONLY 75 - 1 KG	Tiametoxan 75%	INSETICIDAS	\N	0,1 - 0,15Kg/Ha	Tecnomyl	13.80	13.15	12.50	$/ha	t	2026-01-23 01:18:34.994045	2026-01-23 01:18:34.994045
f645e0dd-acee-449f-8d91-a0a8127bf6b7	MURALLA - 15 KG	Mancozeb 75%	FUNGICIDAS	\N	1,5Kg/Ha	Tecnomyl	5.45	5.15	4.90	$/ha	t	2026-01-23 01:18:35.013167	2026-01-23 01:18:35.013167
fd0ec00b-268d-4384-8bbf-8ea539bd5268	DANKE - 5 LTS	Tebuco. 20% + Difeno. 20%	FUNGICIDAS	\N	0,4 - 0,6Lt/Ha	Tecnomyl	9.95	0.00	0.00	$/ha	t	2026-01-23 01:18:35.038784	2026-01-23 01:18:35.038784
61884294-dd52-4574-babe-609855628061	CRIPTON SC - 5 LTS	Trifloxistrobin 15% + Prothio. 17,5%	FUNGICIDAS	\N	0,4Lt/Ha	Bayer	50.00	48.00	46.00	$/ha	t	2026-01-23 01:18:35.059461	2026-01-23 01:18:35.059461
1ef855df-4d11-49a5-9c34-877ade217cda	VALEMAX	Adjuvante	ESPECIALIDADES	\N	0,04Lt/Ha	Rizobacter	22.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.086511	2026-01-23 01:18:35.086511
7ab79f97-8b00-432c-92b6-4976fa79645c	RASS 32 - 1 LT	Limpa Tanque	ESPECIALIDADES	\N		Inquima	18.50	0.00	0.00	$/ha	t	2026-01-23 01:18:35.126514	2026-01-23 01:18:35.126514
f1fb36ba-224b-4eff-98a8-7cf60d757d5d	YARA VITTA GLYTREL - 10 LTS	P 6,6% + Mn 6,6%	ESPECIALIDADES	\N	1Lt/Ha	Yara	7.45	0.00	0.00	$/ha	t	2026-01-23 01:18:35.140552	2026-01-23 01:18:35.140552
5e343d2b-9f65-4251-8d7f-f6857960212d	ACRESCENT SOLLUS F	Extrato de Plantas	ESPECIALIDADES	\N	2Lt/Ha	Carbom	9.95	0.00	0.00	$/ha	t	2026-01-23 01:18:35.15462	2026-01-23 01:18:35.15462
a4338dce-b685-4dbf-8d3d-ef50490ed988	FERTIACTYL LEGUMINOSAS		ESPECIALIDADES	\N		Timac	102.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.180946	2026-01-23 01:18:35.180946
04599018-1f97-4003-b6e6-c2b1495c25d6	CLORPIRIFOS NORTOX	Clorpirifos 48%	INSETICIDAS	\N	1Lt/Há	Nortox	8.00	7.70	7.40	$/ha	t	2026-01-23 01:18:34.915778	2026-01-23 01:18:34.915778
9625af14-ba8f-400f-af92-e722bbbee532	CAYENNE - 5 LTS	Imidacloprid 60%	INSETICIDAS	\N	0,12Lt/Ha	Ciagropa/Chds	16.20	15.60	15.00	$/ha	t	2026-01-23 01:18:34.948488	2026-01-23 01:18:34.948488
b7356c67-72f9-4c95-8149-941d4fdffe20	INTREPID - 1 LT	Metoxifenocide 24%	INSETICIDAS	\N	0,4 - 0,5Lt/Ha	Corteva	29.50	28.00	26.50	$/ha	t	2026-01-23 01:18:34.962488	2026-01-23 01:18:34.962488
63efb7fa-79f4-48d7-aa54-a30c346a7170	SOYGUARD - 1 LT	Teflubenzuron 30%	INSETICIDAS	\N	0,03Lt/Ha	Tecnomyl	30.00	28.50	27.00	$/ha	t	2026-01-23 01:18:34.982551	2026-01-23 01:18:34.982551
dc54187b-769d-4ad8-934f-858dba072537	ALSYSTIN	Triflumuron 48%	INSETICIDAS	\N	0,06 - 0,1Lt/Ha	Bayer	49.80	47.30	45.00	$/ha	t	2026-01-23 01:18:34.997629	2026-01-23 01:18:34.997629
dd1cf172-53eb-49ec-b7b0-8b0b9e491d3b	VIOVAN - 5LTS	Picoxistrobin 10% + Prothioconazole 11,67%	FUNGICIDAS	\N	0,6Lt/Ha	Corteva	42.00	40.00	38.00	$/ha	t	2026-01-23 01:18:35.016423	2026-01-23 01:18:35.016423
8d4cef8a-8c7e-4678-ab63-24cea90e1d5a	ZAFIRO 43 - 5 LTS	Tebuconazole 43%	FUNGICIDAS	\N	0,4Lt/Ha	Chds	8.30	7.95	7.60	$/ha	t	2026-01-23 01:18:35.043862	2026-01-23 01:18:35.043862
81ca18d5-4e13-4b6e-a940-f6614193067a	BALUART - 5 LTS	Trifloxistrobin 15% + Prothio. 17,5%	FUNGICIDAS	\N	0,4Lt/Ha	UPL	18.40	17.70	17.00	$/ha	t	2026-01-23 01:18:35.064346	2026-01-23 01:18:35.064346
c0422605-84fb-46a9-8661-b119543c1d9f	TA35 + ZINC - 1 L	Adjuvante	ESPECIALIDADES	\N	0,04Lt/Ha	Inquima	24.50	0.00	0.00	$/ha	t	2026-01-23 01:18:35.096697	2026-01-23 01:18:35.096697
725da882-ed08-4a13-8969-0d4847241b98	VITA GROW FOLIAR	Bioestimulante Foliar	ESPECIALIDADES	\N	0,2Lt/Ha	Rizobacter	60.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.129777	2026-01-23 01:18:35.129777
ddbecd31-9539-48bb-aa47-e19ac7b781df	YARA VITTA BORTRAC	B 10,95 + N 4%	ESPECIALIDADES	\N	0,5Lt/Ha	Yara	9.30	0.00	0.00	$/ha	t	2026-01-23 01:18:35.144378	2026-01-23 01:18:35.144378
d1874de2-8e40-4fb4-9a14-2e4ac7f028e7	FERTILEADER VITAL 954		ESPECIALIDADES	\N		Timac	25.50	0.00	0.00	$/ha	t	2026-01-23 01:18:35.159327	2026-01-23 01:18:35.159327
850eb5e3-a5e5-4afa-95d6-4176b42f83b2	FERTACTYL SWEET		ESPECIALIDADES	\N		Timac	30.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.186075	2026-01-23 01:18:35.186075
10be54ba-c0fb-4ea4-80ef-acfb218b2a94	OBERON - 5LTS	Espiromesifeno 24%	INSETICIDAS	\N	0,5Lt/Há	Bayer	31.50	30.20	29.00	$/ha	t	2026-01-23 01:18:34.919488	2026-01-23 01:18:34.919488
57738114-e8e8-4dec-9377-c2cf9f612231	LOYER - 5 LTS	Lambda 20% + Dinotefuran 20%	INSETICIDAS	\N	0,35Lt/Ha	Tecnomyl	17.00	0.00	0.00	$/ha	t	2026-01-23 01:18:34.951262	2026-01-23 01:18:34.951262
abd5ce48-2dbb-4967-92a8-2a69cc594161	PIRY PANDA - 5 LTS	Piriproxifen 35%	INSETICIDAS	\N	0.12	Agroplus	18.40	17.70	17.00	$/ha	t	2026-01-23 01:18:34.965313	2026-01-23 01:18:34.965313
29a8e780-ec7d-4207-ae41-41cf5ef28cd0	THIODICARB 80 WP - 1 KG	Thiodicarb 80%	INSETICIDAS	\N	0,3Kg/Ha	Chds	40.00	38.00	36.00	$/ha	t	2026-01-23 01:18:34.985156	2026-01-23 01:18:34.985156
069c1d62-2cd3-4c94-9d3c-5b5b75e9b757	VESSARYA - 6 LTS	Benzovindiflupir 5% + Picoxistrobin 10%	FUNGICIDAS	\N	0,6Lt/Ha	Corteva	43.50	41.50	39.50	$/ha	t	2026-01-23 01:18:35.003546	2026-01-23 01:18:35.003546
fbb2d2df-a105-46d5-a8fa-55d34535cf2f	APROACH PRIMA  5 LTS	Picoxistrobin 20%  + Ciproconazole 8%	FUNGICIDAS	\N	0,3Lt/Há	Corteva	46.00	44.00	42.00	$/ha	t	2026-01-23 01:18:35.019672	2026-01-23 01:18:35.019672
b2089e56-a109-41a9-ae35-281972150e56	WETTER - 20 LTS	Tebuco + picox + mancozeb	FUNGICIDAS	\N	2Lt/Há	Adama	13.50	13.00	12.50	$/ha	t	2026-01-23 01:18:35.050956	2026-01-23 01:18:35.050956
4623fb33-425c-4f5f-9279-e3834cd5a550	SPHERE MAX SC - 5 LTS	Trifloxistrobina 37,5% + Ciproconazol 16%	FUNGICIDAS	\N	0,2Lt/Ha	Bayer	64.00	61.00	58.00	$/ha	t	2026-01-23 01:18:35.070625	2026-01-23 01:18:35.070625
b56b2543-5f1c-4f26-a738-93f17857c037	TA35 + ZINC - 5 LTS	Adjuvante	ESPECIALIDADES	\N	0,04Lt/Ha	Inquima	24.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.105005	2026-01-23 01:18:35.105005
e7e592ce-ad17-405e-bf29-71fe2ebb784a	YARA VITTA COMO		ESPECIALIDADES	\N	0,2Lt/Ha	Yara	36.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.132828	2026-01-23 01:18:35.132828
e924d514-1cdd-462d-a706-b1faf289df62	YARA VITTA ZINTRAC	Zn 40% + N 1%	ESPECIALIDADES	\N	0,5 - 1 Lt/Há	Yara	19.20	0.00	0.00	$/ha	t	2026-01-23 01:18:35.146759	2026-01-23 01:18:35.146759
f754ebd9-6f25-4c88-9634-5365dffdb831	FERTILEADER GOLD BMO		ESPECIALIDADES	\N		Timac	28.30	0.00	0.00	$/ha	t	2026-01-23 01:18:35.164429	2026-01-23 01:18:35.164429
53245339-08f5-4bd7-868b-3eacbba01514	PROGEN DETOX		ESPECIALIDADES	\N		Timac	29.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.190224	2026-01-23 01:18:35.190224
644b2d7e-a35e-4118-8a16-4c4a8e2e301c	CRICKET WG - 1KG	Etiprole 80%	INSETICIDAS	\N	0,25Kg/Há	Chds	88.00	84.00	80.00	$/ha	t	2026-01-23 01:18:34.927932	2026-01-23 01:18:34.927932
78ac4e3e-8724-4a37-9520-5203f107300d	CORAZA - 5 LTS	Lambdacialotrina 25%	INSETICIDAS	\N	0,08 - 0,16Lt/Ha	Chds	10.20	9.70	9.20	$/ha	t	2026-01-23 01:18:34.953627	2026-01-23 01:18:34.953627
1bd74331-1cd4-4b32-8991-c515aaba8c73	EXALT - 1LT	Spinetoran 12%	INSETICIDAS	\N	0,1Lt/Ha	Corteva	176.00	168.00	160.00	$/ha	t	2026-01-23 01:18:34.971377	2026-01-23 01:18:34.971377
f40e1bb5-8098-4839-be45-c2f85f865532	ONLY 60 - 5 LTS	Tiametoxan 60%	INSETICIDAS	\N	0,1 - 0,15Lt/Ha	Tecnomyl	13.80	13.15	12.50	$/ha	t	2026-01-23 01:18:34.987882	2026-01-23 01:18:34.987882
b83aad0d-af71-4351-8696-aa6745ca0ad0	CLOROTALONIL 72% - 20 LTS	Clorotalonil 72%	FUNGICIDAS	\N	1Lt/Ha	Tampa	6.50	6.25	6.00	$/ha	t	2026-01-23 01:18:35.006882	2026-01-23 01:18:35.006882
bcbcd3d6-133d-4e43-8062-84a4d26173a2	APROACH POWER	Picoxistrobin 8%  + Ciproconazole 4%	FUNGICIDAS	\N	0,6Lt/Ha	Corteva	28.00	26.50	25.00	$/ha	t	2026-01-23 01:18:35.022236	2026-01-23 01:18:35.022236
a5608571-f249-4d24-a196-8dcbfe711ada	CRIPTON XPRO SC - 5 LTS	TrifloxiS. 15% + Prothio. 17,5% + Bixafen 12,5%	FUNGICIDAS	\N	0,5Lt/Ha	Bayer	62.50	59.50	56.50	$/ha	t	2026-01-23 01:18:35.05488	2026-01-23 01:18:35.05488
8483dc35-78e2-4897-9e7e-24dfcb15b24f	RIZOIL M - 10LTS	Aceite Metilado De Soja	ESPECIALIDADES	\N	0,3Lt/Ha	Rizobacter	6.00	5.50	5.00	$/ha	t	2026-01-23 01:18:35.076515	2026-01-23 01:18:35.076515
58c08250-ce32-4a0c-be7c-103ce101eeb8	RIZOSPRAY XTREMO	Adjuvante + Aceite	ESPECIALIDADES	\N	0,15Lt/Ha	Rizobacter	16.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.107976	2026-01-23 01:18:35.107976
6c1a14a1-16ea-47ef-8acc-41c5e20ea518	YARA VITTA FOLICARE - 25 KG	N 12% + K 39% + Mg 1,8% + S 2,8%	ESPECIALIDADES	\N	3 - 4Kg/Ha	Yara	4.75	0.00	0.00	$/ha	t	2026-01-23 01:18:35.135472	2026-01-23 01:18:35.135472
ff52751e-a023-42a5-a2f2-b9bcb517e5ee	YARA VITTA N-MOL		ESPECIALIDADES	\N	3 - 5Lt/Há	Yara	4.80	0.00	0.00	$/ha	t	2026-01-23 01:18:35.149412	2026-01-23 01:18:35.149412
944db122-2433-4dd5-8d8b-9783ccdc3bbc	FERTIACTYL GZ		ESPECIALIDADES	\N		Timac	28.00	0.00	0.00	$/ha	t	2026-01-23 01:18:35.17205	2026-01-23 01:18:35.17205
\.


--
-- Data for Name: purchase_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_history (id, user_id, client_id, season_id, season_name, source_file, import_date, total_amount) FROM stdin;
\.


--
-- Data for Name: purchase_history_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_history_items (id, purchase_history_id, product_code, product_name, package_type, quantity, total_price, unit_price, purchase_date, order_code) FROM stdin;
\.


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.regions (id, name, country) FROM stdin;
9c738932-9b21-4e5f-87d5-072c744d61d0	Região 9c738932	Paraguai
115e5fde-281e-479f-a657-9971fa2baf60	Região 115e5fde	Paraguai
71ca46e1-042d-4b76-83ad-e0ca977f326e	Região 71ca46e1	Paraguai
e25208fc-38f7-4b7b-91a7-4803956b554a	Região e25208fc	Paraguai
56fee253-6882-49d1-871b-47d79bc1036c	Região 56fee253	Paraguai
b6df536b-84f5-468f-9fc5-330d61ebd906	Região b6df536b	Paraguai
reg-alto-parana	Alto Parana	Paraguai
532c538f-5a28-4478-bdff-713e20b4dc22	Região 532c538f	Paraguai
dc40ca27-1ebd-40c0-9fd4-9295eb9206b1	Região dc40ca27	Paraguai
976a3b5a-51b7-482d-8e03-5b1b11aff74b	Região 976a3b5a	Paraguai
dfa12d63-bb3e-40d7-98bb-5084195beb1a	Região dfa12d63	Paraguai
5ad733c9-5c42-4751-828b-043f0a2a337b	Região 5ad733c9	Paraguai
a65a9cec-689e-49e2-b630-3e59ef61e0a3	Região a65a9cec	Paraguai
0cebe7b8-2a66-4ea0-ac52-0745b424df63	Região 0cebe7b8	Paraguai
60de64d6-3e99-4c11-87e1-3058b00f6b60	Região 60de64d6	Paraguai
8c693432-ac42-4ff5-a272-5b187ca9b958	Região 8c693432	Paraguai
reg-itapua	Itapua	Paraguai
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales (id, client_id, product_id, category_id, season_id, user_id, sale_date, due_date, total_amount, quantity, margin, iva_rate, commission_rate, commission_amount, commission_tier, timac_points, is_manual, import_batch_id, order_code, pdf_file_name, created_at) FROM stdin;
b29ce9bd-4154-461a-9fbb-9e408ac5d0b3	2b135e12-91f5-4142-ae36-9247a08c8c43	9d25504a-802d-4d09-83ef-5e8a98018a61	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	450.00	5.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.37
33ad5c7e-1f70-4c01-a06f-9b62dadf8f64	2b135e12-91f5-4142-ae36-9247a08c8c43	7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	247.50	5.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.391
29bf545c-b9ee-482f-9998-00686df85007	2b135e12-91f5-4142-ae36-9247a08c8c43	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	1070.00	10.00	0.00	10.00	0.000	0.00	barter	15.00	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.398
2a51cbf6-adf7-407c-a5fb-7e2b453f7bb0	2b135e12-91f5-4142-ae36-9247a08c8c43	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	260.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.408
a7b0cb06-3e12-4a07-9e8d-c3b8c556eed3	2b135e12-91f5-4142-ae36-9247a08c8c43	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	732.00	120.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.42
a3f6a06d-62db-47fe-ba85-90c7d47b3270	2b135e12-91f5-4142-ae36-9247a08c8c43	399eaa99-84b2-487c-a512-1ef4d6ef87af	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	880.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.435
f11e4a11-a2d6-458a-8f8f-84ad0761e48b	2b135e12-91f5-4142-ae36-9247a08c8c43	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	1050.00	60.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.445
e36e4184-d92d-4ab9-8c6f-1ad80e92b118	2b135e12-91f5-4142-ae36-9247a08c8c43	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	2400.00	60.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.455
1ada7f39-57f4-419f-a495-5cf2481962e7	2b135e12-91f5-4142-ae36-9247a08c8c43	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	4250.00	100.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.466
1dd91e74-9441-4b50-8d20-8e1792840313	2b135e12-91f5-4142-ae36-9247a08c8c43	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	1911.00	60.00	0.00	10.00	0.000	0.00	barter	6.00	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.485
f2b0b3c5-39eb-46b0-9d7c-13ac6fb8f1cb	2b135e12-91f5-4142-ae36-9247a08c8c43	75b2fc62-f1d8-4df9-857a-b7b18cdf5f8d	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	396.00	18.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.495
6b84aa7a-d2a2-4f17-8db3-a149f502191a	2b135e12-91f5-4142-ae36-9247a08c8c43	68f79595-d9ba-4142-a36e-6a9d0582247c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-01-31 15:07:13	2026-04-01 00:00:00	3462.00	120.00	0.00	10.00	0.000	0.00	barter	12.00	f	batch-1769128382327-q8be4tbxb	925-180-8020842	\N	2026-01-23 00:33:02.509
804c01eb-4f51-43fc-b8b4-b46d63a903cc	f0c18bd1-b7b2-4652-b536-05a4784552b6	ea4cf8f2-2916-45d3-830e-eb94c36d9002	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-04 07:54:29.999	2026-04-30 00:00:00	16050.00	30000.00	4.50	10.00	0.180	26.26	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020877	\N	2026-01-23 00:33:02.531
e3d32f1d-82b3-4772-a34b-b74653088b68	f0c18bd1-b7b2-4652-b536-05a4784552b6	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-04 07:54:29.999	2026-04-30 00:00:00	75000.00	150000.00	4.50	10.00	0.180	122.73	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020877	\N	2026-01-23 00:33:02.541
f14c021c-feae-4b1a-8bea-5f946f1da910	1cd099ae-5d21-431e-b046-6af552145a0c	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-10 16:42:37	2026-04-01 00:00:00	16320.00	32000.00	4.50	10.00	0.180	26.71	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020881	\N	2026-01-23 00:33:02.557
f8131ccd-fc5f-4287-9a40-a9f977c4ef93	1cd099ae-5d21-431e-b046-6af552145a0c	e4111c42-14ec-47e2-8890-5b9c3f3e8023	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-10 16:42:37	2026-04-01 00:00:00	57420.00	90000.00	4.50	10.00	0.180	93.96	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020881	\N	2026-01-23 00:33:02.562
138f183f-a1aa-4f9e-8e70-31f6d09f545f	fcc7726d-b5ed-47f2-a1b1-064e1558515d	440586d7-420d-4a11-9af4-21b78314eef8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-14 16:55:39.999	2026-04-01 00:00:00	103740.00	210000.00	4.50	10.00	0.180	169.76	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020884	\N	2026-01-23 00:33:02.575
97bcd584-7fea-417d-a64e-95ef111d2e22	fcc7726d-b5ed-47f2-a1b1-064e1558515d	d71b7f9b-92e4-46b2-a1b0-0590b3c13660	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-14 16:55:39.999	2026-04-01 00:00:00	30300.00	60000.00	4.50	10.00	0.180	49.58	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020884	\N	2026-01-23 00:33:02.58
504a378b-e05b-462a-9bca-9ebf501227f4	961e44df-06ea-4be3-83cc-8023e8e54eed	d71b7f9b-92e4-46b2-a1b0-0590b3c13660	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-17 14:10:01	2026-04-01 00:00:00	2825.00	5000.00	4.50	10.00	0.180	4.62	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020747	\N	2026-01-23 00:33:02.595
94ab665b-5456-46d4-a316-2b0fed211bf0	961e44df-06ea-4be3-83cc-8023e8e54eed	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-17 14:10:01	2026-04-01 00:00:00	1076.00	2000.00	4.50	10.00	0.180	1.76	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020747	\N	2026-01-23 00:33:02.603
da52b6d7-1a63-409e-a09c-6e8a6483e81d	c37701b6-2c8b-47b1-bad3-5fd0efdad4cb	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-18 13:52:33	2026-04-30 00:00:00	7392.00	8000.00	6.50	10.00	0.200	13.44	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020891	\N	2026-01-23 00:33:02.619
3ae74b3c-b2b5-4dd4-81df-bd3117c2a9ad	665c260d-2f5a-422b-b4f9-d924699ce260	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-18 15:58:05	2026-04-30 00:00:00	48048.00	52000.00	6.50	10.00	0.200	87.36	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020892	\N	2026-01-23 00:33:02.634
145d9292-3eba-466b-91ac-4e98f400994c	2b88bb4e-b627-4f62-b252-f713382e629f	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-18 15:59:16	2026-04-30 00:00:00	83160.00	90000.00	6.50	10.00	0.200	151.20	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020893	\N	2026-01-23 00:33:02.646
a6d37c72-37c2-4cfb-b220-16e68cb966ae	f0c18bd1-b7b2-4652-b536-05a4784552b6	ea4cf8f2-2916-45d3-830e-eb94c36d9002	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-31 09:30:48	2026-04-30 00:00:00	34240.00	64000.00	4.50	10.00	0.180	56.03	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020900	\N	2026-01-23 00:33:02.677
a9c72bbc-e99a-4564-a1ae-009feaba5c56	3c8c279a-a06b-431c-969f-c53c1bbe1f60	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	1900.00	200.00	13.00	10.00	1.000	17.27	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.75
b311a596-d8e1-447b-aec6-d302a47b5648	3c8c279a-a06b-431c-969f-c53c1bbe1f60	cfa09673-42b8-49ed-bf24-07eb500b9ed0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	3920.00	140.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.767
86b3fd0d-57f5-4896-8826-c0676de249f9	3c8c279a-a06b-431c-969f-c53c1bbe1f60	4859161e-5b69-42e7-86e3-f9b6779da644	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	3816.00	120.00	25.00	10.00	4.000	138.76	verde	12.00	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.783
4ba8bc23-2e9c-4167-be55-501db0921505	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	13c21dc1-82d9-4a7b-89ea-8ef7ca50549f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	360.00	3.00	3.50	10.00	0.150	0.49	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.875
e73b9cf4-4f95-4dca-b801-a0d2a178373c	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	30.00	10.00	7.50	10.00	1.000	0.27	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.896
af0331b6-580a-4e06-8f3b-3ddc427749a9	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	81581447-8003-440d-99f6-462d727b1ba1	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	1068.75	15.00	7.50	10.00	1.000	9.72	abaixo_lista	9.00	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.916
d65a2e47-a6a4-49a4-be18-29ea3cd1cbd2	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	e3698c0b-c1af-4701-a8f2-9ff8098f85a6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-12 13:44:37	2026-04-30 00:00:00	900.00	120.00	3.50	10.00	0.150	1.23	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020931	\N	2026-01-23 00:33:03.039
2d57e5fa-6272-41b9-81bc-0f614a1fdf65	132fe7a2-7b31-47ff-a989-0a441b4942c1	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 08:21:16	2026-04-30 00:00:00	3850.00	500.00	3.50	10.00	0.150	5.25	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020935	\N	2026-01-23 00:33:03.107
48ccb562-ccd8-4dcd-8b9e-120f29f92055	34501fa5-f6f6-42d1-a6eb-0253e3aca224	87d1684a-8569-48f3-a433-18ecc72b12f7	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-27 07:55:12.999	2026-04-30 00:00:00	74400.00	120000.00	4.50	10.00	0.180	121.75	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020941	\N	2026-01-23 00:33:03.146
f845792c-8963-407c-a8fd-d37f3d4e39c4	665c260d-2f5a-422b-b4f9-d924699ce260	3bb7cc9c-be60-45a6-9315-1e638d24a5b1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	36.00	20.00	3.50	10.00	0.150	0.05	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.246
b1cb8cd7-b423-45c0-9d4c-1d9b07a70cff	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	94fef025-4f91-4f40-b521-e8e44e5a0676	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 14:49:02	2026-04-30 00:00:00	3570.00	170.00	25.00	10.00	4.000	129.82	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020947	\N	2026-01-23 00:33:03.267
2521d25b-8d57-4ae6-a884-2582ed80a054	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	fe64d721-dff0-4e14-9dbe-f7b4e4c298d2	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	540.00	30.00	7.50	10.00	1.000	4.91	abaixo_lista	3.00	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.288
eb67665c-c686-482b-bafb-fb5c8fbf35ed	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	f2ac9634-6d2f-4fb9-8adb-5214aadc9f51	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	2000.00	100.00	3.50	10.00	0.150	2.73	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.309
9ef483d7-59df-43d3-89f6-4252ae268fe4	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	81e5e618-0467-47d2-b419-c17b61f3ef32	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	400.00	80.00	3.50	10.00	0.150	0.55	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.326
d9a5db01-f03f-43a1-bde3-fec1213f3106	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	e5c7288a-d02c-4b3c-b11e-e51fcadd3838	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	2450.00	35.00	3.50	10.00	0.150	3.34	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.345
d944400a-f255-49a4-9727-4dfa07fa8fb1	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	8adb91b8-973e-424b-b79a-7b498af0a840	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	650.00	65.00	7.50	10.00	1.000	5.91	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.364
55f0922b-cb5a-4ffb-ae5e-186f675b2fb9	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	ff4564d0-df57-4bc3-9f61-6d691b3dd3bf	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	1740.00	116.00	7.50	10.00	1.000	15.82	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.38
eb17745a-a80f-4966-8be9-ee3a87816c37	ad9e3b47-172a-4191-8001-c23556a17455	1d83ca6a-a994-4bc9-81a7-fc121ba58394	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-23 11:34:36.999	2026-04-01 00:00:00	50850.00	90000.00	4.50	10.00	0.180	83.21	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020953	\N	2026-01-23 00:33:03.409
3a7f7a21-91b8-41a7-85ad-abdb0d2399b9	2b135e12-91f5-4142-ae36-9247a08c8c43	c34db6db-36c5-495e-a3ef-e7b99f2b7208	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-30 15:46:17	2026-04-01 00:00:00	3500.00	1000.00	8.50	10.00	0.400	12.73	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020969	\N	2026-01-23 00:33:03.523
df6f2e79-da49-4812-84fe-d30f52b843aa	665c260d-2f5a-422b-b4f9-d924699ce260	110113ab-7c6a-450e-a328-6578f4b53002	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 14:27:14	2026-04-30 00:00:00	570.00	300.00	3.50	10.00	0.150	0.78	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020988	\N	2026-01-23 00:33:03.724
d28c9d2d-0aec-4bb5-aeb2-b7f03af56390	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-20 10:13:48	2026-04-30 00:00:00	65024.00	128000.00	4.50	10.00	0.180	106.40	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020897	\N	2026-01-23 00:33:02.659
1b70dfa2-937f-444e-a829-591fbcdf4180	79450858-a9c7-4b7f-a9cb-f9f38986e5f1	ea4cf8f2-2916-45d3-830e-eb94c36d9002	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-31 09:32:25.999	2026-04-30 00:00:00	32100.00	60000.00	4.50	10.00	0.180	52.53	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020901	\N	2026-01-23 00:33:02.689
42699e9e-e45e-44a7-9ca1-626b701d39b1	3c8c279a-a06b-431c-969f-c53c1bbe1f60	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	2568.00	24.00	0.00	10.00	0.000	0.00	barter	36.00	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.726
ef8db2b1-4477-4fcc-bbad-4be0f99a1fdc	3c8c279a-a06b-431c-969f-c53c1bbe1f60	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	3538.00	580.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.835
a6f928c5-eadf-48e4-a977-fe1d8fc734c9	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c927cfdc-3199-45c4-b568-2864d57b87b7	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	1275.00	85.00	3.50	10.00	0.150	1.74	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.93
67d0a1b6-d2d5-4a3a-96d6-8f1722550224	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	3b17fa90-f1a1-4c37-b811-1e75a808e175	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	22910.00	79.00	8.50	10.00	0.400	83.31	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.969
47a1efe2-11ec-437d-9838-d5f3332aadef	f0c18bd1-b7b2-4652-b536-05a4784552b6	ddc798d0-98db-4c51-ad9f-268f21a03774	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-05 16:44:43.999	2026-04-30 00:00:00	35220.00	60000.00	4.50	10.00	0.180	57.63	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020926	\N	2026-01-23 00:33:03.012
41c3dbaa-2fac-482e-9700-510345de3d87	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	eb2718a5-b60a-4eba-a6d1-af1e8d087d3f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-12 13:44:37	2026-04-30 00:00:00	3920.00	700.00	3.50	10.00	0.150	5.35	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020931	\N	2026-01-23 00:33:03.066
d557bcec-2023-403a-bd63-c1b17fbdb8fd	132fe7a2-7b31-47ff-a989-0a441b4942c1	68169cfb-4ad8-457c-8851-2ae04f2ad409	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 11:19:38	2026-04-30 00:00:00	27520.00	32000.00	2.00	10.00	0.150	37.53	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020938	\N	2026-01-23 00:33:03.124
b1ca09ce-8d4b-418b-bc12-f5940c15685f	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	ea4cf8f2-2916-45d3-830e-eb94c36d9002	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-30 15:03:49	2026-04-30 00:00:00	21800.00	40000.00	4.50	10.00	0.180	35.67	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020943	\N	2026-01-23 00:33:03.17
3efbef9d-e28b-4a64-858c-c413435917a2	79450858-a9c7-4b7f-a9cb-f9f38986e5f1	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-24 11:23:47	2026-04-30 00:00:00	22600.00	80.00	8.50	10.00	0.400	82.18	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020956	\N	2026-01-23 00:33:03.424
f8db883d-7744-4ee4-8d71-b0dad1ef1e8f	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c7cf53a9-7f3a-4ffa-8ee0-21a0528717a0	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-24 15:32:44	2026-04-30 00:00:00	64.00	4.00	17.49	10.00	2.000	1.16	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020958	\N	2026-01-23 00:33:03.442
1b6f9776-1376-47fc-8ee1-9b18e727713b	1cd099ae-5d21-431e-b046-6af552145a0c	e4111c42-14ec-47e2-8890-5b9c3f3e8023	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-25 15:20:56	2026-04-01 00:00:00	12130.74	20000.00	4.50	10.00	0.180	19.85	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020964	\N	2026-01-23 00:33:03.48
dee9a81b-4688-4b3d-ad38-a35893c66c13	665c260d-2f5a-422b-b4f9-d924699ce260	c9ff0590-018a-40a5-a7da-801b22b39235	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-29 16:01:59	2026-04-30 00:00:00	3739.40	140.00	25.00	10.00	4.000	135.98	verde	14.00	f	batch-1769128382327-q8be4tbxb	925-180-8020967	\N	2026-01-23 00:33:03.497
46dbba43-9933-4737-9ab1-3edd0c70ecaf	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-05 13:41:43	2026-04-30 00:00:00	4980.00	60.00	25.00	10.00	4.000	181.09	verde	90.00	f	batch-1769128382327-q8be4tbxb	925-180-8020971	\N	2026-01-23 00:33:03.54
e9a98b22-baa6-4e8a-95cf-f892d9b83ab1	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c2835407-b6f8-4585-bf49-9cc7f864d90e	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-05 13:41:43	2026-04-30 00:00:00	2418.00	100.00	7.00	10.00	0.300	6.59	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020971	\N	2026-01-23 00:33:03.561
44b89b6e-1bc2-4513-b65d-229121d32196	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	1d83ca6a-a994-4bc9-81a7-fc121ba58394	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-08 09:10:10	2026-04-30 00:00:00	16800.00	30000.00	4.50	10.00	0.180	27.49	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020974	\N	2026-01-23 00:33:03.589
16899227-0db7-4441-81a9-b732749adefa	3218243d-70e6-4538-8a19-50327cdb67e5	f5a5f777-ca8b-4cb4-bfdd-cddb3fb6a18b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 07:08:23	2026-04-30 00:00:00	3906.00	140.00	8.50	10.00	0.400	14.20	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020975	\N	2026-01-23 00:33:03.605
3ecbfa5e-c4f7-44fd-bc95-1d5a761b290e	2b88bb4e-b627-4f62-b252-f713382e629f	81581447-8003-440d-99f6-462d727b1ba1	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 17:15:25	2026-04-30 00:00:00	5810.70	70.00	25.00	10.00	4.000	211.30	verde	42.00	f	batch-1769128382327-q8be4tbxb	925-180-8020976	\N	2026-01-23 00:33:03.621
2a2ce0c6-1329-469e-8b84-ab6235b149e9	2b135e12-91f5-4142-ae36-9247a08c8c43	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-13 08:50:05	2026-04-01 00:00:00	275.00	50.00	22.49	10.00	3.000	7.50	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020977	\N	2026-01-23 00:33:03.637
ef15f9df-9651-46a0-83da-ec825cbc2918	665c260d-2f5a-422b-b4f9-d924699ce260	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-13 11:20:27.999	2026-04-30 00:00:00	435.00	100.00	3.50	10.00	0.150	0.59	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020978	\N	2026-01-23 00:33:03.653
3aff2474-601e-410b-a910-14399cab3600	f0c18bd1-b7b2-4652-b536-05a4784552b6	3158b5ad-a4f1-4e03-93c0-6492e5f0914c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-21 09:42:38.999	2026-04-30 00:00:00	560.00	8.00	8.50	10.00	0.400	2.04	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020981	\N	2026-01-23 00:33:03.669
7570c779-408b-4cd1-ad09-e10376d6f176	132fe7a2-7b31-47ff-a989-0a441b4942c1	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-20 10:15:38	2026-04-30 00:00:00	65024.00	128000.00	4.50	10.00	0.180	106.40	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020898	\N	2026-01-23 00:33:02.672
6d3ad47c-afe9-4657-b3b2-5510d0791f59	3c8c279a-a06b-431c-969f-c53c1bbe1f60	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-31 09:54:58	2026-04-30 00:00:00	40725.00	45000.00	4.50	10.00	0.180	66.64	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020903	\N	2026-01-23 00:33:02.702
2cc1ae60-9a5d-4d14-9210-60bad7324dea	3c8c279a-a06b-431c-969f-c53c1bbe1f60	75b2fc62-f1d8-4df9-857a-b7b18cdf5f8d	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	616.00	28.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.778
baaf89cc-67bb-4000-a3f1-8a6e636523c8	3c8c279a-a06b-431c-969f-c53c1bbe1f60	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	2866.50	90.00	0.00	10.00	0.000	0.00	barter	9.00	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.793
b0f5aa98-13f9-458c-b4b8-087f60565788	3c8c279a-a06b-431c-969f-c53c1bbe1f60	d563beae-6141-4015-9cbe-b3453615146b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	1782.00	90.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.81
ba16a70f-753f-4c99-8742-c1b08e3cdbc3	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	1996648d-0411-4cd4-a022-5f25cebfed07	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	1850.00	100.00	3.50	10.00	0.150	2.52	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.85
17631c6c-857a-4c34-8c2c-70c120c13857	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	cdd5c40f-54f7-4e58-9118-85d4ca7678fc	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	2175.00	435.00	3.50	10.00	0.150	2.97	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.869
c4b312db-3555-4b57-83e6-a86e38c41b8f	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	0dd27eaf-2905-4593-b8b3-e3df3f46ad5a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	2635.00	170.00	7.50	10.00	1.000	23.95	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.89
498f4f1e-a579-49c2-b426-5041926aaf6d	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	30eed411-63ba-4276-97ef-c99c2317387c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	4320.00	64.00	7.50	10.00	1.000	39.27	abaixo_lista	32.00	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.908
949443c3-0857-4677-933f-2c82959d7f6f	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	cac7eb90-2489-4abd-87df-88b5eb91fa0a	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	600.00	200.00	3.50	10.00	0.150	0.82	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.944
19f6d218-65d1-48a7-b794-8fe7f0e7598a	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	9d408d5b-d9df-4c51-9738-efd88e1f398c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	3690.00	205.00	7.50	10.00	1.000	33.55	abaixo_lista	41.00	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.987
4ca519ab-99c0-4990-a8c4-2e0bb5ea3301	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	bfe773b8-b217-4103-90c9-9a57a5146e1c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-12 13:44:37	2026-04-30 00:00:00	1680.00	300.00	11.50	10.00	0.700	10.69	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020931	\N	2026-01-23 00:33:03.03
017d3c53-26de-4eee-ac38-7ecb9c550135	132fe7a2-7b31-47ff-a989-0a441b4942c1	367d0e74-d0b0-4318-9e55-622f4455fcca	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 08:21:16	2026-04-30 00:00:00	2124.00	120.00	3.50	10.00	0.150	2.90	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020935	\N	2026-01-23 00:33:03.082
343719df-6530-444b-a0af-57e6c999bf79	132fe7a2-7b31-47ff-a989-0a441b4942c1	3b3fa437-92c1-4423-acde-927cbfe519c1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 08:21:16	2026-04-30 00:00:00	4700.00	200.00	3.50	10.00	0.150	6.41	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020935	\N	2026-01-23 00:33:03.1
1b3e0354-99dc-49ae-bca4-9050e6216a99	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	3158b5ad-a4f1-4e03-93c0-6492e5f0914c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-04 07:39:05.999	2026-04-30 00:00:00	100.00	2.00	3.50	10.00	0.150	0.14	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020944	\N	2026-01-23 00:33:03.193
9dc65ca2-81c6-4385-bd88-8266864356f4	665c260d-2f5a-422b-b4f9-d924699ce260	53844242-406c-46ef-9d69-91a26466190c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	540.00	300.00	3.50	10.00	0.150	0.74	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.218
a008f4bc-b021-4036-8b99-ee93d62d6080	665c260d-2f5a-422b-b4f9-d924699ce260	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	2160.00	45.00	8.50	10.00	0.400	7.85	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.236
46cad26d-8179-4400-88c1-a2a5d5b36d67	665c260d-2f5a-422b-b4f9-d924699ce260	56f268e6-db73-4c5e-9a30-e928198d71cb	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	384.00	80.00	25.00	10.00	4.000	13.96	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.261
58ee29fa-4eba-4c0b-b83d-ac71cc8e9f31	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	81581447-8003-440d-99f6-462d727b1ba1	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	325.00	5.00	7.50	10.00	1.000	2.95	abaixo_lista	3.00	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.281
48b86967-1d19-42aa-b36f-01346a48594d	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	cdd5c40f-54f7-4e58-9118-85d4ca7678fc	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	660.00	165.00	3.50	10.00	0.150	0.90	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.36
f7d5d5aa-feb3-48b8-8e00-28563186998b	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	8c18045e-556a-49ec-aa41-94db282862a9	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	3108.00	1110.00	3.50	10.00	0.150	4.24	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.375
e75ecccd-44b9-43a2-b2d0-00f6f7a86907	2b135e12-91f5-4142-ae36-9247a08c8c43	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-01 14:01:15	2026-04-01 00:00:00	27248.00	26000.00	7.00	10.00	0.300	74.31	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020960	\N	2026-01-23 00:33:03.46
8fa937fc-731b-4c12-9659-31d674fdde66	9d9000b0-d28b-4721-851f-d572d8de16ed	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-03-31 09:56:29	2026-04-30 00:00:00	40725.00	45000.00	4.50	10.00	0.180	66.64	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020904	\N	2026-01-23 00:33:02.72
c655bc10-9a1d-4a06-8007-3b86e951c159	3c8c279a-a06b-431c-969f-c53c1bbe1f60	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	468.00	18.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.74
b544d90e-707a-4e17-a4a9-cbb866888753	3c8c279a-a06b-431c-969f-c53c1bbe1f60	e55e9f7c-8904-4915-bb17-0d27e988cc9d	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	5634.72	10320.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.758
28a8b4cc-a735-4f66-8660-067999b3e367	3c8c279a-a06b-431c-969f-c53c1bbe1f60	399eaa99-84b2-487c-a512-1ef4d6ef87af	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	2200.00	25.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.828
5a5c24ff-2589-431b-b81d-e89aeca9adb8	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	e4b4c186-aa6f-432d-96fa-136e30d98997	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	330.00	60.00	3.50	10.00	0.150	0.45	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.962
7f2e9255-4728-4358-bfbc-0fcc455e76c8	46668ac9-61a7-4f84-bd89-9cd58cc8f03c	440586d7-420d-4a11-9af4-21b78314eef8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-28 07:28:14.999	2026-04-01 00:00:00	16350.00	30000.00	4.50	10.00	0.180	26.75	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020921	\N	2026-01-23 00:33:03.006
cf26c4f6-f9dc-40c5-bcda-de63dcab681b	132fe7a2-7b31-47ff-a989-0a441b4942c1	39c1af59-5e33-44ae-8fad-c6fc6b564f70	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 08:21:16	2026-04-30 00:00:00	8000.00	400.00	3.50	10.00	0.150	10.91	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020935	\N	2026-01-23 00:33:03.118
b6d2310e-e172-491e-ab20-421a6630d247	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	7f0758d2-b395-4a5c-a7f4-a1adcf1034c1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	500.00	25.00	3.50	10.00	0.150	0.68	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.3
d4cb6c7e-d7ac-4b03-a2e3-542a83ca1ffb	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	5d27eae6-afff-4738-97a2-54760b5c899c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	4000.00	80.00	3.50	10.00	0.150	5.45	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.318
b02f76ac-21c5-490a-9305-b70d58be1449	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	d74311d6-72b8-4972-aa49-b8ae41ea7faf	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	3780.00	60.00	3.50	10.00	0.150	5.15	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.337
16e6457c-6761-475b-ab5a-d7fa8ceb2034	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	23cfd085-6808-4957-804d-feeb6b2eacd2	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-24 13:57:08	2026-04-30 00:00:00	1147.50	85.00	3.50	10.00	0.150	1.56	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020957	\N	2026-01-23 00:33:03.435
e870c26e-ec06-4cc5-a9ac-9d0159fcbaf8	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	7a433be0-dbd4-4ce0-b4e8-cde2c4366793	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-24 08:59:12	2026-04-30 00:00:00	23120.00	40000.00	6.50	10.00	0.200	42.04	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020963	\N	2026-01-23 00:33:03.473
e2ceafb9-be28-4b76-81fc-01959f0d475c	665c260d-2f5a-422b-b4f9-d924699ce260	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-29 16:01:59	2026-04-30 00:00:00	2158.26	26.00	25.00	10.00	4.000	78.48	verde	39.00	f	batch-1769128382327-q8be4tbxb	925-180-8020967	\N	2026-01-23 00:33:03.491
f3ffe946-a1ac-45e7-99f1-b7b42ae5b0b9	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	1a91917b-1d6e-486f-96a5-83ce6618ea29	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-05 13:41:43	2026-04-30 00:00:00	3429.00	150.00	25.00	10.00	4.000	124.69	verde	15.00	f	batch-1769128382327-q8be4tbxb	925-180-8020971	\N	2026-01-23 00:33:03.533
fea83578-5735-4fd6-ab52-8abd1ce6bbd7	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	fe64d721-dff0-4e14-9dbe-f7b4e4c298d2	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-05 13:41:43	2026-04-30 00:00:00	5715.00	250.00	25.00	10.00	4.000	207.82	verde	25.00	f	batch-1769128382327-q8be4tbxb	925-180-8020971	\N	2026-01-23 00:33:03.555
bcb1533f-7cb6-4e61-8289-4e57e43c946b	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	5c499719-5efa-4656-a463-d9bda30082d3	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-06 15:12:28.999	2026-04-30 00:00:00	14768.00	16000.00	2.00	10.00	0.150	20.14	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020973	\N	2026-01-23 00:33:03.576
c05323d0-6a50-4bbd-8b42-3f4807f1173a	3218243d-70e6-4538-8a19-50327cdb67e5	8adb91b8-973e-424b-b79a-7b498af0a840	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 07:08:23	2026-04-30 00:00:00	1450.00	100.00	17.49	10.00	2.000	26.36	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020975	\N	2026-01-23 00:33:03.615
0cb05595-3e9e-42ec-bb6e-b7fe68869f15	2b88bb4e-b627-4f62-b252-f713382e629f	4859161e-5b69-42e7-86e3-f9b6779da644	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 17:15:25	2026-04-30 00:00:00	7735.00	340.00	25.00	10.00	4.000	281.27	verde	34.00	f	batch-1769128382327-q8be4tbxb	925-180-8020976	\N	2026-01-23 00:33:03.63
3cf994e3-9463-47e1-867d-d041ca5ac53f	665c260d-2f5a-422b-b4f9-d924699ce260	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-13 11:20:27.999	2026-04-30 00:00:00	150.00	30.00	17.49	10.00	2.000	2.73	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020978	\N	2026-01-23 00:33:03.647
91555acc-c8ab-431d-a414-b5a7b213f199	3c8c279a-a06b-431c-969f-c53c1bbe1f60	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-18 09:01:50	2026-04-30 00:00:00	900.00	150.00	25.00	10.00	4.000	32.73	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020980	\N	2026-01-23 00:33:03.663
e25d6925-bb18-42fb-95f6-d8ffa864dac4	2b88bb4e-b627-4f62-b252-f713382e629f	c9ff0590-018a-40a5-a7da-801b22b39235	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-27 08:32:26	2026-04-30 00:00:00	6944.60	260.00	25.00	10.00	4.000	252.53	verde	26.00	f	batch-1769128382327-q8be4tbxb	925-180-8020983	\N	2026-01-23 00:33:03.699
fec25539-184a-4581-bfa9-f26470df7a9e	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-29 08:58:54	2026-04-30 00:00:00	20700.00	450.00	3.50	10.00	0.150	28.23	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020986	\N	2026-01-23 00:33:03.718
85ce78c7-9000-40d2-b35d-44e3a1f9228d	3c8c279a-a06b-431c-969f-c53c1bbe1f60	7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	445.50	9.00	13.00	10.00	1.000	4.05	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.732
d8262035-cfd9-46dc-beb3-9009150e6611	3c8c279a-a06b-431c-969f-c53c1bbe1f60	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	1755.00	90.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.803
b0996394-78da-420e-9e8f-c7cbc4372bfc	3c8c279a-a06b-431c-969f-c53c1bbe1f60	13c21dc1-82d9-4a7b-89ea-8ef7ca50549f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	3960.00	20.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.822
03913a8c-7ed8-4cee-aafd-7f9d9ad60247	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	9405.00	330.00	3.50	10.00	0.150	12.83	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.841
93833eef-3bf7-460c-96bb-17c9bdb59050	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c0ebf995-bf13-4507-83c1-4dd4662212bf	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	2100.00	700.00	3.50	10.00	0.150	2.86	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.859
5e4f3f48-2a86-4a08-95a9-e3ca65ecdae0	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	893e0dbb-0e64-4ebc-ba39-79d72ed6faf7	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	324.00	30.00	3.50	10.00	0.150	0.44	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.936
ec693e70-b143-47c2-aa88-9882c75b7db6	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	3158b5ad-a4f1-4e03-93c0-6492e5f0914c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	200.00	4.00	3.50	10.00	0.150	0.27	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.956
2df73b46-3788-458a-a82a-b515c6e7fcd8	f0c18bd1-b7b2-4652-b536-05a4784552b6	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-05 16:44:43.999	2026-04-30 00:00:00	23340.00	60000.00	4.50	10.00	0.180	38.19	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020926	\N	2026-01-23 00:33:03.019
a936415f-e87d-4813-aa99-247cb657d0ef	132fe7a2-7b31-47ff-a989-0a441b4942c1	392adaa8-3853-429a-a1f3-8ff1af265208	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-13 15:58:43	2026-04-30 00:00:00	29970.00	54000.00	2.00	10.00	0.150	40.87	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020932	\N	2026-01-23 00:33:03.072
5eef9251-69db-4278-8261-bf8745095856	132fe7a2-7b31-47ff-a989-0a441b4942c1	d91ac8fa-306c-4b9d-bbaa-edaf3d4b8223	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 08:21:16	2026-04-30 00:00:00	4800.00	400.00	3.50	10.00	0.150	6.55	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020935	\N	2026-01-23 00:33:03.091
0966090b-1c55-495f-9199-0eec59b00485	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	5c499719-5efa-4656-a463-d9bda30082d3	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-23 11:20:37	2026-04-30 00:00:00	59072.00	64000.00	2.00	10.00	0.150	80.55	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020939	\N	2026-01-23 00:33:03.129
058ced80-83b8-4f25-8ed8-bfc8a74aa8eb	665c260d-2f5a-422b-b4f9-d924699ce260	21842c4e-0c4b-4f49-afb9-1c89376568fd	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	144.00	4.00	3.50	10.00	0.150	0.20	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.206
10c8929f-9e8a-444d-a7d7-96cc55ad541a	665c260d-2f5a-422b-b4f9-d924699ce260	c34db6db-36c5-495e-a3ef-e7b99f2b7208	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	330.00	100.00	3.50	10.00	0.150	0.45	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.226
4bcb0507-7189-4e45-86ea-4a16002377ec	d1c1772f-24da-4cdc-93ad-a70198adfa15	440586d7-420d-4a11-9af4-21b78314eef8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-23 08:19:11.999	2026-04-01 00:00:00	30628.00	62000.00	4.50	10.00	0.180	50.12	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020952	\N	2026-01-23 00:33:03.397
cb4a85f4-088e-410e-9de9-349c616bb86a	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	3bb7cc9c-be60-45a6-9315-1e638d24a5b1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-24 13:57:08	2026-04-30 00:00:00	570.00	300.00	8.50	10.00	0.400	2.07	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020957	\N	2026-01-23 00:33:03.429
42031311-4807-4f19-ae27-f9b167b922ab	665c260d-2f5a-422b-b4f9-d924699ce260	bf26680f-d38c-4e59-af79-b4466bc9ed6e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-09 07:52:03	2026-04-30 00:00:00	236.00	40.00	13.00	10.00	1.000	2.15	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020961	\N	2026-01-23 00:33:03.468
10e17694-7738-48f7-90ff-245172e7eb0f	665c260d-2f5a-422b-b4f9-d924699ce260	45e62da5-2272-41bf-802d-8f6d88b750ee	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-29 14:42:08	2026-04-30 00:00:00	2832.00	80.00	25.00	10.00	4.000	102.98	verde	8.00	f	batch-1769128382327-q8be4tbxb	925-180-8020966	\N	2026-01-23 00:33:03.486
679a44c1-6015-4bde-95d2-cbc62a7c3434	665c260d-2f5a-422b-b4f9-d924699ce260	1c4bcfa3-8896-4a7b-a73e-d40176022714	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-29 16:01:59	2026-04-30 00:00:00	1140.00	7500.00	7.50	10.00	1.000	10.36	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020967	\N	2026-01-23 00:33:03.503
d9a392fc-ac58-4812-b690-927c4a6d1ddf	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	68f79595-d9ba-4142-a36e-6a9d0582247c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-05 13:41:43	2026-04-30 00:00:00	2685.80	130.00	25.00	10.00	4.000	97.67	verde	13.00	f	batch-1769128382327-q8be4tbxb	925-180-8020971	\N	2026-01-23 00:33:03.546
d18fd4f4-45fb-4cba-b6e5-bf6a8e97c27e	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	67a734ca-f12c-416c-a3f8-4f7434db90f3	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-06 15:09:50	2026-04-30 00:00:00	9700.00	10000.00	4.50	10.00	0.180	15.87	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020972	\N	2026-01-23 00:33:03.568
459dfc3f-31cc-4fa5-88a4-1464a8b383a5	3218243d-70e6-4538-8a19-50327cdb67e5	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 07:08:23	2026-04-30 00:00:00	4800.00	100.00	3.50	10.00	0.150	6.55	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020975	\N	2026-01-23 00:33:03.611
cec1369d-0528-4a37-b140-bd4213577596	2b88bb4e-b627-4f62-b252-f713382e629f	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-11 17:15:25	2026-04-30 00:00:00	2988.36	36.00	25.00	10.00	4.000	108.67	verde	54.00	f	batch-1769128382327-q8be4tbxb	925-180-8020976	\N	2026-01-23 00:33:03.625
e12deefe-ea82-4c24-9ac7-3f90c9b693a7	3c8c279a-a06b-431c-969f-c53c1bbe1f60	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	2012.50	115.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.772
472c4e43-3f05-40ee-90f1-e4acb3fbdbf9	3c8c279a-a06b-431c-969f-c53c1bbe1f60	56f268e6-db73-4c5e-9a30-e928198d71cb	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-08 07:19:56	2026-04-30 00:00:00	540.00	90.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020914	\N	2026-01-23 00:33:02.789
5a10c3f2-08a5-4964-b7c3-374e178a0d22	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	c7cf53a9-7f3a-4ffa-8ee0-21a0528717a0	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	384.00	24.00	17.49	10.00	2.000	6.98	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.885
cf582e72-e106-4396-8f24-e99f3b0d704e	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	8c18045e-556a-49ec-aa41-94db282862a9	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	1500.00	500.00	3.50	10.00	0.150	2.05	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.903
4ca827e0-0b31-4b47-89d4-4bae928fda0c	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	fe64d721-dff0-4e14-9dbe-f7b4e4c298d2	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	1440.00	80.00	7.50	10.00	1.000	13.09	abaixo_lista	8.00	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.922
5b1d4303-dcc5-4176-b80c-ae2541ba2d1e	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	a428d955-8b21-4d52-ab04-c1baf9fcbeea	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-04-10 14:09:03	2026-04-30 00:00:00	62.00	2.00	8.50	10.00	0.400	0.23	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020915	\N	2026-01-23 00:33:02.978
123045c9-a503-4992-a113-97a923a91281	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	08527738-99af-4f17-9908-18bfe3f78861	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-05-12 13:44:37	2026-04-30 00:00:00	600.00	80.00	8.50	10.00	0.400	2.18	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020931	\N	2026-01-23 00:33:03.056
d809b0a7-3660-4a6c-a984-81fe9f4eee9a	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	3bb7cc9c-be60-45a6-9315-1e638d24a5b1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-04 07:39:05.999	2026-04-30 00:00:00	760.00	400.00	8.50	10.00	0.400	2.76	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020944	\N	2026-01-23 00:33:03.185
97f2a169-5d24-4f18-9b99-7a7f3c162290	665c260d-2f5a-422b-b4f9-d924699ce260	1c4bcfa3-8896-4a7b-a73e-d40176022714	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 09:07:43	2026-04-30 00:00:00	1925.00	12500.00	22.49	10.00	3.000	52.50	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020946	\N	2026-01-23 00:33:03.254
eb546248-0f44-45ab-8763-b04d2cda0a49	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	58762fe6-7b30-4e3d-9e70-6ae895944671	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-10 14:49:02	2026-04-30 00:00:00	274.00	20.00	7.00	10.00	0.300	0.75	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020947	\N	2026-01-23 00:33:03.274
34a1d31e-41dd-465b-83cb-17a8b6d45e58	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	1996648d-0411-4cd4-a022-5f25cebfed07	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	600.00	40.00	3.50	10.00	0.150	0.82	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.354
7c2c1e86-5c62-490f-9a16-99e4cecb3fc8	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-11 07:18:41.999	2026-04-30 00:00:00	3500.00	1000.00	7.50	10.00	1.000	31.82	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020948	\N	2026-01-23 00:33:03.37
40f765bc-ed80-4a1c-8230-b9ee2571a233	665c260d-2f5a-422b-b4f9-d924699ce260	14366256-3dfd-42fe-8806-0f08cfae9106	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-18 09:36:03	2026-04-30 00:00:00	9100.00	20000.00	4.50	10.00	0.180	14.89	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020950	\N	2026-01-23 00:33:03.385
7c404b44-086e-4c11-b107-7b433be3886e	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	ea4cf8f2-2916-45d3-830e-eb94c36d9002	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-23 17:30:04.999	2026-04-30 00:00:00	38190.00	67000.00	4.50	10.00	0.180	62.49	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020955	\N	2026-01-23 00:33:03.415
88611350-7fe2-4f7c-9279-24124399730a	665c260d-2f5a-422b-b4f9-d924699ce260	babdfdca-dd9c-4952-a31b-90ae7a385d89	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-30 08:01:38	2026-04-30 00:00:00	521.50	35.00	3.50	10.00	0.150	0.71	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020959	\N	2026-01-23 00:33:03.453
b980f0bb-dae4-4845-8dd3-3b33f7d3752f	f0c18bd1-b7b2-4652-b536-05a4784552b6	fbcc281f-3764-4ae5-8667-52f48e548db6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-21 09:42:38.999	2026-04-30 00:00:00	880.00	40.00	8.50	10.00	0.400	3.20	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020981	\N	2026-01-23 00:33:03.676
c92a1247-fe2b-4e4d-932d-e9f01b52c449	132fe7a2-7b31-47ff-a989-0a441b4942c1	cfa09673-42b8-49ed-bf24-07eb500b9ed0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	6750.00	300.00	3.50	10.00	0.150	9.20	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.791
9f1e1602-5fbb-4345-ba38-c019daca6264	132fe7a2-7b31-47ff-a989-0a441b4942c1	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	4000.00	500.00	3.50	10.00	0.150	5.45	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.807
871bd6e3-8000-4fc6-abc3-91288503f4a9	132fe7a2-7b31-47ff-a989-0a441b4942c1	53576606-c0ef-40b6-b905-0266d5f038d1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	2340.00	60.00	3.50	10.00	0.150	3.19	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.831
fb1d7af7-f180-416c-bc88-73dcc97499ff	132fe7a2-7b31-47ff-a989-0a441b4942c1	b95129bd-92dd-4580-80da-da1ce98fe4a0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	3200.00	400.00	3.50	10.00	0.150	4.36	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.847
5eb9dcb6-bed4-4e0f-8b0b-2a2e6864394e	3218243d-70e6-4538-8a19-50327cdb67e5	b50d90e9-2757-4b16-9b07-4a15b8cf7794	cat-sem-milho	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:18:24.999	2026-04-30 00:00:00	14800.00	80.00	12.50	10.00	1.500	201.82	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020993	\N	2026-01-23 00:33:03.87
56afcbcf-6e84-4ab0-83ee-5b689649f07b	132fe7a2-7b31-47ff-a989-0a441b4942c1	695b328e-d5d8-47b7-8502-e3119d7ece27	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-18 14:32:11.999	2026-04-30 00:00:00	15950.00	500.00	3.50	10.00	0.150	21.75	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020997	\N	2026-01-23 00:33:03.909
5edbd86d-7719-4b22-aa13-34ac6866d1a7	f0c18bd1-b7b2-4652-b536-05a4784552b6	587d814a-61fc-4bcd-9f49-d7f0a96174a6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-07-30 14:14:13.999	2026-04-30 00:00:00	592.50	15.00	8.50	10.00	0.400	2.15	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020968	\N	2026-01-23 00:33:03.516
6a5f6c59-9f4d-470e-9804-a0f6fd0e3c60	ad9e3b47-172a-4191-8001-c23556a17455	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-25 17:09:26.999	2026-04-01 00:00:00	10000.00	2500.00	3.50	10.00	0.150	13.64	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020982	\N	2026-01-23 00:33:03.68
b5aa0369-1a4b-4414-8d3f-089206a8557c	132fe7a2-7b31-47ff-a989-0a441b4942c1	508c8cd9-f850-4df4-aa80-944ed1292142	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	1140.00	60.00	3.50	10.00	0.150	1.55	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.836
fde22531-2a77-4e42-a99a-2e3c9f4f5587	132fe7a2-7b31-47ff-a989-0a441b4942c1	399eaa99-84b2-487c-a512-1ef4d6ef87af	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	3780.00	60.00	3.50	10.00	0.150	5.15	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.852
7c958472-513a-47a1-a2e7-f6a18c3c94d5	665c260d-2f5a-422b-b4f9-d924699ce260	fefdcfa4-43f0-4cdf-8f55-c8744d7c1b57	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 10:25:46	2026-04-30 00:00:00	12480.00	13000.00	7.00	10.00	0.300	34.04	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020994	\N	2026-01-23 00:33:03.876
0f634605-19b3-4ae3-97f9-5171aaf0bc21	3218243d-70e6-4538-8a19-50327cdb67e5	6eb21282-9882-4a66-88b4-542e3a938d29	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-23 16:25:43.999	2026-04-30 00:00:00	300.00	20.00	11.50	10.00	0.700	1.91	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020999	\N	2026-01-23 00:33:03.933
3973069f-58b2-43d7-ac82-6db1465db09b	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-01 09:41:15	2026-04-30 00:00:00	1150.00	25.00	3.50	10.00	0.150	1.57	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021003	\N	2026-01-23 00:33:03.972
7fa9d5ac-4aba-42ec-8b1f-269b5063229c	665c260d-2f5a-422b-b4f9-d924699ce260	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-06 13:32:54	2026-04-30 00:00:00	628.00	80.00	8.50	10.00	0.400	2.28	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021005	\N	2026-01-23 00:33:03.99
ccb21163-12a2-480e-b7c0-d7e3348af028	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-07 10:54:46	2026-04-30 00:00:00	920.00	20.00	3.50	10.00	0.150	1.25	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021006	\N	2026-01-23 00:33:04.006
54b65556-9334-4bba-a4f9-938386ee1a1a	2b88bb4e-b627-4f62-b252-f713382e629f	c34db6db-36c5-495e-a3ef-e7b99f2b7208	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 07:18:02	2026-04-30 00:00:00	1750.00	500.00	8.50	10.00	0.400	6.36	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021010	\N	2026-01-23 00:33:04.047
41a5b61a-3e94-440d-b9ba-e23232498b83	665c260d-2f5a-422b-b4f9-d924699ce260	8274a979-5d13-4535-97ae-8fe8a7baaf9e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-20 07:54:28	2026-04-30 00:00:00	680.00	200.00	11.50	10.00	0.700	4.33	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021016	\N	2026-01-23 00:33:04.098
9107c92d-4b4a-402a-8e11-778bfe4841ca	f0c18bd1-b7b2-4652-b536-05a4784552b6	ae3cd83f-31db-4ef6-9acd-7ff457725e90	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-21 09:19:31	2026-04-30 00:00:00	640.00	80.00	3.50	10.00	0.150	0.87	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021017	\N	2026-01-23 00:33:04.114
f689c96e-8711-4f83-af74-dce1dab6a90b	f0c18bd1-b7b2-4652-b536-05a4784552b6	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-24 17:08:16	2026-04-30 00:00:00	3650.00	100.00	3.50	10.00	0.150	4.98	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021020	\N	2026-01-23 00:33:04.131
b6818bca-b424-41da-be83-356aa4964e90	665c260d-2f5a-422b-b4f9-d924699ce260	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-28 09:22:23	2026-04-30 00:00:00	176.00	40.00	17.49	10.00	2.000	3.20	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021023	\N	2026-01-23 00:33:04.149
a7092715-43ee-48ce-b78d-6ce7689c552c	2b88bb4e-b627-4f62-b252-f713382e629f	62edd198-b767-4100-afd9-afadf0efa5da	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-04 14:10:45	2026-04-30 00:00:00	10730.00	370.00	3.50	10.00	0.150	14.63	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021030	\N	2026-01-23 00:33:04.236
2a1cffd7-2014-4710-8bc5-f12b8c74e931	f0c18bd1-b7b2-4652-b536-05a4784552b6	2c57c0ac-c791-41d9-bbad-010ef0fc1f84	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-13 07:09:03	2026-04-30 00:00:00	920.00	10.00	8.50	10.00	0.400	3.35	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021031	\N	2026-01-23 00:33:04.249
44984211-fdd6-4d90-a569-30a24a10532d	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	9c96eb8a-236d-484e-a079-60a9e2361c80	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-18 09:18:49	2026-04-30 00:00:00	2030.00	14.00	3.50	10.00	0.150	2.77	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021033	\N	2026-01-23 00:33:04.28
b70eceeb-04c9-45d7-9cc6-2ae1ca5e1828	f0889cce-f19b-4110-ad2f-478ecb61c07a	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-19 16:35:31	2026-04-01 00:00:00	1060.00	40.00	25.00	10.00	4.000	38.55	verde	4.00	f	batch-1769128382327-q8be4tbxb	925-180-8021036	\N	2026-01-23 00:33:04.295
f9cabb7f-199f-4ba6-8ecf-8ee91c9975bf	665c260d-2f5a-422b-b4f9-d924699ce260	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-02 16:56:54.999	2026-04-30 00:00:00	250.00	50.00	25.00	10.00	4.000	9.09	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021038	\N	2026-01-23 00:33:04.313
19e85851-0024-47fc-85df-edfb9735a0ce	2b88bb4e-b627-4f62-b252-f713382e629f	ee6b528f-6297-4aef-b2bf-78f4f50b5d17	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-03 09:55:17	2026-04-30 00:00:00	1295.00	140.00	8.50	10.00	0.400	4.71	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021040	\N	2026-01-23 00:33:04.326
9afa11f4-4a63-41b1-9658-61a70e49d1c3	f0c18bd1-b7b2-4652-b536-05a4784552b6	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-03 16:55:01.999	2026-04-30 00:00:00	710.00	20.00	8.50	10.00	0.400	2.58	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021042	\N	2026-01-23 00:33:04.34
a26ce514-3342-4f82-b080-b372a4419efd	f0c18bd1-b7b2-4652-b536-05a4784552b6	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-05 08:56:01	2026-04-30 00:00:00	8580.00	260.00	3.50	10.00	0.150	11.70	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021046	\N	2026-01-23 00:33:04.356
d64094ef-6b4b-407e-b5c1-331c68b2abfe	665c260d-2f5a-422b-b4f9-d924699ce260	e55e9f7c-8904-4915-bb17-0d27e988cc9d	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-13 11:20:27.999	2026-04-30 00:00:00	1109.40	2580.00	3.50	10.00	0.150	1.51	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020978	\N	2026-01-23 00:33:03.641
06dfe2bc-de39-439c-aeb7-f9c1de8e0c5d	3c8c279a-a06b-431c-969f-c53c1bbe1f60	c34db6db-36c5-495e-a3ef-e7b99f2b7208	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-14 13:53:06.999	2026-04-30 00:00:00	1750.00	500.00	8.50	10.00	0.400	6.36	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020979	\N	2026-01-23 00:33:03.658
8e406b48-80ea-4e85-a74a-c19a259ebaca	ad9e3b47-172a-4191-8001-c23556a17455	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-25 17:09:26.999	2026-04-01 00:00:00	4860.00	1800.00	3.50	10.00	0.150	6.63	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020982	\N	2026-01-23 00:33:03.692
ebd4b992-63d6-4633-b939-c1986a477821	3218243d-70e6-4538-8a19-50327cdb67e5	b3e48baa-c384-4414-a421-8af3a430ea2d	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-29 08:10:22	2026-04-30 00:00:00	33792.00	96000.00	2.00	10.00	0.150	46.08	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020985	\N	2026-01-23 00:33:03.713
b7117f10-32f2-4e4f-92de-94b4a3685633	f0889cce-f19b-4110-ad2f-478ecb61c07a	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	4524.00	580.00	3.50	10.00	0.150	6.17	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.756
b9dec0a4-cc80-46a5-9046-906c40f4e1db	2b88bb4e-b627-4f62-b252-f713382e629f	87d3e1d2-afd2-4015-be36-a9d026e7db86	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 17:17:11.999	2026-04-30 00:00:00	31020.00	33000.00	6.50	10.00	0.200	56.40	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020990	\N	2026-01-23 00:33:03.773
5b38e81c-02e0-44af-b800-152732985910	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-19 10:18:09	2026-04-30 00:00:00	920.00	20.00	3.50	10.00	0.150	1.25	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020998	\N	2026-01-23 00:33:03.925
60f7fbe5-6cf5-473a-9c9d-570a6fc6f723	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	9c96eb8a-236d-484e-a079-60a9e2361c80	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 08:20:37	2026-04-30 00:00:00	1160.00	8.00	3.50	10.00	0.150	1.58	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021011	\N	2026-01-23 00:33:04.055
72aa210e-2fb1-4521-8c71-5c74a03d55af	79450858-a9c7-4b7f-a9cb-f9f38986e5f1	13c21dc1-82d9-4a7b-89ea-8ef7ca50549f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 14:01:20	2026-04-30 00:00:00	280.00	2.00	3.50	10.00	0.150	0.38	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021013	\N	2026-01-23 00:33:04.073
e68d9864-f544-4195-82f6-f3d4ac8ede80	f0c18bd1-b7b2-4652-b536-05a4784552b6	e55e9f7c-8904-4915-bb17-0d27e988cc9d	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-17 07:27:53	2026-04-30 00:00:00	2167.20	5160.00	3.50	10.00	0.150	2.96	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021015	\N	2026-01-23 00:33:04.09
ae17fc1b-40aa-4fe7-83ce-20bccf586999	665c260d-2f5a-422b-b4f9-d924699ce260	69cefb79-a15d-4963-b6dc-a5ccc48157ad	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-20 07:54:28	2026-04-30 00:00:00	720.00	160.00	3.50	10.00	0.150	0.98	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021016	\N	2026-01-23 00:33:04.106
4031b862-ff09-4488-808a-43e98216b9ba	f0889cce-f19b-4110-ad2f-478ecb61c07a	ae3cd83f-31db-4ef6-9acd-7ff457725e90	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-30 15:50:53.999	2026-04-01 00:00:00	252.00	30.00	11.50	10.00	0.700	1.60	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021025	\N	2026-01-23 00:33:04.19
432be3b9-7efa-4f3b-979d-0c883b5c9425	34501fa5-f6f6-42d1-a6eb-0253e3aca224	881fbd04-bea0-4542-86da-442e622acbf0	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-31 16:57:51	2026-04-30 00:00:00	69030.00	78000.00	7.00	10.00	0.300	188.26	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021027	\N	2026-01-23 00:33:04.209
759d14ef-490b-4d9a-9c5a-49bdff1574df	2b88bb4e-b627-4f62-b252-f713382e629f	69cefb79-a15d-4963-b6dc-a5ccc48157ad	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-04 13:42:33	2026-04-30 00:00:00	88.00	20.00	3.50	10.00	0.150	0.12	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021029	\N	2026-01-23 00:33:04.226
9d908402-cae5-4cb4-993c-8ef3c4a4dcb3	f0c18bd1-b7b2-4652-b536-05a4784552b6	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-13 07:09:03	2026-04-30 00:00:00	80.00	10.00	8.50	10.00	0.400	0.29	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021031	\N	2026-01-23 00:33:04.257
6be74ecc-b6ea-4954-97e1-6762039e7f56	f0889cce-f19b-4110-ad2f-478ecb61c07a	6656949a-2724-4f2e-9006-2a6e8d8ec499	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-03 09:47:14	2026-04-01 00:00:00	2450.00	500.00	13.00	10.00	1.000	22.27	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021039	\N	2026-01-23 00:33:04.32
52150559-4e51-4cc1-8156-999dbc4db134	132fe7a2-7b31-47ff-a989-0a441b4942c1	881fbd04-bea0-4542-86da-442e622acbf0	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-08-29 08:07:33	2026-04-30 00:00:00	54870.00	62000.00	4.50	10.00	0.180	89.79	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020984	\N	2026-01-23 00:33:03.708
633c224d-5e38-4fd5-ad67-4e5806eb56f7	f0889cce-f19b-4110-ad2f-478ecb61c07a	39c1af59-5e33-44ae-8fad-c6fc6b564f70	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	6000.00	300.00	8.50	10.00	0.400	21.82	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.751
1fa39c48-2c23-48b3-955c-7cd55901f27d	f0889cce-f19b-4110-ad2f-478ecb61c07a	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	4950.00	1800.00	3.50	10.00	0.150	6.75	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.765
f0ceec33-a55b-47e6-b41e-44c16348d2ed	132fe7a2-7b31-47ff-a989-0a441b4942c1	7b670399-1f79-4cd9-a542-608cac598bc4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	5370.00	300.00	3.50	10.00	0.150	7.32	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.799
3c7b4440-e946-4312-a90a-aefb0ed1d017	132fe7a2-7b31-47ff-a989-0a441b4942c1	e2c500d9-c30f-4c72-ba20-029545f1c4ee	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	1300.00	100.00	3.50	10.00	0.150	1.77	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.815
b78eed30-3f02-4077-b463-95adee3bc45a	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-17 16:11:46	2026-04-30 00:00:00	4140.00	90.00	3.50	10.00	0.150	5.65	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020996	\N	2026-01-23 00:33:03.898
ab1cf68f-2c63-4101-9745-4a30f0954117	132fe7a2-7b31-47ff-a989-0a441b4942c1	bf8c291a-cacd-465c-bab0-15b5b5d54841	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-18 14:32:11.999	2026-04-30 00:00:00	14000.00	400.00	3.50	10.00	0.150	19.09	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020997	\N	2026-01-23 00:33:03.918
bf035426-1546-4fc5-80df-6780e56d14c3	f0889cce-f19b-4110-ad2f-478ecb61c07a	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-26 16:10:44	2026-04-01 00:00:00	1248.00	160.00	3.50	10.00	0.150	1.70	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021002	\N	2026-01-23 00:33:03.957
8774c4df-950e-4a70-b1ee-e56084ed0be4	f0c18bd1-b7b2-4652-b536-05a4784552b6	c012d775-30e4-4f62-ab40-5df174373798	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-13 16:44:46	2026-04-30 00:00:00	1250.00	100.00	8.50	10.00	0.400	4.55	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021008	\N	2026-01-23 00:33:04.033
c03e1f40-0798-4a24-a37a-b957bc161d4b	79450858-a9c7-4b7f-a9cb-f9f38986e5f1	7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 14:01:20	2026-04-30 00:00:00	160.00	4.00	3.50	10.00	0.150	0.22	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021013	\N	2026-01-23 00:33:04.067
96916c18-43b1-4f38-9f3c-639a98cf69f4	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-15 11:20:17	2026-04-30 00:00:00	9600.00	1200.00	11.50	10.00	0.700	61.09	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021014	\N	2026-01-23 00:33:04.084
980fd6fc-0c7a-477b-9674-9c156ab3224b	34501fa5-f6f6-42d1-a6eb-0253e3aca224	9f80b449-bbfa-41bd-92ab-e013577f5ba7	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-29 11:46:28	2026-04-30 00:00:00	1125.00	225.00	3.50	10.00	0.150	1.53	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021024	\N	2026-01-23 00:33:04.171
e73efd2f-b8fc-4b67-9149-01d517b45591	34501fa5-f6f6-42d1-a6eb-0253e3aca224	2c57c0ac-c791-41d9-bbad-010ef0fc1f84	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-29 11:46:28	2026-04-30 00:00:00	17500.00	250.00	3.50	10.00	0.150	23.86	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021024	\N	2026-01-23 00:33:04.185
93e2ad72-453e-48c2-bf97-b5ab127f4a14	665c260d-2f5a-422b-b4f9-d924699ce260	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-31 07:49:04	2026-04-30 00:00:00	440.00	100.00	17.49	10.00	2.000	8.00	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021026	\N	2026-01-23 00:33:04.201
47360021-9330-41cc-8971-660fc5c884f8	2b88bb4e-b627-4f62-b252-f713382e629f	0dd27eaf-2905-4593-b8b3-e3df3f46ad5a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-04 13:42:33	2026-04-30 00:00:00	700.00	35.00	22.49	10.00	3.000	19.09	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021029	\N	2026-01-23 00:33:04.221
3aa0b336-d0ff-4bc8-82fb-40be9f790130	2b135e12-91f5-4142-ae36-9247a08c8c43	0c78c4e6-4190-4665-a5c4-6ed6777ad22a	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-15 08:16:51.999	2026-08-31 00:00:00	12760.00	22000.00	4.50	10.00	0.180	20.88	vermelha	\N	f	batch-1769128424605-d6rr866ns	925-180-8021049	\N	2026-01-23 00:33:44.701
74d0de03-dfc7-4fe0-a708-2aac6f2c9ece	f0889cce-f19b-4110-ad2f-478ecb61c07a	76b35b55-585b-44d2-8a20-8caaa5d573ac	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	8450.00	2500.00	8.50	10.00	0.400	30.73	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.74
4a339b2f-a761-419d-a30a-d5f089101fa7	132fe7a2-7b31-47ff-a989-0a441b4942c1	498b9d0c-d157-4285-96c9-cf638da3b9e9	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	38760.00	1200.00	3.50	10.00	0.150	52.85	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.786
246d038c-cdc5-4354-ad30-5af2995acca7	132fe7a2-7b31-47ff-a989-0a441b4942c1	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	1975.00	500.00	3.50	10.00	0.150	2.69	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.841
23f5763a-2ecc-423c-9a30-41d194637f4a	132fe7a2-7b31-47ff-a989-0a441b4942c1	d563beae-6141-4015-9cbe-b3453615146b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-16 07:10:13.999	2026-04-30 00:00:00	6200.00	400.00	3.50	10.00	0.150	8.45	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020992	\N	2026-01-23 00:33:03.862
33a11db2-c955-4181-a9af-ab99bce19e9d	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	7f0758d2-b395-4a5c-a7f4-a1adcf1034c1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-17 15:10:32	2026-04-30 00:00:00	700.00	35.00	3.50	10.00	0.150	0.95	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020995	\N	2026-01-23 00:33:03.883
261ae171-3f47-4763-9336-89787d3f62e2	3c8c279a-a06b-431c-969f-c53c1bbe1f60	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-26 13:36:39	2026-04-30 00:00:00	624.00	80.00	3.50	10.00	0.150	0.85	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021000	\N	2026-01-23 00:33:03.939
8bd39e87-99d7-444c-9c54-05afc5285feb	ad9e3b47-172a-4191-8001-c23556a17455	42cbc55a-b963-47ae-8666-fe631051994a	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-03 07:32:31	2026-04-01 00:00:00	54390.00	74000.00	6.50	10.00	0.200	98.89	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021004	\N	2026-01-23 00:33:03.978
51d73863-64b2-472e-9b28-bf640b4a7b05	665c260d-2f5a-422b-b4f9-d924699ce260	39c1af59-5e33-44ae-8fad-c6fc6b564f70	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-06 13:32:54	2026-04-30 00:00:00	500.00	25.00	8.50	10.00	0.400	1.82	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021005	\N	2026-01-23 00:33:03.995
92d0eee7-286b-454a-8b13-81bcce04ee17	3c8c279a-a06b-431c-969f-c53c1bbe1f60	c34db6db-36c5-495e-a3ef-e7b99f2b7208	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-13 13:48:19	2026-04-30 00:00:00	1750.00	500.00	8.50	10.00	0.400	6.36	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021007	\N	2026-01-23 00:33:04.012
61d11f07-6a0f-47d5-b3ed-1c78cd5257b7	665c260d-2f5a-422b-b4f9-d924699ce260	67a734ca-f12c-416c-a3f8-4f7434db90f3	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-22 07:14:01.999	2026-04-30 00:00:00	3560.00	4000.00	4.50	10.00	0.180	5.83	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021018	\N	2026-01-23 00:33:04.12
e5dfc6a1-df62-4be1-bf6b-bf9c07952ad6	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	9c96eb8a-236d-484e-a079-60a9e2361c80	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-27 14:03:04.999	2026-04-30 00:00:00	1595.00	11.00	3.50	10.00	0.150	2.18	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021021	\N	2026-01-23 00:33:04.137
444057a8-e72c-4d95-89f7-8c223c1136f6	665c260d-2f5a-422b-b4f9-d924699ce260	8274a979-5d13-4535-97ae-8fe8a7baaf9e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-28 09:22:23	2026-04-30 00:00:00	272.00	80.00	11.50	10.00	0.700	1.73	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021023	\N	2026-01-23 00:33:04.154
a77692e8-cffe-4b66-97ed-6e2eee6c7753	2b88bb4e-b627-4f62-b252-f713382e629f	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-04 14:10:45	2026-04-30 00:00:00	10240.00	320.00	3.50	10.00	0.150	13.96	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021030	\N	2026-01-23 00:33:04.24
88d9dfe9-01db-416b-b6f5-045db5f57899	f0c18bd1-b7b2-4652-b536-05a4784552b6	3b1994d3-cde7-4785-9e0e-f63683a01ae6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-13 07:09:03	2026-04-30 00:00:00	345.00	15.00	8.50	10.00	0.400	1.25	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021031	\N	2026-01-23 00:33:04.271
3cf6933b-776f-403b-8b97-1cc7b3438412	2b88bb4e-b627-4f62-b252-f713382e629f	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-18 09:46:43	2026-04-30 00:00:00	15820.00	56.00	8.50	10.00	0.400	57.53	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021034	\N	2026-01-23 00:33:04.285
fbd94222-408a-4afd-be2c-24a5aa1f4e7a	f0889cce-f19b-4110-ad2f-478ecb61c07a	2c57c0ac-c791-41d9-bbad-010ef0fc1f84	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-19 16:35:31	2026-04-01 00:00:00	1470.00	20.00	3.50	10.00	0.150	2.00	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021036	\N	2026-01-23 00:33:04.303
9b47a23b-02e0-4ba5-ab00-fc64e68f6fed	f0c18bd1-b7b2-4652-b536-05a4784552b6	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-03 16:35:50	2026-04-30 00:00:00	4970.00	140.00	8.50	10.00	0.400	18.07	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021041	\N	2026-01-23 00:33:04.331
2e3acfa5-fd38-4074-b74c-b03653c438c0	f0c18bd1-b7b2-4652-b536-05a4784552b6	da84ffce-bc90-4969-85dc-d201c75b5194	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-05 08:12:11	2026-04-30 00:00:00	720.00	6.00	3.50	10.00	0.150	0.98	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021044	\N	2026-01-23 00:33:04.347
32c510df-7550-4244-9f96-d8abb8a9f04b	2b135e12-91f5-4142-ae36-9247a08c8c43	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-06 09:38:40	2026-04-01 00:00:00	315.00	15.00	25.00	10.00	4.000	11.45	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021047	\N	2026-01-23 00:33:04.361
287e4a00-474e-451d-9a81-ba555320f54a	2b88bb4e-b627-4f62-b252-f713382e629f	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-15 07:07:01	2026-04-30 00:00:00	166.02	2.00	25.00	10.00	4.000	6.04	verde	3.00	f	batch-1769128382327-q8be4tbxb	925-180-8021048	\N	2026-01-23 00:33:04.378
7596ff8a-3d0d-4537-b821-8770758938d4	f0889cce-f19b-4110-ad2f-478ecb61c07a	3ec153fb-5149-4a2e-9306-173c0ec02d58	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	1128.00	60.00	3.50	10.00	0.150	1.54	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.747
2b84f524-0861-4267-8f70-88630d20bdd3	f0889cce-f19b-4110-ad2f-478ecb61c07a	eb2718a5-b60a-4eba-a6d1-af1e8d087d3f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-02 15:40:23	2026-04-01 00:00:00	9750.00	1500.00	8.50	10.00	0.400	35.45	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020989	\N	2026-01-23 00:33:03.761
f4002c37-06d2-48d1-9535-02bd500ab569	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	81581447-8003-440d-99f6-462d727b1ba1	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-03 10:23:11	2026-04-30 00:00:00	14110.00	170.00	25.00	10.00	4.000	513.09	verde	102.00	f	batch-1769128382327-q8be4tbxb	925-180-8020991	\N	2026-01-23 00:33:03.778
4d9d55d3-c055-42e9-896a-bb872ab6815f	6ffb9947-4b2a-4bea-b4ba-577d12e27d02	fcc7e0ec-83fd-4a4c-8010-36b73ec995e3	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-17 15:10:32	2026-04-30 00:00:00	1820.00	52.00	3.50	10.00	0.150	2.48	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8020995	\N	2026-01-23 00:33:03.893
e082a831-d360-40db-a23f-704469d9dc3a	3218243d-70e6-4538-8a19-50327cdb67e5	685f866f-cc84-442c-a048-6e731593cb31	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-26 14:26:59	2026-04-30 00:00:00	1260.00	300.00	3.50	10.00	0.150	1.72	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021001	\N	2026-01-23 00:33:03.949
0ec323fb-1278-47fd-a7a3-4fb36f0fabb2	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	9c96eb8a-236d-484e-a079-60a9e2361c80	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 08:39:17	2026-04-30 00:00:00	145.00	1.00	3.50	10.00	0.150	0.20	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021012	\N	2026-01-23 00:33:04.06
d231119f-4b45-4124-828b-de6908e31bb5	665c260d-2f5a-422b-b4f9-d924699ce260	45e62da5-2272-41bf-802d-8f6d88b750ee	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-15 11:08:52	2026-04-30 00:00:00	5310.00	150.00	25.00	10.00	4.000	193.09	verde	15.00	f	batch-1769128382327-q8be4tbxb	925-180-8020411	\N	2026-01-23 00:33:04.079
8b713f86-ba7f-4045-abcc-0ef873e58adc	34501fa5-f6f6-42d1-a6eb-0253e3aca224	925b3e38-77fe-437b-9395-ee7b16d8492e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-29 11:46:28	2026-04-30 00:00:00	2325.00	31.00	3.50	10.00	0.150	3.17	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021024	\N	2026-01-23 00:33:04.164
f5f8fbd4-c931-4c39-9584-fef5d8098ea6	665c260d-2f5a-422b-b4f9-d924699ce260	399eaa99-84b2-487c-a512-1ef4d6ef87af	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-31 07:49:04	2026-04-30 00:00:00	840.00	12.00	11.50	10.00	0.700	5.35	amarela	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021026	\N	2026-01-23 00:33:04.196
8f4ca1ca-1449-4123-8ffd-11c81d80ba7c	665c260d-2f5a-422b-b4f9-d924699ce260	76b35b55-585b-44d2-8a20-8caaa5d573ac	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-03 15:53:00	2026-04-30 00:00:00	1625.00	500.00	3.50	10.00	0.150	2.22	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021028	\N	2026-01-23 00:33:04.216
993ae770-53d4-4152-bfc3-7d2e6134f375	f0c18bd1-b7b2-4652-b536-05a4784552b6	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-13 07:09:03	2026-04-30 00:00:00	543.00	15.00	8.50	10.00	0.400	1.97	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021031	\N	2026-01-23 00:33:04.263
79366854-4f28-4b28-9dac-0a5cf5a8b04c	f0889cce-f19b-4110-ad2f-478ecb61c07a	5a44e426-7ce9-479e-9dcd-6124d90f68d1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-09-26 16:10:44	2026-04-01 00:00:00	282.00	15.00	3.50	10.00	0.150	0.38	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021002	\N	2026-01-23 00:33:03.965
86a8eccb-354d-4727-984e-761392ae5283	ad9e3b47-172a-4191-8001-c23556a17455	ab387b26-c9e7-47da-9870-e869fe1d1581	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-03 07:32:31	2026-04-01 00:00:00	41160.00	56000.00	4.50	10.00	0.180	67.35	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021004	\N	2026-01-23 00:33:03.984
9916c299-baef-45df-9733-df54a2128205	665c260d-2f5a-422b-b4f9-d924699ce260	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-06 13:32:54	2026-04-30 00:00:00	240.00	5.00	3.50	10.00	0.150	0.33	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021005	\N	2026-01-23 00:33:03.999
eeab67ab-5a5e-4c44-86ab-2ef6856fecf1	f0c18bd1-b7b2-4652-b536-05a4784552b6	399eaa99-84b2-487c-a512-1ef4d6ef87af	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-13 16:44:46	2026-04-30 00:00:00	1240.00	20.00	8.50	10.00	0.400	4.51	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021008	\N	2026-01-23 00:33:04.021
8ce1afbc-572f-4f56-9c28-73f09a98d9f2	f0c18bd1-b7b2-4652-b536-05a4784552b6	da84ffce-bc90-4969-85dc-d201c75b5194	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-14 07:07:32	2026-04-30 00:00:00	2400.00	20.00	3.50	10.00	0.150	3.27	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021009	\N	2026-01-23 00:33:04.042
f61f9c3a-6630-4db4-8cc5-3fcc582cb768	f0c18bd1-b7b2-4652-b536-05a4784552b6	da84ffce-bc90-4969-85dc-d201c75b5194	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-24 16:34:57.999	2026-04-30 00:00:00	2400.00	20.00	3.50	10.00	0.150	3.27	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021019	\N	2026-01-23 00:33:04.125
536e4b16-aa93-42e3-aea3-1c927b18d86c	665c260d-2f5a-422b-b4f9-d924699ce260	69cefb79-a15d-4963-b6dc-a5ccc48157ad	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-28 09:22:23	2026-04-30 00:00:00	540.00	120.00	3.50	10.00	0.150	0.74	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021023	\N	2026-01-23 00:33:04.142
80b43e10-532c-47cc-9ec0-9e703a2894e9	34501fa5-f6f6-42d1-a6eb-0253e3aca224	2bca2e1e-bba3-44a5-a8c9-fd05734783ae	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-29 11:46:28	2026-04-30 00:00:00	3000.00	600.00	3.50	10.00	0.150	4.09	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021024	\N	2026-01-23 00:33:04.178
a9331d42-787f-47ad-9766-165767dd72bd	f0c18bd1-b7b2-4652-b536-05a4784552b6	cfa09673-42b8-49ed-bf24-07eb500b9ed0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-13 07:09:03	2026-04-30 00:00:00	375.00	15.00	8.50	10.00	0.400	1.36	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021031	\N	2026-01-23 00:33:04.245
a6aacb38-af88-4fb9-bf28-1631de9e37a7	f0889cce-f19b-4110-ad2f-478ecb61c07a	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-15 08:36:45	2026-04-01 00:00:00	1232.50	145.00	8.50	10.00	0.400	4.48	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021032	\N	2026-01-23 00:33:04.275
795ebdc2-ce41-4c0f-9054-0a4506d8ec59	f0c18bd1-b7b2-4652-b536-05a4784552b6	1d83ca6a-a994-4bc9-81a7-fc121ba58394	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-19 10:22:15	2026-04-30 00:00:00	6792.00	12000.00	4.50	10.00	0.180	11.11	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021035	\N	2026-01-23 00:33:04.29
d3fc750c-bad2-440c-b227-304be015d623	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-11-21 08:14:58	2026-04-30 00:00:00	2400.00	300.00	13.00	10.00	1.000	21.82	verde	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021037	\N	2026-01-23 00:33:04.308
c4611eb0-8689-4352-b118-25ee17f3a347	f0c18bd1-b7b2-4652-b536-05a4784552b6	da84ffce-bc90-4969-85dc-d201c75b5194	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-03 16:35:50	2026-04-30 00:00:00	1920.00	16.00	3.50	10.00	0.150	2.62	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021041	\N	2026-01-23 00:33:04.336
80cb9620-500c-48c7-8520-e6d7208c48f0	f0c18bd1-b7b2-4652-b536-05a4784552b6	cfa09673-42b8-49ed-bf24-07eb500b9ed0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-05 08:12:11	2026-04-30 00:00:00	2241.00	90.00	3.50	10.00	0.150	3.06	abaixo_lista	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021044	\N	2026-01-23 00:33:04.352
59bf5c34-0a6a-412c-a3a7-44157d880bbc	2b135e12-91f5-4142-ae36-9247a08c8c43	893e0dbb-0e64-4ebc-ba39-79d72ed6faf7	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-06 09:38:40	2026-04-01 00:00:00	1170.00	100.00	8.50	10.00	0.400	4.25	vermelha	\N	f	batch-1769128382327-q8be4tbxb	925-180-8021047	\N	2026-01-23 00:33:04.368
d092e894-c035-41cf-a730-098fdb233873	f0889cce-f19b-4110-ad2f-478ecb61c07a	5a7c2266-28ce-41f6-be2f-95397d21d4f2	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-10-28 07:52:36.999	2026-08-31 00:00:00	2940.00	3000.00	4.50	10.00	0.180	4.81	vermelha	\N	f	batch-1769128424605-d6rr866ns	925-180-8021022	\N	2026-01-23 00:33:44.647
074b65d0-759f-43a1-989a-4fd2dd63d4ac	2b88bb4e-b627-4f62-b252-f713382e629f	81581447-8003-440d-99f6-462d727b1ba1	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-15 07:07:01	2026-04-30 00:00:00	5810.70	70.00	17.49	10.00	2.000	105.65	vermelha	42.00	f	batch-1769128382327-q8be4tbxb	925-180-8021048	\N	2026-01-23 00:33:04.373
22db2a35-4663-47d4-ae47-d52c91b46914	79450858-a9c7-4b7f-a9cb-f9f38986e5f1	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-06-18 11:39:31	2026-08-31 00:00:00	68040.00	180000.00	4.50	10.00	0.180	111.34	vermelha	\N	f	batch-1769128424605-d6rr866ns	925-180-8020951	\N	2026-01-23 00:33:44.628
c1596333-3e29-43b4-98ed-2c4c64c3d97a	f0c18bd1-b7b2-4652-b536-05a4784552b6	b3e48baa-c384-4414-a421-8af3a430ea2d	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-04 07:09:10	2026-08-31 00:00:00	378.00	1000.00	7.00	10.00	0.300	1.03	verde	\N	f	batch-1769128424605-d6rr866ns	925-180-8021043	\N	2026-01-23 00:33:44.668
6909d3a1-87ad-4007-a386-ffd201a7f010	dba9b70a-9bf9-4b8c-8937-099482b4f8bd	68169cfb-4ad8-457c-8851-2ae04f2ad409	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	d0187ffd-ee55-4a37-bd77-c16404f484ab	2025-12-05 08:39:14	2026-08-31 00:00:00	24300.00	27000.00	4.50	10.00	0.180	39.76	vermelha	\N	f	batch-1769128424605-d6rr866ns	925-180-8021045	\N	2026-01-23 00:33:44.682
ed5a6a69-04e2-40e3-8e9a-0141cfa784d1	b8ea484f-d42f-487b-937f-b1a1787d77e6	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2024-10-30 07:37:32	2026-04-01 00:00:00	46500.00	93000.00	4.50	10.00	0.180	76.09	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020404	\N	2026-01-23 00:38:10.68
12ab171e-ccf3-4abd-b84f-0d848a3c4524	436711ce-45fd-40a0-80ea-de439836644d	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2024-10-31 07:12:17	2026-04-01 00:00:00	10000.00	20000.00	4.50	10.00	0.180	16.36	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020405	\N	2026-01-23 00:38:10.698
1aa68788-e165-4618-a53c-ee3234d32de1	986e90b9-79e4-4f1f-8580-d81b63f34204	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2024-10-31 07:13:20	2026-04-01 00:00:00	91080.00	184000.00	4.50	10.00	0.180	149.04	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020406	\N	2026-01-23 00:38:10.72
47bcb355-bf41-4dc0-8ec0-ac5dea4a312f	08371fe5-a204-42ef-9e66-5904599d523e	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2024-11-13 13:38:34	2026-04-01 00:00:00	16000.00	32000.00	4.50	10.00	0.180	26.18	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020413	\N	2026-01-23 00:38:10.736
f9345a13-6d6b-431f-a532-ae858e47c98c	08371fe5-a204-42ef-9e66-5904599d523e	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	260.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.741
bfc4284f-7bcf-4dcc-9fa6-81a5c58f9b6b	08371fe5-a204-42ef-9e66-5904599d523e	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	4400.00	110.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.749
7ea1aadc-bd2c-451a-83c8-488310682634	08371fe5-a204-42ef-9e66-5904599d523e	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	5369.00	455.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.755
593b60c9-5b8e-443d-b7eb-3d095cd2cc91	08371fe5-a204-42ef-9e66-5904599d523e	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	258.00	60.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.762
ef09da2e-89b3-4420-9de7-2eaf84949fde	08371fe5-a204-42ef-9e66-5904599d523e	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	1462.50	75.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.768
5c9ad009-570f-4059-8df1-0774f988bd30	08371fe5-a204-42ef-9e66-5904599d523e	6656949a-2724-4f2e-9006-2a6e8d8ec499	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	3364.00	580.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.782
bd96bb93-c06f-4d1c-9b2f-d9637e2cd7e2	08371fe5-a204-42ef-9e66-5904599d523e	1c4bcfa3-8896-4a7b-a73e-d40176022714	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	2975.00	12500.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.789
041c4ee0-d970-4fcc-a7d5-aef3afbf341f	08371fe5-a204-42ef-9e66-5904599d523e	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	1926.00	20.00	0.00	10.00	0.000	0.00	barter	30.00	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.795
af766a58-e3e9-47c9-ab51-24b102e23733	08371fe5-a204-42ef-9e66-5904599d523e	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	3610.00	380.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.801
991b9f1f-0db4-4334-9203-26678641cab6	08371fe5-a204-42ef-9e66-5904599d523e	318cea20-e0f7-4da3-9a0d-1ec34c9238dc	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-01-27 09:11:44	2026-04-01 00:00:00	520.00	20.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020453	\N	2026-01-23 00:38:10.824
7f8c732f-c35a-4e3f-bad7-1054422ad977	81671ba4-967a-4586-beb2-5f12f0d88034	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-07 07:43:18	2026-04-30 00:00:00	57480.00	120000.00	4.50	10.00	0.180	94.06	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020468	\N	2026-01-23 00:38:10.841
ea963256-891e-4be5-bcdd-f3c9ae40c57c	c919b8b8-e2e1-4bea-9781-6fbb06bbc781	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-07 09:29:20	2026-04-01 00:00:00	44100.00	90000.00	4.50	10.00	0.180	72.16	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020469	\N	2026-01-23 00:38:10.856
b06566d2-f49a-4a77-bbcb-41e380257ff0	436711ce-45fd-40a0-80ea-de439836644d	87d3e1d2-afd2-4015-be36-a9d026e7db86	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:22:09	2026-04-01 00:00:00	94452.00	102000.00	6.50	10.00	0.200	171.73	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020477	\N	2026-01-23 00:38:10.862
1f273b2d-9c5d-4d80-b7c5-46ece867ca6c	436711ce-45fd-40a0-80ea-de439836644d	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:22:09	2026-04-01 00:00:00	16665.00	33000.00	4.50	10.00	0.180	27.27	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020477	\N	2026-01-23 00:38:10.871
4b97b2a1-63b3-460c-9dab-25287d4637fb	436711ce-45fd-40a0-80ea-de439836644d	15e3d29c-1e7e-45cc-829c-3b3c10ffe433	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	3564.00	54.00	13.00	10.00	1.000	32.40	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.882
934e4576-4c2c-4613-882e-b067f6168530	436711ce-45fd-40a0-80ea-de439836644d	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	2592.00	108.00	25.00	10.00	4.000	94.25	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.901
217c77ee-e119-4bf9-887a-b9a14474771d	436711ce-45fd-40a0-80ea-de439836644d	7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	1188.00	24.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.917
11329850-757a-4f8c-b008-4274c264905e	436711ce-45fd-40a0-80ea-de439836644d	c9ff0590-018a-40a5-a7da-801b22b39235	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	12070.00	340.00	25.00	10.00	4.000	438.91	verde	34.00	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.927
bf0b828b-71c0-4af7-8b30-a1ef1237ebaf	bc28dae4-4fe1-480e-adae-b56bdf70190f	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-26 07:19:27	2026-04-30 00:00:00	15150.00	30000.00	4.50	10.00	0.180	24.79	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020486	\N	2026-01-23 00:38:10.985
e11d5913-edeb-4742-a95c-66f3d006a280	08371fe5-a204-42ef-9e66-5904599d523e	eea6ba21-06d8-402a-a8f0-2b01580b2dac	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-26 14:56:06	2026-04-01 00:00:00	19150.00	50000.00	4.50	10.00	0.180	31.34	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020490	\N	2026-01-23 00:38:11.03
0afaead5-9b11-40cb-accf-4ae79167ad1c	57c0ca02-7f92-4fc4-b67b-a92936cd1c17	d71b7f9b-92e4-46b2-a1b0-0590b3c13660	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-28 15:51:31	2026-04-01 00:00:00	132250.00	250000.00	4.50	10.00	0.180	216.41	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020492	\N	2026-01-23 00:38:11.065
51693c21-0d28-423d-9669-e572639779b9	ceec2de5-59e5-4fb8-b091-53d0a171b094	ab0563ee-2893-49e8-9b90-2647b1c51493	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1076.25	175.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.127
044d9498-4d5b-473e-8605-f377c5aa5e6c	ceec2de5-59e5-4fb8-b091-53d0a171b094	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	208.00	8.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.142
e2fe0bf5-9942-49c0-b854-bf2ede67a29a	ceec2de5-59e5-4fb8-b091-53d0a171b094	7dcc6b1d-11c2-4b89-a160-fb3c1fd00926	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	216.00	4.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.15
d86bfe54-b484-444a-b375-ae251d2d649a	ceec2de5-59e5-4fb8-b091-53d0a171b094	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	3255.00	70.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.168
b44274a8-62c9-4f43-8feb-438a2cd01ccd	ceec2de5-59e5-4fb8-b091-53d0a171b094	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	600.00	100.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.207
ac6d2da9-6742-4fd3-a4e6-60202903514e	ceec2de5-59e5-4fb8-b091-53d0a171b094	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	3195.00	45.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.218
1a758b12-566d-4aac-be34-954a0f8be9f9	ceec2de5-59e5-4fb8-b091-53d0a171b094	d563beae-6141-4015-9cbe-b3453615146b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	891.00	45.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.228
c3bb78d7-b61b-4747-9cc5-044b909c9ef6	d5578c54-1326-4626-b277-b28dcbf4f413	b3f9348a-17de-403a-a320-0e603fccf01c	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-04-10 10:46:29	2026-04-01 00:00:00	185100.00	300000.00	4.50	10.00	0.180	302.89	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020514	\N	2026-01-23 00:38:11.302
7f8ab482-0d49-4869-8c16-932d7cb15b01	09881e5c-201d-4f89-8f78-0cf643344db0	22c8d8dd-add0-4510-bbc7-2486a5d4ca57	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-04-25 10:00:42.999	2026-04-01 00:00:00	5370.00	5.00	20.00	10.00	2.500	122.05	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020520	\N	2026-01-23 00:38:11.324
10f986e2-e2ac-4431-b832-62169c0b3ace	08371fe5-a204-42ef-9e66-5904599d523e	0dd27eaf-2905-4593-b8b3-e3df3f46ad5a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-02 11:26:49.999	2026-04-01 00:00:00	270.00	15.00	7.50	10.00	1.000	2.45	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020524	\N	2026-01-23 00:38:11.331
247f2992-caf6-44b1-a88b-2bb3cd9bc421	09881e5c-201d-4f89-8f78-0cf643344db0	67aaaba4-bec8-45be-bc05-dee01dce609a	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	3420.00	360.00	3.50	10.00	0.150	4.66	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.385
8d638613-9553-4dcb-bbb8-abbd61d47ff3	09881e5c-201d-4f89-8f78-0cf643344db0	d91ac8fa-306c-4b9d-bbaa-edaf3d4b8223	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	1000.00	80.00	3.50	10.00	0.150	1.36	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.391
78a59c9d-7f84-40b3-a2b5-feaaab930b4e	09881e5c-201d-4f89-8f78-0cf643344db0	babdfdca-dd9c-4952-a31b-90ae7a385d89	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	1680.00	140.00	3.50	10.00	0.150	2.29	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.403
d3114a98-d328-4f36-be68-ecf5a3ef8d4a	09881e5c-201d-4f89-8f78-0cf643344db0	bfe773b8-b217-4103-90c9-9a57a5146e1c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	1050.00	200.00	8.50	10.00	0.400	3.82	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.408
4637d15b-ba24-41ab-bb45-d68dcf919370	09881e5c-201d-4f89-8f78-0cf643344db0	cdd5c40f-54f7-4e58-9118-85d4ca7678fc	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	1260.00	300.00	3.50	10.00	0.150	1.72	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.413
20ed1a62-8e53-47a4-9b68-de84f4884ccc	436711ce-45fd-40a0-80ea-de439836644d	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	2580.00	600.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.934
596cd75c-cc9e-478d-b18c-1592ae51bae4	ceec2de5-59e5-4fb8-b091-53d0a171b094	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	877.50	45.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.192
ab89854f-71a8-4cae-accb-f131414717d2	09881e5c-201d-4f89-8f78-0cf643344db0	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	1790.00	200.00	3.50	10.00	0.150	2.44	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.395
8e3a79cc-6e3e-45c0-9074-a63de7675394	bc28dae4-4fe1-480e-adae-b56bdf70190f	87d3e1d2-afd2-4015-be36-a9d026e7db86	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-30 13:58:35.999	2026-04-30 00:00:00	80100.00	90000.00	2.00	10.00	0.150	109.23	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020534	\N	2026-01-23 00:38:11.459
4f67e12e-1a78-4558-b9a9-b8cd848468c7	986e90b9-79e4-4f1f-8580-d81b63f34204	a4f2105b-1316-418d-87d1-15d2c73e2aca	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-30 14:03:13	2026-04-01 00:00:00	1050.00	75.00	11.50	10.00	0.700	6.68	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020549	\N	2026-01-23 00:38:11.553
9106efd4-2ba5-48dc-95eb-b6344e44eeb6	08371fe5-a204-42ef-9e66-5904599d523e	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	416.00	16.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.578
be466253-0134-4240-8499-341cba801f83	08371fe5-a204-42ef-9e66-5904599d523e	33c903b5-7614-4e73-8c3f-add95ea8936f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	1715.00	70.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.605
ca3dc036-b832-4e0f-bf58-2567b68c3d1d	986e90b9-79e4-4f1f-8580-d81b63f34204	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-06 08:11:52	2026-04-01 00:00:00	11480.00	2800.00	3.50	10.00	0.150	15.65	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020559	\N	2026-01-23 00:38:11.658
9bc864e2-727b-4384-ace0-2cbb2a811ee9	c919b8b8-e2e1-4bea-9781-6fbb06bbc781	b3e48baa-c384-4414-a421-8af3a430ea2d	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-05 15:05:44	2026-04-01 00:00:00	3680.00	10000.00	2.00	10.00	0.150	5.02	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020577	\N	2026-01-23 00:38:11.84
a22427b3-4bc3-4b2c-8b7e-688e645c59cf	943807d5-5b0a-4de5-9e9c-98f8cb86974b	ca067208-c765-4cf6-b55d-d00b4f964342	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-15 13:59:41	2026-04-30 00:00:00	2100.00	300.00	8.50	10.00	0.400	7.64	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020582	\N	2026-01-23 00:38:11.863
64a2cee6-6864-46a6-9606-a121fcec1514	6d6adbf1-9288-4763-938f-b0f4bbd535d3	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-17 16:52:21	2026-04-01 00:00:00	1056.00	240.00	17.49	10.00	2.000	19.20	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020598	\N	2026-01-23 00:38:12.092
6e93ac17-13f4-4665-b0f4-6f2253d06a8c	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	15e3d29c-1e7e-45cc-829c-3b3c10ffe433	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	888.00	12.00	13.00	10.00	1.000	8.07	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.124
a8dc21b0-04a8-4e2c-ab92-73397b7c55ba	ceec2de5-59e5-4fb8-b091-53d0a171b094	76b35b55-585b-44d2-8a20-8caaa5d573ac	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 13:52:31	2026-04-01 00:00:00	150.00	40.00	13.00	10.00	1.000	1.36	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020606	\N	2026-01-23 00:38:12.186
4c9cc74f-b27e-4454-96b1-62a45c560dc6	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	880.00	160.00	25.00	10.00	4.000	32.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.219
77bbc2b9-537f-4545-89f8-16393d2627eb	57c0ca02-7f92-4fc4-b67b-a92936cd1c17	a4f2dc1d-17e2-4c16-8782-33a29080525b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-29 07:21:07	2026-04-01 00:00:00	2170.00	70.00	8.50	10.00	0.400	7.89	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020608	\N	2026-01-23 00:38:12.249
095c594c-0b32-4079-ab5c-5e5db2991c0b	524cacfc-6071-45ed-8003-12bb2c666e60	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-15 08:52:53	2026-04-01 00:00:00	405.00	45.00	8.50	10.00	0.400	1.47	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020615	\N	2026-01-23 00:38:12.325
841636bd-072a-47f1-831f-cc5b3a18be59	436711ce-45fd-40a0-80ea-de439836644d	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-20 10:04:48	2026-04-01 00:00:00	3171.00	151.00	25.00	10.00	4.000	115.31	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020621	\N	2026-01-23 00:38:12.361
3dbb0be2-7456-4c61-a386-b2432b984c49	08371fe5-a204-42ef-9e66-5904599d523e	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-21 07:53:44.999	2026-04-01 00:00:00	920.00	115.00	13.00	10.00	1.000	8.36	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020623	\N	2026-01-23 00:38:12.406
c9d5f552-8028-41b2-8c94-6a5fb416086d	436711ce-45fd-40a0-80ea-de439836644d	9f6c3d45-6185-4840-8a74-fce3e410debe	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	6426.00	270.00	11.50	10.00	0.700	40.89	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.948
9eeeadf4-8b41-43ad-a0ac-47def960c217	08371fe5-a204-42ef-9e66-5904599d523e	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-26 14:56:06	2026-04-01 00:00:00	5650.00	20.00	8.50	10.00	0.400	20.55	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020490	\N	2026-01-23 00:38:11.014
257bbb93-4744-4aa4-946b-255e136e8da5	ceec2de5-59e5-4fb8-b091-53d0a171b094	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	520.00	20.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.092
3767362e-4108-41df-9645-63d665e29ab4	ceec2de5-59e5-4fb8-b091-53d0a171b094	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1284.00	12.00	0.00	10.00	0.000	0.00	barter	18.00	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.258
56e4261d-d5b5-486d-a4b8-4c24e54d44ff	524cacfc-6071-45ed-8003-12bb2c666e60	87d3e1d2-afd2-4015-be36-a9d026e7db86	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-11 14:11:02	2026-04-01 00:00:00	85824.00	96000.00	6.50	10.00	0.200	156.04	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020500	\N	2026-01-23 00:38:11.289
12653620-a0eb-48b4-a5ee-da41d177c5b8	08371fe5-a204-42ef-9e66-5904599d523e	c7cf53a9-7f3a-4ffa-8ee0-21a0528717a0	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-02 11:26:49.999	2026-04-01 00:00:00	16.00	1.00	17.49	10.00	2.000	0.29	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020524	\N	2026-01-23 00:38:11.35
677f3bc2-39ad-4235-95ee-3cc2ad11afee	09881e5c-201d-4f89-8f78-0cf643344db0	fbcc281f-3764-4ae5-8667-52f48e548db6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	4100.00	200.00	3.50	10.00	0.150	5.59	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.376
ad807b06-61b3-4213-9afb-af35185e8655	08371fe5-a204-42ef-9e66-5904599d523e	53844242-406c-46ef-9d69-91a26466190c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-12 08:51:54.999	2026-04-01 00:00:00	114.00	60.00	3.50	10.00	0.150	0.16	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020530	\N	2026-01-23 00:38:11.437
0f3cd017-94b6-4957-a6df-d2874d15095f	6d6adbf1-9288-4763-938f-b0f4bbd535d3	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	3724.00	380.00	8.50	10.00	0.400	13.54	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.502
3ee52bd7-5906-4cd1-90ac-213c85d3fd37	6d6adbf1-9288-4763-938f-b0f4bbd535d3	9dc09213-5dc7-48e4-82f7-6abc161bd789	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:57:26	2026-04-01 00:00:00	60450.00	93000.00	4.50	10.00	0.180	98.92	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020537	\N	2026-01-23 00:38:11.529
067cfa4e-5ccc-4c44-abdb-0919ab876c49	08371fe5-a204-42ef-9e66-5904599d523e	1a584572-8d2b-459c-bdfa-781c76d49047	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	180.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.585
2014aa6b-de72-4b07-aea9-3e9ae1b4528e	89862059-fde7-4761-a498-b05f784b5d49	bec1c4e9-71ec-40a5-87f9-a9383fbc6301	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-22 11:14:42	2026-04-01 00:00:00	14925.00	500.00	8.50	10.00	0.400	54.27	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020556	\N	2026-01-23 00:38:11.642
a0878563-19f9-43e5-b4f8-b8cc28ff6e1f	2e777209-7c59-4736-8719-374d73ca9e36	0439c052-8d9a-4c0d-9b6a-6159dccd23fa	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-18 17:17:52	2026-04-01 00:00:00	15900.00	15.00	20.00	10.00	2.500	361.36	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020565	\N	2026-01-23 00:38:11.693
f8fa46d0-79a1-4f35-8c05-511c7bc0a6bf	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-20 16:58:55	2026-04-01 00:00:00	1352.00	520.00	3.50	10.00	0.150	1.84	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020567	\N	2026-01-23 00:38:11.723
517cb85f-c962-4904-8337-9e402c50ce18	08371fe5-a204-42ef-9e66-5904599d523e	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-28 11:57:32	2026-04-01 00:00:00	420.00	140.00	17.49	10.00	2.000	7.64	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020569	\N	2026-01-23 00:38:11.746
0f55fba1-0ebf-4459-8258-7c8129ad7559	2e777209-7c59-4736-8719-374d73ca9e36	90aba970-124d-4cc8-9039-5e77ae5a74e4	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-29 08:52:55	2026-04-30 00:00:00	19740.00	420.00	3.50	10.00	0.150	26.92	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020571	\N	2026-01-23 00:38:11.769
bda1010a-ab35-4f47-9ff1-826febc3ff4a	943807d5-5b0a-4de5-9e9c-98f8cb86974b	7228cbce-5cf2-4d09-964d-07aadfb0eb77	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 11:31:20.999	2026-04-30 00:00:00	80.00	20.00	3.50	10.00	0.150	0.11	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020574	\N	2026-01-23 00:38:11.798
552698f1-0802-438f-9cab-fd503bfe6c91	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	646b17a8-af78-46ec-8c07-28e7c6c866a7	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	175.00	5.00	3.50	10.00	0.150	0.24	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.133
e62bec2a-a929-4b89-9358-d220c0dc225a	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	b7202d06-e9f6-4801-acb7-bd297df76c97	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	2544.00	480.00	13.00	10.00	1.000	23.13	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.227
da9c714e-77b3-426c-9f4c-17686bfc91a1	ceec2de5-59e5-4fb8-b091-53d0a171b094	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-28 14:10:05	2026-04-01 00:00:00	125.00	5.00	25.00	10.00	4.000	4.55	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020627	\N	2026-01-23 00:38:12.457
fcc45215-be84-4c34-9702-3873c3cdcb50	81671ba4-967a-4586-beb2-5f12f0d88034	bf8c291a-cacd-465c-bab0-15b5b5d54841	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-04 11:36:39	2026-04-30 00:00:00	6660.00	180.00	13.00	10.00	1.000	60.55	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020629	\N	2026-01-23 00:38:12.489
c3ffb493-96ff-41e2-ad94-353b326bc197	2e777209-7c59-4736-8719-374d73ca9e36	09e5ea57-00d9-4bd3-950b-367d29b63080	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-11 07:31:04	2026-04-01 00:00:00	97.50	15.00	13.00	10.00	1.000	0.89	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020633	\N	2026-01-23 00:38:12.52
658b9447-3134-4930-9a89-28c4e5cb789f	436711ce-45fd-40a0-80ea-de439836644d	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	5350.00	50.00	0.00	10.00	0.000	0.00	barter	75.00	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.954
9455d613-135a-494e-9661-f4f05935f762	ceec2de5-59e5-4fb8-b091-53d0a171b094	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	3789.50	11.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.103
a1fcf769-d0e9-4b7f-acd0-bf20c3ef3c91	ceec2de5-59e5-4fb8-b091-53d0a171b094	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1342.00	220.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.263
a62efab9-e8de-48ae-95f0-3afc122888df	08371fe5-a204-42ef-9e66-5904599d523e	c0ebf995-bf13-4507-83c1-4dd4662212bf	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-02 11:26:49.999	2026-04-01 00:00:00	4620.00	1400.00	3.50	10.00	0.150	6.30	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020524	\N	2026-01-23 00:38:11.354
eb184845-0095-4e06-8179-9cda6fe2f104	6d6adbf1-9288-4763-938f-b0f4bbd535d3	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	344.00	80.00	25.00	10.00	4.000	12.51	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.507
2bcea527-0497-4c3d-a3d2-21f24585ccd0	08371fe5-a204-42ef-9e66-5904599d523e	c2835407-b6f8-4585-bf49-9cc7f864d90e	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 09:05:10.999	2026-04-01 00:00:00	2610.00	100.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020547	\N	2026-01-23 00:38:11.534
a378fc5b-55ad-422f-87bd-3985c0289223	08371fe5-a204-42ef-9e66-5904599d523e	13c21dc1-82d9-4a7b-89ea-8ef7ca50549f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	875.00	5.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.592
d7f4b0fd-f7b5-4d8c-9da6-b38b562ac76c	08371fe5-a204-42ef-9e66-5904599d523e	b686b85c-099a-4f6e-b27d-25cff7d1c67b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	480.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.621
0bcf54fb-4715-40a3-b393-8a641ff0fac6	bc28dae4-4fe1-480e-adae-b56bdf70190f	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-30 11:01:28	2026-04-30 00:00:00	3520.00	40.00	25.00	10.00	4.000	128.00	verde	60.00	f	batch-1769128690658-0flwwszmu	925-180-8020557	\N	2026-01-23 00:38:11.647
fb6823e5-c15a-437e-b42d-a74b8fbb1fef	2e777209-7c59-4736-8719-374d73ca9e36	22c8d8dd-add0-4510-bbc7-2486a5d4ca57	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-18 17:17:52	2026-04-01 00:00:00	3860.00	5.00	17.49	10.00	2.000	70.18	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020565	\N	2026-01-23 00:38:11.698
7fe6a2be-34c8-41eb-bff0-62ce5d18ebe1	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-20 16:58:55	2026-04-01 00:00:00	1911.00	260.00	3.50	10.00	0.150	2.61	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020567	\N	2026-01-23 00:38:11.727
6e7a593d-d5e9-48a3-9df9-a9ea630f703f	08371fe5-a204-42ef-9e66-5904599d523e	39c1af59-5e33-44ae-8fad-c6fc6b564f70	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-28 11:57:32	2026-04-01 00:00:00	2000.00	100.00	3.50	10.00	0.150	2.73	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020569	\N	2026-01-23 00:38:11.75
7cad1541-138d-4e6e-944c-ec7e9da3ac8e	b8ea484f-d42f-487b-937f-b1a1787d77e6	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-29 11:51:34	2026-04-01 00:00:00	156.00	60.00	3.50	10.00	0.150	0.21	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020572	\N	2026-01-23 00:38:11.775
d4dcc894-ce53-49d0-8898-d8a32eb39afc	943807d5-5b0a-4de5-9e9c-98f8cb86974b	69cefb79-a15d-4963-b6dc-a5ccc48157ad	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 11:31:20.999	2026-04-30 00:00:00	4240.00	1060.00	3.50	10.00	0.150	5.78	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020574	\N	2026-01-23 00:38:11.803
c499072f-740a-4473-9852-5c206db53f5b	2e777209-7c59-4736-8719-374d73ca9e36	0f1e6647-4e42-4b7b-b8a6-9ce17e9826ff	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-18 09:09:18	2026-04-30 00:00:00	2362.50	105.00	3.50	10.00	0.150	3.22	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020584	\N	2026-01-23 00:38:11.879
44bf25e7-5f13-4ad6-9828-17a6441aa846	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	d50b3606-e635-4c66-b3d9-1cacfc1bac72	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	360.00	20.00	7.50	10.00	1.000	3.27	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.141
4c3c4483-fef8-4f58-9617-a1c090ecda16	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	33c903b5-7614-4e73-8c3f-add95ea8936f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	1600.00	100.00	13.00	10.00	1.000	14.55	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.234
3af88756-4e82-46e0-818a-8a2d022b2149	08371fe5-a204-42ef-9e66-5904599d523e	3de5c394-7045-4429-b843-bd5d082c4891	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-04 08:12:30	2026-04-01 00:00:00	141.00	3.00	8.50	10.00	0.400	0.51	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020610	\N	2026-01-23 00:38:12.266
e5baf14b-36b5-426e-89b5-176b549de884	ceec2de5-59e5-4fb8-b091-53d0a171b094	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-28 14:10:05	2026-04-01 00:00:00	64.00	20.00	25.00	10.00	4.000	2.33	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020627	\N	2026-01-23 00:38:12.463
1c72c565-f405-402f-8305-7e2275b314c6	08371fe5-a204-42ef-9e66-5904599d523e	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-05 16:21:13	2026-04-01 00:00:00	294.00	30.00	13.00	10.00	1.000	2.67	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020631	\N	2026-01-23 00:38:12.495
c11b07ff-8b0e-4140-9e11-a7a7c7a065f5	b8ea484f-d42f-487b-937f-b1a1787d77e6	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-15 07:30:33	2026-04-01 00:00:00	1352.00	520.00	3.50	10.00	0.150	1.84	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020635	\N	2026-01-23 00:38:12.526
cb8024e9-efb3-4ba1-8caa-e494b50769eb	436711ce-45fd-40a0-80ea-de439836644d	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	10829.00	340.00	0.00	10.00	0.000	0.00	barter	34.00	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.958
611a327b-f0c7-458b-a811-78f34dea8689	ceec2de5-59e5-4fb8-b091-53d0a171b094	4859161e-5b69-42e7-86e3-f9b6779da644	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1908.00	60.00	25.00	10.00	4.000	69.38	verde	6.00	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.107
048dc8bb-df22-4b09-8c0d-b0d80d4269fe	ceec2de5-59e5-4fb8-b091-53d0a171b094	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1140.00	120.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.269
0609d4b7-bd7e-44a9-ac1d-962ef30621cf	09881e5c-201d-4f89-8f78-0cf643344db0	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	600.00	24.00	25.00	10.00	4.000	21.82	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.359
fb883793-50aa-4fb5-98fc-ccc74e68386d	6d6adbf1-9288-4763-938f-b0f4bbd535d3	0dd27eaf-2905-4593-b8b3-e3df3f46ad5a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	880.00	40.00	25.00	10.00	4.000	32.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.478
60f82401-c9d4-4590-b383-09894795be2c	6d6adbf1-9288-4763-938f-b0f4bbd535d3	22c8d8dd-add0-4510-bbc7-2486a5d4ca57	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	16790.40	18.00	20.00	10.00	2.500	381.60	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.513
708947f2-6e66-4f2e-a86f-3b5ee998ec8e	986e90b9-79e4-4f1f-8580-d81b63f34204	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-27 10:28:48	2026-04-01 00:00:00	39550.00	140.00	8.50	10.00	0.400	143.82	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020548	\N	2026-01-23 00:38:11.539
38ce6449-1e4e-4d5b-a958-4250d17402c9	08371fe5-a204-42ef-9e66-5904599d523e	c9ff0590-018a-40a5-a7da-801b22b39235	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	2720.00	80.00	0.00	10.00	0.000	0.00	barter	8.00	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.597
d4037c06-6422-4d45-a9a9-b85f8a4aad8b	08371fe5-a204-42ef-9e66-5904599d523e	110113ab-7c6a-450e-a328-6578f4b53002	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-12 11:17:23	2026-04-01 00:00:00	1900.00	1000.00	13.00	10.00	1.000	17.27	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020554	\N	2026-01-23 00:38:11.625
02954532-9149-4839-a94f-1ecdedea7819	09881e5c-201d-4f89-8f78-0cf643344db0	e52ff46a-777a-49f5-91fa-bd8684caf7bd	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-18 07:45:26.999	2026-04-01 00:00:00	3420.00	360.00	8.50	10.00	0.400	12.44	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020564	\N	2026-01-23 00:38:11.677
64329f1a-3344-4711-828f-e1f984d186fe	81671ba4-967a-4586-beb2-5f12f0d88034	68f79595-d9ba-4142-a36e-6a9d0582247c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-25 10:45:11	2026-04-30 00:00:00	12666.00	600.00	25.00	10.00	4.000	460.58	verde	60.00	f	batch-1769128690658-0flwwszmu	925-180-8020568	\N	2026-01-23 00:38:11.732
008aa2b5-3cd3-4a06-bf94-b3af17c98b31	08371fe5-a204-42ef-9e66-5904599d523e	c6a6965c-0ac6-442c-a973-98d35dd8c754	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-28 11:57:32	2026-04-01 00:00:00	178.00	20.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020569	\N	2026-01-23 00:38:11.756
2a77e506-c7e3-4dcd-871f-925327ab7bb8	b8ea484f-d42f-487b-937f-b1a1787d77e6	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-01 09:35:12	2026-04-01 00:00:00	156.00	60.00	3.50	10.00	0.150	0.21	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020573	\N	2026-01-23 00:38:11.781
9ddff762-e0a0-49c9-8f84-941201c74464	943807d5-5b0a-4de5-9e9c-98f8cb86974b	ca067208-c765-4cf6-b55d-d00b4f964342	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 11:31:20.999	2026-04-30 00:00:00	6860.00	980.00	8.50	10.00	0.400	24.95	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020574	\N	2026-01-23 00:38:11.807
8f0ed032-92dd-43eb-924c-21ec0c05aad6	2e777209-7c59-4736-8719-374d73ca9e36	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-18 09:09:18	2026-04-30 00:00:00	2028.00	26.00	25.00	10.00	4.000	73.75	verde	39.00	f	batch-1769128690658-0flwwszmu	925-180-8020584	\N	2026-01-23 00:38:11.884
9028957d-9d3f-4e18-8554-e9318ab68b2c	2e777209-7c59-4736-8719-374d73ca9e36	9c283d69-7f84-4cc1-a68a-179bc0292144	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-13 07:07:36	2026-04-01 00:00:00	15900.00	14400.00	20.00	10.00	2.500	361.36	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020594	\N	2026-01-23 00:38:11.976
eb0489f5-2b96-4730-abfd-e63e6163431d	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	80ed733c-2893-427c-be8d-c941167476d5	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	600.00	12.00	7.50	10.00	1.000	5.45	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.148
1ce46662-c6fc-456c-8f9b-586bae107713	57c0ca02-7f92-4fc4-b67b-a92936cd1c17	a4f2dc1d-17e2-4c16-8782-33a29080525b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-05 16:21:39.999	2026-04-01 00:00:00	2170.00	70.00	8.50	10.00	0.400	7.89	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020611	\N	2026-01-23 00:38:12.274
1b28e8e4-d18d-4ee6-ab5e-1e01fa222c93	ceec2de5-59e5-4fb8-b091-53d0a171b094	ae3cd83f-31db-4ef6-9acd-7ff457725e90	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-28 14:10:05	2026-04-01 00:00:00	88.00	10.00	13.00	10.00	1.000	0.80	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020627	\N	2026-01-23 00:38:12.473
18068fe8-b526-4448-a889-b68edad3c976	bc28dae4-4fe1-480e-adae-b56bdf70190f	bf26680f-d38c-4e59-af79-b4466bc9ed6e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-10 07:24:35	2026-04-30 00:00:00	1320.00	200.00	13.00	10.00	1.000	12.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020632	\N	2026-01-23 00:38:12.502
00163b54-f42c-403f-bc31-f7b24ad7b376	b8ea484f-d42f-487b-937f-b1a1787d77e6	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-15 07:30:33	2026-04-01 00:00:00	1911.00	260.00	3.50	10.00	0.150	2.61	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020635	\N	2026-01-23 00:38:12.536
ea80db2e-f0db-4ddb-bc49-9a6b11cdccd9	436711ce-45fd-40a0-80ea-de439836644d	318cea20-e0f7-4da3-9a0d-1ec34c9238dc	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-17 09:50:42.999	2026-04-01 00:00:00	2025.00	54.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020478	\N	2026-01-23 00:38:10.971
6c1e3faa-a955-49e8-a11a-3ecc830634c1	d5578c54-1326-4626-b277-b28dcbf4f413	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-26 07:21:43.999	2026-04-01 00:00:00	150000.00	300000.00	4.50	10.00	0.180	245.45	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020487	\N	2026-01-23 00:38:11.002
7b8a96d1-b3fb-4d7f-a3a5-1a1e55594eab	ceec2de5-59e5-4fb8-b091-53d0a171b094	110113ab-7c6a-450e-a328-6578f4b53002	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	464.00	160.00	13.00	10.00	1.000	4.22	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.112
1d487a39-8413-4b7a-9440-4d49398a2e37	ceec2de5-59e5-4fb8-b091-53d0a171b094	03110e2f-9bf9-4f59-87ab-54fe35ae0b32	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	3471.30	87.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.244
23f3b159-da11-4ae7-9ac9-6f7153920f8a	ceec2de5-59e5-4fb8-b091-53d0a171b094	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1911.00	60.00	0.00	10.00	0.000	0.00	barter	6.00	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.274
767cb671-9b8a-4f27-906b-4d0eee8d86fa	986e90b9-79e4-4f1f-8580-d81b63f34204	003b09fe-9073-4449-a223-928ba34a1834	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-04-23 17:10:02	2026-04-01 00:00:00	37440.00	36.00	20.00	10.00	2.500	850.91	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020519	\N	2026-01-23 00:38:11.31
d531a5a2-ebe5-44cd-b38d-8259cb713252	08371fe5-a204-42ef-9e66-5904599d523e	1bfda8af-b959-46ea-81fd-d920ff3d3994	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-02 11:26:49.999	2026-04-01 00:00:00	800.00	80.00	3.50	10.00	0.150	1.09	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020524	\N	2026-01-23 00:38:11.339
44e48ad4-6d8a-4f67-8e14-3ee4c009f013	09881e5c-201d-4f89-8f78-0cf643344db0	76b35b55-585b-44d2-8a20-8caaa5d573ac	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	945.00	300.00	3.50	10.00	0.150	1.29	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.364
e8ef7716-208a-4172-9f50-345dde04a914	6d6adbf1-9288-4763-938f-b0f4bbd535d3	110113ab-7c6a-450e-a328-6578f4b53002	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	1504.80	760.00	13.00	10.00	1.000	13.68	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.483
9e4c9647-512e-4f60-9ec0-240d153463b0	6d6adbf1-9288-4763-938f-b0f4bbd535d3	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	1343.25	135.00	13.00	10.00	1.000	12.21	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.518
e05695cf-9984-4087-9ffa-a06e944738f8	81671ba4-967a-4586-beb2-5f12f0d88034	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-25 10:45:11	2026-04-30 00:00:00	6916.80	80.00	25.00	10.00	4.000	251.52	verde	120.00	f	batch-1769128690658-0flwwszmu	925-180-8020568	\N	2026-01-23 00:38:11.737
e2955550-4446-4d4a-a265-ef48cfd21678	524cacfc-6071-45ed-8003-12bb2c666e60	68f79595-d9ba-4142-a36e-6a9d0582247c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-29 07:46:42.999	2026-04-01 00:00:00	5232.00	240.00	25.00	10.00	4.000	190.25	verde	24.00	f	batch-1769128690658-0flwwszmu	925-180-8020570	\N	2026-01-23 00:38:11.76
9f4ffeec-d894-4ced-b174-8ec67b1cd1cf	943807d5-5b0a-4de5-9e9c-98f8cb86974b	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 11:31:20.999	2026-04-30 00:00:00	35680.00	8920.00	3.50	10.00	0.150	48.65	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020574	\N	2026-01-23 00:38:11.811
7e47f6f7-a1f8-4e18-8b9a-571b0f3b7b11	08371fe5-a204-42ef-9e66-5904599d523e	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-18 15:43:48	2026-04-01 00:00:00	1040.00	40.00	25.00	10.00	4.000	37.82	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020585	\N	2026-01-23 00:38:11.89
8e180cb8-0b7b-4a5f-a0b5-5c5f65b662d4	08371fe5-a204-42ef-9e66-5904599d523e	c6d77238-e8b0-49bd-9f76-47b152c9f4ff	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-01 07:26:40	2026-04-01 00:00:00	154.00	20.00	8.50	10.00	0.400	0.56	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020587	\N	2026-01-23 00:38:11.921
75680998-7a79-4a9e-9d77-50c0e8b98132	2e777209-7c59-4736-8719-374d73ca9e36	0db8ac66-34f3-41bf-8c9f-69dff846328c	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-03 09:47:54.999	2026-04-01 00:00:00	12720.00	480.00	20.00	10.00	2.500	289.09	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020592	\N	2026-01-23 00:38:11.953
6fcae7c3-8fa3-4511-8935-9c39b4eb07ee	2e777209-7c59-4736-8719-374d73ca9e36	27314b08-b8e9-442f-af78-e960fc83b1d8	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-13 07:07:36	2026-04-01 00:00:00	742.50	45.00	25.00	10.00	4.000	27.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020594	\N	2026-01-23 00:38:11.981
bfae9c57-82f8-4237-9652-265bc24bf9e9	436711ce-45fd-40a0-80ea-de439836644d	98a18c3e-c3cb-4289-8f18-927efeeea89e	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:14:13	2026-04-01 00:00:00	45.00	2.00	20.00	10.00	2.500	1.02	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020596	\N	2026-01-23 00:38:12.011
723231c8-31f8-401e-a23f-d5d0fbbd889c	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	a7dfd9fa-bb24-4ab3-bd44-5b6300d3dfff	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	936.00	12.00	22.49	10.00	3.000	25.53	amarela	18.00	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.153
e4f9dd60-5e8e-4ac0-b5fd-e7bfcfdfc8ad	08371fe5-a204-42ef-9e66-5904599d523e	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-07 11:59:50	2026-04-01 00:00:00	600.00	40.00	11.50	10.00	0.700	3.82	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020612	\N	2026-01-23 00:38:12.28
a2da285f-8bb1-4715-9b86-5716d7549242	2e777209-7c59-4736-8719-374d73ca9e36	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-01 17:01:20.999	2026-04-30 00:00:00	1130.00	4.00	8.50	10.00	0.400	4.11	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020628	\N	2026-01-23 00:38:12.477
c12a89ad-0ca0-4a6c-a5b6-203db0135db5	2e777209-7c59-4736-8719-374d73ca9e36	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-11 07:31:04	2026-04-01 00:00:00	730.00	20.00	13.00	10.00	1.000	6.64	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020633	\N	2026-01-23 00:38:12.507
3b5ba99c-eea6-448e-a63c-9bc7694d85cb	08371fe5-a204-42ef-9e66-5904599d523e	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-26 14:56:06	2026-04-01 00:00:00	792.00	36.00	17.49	10.00	2.000	14.40	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020490	\N	2026-01-23 00:38:11.007
ed8bba2d-2578-4751-9bc1-a6b812555e38	524cacfc-6071-45ed-8003-12bb2c666e60	c580d67c-3b7c-47f7-b0e9-e02dbcb147c8	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-02-28 07:49:41	2026-04-01 00:00:00	31310.00	62000.00	4.50	10.00	0.180	51.23	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020491	\N	2026-01-23 00:38:11.041
cfd4ed64-eb8e-410e-bfec-20915c979da7	ceec2de5-59e5-4fb8-b091-53d0a171b094	7a433be0-dbd4-4ce0-b4e8-cde2c4366793	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	19800.00	30000.00	4.50	10.00	0.180	32.40	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.081
e17c600a-5a1e-4f49-930d-07fa1d019047	ceec2de5-59e5-4fb8-b091-53d0a171b094	31d9bd02-7834-47d2-9e12-8a6d2cfa0aec	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	962.50	55.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.251
9f93935d-0783-457b-8ba5-e0b96f5a498a	ceec2de5-59e5-4fb8-b091-53d0a171b094	c0ebf995-bf13-4507-83c1-4dd4662212bf	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-03-07 09:53:10	2026-04-01 00:00:00	1936.00	440.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020498	\N	2026-01-23 00:38:11.282
daf551d4-3c7b-4942-ad23-c75bd317d199	08371fe5-a204-42ef-9e66-5904599d523e	cac7eb90-2489-4abd-87df-88b5eb91fa0a	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-02 11:26:49.999	2026-04-01 00:00:00	30.00	10.00	3.50	10.00	0.150	0.04	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020524	\N	2026-01-23 00:38:11.344
1d5b7f42-639a-441f-a572-8e7354eae31d	09881e5c-201d-4f89-8f78-0cf643344db0	53844242-406c-46ef-9d69-91a26466190c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 08:29:19	2026-04-01 00:00:00	2492.00	1400.00	3.50	10.00	0.150	3.40	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020527	\N	2026-01-23 00:38:11.371
b00f807c-b7ad-478e-8abf-5cad7753ab0a	08371fe5-a204-42ef-9e66-5904599d523e	c4e64b3f-02cc-46e0-b886-a38e0291d809	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-06 09:21:51	2026-04-01 00:00:00	480.00	10.00	12.50	10.00	1.500	6.55	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020529	\N	2026-01-23 00:38:11.429
b3fde59b-4566-4afe-8ce6-47cd461b3922	6d6adbf1-9288-4763-938f-b0f4bbd535d3	9d408d5b-d9df-4c51-9738-efd88e1f398c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	2544.00	80.00	25.00	10.00	4.000	92.51	verde	16.00	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.489
55eb801e-b39e-44e1-be99-4989676ee17e	6d6adbf1-9288-4763-938f-b0f4bbd535d3	c0ebf995-bf13-4507-83c1-4dd4662212bf	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 13:51:40	2026-04-01 00:00:00	3696.00	960.00	8.50	10.00	0.400	13.44	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020536	\N	2026-01-23 00:38:11.524
eb2fb387-ffd4-4bbe-a78f-1429454fc33d	81671ba4-967a-4586-beb2-5f12f0d88034	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-25 10:45:11	2026-04-30 00:00:00	14490.00	600.00	25.00	10.00	4.000	526.91	verde	60.00	f	batch-1769128690658-0flwwszmu	925-180-8020568	\N	2026-01-23 00:38:11.741
38df7a22-4eb5-4f1b-b2e9-05044fc3d15e	524cacfc-6071-45ed-8003-12bb2c666e60	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-29 07:46:42.999	2026-04-01 00:00:00	2494.00	100.00	25.00	10.00	4.000	90.69	verde	10.00	f	batch-1769128690658-0flwwszmu	925-180-8020570	\N	2026-01-23 00:38:11.764
6eaac935-7193-44cb-8c0a-5bd900b78680	b8ea484f-d42f-487b-937f-b1a1787d77e6	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-30 08:06:49.999	2026-04-01 00:00:00	288.00	16.00	17.49	10.00	2.000	5.24	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020586	\N	2026-01-23 00:38:11.897
099be2c1-4518-47e7-9a64-d01109750cd6	08371fe5-a204-42ef-9e66-5904599d523e	9d408d5b-d9df-4c51-9738-efd88e1f398c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-10 14:52:30.999	2026-04-01 00:00:00	558.00	20.00	25.00	10.00	4.000	20.29	verde	4.00	f	batch-1769128690658-0flwwszmu	925-180-8020593	\N	2026-01-23 00:38:11.96
4fbfdea0-12d4-4d78-bbd9-0a41354f06be	ceec2de5-59e5-4fb8-b091-53d0a171b094	54fc4439-cbe4-4b54-acde-4f0402fcc9a1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:57:00	2026-04-01 00:00:00	176.00	20.00	13.00	10.00	1.000	1.60	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020597	\N	2026-01-23 00:38:12.061
461ec0e6-6cc0-4fa6-9695-7b6850e9280f	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	f468505a-821c-441f-af81-b8ad9f5d570b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 15:13:18	2026-04-01 00:00:00	478.00	25.00	13.00	10.00	1.000	4.35	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020602	\N	2026-01-23 00:38:12.16
84e043d5-0e23-42fe-b40e-d7d156bc87b9	80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	00fc835b-843d-481f-9372-133dce973bbc	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-25 08:25:51	2026-04-30 00:00:00	2482.48	310.00	13.00	10.00	1.000	22.57	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020626	\N	2026-01-23 00:38:12.447
75ed6d94-3b57-404d-99c5-f72baf3706ee	2e777209-7c59-4736-8719-374d73ca9e36	ab0563ee-2893-49e8-9b90-2647b1c51493	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-01 17:01:20.999	2026-04-30 00:00:00	275.00	50.00	11.50	10.00	0.700	1.75	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020628	\N	2026-01-23 00:38:12.484
043cc2b4-054b-4cd0-9fee-8b36e81fd0f9	2e777209-7c59-4736-8719-374d73ca9e36	b7202d06-e9f6-4801-acb7-bd297df76c97	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-11 07:31:04	2026-04-01 00:00:00	260.00	40.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020633	\N	2026-01-23 00:38:12.512
81139bed-6555-47fa-aa7b-7cd1a9901949	c919b8b8-e2e1-4bea-9781-6fbb06bbc781	b3e48baa-c384-4414-a421-8af3a430ea2d	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-05 09:59:22	2026-04-01 00:00:00	17664.00	48000.00	4.50	10.00	0.180	28.90	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020528	\N	2026-01-23 00:38:11.418
48578210-07b3-4e26-8980-a233f6d002d6	81671ba4-967a-4586-beb2-5f12f0d88034	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-26 08:10:15	2026-04-30 00:00:00	3580.00	10000.00	2.00	10.00	0.150	4.88	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020532	\N	2026-01-23 00:38:11.453
a7391902-5ef3-4459-9aa3-60f1f533fa61	08371fe5-a204-42ef-9e66-5904599d523e	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	220.00	10.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.573
ce85c5e2-89c5-4824-a05a-175fff8063d2	986e90b9-79e4-4f1f-8580-d81b63f34204	ca067208-c765-4cf6-b55d-d00b4f964342	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-06 08:11:52	2026-04-01 00:00:00	9792.00	1360.00	8.50	10.00	0.400	35.61	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020559	\N	2026-01-23 00:38:11.654
14ace1b4-10e7-4eb7-8c51-8045c96c3a81	986e90b9-79e4-4f1f-8580-d81b63f34204	f468505a-821c-441f-af81-b8ad9f5d570b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-19 16:48:57	2026-04-01 00:00:00	2820.00	150.00	8.50	10.00	0.400	10.25	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020566	\N	2026-01-23 00:38:11.708
1a1710ed-77b5-4a9f-89ae-bb29a2ebbc03	b8ea484f-d42f-487b-937f-b1a1787d77e6	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-03 08:30:51	2026-04-01 00:00:00	1911.00	260.00	3.50	10.00	0.150	2.61	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020576	\N	2026-01-23 00:38:11.835
b29180a2-1156-467e-94aa-0b7afbe88ae5	b8ea484f-d42f-487b-937f-b1a1787d77e6	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-09 18:42:02	2026-04-01 00:00:00	1470.00	200.00	3.50	10.00	0.150	2.00	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020581	\N	2026-01-23 00:38:11.859
128c7f57-cbe9-4c0f-814b-2bdf6e254beb	ceec2de5-59e5-4fb8-b091-53d0a171b094	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:57:00	2026-04-01 00:00:00	128.00	40.00	25.00	10.00	4.000	4.65	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020597	\N	2026-01-23 00:38:12.054
866430e7-2424-4f2d-bc8f-09c51d53d6c7	6d6adbf1-9288-4763-938f-b0f4bbd535d3	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-17 16:52:21	2026-04-01 00:00:00	7200.00	240.00	3.50	10.00	0.150	9.82	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020598	\N	2026-01-23 00:38:12.084
ac4e96c9-667a-4c60-98ba-6b94d652acaf	986e90b9-79e4-4f1f-8580-d81b63f34204	d563beae-6141-4015-9cbe-b3453615146b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-20 15:33:30.999	2026-04-01 00:00:00	8900.00	500.00	13.00	10.00	1.000	80.91	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020601	\N	2026-01-23 00:38:12.117
88fbf6a2-1fd1-4589-90b8-097349bea2e5	986e90b9-79e4-4f1f-8580-d81b63f34204	ab0563ee-2893-49e8-9b90-2647b1c51493	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-27 16:08:41	2026-04-01 00:00:00	19950.00	4200.00	8.50	10.00	0.400	72.55	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020605	\N	2026-01-23 00:38:12.18
306d917f-0c72-46df-9a85-6f542d9fc801	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	468.00	180.00	25.00	10.00	4.000	17.02	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.212
232b36f1-dde8-43d1-abbe-f7fb49032417	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	09e5ea57-00d9-4bd3-950b-367d29b63080	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	356.00	50.00	13.00	10.00	1.000	3.24	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.244
ec45835c-eeb7-486b-ba2b-4d6a6015a42d	524cacfc-6071-45ed-8003-12bb2c666e60	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-15 08:52:53	2026-04-01 00:00:00	2640.00	80.00	13.00	10.00	1.000	24.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020615	\N	2026-01-23 00:38:12.319
f3e8e595-8335-4fc0-802e-b97cc2bd0d8b	436711ce-45fd-40a0-80ea-de439836644d	3b17fa90-f1a1-4c37-b811-1e75a808e175	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-20 10:04:48	2026-04-01 00:00:00	8400.00	28.00	13.00	10.00	1.000	76.36	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020621	\N	2026-01-23 00:38:12.356
21e0c111-0be6-436c-8d9b-ed34ffa481e8	08371fe5-a204-42ef-9e66-5904599d523e	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-21 07:53:44.999	2026-04-01 00:00:00	3840.00	120.00	13.00	10.00	1.000	34.91	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020623	\N	2026-01-23 00:38:12.397
bd510e31-3f4d-4645-aee4-85d0de4bd50e	80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	09e5ea57-00d9-4bd3-950b-367d29b63080	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-25 08:25:51	2026-04-30 00:00:00	130.00	20.00	13.00	10.00	1.000	1.18	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020626	\N	2026-01-23 00:38:12.437
02272ec9-529d-4500-9365-503c42f979ea	bc28dae4-4fe1-480e-adae-b56bdf70190f	415302ec-446d-48ea-8f0b-2f6a9be39074	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-05-21 14:13:40.999	2026-04-30 00:00:00	2398.50	410.00	3.50	10.00	0.150	3.27	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020531	\N	2026-01-23 00:38:11.447
29e13dda-cd07-41c3-9780-041fa86446dd	08371fe5-a204-42ef-9e66-5904599d523e	c63d1533-f020-4dab-916f-ce90870db47e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-09 08:12:18	2026-04-01 00:00:00	158.00	10.00	11.50	10.00	0.700	1.01	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020552	\N	2026-01-23 00:38:11.569
9ccd9986-199b-4b5a-ba62-3958c417fe0e	b8ea484f-d42f-487b-937f-b1a1787d77e6	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-03 08:30:51	2026-04-01 00:00:00	1352.00	520.00	3.50	10.00	0.150	1.84	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020576	\N	2026-01-23 00:38:11.831
65ac6927-b556-4e96-b56b-6039d70834b8	ceec2de5-59e5-4fb8-b091-53d0a171b094	3158b5ad-a4f1-4e03-93c0-6492e5f0914c	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-08 08:10:08	2026-04-01 00:00:00	245.00	4.00	3.50	10.00	0.150	0.33	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020579	\N	2026-01-23 00:38:11.855
beff2ae1-7704-49d4-bba7-939aa5090b13	b8ea484f-d42f-487b-937f-b1a1787d77e6	318cea20-e0f7-4da3-9a0d-1ec34c9238dc	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-30 08:06:49.999	2026-04-01 00:00:00	424.00	16.00	7.50	10.00	1.000	3.85	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020586	\N	2026-01-23 00:38:11.912
5fb2f4d1-b651-4d5e-a5c2-432c8b376d56	08371fe5-a204-42ef-9e66-5904599d523e	c6d77238-e8b0-49bd-9f76-47b152c9f4ff	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-03 09:15:39.999	2026-04-01 00:00:00	693.00	90.00	8.50	10.00	0.400	2.52	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020591	\N	2026-01-23 00:38:11.943
1fbbf29f-84c7-4dfc-9be3-7181e5ae3ce7	436711ce-45fd-40a0-80ea-de439836644d	a1b69bc2-fc1e-4b83-b419-cd72ee8c616e	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:14:13	2026-04-01 00:00:00	51.16	2.00	20.00	10.00	2.500	1.16	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020596	\N	2026-01-23 00:38:11.999
a3e41ff8-6e83-4ba0-827e-c3140db46c63	ceec2de5-59e5-4fb8-b091-53d0a171b094	bf26680f-d38c-4e59-af79-b4466bc9ed6e	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:57:00	2026-04-01 00:00:00	472.00	80.00	13.00	10.00	1.000	4.29	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020597	\N	2026-01-23 00:38:12.048
c404e66e-8b12-445a-ad7e-944dc8b22d92	6d6adbf1-9288-4763-938f-b0f4bbd535d3	971d36d8-a308-4156-95e7-aac5b0875e16	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-17 16:52:21	2026-04-01 00:00:00	10373.40	36.00	8.50	10.00	0.400	37.72	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020598	\N	2026-01-23 00:38:12.079
78f02935-f415-4386-b184-fe39b7982dd2	6d6adbf1-9288-4763-938f-b0f4bbd535d3	c2835407-b6f8-4585-bf49-9cc7f864d90e	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-20 11:04:34.999	2026-04-01 00:00:00	2080.00	80.00	7.00	10.00	0.300	5.67	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020599	\N	2026-01-23 00:38:12.111
d04f51f9-74c4-43c4-91d3-155b1514c925	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-23 07:29:23	2026-04-01 00:00:00	1040.00	400.00	17.49	10.00	2.000	18.91	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020604	\N	2026-01-23 00:38:12.174
dec2b492-6b10-4edb-9ae9-6bb52b5c3211	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	31da263e-8dc8-470e-823e-a98664693df6	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	3840.00	120.00	13.00	10.00	1.000	34.91	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.205
a0c1af33-2238-410a-a046-f1e4370f8eb4	80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	cdd5c40f-54f7-4e58-9118-85d4ca7678fc	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-14 08:34:44	2026-04-30 00:00:00	4504.50	990.00	3.50	10.00	0.150	6.14	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020614	\N	2026-01-23 00:38:12.309
56e5fb95-93a3-4fcf-8f74-652e24aadd3b	bc28dae4-4fe1-480e-adae-b56bdf70190f	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-19 13:45:17	2026-04-30 00:00:00	8000.00	1000.00	3.50	10.00	0.150	10.91	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020619	\N	2026-01-23 00:38:12.347
ccec625c-d757-4292-a403-137100180252	08371fe5-a204-42ef-9e66-5904599d523e	80ea8298-bf1b-416e-a7a1-217c0775ec9f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-21 07:53:44.999	2026-04-01 00:00:00	110.00	5.00	25.00	10.00	4.000	4.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020623	\N	2026-01-23 00:38:12.389
3e697c2d-8cf0-4b0b-8fff-4c530b4e8fa0	bc28dae4-4fe1-480e-adae-b56bdf70190f	8da5b76f-fff1-472e-b014-7fb2954914ba	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-24 10:58:26.999	2026-04-30 00:00:00	3500.00	700.00	25.00	10.00	4.000	127.27	verde	28.00	f	batch-1769128690658-0flwwszmu	925-180-8020625	\N	2026-01-23 00:38:12.43
3044ab59-653b-4bda-98eb-8f6aa36e60b7	bc28dae4-4fe1-480e-adae-b56bdf70190f	4341413f-cc3e-41c2-b70f-c93ff5fdd521	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-03 10:46:06	2026-04-30 00:00:00	5100.00	1200.00	8.50	10.00	0.400	18.55	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020535	\N	2026-01-23 00:38:11.465
ce5e69eb-8fa8-44c2-8647-bfca0a24f4bf	c919b8b8-e2e1-4bea-9781-6fbb06bbc781	ee6b528f-6297-4aef-b2bf-78f4f50b5d17	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-30 17:13:52.999	2026-04-01 00:00:00	1700.00	200.00	3.50	10.00	0.150	2.32	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020550	\N	2026-01-23 00:38:11.559
ce77c621-d0f7-42eb-8a9a-1def76539fae	08371fe5-a204-42ef-9e66-5904599d523e	c6a6965c-0ac6-442c-a973-98d35dd8c754	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-11 10:40:34.999	2026-04-01 00:00:00	534.00	60.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020553	\N	2026-01-23 00:38:11.611
04b7e271-51dd-49e5-a65b-56782afc4b8a	b8ea484f-d42f-487b-937f-b1a1787d77e6	002dbade-3475-4cb1-b586-cc9176223624	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-14 10:56:21	2026-04-01 00:00:00	2600.00	1000.00	3.50	10.00	0.150	3.55	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020563	\N	2026-01-23 00:38:11.663
2b8fc591-57f0-4544-b2a2-14f36b7551a2	943807d5-5b0a-4de5-9e9c-98f8cb86974b	5caa37ec-8450-48e2-a033-9a81ec9db4f5	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 11:31:20.999	2026-04-30 00:00:00	140.00	20.00	3.50	10.00	0.150	0.19	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020574	\N	2026-01-23 00:38:11.82
33855ff5-5f0d-4ff7-b5fd-e65b09b71d8d	c919b8b8-e2e1-4bea-9781-6fbb06bbc781	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-05 15:05:44	2026-04-01 00:00:00	1472.00	4000.00	2.00	10.00	0.150	2.01	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020577	\N	2026-01-23 00:38:11.845
4a13a24d-bf41-47de-a7d5-76939dbda434	986e90b9-79e4-4f1f-8580-d81b63f34204	003b09fe-9073-4449-a223-928ba34a1834	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-16 10:26:41	2026-04-01 00:00:00	1040.00	1.00	20.00	10.00	2.500	23.64	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020583	\N	2026-01-23 00:38:11.871
5734a19c-3a84-4018-b0af-45fe8ba08351	986e90b9-79e4-4f1f-8580-d81b63f34204	f14373fe-e339-4754-bfd0-0f74d5133ac5	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-01 09:59:21	2026-04-01 00:00:00	31560.00	30000.00	6.50	10.00	0.200	57.38	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020588	\N	2026-01-23 00:38:11.931
6d29e51b-d64c-496d-a51b-924d77c70505	436711ce-45fd-40a0-80ea-de439836644d	4a556efc-c08e-41ad-b924-f1ebd57cfee5	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:14:13	2026-04-01 00:00:00	75.00	2.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128690658-0flwwszmu	925-180-8020596	\N	2026-01-23 00:38:12.031
da8b764d-0d46-4947-931e-83b3ee47e681	6d6adbf1-9288-4763-938f-b0f4bbd535d3	6656949a-2724-4f2e-9006-2a6e8d8ec499	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-17 16:52:21	2026-04-01 00:00:00	3744.00	720.00	13.00	10.00	1.000	34.04	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020598	\N	2026-01-23 00:38:12.099
e820d570-5497-4c3f-bf5f-f8c2a25fd02c	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	cfa09673-42b8-49ed-bf24-07eb500b9ed0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	2280.00	100.00	13.00	10.00	1.000	20.73	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.192
6ec49ba7-57f6-4990-bb32-652dcd12185a	57c0ca02-7f92-4fc4-b67b-a92936cd1c17	a4f2dc1d-17e2-4c16-8782-33a29080525b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-29 13:33:58.999	2026-04-01 00:00:00	930.00	30.00	8.50	10.00	0.400	3.38	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020609	\N	2026-01-23 00:38:12.255
6038a6dd-7c1f-4233-b142-52588a067fc4	bc28dae4-4fe1-480e-adae-b56bdf70190f	69a854f3-573d-4ab7-90d5-7b3d7b793e1f	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-11 11:26:24	2026-04-30 00:00:00	3300.00	75.00	8.50	10.00	0.400	12.00	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020613	\N	2026-01-23 00:38:12.29
85075aea-0ed9-4be0-bbb4-74c42ece1ae9	524cacfc-6071-45ed-8003-12bb2c666e60	d247a049-407d-4afd-8c55-49fdfd847562	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-18 14:46:45	2026-04-01 00:00:00	45.00	5.00	8.50	10.00	0.400	0.16	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020616	\N	2026-01-23 00:38:12.333
51a8d39c-c4f6-4838-9d2b-a8072511e420	436711ce-45fd-40a0-80ea-de439836644d	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-20 10:04:48	2026-04-01 00:00:00	5440.00	340.00	13.00	10.00	1.000	49.45	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020621	\N	2026-01-23 00:38:12.366
c51f7200-7c6e-4826-a391-343bf83d6459	524cacfc-6071-45ed-8003-12bb2c666e60	68f79595-d9ba-4142-a36e-6a9d0582247c	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-24 10:39:28	2026-04-01 00:00:00	3933.00	190.00	25.00	10.00	4.000	143.02	verde	19.00	f	batch-1769128690658-0flwwszmu	925-180-8020624	\N	2026-01-23 00:38:12.414
be1fa78e-2bdf-426d-8295-295e1a1af3f2	08371fe5-a204-42ef-9e66-5904599d523e	3c0dca95-1a4e-4a2a-8ed5-6d4e8267e834	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-07-08 07:30:04.999	2026-04-01 00:00:00	9297.68	166030.00	4.50	10.00	0.180	15.21	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020551	\N	2026-01-23 00:38:11.564
adba4b24-9d28-4089-965a-6348af4d50ec	b8ea484f-d42f-487b-937f-b1a1787d77e6	8552703f-6803-486a-88e3-52749ae90e71	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-14 10:56:21	2026-04-01 00:00:00	2600.00	1000.00	17.49	10.00	2.000	47.27	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020563	\N	2026-01-23 00:38:11.669
be5d53bc-244b-4d24-a21b-49eebca178ba	b8ea484f-d42f-487b-937f-b1a1787d77e6	486ced41-d45a-45c6-bc20-dbe92b52dbc8	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-02 17:19:27.999	2026-04-01 00:00:00	735.00	100.00	3.50	10.00	0.150	1.00	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020575	\N	2026-01-23 00:38:11.825
3afd650f-5a6b-4d7d-a1a9-2a09b86098d6	08371fe5-a204-42ef-9e66-5904599d523e	b8dc677e-da87-4826-bbc9-20557f7d5b8a	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-08 07:40:51	2026-04-01 00:00:00	416.00	16.00	25.00	10.00	4.000	15.13	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020578	\N	2026-01-23 00:38:11.85
e82f5e1a-3224-4a97-920d-5b7d90a18a3c	b8ea484f-d42f-487b-937f-b1a1787d77e6	80ed733c-2893-427c-be8d-c941167476d5	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-30 08:06:49.999	2026-04-01 00:00:00	1000.00	20.00	7.50	10.00	1.000	9.09	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020586	\N	2026-01-23 00:38:11.906
d8f5456b-2b49-4ddb-938d-ef08a199258d	bc28dae4-4fe1-480e-adae-b56bdf70190f	87d3e1d2-afd2-4015-be36-a9d026e7db86	cat-fertilizantes	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-01 14:57:41	2026-04-30 00:00:00	4660.00	5000.00	6.50	10.00	0.200	8.47	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020589	\N	2026-01-23 00:38:11.938
e794e91c-6284-4757-9261-31246a055d5e	2e777209-7c59-4736-8719-374d73ca9e36	08db4050-1ce4-4af3-a42c-78c28e233293	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-13 07:07:36	2026-04-01 00:00:00	3860.00	6.00	20.00	10.00	2.500	87.73	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020594	\N	2026-01-23 00:38:11.968
b8a592b6-c716-4a98-ba9d-553b2c679327	80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	8fe67e60-f497-4bf7-9574-293819b309f1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-14 14:29:46	2026-04-30 00:00:00	144.00	5.00	3.50	10.00	0.150	0.20	abaixo_lista	\N	f	batch-1769128690658-0flwwszmu	925-180-8020595	\N	2026-01-23 00:38:11.994
fc31e126-b297-4ab8-a82e-eaa3f7f9c80d	436711ce-45fd-40a0-80ea-de439836644d	0db8ac66-34f3-41bf-8c9f-69dff846328c	cat-sem-soja	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:14:13	2026-04-01 00:00:00	53.00	2.00	20.00	10.00	2.500	1.20	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020596	\N	2026-01-23 00:38:12.039
e2022032-e0de-458f-bf4b-57dc313d38cb	ceec2de5-59e5-4fb8-b091-53d0a171b094	b65c7596-f146-4883-890a-20469e058dbb	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-15 07:57:00	2026-04-01 00:00:00	187.50	480.00	13.00	10.00	1.000	1.70	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020597	\N	2026-01-23 00:38:12.07
05312b0f-e0cc-4820-ac51-14209f1ceaaa	6d6adbf1-9288-4763-938f-b0f4bbd535d3	4859161e-5b69-42e7-86e3-f9b6779da644	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-20 11:04:34.999	2026-04-01 00:00:00	540.00	20.00	25.00	10.00	4.000	19.64	verde	2.00	f	batch-1769128690658-0flwwszmu	925-180-8020599	\N	2026-01-23 00:38:12.104
61348c51-8f04-41f8-8543-3c315f10faf9	57c0ca02-7f92-4fc4-b67b-a92936cd1c17	a4f2dc1d-17e2-4c16-8782-33a29080525b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-21 17:01:14	2026-04-01 00:00:00	930.00	30.00	8.50	10.00	0.400	3.38	vermelha	\N	f	batch-1769128690658-0flwwszmu	925-180-8020603	\N	2026-01-23 00:38:12.169
6fbb0ef9-e4e2-44c6-a5e3-795ea9ad0392	c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	df693222-739b-4a45-8c0b-e4eb675ab49b	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-28 15:25:47	2026-04-01 00:00:00	3960.00	120.00	13.00	10.00	1.000	36.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020607	\N	2026-01-23 00:38:12.197
7b1bd9e6-c412-4b57-8e98-81c88aede2b6	80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	8fe67e60-f497-4bf7-9574-293819b309f1	cat-agroquimicos	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-14 08:34:44	2026-04-30 00:00:00	144.00	5.00	11.50	10.00	0.700	0.92	amarela	\N	f	batch-1769128690658-0flwwszmu	925-180-8020614	\N	2026-01-23 00:38:12.299
8e3cd8fb-3a49-440e-ba0d-cf31c28afaa8	436711ce-45fd-40a0-80ea-de439836644d	8da5b76f-fff1-472e-b014-7fb2954914ba	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-19 11:39:48	2026-04-01 00:00:00	1650.00	300.00	7.50	10.00	1.000	15.00	abaixo_lista	12.00	f	batch-1769128690658-0flwwszmu	925-180-8020618	\N	2026-01-23 00:38:12.339
68387369-a539-463e-ba3b-708cb43c9a3b	ceec2de5-59e5-4fb8-b091-53d0a171b094	37e6e467-d925-40b2-aee5-ba4515c9c38f	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-20 11:53:21	2026-04-01 00:00:00	110.00	20.00	25.00	10.00	4.000	4.00	verde	\N	f	batch-1769128690658-0flwwszmu	925-180-8020622	\N	2026-01-23 00:38:12.377
3f99e842-18e4-4a32-8018-1877d5e0f589	524cacfc-6071-45ed-8003-12bb2c666e60	366be9b7-51e7-41d2-98c3-02801fa01245	cat-especialidades	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-24 10:39:28	2026-04-01 00:00:00	249.40	10.00	25.00	10.00	4.000	9.07	verde	1.00	f	batch-1769128690658-0flwwszmu	925-180-8020624	\N	2026-01-23 00:38:12.421
92b44d93-8353-4bba-9cd9-ba25f38185f6	943807d5-5b0a-4de5-9e9c-98f8cb86974b	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-06 08:08:07	2026-08-31 00:00:00	350000.00	1000000.00	4.50	10.00	0.180	572.73	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020373	\N	2026-01-23 00:39:10.567
eb731236-5fa5-4313-adf2-de2a91cd57ee	943807d5-5b0a-4de5-9e9c-98f8cb86974b	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-17 16:15:29	2026-08-31 00:00:00	186000.00	500000.00	4.50	10.00	0.180	304.36	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020539	\N	2026-01-23 00:39:10.578
baf662a8-67bb-42a2-8316-a0234360521a	08371fe5-a204-42ef-9e66-5904599d523e	d8af6973-cd5c-43e6-9b7f-a6847755cadd	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-18 08:24:16	2026-08-31 00:00:00	23232.00	33000.00	4.50	10.00	0.180	38.02	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020540	\N	2026-01-23 00:39:10.604
ae4f1523-8a9e-46cc-8667-05bc1356536a	08371fe5-a204-42ef-9e66-5904599d523e	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-18 08:24:16	2026-08-31 00:00:00	4940.00	13000.00	4.50	10.00	0.180	8.08	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020540	\N	2026-01-23 00:39:10.61
4e8f2e7a-adc5-415a-acda-14d5a8c2c4d9	524cacfc-6071-45ed-8003-12bb2c666e60	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-18 15:05:02.999	2026-08-31 00:00:00	11749.00	31000.00	4.50	10.00	0.180	19.23	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020541	\N	2026-01-23 00:39:10.625
cec53f0f-49a8-4477-b030-3bbe17bb7885	81671ba4-967a-4586-beb2-5f12f0d88034	f0e65f8e-878b-4412-9535-a4da27184252	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-20 07:50:08	2026-08-31 00:00:00	23100.00	60000.00	4.50	10.00	0.180	37.80	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020542	\N	2026-01-23 00:39:10.637
b70831f0-e296-425a-a621-8ad32611b2c6	986e90b9-79e4-4f1f-8580-d81b63f34204	0c78c4e6-4190-4665-a5c4-6ed6777ad22a	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-23 15:29:32	2026-08-31 00:00:00	126000.00	200000.00	7.00	10.00	0.300	343.64	verde	\N	f	batch-1769128750541-914a9crq1	925-180-8020544	\N	2026-01-23 00:39:10.652
ee221286-9363-4017-a029-4c2a97be9d8f	c9471230-74c9-4e91-85c2-d8d38bb2e794	0c78c4e6-4190-4665-a5c4-6ed6777ad22a	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-24 08:13:25	2026-08-31 00:00:00	38440.00	62000.00	7.00	10.00	0.300	104.84	verde	\N	f	batch-1769128750541-914a9crq1	925-180-8020545	\N	2026-01-23 00:39:10.668
1269aa49-54d9-44c6-9e68-b67696f3b027	08371fe5-a204-42ef-9e66-5904599d523e	53cce7e1-a59a-45ff-b438-89634cff7d02	cat-sem-milho	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	11400.00	60.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.677
dba4d231-cf5a-459e-9a58-0de4e9cf13d8	08371fe5-a204-42ef-9e66-5904599d523e	88d9bc90-4711-4361-a387-99d343b4c20a	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	3330.00	30.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.723
7d53a8c2-b1be-41e1-9512-40120c29b8d7	08371fe5-a204-42ef-9e66-5904599d523e	9f6c3d45-6185-4840-8a74-fce3e410debe	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	2912.00	140.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.759
45af225c-d42a-4ea5-bfef-a21bddb44d15	08371fe5-a204-42ef-9e66-5904599d523e	56f268e6-db73-4c5e-9a30-e928198d71cb	cat-especialidades	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	420.00	70.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.783
8aba63d5-b6b3-40e0-951a-9d42857403d0	2e18593d-202f-4f13-8208-34e7dfda26c6	512a7e54-0223-4529-bfd9-971508c9efc8	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-06 08:14:54	2026-08-31 00:00:00	196540.00	317000.00	2.00	10.00	0.150	268.01	abaixo_lista	\N	f	batch-1769128750541-914a9crq1	925-180-8020560	\N	2026-01-23 00:39:10.801
32946890-ff47-41a5-a342-82964cc75922	08371fe5-a204-42ef-9e66-5904599d523e	b95129bd-92dd-4580-80da-da1ce98fe4a0	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-08-13 07:58:07	2026-08-31 00:00:00	3705.00	390.00	11.50	10.00	0.700	23.58	amarela	\N	f	batch-1769128750541-914a9crq1	925-180-8020562	\N	2026-01-23 00:39:10.812
124830b6-f1c5-489e-819a-801967cbe4bc	986e90b9-79e4-4f1f-8580-d81b63f34204	26ea181f-59a5-47cb-a289-74382a4f51ee	cat-sem-milho	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-08 14:49:07.999	2026-08-31 00:00:00	49500.00	300.00	12.50	10.00	1.500	675.00	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020580	\N	2026-01-23 00:39:10.823
869851b5-607e-443a-ba86-bdf333ee4d67	986e90b9-79e4-4f1f-8580-d81b63f34204	67660da4-6c7a-433a-a5f6-cee50e85c4ba	cat-sem-milho	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-08 14:49:07.999	2026-08-31 00:00:00	1800.00	10.00	17.49	10.00	2.000	32.73	amarela	\N	f	batch-1769128750541-914a9crq1	925-180-8020580	\N	2026-01-23 00:39:10.842
af61b1f7-d219-4d43-a500-5579f7c653f1	bc28dae4-4fe1-480e-adae-b56bdf70190f	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-20 09:11:45.999	2026-08-31 00:00:00	8000.00	1000.00	3.50	10.00	0.150	10.91	abaixo_lista	\N	f	batch-1769128750541-914a9crq1	925-180-8020620	\N	2026-01-23 00:39:10.882
80169c52-7b3f-40f0-8c26-a983133cb00a	08371fe5-a204-42ef-9e66-5904599d523e	c0ebf995-bf13-4507-83c1-4dd4662212bf	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	539.00	140.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.686
9c307de9-f35e-4d3d-9fd8-5105c2de28f0	08371fe5-a204-42ef-9e66-5904599d523e	91ee0bc0-e9c8-49ca-928e-ef69cdf01269	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	4158.00	252.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.733
f0a91700-89e4-4511-a106-687bcb5a5db6	bc28dae4-4fe1-480e-adae-b56bdf70190f	b3e48baa-c384-4414-a421-8af3a430ea2d	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-10-02 14:50:41	2026-10-30 00:00:00	21700.00	62000.00	2.00	10.00	0.150	29.59	abaixo_lista	\N	f	batch-1769128750541-914a9crq1	925-180-8020590	\N	2026-01-23 00:39:10.856
6e6de1a8-4031-43cc-a84a-47beed7146d3	09881e5c-201d-4f89-8f78-0cf643344db0	4859161e-5b69-42e7-86e3-f9b6779da644	cat-especialidades	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-05 13:37:17	2026-08-31 00:00:00	1540.00	70.00	25.00	10.00	4.000	56.00	verde	7.00	f	batch-1769128750541-914a9crq1	925-180-8020630	\N	2026-01-23 00:39:10.903
cdb5912c-3d3f-405a-8af0-1bf1b7eaaeef	08371fe5-a204-42ef-9e66-5904599d523e	8b1b21a7-5e84-4c6f-bd88-68547f7156f0	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	1365.00	70.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.697
8bf62b45-1730-47f8-8bd6-aa83ddea75e4	08371fe5-a204-42ef-9e66-5904599d523e	ec134e98-303f-4666-86be-953b02208331	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	1540.00	140.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.706
113e6b1b-b183-4c03-9c2b-52ff5bc7d063	08371fe5-a204-42ef-9e66-5904599d523e	d563beae-6141-4015-9cbe-b3453615146b	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	1540.00	70.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.741
bb05081e-d8fd-47cd-8f56-2ca7b73a40a8	08371fe5-a204-42ef-9e66-5904599d523e	2a12d9d3-6068-42b1-a3f8-7ca5194d384b	cat-agroquimicos	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	896.50	55.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.751
cbc14772-6706-46b8-978e-ee149a823bed	ceec2de5-59e5-4fb8-b091-53d0a171b094	512a7e54-0223-4529-bfd9-971508c9efc8	cat-fertilizantes	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-11-19 10:53:27.999	2026-08-31 00:00:00	14700.00	25000.00	4.50	10.00	0.180	24.05	vermelha	\N	f	batch-1769128750541-914a9crq1	925-180-8020617	\N	2026-01-23 00:39:10.872
4229448e-c5a9-4268-9eed-b631b2d2d4b6	08371fe5-a204-42ef-9e66-5904599d523e	53cce7e1-a59a-45ff-b438-89634cff7d02	cat-sem-milho	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-11 16:04:23.999	2026-08-31 00:00:00	3760.00	20.00	20.00	10.00	2.500	85.45	verde	\N	f	batch-1769128750541-914a9crq1	925-180-8020634	\N	2026-01-23 00:39:10.909
a9fd835a-235c-4f9f-bc9f-848865a02848	bc28dae4-4fe1-480e-adae-b56bdf70190f	30eed411-63ba-4276-97ef-c99c2317387c	cat-especialidades	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-12-15 13:37:09.999	2026-08-31 00:00:00	5084.00	62.00	22.49	10.00	3.000	138.65	amarela	31.00	f	batch-1769128750541-914a9crq1	925-180-8020636	\N	2026-01-23 00:39:10.916
8a63c843-d271-4dc4-a6f6-58dec9a776dc	08371fe5-a204-42ef-9e66-5904599d523e	75b2fc62-f1d8-4df9-857a-b7b18cdf5f8d	cat-especialidades	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-06-25 07:58:56.999	2026-08-31 00:00:00	154.00	7.00	0.00	10.00	0.000	0.00	barter	\N	f	batch-1769128750541-914a9crq1	925-180-8020546	\N	2026-01-23 00:39:10.768
30650ad8-3bc6-4afa-a7d5-28f18ee32f93	986e90b9-79e4-4f1f-8580-d81b63f34204	b50d90e9-2757-4b16-9b07-4a15b8cf7794	cat-sem-milho	8898f9cf-b34c-4918-acbd-0eb322ab00a4	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	2025-09-08 14:49:07.999	2026-08-31 00:00:00	36000.00	200.00	20.00	10.00	2.500	818.18	verde	\N	f	batch-1769128750541-914a9crq1	925-180-8020580	\N	2026-01-23 00:39:10.833
\.


--
-- Data for Name: sales_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_history (id, client_id, season_id, total_sales, total_commissions, products_sold) FROM stdin;
\.


--
-- Data for Name: sales_planning; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_planning (id, client_id, user_id, season_id, total_planting_area, fungicides_area, insecticides_area, herbicides_area, seed_treatment_area, updated_at) FROM stdin;
aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	2b135e12-91f5-4142-ae36-9247a08c8c43	d0187ffd-ee55-4a37-bd77-c16404f484ab	3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	145.20	100.00	60.00	140.00	0.00	2026-01-25 21:53:25.956
\.


--
-- Data for Name: sales_planning_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_planning_items (id, planning_id, product_id, quantity, total_amount) FROM stdin;
81a3b0fd-411a-48aa-9bd5-66997fd3ee70	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	c700b7cc-0e50-4013-8efc-565e543b237f	210.00	630.00
8307112b-fbec-4c27-be8c-bbc4b0a30099	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	61b0e99d-9904-4598-9b12-182ae1ce4d4c	42.00	357.00
9cd9a6f8-9a10-4142-81d1-7243884e996b	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	3a7fd541-f32a-4047-8171-5763d6f6ee34	18.00	648.00
812259ba-b272-4b53-933d-cd6099e1c967	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	50ff0d0d-d163-435a-8b5d-2cfb1b9c06bf	105.00	735.00
cd456745-258a-4519-a041-a781591b18cb	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	8c150dba-6003-4745-bc7c-ec8337edaf4e	140.00	1050.00
e3700256-9958-4164-b4f8-f9815c03f9c6	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	25c3f8ef-123d-4c21-8d3a-2a4f79bf6353	20.00	1120.00
30206b35-6510-4eca-a09f-2b3ad2a7b21e	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	64fb2282-d2ef-43ab-be5b-0c2c137d1133	14.00	280.00
18feaa65-c324-4756-a978-6c2c0f14d0e7	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	9f339530-862a-402a-aa86-dda3be053671	126.00	945.00
a2f2bd91-f4f9-483f-b316-2828f55a0404	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	a50499c8-70f3-4471-a09b-98f4840ac1bf	385.00	1694.00
51893f27-efca-406e-837b-d2c918e331fe	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	b6abdce4-57c9-4ade-909e-2e13469cf1c3	280.00	1680.00
929174e2-9e0b-436c-8134-81e589e9e6cf	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	e73aa529-80b5-46fe-9777-ee383a47c850	225.00	1237.50
20c6a3c7-07fc-4ba7-803d-bc0106f44983	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	1ce2740c-6b61-4292-a035-9555eeb99c4e	385.00	1078.00
928b7c12-b068-4b29-9f8e-a479fdd81442	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	c02ca5f4-2fe8-494f-902f-c052873835aa	24.00	312.00
9eb526f6-2c5f-4a7a-8afd-e4962652fa4b	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	566d13f3-ebc3-4c6c-a4d6-ef90c82b2143	105.00	6825.00
2f5d3f48-cf90-470a-818b-dca174d6bf92	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	a79a8b68-3e68-4505-a368-f7fdd72c98ba	60.00	0.00
66c071cf-4d03-48f3-b628-f93e69c0fce8	aa2a80e8-ad58-44de-9cb0-006e1ce2a3e8	5e0a91e9-4b1e-4ffe-b8bf-cfab83e3a1f9	24.50	9800.00
\.


--
-- Data for Name: sales_targets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_targets (id, user_id, client_id, season_id, segmento, valor_capturado, subcategories, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: season_goals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.season_goals (id, season_id, goal_amount, meta_agroquimicos, meta_especialidades, meta_sementes_milho, meta_sementes_soja, meta_sementes_trigo, meta_sementes_diversas, meta_fertilizantes, meta_corretivos, user_id) FROM stdin;
\.


--
-- Data for Name: season_parameters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.season_parameters (id, type, due_date_month, due_date_day, label_pattern) FROM stdin;
\.


--
-- Data for Name: seasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seasons (id, name, type, year, start_date, end_date, is_active) FROM stdin;
3c6eadc5-6101-4ae8-ab72-ba0e73ab68ee	Soja 25/26	soja_verao	2025	2025-03-30 03:00:00	2026-04-30 03:00:00	t
cb210c32-d648-4ab3-a78e-554003453861	Safra 2026	soja_verao	2026	2026-01-01 03:00:00	2026-12-31 03:00:00	t
f4b0eeec-8b66-4a21-b742-3f36dbc8cc19	Soja 26/27	soja_verao	2026	2026-01-01 03:00:00	2026-12-31 03:00:00	t
3151091c-24fe-47e8-b801-4e1e99f58d29	Soja 24/25	soja_verao	2024	2024-04-01 04:00:00	2025-04-01 03:00:00	t
06951938-7e92-4167-9be8-961f4c86ef70	Milho 25/25	milho	2025	2025-01-01 03:00:00	2025-12-30 03:00:00	t
8898f9cf-b34c-4918-acbd-0eb322ab00a4	Milho 26/26	milho	2026	2026-01-01 03:00:00	2016-12-30 03:00:00	t
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
qd42nLe0W7KqCye0BI4G4J9wgnqleZOS	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-06T17:33:12.477Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "pdvFarmerId": "53d9be2f-7343-4c53-89ee-b6e886daf5fb", "pdvPropertyId": null, "pdvTerminalId": "4c7301b6-b06e-412e-b52e-07be95835c3b"}	2026-03-06 17:58:05
IAkz7cZ2vX_INI69k0ZtjElfkAKIO4K_	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-07T12:27:49.179Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": "ce72303c-8e8d-40d9-8566-75dc5d9c5f88"}}	2026-03-07 12:27:50
hs4kaloowlJzt9lWXS37M_ljmONxNI2T	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-06T12:56:05.298Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": "b1f7c63d-e398-42fc-893c-733221086476"}}	2026-03-06 13:32:07
wnAPjx3iKuadMoqEQZnt6ZOvI2ed3xEw	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-05T14:32:50.281Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "pdvFarmerId": "b1f7c63d-e398-42fc-893c-733221086476", "pdvPropertyId": "8fea32a5-5604-42cd-a3cd-62e126c49fee", "pdvTerminalId": "85e3aa51-1170-4a5c-adc8-ed584a0f352b"}	2026-03-06 13:32:27
CI0sIP0TZkLwzWv2Lv7tJZsRx8y8khbx	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-06T18:57:15.942Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "pdvFarmerId": "53d9be2f-7343-4c53-89ee-b6e886daf5fb", "pdvPropertyId": null, "pdvTerminalId": "0746179a-5f92-40a4-b76d-4d720ff0c44c"}	2026-03-06 20:06:01
qN3MkcLDWElkQrlIgRGVUJRbzVot1YEb	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-06T12:03:25.017Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {"user": "b1f7c63d-e398-42fc-893c-733221086476"}}	2026-03-06 18:07:56
NHgKf61csd4F8MA_qRP7glG7RLPcAyYL	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-07T00:19:36.950Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "passport": {}}	2026-03-07 00:20:00
dQu1rKTeVRD83fkNPSkXJvCGWtHyvBsv	{"cookie": {"path": "/", "secure": true, "expires": "2026-03-05T01:33:41.370Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "pdvFarmerId": "53d9be2f-7343-4c53-89ee-b6e886daf5fb", "pdvPropertyId": null, "pdvTerminalId": "098ff944-a13d-406a-946f-8f799ba9be06"}	2026-03-05 01:33:42
\.


--
-- Data for Name: stock_analysis_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_analysis_results (id, product_code, product_name, stock_quantity, orders_quantity, status, percentage, clients_list, upload_session_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: subcategories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subcategories (id, name, category_id, display_order) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, allow_user_registration, updated_at) FROM stdin;
78e0ed7b-4709-4ff7-bdcc-0ab1cf23b348	t	2026-01-23 01:14:12.549064
\.


--
-- Data for Name: telemetry_gps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.telemetry_gps (id, trip_id, ts, lat, lng, speed_kmh, accuracy_m) FROM stdin;
\.


--
-- Data for Name: timac_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.timac_settings (id, consultor_value, gerentes_value, faturistas_value, updated_at) FROM stdin;
\.


--
-- Data for Name: trips; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trips (id, visit_id, started_at, ended_at, start_odometer, end_odometer, distance_km, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: upload_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.upload_sessions (id, session_name, inventory_file_name, order_files_count, status, user_id, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: user_client_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_client_links (id, user_id, master_client_id, custom_name, planting_area, cultures, planting_progress, is_top80_20, include_in_market_area, is_active, created_at) FROM stdin;
2b135e12-91f5-4142-ae36-9247a08c8c43	d0187ffd-ee55-4a37-bd77-c16404f484ab	090d8bff-83bd-4e41-a17c-c6b80807bc4d	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.348547
f0c18bd1-b7b2-4652-b536-05a4784552b6	d0187ffd-ee55-4a37-bd77-c16404f484ab	b4cad117-1a08-46c6-82af-92f0f427ef1a	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.523181
1cd099ae-5d21-431e-b046-6af552145a0c	d0187ffd-ee55-4a37-bd77-c16404f484ab	e96a5557-4faf-40c3-87a1-976cb96c20eb	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.551514
fcc7726d-b5ed-47f2-a1b1-064e1558515d	d0187ffd-ee55-4a37-bd77-c16404f484ab	f3da5477-00fa-451a-98da-6a9733c03301	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.570355
961e44df-06ea-4be3-83cc-8023e8e54eed	d0187ffd-ee55-4a37-bd77-c16404f484ab	7cc81c42-3c6e-4d6c-ae96-99ee432c798f	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.589835
c37701b6-2c8b-47b1-bad3-5fd0efdad4cb	d0187ffd-ee55-4a37-bd77-c16404f484ab	66959603-6568-4453-9532-6e1d0ec13e65	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.614174
665c260d-2f5a-422b-b4f9-d924699ce260	d0187ffd-ee55-4a37-bd77-c16404f484ab	b13a1280-b905-4d4d-9db1-03257d4f2e80	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.628892
2b88bb4e-b627-4f62-b252-f713382e629f	d0187ffd-ee55-4a37-bd77-c16404f484ab	be127e6a-24c1-4326-b70c-425358527f5e	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.641984
6ffb9947-4b2a-4bea-b4ba-577d12e27d02	d0187ffd-ee55-4a37-bd77-c16404f484ab	d824eb98-7b81-4991-aa82-a546959678c3	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.654006
132fe7a2-7b31-47ff-a989-0a441b4942c1	d0187ffd-ee55-4a37-bd77-c16404f484ab	4a67f5ce-2690-42a6-aca6-6c0227296455	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.667681
79450858-a9c7-4b7f-a9cb-f9f38986e5f1	d0187ffd-ee55-4a37-bd77-c16404f484ab	d1432eab-306f-4939-90bf-976cd0d19062	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.684822
3c8c279a-a06b-431c-969f-c53c1bbe1f60	d0187ffd-ee55-4a37-bd77-c16404f484ab	b1631331-52a6-4f4f-b602-2b9591a9edee	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.697657
9d9000b0-d28b-4721-851f-d572d8de16ed	d0187ffd-ee55-4a37-bd77-c16404f484ab	0212e9c5-c1b9-40f5-a61a-494a522ddeb1	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.71495
46668ac9-61a7-4f84-bd89-9cd58cc8f03c	d0187ffd-ee55-4a37-bd77-c16404f484ab	6d95104d-d762-43ed-b7e2-7676acd2c169	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:02.999221
34501fa5-f6f6-42d1-a6eb-0253e3aca224	d0187ffd-ee55-4a37-bd77-c16404f484ab	fb0aa440-56f8-4d37-94bc-1e60a5400849	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.138442
dba9b70a-9bf9-4b8c-8937-099482b4f8bd	d0187ffd-ee55-4a37-bd77-c16404f484ab	1b4c3cc6-becd-4229-9957-158d2c09a7fb	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.163544
d1c1772f-24da-4cdc-93ad-a70198adfa15	d0187ffd-ee55-4a37-bd77-c16404f484ab	f8495217-4fb3-4a74-ac3c-4dbcc4f6c3c0	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.392293
ad9e3b47-172a-4191-8001-c23556a17455	d0187ffd-ee55-4a37-bd77-c16404f484ab	3c869c3e-2402-4ad8-97ee-c67173576de2	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.404162
3218243d-70e6-4538-8a19-50327cdb67e5	d0187ffd-ee55-4a37-bd77-c16404f484ab	cd9f6b72-c52a-46ff-8ca8-aa60dec2e898	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.596092
f0889cce-f19b-4110-ad2f-478ecb61c07a	d0187ffd-ee55-4a37-bd77-c16404f484ab	c1a947e6-105f-49a9-88db-8b88c37b7246	\N	\N	\N	0.00	f	f	t	2026-01-23 00:33:03.731765
b8ea484f-d42f-487b-937f-b1a1787d77e6	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	77e7d5c1-9e6e-4e61-85e6-f521b9ec35d0	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.672156
436711ce-45fd-40a0-80ea-de439836644d	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	1740d88c-57bd-47bb-a8df-65f7c0818d73	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.692149
986e90b9-79e4-4f1f-8580-d81b63f34204	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	29e12781-642c-4bbe-8524-302a9d50e13e	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.715109
08371fe5-a204-42ef-9e66-5904599d523e	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	dc1ddd61-403d-47f4-9080-116e3b57a75d	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.731242
81671ba4-967a-4586-beb2-5f12f0d88034	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	e22f3c2e-c367-4036-9dd3-09cb4c1264b0	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.836728
c919b8b8-e2e1-4bea-9781-6fbb06bbc781	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	3e041772-417b-4969-b200-702725a20416	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.851084
bc28dae4-4fe1-480e-adae-b56bdf70190f	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	4a87bf8b-b424-434d-9b53-1e71a109a844	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.981114
d5578c54-1326-4626-b277-b28dcbf4f413	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	500d5f66-a942-4054-b7d8-4aa36e656dec	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:10.997296
524cacfc-6071-45ed-8003-12bb2c666e60	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	c1f858de-c4c4-4074-a466-e1511dc34ed4	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.03689
57c0ca02-7f92-4fc4-b67b-a92936cd1c17	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	06b4238d-3cb9-4839-8056-a60668502c4b	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.055811
ceec2de5-59e5-4fb8-b091-53d0a171b094	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	e93cf575-bcf1-4541-9591-e7b3802ff748	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.074984
09881e5c-201d-4f89-8f78-0cf643344db0	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	6c0c18c9-aab5-4d64-b3e1-f1f3f6a44a99	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.317535
6d6adbf1-9288-4763-938f-b0f4bbd535d3	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	b8114c13-569e-4564-9acf-5c48fc39f691	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.473674
89862059-fde7-4761-a498-b05f784b5d49	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	47d11a17-7c17-4e8f-bb39-dc05544f2f4e	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.636182
2e777209-7c59-4736-8719-374d73ca9e36	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	5977a22d-0298-4ef1-94d2-ab90357384b7	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.687467
c5a7c681-0ac7-4cdd-8e34-e1ce87c9bc5f	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	44b01b4d-eb6f-48bd-8e2f-2bbb158e240e	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.719376
943807d5-5b0a-4de5-9e9c-98f8cb86974b	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	7f5bc889-a394-4e82-a7a5-c7aa4aee3eeb	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.787115
80b67de2-8b2b-4947-99f7-a59bdf1f6d6b	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	4b5dc72c-e47e-48a7-9588-3bcd40ff66fa	\N	\N	\N	0.00	f	f	t	2026-01-23 00:38:11.988539
c9471230-74c9-4e91-85c2-d8d38bb2e794	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	a7c1a77b-eae4-4326-bbf0-01f25aa15f7c	\N	\N	\N	0.00	f	f	t	2026-01-23 00:39:10.663193
2e18593d-202f-4f13-8208-34e7dfda26c6	576d782e-7c6f-4082-b56b-92d7e4c7ce8d	0509b1d7-3b14-4c29-8238-0452cc29fb7a	\N	\N	\N	0.00	f	f	t	2026-01-23 00:39:10.792794
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password, name, role, manager_id, whatsapp_number, whatsapp_extra_numbers, email, document, property_size, main_culture, region, farm_latitude, farm_longitude, farm_city, bulletin_enabled, invoice_email, accountant_email) FROM stdin;
f6aa68c8-c46e-42be-a3d4-cc0c09796c16	lindomar	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Lindomar	faturista	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
ecb59ee9-d014-411a-9681-0679d590aba0	henrique	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Jean	gerente	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
3de3ad2e-1f77-45fa-937c-021f1ec3fb75	Lindo	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Lindo	consultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
5d7ef4d3-5a00-4251-b5e2-7c8fbfab3699	bruno	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Bruno de Souza	consultor	ecb59ee9-d014-411a-9681-0679d590aba0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
fa78c389-66e3-4503-94a4-741fac5abe98	testelogin	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Usuario Teste	consultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
aa7b9f44-5518-45ad-badd-da8e4cbb471c	thiagoadm	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	thiago	administrador	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
4f752ce4-b8f4-42a5-98a9-17a335304d6f	fregolao	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Thiago Henrique Fregolao	consultor	ecb59ee9-d014-411a-9681-0679d590aba0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
d0187ffd-ee55-4a37-bd77-c16404f484ab	thiago	896c3e0d49fe8a59c3cc85713554183af5df81fbe29dbd06d313dda77b27279b983eb9b3299daa08c812faf2887166b8ec6d7a6a0dd7d41593acf542843badc5.efbf7d7202d7e35e21b6ffbbfe2972c3	Thiago	consultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
576d782e-7c6f-4082-b56b-92d7e4c7ce8d	Thaina	93dc7b34a759b652e489e49becf95d8e4720de7402d6f9bc00108e567707372006716ee63ef9773cad73f936deb8a18a5fa25266106d8fbc7295fe510c53a774.0594ccba6af9cb40277bd162c699059c	Thaina	consultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
3b731362-206b-48ca-9a42-c15d76452e7e	Ricardo	a33029a02d7faf32fa347807921a0a80dfd88cc98d02b41f48deb0ca3d49acf0e39cdfb85de00ecb5f35781d0ed6021623bf432aff2b9b0c462beb956465ac33.0a2e1816be92b5e05e81e5b59818e5b1	Ricardo	administrador	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
c80eb6a1-51de-4d27-b6ab-9ce7667c5718	Fred	9c3754796001788244d820b8bcd6475533c889cb71d368e833c87e6664ee7f06fa5ecc7895af99d44e98258e0e9bf070feda27173b6836bd417bafaaf96cea20.998f0e8d61a34268fb52a34d39de75b9	Fred	agricultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
ea3d69e7-b6f5-4ac0-b791-09c3cd0882f1	Gaby	768028fef19d0db65a2f38e2308696397eb5dd09c7d3970c870a5cb70078ade6d6d81204e4dadc178b42eecf6500a490662d6ecb601a8558d09182b5957570a4.dcc65d89d1f773dc7c9f5b2edcaa9c9b	Gaby	agricultor	\N	595982040634	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
ecaf3edf-092c-4249-b447-9e2ae2f98c92	Fregolao	b7d3f43a3be0f6515da80bc5b88f1a7ee97762ba503dc17d93e0d931fbd30e3ed2bab77fe07e541fdcb1c11198966acaf35561301199ab3ea76e8f2a896e06f5.1c5ee23b48200684442e5ad0923ee481	Fregolao	administrador	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
ce72303c-8e8d-40d9-8566-75dc5d9c5f88	Belchior	acdc9293a8ebdb87dc2f6fb717f70e3fc43b1d96e607f16d5fd7fb020580136081f94d374c10986b35bbafe187a5b70203f38a52e9ee526a1e7b5e8c520a7cf3.53b9a0a27e8775ab61a192ea5e68df66	Belchior	admin_agricultor	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
04e14650-3676-4272-986f-16f3a64b954d	Luis Villalba	d7b8e9556ffde92b7408ef866cb1bc8dcf91bcd5b78b40ccff3c343b5bbf62774f0cac11f626eb2ba7bafd3eceab2a590ee258039aefb801baa12cba36d3c312.73de2e05a63a6583d83c134faa2dd3b6	Luis Antonio Villalba 	agricultor	\N	\N	[]	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	\N
53d9be2f-7343-4c53-89ee-b6e886daf5fb	Sergio	d5a1888745c5212874bc6d00c6ed302b3daeb906d6354521242b425128d0d5080a1d2978e596faad4b7056ecfafb877a5f4d15e176a56879c698ce3d74e1674d.3adb6e65142229cea7c6a0b087461b7c	Sergio	agricultor	\N	5950986848326	["554391393366"]	\N	\N	\N	\N	\N	-24.2623020	-54.8754880	Cruce Guarani	t	sergio@mail.agrofarmdigital.com	thiago.f@live.com
b1f7c63d-e398-42fc-893c-733221086476	Diego Miotto	6c55814a3d8043f6439d8c95399a10159824d0d095878ceaed0e7a38024eb7111a88b3cec3114cf71f052d2ddfc346a485137c56fd5499514da0245f25c78609.0b3bbbc4b2c319b95c2cacd69a0abbf1	Diego Miotto	agricultor	\N	595983765386	[]	\N	\N	\N	\N	\N	-24.1171510	-54.9115440	Corpus	t	miotto@mail.agrofarmdigital.com	\N
\.


--
-- Data for Name: visits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visits (id, client_id, farm_id, field_id, scheduled_at, window_start, window_end, status, assignee, notes, created_at, updated_at) FROM stdin;
\.


--
-- Name: action_plan_items action_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_items
    ADD CONSTRAINT action_plan_items_pkey PRIMARY KEY (id);


--
-- Name: action_plan_participants action_plan_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_participants
    ADD CONSTRAINT action_plan_participants_pkey PRIMARY KEY (id);


--
-- Name: action_plans action_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plans
    ADD CONSTRAINT action_plans_pkey PRIMARY KEY (id);


--
-- Name: alert_settings alert_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_settings
    ADD CONSTRAINT alert_settings_pkey PRIMARY KEY (id);


--
-- Name: alert_settings alert_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_settings
    ADD CONSTRAINT alert_settings_user_id_unique UNIQUE (user_id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: barter_products barter_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_products
    ADD CONSTRAINT barter_products_pkey PRIMARY KEY (id);


--
-- Name: barter_settings barter_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_settings
    ADD CONSTRAINT barter_settings_key_unique UNIQUE (key);


--
-- Name: barter_settings barter_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_settings
    ADD CONSTRAINT barter_settings_pkey PRIMARY KEY (id);


--
-- Name: barter_simulation_items barter_simulation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulation_items
    ADD CONSTRAINT barter_simulation_items_pkey PRIMARY KEY (id);


--
-- Name: barter_simulations barter_simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulations
    ADD CONSTRAINT barter_simulations_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: checklists checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_pkey PRIMARY KEY (id);


--
-- Name: client_application_tracking client_application_tracking_client_id_season_id_global_applicat; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_client_id_season_id_global_applicat UNIQUE (client_id, season_id, global_application_id);


--
-- Name: client_application_tracking client_application_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_pkey PRIMARY KEY (id);


--
-- Name: client_category_pipeline client_category_pipeline_client_id_season_id_category_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_client_id_season_id_category_id_unique UNIQUE (client_id, season_id, category_id);


--
-- Name: client_category_pipeline client_category_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_pkey PRIMARY KEY (id);


--
-- Name: client_family_relations client_family_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_family_relations
    ADD CONSTRAINT client_family_relations_pkey PRIMARY KEY (id);


--
-- Name: client_market_rates client_market_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_rates
    ADD CONSTRAINT client_market_rates_pkey PRIMARY KEY (id);


--
-- Name: client_market_values client_market_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_values
    ADD CONSTRAINT client_market_values_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: external_purchases external_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_purchases
    ADD CONSTRAINT external_purchases_pkey PRIMARY KEY (id);


--
-- Name: farm_applications farm_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_pkey PRIMARY KEY (id);


--
-- Name: farm_equipment farm_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_equipment
    ADD CONSTRAINT farm_equipment_pkey PRIMARY KEY (id);


--
-- Name: farm_expenses farm_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_expenses
    ADD CONSTRAINT farm_expenses_pkey PRIMARY KEY (id);


--
-- Name: farm_invoice_items farm_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoice_items
    ADD CONSTRAINT farm_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: farm_invoices farm_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoices
    ADD CONSTRAINT farm_invoices_pkey PRIMARY KEY (id);


--
-- Name: farm_manuals farm_manuals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_manuals
    ADD CONSTRAINT farm_manuals_pkey PRIMARY KEY (id);


--
-- Name: farm_pdv_terminals farm_pdv_terminals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_pdv_terminals
    ADD CONSTRAINT farm_pdv_terminals_pkey PRIMARY KEY (id);


--
-- Name: farm_pdv_terminals farm_pdv_terminals_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_pdv_terminals
    ADD CONSTRAINT farm_pdv_terminals_username_key UNIQUE (username);


--
-- Name: farm_plots farm_plots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_plots
    ADD CONSTRAINT farm_plots_pkey PRIMARY KEY (id);


--
-- Name: farm_price_history farm_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_price_history
    ADD CONSTRAINT farm_price_history_pkey PRIMARY KEY (id);


--
-- Name: farm_products_catalog farm_products_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_products_catalog
    ADD CONSTRAINT farm_products_catalog_pkey PRIMARY KEY (id);


--
-- Name: farm_properties farm_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_properties
    ADD CONSTRAINT farm_properties_pkey PRIMARY KEY (id);


--
-- Name: farm_seasons farm_seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_seasons
    ADD CONSTRAINT farm_seasons_pkey PRIMARY KEY (id);


--
-- Name: farm_stock farm_stock_farmer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock
    ADD CONSTRAINT farm_stock_farmer_id_product_id_key UNIQUE (farmer_id, product_id);


--
-- Name: farm_stock_movements farm_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock_movements
    ADD CONSTRAINT farm_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: farm_stock farm_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock
    ADD CONSTRAINT farm_stock_pkey PRIMARY KEY (id);


--
-- Name: farms farms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_pkey PRIMARY KEY (id);


--
-- Name: fields fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_pkey PRIMARY KEY (id);


--
-- Name: global_management_applications global_management_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_management_applications
    ADD CONSTRAINT global_management_applications_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: manager_team_rates manager_team_rates_manager_id_season_id_category_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_team_rates
    ADD CONSTRAINT manager_team_rates_manager_id_season_id_category_id_unique UNIQUE (manager_id, season_id, category_id);


--
-- Name: manager_team_rates manager_team_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_team_rates
    ADD CONSTRAINT manager_team_rates_pkey PRIMARY KEY (id);


--
-- Name: market_benchmarks market_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_benchmarks
    ADD CONSTRAINT market_benchmarks_pkey PRIMARY KEY (id);


--
-- Name: market_investment_rates market_investment_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_investment_rates
    ADD CONSTRAINT market_investment_rates_pkey PRIMARY KEY (id);


--
-- Name: master_clients master_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_clients
    ADD CONSTRAINT master_clients_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_unique UNIQUE (token);


--
-- Name: pending_orders pending_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_orders
    ADD CONSTRAINT pending_orders_pkey PRIMARY KEY (id);


--
-- Name: planning_global_configurations planning_global_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_global_configurations
    ADD CONSTRAINT planning_global_configurations_pkey PRIMARY KEY (id);


--
-- Name: planning_global_configurations planning_global_configurations_user_id_season_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_global_configurations
    ADD CONSTRAINT planning_global_configurations_user_id_season_id_unique UNIQUE (user_id, season_id);


--
-- Name: planning_products_base planning_products_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_products_base
    ADD CONSTRAINT planning_products_base_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products_price_table products_price_table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_price_table
    ADD CONSTRAINT products_price_table_pkey PRIMARY KEY (id);


--
-- Name: purchase_history_items purchase_history_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history_items
    ADD CONSTRAINT purchase_history_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_history purchase_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: sales_history sales_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_history
    ADD CONSTRAINT sales_history_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales_planning_items sales_planning_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning_items
    ADD CONSTRAINT sales_planning_items_pkey PRIMARY KEY (id);


--
-- Name: sales_planning sales_planning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning
    ADD CONSTRAINT sales_planning_pkey PRIMARY KEY (id);


--
-- Name: sales_planning sales_planning_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning
    ADD CONSTRAINT sales_planning_unique UNIQUE (client_id, season_id);


--
-- Name: sales_targets sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_pkey PRIMARY KEY (id);


--
-- Name: season_goals season_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_goals
    ADD CONSTRAINT season_goals_pkey PRIMARY KEY (id);


--
-- Name: season_parameters season_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_parameters
    ADD CONSTRAINT season_parameters_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: stock_analysis_results stock_analysis_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_analysis_results
    ADD CONSTRAINT stock_analysis_results_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: telemetry_gps telemetry_gps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_gps
    ADD CONSTRAINT telemetry_gps_pkey PRIMARY KEY (id);


--
-- Name: timac_settings timac_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timac_settings
    ADD CONSTRAINT timac_settings_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: upload_sessions upload_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_client_links user_client_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_client_links
    ADD CONSTRAINT user_client_links_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: idx_users_whatsapp_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_whatsapp_number ON public.users USING btree (whatsapp_number) WHERE (whatsapp_number IS NOT NULL);


--
-- Name: action_plan_items action_plan_items_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_items
    ADD CONSTRAINT action_plan_items_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: action_plan_items action_plan_items_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_items
    ADD CONSTRAINT action_plan_items_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: action_plan_items action_plan_items_consultor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_items
    ADD CONSTRAINT action_plan_items_consultor_id_users_id_fk FOREIGN KEY (consultor_id) REFERENCES public.users(id);


--
-- Name: action_plan_items action_plan_items_plan_id_action_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_items
    ADD CONSTRAINT action_plan_items_plan_id_action_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.action_plans(id) ON DELETE CASCADE;


--
-- Name: action_plan_participants action_plan_participants_plan_id_action_plans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_participants
    ADD CONSTRAINT action_plan_participants_plan_id_action_plans_id_fk FOREIGN KEY (plan_id) REFERENCES public.action_plans(id) ON DELETE CASCADE;


--
-- Name: action_plan_participants action_plan_participants_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plan_participants
    ADD CONSTRAINT action_plan_participants_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: action_plans action_plans_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plans
    ADD CONSTRAINT action_plans_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: action_plans action_plans_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_plans
    ADD CONSTRAINT action_plans_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: alert_settings alert_settings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_settings
    ADD CONSTRAINT alert_settings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: alerts alerts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: automations automations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: barter_products barter_products_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_products
    ADD CONSTRAINT barter_products_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: barter_simulation_items barter_simulation_items_product_id_barter_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulation_items
    ADD CONSTRAINT barter_simulation_items_product_id_barter_products_id_fk FOREIGN KEY (product_id) REFERENCES public.barter_products(id);


--
-- Name: barter_simulation_items barter_simulation_items_simulation_id_barter_simulations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulation_items
    ADD CONSTRAINT barter_simulation_items_simulation_id_barter_simulations_id_fk FOREIGN KEY (simulation_id) REFERENCES public.barter_simulations(id) ON DELETE CASCADE;


--
-- Name: barter_simulations barter_simulations_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulations
    ADD CONSTRAINT barter_simulations_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: barter_simulations barter_simulations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barter_simulations
    ADD CONSTRAINT barter_simulations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: checklists checklists_visit_id_visits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_visit_id_visits_id_fk FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE CASCADE;


--
-- Name: client_application_tracking client_application_tracking_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: client_application_tracking client_application_tracking_global_application_id_global_manage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_global_application_id_global_manage FOREIGN KEY (global_application_id) REFERENCES public.global_management_applications(id);


--
-- Name: client_application_tracking client_application_tracking_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: client_application_tracking client_application_tracking_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_application_tracking
    ADD CONSTRAINT client_application_tracking_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: client_category_pipeline client_category_pipeline_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: client_category_pipeline client_category_pipeline_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: client_category_pipeline client_category_pipeline_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: client_category_pipeline client_category_pipeline_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_category_pipeline
    ADD CONSTRAINT client_category_pipeline_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: client_family_relations client_family_relations_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_family_relations
    ADD CONSTRAINT client_family_relations_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: client_family_relations client_family_relations_related_client_id_user_client_links_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_family_relations
    ADD CONSTRAINT client_family_relations_related_client_id_user_client_links_id_ FOREIGN KEY (related_client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: client_family_relations client_family_relations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_family_relations
    ADD CONSTRAINT client_family_relations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: client_market_rates client_market_rates_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_rates
    ADD CONSTRAINT client_market_rates_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: client_market_rates client_market_rates_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_rates
    ADD CONSTRAINT client_market_rates_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: client_market_rates client_market_rates_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_rates
    ADD CONSTRAINT client_market_rates_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: client_market_rates client_market_rates_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_rates
    ADD CONSTRAINT client_market_rates_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: client_market_values client_market_values_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_values
    ADD CONSTRAINT client_market_values_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: client_market_values client_market_values_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_values
    ADD CONSTRAINT client_market_values_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: client_market_values client_market_values_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_values
    ADD CONSTRAINT client_market_values_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: client_market_values client_market_values_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_market_values
    ADD CONSTRAINT client_market_values_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: clients clients_region_id_regions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_region_id_regions_id_fk FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: clients clients_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: external_purchases external_purchases_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_purchases
    ADD CONSTRAINT external_purchases_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: external_purchases external_purchases_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_purchases
    ADD CONSTRAINT external_purchases_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: external_purchases external_purchases_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_purchases
    ADD CONSTRAINT external_purchases_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: external_purchases external_purchases_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_purchases
    ADD CONSTRAINT external_purchases_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: farm_applications farm_applications_equipment_id_farm_equipment_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_equipment_id_farm_equipment_id_fk FOREIGN KEY (equipment_id) REFERENCES public.farm_equipment(id);


--
-- Name: farm_applications farm_applications_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_applications farm_applications_plot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_plot_id_fkey FOREIGN KEY (plot_id) REFERENCES public.farm_plots(id) ON DELETE CASCADE;


--
-- Name: farm_applications farm_applications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.farm_products_catalog(id);


--
-- Name: farm_applications farm_applications_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_applications
    ADD CONSTRAINT farm_applications_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.farm_properties(id) ON DELETE CASCADE;


--
-- Name: farm_equipment farm_equipment_farmer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_equipment
    ADD CONSTRAINT farm_equipment_farmer_id_users_id_fk FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_expenses farm_expenses_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_expenses
    ADD CONSTRAINT farm_expenses_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_expenses farm_expenses_plot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_expenses
    ADD CONSTRAINT farm_expenses_plot_id_fkey FOREIGN KEY (plot_id) REFERENCES public.farm_plots(id);


--
-- Name: farm_expenses farm_expenses_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_expenses
    ADD CONSTRAINT farm_expenses_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.farm_properties(id);


--
-- Name: farm_invoice_items farm_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoice_items
    ADD CONSTRAINT farm_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.farm_invoices(id) ON DELETE CASCADE;


--
-- Name: farm_invoice_items farm_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoice_items
    ADD CONSTRAINT farm_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.farm_products_catalog(id);


--
-- Name: farm_invoices farm_invoices_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoices
    ADD CONSTRAINT farm_invoices_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_invoices farm_invoices_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_invoices
    ADD CONSTRAINT farm_invoices_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.farm_seasons(id);


--
-- Name: farm_pdv_terminals farm_pdv_terminals_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_pdv_terminals
    ADD CONSTRAINT farm_pdv_terminals_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_pdv_terminals farm_pdv_terminals_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_pdv_terminals
    ADD CONSTRAINT farm_pdv_terminals_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.farm_properties(id);


--
-- Name: farm_plots farm_plots_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_plots
    ADD CONSTRAINT farm_plots_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.farm_properties(id) ON DELETE CASCADE;


--
-- Name: farm_price_history farm_price_history_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_price_history
    ADD CONSTRAINT farm_price_history_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_properties farm_properties_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_properties
    ADD CONSTRAINT farm_properties_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_seasons farm_seasons_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_seasons
    ADD CONSTRAINT farm_seasons_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_stock farm_stock_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock
    ADD CONSTRAINT farm_stock_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_stock_movements farm_stock_movements_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock_movements
    ADD CONSTRAINT farm_stock_movements_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: farm_stock_movements farm_stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock_movements
    ADD CONSTRAINT farm_stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.farm_products_catalog(id);


--
-- Name: farm_stock_movements farm_stock_movements_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock_movements
    ADD CONSTRAINT farm_stock_movements_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.farm_seasons(id);


--
-- Name: farm_stock farm_stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farm_stock
    ADD CONSTRAINT farm_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.farm_products_catalog(id);


--
-- Name: farms farms_client_id_master_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.farms
    ADD CONSTRAINT farms_client_id_master_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.master_clients(id);


--
-- Name: fields fields_farm_id_farms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_farm_id_farms_id_fk FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE CASCADE;


--
-- Name: global_management_applications global_management_applications_product_id_products_price_table_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_management_applications
    ADD CONSTRAINT global_management_applications_product_id_products_price_table_ FOREIGN KEY (product_id) REFERENCES public.products_price_table(id);


--
-- Name: global_management_applications global_management_applications_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_management_applications
    ADD CONSTRAINT global_management_applications_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: inventory_items inventory_items_upload_session_id_upload_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_upload_session_id_upload_sessions_id_fk FOREIGN KEY (upload_session_id) REFERENCES public.upload_sessions(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: manager_team_rates manager_team_rates_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_team_rates
    ADD CONSTRAINT manager_team_rates_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: manager_team_rates manager_team_rates_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_team_rates
    ADD CONSTRAINT manager_team_rates_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: manager_team_rates manager_team_rates_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager_team_rates
    ADD CONSTRAINT manager_team_rates_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: market_benchmarks market_benchmarks_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_benchmarks
    ADD CONSTRAINT market_benchmarks_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: market_benchmarks market_benchmarks_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_benchmarks
    ADD CONSTRAINT market_benchmarks_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: market_benchmarks market_benchmarks_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_benchmarks
    ADD CONSTRAINT market_benchmarks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: market_investment_rates market_investment_rates_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_investment_rates
    ADD CONSTRAINT market_investment_rates_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: master_clients master_clients_region_id_regions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_clients
    ADD CONSTRAINT master_clients_region_id_regions_id_fk FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pending_orders pending_orders_upload_session_id_upload_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_orders
    ADD CONSTRAINT pending_orders_upload_session_id_upload_sessions_id_fk FOREIGN KEY (upload_session_id) REFERENCES public.upload_sessions(id) ON DELETE CASCADE;


--
-- Name: pending_orders pending_orders_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_orders
    ADD CONSTRAINT pending_orders_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: planning_products_base planning_products_base_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_products_base
    ADD CONSTRAINT planning_products_base_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_subcategory_id_subcategories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_subcategory_id_subcategories_id_fk FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id);


--
-- Name: purchase_history purchase_history_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: purchase_history_items purchase_history_items_purchase_history_id_purchase_history_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history_items
    ADD CONSTRAINT purchase_history_items_purchase_history_id_purchase_history_id_ FOREIGN KEY (purchase_history_id) REFERENCES public.purchase_history(id) ON DELETE CASCADE;


--
-- Name: purchase_history purchase_history_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: purchase_history purchase_history_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_history
    ADD CONSTRAINT purchase_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sales sales_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: sales sales_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: sales_history sales_history_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_history
    ADD CONSTRAINT sales_history_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id);


--
-- Name: sales_history sales_history_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_history
    ADD CONSTRAINT sales_history_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: sales_planning sales_planning_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning
    ADD CONSTRAINT sales_planning_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: sales_planning_items sales_planning_items_planning_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning_items
    ADD CONSTRAINT sales_planning_items_planning_id_fkey FOREIGN KEY (planning_id) REFERENCES public.sales_planning(id) ON DELETE CASCADE;


--
-- Name: sales_planning_items sales_planning_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning_items
    ADD CONSTRAINT sales_planning_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.planning_products_base(id);


--
-- Name: sales_planning sales_planning_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning
    ADD CONSTRAINT sales_planning_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: sales_planning sales_planning_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_planning
    ADD CONSTRAINT sales_planning_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sales sales_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales sales_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: sales_targets sales_targets_client_id_user_client_links_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_client_id_user_client_links_id_fk FOREIGN KEY (client_id) REFERENCES public.user_client_links(id) ON DELETE CASCADE;


--
-- Name: sales_targets sales_targets_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: sales_targets sales_targets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sales sales_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: season_goals season_goals_season_id_seasons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_goals
    ADD CONSTRAINT season_goals_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES public.seasons(id);


--
-- Name: season_goals season_goals_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_goals
    ADD CONSTRAINT season_goals_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock_analysis_results stock_analysis_results_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_analysis_results
    ADD CONSTRAINT stock_analysis_results_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_analysis_results stock_analysis_results_upload_session_id_upload_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_analysis_results
    ADD CONSTRAINT stock_analysis_results_upload_session_id_upload_sessions_id_fk FOREIGN KEY (upload_session_id) REFERENCES public.upload_sessions(id) ON DELETE CASCADE;


--
-- Name: subcategories subcategories_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: telemetry_gps telemetry_gps_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetry_gps
    ADD CONSTRAINT telemetry_gps_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: trips trips_visit_id_visits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_visit_id_visits_id_fk FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: upload_sessions upload_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_client_links user_client_links_master_client_id_master_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_client_links
    ADD CONSTRAINT user_client_links_master_client_id_master_clients_id_fk FOREIGN KEY (master_client_id) REFERENCES public.master_clients(id) ON DELETE CASCADE;


--
-- Name: user_client_links user_client_links_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_client_links
    ADD CONSTRAINT user_client_links_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: visits visits_assignee_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_assignee_users_id_fk FOREIGN KEY (assignee) REFERENCES public.users(id);


--
-- Name: visits visits_client_id_master_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_client_id_master_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.master_clients(id);


--
-- Name: visits visits_farm_id_farms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_farm_id_farms_id_fk FOREIGN KEY (farm_id) REFERENCES public.farms(id);


--
-- Name: visits visits_field_id_fields_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_field_id_fields_id_fk FOREIGN KEY (field_id) REFERENCES public.fields(id);


--
-- PostgreSQL database dump complete
--

\unrestrict W0fI0unebfVXSKtvdadhj4jkR5Hy9XRVRUKyN7iQJ0qPXfPUVrJzcqofrCYZ9xa

