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

### Secondary Accent — Gold (hue 75°)
Semantic purpose: brand detail, taken from the logo (navy + gold).

| Token                | Value                   |
|----------------------|-------------------------|
| `--color-gold-300`   | `oklch(84% 0.075 80)`   |
| `--color-gold-500`   | `oklch(71% 0.095 75)`   |
| `--color-gold-700`   | `oklch(48% 0.085 70)`   |

Role tokens: `--accent-2` (lines, dots, icons, fills), `--accent-2-text` (gold text, ≥4.5:1 on surfaces), `--accent-2-subtle` (tinted backgrounds).

**Gold rule:** gold is for hairlines, dots, icons and small labels only (eyebrow marker, `.badge--gold`, `.divider-gold`, footer headings). Never use it for body or muted text; when gold is used as text, use `--accent-2-text`.

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

## Editorial Layer (v2)

Added October 2026. Additive only: every token above keeps its value.
Aesthetic stays calm, purposeful, legible. The editorial layer adds scale, rhythm and hairlines, not noise.
Tokens live in `assets/css/variables.css`. Homepage styles live in `home-editorial.css` and are scoped to `body.page-home`, so pages adopt the layer one at a time.

### Display type

| Token               | Value                                            | Use                                 |
|---------------------|--------------------------------------------------|-------------------------------------|
| `--text-5xl`        | `2.8125rem` (45px)                               | continues the 1.25 scale            |
| `--text-6xl`        | `3.5rem` (56px)                                  | large numerals (step counter)       |
| `--text-display`    | `clamp(--text-3xl, 1.2rem + 3vw, --text-6xl)`    | **hero h1 only**                    |
| `--text-section`    | `clamp(--text-2xl, 1.1rem + 1.6vw, --text-4xl)`  | homepage section h2                 |
| `--leading-display` | `1.3`                                            | Persian display lines need the room |
| `--measure-display` | `18ch`                                           | max width of display headings       |

- Display headings use weight 800 and `text-wrap: balance`.
- Lead paragraphs under section heads use `--text-body` at `--text-lg`. Do not use `--text-muted` for long text, because it falls below 4.5:1 on `--surface`.

### Editorial patterns

- **Numbered eyebrow:** `<span class="eyebrow"><span class="eyebrow__num">۰۱</span>Label</span>`. The number uses `--accent-2-text`, followed by a 24px gold hairline. Sections are numbered in reading order, and the hero eyebrow stays a pill.
- **Hairlines:** use `--rule-gold` for decorative rules. Structural dividers stay on `--border`.
- **Numbered lists:** rows divided by `--border`, a 56px icon tile, and an outlined numeral (`-webkit-text-stroke` on `--border-strong`, gold on hover).
- **Sticky aside:** in two-column sections (5fr / 7fr), the heading column is `position: sticky` on desktop and static at 860px and below.
- **Icons:** inline SVG sprite (`#i-*`), 24×24 viewBox, 1.75 stroke, `currentColor`. No emoji in UI.

### Surfaces, radius, category tones

| Token              | Value                                  | Use                                       |
|--------------------|----------------------------------------|-------------------------------------------|
| `--radius-2xl`     | `24px`                                 | large media panels, desktop dialogs       |
| `--rule-gold`      | gold at 60% via `color-mix`            | hairlines                                 |
| `--surface-sunken` | surface mixed toward border            | quiet panels                              |
| `--tone-1/2/3`     | navy 500, navy 300, gold 500 (dark set lighter) | category bars. **Always paired with a text label.** |

### Motion tokens

| Token               | Value                      | Use                                   |
|---------------------|----------------------------|---------------------------------------|
| `--ease-out`        | `cubic-bezier(.2,.7,.2,1)` | all entrances and state changes       |
| `--duration-fast`   | `150ms`                    | hover, press                          |
| `--duration-base`   | `240ms`                    | state changes, dialogs                |
| `--duration-enter`  | `600ms`                    | one-time reveal entrances             |
| `--duration-ambient`| `24s`                      | slow background drift (hero only)     |
| `--tilt-max`        | `4deg`                     | pointer tilt on cards                 |

- Interactive transitions stay in the 120–240ms range. Only one-time entrances (`--duration-enter`) and ambient hero motion may be longer.
- Motion is opt-in through `html.motion`, which `main.js` sets unless reduced motion is on. Content is never hidden when scripts or motion are off.
- Pointer effects (tilt, spotlight, parallax) apply only on `(hover: hover) and (pointer: fine)`.

### Interactive components (homepage)

- **Course card:** the whole card is clickable through a stretched title link. A "quick view" button sits over the photo (always visible on touch). Hover adds tilt, spotlight and a gold hairline under the photo.
- **Quick-view dialog:** native `<dialog>` with `showModal()`. Focus starts on the close button, Esc or a backdrop click closes it, and focus returns to the trigger. It becomes a bottom sheet at 720px and below, and ←/→ browse the visible courses (RTL aware).
- **Catalog at a glance:** stats and category bars are computed from the cards on the page. Segments act as filter buttons that drive the real tabs.
- **Process timeline:** a rail fills navy→gold with scroll progress, past steps turn active, and a large step counter sits in the sticky aside.

### Course pages (`body.page-course`, `course-editorial.css`)

- **Title:** `--text-title` = `clamp(--text-3xl, 1.2rem + 2.2vw, --text-5xl)`, for inner-page h1 only.
- **Section headings:** `.course-h2` with a gold `.course-h2__num` (۰۱–۰۴) above the heading.
- **Header:** a glass info card (`.info-card--glass`) over an animated background.
- **Syllabus:** modules are numbered in gold with Persian digits.

### Animated course backgrounds (`course-bg.js`)

Code-drawn on `<canvas data-course-bg>`, using colors read from tokens. They re-read the colors when the theme changes.

| Category                 | Motif (`body[data-motif]`) | Idea                                              |
|--------------------------|----------------------------|---------------------------------------------------|
| AI                       | `neural`                   | drifting nodes, links, gold signals along edges   |
| Accounting / finance     | `ledger`                   | ledger grid, flowing chart lines, scanning cursor |
| Organizational skills    | `paths`                    | routes converging on a shared goal, gold movers   |

- **Placements:**
  - Header: full strength, masked down to about 35% behind the title column.
  - Syllabus: `data-intensity` 0.7, as a radial accent.
  - Closing band: `data-tone="inverse"`, using light lines on navy.
- **Performance and motion:**
  - Rendering is capped at device pixel ratio 2, and the animation pauses when off-screen or when the tab is hidden.
  - Under reduced motion it draws one still frame.
  - Pointer effects apply on fine pointers only.

### Staff panel (`body.panel-app`, `panel-app.css`)

Compact density for daily work. It uses the same palette, type and motion tokens as the site.

| Token                         | Value      | Use                                          |
|-------------------------------|------------|----------------------------------------------|
| `--panel-sidebar-w`           | `248px`    | sidebar width                                |
| `--panel-sidebar-w-collapsed` | `68px`     | icon rail; the choice is saved per browser   |
| `--panel-topbar-h`            | `56px`     | sticky top bar; table headers stick under it |
| `--panel-gutter`              | `24px` (16px on mobile) | page side padding               |
| `--panel-row-pad`             | `10px 12px`| table cell padding                           |
| `--panel-drawer-w`            | `520px`    | ticket drawer                                |
| `--status-new / -progress / -done` | navy / warning / gold | status dots, board columns, stacked bar |

- **Shell:**
  - The sidebar sits at inline-start (right in RTL) and holds the brand, grouped nav ("کار روزانه", plus "مدیریت" for admins only) and the user chip with theme and logout.
  - The active item gets an accent-subtle background and a 3px gold marker.
  - At 960px and below it becomes an off-canvas drawer with a scrim. Esc closes it and focus moves into it.
- **Live badge:** the requests nav item shows the count of new requests, refreshed every 60 seconds.
- **Status:** always shown as a dot plus a label, never by color alone.
- **Requests page:**
  - The table/board switch is remembered.
  - Board: drag a card between columns, or use the "move" menu on each card (keyboard and touch). The move happens instantly and is undone if the server refuses.
  - Clicking a row or card opens the ticket drawer:
    - a native dialog with prev/next buttons
    - Ctrl/⌘+Enter saves, and closing with unsaved changes asks first
    - `?ticket=ID` deep links
    - the full ticket page stays one click away
- **Dashboard:**
  - KPI tiles with icon tiles and a 14-day sparkline.
  - Daily chart with a 7/14/30-day range, a 7-day moving average in gold, and a summary of total, daily average and busiest day.
  - Status stacked bar and request-type donut, whose parts link to the filtered list.
- **Login:** split screen, with a navy brand panel showing the animated `paths` motif (`course-bg.js`) and the form.

---

## Summary Table

| Dimension       | Decision                       | Rationale                                     |
|-----------------|--------------------------------|-----------------------------------------------|
| Primary color   | Navy blue — OKLCH 250°         | Trust, expertise, organizational authority    |
| Secondary color | Gold — OKLCH 75°               | Brand detail, from the logo                   |
| Background      | off-white ~96% lightness       | Softer than pure white, less eye strain       |
| Body text       | off-black ~16% lightness       | High readability, no harsh pure-black contrast|
| Shadows         | border + shallow shadow        | Real elevation without visual clutter         |
| Spacing         | 4px rhythm                     | Consistent, predictable alignment             |
| Color space     | OKLCH throughout               | Perceptually uniform, stable hue across steps |
| Type ratio      | 1.25 Major Third               | Calm hierarchy — not loud, not flat           |
| Dark mode       | Separate token set             | Independent lightness decisions per theme     |
| Display type    | Fluid, 800 weight, balanced    | Editorial scale without new typefaces (v2)    |
| Decoration      | Gold hairlines + numerals      | Premium editorial feel, no visual noise (v2)  |
| Icons           | 1.75-stroke SVG sprite         | Consistent, theme-aware, no emoji (v2)        |
