# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/bohub/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** BOhub  
**Brand:** BOcode  
**Stack:** React + Vite + Tailwind v4 + shadcn (Base UI)  
**Theme:** Dark only (`color-scheme: dark`)  
**Source of truth (tokens):** `src/index.css` — **LOCKED** (PASO 3.1 / 04)

---

## Global Rules

### Color Palette (LOCKED — do not invent skill palettes)

| Role                     | Hex / value              | CSS variable                         |
| ------------------------ | ------------------------ | ------------------------------------ |
| Primary (lime)           | `#ccff00`                | `--primary`                          |
| On primary               | `#24292a`                | `--primary-foreground`               |
| Primary hover            | `#b8e600`                | `--primary-hover`                    |
| Background               | `#1a1d1e`                | `--background`                       |
| Foreground               | `#ecf0f1`                | `--foreground`                       |
| Card / popover / sidebar | `#24292a`                | `--card` / `--popover` / `--sidebar` |
| Muted surface            | `#2f3435`                | `--muted`                            |
| Muted text               | `#8a9199`                | `--muted-foreground`                 |
| Border                   | `#3a3f41`                | `--border`                           |
| Input border             | `rgba(255,255,255,0.12)` | `--input`                            |
| Destructive              | `#ef4444`                | `--destructive`                      |
| Ring                     | mix of primary + white   | `--ring`                             |

**Brand test:** Primary lime + charcoal bg are non-negotiable. Never replace with purple / cream / indigo skill defaults.

**Usage:**

- Primary = CTAs, brand mark, active nav accent, focus rings (`ring-primary/40`)
- Surfaces = `--background` / `--card` / `--sidebar` — not white cards on dark
- Text hierarchy = `--foreground` → `--muted-foreground`

### Typography

- **Font:** Rubik (heading + body) — `--font-sans` / `--font-heading`
- **Mood:** professional ops hub, flat, dense-but-clear, technical without monospace UI
- **Google Fonts:** [Rubik](https://fonts.google.com/specimen/Rubik)

```css
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap');
```

### Radius & motion

| Token                              | Value                                                |
| ---------------------------------- | ---------------------------------------------------- |
| `--radius`                         | `0.625rem` (10px)                                    |
| `--radius-sm` / `md` / `lg` / `xl` | derived from `--radius`                              |
| Transitions                        | 150–200ms ease                                       |
| Hover lift                         | prefer opacity / color — avoid layout-shifting scale |

### Spacing (Tailwind scale)

Prefer Tailwind spacing; no custom `--space-*` layer required.

| Usage              | Typical                  |
| ------------------ | ------------------------ |
| Icon / inline gaps | `gap-2` (8px)            |
| Control padding    | `px-3` / `py-2`          |
| Section gaps       | `gap-6` (24px)           |
| Page padding       | `p-4` → `p-6` / `lg:p-8` |

---

## Component Specs

Use **shadcn** components under `src/components/ui/*`. Specs below describe intent, not a second CSS framework.

### Buttons

- **Primary:** `bg-primary text-primary-foreground` · hover `bg-primary/80` or `--primary-hover`
- **Outline / secondary:** border `--border`, surface `--card`, text `--foreground`
- **Destructive:** `--destructive` for delete confirms
- Always `cursor-pointer` on clickable controls
- Radius ≈ `rounded-lg` (aligned with `--radius`)

### Cards / panels

- Background `--card`, text `--card-foreground`
- Border `--border` — prefer subtle border over heavy shadow
- **No glow**, no purple gradients, no decorative neon floods
- Cards only when they contain interaction or structured data (tables, forms, sheets)

### Inputs

- Surface `--card` / transparent over bg; border via `--input` / `--border`
- Focus: `ring` / `border-ring` with primary-tinted ring
- Font size ≥ 16px on mobile where possible (avoid iOS zoom)

### Sheets / dialogs / dropdowns

- Surface `--popover` / `--card`
- Overlay: dark scrim (`rgba(0,0,0,0.5)`+) — not light modal chrome
- Max width by content (forms ~ `sm`/`md`); keep actions in footer

### Shell (app)

- Sidebar `--sidebar`; active item: `bg-sidebar-accent` + `text-primary`
- Sticky header + light backdrop blur OK
- Skip link → `#main-content`
- Breadcrumb spirit: `BOhub › Sección` (not marketing subtitles in header)

See also: `pages/shell.md`, `pages/login.md`.

---

## Style Guidelines

**Style:** Flat Design · dark professional dashboard

**Keywords:** charcoal, lime accent, Rubik, dense tables, clear hierarchy, ops tool

**Best For:** Internal BOcode hub (clients, projects, billing) — not consumer landing / App Store promo

**Key Effects:** color/opacity hover, focus rings, soft sticky header blur; 150–200ms transitions

### App pattern (authenticated)

1. Sidebar + sticky header shell
2. Page: h1 + one short supporting line + primary action
3. Filters / search row
4. Data table or form (sheets for create/edit)
5. Pagination when lists are paginated

### Login pattern

- Full-bleed dark canvas; brand-first (BOhub / lime mark)
- Single form column; no register / forgot-password unless product adds them
- High-contrast primary CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Purple / violet / indigo “AI default” palettes (`#7C3AED`, etc.)
- ❌ Warm cream + terracotta “editorial” look
- ❌ Light-mode-first layouts (BOhub is dark-locked)
- ❌ Fira Code / Inter / Roboto as brand UI fonts
- ❌ App Store / consumer landing section recipes for the app shell
- ❌ Emojis as icons — use Lucide (or existing SVG set)
- ❌ Missing `cursor-pointer` on clickables
- ❌ Layout-shifting hover scales
- ❌ Invisible focus states
- ❌ Instant state changes (always transition 150–300ms; respect `prefers-reduced-motion`)
- ❌ Heavy multi-layer shadows / glow on primary lime

---

## Pre-Delivery Checklist

- [ ] Tokens match `src/index.css` (primary `#ccff00`, bg `#1a1d1e`)
- [ ] Rubik loaded; no conflicting display font
- [ ] Lucide (or consistent SVG) icons — no emoji icons
- [ ] `cursor-pointer` on interactives
- [ ] Hover / focus transitions 150–200ms; focus-visible rings
- [ ] Contrast OK on dark surfaces (muted text still readable)
- [ ] `prefers-reduced-motion` respected (global rule in `index.css`)
- [ ] Responsive: 375 / 768 / 1024 / 1440
- [ ] No content under sticky header; no horizontal scroll on mobile
- [ ] Page override file checked if it exists under `pages/`
