# CloudCinema

CloudCinema is a premium personal media streaming platform inspired by Netflix, Apple TV, Infuse, and Plex. It is designed to catalog and stream media with a cinematic visual language, frosted glass panels, responsive layouts, and responsive dark/light theme switching.

This is the Core Infrastructure (v0.2) establishing type foundations, strict environment variable validations, customized error schemas, centralized configuration managers, and separated utility folders.

---

## Tech Stack

- **Core**: Next.js 16 (App Router) & React 19
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 & custom design variables
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Themes**: next-themes
- **Package Manager**: npm

---

## Folder Structure & Responsibilities

The codebase conforms to a clean modular architecture:

```
src/
├── app/                  # Next.js App Router (pages & global layouts)
├── components/           # Reusable UI & Layout components
│   ├── common/           # Common presentational components (Logo)
│   ├── layout/           # Structural layout containers (AppShell, Sidebar, TopBar, PageContainer)
│   └── ui/               # Lower-level design primitives (GlassCard, GlassPanel, AnimatedHover)
├── config/               # Application-wide configurations & static schemas
│   ├── app.ts            # General app settings and features toggles
│   ├── design.ts         # Centralized design tokens (radii, spacing, transitions, z-indices)
│   ├── env.ts            # Strict environment variable validation & registry
│   ├── navigation.ts     # Main menus and sidebar navigation mappings
│   └── routes.ts         # Page route constant definitions
├── lib/                  # Helper utilities & configuration bindings
│   ├── cn.ts             # Tailwind class merging utility
│   ├── errors.ts         # Application error classes (AppError) and code definitions
│   ├── format.ts         # String/Date formatting helpers
│   └── guards.ts         # Strict TypeScript type guard checks
├── providers/            # React Context providers (ThemeProvider)
└── styles/               # Global CSS files (Tailwind v4 settings)
```

---

## Architecture Organization

### 1. Configuration & Validation Layer (`src/config/`)

All configurations are strictly decoupled from application features and centralized:
* **Environment Validation (`env.ts`)**: Runs synchronously on application startup. Validates the existence of required properties (`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`) and enforces URL validation constraints, throwing immediate errors on boot if checks fail.
* **App Configuration (`app.ts`)**: Sets global settings like layout breakpoints, default language settings, current version metadata, and feature toggles (such as authentication or Supabase switches).
* **Route Definitions (`routes.ts`)**: Declares page routes in a single read-only object map, eliminating hardcoded href strings across screens.
* **Navigation Config (`navigation.ts`)**: Standardizes structural menus utilizing route definitions.
* **Design Tokens (`design.ts`)**: Exposes shared design properties (glass opacity, z-indices, padding values) consumed by UI components to ensure layout consistency.

### 2. Error Architecture (`src/lib/errors.ts`)

Standardized runtime error definitions:
* **`AppError`**: Custom error class expanding native `Error` with `code` (e.g. `ENV_VALIDATION_ERROR`, `ROUTE_NOT_FOUND`) and operational markers (`isOperational: boolean`).
* **`isAppError`**: Type guard to check if an unknown error object matches `AppError` properties.

### 3. Utility Layer (`src/lib/`)

Monolithic scripts are replaced with modular utilities categorized by responsibility:
* **`cn.ts`**: Focuses exclusively on class merging using `clsx` and `tailwind-merge`.
* **`format.ts`**: Handles Date, Number, or String casing representations (e.g. `getCurrentYear`).
* **`guards.ts`**: Hosts type assertion helpers.

---

## Local Setup

To set up and run CloudCinema locally, follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Modify any variables in `.env.local` as needed.

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

4. **Lint and Format Check**:
   ```bash
   npm run lint
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## Development Philosophy

- **Decoupled Configuration**: Never fetch environment properties directly via `process.env` inside components. Always fetch values through the centralized `env` or `appConfig` loaders.
- **Strict Typing**: Strict TypeScript configurations are enabled. No `any` type escapes, and all variables must be explicitly defined or correctly inferred.
- **RSC Preferences**: All pages and structural components default to Server Components. Interactivity (like custom triggers or hooks) is isolated inside dedicated Client Components (wrapped in `"use client"`).
- **Separation of Concerns**: Animations (Framer Motion) are kept strictly separate from basic presentational layouts. For example, cards use pure CSS/Tailwind transition utilities, while custom clients wrap sections inside designated animation helpers.
