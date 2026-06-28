# CloudCinema

CloudCinema is a premium personal media streaming platform inspired by Netflix, Apple TV, Infuse, and Plex. It is designed to catalog and stream media with a cinematic visual language, frosted glass panels, responsive layouts, and responsive dark/light theme switching.

This is the project foundation (v0.1) establishing the core UI shell, design tokens, layout primitives, and route structures.

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

## Folder Structure

The project conforms to a production-ready SaaS structure:

```
src/
├── app/                  # Next.js App Router (pages & global layouts)
├── components/           # Reusable UI & Layout components
│   ├── common/           # Common components (Logo, etc.)
│   ├── layout/           # AppShell, Sidebar, TopBar, PageContainer
│   └── ui/               # Low-level primitives (GlassCard, GlassPanel)
├── config/               # Application configurations (siteConfig)
├── constants/            # Global constants (versions, design systems)
├── features/             # Feature module placeholders
├── hooks/                # Custom React hooks
├── lib/                  # Library bindings (cn utility)
├── providers/            # Context providers (ThemeProvider)
├── services/             # Service integration classes (placeholders)
├── styles/               # Global CSS files (Tailwind v4 settings)
├── types/                # Core TypeScript definitions (placeholders)
└── utils/                # Helper utilities (placeholders)
```

Also contains:
- `docs/`: Technical specifications and architectural guides.
- `public/`: Public assets and favicon images.

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

- **Responsive & Dynamic Design**: The user interface is desktop-first, mobile-friendly, and feels alive with frosted layouts, border glow effects, and elegant scale micro-animations.
- **Design Tokens**: Color, padding, blur, and border values are parameterized via CSS variables in `src/styles/globals.css` and mapped to Tailwind v4. Avoid hardcoding magic hex values or spacing definitions.
- **Component-Driven Layout**: Interactive and layout structures are modularized into separate, reusable files (e.g. `AppShell`, `PageContainer`, `GlassPanel`, `GlassCard`).
- **TypeScript First**: Strict type checks, no `any`, and zero lint warning tolerances to maintain production stability.
- **Server Component Preference**: Use React Server Components (RSC) for pages and content-heavy regions, leveraging Client Components (`"use client"`) only when user interaction or hooks (state, router, pathname) are required.
- **Minimalist Architecture**: Keep the project lightweight, clean, and modular without pre-empting or adding unrequested functionality.
