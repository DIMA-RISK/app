# DIMA Risk — Dashboard UI Design Spec

A complete description of the DIMA Risk dashboard's visual language and component
system, written so another dashboard can be built to match it. Values are the
real ones in use (see `app/dashboard/dashboard.module.css` and
`app/dashboard/_components/`). Stack of record: **Next.js App Router + CSS
Modules + lucide-react icons + Poppins**, but the tokens and rules below are
implementation-agnostic.

---

## 1. Design language at a glance

- **Theme:** dark-only, deep near-black navy canvas with a single purple brand
  accent and a 4-colour semantic ramp (red/orange/amber/green) plus blue for info.
- **Mood:** enterprise security/compliance — calm, dense, data-forward. Cards
  float on a black background; purple is used sparingly for emphasis and active state.
- **Shape:** rounded. Pills are fully round (20px), cards 14px, controls 8px.
- **Density:** compact. Small type (0.7–0.9rem body), tight paddings, lots of
  information per screen without feeling cramped.
- **Motion:** quick and subtle (0.12–0.22s). Hover lifts on cards, slide/fade on
  overlays. Nothing bouncy.
- **Single font:** Poppins for everything, weights 500/600/700.

---

## 2. Color tokens

### 2.1 Surfaces (dark navy stack)
| Token | Value | Use |
|---|---|---|
| Canvas | `#000212` | App background (behind everything) |
| Chrome | `#07051a` | Sidebar, top nav |
| Card | `#181430` | Cards, stat cards, alert cards, toast |
| Popover | `#0f0c28` | Dropdown menus |
| Field | `rgba(0,2,18,0.55)` | Input/select/textarea background |

### 2.2 Brand purple
| Token | Value | Use |
|---|---|---|
| Primary | `#754cbe` | Primary buttons, active accent bar, toggle-on, focus ring |
| Primary hover | `#643dac` | Primary button hover |
| Accent light | `#9b7de2` | Icons, avatar gradient end |
| Accent lighter | `#c4a8f0` | Active nav text, purple text, tab active |
| Purple wash | `rgba(117,76,190,0.06–0.2)` | Borders, hover fills, icon chips |

Brand borders are almost always `rgba(117,76,190, α)` with α from `0.07`
(subtle) to `0.4` (hover/focus).

### 2.3 Text (on dark)
| Token | Value |
|---|---|
| Primary text | `#ddd7ea` |
| Secondary | `rgba(221,215,234,0.75)` |
| Muted | `rgba(221,215,234,0.5)` |
| Faint | `rgba(221,215,234,0.35–0.45)` |
| Ghost | `rgba(221,215,234,0.25–0.3)` |

### 2.4 Semantic ramp
Two layers: a **solid** color (icons, text-on-dark, bar fills) and a **soft**
badge treatment (`{color}14` fill / `{color}22` border, i.e. ~8%/13% alpha).

| Meaning | Solid | Badge text | Typical use |
|---|---|---|---|
| Critical / danger | `#ef4444` | `#f87171` | Highest severity, errors, over-threshold |
| High | `#f97316` | `#fb923c` | High severity |
| Medium / warning | `#f59e0b` (amber) / `#eab308` | `#fbbf24` | Medium severity, "at risk" |
| Low / success | `#22c55e` | `#4ade80` | Low severity, compliant, resolved |
| Info | `#60a5fa` / `#3b82f6` | `#60a5fa` | Neutral info, source tags |

**Canonical severity scale** (single source of truth, `SeverityBadge.tsx`):

| Level | Color | Icon (lucide) |
|---|---|---|
| `critical` | `#ef4444` | `AlertTriangle` |
| `high` | `#f97316` | `ChevronsUp` |
| `medium` | `#eab308` | `ChevronUp` |
| `low` | `#22c55e` | `Minus` |
| `info` | `#60a5fa` | `Info` |

> Rule: any Critical/High/Medium/Low visual — severity, priority, probability,
> KPI priority — uses this exact ramp so the same word always means the same color.

### 2.5 RAG bands (KPI achievement vs target)
`ragPct = value ÷ target × 100`:
- `≥110%` Exceeds → `#22c55e`
- `90–110%` Meets → `#84cc16`
- `70–89%` Below → `#f59e0b`
- `<70%` Critical → `#ef4444`

---

## 3. Typography

- **Family:** `'Poppins', sans-serif` everywhere (including inputs/buttons).
- **Weights:** 500 (labels/nav), 600 (titles/badges), 700 (values/page titles).
- **Scale** (rem):

| Role | Size | Weight | Color |
|---|---|---|---|
| Page title | 1.35 | 700 | `#ddd7ea` |
| Card title (lg) | 1.0 | 600 | `#ddd7ea` |
| Card title | 0.875 | 600 | `rgba(221,215,234,0.75)` |
| Stat value | 2.0 | 700 | `#ddd7ea` |
| Body / table | 0.8–0.875 | 400–500 | `rgba(221,215,234,0.82)` |
| Subtitle | 0.82 | 400 | `rgba(221,215,234,0.5)` |
| Label / section | 0.68 | 600 | `rgba(221,215,234,0.38)`, UPPERCASE, `letter-spacing 0.06–0.1em` |
| xs / meta | 0.72 | 400 | `rgba(221,215,234,0.4)` |

Uppercase micro-labels (`0.65–0.72rem`, letter-spaced) are the recurring device
for stat labels, table headers, section dividers, and sidebar group headers.

---

## 4. Layout

### 4.1 Shell
Fixed left sidebar + fluid main column on a black canvas.

```
┌───────────┬─────────────────────────────────────────┐
│  SIDEBAR  │  TOP NAV (sticky, 60px)                  │
│  256px    ├─────────────────────────────────────────┤
│  fixed    │  CONTENT (padding 1.75rem 2rem)          │
│           │    page header                            │
│           │    stat grid / cards / tables …           │
└───────────┴─────────────────────────────────────────┘
```

- **Sidebar:** `width 256px`, fixed, `#07051a`, right border `rgba(117,76,190,0.18)`.
  Collapsible to `68px` (icons only). Main column `margin-left` matches and
  animates `0.22s cubic-bezier(0.4,0,0.2,1)`.
- **Content padding:** `1.75rem 2rem`.
- **Max content width:** none — fluid; grids reflow instead.

### 4.2 Grid system
Named grid helpers, all `gap 1.25rem`, all collapse to a single column at
`≤960px`:

| Class | Columns |
|---|---|
| `grid2` | `1fr 1fr` |
| `grid3` | `1fr 1fr 1fr` |
| `grid4` | `repeat(4,1fr)` |
| `grid21` / `grid12` | `2fr 1fr` / `1fr 2fr` |
| `grid31` / `grid13` | `3fr 1fr` / `1fr 3fr` |

**Stat grid:** `repeat(4,1fr)`, `gap 1rem` → 2 cols at `≤1100px` → 1 col at `≤580px`.

### 4.3 Spacing rhythm
Vertical rhythm in rem: section gaps `1.5rem` (`mb15`), card internal `1–1.25rem`,
element gaps `0.4 / 0.5 / 0.8 / 1rem`. Card padding `1.2–1.25rem`.

### 4.4 Radii & shadows
| Element | Radius |
|---|---|
| Pills / badges / status chips | `20px` (fully round) |
| Cards, dropdowns | `14px` |
| Alert cards, modals, toast | `10–12px` |
| Buttons, inputs, icon chips | `8px` |
| Small buttons (`btnXs`) | `6px` |

Shadows are reserved for elevation: card hover `0 8px 24px rgba(0,0,0,0.3)`,
dropdown `0 16px 48px rgba(0,0,0,0.6)`, toast `0 8px 32px rgba(0,0,0,0.5)`.

---

## 5. Navigation

### 5.1 Sidebar
- Logo row (icon + wordmark), then grouped nav, then Account/logout, then a
  collapse toggle pinned to the bottom.
- **Groups** (uppercase micro-header + items):
  - **Main** — Executive Summary
  - **Compliance** — Compliance Status, Questionnaire, GDPR Assessment, ISO 27001, Risk Register, Action Plan
  - **Data** — Assets & Data, Evidence Center
  - **Insights** — Analytics, KPI Dashboard, Alerts, Reports
  - **Admin** — Settings, User Management
  - **Account** — Log out
- **Nav item:** icon (lucide, 17px) + label, `0.855rem`, `rgba(221,215,234,0.6)`.
  Hover → `rgba(117,76,190,0.1)` fill + `#ddd7ea`. Active → `rgba(117,76,190,0.18)`
  fill, `#c4a8f0` text, and a 3px `#754cbe` accent bar on the left edge.
- **Count badge** (e.g. Alerts): round red `#ef4444` pill, white bold text.
- Collapsed mode hides labels/group headers; item titles move to `title=` tooltips.

### 5.2 Top nav (sticky, 60px)
Left→right: page title · search box (icon-inset, max 320px) · spacer · org badge
(pill) · compliance status chip (`statusCompliant`/`statusAtRisk`/`statusCritical`)
· icon buttons (34px, e.g. notifications with red dot) · avatar (34px, purple
gradient `135deg #754cbe→#9b7de2`, initials).

---

## 6. Components

### 6.1 Card
`background #181430`, `border 1px rgba(117,76,190,0.2)`, `radius 14px`,
`padding 1.25rem`.
- **Card header:** flex row, title left + action/badge right, `margin-bottom 1rem`.
  Two title sizes: `cardTitleLg` (1rem, `#ddd7ea`) and `cardTitle` (0.875rem, muted).

### 6.2 Stat card
Interactive KPI tile (`cursor pointer`, hover lifts `translateY(-2px)` +
border brighten + shadow).
```
[LABEL (uppercase micro)]        [icon chip 32px]
[  2rem bold value  /suffix ]
[ sub-text 0.75rem muted ]
```
Icon chips: `iconPurple / iconRed / iconGreen / iconAmber / iconBlue`
(each `{color}12–15%` bg + solid color glyph). Value color is often driven by
state (e.g. risk band → red/amber/green).

### 6.3 Badges / pills
Base `.badge`: inline-flex, `padding 0.2rem 0.55rem`, `radius 20px`, `0.7rem/600`,
optional leading icon (`gap 0.25rem`). Variants: `badgeCritical / badgeHigh /
badgeMedium / badgeLow / badgeInfo / badgePurple / badgeGray / badgeGreen`
(soft `{color}14` fill + `{color}22` border).

**Labeled-badge convention (important):** where several badges of different
dimensions sit together, each renders its dimension inline as
`Dimension: Value` (e.g. `Priority: Critical` · `Effort: Medium` · `Status: Open`)
so shared vocabulary can't be confused. Severity-scaled dimensions use the
canonical ramp + icon; neutral dimensions use a labeled pill in a dimension color.
Reusable pieces: `SeverityBadge{ level, dimension?, title? }`,
`LabeledBadge{ dimension, value, color }`, `SeverityLegend{ note? }`.

### 6.4 Buttons
Base `.btn`: `padding 0.5rem 1rem`, `radius 8px`, `0.82rem/600`, `gap 0.4rem`,
`:active` nudges `translateY(1px)`.
| Variant | Look |
|---|---|
| `btnPrimary` | solid `#754cbe`, white; hover `#643dac` |
| `btnSecondary` | purple wash fill + border, `#c4a8f0` |
| `btnGhost` | transparent, muted text; hover purple wash |
| `btnDanger` | red wash + border, `#f87171` |
Sizes: default, `btnSm` (0.73rem), `btnXs` (0.68rem, radius 6px).

### 6.5 Table
`width 100%`, `font-size 0.83rem`. Header cells: uppercase `0.68rem`,
`rgba(221,215,234,0.4)`, bottom border `rgba(117,76,190,0.14)`. Body cells:
`padding 0.8rem 1rem`, bottom hairline `rgba(117,76,190,0.07)`, last row borderless.
Row hover tints `rgba(117,76,190,0.035)`. Wrap in `.tableWrap` (`overflow-x:auto`)
for horizontal scroll on narrow screens.

### 6.6 Form fields
`.field` = label + control stacked (`gap 0.4rem`). Inputs/selects/textarea share
`padding 0.62rem 0.85rem`, `bg rgba(0,2,18,0.55)`, `border rgba(117,76,190,0.22)`,
`radius 8px`, `#ddd7ea` text; focus → border `#754cbe`. Selects hide native arrow
(`appearance:none`). Textareas `min-height 80px`, vertical resize.

### 6.7 Tabs
Underline tabs: row with bottom hairline; each tab `0.58rem 1rem`, muted;
active → `#c4a8f0` text + 2px `#754cbe` bottom border. Horizontally scrollable,
scrollbar hidden.

### 6.8 Progress bar
Track `height 6px`, `rgba(117,76,190,0.1)`, `radius 3px`. Fill transitions
`width 0.6s ease`. Fills: `fillGreen/fillAmber/fillRed` or `fillPurple`
(gradient `90deg #754cbe→#9b7de2`).

### 6.9 Toggle
Pill switch `38×20px`; off `rgba(117,76,190,0.18)`, on `#754cbe`; knob `16px`
slides `translateX(18px)`, greyish→white when on. Used in `toggleRow`
(label+desc left, switch right, hairline separated).

### 6.10 Timeline (activity feed)
Vertical list; each item = glowing status dot (`dotSuccess/Error/Warning/Info`,
8px with matching `box-shadow` glow) + text (`0.82rem`) + relative time
(`0.73rem` faint). Hairline separators.

### 6.11 Alert card
Row: colored icon chip + content, `radius 12px`, plus a 3px left accent border by
severity (`alertCritical/Warning/Info/Success`).

### 6.12 Dropdown / popover
`#0f0c28`, `border rgba(117,76,190,0.28)`, `radius 14px`, big soft shadow, `dropIn`
animation (fade + `translateY(-6px)`). Sub-parts: `dropdownHead` (uppercase),
`dropdownItem` (icon+label, hover purple wash), `dropdownItemDanger` (red),
`dropdownDivider`, notification items, user header.

### 6.13 Modal
Full-screen overlay `rgba(10,8,20,0.75)` + `backdrop-filter blur(4px)`, centered
`.card` (max-width ~520–560px, `max-height 90vh`, scrolls), close `X` top-right.
Click-out closes; inner content stops propagation. Footer = right-aligned
Cancel (ghost) + primary action.

### 6.14 Toast
Fixed bottom-right, card surface + purple border, `slideUp` in, auto-dismiss
(~3s). Single line with a leading ✓/icon.

### 6.15 Empty state
Centered column, `padding 3rem`, faint text, large low-opacity lucide icon
(`emptyIcon`, opacity 0.25) + one explanatory line.

### 6.16 Skeleton / loading
`.skeleton` shimmer (purple-tinted gradient sweeping `1.4s`). Spinners reuse the
`spin` keyframe on a lucide `Loader2`.

### 6.17 Upload zone
Dashed border `2px rgba(117,76,190,0.25)`, `radius 12px`, hover brightens border +
faint purple fill.

---

## 7. Data visualization patterns

All charts are **hand-built (SVG or CSS)** — no chart library — themed to the ramp.

- **Radial risk gauge:** 180° SVG arc, track `rgba(117,76,190,0.12)`, colored
  progress (`≥80` red / `≥60` orange / `≥40` amber / else green) with a
  `drop-shadow` glow; big centered score, `/100` sub-label.
- **Heatmap (probability × impact):** 4×4 grid of cells; fill escalates by
  `row×col` product (green→orange→amber→red washes), count centered per cell,
  axis micro-labels. Same idea for a 5×5 likelihood×impact "risk curve."
- **Component breakdown bars:** thin 4px tracks with a colored fill per
  sub-score, value `/25` on the right, color by threshold.
- **CSS bar chart:** flex row of `barCol`s, `barFill` heights animate; micro
  label + value under each.
- **Maturity bars / framework bars:** labeled `progressBar`s with color by score
  band and a level tag (`L3 Defined`).

Color-by-value everywhere: green good → amber caution → orange elevated → red
critical, using the §2.4 ramp.

---

## 8. Semantic conventions (meaning → color)

| Situation | Mapping |
|---|---|
| Severity / priority / probability | canonical ramp §2.4 (crit red, high orange, med amber, low green) |
| Compliance status | Compliant green · At Risk amber · Non-Compliant red · Pending gray |
| Task status | open gray · in_progress amber · resolved/done green |
| Effort | quick-win green · medium amber · complex orange |
| Appetite / threshold | within green · outside/over red |
| Source tag | Questionnaire / Network Scan → blue (`#60a5fa`) info pill |
| KPI achievement | RAG bands §2.5 |

Prefer color **plus** a glyph or text label (never color alone) so meaning
survives for color-blind users and in grayscale.

---

## 9. Iconography

- **Library:** `lucide-react`, stroke icons.
- **Sizes:** nav 17px, inline/badge 11–14px, stat chips 16px, empty-state 32px.
- **Recurring:** `LayoutDashboard, ShieldCheck, ClipboardList, AlertTriangle,
  ListChecks, TrendingUp, BarChart3, Bell, FileText, Settings, Users`
  (nav); `AlertTriangle/ChevronsUp/ChevronUp/Minus/Info` (severity);
  `Plus, Edit2, Trash2, X, Download, RefreshCw, ArrowRight, CheckCircle2,
  Circle, Loader2, Target` (actions).

---

## 10. Interaction & motion

- **Durations:** micro 0.12–0.15s (hover/color), layout 0.18–0.22s (sidebar,
  borders), fills 0.5–0.6s (progress/bars).
- **Easing:** `cubic-bezier(0.4,0,0.2,1)` for layout; `ease` for entrances.
- **Hover:** cards lift + border brighten + shadow; nav/rows get purple wash;
  buttons darken.
- **Named keyframes:** `dropIn` (dropdowns), `slideUp` (toast), `shimmer`
  (skeleton), `spin` (loaders).
- **Optimistic UI:** status toggles update immediately and revert on error
  (see Action Plan status cycling).

---

## 11. Responsive

- Sidebar collapses to 68px (manual toggle); content margin follows.
- Every named grid → single column at `≤960px`.
- Stat grid: 4 → 2 (`≤1100px`) → 1 (`≤580px`).
- Tables scroll horizontally inside `.tableWrap`; the page body never scrolls
  sideways.
- Page header and action rows `flex-wrap` so buttons stack gracefully.

---

## 12. Accessibility notes

- Meaning is never color-only — pair with icon/label (severity badges carry both).
- Interactive non-buttons carry `title=` tooltips (also used for collapsed-nav
  labels and "why is this ranked here" rationale).
- Focus states brighten the purple border on inputs; keep visible focus if you
  re-implement.
- Contrast: primary text `#ddd7ea` on `#181430`/`#000212` is comfortably legible;
  keep body text ≥ `rgba(221,215,234,0.5)`.

---

## 13. Anatomy of a typical page

```
<PageHeader>
  <TitleGroup> h1.pageTitle + p.pageSubtitle </TitleGroup>
  <Actions> filter chips / Export (btnGhost) / primary action (btnPrimary) </Actions>
</PageHeader>

<StatGrid>  ← 4 stat cards summarizing the page
<Card row>  ← grid21/grid2: a chart/table card + a side panel
<Filters>   ← select dropdowns (fieldSelect) in a flex-wrap row
<Card p0>   ← full-width table wrapped in tableWrap
<Modal>     ← create/edit overlay when adding a record
```

Recurring recipe: **summary stat cards on top → one or two wide content cards
(chart + list) → filters → a table**, with create/edit handled by a centered
modal and inline optimistic status controls. Muted uppercase micro-labels
separate sections; the single purple accent marks the active/primary path.

---

## 14. Quick-start token block

If rebuilding from scratch, seed these first:

```
--canvas:#000212;  --chrome:#07051a;  --card:#181430;  --popover:#0f0c28;
--field:rgba(0,2,18,.55);
--brand:#754cbe;   --brand-hover:#643dac; --brand-2:#9b7de2; --brand-3:#c4a8f0;
--border:rgba(117,76,190,.2);   --border-strong:rgba(117,76,190,.4);
--text:#ddd7ea; --text-2:rgba(221,215,234,.75); --text-muted:rgba(221,215,234,.5);
--crit:#ef4444; --high:#f97316; --med:#eab308; --low:#22c55e; --info:#60a5fa;
--radius-pill:20px; --radius-card:14px; --radius-ctrl:8px;
font-family:'Poppins',sans-serif;
```
Then build cards, stat cards, the badge ramp, and the sidebar shell — everything
else composes from those.
