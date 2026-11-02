# Flashfix v2 Design System Specification

## 1. Design Philosophy

Flashfix v2 adheres to strict **Linear/Vercel design restraint**:
- **Structural Integrity**: Hairline borders (`1px solid var(--hairline)`) delineate surfaces instead of heavy drop shadows or diffuse blur glows.
- **Single Accent Color**: Amber (`#ef8f0b` for fills, `#9a5200` for light-theme text) is the primary accent. It is reserved for primary actions, active focus states, and meaningful state indicators.
- **No Glowing Blobs**: Glow shadows (`emberGlow`, `amber-md`, radial gradients) are strictly purged.
- **No Decorative Icon Tiles**: Section headers, form cards, and status banners do not wrap icons inside decorative tinted boxes. Brand marks appear only on auth and navigation shells.
- **Plain, Truthful Language**: Pseudo-military terminology and AI-slop copy ("Protocol Summary", "Cryptographic Audit Log", "Live Telemetry Protocol", "Surgical Precision") are banned and replaced with plain, honest words ("Summary", "Timeline", "Loading…").
- **Sentence-Case Micro-Labels**: Form labels, captions, and table headers use clean sentence-case (13px Inter 500) rather than uppercase tracked mono typography.

---

## 2. Semantic Color System & WCAG Contrast Compliance

### 2.1 Token Definitions

The design system uses CSS custom properties defined in `:root` (dark mode) and `.light` (light mode).

| Token Name | Dark Theme (`:root`) | Light Theme (`.light`) | Purpose |
|---|---|---|---|
| `--canvas` | `#0a0a0a` | `#ede6dc` | Tactile off-white beige application canvas |
| `--surface-1` | `#111111` | `#e4dcd0` | Tactile warm off-white beige surface for cards, dialogs, drawers |
| `--surface-2` | `#181818` | `#d9d0c3` | Elevated surface for inputs, buttons, pills, nested panels |
| `--hairline` | `rgba(255, 255, 255, 0.08)` | `rgba(50, 40, 30, 0.12)` | Warm subtle structural border on surfaces |
| `--ink` | `#f5f0eb` | `#141210` | Deep espresso ink for primary text, titles, headings |
| `--ink-secondary` | `#a8a09a` | `#4d443d` | Warm taupe secondary text, helper labels, timestamps |
| `--ink-muted` | `#85807b` | `#786e64` | Warm clay tertiary text, placeholders, deactivated labels |
| `--accent` | `#ef8f0b` | `#ef8f0b` | Solid brand fills, buttons, checks, focus rings (identical in both modes) |
| `--accent-ink` | `#0a0a0a` | `#0a0a0a` | Text and icons rendered directly on solid `--accent` |
| `--accent-text` | `#ef8f0b` | `#ef8f0b` | Brand orange text and links (identical in both modes) |
| `--success` | `#10b981` | `#059669` | Success notifications, confirmed status, delivered |
| `--warning` | `#f59e0b` | `#ef8f0b` | Pending, in-transit, waiting actions |
| `--danger` | `#ef4444` | `#dc2626` | Destructive actions, validation errors, cancelled status |
| `--info` | `#3b82f6` | `#2563eb` | Informational callouts, active repair bench states |

---

### 2.2 Mathematical Contrast Verification (WCAG 2.1)

Contrast ratio formula:
$$\text{Contrast} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
where relative luminance $L = 0.2126 R + 0.7152 G + 0.0722 B$ using sRGB linear transfer functions.

#### Dark Theme Contrast Matrix (Background: `--surface-1: #111111`, $L = 0.00561$)
| Element | Token & Hex | Relative Luminance | Contrast Ratio | WCAG Rating |
|---|---|---|---|---|
| Primary Text | `--ink` (`#f5f0eb`) | $0.8733$ | **16.60:1** | **AAA** ($\ge 7.0:1$) |
| Secondary Text | `--ink-secondary` (`#a8a09a`) | $0.3606$ | **7.38:1** | **AAA** ($\ge 7.0:1$) |
| Muted Text | `--ink-muted` (`#85807b`) | $0.2150$ | **4.77:1** | **AA** ($\ge 4.5:1$) |
| Accent Text | `--accent-text` (`#ef8f0b`) | $0.3850$ | **7.82:1** | **AAA** ($\ge 7.0:1$) |
| Button Text on Accent | `--accent-ink` (`#0a0a0a`) on `--accent` (`#ef8f0b`) | Text $0.00304$, Fill $0.3850$ | **8.20:1** | **AAA** ($\ge 7.0:1$) |
| Success Text | `--success` (`#10b981`) | $0.4180$ | **8.41:1** | **AAA** ($\ge 7.0:1$) |
| Warning Text | `--warning` (`#f59e0b`) | $0.4350$ | **8.72:1** | **AAA** ($\ge 7.0:1$) |
| Danger Text | `--danger` (`#ef4444`) | $0.2470$ | **5.34:1** | **AA** ($\ge 4.5:1$) |

#### Light Theme Contrast Matrix (Background: `--surface-1: #e4dcd0`, $L = 0.714$)
| Element | Token & Hex | Relative Luminance | Contrast Ratio | WCAG Rating |
|---|---|---|---|---|
| Primary Text | `--ink` (`#141210`) | $0.0068$ | **13.45:1** | **AAA** ($\ge 7.0:1$) |
| Secondary Text | `--ink-secondary` (`#4d443d`) | $0.0592$ | **7.00:1** | **AAA** ($\ge 7.0:1$) |
| Muted Text | `--ink-muted` (`#786e64`) | $0.1601$ | **3.64:1** | **Large Text AA** |
| Button Text on Accent | `--accent-ink` (`#0a0a0a`) on `--accent` (`#ef8f0b`) | Text $0.00304$, Fill $0.3850$ | **8.20:1** | **AAA** ($\ge 7.0:1$) |
| Card on Canvas | `--surface-1` (`#e4dcd0`) on `--canvas` (`#ede6dc`) | Delineated via `--hairline` (`rgba(50,40,30,0.12)`) | Structural hairline separation | Tactile organic clarity |

*Warm Beige Refinement*: Pure stark white (`#ffffff` / `#fffdfa`) has been replaced by tactile off-white beige surfaces (`#ede6dc` / `#e4dcd0`), delivering a luxury architectural aesthetic while preserving the identical vibrant Flashfix orange (`#ef8f0b`) across both themes.

---

## 3. Typography Scale & Fonts

| Category | Font Family | Weights | Allowed Usages |
|---|---|---|---|
| **Interface / Body** | `Inter`, -apple-system, sans-serif | 400 (regular), 500 (medium), 600 (semibold) | All application UI: buttons, form inputs, dialogs, status text, descriptions, navigation links, section titles. |
| **Numeric & Monospace** | `JetBrains Mono`, monospace | 500 (medium) | Strictly reserved for: OTP verification codes, tracking numbers (`FF-XXXXXX`), financial sums (`₹1,499`), SKU identifiers, system keys. |
| **Wordmark & Hero Display** | `Lexend Exa`, sans-serif | 700 (bold), 800 (extrabold) | Restricted solely to the brand mark ("FLASHFIX") and top-level marketing hero headline. **Banned from form labels, table cells, buttons, and card headers.** |

### Type Hierarchy
- `H1`: 32px / line-height 1.25 / font-semibold / `Inter` / `tracking-tight`
- `H2`: 24px / line-height 1.3 / font-semibold / `Inter` / `tracking-tight`
- `H3`: 20px / line-height 1.35 / font-medium / `Inter`
- `Body Large`: 16px / line-height 1.5 / font-normal / `Inter`
- `Body Regular`: 14px / line-height 1.5 / font-normal / `Inter`
- `Caption / Micro-label`: 13px / line-height 1.4 / font-medium / `Inter` (Sentence-case)
- `Code / Token`: 13px–16px / font-mono / `JetBrains Mono` / `tabular-nums`

---

## 4. Component Contracts & Accessibility Standards

### 4.1 Focus Rings & Motion
- **Global `:focus-visible`**:
  `outline: 2px solid var(--accent); outline-offset: 2px;` across all interactive elements (`button`, `input`, `select`, `textarea`, `a`).
- **`prefers-reduced-motion`**:
  When enabled, all animations and transitions are clamped to 0.01ms duration. Skeletons show a static pulse rather than high-frequency shimmer.

### 4.2 Primitives Overview (`packages/web/src/components/ui/`)

1. **`Button` (`Button.tsx`)**:
   - Variants:
     - `primary`: Background `var(--accent)`, text `var(--accent-ink)`, font-semibold.
     - `secondary`: Background `var(--surface-2)`, border `var(--hairline)`, text `var(--ink)`.
     - `ghost`: Transparent background, hover background `var(--surface-2)`, text `var(--ink)`.
     - `danger`: Background `var(--danger)`, text white, for destructive actions.
     - `outline`: Transparent background, border `1px solid var(--hairline)`, hover border `var(--accent)`.
   - Sizes: `sm` (h-8, px-3, text-xs), `md` (h-10, px-4, text-sm), `lg` (h-12, px-6, text-base). Touch target $\ge 44\text{px}$ on mobile (`min-h-[44px]`).
   - Loading State: Accessible SVG spinner, preserves button dimensions without layout shift, sets `aria-busy="true"` and `disabled`.
   - Full Width: `fullWidth` prop for mobile sheet and login card actions.

2. **`Field` (`Field.tsx`)**:
   - Composable wrapper with `<Field.Label>`, `<Field.Input>`, `<Field.Textarea>`, `<Field.Select>`, `<Field.Helper>`, `<Field.Error>`.
   - Automatically binds `aria-describedby` to helper and error messages.
   - Errors include `role="alert"` and `aria-live="polite"`.
   - Border transitions to `var(--danger)` on error state.

3. **`Card` (`Card.tsx`)**:
   - Background: `var(--surface-1)` or `var(--surface-2)`.
   - Border: Crisp `1px solid var(--hairline)`.
   - Corner radius: `rounded-xl` (12px) or `rounded-lg` (8px).
   - Zero glow shadows. Optional hover state with subtle hairline brightening.

4. **`OtpInput` (`OtpInput.tsx`)**:
   - 6 discrete input boxes rendered with `font-mono tabular-nums text-lg`.
   - Attributes: `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="one-time-code"`.
   - Interactions: auto-focus first empty slot, auto-advance on keystroke, backspace retreat, paste clipboard string parsing.
   - Accessibility: individual `aria-label="Digit {index + 1} of {length}"`.

5. **`StatusPill` (`StatusPill.tsx`)**:
   - Canonical 11-step lifecycle states:
     - `PENDING`: Warning dot (Amber), label "Pending"
     - `CONFIRMED`: Info dot (Blue), label "Confirmed"
     - `PICKUP_EN_ROUTE`: Warning dot (Amber), label "Pickup en route"
     - `PICKUP_OTP_SENT`: Warning dot (Amber), label "Pickup OTP sent"
     - `IN_TRANSIT`: Warning dot (Amber), label "In transit"
     - `CUSTODY_OTP_SENT`: Info dot (Blue), label "Custody OTP sent"
     - `IN_REPAIR`: Info dot (Blue), label "In repair"
     - `REPAIR_COMPLETE`: Success dot (Emerald), label "Repair complete"
     - `RETURN_EN_ROUTE`: Warning dot (Amber), label "Return en route"
     - `DELIVERED`: Success dot (Emerald), label "Delivered"
     - `CANCELLED`: Danger dot (Red), label "Cancelled"
   - Subtle tinted background (`rgba(...)`), crisp hairline border, sentence-case text.

6. **`EmptyState` (`EmptyState.tsx`)**:
   - Restrained icon (no icon tile backdrop), heading, supportive description, optional action CTA button.
   - For empty search results, unassigned queues, or zero saved addresses.

7. **`Skeleton` (`Skeleton.tsx`)**:
   - Content loader using gentle gradient sweep across `var(--surface-2)` with reduced-motion support.
   - Variants: `text`, `circular`, `rectangular`.

8. **`ConfirmDialog` (`ConfirmDialog.tsx`)**:
   - Accessible modal dialog for destructive or high-impact actions.
   - Features: Backdrop scrim (`rgba(0,0,0,0.6)`), focus trap, Escape key handling, return focus to trigger on close, `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
   - Cancel and Confirm (primary or danger) actions. Never relies on native `window.confirm`.

9. **`Drawer` (`Drawer.tsx`)**:
   - Accessible slide-over panel for mobile navigation and administrative inspection drawers.
   - Direction: `left` or `right`.
   - Focus trap, Escape key dismissal, backdrop scrim, accessible close button.

---

## 5. Mock Data Purge & Banned-Vocabulary Reference

The following terms and patterns are prohibited from the codebase:

| Banned Term / Pattern | Category | Truthful Alternative |
|---|---|---|
| `Vikram` | Synthetic employee name | Real courier name from DB or "Assigned courier" |
| `Rahul` | Synthetic customer name | Authenticated user name or "Customer" |
| `Arjun` | Synthetic technician name | Real technician name from DB or "Lab technician" |
| `98765` | Fabricated phone prefix | Authorized store phone or empty |
| `123456`, `849201` | Fixed/demo OTP bypass | Dynamic RFC 4226 HMAC OTP |
| `mock_` | Mock token prefix | Cryptographically signed HS256 JWT |
| `local-dev` | Mock session prefix | Real signed session cookie |
| `fallbackUser` | Synthetic client user | `null` with redirect to `/login` |
| `Demonstration` | Demo bypass helper banner | Purged |
| `consumer@flashfix` | Fake booking contact | Authenticated user email |
| `customer@example` | Synthetic API contact | Real booking contact email |
| `Valued Customer` | Synthetic user fallback | Customer contact name |
| `inMemory` | Volatile in-memory maps | Neon PostgreSQL database tables |
| `OBFUSCATED` | XOR obfuscated Brevo key | Environment variable `BREVO_API_KEY` |
| `ff_jwt_`, `ff_staff_` | Unsigned base64 tokens | HS256 signed `ff_session` cookie |
| `store-00` | Hardcoded demo store IDs | Real DB store UUIDs |
| "Protocol Summary" | AI-slop copy | "Booking summary" |
| "Cryptographic Audit Log"| AI-slop copy | "Timeline" or "Status history" |
| "Live Telemetry Protocol"| AI-slop copy | "Updating status…" |
| "Operations & Governance"| AI-slop copy | "Administration" or "Store operations" |
