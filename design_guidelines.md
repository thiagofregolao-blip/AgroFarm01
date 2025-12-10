# Design Guidelines: Market Benchmark Configuration Modal

## Design Approach
**System Selected**: Material Design principles adapted for agricultural enterprise software
**Rationale**: Data-heavy configuration interface requires structured, efficient patterns. Material's elevation system and form patterns provide clarity for percentage-based inputs while maintaining professional credibility.

## Core Design Elements

### A. Color Palette
**Dark Mode (Primary)**:
- Primary Agricultural Green: 140 45% 45% (muted farm green)
- Success/Confirmation: 140 50% 50% (brighter green for validation)
- Surface Background: 0 0% 12% (modal base)
- Input Fields: 0 0% 18% (elevated form fields)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 65%
- Border/Dividers: 0 0% 25%

**Light Mode Variants** (if needed):
- Primary Green: 140 45% 35%
- Surface: 0 0% 98%
- Input Fields: 0 0% 100% with subtle border

### B. Typography
**Font Stack**: Inter or System UI for data clarity
- Modal Title: 20px, font-semibold
- Category Labels: 14px, font-medium
- Input Labels: 13px, font-medium, text-secondary
- Helper Text: 12px, font-normal, text-secondary
- Percentage Values: 16px, font-medium (when displayed)

### C. Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Modal padding: p-6
- Section spacing: space-y-6
- Input group spacing: space-y-4
- Label-to-input gap: gap-2
- Button spacing: gap-3

**Modal Dimensions**:
- Max width: max-w-2xl (672px)
- Min height: Auto-fit content with max-h-[85vh]
- Overflow: Internal scroll for long category lists

### D. Component Library

**Modal Structure**:
- Overlay: bg-black/60 backdrop-blur-sm
- Container: Rounded-xl (rounded-xl) with elevation shadow-2xl
- Header: Sticky top position with title + close button, pb-4 border-b
- Body: Scrollable content area with py-6
- Footer: Sticky bottom with action buttons, pt-4 border-t

**Input Components**:
- **Percentage Input Fields**: 
  - Input type="number" with % suffix displayed inline
  - Dark background (bg-surface) with focus ring in primary green
  - Right-aligned text for numerical consistency
  - Min/Max validation indicators (0-100%)
  - Step value: 0.1 for decimal precision

**Category Organization**:
- Group categories in expandable sections (Accordion pattern)
- Each category row: Label (left) + Input (right) in 2-column grid
- Visual hierarchy: Main categories (bold) → Subcategories (indented pl-4)

**Action Buttons**:
- Primary: "Salvar Benchmarks" - filled green button
- Secondary: "Cancelar" - outline button with subtle border
- Tertiary: "Restaurar Padrões" - text button, left-aligned
- Button size: px-6 py-2.5

### E. Interactive States
- Input Focus: Ring-2 ring-primary-green with smooth transition
- Validation States: 
  - Valid: Subtle green checkmark icon (right-side)
  - Invalid: Red border + error message below
  - Warning: Amber icon for unusual values (>80% or <5%)
- Hover States: Subtle background lift on input fields (bg-opacity change)
- Loading: Skeleton states for category lists

## Special Features

**Smart Defaults**:
- Pre-filled industry-standard percentages
- "Copiar de..." dropdown to clone from existing categories
- Bulk edit mode toggle for applying same % to multiple categories

**Data Visualization**:
- Small inline sparkline/bar indicator showing benchmark range
- Color-coded percentage ranges (Low: <20%, Medium: 20-50%, High: >50%)

**Accessibility**:
- Tab navigation flows logically through categories
- Escape key closes modal with confirmation if changed
- Clear focus indicators with 2px ring
- ARIA labels for percentage inputs with category context

## Layout Specifications

**Header Section**:
- Title + subtitle describing benchmark purpose
- Quick stats: "X categorias configuradas" badge
- Icon: Chart/benchmark icon in primary green

**Body Grid Pattern**:
```
[Category Icon] [Category Name]          [Input Field %]
                [Subcategory]            [Input Field %]
                [Subcategory]            [Input Field %]
```
- Use grid-cols-[auto_1fr_140px] for alignment
- Dividers between major category groups

**Footer Actions**:
- Left: "Restaurar Padrões" text button
- Right: "Cancelar" + "Salvar" button group
- Save button disabled until valid changes made

## Micro-Interactions
- Smooth modal entrance: scale-95 to scale-100 + opacity fade (200ms)
- Input field expand on focus: subtle scale effect
- Success state: Brief green flash on save completion
- Category accordion: Rotate chevron icon with transition

This modal integrates seamlessly with the existing agricultural management system while providing efficient, professional benchmark configuration capabilities.