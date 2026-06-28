# CloudCinema Design System

This document outlines the visual language and interactive foundations of CloudCinema (v0.3.2). These foundations are established as reusable, highly accessible primitives.

---

## 1. Typography System

The typography primitives are polymorphic (accepting an `as` prop to alter the rendered HTML tag) and responsive by default.

### Primitives

* **`Display`**: Extra large hero headers for highlights (default tag: `h1`).
* **`Heading`**: Secondary section headers (default tag: `h2`).
* **`Title`**: Sub-sections and item headers (default tag: `h3`).
* **`Subtitle`**: Explanatory details and headers (default tag: `p`).
* **`Body`**: Standard content readable paragraphs (default tag: `p`).
* **`Caption`**: Fine print or minor details (default tag: `span`).
* **`Label`**: Input descriptors and metadata labels (default tag: `label`).
* **`Overline`**: Cinematic tags and upper-cased labels (default tag: `span`).

### Usage

```tsx
import { Heading, Subtitle } from "@/components/ui/Typography";

export default function Section() {
  return (
    <div>
      <Heading as="h1">Latest Additions</Heading>
      <Subtitle>Recently indexed files from your library.</Subtitle>
    </div>
  );
}
```

---

## 2. Motion Foundation

Motion wrappers package Framer Motion animations into isolated containers. 

### Primitives

* **`FadeIn`**: Opacity transition.
* **`FadeUp`**: Opacity + vertical translation (staggered entries).
* **`ScaleIn`**: Smooth scale growth.
* **`BlurIn`**: Opacity + filter blur decay.
* **`HoverLift`**: Minor lift translation (`-translate-y-1`) on mouse hover.
* **`FocusScale`**: Minor scale grow on active keyboard/TV target.
* **`PageReveal`**: Staggered reveal for child components.

### Accessibility (`prefers-reduced-motion`)

All wrappers subscribe to user system properties using Framer Motion's `useReducedMotion()`. If active:
* Opacity transitions occur instantly or over a zero-duration limit.
* Spatial transitions (translations, scaling, and blurs) are bypassed to prevent motion sickness.

---

## 3. Glass Foundation

Decoupled glass interfaces styled via Tailwind v4 `@utility` tokens and centralized variables.

### Primitives

* **`GlassSurface`**: Standard frosted card/panel container.
* **`GlassContainer`**: Full page structural container backing.
* **`GlassOverlay`**: Frosted modal backdrop layout wrapper.
* **`GlassSection`**: Separated page layout panel partitions.
* **`GlassDivider`**: Micro-thin glass border divider.

---

## 4. Focus Foundation

Standardized outline and border highlight indicators supporting Desktop, Keyboard, Android TV, and Gamepad D-pad remote controls.

### Primitives

* **`FocusRing`**: Glowing focus indicator visible on focus-within.
* **`TVFocus`**: High-contrast outline border and scale growth tailored for TV remote control d-pad navigation.
* **`KeyboardFocus`**: Renders focus indicators only when navigating via keyboard using CSS `focus-visible`.
* **`HoverFocus`**: Unifies hover borders and keyboard focus rings.
