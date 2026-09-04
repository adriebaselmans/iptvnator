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
creation), the persisted `Settings.startInTvMode`, and the Settings toggle
that writes it. All three land on `/tv`, where the source picker either
lists sources or — with exactly one Xtream source — redirects straight to its
home screen without any input (design §7.1).

`--tv` is a per-launch override, not a settings write. Beyond kiosk
presentation, `app.ts` forwards the flag into the renderer's `process.argv`
via `webPreferences.additionalArguments`; the preload script reads it as the
synchronous `ElectronBridgeApi.launchedInTvMode` fact (mirroring how
`platform` is exposed). `WorkspaceStartupPreferencesService.resolveAppEntryPath`
checks that fact before the persisted setting, so `--tv` wins for that launch
without ever mutating `Settings.startInTvMode` — closing once and reopening
without the flag returns to the desktop workspace. The PWA has no bridge, so
`resolveAppEntryPath` always falls back to the setting there.

**Kiosk presentation is platform-specific**, via `applyTvKioskPresentation()`
(`app.ts`), used both by the initial `--tv` launch and by the runtime
`WINDOW_SET_KIOSK_MODE` toggle. Windows/Linux use plain `kiosk: true`.
Reported by a real user: on macOS this left Live TV completely unrecoverable
from the remote — `kiosk` mode there is implemented through NSWindow's native
fullscreen, and macOS binds Escape to exit native fullscreen at the OS level,
before Chromium's input pipeline (let alone the shell's own keydown listener)
ever sees the key. This is a long-standing, still-open upstream Electron
limitation (electron/electron#8338, #4316), not a bug in this app's key
routing — §6.3's routing was verified correct against real Electron on Linux
and never reproduced the stuck state there, consistent with this being an
OS-level interception rather than an app-level one. darwin uses
`setSimpleFullScreen()` instead ("pre-Lion" style, which does not carry that
OS-level Escape binding) and manually hides the Dock to compensate for what
plain `kiosk` would otherwise have hidden. **This has not been verified
against real macOS hardware** — this sandbox has no macOS runtime, so the fix
rests on Electron's own documented behavior and community reports of the
underlying issue, not on a reproduction-then-fix cycle. If Live TV is still
unrecoverable on macOS after this, the Escape interception may be happening
even earlier than `setSimpleFullScreen()` avoids, and needs a report with the
exact macOS version.

## Persistent navigation and reachability

**Every screen sets initial focus, and Home/Movies/Series/Search carry a
persistent top nav row.** Two gaps here were tracked as corrections #17/#18
(source picker/Home→Movies-Series-Search) plus a third found during the same
audit (the detail screen) — all closed, all with regression coverage that
fails against the pre-fix code:

- **`TvNavBarComponent`** (`libs/workspace/tv-shell/ui/src/lib/tv-nav-bar/`)
  is a plain `row` focus group of section entries, rendered above a screen's
  own content. `Home`, `Movies`/`Series` (the shared catalogue screen) and
  `Search` render it; the current section stays focusable like any other
  entry (§6.4 — no hidden or disabled affordances), and Up from the topmost
  content group reaches it while Down returns. Group ids and translated
  labels are built once in
  `libs/workspace/tv-shell/feature/src/lib/nav/tv-nav-bar.util.ts`
  (`tvNavSections()`/`tvNavRoute()`), shared by every screen that renders the
  row so the group id cannot drift between them.
- **Live does not carry the nav row.** It is fullscreen playback where OK and
  Up/Down are already claimed by the live key-intent mapping (§9.2/§7.3) —
  OK opens the channel bar, Up/Down changes channel instead of seeking. A
  competing focus group there would fight the mounted playback session for
  the key stream, the exact conflict design correction #12 exists to avoid.
  Back already returns to Home in one press, which is where the row lives;
  this was judged sufficient without extending the six-key surface Live
  already has to reconcile.
- **Every screen now calls `TvFocusService.setActive()`.** The source picker
  (§7.1) and the detail screen (§7.5) did not: both looked reachable in
  every manual/E2E check made so far because the only configuration that
  exercises them is the one where focus never matters — a single-source
  household (the picker redirects before its cards would need focus) and,
  for detail, the fact that `TvFocusService.unregisterGroup()` nulls the
  active group on every screen teardown, so "arrives unfocused" is the
  default outcome, not an edge case that needed provoking. On the detail
  screen, focus lands on the action row's first entry — Play/Resume when the
  item is playable, since §6.4 only ever renders actions the item actually
  supports, so index 0 is always the primary one available.
- **The DOM-registration race behind both fixes.** Angular flushes
  constructor-registered `effect()`s *before* the change-detection pass that
  runs child `ngOnInit`s (`ComponentFixture.detectChanges()` /
  `ApplicationRef.tick()` call `EffectScheduler.flush()` first). Both fixes'
  gating signals can already read as "ready" on that first flush — the
  source list resolving synchronously from a store selector, or the detail
  item's loading/error/empty signals settling — while the group they target
  has not registered yet. `queueMicrotask()` defers the actual
  `setActive()` call past that synchronous change-detection pass, which is
  enough: the group is registered by the time the microtask runs. This is a
  different hazard from Home/Movies-Series/Search's own initial-focus
  effects, which happen to re-run naturally because their gating signals
  (an async store bootstrap) genuinely change value after the first render.

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

**Back at Home leaves TV mode.** At `/tv/xtreams/:id/home` there is no earlier
route to pop into, so Back there (`isTvHomeRoute()` in
`tv-shell-route.util.ts`) opens a two-button confirmation
(`TvLeaveConfirmComponent`, own focus group, `Stay` focused by default)
instead of `Location.back()` being a silent no-op. `Stay` (or a second Back,
which always means "step back", never "confirm") closes it and restores the
nav bar's Home focus; `Exit` navigates to `/workspace` without writing
`Settings.startInTvMode`, so the next TV launch still starts here. This is
the one way back to the desktop workspace short of quitting the app.

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
`libs/ui/playback` is out of bounds per §5.5), and it is what makes
transport controls, subtitles, the quality menu, VOD multi-source failover
and resume all work without reimplementation. Playback *diagnostics and
recovery* are a separate concern owned by `WebPlayerViewComponent` (which
wires `HtmlVideoPlayerComponent`'s `(playbackIssue)` output into
`WebPlayerRecoveryController` and `<app-playback-diagnostic-panel>`) — TV
mode does not mount that component, so it needs its own surface; see below.

**Web engine playback errors:** `TvWebEngineComponent` binds
`HtmlVideoPlayerComponent`'s public `(playbackIssue)` output (a
`PlaybackDiagnostic | null`, `@iptvnator/playback/util`) into a local signal.
A non-null diagnostic replaces `TvPlayerControlsComponent` — not layers over
it — with a TV-native error state built from the same
`lib-tv-catalog-state` component the catalogue/detail/live screens use for
their own load errors, giving a translated message
(`tv-playback-diagnostic-message.util.ts` maps
`PlaybackDiagnostic.code` to `TV.PLAYBACK.ERROR_*` copy — a small,
TV-shell-owned copy of the code→copy mapping
`PlaybackDiagnosticPanelComponent` keeps privately in `libs/ui/playback`,
not reusable from here since it is not exported from that library's public
barrel and its wider mapping branches on desktop-only external-player
capability) and a focusable Retry. Replacing rather than layering matters:
while `TvPlayerControlsComponent` is mounted it registers a playback session
that makes the shell's root keydown listener route OK/arrows as transport
keys (§6.3/§9.2) instead of focus navigation, which would make Retry
unreachable from the remote. Retry re-attempts the current stream by
bumping an internal token that forces the `channel` computed feeding
`[channel]` to recompute to a fresh object reference — the same signal
`HtmlVideoPlayerComponent.ngOnChanges()` already uses to decide whether to
re-run `playChannel()`, so no non-public API is touched.

**Known limitation, carried forward from Phase 4b:** `EmbeddedMpvPlayerComponent`
(frame-copy) renders its own loading/stalled/error states and a plain-click
Retry with no focusability, so a failed stream under frame-copy shows a
recovery control no remote key can reach. Not fatal — Back always exits
playback regardless — but not fixable from the shell without either an
upstream `shortcutsEnabled`/`showDiagnostics` extension point on that
component, or the shell rendering its own focusable recovery from the
`PlayerController`'s diagnostic, the way `TvWebEngineComponent` now does for
the web engine. Neither has been done for frame-copy yet.

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

The only open one is `EmbeddedMpvPlayerComponent`'s own non-focusable
loading/stalled/error Retry, documented under "The engine chain" above.

Every gap previously tracked here — no in-app navigation from Home to
Movies/Series/Search, and the multi-source source picker never setting
initial focus (plus a third found in the same audit: the detail screen had
the identical gap) — is now fixed; see "Persistent navigation and
reachability" above and `.plans/STATE-tv-shell.md` corrections #17/#18 for
the history. `nx build web`/`nx serve web` compile cleanly as of the commit
that added this document (`.plans/STATE-tv-shell.md` correction #16).
