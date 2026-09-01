# TV Shell

A 10-foot HTPC user interface, added as a parallel `/tv` route tree beside the
existing `/workspace` desktop UI. It reuses `XtreamStore` and
`PlayerController` unchanged and adds no new data source and no new
persistence. Design record: `.plans/2026-08-28-tv-shell-design.md` (sections
referenced below as `§n`); build history and every discovered spec
correction: `.plans/STATE-tv-shell.md`.

This document is the contract for whoever maintains this route tree next —
what owns what, and why the boundaries sit where they do — not a narrative of
how it was built.

## Scope

One profile, Xtream only, six input keys, no text entry from the remote, no
context menus. The full non-goal list is design §3. Nothing here changes an
existing `/workspace` component's behaviour; the touched pre-existing files
are the enumerated set in design §5.5.

## Route tree and activation

```
/tv                                  source picker (redirects when exactly one Xtream source)
/tv/xtreams/:id/home                 hero + rails
/tv/xtreams/:id/live                 fullscreen live TV with overlays
/tv/xtreams/:id/movies               category rail + poster grid (data.tvCatalogType: 'vod')
/tv/xtreams/:id/series               category rail + poster grid (data.tvCatalogType: 'series')
/tv/xtreams/:id/search               on-screen keyboard + results grid
/tv/xtreams/:id/detail/:type/:itemId detail page (type: movie | series)
```

Defined in `createTvRoutes()`
(`libs/workspace/tv-shell/feature/src/lib/routes/tv-shell.routes.ts`), mounted
as a sibling of `workspace` in `apps/web/src/app/app.routes.ts` under
`data: { layout: 'tv' }`. The tree mirrors the workspace's Xtream route shape
deliberately, so a future "open this item in the other shell" mapping stays a
straight substitution.

The shell renders in the PWA as well as Electron — kiosk mode is the only
Electron-only piece, so the route itself carries no capability guard.

**Three activation paths, one destination:** the `--tv` CLI flag (Electron
argv, read before `BrowserWindow` construction so kiosk mode can be set at
creation), a `tv` option in `WorkspaceStartupPreferencesService`, and a
Settings toggle. All three land on `/tv`, where the source picker either
lists sources or — with exactly one Xtream source — redirects straight to its
home screen without any input (design §7.1).

## The six-key vocabulary and who owns it

| Key | Meaning |
|---|---|
| Arrow Up/Down/Left/Right | Move focus |
| Enter / OK | Activate focused element |
| Backspace or Escape | Back |

Nothing else is a valid TV input, and no component may add to this list.
Mapping lives in two pure, DOM-free files, both exhaustively unit-tested:

- `tv-key-intent.util.ts` (`mapTvKeyToIntent`) — the ordinary
  move/activate/back mapping.
- `tv-playback-key-intent.util.ts` (`mapTvPlaybackKeyToIntent`) — what the
  same six keys mean while a playback session is mounted (§9.2/§7.3): OK
  toggles play/pause outside live, Left/Right seek, Up/Down change channel
  during live instead of seeking, and OK opens the channel bar instead of
  toggling play/pause while live.

**Key handling has exactly one owner.** `TvShellComponent`
(`libs/workspace/tv-shell/feature/src/lib/tv-shell/tv-shell.component.ts`)
carries the single `@HostListener('keydown')` for the whole shell. No screen,
overlay or control component attaches its own keydown listener. On every
keydown the shell asks `TvPlaybackSessionService.active()`: if a playback
session is mounted and no session-owned overlay currently claims the stream,
the key is routed through the playback mapping to the registered
`TvPlaybackSession`; otherwise it goes through the ordinary focus mapping to
`TvFocusService`.

`TvPlaybackSession.isOverlayActive()`/`onOverlayBack()` exist because a
mounted live session and an open channel-bar/category-column/EPG-grid overlay
both want the key stream at once — reconciled by having the overlay claim it
first. This is design correction #12 (see STATE file): §6.3 originally said
overlays claim the stream, §9.2 said playback sessions claim everything, and
those only visibly conflict once the channel bar exists.

Reused controls carry their own document-level shortcut layer
(`app-player-controls`'s `ControlsShortcuts`: Space/K, F, arrows, M) that
overlaps the remote's keys exactly. TV mode always mounts it with
`[shortcutsEnabled]="false"` (or the equivalent `interactionEnabled=false` /
external-modal-surface registration for Embedded MPV — see the engine chain
below), so the shell's listener stays the only place a key is interpreted.

## Focus primitives (`libs/ui/tv-navigation`, project `ui-tv-navigation`)

Three pieces, no store dependency:

- **`TvFocusGroupDirective`** (`[tvFocusGroup]`) — declares a group:
  orientation (`row` | `column` | `grid`), a runtime `columnCount` for grids,
  and declared per-direction neighbour group ids.
- **`TvFocusableDirective`** (`[tvFocusable]`) — registers an element into
  the enclosing group, manages `tabindex` and the `.tv-focused` class, and
  scrolls itself into view when active.
- **`TvFocusService`** — the sole authority on the active group/index/element.
  All arithmetic is delegated to two pure, DOM-free modules:
  `tv-focus-geometry.ts` (`computeNextFocusIndex` — next-index arithmetic per
  orientation, wrap/clamp rules, exhaustively tested) and `tv-focus-graph.ts`
  (`resolveGroupExit` — where focus lands when a move exits a group's
  bounds, preserving the perpendicular position where that is meaningful).

**`TvFocusService.activeElement()` is the only correct way to find the
focused element.** Never query a subtree for `.tv-focused`: overlays render
into the CDK overlay container, which is attached to `document.body` outside
the shell's own DOM subtree, so a subtree query silently finds nothing the
moment the channel bar or EPG grid is open (correction #4). The class is a
rendering detail; the service is the lookup contract. Activation
(`TvShellComponent.activateFocusedElement()`) calls `.click()` on whatever
`activeElement()` returns — there is no separate activation code path per
screen, which is also why every reachable action must be a real clickable
element (design §6.4, "no hidden actions").

**Item ordering is document position, not registration order — and it is
maintained by insertion, not re-sort.** Angular's `@for` with `track` reuses
views across list changes and can move a DOM node without re-running
`ngOnInit`, so registration order goes stale the moment a list is reordered
or prepended (correction #1). `TvFocusService.registerItem()` therefore
inserts each item into its group at its actual `compareDocumentPosition`
position, comparing against the current last item first (the common case,
since `@for`'s initial render and `loadMore` both append in DOM order) and
falling back to binary search otherwise — near-linear even as a loaded
window grows into the thousands (correction #2, catalogue-scale cost).

**A relocated-but-already-registered item is the case insertion cannot see**
(correction #15): if `@for` reuses a view whose tracked id survives into a
new list, the DOM node moves without `ngOnInit` re-running, so the registry
keeps the item's stale position. `TvFocusService` covers this with a
`MutationObserver` on each group's host (`childList`, `subtree`): a DOM
mutation triggers a full re-sort of that group (`resortGroup`), which is rare
enough relative to registration that the O(n log n) cost does not matter, and
cheap in the common case since V8's TimSort is near-linear on the
already-sorted arrays a pure append produces.

**Grids assume uniform column counts by construction, not by accident**
(correction #13): the poster grid and on-screen keyboard both are `grid`
groups with a fixed or viewport-derived `columnCount`. A layout whose rows
are genuinely ragged in an unpredictable way — the EPG grid, where channels
air different numbers of programmes — does not fit this primitive and uses
per-row groups with explicit neighbours instead (`TvEpgGridComponent`). This
is a real boundary of the primitive, not a workaround.

**Grid column counts are always measured, never hard-coded**
(correction #5): `computeTvGridColumnCount()`
(`libs/workspace/tv-shell/ui/src/lib/tv-poster-grid/tv-grid-columns.util.ts`)
derives the poster grid's column count from the container's measured
`clientWidth` via `ResizeObserver`, because the focus arithmetic needs the
actual rendered column count to be correct — a hard-coded constant breaks
navigation on any viewport other than the one it was tuned for. The one
constant column count in the shell is the on-screen keyboard's (10, design
§7.6) — a genuinely fixed layout the code may bake in, not a viewport-derived
one.

## The shared portal session (§8.1a)

`TvPlaylistSessionService`
(`libs/workspace/tv-shell/feature/src/lib/session/tv-playlist-session.service.ts`)
owns the one-time-per-playlist `XtreamStore` bootstrap (reset → set current
playlist → fetch → check portal status → `initializeContent()`) and is
resolved by every TV screen via `ensureBootstrapped(playlistId)`. This exists
because navigating home → movies → series would otherwise re-run that whole
sequence, and race itself, on every hop (correction #6). Concurrent callers
for the same playlist join the same in-flight promise; a failed attempt is
never cached as success, so the next caller retries from scratch.

It is deliberately **not** the desktop's `XtreamWorkspaceRouteSession`: that
service is coupled to the `/workspace/xtreams/:id/...` URL shape and is a
portal *feature*, which design §5.5 puts out of bounds for the shell to reach
into. Per-screen concerns (`setSelectedContentType()`, EPG queueing, search
debouncing) stay on the owning screen; the session's job ends at "the store
is bootstrapped for this playlist."

## The engine chain (§9.1b) — and why native-view and external players are excluded

A TV UI draws overlays over video. Embedded MPV **native-view** composites a
child window *above* the DOM (which is why it needs its own compositor-safe
dock instead of ordinary controls), and external MPV/VLC are separate
windows with no overlay surface at all. Neither can carry a remote-driven
overlay UI, so both are excluded unconditionally — not a setting, not a
fallback target.

That leaves two engines, tried in order, resolved once per playback mount by
`TvPlaybackOverlayComponent`:

1. **Embedded MPV frame-copy**, when a runtime probe
   (`isEmbeddedMpvFrameCopyAvailable`) confirms it is genuinely available.
   Availability is a packaging/runtime fact — manifest, hash and
   `--runtime-probe` gated, x64-only on Linux — never a stored setting to
   trust. Frame-copy renders into a `<canvas>`, so DOM overlays keep working,
   and it is the only option in the chain with full container/codec support
   (MKV, raw MPEG-TS included) — necessary because a large Xtream catalogue
   routinely contains both, and live TV is typically raw MPEG-TS or HLS.
2. **`HtmlVideoPlayerComponent`** otherwise. It already owns hls.js, Shaka
   and mpegts.js, covering HLS, DASH and MPEG-TS without MPV.

Resolution starts pinned to the web engine so there is never a dead screen
while the probe is in flight or if it fails (fail-closed). The resolved
engine is surfaced in a small on-screen badge — "why will this not play" is
otherwise unanswerable from the couch, since a user with frame-copy enabled
but unavailable silently gets a different engine with different codec
support.

Both engine branches mount `TvPlayerControlsComponent` against the shared,
engine-neutral `PlayerController` contract (`@iptvnator/ui/playback`) —
consuming that library is in bounds (design §9.1a; only *modifying*
`libs/ui/playback` is out of bounds per §5.5), and it is what makes playback
diagnostics, recovery, subtitles, the quality menu, VOD multi-source
failover and resume all work without reimplementation.

**Known limitation, carried forward from Phase 4b:** `EmbeddedMpvPlayerComponent`
renders its own loading/stalled/error states and a plain-click Retry with no
focusability, so a failed stream under frame-copy shows a recovery control no
remote key can reach. Not fatal — Back always exits playback regardless —
but not fixable from the shell without either an upstream `shortcutsEnabled`/
`showDiagnostics` extension point on that component, or the shell rendering
its own focusable recovery from the `PlayerController`'s diagnostic. Neither
has been done yet.

## Catalogue scale (§8.2)

The poster grid renders exactly `XtreamStore`'s current `visibleCount`
window — never the full catalogue. `TvPosterGridComponent` watches the
active focus index against the grid's item count and column count; once
focus enters the last currently-rendered row and the store still reports
`hasMoreContent()`, it emits `loadMoreRequested`, which the screen wires to
`store.loadMoreContent()` — the exact same store contract
`InfiniteScrollDirective` drives from scroll position, just triggered by
focus position instead of scroll position. The DOM therefore never holds
more than the loaded window regardless of catalogue size; see
`apps/web-e2e/src/tv-catalog-scale.e2e.ts` for the 40,000-title regression
proof (`tvscale:tvscale` mock-server scenario, one VOD category, no
live/series generation).

Poster images load lazily inside fixed-aspect boxes so a slow image load
never shifts the grid — and therefore never shifts focus — out from under
the user.

The on-screen keyboard's results grid and the movies/series poster grid
share the exact same `grid` focus group and the exact same `loadMore`
wiring; search results are not a special case (design §7.6).

## Testing

| Layer | Coverage |
|---|---|
| Unit | `tv-focus-geometry.ts`/`tv-focus-graph.ts` — pure, exhaustive index/wrap/boundary cases, no DOM (`ui-tv-navigation`) |
| Component | Shell key mapping, directive registration, focus class application (`workspace-tv-shell-feature`, `workspace-tv-shell-ui`) |
| E2E (`apps/web-e2e`) | `tv-keyboard-only.e2e.ts` — a full journey driven only by keyboard events; `tv-catalog-scale.e2e.ts` — bounded DOM card count while paging deep into a 40,000-title catalogue |

Run targeted first: `nx test ui-tv-navigation`, `nx test workspace-tv-shell-feature`,
`nx test workspace-tv-shell-ui`, then the atomized E2E targets
(`nx run web-e2e:e2e-ci--src/tv-keyboard-only.e2e.ts`,
`nx run web-e2e:e2e-ci--src/tv-catalog-scale.e2e.ts`).

## Known limitations

Found while writing this document and the Phase 7 E2E coverage. Reported
here rather than fixed, per the standing rule that a phase does not change TV
shell behaviour it merely documents or tests (see the Phase 7 report in
`.plans/STATE-tv-shell.md` for full detail):

- **No in-app navigation from Home to Movies, Series or Search.** The shell
  has no persistent navigation surface, and the home screen's rails only
  route to detail pages and live — never to the catalogue or search screens
  themselves. A remote-only user cannot reach `/tv/xtreams/:id/movies`,
  `/series` or `/search` at all once past the home screen, short of typing a
  URL, which a six-key remote cannot do. This is a real gap against design
  §4's "100% of interactive elements reachable with arrows/OK/Back" and
  design §2's success criteria (browse the catalogues, search by title).
- **The multi-source source picker never sets initial focus.**
  `TvSourcePickerComponent` renders a `tvFocusGroup` of source cards but
  never calls `TvFocusService.setActive()`. With more than one Xtream
  source, `activeGroupId()` stays `null` on that screen, `TvFocusService.move()`
  no-ops when there is no active group, and OK activates nothing — so the
  picker is completely unreachable from a remote whenever there is more than
  one source to pick from. (With exactly one source this never surfaces,
  because the screen redirects before anything needs focusing — which is why
  it was not caught by earlier phases' single-source-only manual checks.)
- **`nx build web` and `nx serve web` currently fail to compile** with six
  TypeScript errors across `tv-home-screen-state.ts`,
  `tv-live-screen.component.ts`, `tv-search-screen.component.ts` and
  `tv-source-picker.component.ts` (type mismatches between store/dashboard
  item shapes and the TV shell's narrower view-model types, plus two
  `toSignal()`/`PlaylistMeta` optionality mismatches). `nx test`/`nx lint`
  for the affected projects pass, because neither runs the Angular AOT
  template compiler the production/dev-server build does — which is why this
  was not caught by any Phase 2–6 validation command. This blocks any real
  browser from serving the app at all right now, including every `web-e2e`
  Playwright run. Full detail and the exact errors: the Phase 7 report in
  `.plans/STATE-tv-shell.md`.
