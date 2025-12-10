# Sales Commission Management System

## Overview
This full-stack agricultural sales commission management system, designed for the Paraguayan agricultural market, streamlines sales tracking, commission calculation, and seasonal goal management. Key features include PDF invoice imports, margin-based commission calculations, crop-type seasonal classification, comprehensive sales analytics, and a BARTER module for product-grain exchange simulations. It aims to enhance sales management efficiency and commission processes for agricultural businesses. The system also includes a robust CRM with mobile capabilities for managing client visits, field data, and trip tracking.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend uses React 18, TypeScript, and Vite. UI components are built with shadcn/ui on Radix UI, styled with Tailwind CSS, featuring an agricultural green primary color scheme. Data visualization uses Recharts.

### Technical Implementations

#### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **State Management**: TanStack Query for server state, React hooks for local UI state.
- **Forms**: React Hook Form with Zod for validation.
- **Mobile**:
    - **PWA**: Offline-first with IndexedDB (Dexie.js) and service worker caching.
    - **Native Mobile App**: Android (Expo + React Native) with SQLite for offline data, background geofencing, GPS tracking, and route optimization.

#### Backend
- **Framework**: Express.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Session Management**: `connect-pg-simple`.
- **CRM Module**: PostGIS-enabled database schema for geospatial data (farms, fields, visits, trips).
- **NLP Service**: Fuse.js for fuzzy matching in agenda parsing.
- **State Machine**: Enforces workflow rules for visit status transitions.

### Feature Specifications

#### Core System
- **User Roles**: Administrador, gerente, consultor, faturista for access control.
- **Entities**: Users, Categories, Products, Master Clients, User Client Links, Seasons, Sales, Season Parameters, Season Goals.
- **Commission Calculation**: Five-tier system (green, yellow, red, below list, barter) with configurable rates and IVA. Manual commission entry for barter sales.
- **Season Classification**: Rule-based system assigning sales to seasons based on due dates.
- **Administrative Panel**: Super admin interface for user, client, product, category, commission, and system parameter management, including bulk import and merging.
- **File Processing**: PDF import for C.VALE invoices (sales data extraction, category detection, season assignment). Excel import with duplicate order detection.
- **BARTER Module**: Simulation system for product-grain exchange, including `barter_products`, `barter_settings`, and `barter_simulations`.

#### Manager Dashboard & Action Plans
- **Role-based Management**: `managerId` links consultors to managers.
- **Manager Dashboard**: Aggregated team sales, Timac points, team count, top categories/clients. Individual consultor performance.
- **Action Plans**: Meeting-based goal tracking and task management with CRUD operations.

#### Kanban de Metas (Sales Targets)
- **Visual Drag & Drop**: Kanban-style board with client opportunity cards (Oportunidades → Realizado → Capturado).
- **Subcategory Support**: Agroquímicos segment supports 4 subcategories (TS, Dessecação, Inseticidas, Fungicidas) with JSONB storage.
- **Edit Functionality**: Clicking captured client names opens pre-filled modal for updating values or deleting targets.
- **Market Benchmarks**: Integrated market percentage/progress tracker displays benchmark values by category for active season.
- **Backend**: PATCH `/api/sales-targets/:id` supports subcategories parameter. Database stores subcategories as JSONB.
- **Application Tracking System** (In Development):
  - **Products Price Table**: `products_price_table` stores product catalog with verde/amarela/vermelha pricing tiers ($/ha).
  - **Global Management**: `global_management_applications` stores consultant's global crop management plan (fungicide/insecticide applications).
  - **Client Tracking**: `client_application_tracking` tracks application status per client (sold, lost to competitor, open opportunity).
  - **Super Admin Interface**: New "Tabela de Preços" tab for product catalog management (CRUD operations, organized by category).
  - **API Endpoints**: GET/POST/PATCH/DELETE `/api/admin/price-table` for product management (super admin only).

#### Faturista (Billing) Panel
- **Inventory Control**: Dedicated panel for billing staff to analyze stock against pending orders.
- **Workflow**: Create upload session → upload inventory PDF → upload order PDFs → analyze stock availability.
- **Analysis**: Compares aggregated orders with inventory, calculates availability (DISPONÍVEL, PARCIAL, INDISPONÍVEL).

#### CRM Module
- **Database**: `farms`, `fields`, `visits`, `trips`, `telemetry_gps`, `checklists`, `automations`, `audit_logs` with PostGIS support. Farms table includes `lat`, `lng`, `address`, `notes`, `created_at` for geofencing.
- **API**: RESTful endpoints for CRUD operations, spatial queries, trip management, and checklist submissions.
- **NLP Agenda Parser**: Converts natural language text into structured visit objects.
- **Geofencing**: Background geofencing for trip detection and location-based automations. **Requires farm coordinates** - visits without farm_id cannot use geofencing.
- **Farm Management**: `/crm/farms` page for cadastro with required lat/lng coordinates. Syncs to server via POST `/api/farms` with PostGIS POINT format.
- **Schema Mapping**: Frontend uses snake_case (client_id, farm_id, window_start), Drizzle schema uses camelCase (clientId, farmId, windowStart). Backend converts via `createVisitsBulk` helper with Date object conversion for timestamps.
- **Automated Attendance System (6-Phase Workflow)**:
  - **Phase 1 - Fixed Agenda**: Agenda panel at top of Home page with sequential visits (1ª, 2ª, 3ª), status colors, "Iniciar" button, visual indicator for next visit (green border/ring).
  - **Phase 2 - Farm Geofencing**: Monitors distance to farms (200m radius), auto-changes status to NO_LOCAL on arrival, vibration notifications, uses lat/lng from farm cadastro, monitors only next visit in sequence.
  - **Phase 3 - Auto Sequencing**: Leaving base (100m) auto-starts first PLANEJADA visit, visits ordered by time, route start notifications, tracking monitors next in queue.
  - **Phase 4 - Attendance Screen**: Route `/crm/atendimento/:visitId`, pre-filled data (client, farm, service), photo upload (camera/gallery), description per photo, saves photos in IndexedDB (photos array field), auto-redirects when status becomes NO_LOCAL.
  - **Phase 5 - Gallery Feed**: Instagram-style horizontal scroll photos, multiple photo indicators, description below each photo, displays only CONCLUIDA visits.
  - **Phase 6 - UX Refinements**: Visual next-visit indicator, enhanced notifications, consistent status colors.
- **Tracking Implementation**: 
  - Uses `activeFarmLatRef` and `activeFarmLngRef` to store active farm coordinates independently from visit status.
  - Exit detection (400m = 2x geofence radius) resets all tracking refs (`inFarmRef`, `activeVisitIdRef`, `activeFarmLatRef`, `activeFarmLngRef`) to enable monitoring next visit.
  - Ensures continuous multi-visit sequencing even after visits change to CONCLUIDA status.
- **Odometer (Quilometragem) Tracking**:
  - **Automatic Start**: When leaving base (100m trigger), displays odometer dialog to capture vehicle mileage before starting first visit.
  - **Manual Start**: "Iniciar" button in agenda also requests odometer reading before trip begins.
  - **Trip Completion**: Attendance screen requests final odometer reading when completing visit.
  - **Backend Integration**: `trips` table stores `start_odometer` and `end_odometer` fields. Backend `endTrip` method accepts both `trip_id` and `visit_id` for flexible lookups.
  - **Status Preservation**: Backend uses CASE expression to preserve CONCLUIDA status when ending trip, preventing status downgrades during sync.
  - **Duplicate Prevention**: Manual trip start sets `tripStartedRef` to prevent automatic base-exit trigger from firing again.
  - **Sync Flow**: Enqueues VISIT_CREATE (status) + TRIP_START (odometer) on start, VISIT_CREATE (status+photos) + TRIP_END (visit_id+odometer) on completion.

### System Design Choices
- **Monorepo Structure**: Shared schema and type sharing via a `/shared` directory.
- **Path Aliases**: For cleaner imports.
- **Authentication**: Session-based with complete cache clearing and session destruction on logout.
- **Security**: HTTP Cache-Control headers (`no-store, no-cache, must-revalidate, private`) and React Query stale/garbage collection times for data security.
- **Role-based Routing**: Custom route components (`AdminRoute`, `ManagerRoute`, `FaturistaRoute`, `ConsultorRoute`) enforce access control and redirect users post-login.
- **Performance Optimizations** (November 2025):
  - **Batch Query Pattern**: Eliminated N+1 query problems in critical endpoints by implementing batch fetching with `inArray()`.
  - **Analytics Endpoint**: `/api/analytics/sales` reduced from 20s to <1s by batch-fetching only needed categories and client links instead of individual queries per sale.
  - **Kanban Endpoint**: `/api/kanban-metas` optimized from 3-5s to <1s by batch-fetching all sales and targets for all clients in single queries using PostgreSQL `ANY()` operator.
  - **Family Relations**: Created batch endpoint `/api/clients/family/batch` to fetch relations for multiple clients in one query, preventing 30+ sequential API calls.
  - **Query Optimization**: Uses `inArray()` with empty array guards to fetch only required rows, with proper joins for `userClientLinks` and `masterClients` name resolution.

## External Dependencies

-   **Database**: PostgreSQL via `@neondatabase/serverless`
-   **ORM/Schema**: Drizzle ORM, Drizzle Kit, `drizzle-zod`
-   **UI Components**: Radix UI, shadcn/ui, Recharts, `date-fns`, `cmdk`
-   **Styling**: Tailwind CSS, `class-variance-authority`, `clsx`, `tailwind-merge`
-   **Form & Validation**: Zod, React Hook Form, `@hookform/resolvers`
-   **Session Management**: `connect-pg-simple`, Express sessions
-   **Development Tools**: TypeScript, Vite, ESBuild, PostCSS, Autoprefixer
-   **Mobile (PWA)**: Dexie.js (IndexedDB), React-Leaflet
-   **Mobile (Native)**: Expo, `expo-sqlite`, `expo-location`, `expo-task-manager`, `react-native-maps`