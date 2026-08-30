# Handoff: Forecast — weather-marked article reader

## Overview

A minimalist RSS / read-later reader whose organising idea is a **forecast mark**: every saved link
carries a weather glyph plus a 0–100 predicted-interest score, so the user can scan a dense list and
decide in one glance whether an article is worth their time. Rating and triage are both inline in the
list — there is deliberately **no in-app reading view**; clicking a row opens the original article in
a new tab.

Four views: **Inbox**, **Saved**, **Search** (filters), **Stats**. Desktop is primary; a phone
rendition is included.

## About the design files

`Reader.dc.html` in this bundle is a **design reference created in HTML** — a working prototype that
shows intended look and behaviour. It is not production code to copy. The task is to **recreate this
design in the target codebase's existing environment** (React, Vue, Svelte, SwiftUI, native, …) using
its established component patterns, styling approach and data layer. If no environment exists yet,
pick the framework most appropriate for the project and implement there.

The file is a single self-contained page: a declarative template plus a small state class. Treat the
template as the layout spec and the class as the behaviour spec.

## Fidelity

**High-fidelity.** Colours, typography, spacing, iconography and interaction states are final and
should be matched closely. All values derive from the **Industry** design system (see Design Tokens);
if the target codebase already has that token set, bind to it rather than hard-coding hexes.

## Layout shell

```
┌───────────────────────────────────────────────────────────────┐
│ HEADER  58px tall, 1px bottom divider                          │
│  [ FORECAST reader ]  [ Inbox Saved Search Stats ] [n unread]  │
│                                          [ Phone ] [ Add link ]│
├──────────────┬────────────────────────────────────────────────┤
│ NAV RAIL     │ MAIN                                            │
│ 0–210px      │ 1fr, min-width 0, vertical scroll               │
│ 1px right    │  · sticky "why" strip (list views)              │
│ divider      │  · search filter block (Search view only)       │
│ scrolls      │  · one-line rows  OR  stats dashboard           │
└──────────────┴────────────────────────────────────────────────┘
```

- Page root: `height: 100vh; display: grid; grid-template-rows: auto 1fr;` — `html, body { height:100%; overflow:hidden }`.
- Body columns: `grid-template-columns: minmax(0, 210px) minmax(0, 1fr)`.
- Header columns: `minmax(0, 210px) minmax(0, 1fr) auto`, `gap: 24px`, `padding: 0 22px`.

### Nav rail (240px content, `padding: 20px 0 40px`)

1. **Classification** section label — 10px, `letter-spacing: .16em`, uppercase, text @42%. A small
   `fluid` note sits right-aligned on the same line at 10px / text @32% (the tag vocabulary is not a
   fixed folder tree; it is ordered by volume and grows with what the user saves).
2. Topic rows: `grid-template-columns: 3px 1fr auto`, `gap: 11px`, `padding: 6px 22px 6px 0`, 14px
   text. The 3px leading bar is the selected indicator (accent when active, transparent otherwise).
   Count on the right at 11px tabular-nums, text @42%. First row is "All classifications".
   - active: bar `--color-accent`, background `color-mix(in srgb, var(--color-accent) 12%, transparent)`, text `--color-accent-900`
   - inactive: text @78%; hover background `color-mix(in srgb, var(--color-text) 5%, transparent)`
3. **Forecast key** — the three weather glyphs with labels ("Likely — clear", "Maybe — overcast",
   "Probably not — rain"), `grid-template-columns: 22px 1fr`, 12px labels at text @62%.
4. Keyboard legend, separated by a `padding-top: 16px` + 1px top divider, 11px / `line-height: 1.85`
   / text @45%: `J / K move`, `1 – 5 rate`, `S save · X dismiss`, `Enter open`.

## The forecast mark (core concept)

A predicted-interest score `0–100` per article maps to three levels:

| Score | Level | Label | Glyph | Glyph colour |
| --- | --- | --- | --- | --- |
| ≥ 75 | `clear` | Likely | sun | `--color-accent-700` |
| 50–74 | `maybe` | Maybe | overcast cloud | `--color-neutral-600` |
| < 50 | `rain` | Probably not | cloud with rain | `--color-neutral-500` |

Icons are **Lucide, stroke-width 1.5**, `fill: none`, `stroke-linecap: round`. Sizes: 19px in desktop
rows, 22px in phone rows, 30px in the why-strip, 20px in the legend.

Additional row-level consequences of the level:
- `rain` rows dim their title to text @55% (so the list visually sorts itself).
- The score numeral under the glyph is `--color-accent-700` for `clear`, otherwise text @40%.

Every article also carries a one-sentence **reason** explaining its score in the user's own terms
("RSS is your most-read classification this month; you rated the last three 5, 4, 5"). This is what
makes the mark trustworthy — implement it as a real explanation string from the scoring model, never
as a bare number.

## Screens / views

### 1. Inbox / Saved — the one-line list

Density is **one line per article**, fixed `height: 52px`. Row grid:

```
grid-template-columns: 52px minmax(0, 1fr) auto;
align-items: center; gap: 14px; padding-right: 20px;
border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
border-left: 3px solid <accent when selected, else transparent>;
cursor: pointer;
```

**Column 1 (52px)** — forecast stack, `display: grid; justify-items: center; gap: 1px`: the weather
glyph (19px) above the score numeral (9px, tabular-nums, `letter-spacing: .06em`).

**Column 2 (`minmax(0,1fr)`)** — title cell. This is the one part that needed care; get the flex
priority right or the title collapses:

```html
<div style="min-width:0; overflow:hidden; display:flex; align-items:baseline; gap:14px">
  <span style="flex:0 1 auto; min-width:0; overflow:hidden;
               text-overflow:ellipsis; white-space:nowrap; …">TITLE</span>
  <span style="flex:0 0 auto; margin-left:auto; display:flex;
               align-items:baseline; gap:10px">META + TAGS</span>
</div>
```

- Title: `--font-heading` (Barlow Condensed) 600, **17px**, `line-height: 1.2`. `flex: 0 1 auto` with
  `min-width: 0` — it must take only the space it needs and be the item that yields, truncating with
  an ellipsis. Do **not** give it `flex-grow: 1`; that evicts the meta group past the cell's
  `overflow: hidden` edge.
- Meta group is `flex: 0 0 auto` and pushed right with `margin-left: auto`, so it lays out inside the
  cell instead of overflowing.
- Source: 11px, `letter-spacing: .07em`, uppercase, text @44%, `white-space: nowrap`.
- Date + read time (`· 2h · 14m`): nested span, 11px, tabular-nums, no letter-spacing/transform,
  text @32%.
- Classification pills: max 2 shown. 10px, `letter-spacing: .07em`, uppercase, `padding: 2px 7px`,
  `white-space: nowrap`, **square corners**, `border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)`,
  colour `--color-accent-700`, transparent fill.

**Column 3 (auto)** — controls, `display: flex; align-items: center; gap: 12px`:

- **Rating: 5 square pips**, `display: flex; gap: 3px`. Each pip is a 14×24px transparent button
  (generous hit area) containing an 8×8px square: filled `--color-accent` with matching border when
  `value <= rating`, otherwise transparent with `1px solid color-mix(in srgb, var(--color-text) 25%, transparent)`.
  Button hover `opacity: .55`. Clicking the same value again clears the rating (toggle to 0).
- **Save** — 27×27px square button, bookmark glyph 14px. Saved: accent fill, `--color-bg` glyph,
  accent border. Unsaved: transparent, glyph text @40%, `--color-divider` border. Hover border → accent.
- **Dismiss** — 27×27px square button, × glyph 14px, transparent, `--color-divider` border,
  glyph text @40%; hover border `--color-neutral-600`, glyph full text colour.

Row states: selected = background `color-mix(in srgb, var(--color-accent) 9%, transparent)` +
3px accent left border. Hover = background `color-mix(in srgb, var(--color-text) 4%, transparent)`.
Dismissed rows render at `opacity: .4` (they stay visible in Search/Saved, are filtered out of Inbox).

Empty state: `padding: 70px 22px`, centred, 13px, text @42% — "Nothing matches this view."

### 2. The sticky "why" strip

Shown above the list in all list views; explains the **selected** article's mark. Sticky to the top
of the scroll container (`position: sticky; top: 0; z-index: 5`), opaque `--color-bg` background,
1px bottom divider, `padding: 14px 20px`, `grid-template-columns: 40px minmax(0,1fr) auto`, `gap: 16px`.

- 30px weather glyph.
- Line 1: `--font-heading` 600, 14px, `letter-spacing: .1em`, uppercase, coloured by level —
  `LIKELY · 92/100 — RIBBONFARM`.
- Line 2: the reason sentence, 12px, `line-height: 1.45`, text @58%.
- Right: **Open original** — `.btn .btn-primary`, 12px, `letter-spacing: .09em`, uppercase, `nowrap`.

### 3. Search

Filter block above the list: `padding: 22px 22px 18px`, 1px bottom divider, `display: grid; gap: 16px`.

- Query input — `.input`, transparent background, `min-height: 44px`, **17px**, `--font-heading`,
  placeholder "Search titles, sources, notes".
- Filter row — `display: flex; flex-wrap: wrap; gap: 22px`. Each filter is a label (10px,
  `letter-spacing: .14em`, uppercase, text @42%) above a segmented control.
  - **Forecast**: All / Likely / Maybe / Unlikely
  - **Minimum rating**: Any / 1+ / 2+ / 3+ / 4+ / 5+ (tabular-nums)
  - **Sort**: Forecast / Newest / Rating
- Segmented control pattern (used here and for the header tabs): a `display: flex` wrapper with
  `border: 1px solid var(--color-divider)`; each option is a borderless button with
  `border-left: 1px solid var(--color-divider)`, square corners. Selected: background
  `--color-accent`, colour `--color-bg`. Unselected: transparent, colour text @68%, hover `opacity: .78`.

### 4. Stats

`padding: 28px 26px 50px`, `display: grid; gap: 30px`.

- **KPI tiles** — 4 equal columns, `gap: 22px`. Each is a blueprint frame (see below),
  `padding: 16px 18px 14px`: 10px uppercase label at text @45%; value in `--font-heading` 600 **40px**
  `line-height: 1.05` tabular-nums; 11px note in `--color-accent-700`.
  Content: `Read · 30 days 63 (+11 vs previous)`, `Average rating 3.8 (of 148 rated)`,
  `Forecast hit rate 78% (likely → rated 4+)`, `Hours reading 9.4 (9 min median)`.
- **Rating distribution** — 5 rows, `grid-template-columns: 60px 1fr 34px`, `gap: 12px`, row gap 9px.
  Left: the same 8×8px pip pattern showing 1–5. Middle: a 14px-tall hairline-bordered track with an
  accent fill at the row's percentage. Right: count, 12px tabular-nums, right-aligned, text @60%.
- **Reading volume · 12 weeks** — a 132px-tall flex track with `align-items: flex-end`, `gap: 6px`,
  1px bottom divider. Each week is a column: `flex: 1; display: flex; flex-direction: column;
  justify-content: flex-end; gap: 2px; height: 100%`. Two stacked bars sized by percentage —
  read (accent) above dismissed (`color-mix(in srgb, var(--color-text) 14%, transparent)`).
  **Note:** the columns must be flex, not grid — a percentage height on a child of an auto-sized grid
  row resolves to 0.
  Legend below at 11px / text @50% with 9×9px swatches.
- **Forecast accuracy by classification** — a `.table`: Classification / Saved / Read / Avg rating /
  Forecast hit / Trend. Numeric columns right-aligned tabular-nums; classification names in
  `--font-heading` 600 15px. Trend is a 10px hairline track filled to the hit percentage. Hit ≥ 70%
  renders in `--color-accent`, below that in `--color-neutral-500` — the point of the view is showing
  where the forecast is unreliable.

Section headings throughout: `h4`, 15px, `letter-spacing: .1em`, uppercase.

### 5. Phone view

Opened by the header **Phone** button; a fixed overlay on
`color-mix(in srgb, var(--color-neutral-900) 55%, transparent)`, centred, containing a 390×780px
`--color-bg` panel with `--shadow-lg` and a blueprint frame drawn over it (`position: absolute;
inset: 0; pointer-events: none`).

Panel rows: `auto auto 1fr auto` — brand + close button; full-width tab bar (each tab `flex: 1`,
11px); scrolling content; footer count strip (`padding: 12px 18px`, 1px top divider, 11px uppercase,
text @45%).

Phone article rows: `grid-template-columns: 44px minmax(0,1fr)`, `gap: 10px`, `padding: 13px 18px`.
Title wraps to two lines at 16px; source/date/read-time on their own 10px uppercase line; controls on
a third line. **All touch targets are ≥ 44px**: rating pips are 32×44px buttons with 14×14px squares,
save and dismiss are 44×44px.

The phone body respects the active view — the list is guarded by the list-view condition and the
Stats tab shows a stacked column of the four KPI tiles at 36px values. Escape closes the overlay.

## Interactions & behaviour

| Trigger | Behaviour |
| --- | --- |
| Click a row | Selects it (updating the why-strip) **and** opens the article URL in a new tab (`noopener`) |
| Click a rating pip | Sets rating 1–5; clicking the current value clears it. Stops propagation so the row does not open |
| Click save | Toggles saved. Stops propagation |
| Click dismiss | Toggles dismissed. Stops propagation |
| `J` / `ArrowDown` | Select next visible row |
| `K` / `ArrowUp` | Select previous visible row |
| `1`–`5` | Rate the selected article |
| `S` | Toggle save on the selected article |
| `X` | Dismiss the selected article, then advance selection |
| `Enter` | Open the selected article's original URL |
| `Escape` | Close the phone overlay |
| Click a nav classification | Filters the list; click "All classifications" to clear |
| Header tab | Switches view |

Keyboard handlers are bound on `window` and **must no-op when the event target is an `INPUT` or
`TEXTAREA`**, or typing in the search field will trigger ratings.

Transitions are deliberately absent — the design's speed comes from a static, dense list. Only
`opacity`/border colour change on hover, instantaneously.

### Filtering and sorting logic

```
visible =
  articles
    .filter(a => view !== 'inbox'  || !dismissed[a.id])
    .filter(a => view !== 'saved'  ||  saved[a.id])
    .filter(a => !topic || a.topics.includes(topic))
    .filter(a => view !== 'search' || (level === 'all' || levelOf(a.score) === level))
    .filter(a => view !== 'search' || (rating[a.id] ?? 0) >= minRating)
    .filter(a => !query || `${a.title} ${a.source} ${a.topics.join(' ')}`
                            .toLowerCase().includes(query.trim().toLowerCase()))
    .sort(by)     // 'forecast' → score desc (default everywhere except Search)
                  // 'recent'   → age asc
                  // 'rating'   → user rating desc
```

Header count label: `<n> unread` in Inbox, `<n> saved` in Saved, suffixed with ` · <Topic>` when a
classification filter is active; `last 90 days` in Stats.

## State

| State | Type | Notes |
| --- | --- | --- |
| `view` | `'inbox' \| 'saved' \| 'search' \| 'stats'` | |
| `topic` | `string \| null` | active classification filter |
| `query` | `string` | search text |
| `level` | `'all' \| 'clear' \| 'maybe' \| 'rain'` | Search only |
| `minRating` | `0–5` | Search only, 0 = any |
| `sort` | `'forecast' \| 'recent' \| 'rating'` | Search only |
| `selId` | article id | drives the why-strip and keyboard actions |
| `mobile` | boolean | phone overlay open |
| `ratings` | `Record<id, 1–5>` | 0 / absent = unrated |
| `saved` | `Record<id, boolean>` | |
| `dismissed` | `Record<id, boolean>` | |

### Data the real implementation needs

Per article: `id`, `title`, `source`, `url`, `publishedAt`, `readingMinutes`, `topics: string[]`,
`score: 0–100`, `reason: string`. Per user: ratings, saved and dismissed sets, plus whatever the
scoring model needs (per-topic and per-source average ratings, recency of engagement).

The scoring model is out of scope for this design, but the UI assumes it can produce **both** a score
and a human-readable reason, and that Stats can report a **hit rate** — the share of `likely`
forecasts the user subsequently rated 4+. Classifications are fluid: derived from what the user saves
and weighted by recent use rather than picked from a fixed list.

## Design tokens (Industry design system)

Bind to the existing token set if present; these are the resolved values.

**Colour**

| Token | Value |
| --- | --- |
| `--color-bg` | `#f2f2f3` |
| `--color-surface` | `#e9e9ea` |
| `--color-text` | `#1d1f20` |
| `--color-accent` | `#5980a6` |
| `--color-divider` | `color-mix(in srgb, #1d1f20 16%, transparent)` |
| `--color-accent-600 / 700 / 900` | `#597ea3` / `#416180` / `#1d2d3d` |
| `--color-neutral-500 / 600 / 900` | `#98989b` / `#7a7a7d` / `#2b2b2d` |

Text tints are written as `color-mix(in srgb, var(--color-text) N%, transparent)` — the values used
are 32, 36, 40, 42, 44, 45, 50, 55, 58, 60, 62, 68, 70, 78, 82%. Backgrounds tints use
`var(--color-text)` at 4/5/8/14% and `var(--color-accent)` at 9/12/40%.

**Type** — `--font-heading: "Barlow Condensed"` at weight 600 for all headings, tabs, buttons, row
titles and numerals; `--font-body: "Barlow"` at 400 for everything else. Base 15px / 1.55.
Sizes in use: 40, 36, 27, 19, 17, 16, 15, 14, 13, 12, 11, 10, 9px. Headings carry
`letter-spacing: -0.015em`; small uppercase labels carry `+0.06 – 0.16em`.

**Spacing** — `--space-1…8`: 3.4 / 6.8 / 10.2 / 13.6 / 20.4 / 27.2px (0.85× density).

**Radius** — **0 everywhere.** Industry overrides `.card, .btn, .input, .tag, .seg, .dialog` to
square corners. Do not round anything.

**Shadow** — only `--shadow-lg` (`0 12px 32px color-mix(in srgb, #2b2b2d 22%, transparent)`) on the
phone panel. The list uses no elevation at all.

**Blueprint frame** — the system's signature. `position: relative; border: 1px solid var(--color-divider);
border-radius: 0`, plus four corner registration marks (an 11×11px `+` crosshair at each corner,
offset `-6px`, colour text @55%). Applied to the KPI tiles and the phone panel. Cards and figures stay
transparent line drawings — **no surface fill**; the primary button is the one solid accent object.

## Assets

None. All iconography is inline SVG in the Lucide style at stroke-width 1.5 — sun, cloud,
cloud-with-rain, bookmark, and × — drawn on a 24×24 viewBox. Replace with the codebase's Lucide
package (`lucide-react` etc.) rather than copying the paths, keeping stroke-width 1.5.

No photography is used. If the target app adds thumbnails, route them through the system's `.duotone`
wrapper (desaturate + accent `mix-blend-mode: color`) and keep them square and hairline-framed.

## Files

- `Reader.dc.html` — the full design: template (layout, all four views, phone overlay) plus the state
  class (filtering, sorting, keyboard model, derived stats). Open it in a browser to interact with it.
- `_ds/` — the Industry design system stylesheet and bundle the design loads. `styles.css` is the
  single source of truth for the tokens listed above.
