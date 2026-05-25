# AI Development Rules - Folgas Pakerê

This document defines the technical standards and architectural rules for the Folgas Pakerê application.

## Tech Stack Overview

- **Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/start/overview) (Full-stack React framework powered by Vite).
- **Language**: TypeScript (Strict mode).
- **Routing**: [TanStack Router](https://tanstack.com/router) with file-based routing (see `src/routes/`).
- **Data Fetching**: [TanStack Query](https://tanstack.com/query) for client-side state and caching.
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime, and Storage).
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4) for utility-first styling.
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (built on Radix UI primitives).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) combined with [Zod](https://zod.dev/).
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/) for toast messages.

## Development Rules

### 1. Routing & Pages
- All routes must be defined in `src/routes/`.
- Use TanStack Router's `createFileRoute` for all page definitions.
- Protected routes should be nested under `_authenticated.tsx`.
- Admin-only routes should be nested under `_authenticated/admin.tsx`.

### 2. Data Management
- Use **Server Functions** (`createServerFn`) for sensitive operations or logic that requires the Supabase Service Role (bypassing RLS).
- Use **TanStack Query** hooks for fetching data on the client side.
- Prefer Supabase Realtime channels for features requiring live updates (e.g., notifications, calendar changes).

### 3. UI & Styling
- **Always** use Tailwind CSS classes for layout and spacing.
- Use shadcn/ui components located in `src/components/ui/`. Do not modify these files directly; wrap them in custom components if needed.
- Icons must come from `lucide-react`.
- Maintain the brand colors defined in `src/styles.css` (Yellow: `#fede59`, Red: `#e30f27`).

### 4. Backend & Database
- Database interactions should primarily happen via the Supabase client.
- Business logic that affects multiple tables or requires strict validation should be implemented as PostgreSQL triggers or functions in Supabase.
- Use `src/integrations/supabase/client.server.ts` (Service Role) **only** inside Server Functions.

### 5. Code Structure
- Keep components small and focused (aim for < 100 lines).
- Place reusable logic in `src/lib/` or custom hooks in `src/hooks/`.
- Business rules specific to the "Folgas" logic should reside in `src/lib/folga-rules.ts`.

### 6. Error Handling & Feedback
- Use `sonner` (toast) to provide immediate feedback for user actions (success/error).
- Do not use generic `alert()` or `confirm()` unless absolutely necessary; prefer shadcn/ui Dialogs or Alert Dialogs.