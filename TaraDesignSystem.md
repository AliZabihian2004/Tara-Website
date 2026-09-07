```markdown
# TARA Design System — Instruction Reference
## For use with Claude as a design authority document

---

## Design Philosophy

Combine educational authority with organizational trust.
Aesthetic: calm, purposeful, legible.
Avoid visual noise. Prioritize readability and hierarchy.

---

## Color System

All colors defined in OKLCH for perceptually uniform lightness and hue stability.
Always use CSS custom properties. Never hard-code literals in components.

### Neutral Ramp

| Token                  | Value                        | Role                  |
|------------------------|------------------------------|-----------------------|
| `--color-neutral-0`    | `oklch(98% 0.004 250)`       | off-white surface     |
| `--color-neutral-50`   | `oklch(96% 0.005 250)`       | page background       |
| `--color-neutral-100`  | `oklch(93% 0.006 250)`       | raised surface        |
| `--color-neutral-200`  | `oklch(87% 0.008 250)`       | border default        |
| `--color-neutral-300`  | `oklch(78% 0.010 250)`       | border strong         |
| `--color-neutral-400`  | `oklch(64% 0.010 250)`       | muted text            |
| `--color-neutral-500`  | `oklch(50% 0.010 250)`       | secondary text        |
| `--color-neutral-700`  | `oklch(32% 0.012 250)`       | body text             |
| `--color-neutral-900`  | `oklch(16% 0.010 250)`       | heading / off-black   |
| `--color-neutral-950`  | `oklch(12% 0.008 250)`       | darkest surface       |

### Primary Accent — Navy Blue (hue 250°)
Semantic purpose: trust, expertise, organization.

| Token                   | Value                   |
|-------------------------|-------------------------|
| `--color-primary-50`    | `oklch(96% 0.018 250)`  |
| `--color-primary-100`   | `oklch(91% 0.035 250)`  |
| `--color-primary-200`   | `oklch(84% 0.060 250)`  |
| `--color-primary-300`   | `oklch(74% 0.090 250)`  |
| `--color-primary-400`   | `oklch(62% 0.118 250)`  |
| `--color-primary-500`   | `oklch(50% 0.140 250)`  | ← main brand
| `--color-primary-600`   | `oklch(42% 0.132 250)`  | ← hover state
| `--color-primary-700`   | `oklch(34% 0.118 250)`  | ← pressed state
| `--color-primary-800`   | `oklch(26% 0.095 250)`  |
| `--color-primary-900`   | `oklch(18% 0.065 250)`  |

### Secondary Accent — Teal (hue 195°)
Semantic purpose: learning, growth, freshness.

| Token                | Value                   |
|----------------------|-------------------------|
| `--color-teal-300`   | `oklch(76% 0.085 195)`  |
| `--color-teal-500`   | `oklch(58% 0.110 195)`  |
| `--color-teal-700`   | `oklch(38% 0.090 195)`  |

### Semantic Colors

| Token               | Value                    | Purpose  |
|---------------------|--------------------------|----------|
| `--color-success`   | `oklch(55% 0.130 155)`   | Success  |
| `--color-warning`   | `oklch(72% 0.145 75)`    | Warning  |
| `--color-danger`    | `oklch(55% 0.185 25)`    | Danger   |
| `--color-info`      | `oklch(60% 0.100 225)`   | Info     |

### Role Tokens (use these in all components, never raw palette values)

```css
:root {
  --surface:        var(--color-neutral-50);
  --surface-raised: var(--color-neutral-0);
  --border:         var(--color-neutral-200);
  --border-strong:  var(--color-neutral-300);
  --text-heading:   var(--color-neutral-900);
  --text-body:      var(--color-neutral-700);
  --text-muted:     var(--color-neutral-400);
  --accent:         var(--color-primary-500);
  --accent-hover:   var(--color-primary-600);
  --accent-subtle:  var(--color-primary-50);
}

[data-theme="dark"] {
  --surface:        oklch(14% 0.010 250);
  --surface-raised: oklch(19% 0.012 250);
  --border:         oklch(28% 0.012 250);
  --border-strong:  oklch(38% 0.012 250);
  --text-heading:   oklch(96% 0.005 250);
  --text-body:      oklch(82% 0.008 250);
  --text-muted:     oklch(58% 0.010 250);
  --accent:         oklch(62% 0.118 250);  /* slightly lighter in dark */
  --accent-hover:   oklch(70% 0.108 250);
  --accent-subtle:  oklch(22% 0.030 250);
}

**Dark mode rule:** accents use slightly lower chroma and higher lightness.
Dark mode is a separate token set, never an inverted filter.

---

## Spacing Scale

Base unit: 4px. All values are multiples of 4.

css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
}

| Token         | Value  | Use case                              |
|---------------|--------|---------------------------------------|
| `--space-1`   | 4px    | Badge/tag inline padding              |
| `--space-2`   | 8px    | Icon-to-label gap, tight padding      |
| `--space-3`   | 12px   | Input internal padding                |
| `--space-4`   | 16px   | Card padding (base)                   |
| `--space-5`   | 20px   | Form element vertical gap             |
| `--space-6`   | 24px   | Large card padding                    |
| `--space-8`   | 32px   | Gap between internal sections         |
| `--space-10`  | 40px   | Margin between independent components |
| `--space-12`  | 48px   | Section spacing                       |
| `--space-16`  | 64px   | Hero padding, major block gap         |
| `--space-24`  | 96px   | Large page section gap                |

Vertical rhythm inside a card should echo the rhythm between cards.

---

## Elevation / Shadow

Shadows convey semantic layer, not just decorative depth.
Prefer border + soft shadow over heavy blur.
Reserve strong shadows for genuinely floating layers.

css
:root {
  --shadow-none: none;

  /* Flat cards, list items */
  --shadow-sm:
    0 1px 2px oklch(16% 0.010 250 / 0.06),
    0 0   0  1px var(--border);

  /* Interactive cards, hover state */
  --shadow-md:
    0 1px 3px  oklch(16% 0.010 250 / 0.08),
    0 4px 8px  oklch(16% 0.010 250 / 0.06);

  /* Dropdowns, tooltips, popovers */
  --shadow-lg:
    0 2px  6px  oklch(16% 0.010 250 / 0.08),
    0 8px  20px oklch(16% 0.010 250 / 0.10);

  /* Modals, dialogs, side panels */
  --shadow-xl:
    0 4px  12px oklch(16% 0.010 250 / 0.10),
    0 20px 48px oklch(16% 0.010 250 / 0.14);
}

[data-theme="dark"] {
  --shadow-sm:
    0 1px 2px oklch(4% 0 0 / 0.40),
    0 0   0  1px var(--border);
  --shadow-md:
    0 1px 4px  oklch(4% 0 0 / 0.40),
    0 4px 10px oklch(4% 0 0 / 0.30);
  --shadow-lg:
    0 3px  8px  oklch(4% 0 0 / 0.45),
    0 10px 28px oklch(4% 0 0 / 0.35);
  --shadow-xl:
    0 6px  16px oklch(4% 0 0 / 0.50),
    0 24px 56px oklch(4% 0 0 / 0.45);
}

---

## Typography

css
:root {
  /* Font stacks — correct rendering for Persian and Latin */
  --font-sans: 'Vazirmatn', 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', 'Cascadia Code', monospace;

  /* Type scale — ratio 1.25 (Major Third) */
  --text-xs:   0.75rem;    /* 12px — small label        */
  --text-sm:   0.875rem;   /* 14px — helper, badge      */
  --text-base: 1rem;       /* 16px — body               */
  --text-lg:   1.125rem;   /* 18px — lead paragraph     */
  --text-xl:   1.25rem;    /* 20px — card title         */
  --text-2xl:  1.5rem;     /* 24px — section title      */
  --text-3xl:  1.875rem;   /* 30px — page title         */
  --text-4xl:  2.25rem;    /* 36px — hero heading       */

  /* Line heights — loosen as size shrinks */
  --leading-tight:  1.25;
  --leading-normal: 1.6;   /* default body */
  --leading-loose:  1.75;

  /* Border radius — two or three values, inner < outer */
  --radius-sm: 4px;    /* badge, tag, chip       */
  --radius-md: 8px;    /* input, button          */
  --radius-lg: 12px;   /* card                   */
  --radius-xl: 16px;   /* modal, side panel      */
}

**Body measure:** keep line length between 45–75 characters.
**Numerics:** use tabular figures (`font-variant-numeric: tabular-nums`) for tables.

---

## Accessibility Rules

- Body text: minimum WCAG AA contrast (4.5:1)
- Large text / UI components: minimum 3:1
- Never use hue alone to convey state — pair with icon, weight, underline, or label
- Focus rings must be visible in both light and dark themes
- Touch targets: minimum 44 × 44px

---

## Motion

css
/* Standard transition */
transition: transform 150ms ease, opacity 150ms ease;

/* Never animate layout properties */
/* Always respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; }
}

- Transition range: 120–240ms
- Animate `transform` and `opacity`, not `width`, `height`, or layout
- Remove movement under `prefers-reduced-motion`, keep non-motion feedback

---

## Summary Table

| Dimension       | Decision                       | Rationale                                     |
|-----------------|--------------------------------|-----------------------------------------------|
| Primary color   | Navy blue — OKLCH 250°         | Trust, expertise, organizational authority    |
| Secondary color | Teal — OKLCH 195°              | Learning, freshness, growth                   |
| Background      | off-white ~96% lightness       | Softer than pure white, less eye strain       |
| Body text       | off-black ~16% lightness       | High readability, no harsh pure-black contrast|
| Shadows         | border + shallow shadow        | Real elevation without visual clutter         |
| Spacing         | 4px rhythm                     | Consistent, predictable alignment             |
| Color space     | OKLCH throughout               | Perceptually uniform, stable hue across steps |
| Type ratio      | 1.25 Major Third               | Calm hierarchy — not loud, not flat           |
| Dark mode       | Separate token set             | Independent lightness decisions per theme     |
