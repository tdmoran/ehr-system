# AITranscription Mobile Optimization Plan

> **Created:** 2026-03-14
> **Status:** Proposed
> **Scope:** All transcription-related components in `packages/web/src/`

---

## Table of Contents

1. [Current Mobile Issues Analysis](#1-current-mobile-issues-analysis)
2. [Performance Bottlenecks](#2-performance-bottlenecks)
3. [UI/UX Improvements for Touch](#3-uiux-improvements-for-touch)
4. [Code Splitting & Lazy Loading Strategy](#4-code-splitting--lazy-loading-strategy)
5. [Asset Optimization](#5-asset-optimization)
6. [Animation Performance](#6-animation-performance)
7. [Memory Management](#7-memory-management)
8. [Network Optimization](#8-network-optimization)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Current Mobile Issues Analysis

### 1.1 Layout & Viewport Issues

| Issue | Severity | File(s) | Details |
|-------|----------|---------|---------|
| NoteEditor uses fixed 50/50 split layout | **CRITICAL** | `NoteEditor.tsx:436-485` | `w-1/2` side-by-side layout for transcript + editor is unusable on screens < 768px. No responsive breakpoint exists. |
| TranscriptionLayout shows keyboard shortcuts on mobile | LOW | `TranscriptionLayout.tsx:28-43` | `Ctrl+N`, `Ctrl+S`, `Space` hints shown on touch devices where they are irrelevant. Partially hidden with `hidden sm:inline` but inconsistently applied. |
| LiveRecording control buttons overflow on small screens | **HIGH** | `LiveRecording.tsx:626-681` | Three action buttons (Pause, Stop & Generate, Cancel) in a horizontal `flex` row can overflow on narrow viewports (< 375px). No wrapping or stacking applied. |
| ConsentModal max-height constraint | MEDIUM | `ConsentModal.tsx:270` | `max-h-[90vh]` is good, but signature canvas at fixed `120px` height is cramped on small phones. Touch accuracy suffers. |
| Dashboard pagination overflows | MEDIUM | `TranscriptionDashboard.tsx:504-548` | Page number buttons in `flex` row overflow horizontally on mobile. No simplified mobile pagination (e.g., "1 of N" with prev/next only). |
| Bottom nav overlap | MEDIUM | `Layout.tsx:190-225` | Fixed bottom nav (`pb-16`) can overlap content on transcription pages that have their own sticky footers (NoteEditor footer actions). |

### 1.2 Touch Interaction Issues

| Issue | Severity | File(s) | Details |
|-------|----------|---------|---------|
| Action buttons too small | **HIGH** | `TranscriptionDashboard.tsx:469-497` | Mobile card action buttons are `p-1.5` (28px touch target). Apple HIG recommends 44px minimum. |
| Signature canvas touch handling | MEDIUM | `ConsentModal.tsx:388-399` | Canvas `touch-none` CSS prevents scroll, but canvas height (120px) is small for finger signing. No pinch-to-zoom or undo. |
| Patient dropdown hard to dismiss on mobile | MEDIUM | `LiveRecording.tsx:109-117` | Uses `mousedown` listener for outside-click dismiss. Works, but no swipe-to-dismiss or explicit close button for mobile. |
| Confirm dialog for delete | LOW | `TranscriptionDashboard.tsx:160` | Uses `window.confirm()` which renders differently per browser and lacks mobile-friendly styling. |
| Sort headers not touch-optimized | MEDIUM | `TranscriptionDashboard.tsx:98-123` | Sort buttons on desktop table are small text links. On mobile (cards view), sorting is inaccessible entirely. |
| Textarea auto-resize jank | LOW | `NoteEditor.tsx:562-567` | Setting `height = 'auto'` then `height = scrollHeight` causes layout thrashing on every keystroke. Noticeable on low-end mobile. |

### 1.3 Content Rendering Issues

| Issue | Severity | File(s) | Details |
|-------|----------|---------|---------|
| Live transcript unbounded growth | **CRITICAL** | `LiveRecording.tsx:230` | `setTranscriptLines((prev) => [...prev, line])` appends indefinitely. Long sessions (30+ min) create thousands of DOM nodes in the transcript panel. No virtualization. |
| Waveform renders 48 bars every frame | **HIGH** | `LiveRecording.tsx:162-176` | `requestAnimationFrame` loop updates 48 divs via `setWaveformData(bars)` on every frame (~60fps). Each call triggers a React re-render of the entire component tree. |
| Raw transcript `<pre>` block unvirtualized | MEDIUM | `NoteEditor.tsx:452-458` | Long transcripts (10k+ words) rendered as a single `<pre>` element with `whitespace-pre-wrap`. No windowing. |
| Inline SVG icons duplicated | LOW | Multiple files | `XIcon`, `SpinnerIcon`, `CheckIcon` etc. are re-declared in ConsentModal, NoteEditor, LiveRecording, and Dashboard independently. ~15 duplicate icon component definitions. |

---

## 2. Performance Bottlenecks

### 2.1 Render Performance

**Waveform visualization (P0)**
- **Location:** `LiveRecording.tsx:156-180`
- **Problem:** `requestAnimationFrame` loop calls `setWaveformData(bars)` every frame, triggering a full React re-render of `LiveRecording` and all children (transcript, controls, patient info) ~60 times/second.
- **Impact:** On mid-range mobile devices (e.g., Pixel 6a, iPhone SE 3), this causes frame drops during recording, making the UI feel sluggish.
- **Fix:** Move waveform to a separate component with `React.memo`. Use `useRef` + direct DOM manipulation for bar heights instead of state. Throttle to 30fps on mobile using `matchMedia('(pointer: coarse)')`.

**Transcript line accumulation (P0)**
- **Location:** `LiveRecording.tsx:224-231`
- **Problem:** Each new transcript line creates a new array via spread (`[...prev, line]`). After 500+ lines, this allocation pattern becomes expensive. The entire list re-renders on every addition.
- **Impact:** Memory pressure + GC pauses on mobile. DOM node count grows unbounded.
- **Fix:** Use `react-window` or `@tanstack/virtual` for the transcript list. Cap visible DOM nodes at ~50. Use `useReducer` with append action instead of spread.

**Auto-resize textarea (P1)**
- **Location:** `NoteEditor.tsx:562-567`
- **Problem:** On every `value` change, the textarea height is set to `auto` then recalculated. This forces two layout reflows per keystroke.
- **Fix:** Use `ResizeObserver` or a content-editable div with CSS `field-sizing: content` (Chrome 123+, Safari 17.4+). Fallback: debounce resize to 100ms.

### 2.2 JavaScript Bundle Size

**All transcription components eagerly loaded (P1)**
- **Location:** `TranscriptionsPage.tsx:1-8`
- **Problem:** `TranscriptionDashboard`, `LiveRecording`, and `NoteEditor` are all statically imported at the top of `TranscriptionsPage.tsx`. The user only sees one at a time, but all three are bundled together.
- **Impact:** ~40-60KB of component code loaded on initial page visit even if user only views the dashboard.
- **Fix:** Use `React.lazy()` + `Suspense` for `LiveRecording` and `NoteEditor`. Keep `TranscriptionDashboard` eager since it's the default view.

**Inline SVG icon duplication (P2)**
- **Location:** All transcription components
- **Problem:** ~15 SVG icon components are independently defined across 4 files. Each definition adds ~200-400 bytes. Total waste: ~4-6KB uncompressed.
- **Fix:** Extract to a shared `transcription-icons.ts` barrel file or use an icon sprite.

### 2.3 API & Data Fetching

**No request caching or deduplication (P1)**
- **Location:** `useTranscriptions.ts`, `api/transcriptions.ts`
- **Problem:** Every filter change, sort change, or page navigation triggers a fresh API call with no caching. Navigating away and back re-fetches everything.
- **Fix:** Implement `stale-while-revalidate` pattern or adopt `@tanstack/react-query` for the transcription API layer. This also provides automatic background refetching, retry logic, and request deduplication.

**Patient search lacks proper debounce cancellation (P2)**
- **Location:** `LiveRecording.tsx:78-94`
- **Problem:** The debounced patient search fires a request, but if the user types quickly, multiple in-flight requests can resolve out of order, showing stale results.
- **Fix:** Use `AbortController` to cancel superseded requests. Or adopt `@tanstack/react-query` which handles this automatically.

---

## 3. UI/UX Improvements for Touch

### 3.1 Touch Target Sizing (P0)

All interactive elements must meet 44x44px minimum touch targets per Apple HIG / WCAG 2.5.8.

| Component | Current Size | Target Size | Change |
|-----------|-------------|-------------|--------|
| Dashboard mobile card actions | `p-1.5` (~28px) | `p-2.5` (~44px) | Increase padding |
| Pagination buttons | `px-3 py-1.5` (~32px tall) | `px-4 py-2.5` (~44px tall) | Increase padding on mobile |
| Sort header buttons | Text-only (~24px) | N/A on mobile | Add mobile sort dropdown instead |
| Filter inputs | `py-2` (~36px) | `py-3` (~44px) on mobile | Conditional mobile sizing |
| Tab navigation links | `px-4 py-2.5` (~36px) | `py-3` (~44px) on mobile | Increase vertical padding |

### 3.2 Mobile-First NoteEditor Layout (P0)

The current 50/50 split is completely broken on mobile. Proposed redesign:

```
Mobile (< 768px):
  ┌──────────────────────┐
  │ Header + Template    │
  ├──────────────────────┤
  │  [Transcript] [Note] │  ← Tab switcher
  ├──────────────────────┤
  │                      │
  │  Active tab content  │
  │  (full width)        │
  │                      │
  ├──────────────────────┤
  │ AI Suggestions       │  ← Collapsible
  ├──────────────────────┤
  │ Save Draft | Finalize│
  └──────────────────────┘

Desktop (>= 768px):
  Keep current side-by-side layout
```

**Implementation:**
- Add state `activeTab: 'transcript' | 'note'` for mobile
- Use `md:flex` for desktop split, `block` for mobile
- Add a tab bar component visible only on `md:hidden`
- Make suggestions panel collapsible with expand/collapse toggle

### 3.3 Mobile Recording Controls (P0)

Redesign recording controls for thumb-friendly use:

```
Current (3 buttons in a row):
  [Pause] [Stop & Generate Note] [Cancel]

Proposed mobile layout:
  ┌────────────────────────┐
  │     ● 03:42            │  ← Large timer
  │   [====== ======]      │  ← Waveform
  │                        │
  │      ⏸ Pause           │  ← Primary action, full width
  │                        │
  │  [Stop & Generate]     │  ← Secondary, full width
  │  [Cancel]              │  ← Tertiary, text-only
  └────────────────────────┘
```

- Stack buttons vertically on mobile (`flex-col md:flex-row`)
- Primary action button: minimum 48px height
- Cancel as text link rather than outlined button on mobile

### 3.4 Swipe Gestures (P2)

- **Dashboard cards:** Swipe left to reveal delete action (like iOS mail)
- **NoteEditor tabs (mobile):** Swipe between transcript and note tabs
- **ConsentModal:** Swipe down to dismiss

### 3.5 Mobile Sort & Filter (P1)

Replace desktop filter bar with mobile-optimized pattern:

- **Filter chips** at top: tappable pills showing active filters
- **Bottom sheet** for filter form: slides up from bottom with all filter options
- **Sort selector:** Dropdown or bottom sheet instead of column header buttons
- Add "Sort by" chip alongside filter chips on mobile

### 3.6 Haptic Feedback (P2)

Add `navigator.vibrate()` for key recording actions:
- Start recording: short pulse (50ms)
- Pause/Resume: double pulse (50ms, 50ms gap, 50ms)
- Stop: long pulse (100ms)
- Error: triple short pulse

---

## 4. Code Splitting & Lazy Loading Strategy

### 4.1 Route-Level Splitting (P0)

```typescript
// TranscriptionsPage.tsx - proposed changes
import { lazy, Suspense } from 'react';

// Eagerly loaded (default view)
import { TranscriptionDashboard } from '../components/transcriptions/TranscriptionDashboard';

// Lazy loaded (on demand)
const LiveRecording = lazy(() =>
  import('../components/transcriptions/LiveRecording').then(m => ({ default: m.LiveRecording }))
);
const NoteEditor = lazy(() =>
  import('../components/transcriptions/NoteEditor').then(m => ({ default: m.NoteEditor }))
);
const ConsentModal = lazy(() =>
  import('../components/transcriptions/ConsentModal')
);
```

**Expected savings:** ~35-50KB reduction in initial bundle for transcription dashboard visits.

### 4.2 Component-Level Splitting (P1)

| Component | Trigger | Estimated Size |
|-----------|---------|---------------|
| `ConsentModal` | User clicks "Record Consent" | ~12KB |
| `NoteEditor` | User navigates to `/transcriptions/:id` | ~18KB |
| `LiveRecording` | User navigates to `/transcriptions/new` | ~22KB |
| Waveform visualization | Recording starts | ~3KB |
| Signature canvas | Consent method = "electronic" | ~4KB |

### 4.3 Prefetching Strategy (P2)

- When user hovers over "New Session" button, prefetch `LiveRecording` chunk
- When user hovers over a session row's "View" button, prefetch `NoteEditor` chunk
- Use `<link rel="prefetch">` for likely-next-visited chunks
- On dashboard load with `recording` status sessions, prefetch `LiveRecording`

### 4.4 Third-Party Lazy Loading (P2)

If `@tanstack/react-query` or `react-window` are adopted:
- Bundle them with the components that use them (co-locate in the same chunk)
- Avoid adding them to the shared/common chunk

---

## 5. Asset Optimization

### 5.1 SVG Icon Consolidation (P1)

**Current state:** ~15 inline SVG icon components duplicated across 4 files.

**Proposed structure:**
```
packages/web/src/components/transcriptions/
  icons.ts          ← Single barrel export of all transcription icons
```

**Icons to consolidate:**
- `XIcon` (in ConsentModal, NoteEditor, LiveRecording)
- `SpinnerIcon` (in ConsentModal, NoteEditor, LiveRecording, Dashboard)
- `CheckIcon` (in ConsentModal, NoteEditor)
- `MicrophoneIcon` (in LiveRecording, Dashboard)
- Plus ~8 more unique icons

**Estimated savings:** ~3-4KB uncompressed, cleaner imports.

### 5.2 Sponsor/Ad Image Optimization (P1)

**Current state:** `Layout.tsx` references 10 sponsor logo PNGs in `/ads/`. These load for every page.

**Optimizations:**
- Convert PNGs to WebP with PNG fallback (40-60% size reduction)
- Add `loading="lazy"` to all sponsor images
- Add `width` and `height` attributes to prevent layout shift
- Use `srcset` with 1x and 2x variants for retina displays
- Consider an image CDN with on-the-fly resizing

### 5.3 Font Loading (P2)

- Audit custom fonts (`font-display`, `font-body`) for subsetting opportunities
- Use `font-display: swap` to prevent FOIT on mobile
- Preload critical font files with `<link rel="preload">`

---

## 6. Animation Performance

### 6.1 Waveform Animation (P0)

**Current:** CSS transitions on 48 `<div>` elements + React state updates at 60fps.

**Problem:** Each frame: `getByteFrequencyData` -> create array -> `setWaveformData` -> React reconciliation -> DOM updates -> CSS transition. This is ~3x more work than needed.

**Optimized approach:**
```
Option A: Canvas-based waveform (recommended)
- Replace 48 divs with a single <canvas>
- Draw bars directly via Canvas 2D API
- Zero React re-renders during animation
- GPU-composited via will-change: transform

Option B: Direct DOM manipulation
- Use refs to each bar div
- Update style.height directly via ref
- Skip React state entirely
- Keep CSS transitions for smoothing
```

**Target:** 60fps on iPhone SE 3, 30fps acceptable on older devices.

### 6.2 Pulse Animations (P1)

**Current:** `animate-pulse` used on recording/processing status badges. These use CSS `opacity` animation which can be GPU-composited.

**Status:** Already performant. No changes needed.

### 6.3 Spinner Animations (P1)

**Current:** `animate-spin` on SVG spinners. Uses CSS `transform: rotate()` which is GPU-composited.

**Status:** Already performant. No changes needed.

### 6.4 Scroll Performance (P1)

**Current:** `scrollIntoView({ behavior: 'smooth' })` on every new transcript line.

**Problem:** Smooth scrolling during recording adds jank if transcript updates arrive faster than scroll animation completes.

**Fix:**
- Use `behavior: 'instant'` during active recording
- Switch to `behavior: 'smooth'` when paused or reviewing
- Debounce scroll to max once per 500ms during active recording

### 6.5 CSS Transition Audit (P2)

Components using `transition-colors` or `transition-all`:
- All hover effects on buttons: fine, but `transition-all` is overly broad
- Replace `transition-all` with specific property transitions (`transition-colors`, `transition-opacity`)
- This prevents unintended transitions on layout properties

---

## 7. Memory Management

### 7.1 Audio Resources (P0)

**Current cleanup:** `LiveRecording.tsx:137-154` - `stopMediaResources()` properly stops tracks, closes AudioContext, and cancels animation frames.

**Issues:**
- `AudioContext` is created but may not be closed on error paths (e.g., if session creation fails after mic access is granted - fixed at line 323, but only stops tracks, doesn't close AudioContext)
- `MediaRecorder.ondataavailable` closure holds references to `wsRef` and `sid`

**Fixes:**
- Ensure `audioContextRef.current?.close()` is called on ALL error paths
- Use `AbortController` pattern for cleanup coordination
- Add a `useEffect` cleanup that closes AudioContext if component unmounts mid-recording

### 7.2 WebSocket Lifecycle (P0)

**Current:** WebSocket reconnect logic in `connectWebSocket` uses `setTimeout` for retry. If component unmounts during a retry delay, the timeout fires and creates a new WebSocket that's never cleaned up.

**Fix:**
- Track retry timeouts in a ref and clear them on unmount
- Add an `isMounted` ref check before reconnecting
- Or better: use `AbortController.signal` to gate all async operations

### 7.3 Transcript Line Accumulation (P0)

**Current:** `transcriptLines` state grows unbounded during recording.

**Fixes:**
- Cap at 200 most recent lines in state (archive older lines to a ref for later retrieval)
- Use virtualized list (`react-window`) to limit DOM nodes to ~20 visible items
- After recording ends, move full transcript to session data and clear local state

### 7.4 Event Listener Cleanup (P1)

**Current:** `ConsentModal.tsx` canvas event handlers are attached via React synthetic events (correct). `LiveRecording.tsx:109-117` uses manual `document.addEventListener('mousedown', ...)` with proper cleanup.

**Status:** Mostly correct. One concern:
- The outside-click listener in `LiveRecording.tsx:110-117` fires on every mousedown globally. This is wasteful when the dropdown isn't open.
- **Fix:** Only attach the listener when `showPatientDropdown === true`.

### 7.5 FileReader in Audio Chunk Upload (P1)

**Location:** `LiveRecording.tsx:355-361`

**Problem:** A new `FileReader` is created for every audio chunk (every 5 seconds). The `onloadend` callback creates a closure over `currentWs`. If WebSocket closes between `readAsDataURL` start and callback, the data is silently lost.

**Fix:**
- Check `currentWs.readyState === WebSocket.OPEN` in the callback (already done at line 358)
- Consider using `Blob.arrayBuffer()` (returns a Promise, no FileReader needed) for cleaner async flow
- Add error handling for FileReader failures

---

## 8. Network Optimization

### 8.1 API Request Batching (P1)

**Current:** `NoteEditor.tsx` loads session data in a single call. Good.

**Opportunity:** Dashboard view makes one API call per page. Consider:
- Prefetching the next page when user is on a paginated view
- Caching previous pages in memory so back-navigation is instant

### 8.2 WebSocket Message Compression (P1)

**Current:** Audio chunks are base64-encoded before sending over WebSocket. Base64 adds ~33% overhead.

**Optimization:**
- Send raw `ArrayBuffer` via WebSocket binary frames instead of base64 JSON
- Reduces bandwidth by ~33% for audio data
- Server needs to handle binary WebSocket frames

```typescript
// Current (wasteful):
reader.readAsDataURL(event.data);
// base64 string ~133% of original size

// Proposed (efficient):
const buffer = await event.data.arrayBuffer();
ws.send(buffer);  // Binary frame, original size
```

### 8.3 Offline Support (P2)

- Cache dashboard data in IndexedDB for offline viewing
- Queue note edits when offline, sync when connection returns
- Show clear offline indicator in UI
- Audio recording should continue to work offline (store chunks locally)

### 8.4 Connection-Aware Behavior (P2)

Use `navigator.connection` API (where available):
- On `2g`/`slow-2g`: disable waveform animation, reduce audio chunk frequency
- On `3g`: reduce waveform to 15fps, keep 5s chunk interval
- On `4g`/`wifi`: full experience

### 8.5 Auto-Save Optimization (P1)

**Current:** `NoteEditor.tsx:259-270` debounces saves at 1500ms. Every keystroke resets the timer.

**Optimizations:**
- Increase debounce to 3000ms on mobile (typing is slower, save trips are expensive)
- Add `navigator.sendBeacon()` fallback for saves when page is being closed
- Batch field changes: only send fields that actually changed (diff against last saved state)

---

## 9. Testing Strategy

### 9.1 Device Testing Matrix

| Device | OS | Screen | Priority | Covers |
|--------|----|--------|----------|--------|
| iPhone SE 3 | iOS 17+ | 375x667 | **P0** | Small screen, older Safari |
| iPhone 15 | iOS 17+ | 393x852 | **P0** | Current mainstream |
| Samsung Galaxy A54 | Android 14 | 393x851 | **P0** | Mid-range Android |
| iPad Mini 6 | iPadOS 17+ | 744x1133 | **P1** | Tablet, clinic use |
| Pixel 6a | Android 14 | 412x915 | **P1** | Mid-range, Chrome |
| iPhone 12 Mini | iOS 17+ | 360x780 | **P2** | Smallest modern iPhone |
| Samsung Galaxy S21 | Android 13 | 360x800 | **P2** | Older flagship |

### 9.2 Automated E2E Tests (Playwright)

```
Tests to add/update:

Mobile viewport tests (375x667):
  ✓ Dashboard renders mobile cards (not table)
  ✓ Mobile cards have 44px+ touch targets
  ✓ Pagination shows simplified controls
  ✓ Filter chips show active filter count
  ✓ Bottom sheet filter form opens and closes

NoteEditor mobile tests:
  ✓ Tab switcher visible on mobile
  ✓ Can switch between transcript and note tabs
  ✓ Footer actions accessible and not overlapped by bottom nav
  ✓ AI suggestions panel is collapsible

LiveRecording mobile tests:
  ✓ Controls stack vertically
  ✓ Waveform renders without layout overflow
  ✓ Patient search dropdown is usable
  ✓ Recording controls have 48px+ touch targets

ConsentModal mobile tests:
  ✓ Signature canvas is finger-friendly (height >= 150px)
  ✓ Modal scrolls properly within viewport
  ✓ Checkboxes have adequate touch targets
  ✓ Footer buttons don't overflow

Performance tests:
  ✓ Dashboard loads in < 3s on throttled 3G
  ✓ Waveform maintains 30fps on mobile viewport
  ✓ NoteEditor with 10k-word transcript doesn't freeze
  ✓ Memory doesn't exceed 100MB after 30min recording
```

### 9.3 Performance Benchmarks

| Metric | Current (est.) | Target | Tool |
|--------|---------------|--------|------|
| LCP (mobile) | ~2.5s | < 1.5s | Lighthouse |
| FID/INP (mobile) | ~200ms | < 100ms | Lighthouse |
| CLS (mobile) | ~0.15 | < 0.05 | Lighthouse |
| JS bundle (transcription routes) | ~80KB | < 45KB | Vite build |
| Recording UI frame rate | ~30fps | 60fps | Chrome DevTools |
| Memory after 30min recording | ~150MB | < 80MB | Chrome DevTools |

### 9.4 Manual Testing Checklist

- [ ] Record a 5-minute session on iPhone SE in Safari
- [ ] Sign consent form using finger on Galaxy A54
- [ ] Edit a note with long transcript on iPad Mini
- [ ] Navigate dashboard with 50+ sessions on slow 3G
- [ ] Start recording, lock phone, unlock - verify state preserved
- [ ] Switch apps mid-recording, return - verify audio continues
- [ ] Rotate device during recording - verify layout adapts
- [ ] Pull down notification shade during recording - verify no interruption
- [ ] Verify bottom nav doesn't overlap NoteEditor footer on any device

---

## 10. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)

**Priority: P0 items that affect usability**

| Task | File(s) | Effort | Impact |
|------|---------|--------|--------|
| Add mobile tab layout to NoteEditor | `NoteEditor.tsx` | 4h | Unblocks mobile note editing |
| Stack recording controls vertically on mobile | `LiveRecording.tsx` | 2h | Prevents button overflow |
| Increase touch targets on dashboard cards | `TranscriptionDashboard.tsx` | 1h | Meets accessibility standards |
| Cap transcript lines at 200 + virtualize | `LiveRecording.tsx` | 4h | Prevents memory crash on long sessions |
| Move waveform to canvas or ref-based rendering | `LiveRecording.tsx` | 6h | Eliminates 60fps re-renders |
| Fix WebSocket reconnect timeout leak | `LiveRecording.tsx` | 2h | Prevents ghost connections |
| Fix AudioContext leak on error paths | `LiveRecording.tsx` | 1h | Prevents audio resource leak |

**Phase 1 total: ~20h**

### Phase 2: Performance & UX (Week 3-4)

**Priority: P1 items that improve experience**

| Task | File(s) | Effort | Impact |
|------|---------|--------|--------|
| Lazy load LiveRecording + NoteEditor | `TranscriptionsPage.tsx` | 3h | ~40KB initial bundle reduction |
| Consolidate SVG icons into shared module | All transcription components | 3h | ~4KB bundle reduction, DRY |
| Add mobile sort/filter bottom sheet | `TranscriptionDashboard.tsx` | 6h | Better mobile filter UX |
| Simplify mobile pagination | `TranscriptionDashboard.tsx` | 2h | Prevents horizontal overflow |
| Debounce transcript scroll during recording | `LiveRecording.tsx` | 1h | Reduces scroll jank |
| Optimize auto-save (longer debounce, diff-only) | `NoteEditor.tsx` | 3h | Fewer network requests |
| Add `loading="lazy"` to sponsor images | `Layout.tsx` | 0.5h | Faster initial paint |
| Send audio as binary WebSocket frames | `LiveRecording.tsx` + server | 4h | 33% bandwidth reduction |
| Add `react-query` for transcription API | `useTranscriptions.ts`, `api/` | 6h | Caching, dedup, retry |
| Conditional listener attachment (dropdown) | `LiveRecording.tsx` | 1h | Fewer global event listeners |

**Phase 2 total: ~30h**

### Phase 3: Polish & Advanced (Week 5-6)

**Priority: P2 items that add delight**

| Task | File(s) | Effort | Impact |
|------|---------|--------|--------|
| Swipe gestures on dashboard cards | `TranscriptionDashboard.tsx` | 4h | Native-feeling interactions |
| Swipe between NoteEditor tabs (mobile) | `NoteEditor.tsx` | 3h | Intuitive tab navigation |
| Haptic feedback on recording actions | `LiveRecording.tsx` | 1h | Tactile confirmation |
| Connection-aware quality adjustments | `LiveRecording.tsx` | 4h | Better on slow networks |
| Prefetch chunks on hover | `TranscriptionsPage.tsx` | 2h | Faster navigation |
| Offline viewing for dashboard | `useTranscriptions.ts` | 8h | Works without network |
| Enlarge signature canvas on mobile | `ConsentModal.tsx` | 2h | Better signing experience |
| Replace `transition-all` with specific props | All components | 1h | Fewer unexpected transitions |
| Custom delete confirmation modal | `TranscriptionDashboard.tsx` | 3h | Consistent UX |
| Font subsetting + preload | Build config | 2h | Faster text rendering |

**Phase 3 total: ~30h**

### Total Estimated Effort

| Phase | Effort | Timeline |
|-------|--------|----------|
| Phase 1 (Critical) | ~20h | Week 1-2 |
| Phase 2 (Performance) | ~30h | Week 3-4 |
| Phase 3 (Polish) | ~30h | Week 5-6 |
| **Total** | **~80h** | **6 weeks** |

### Success Criteria

- All P0 issues resolved
- Lighthouse mobile score >= 90 (Performance)
- No touch target below 44px
- NoteEditor fully usable on 375px viewport
- 30-minute recording session uses < 80MB memory
- Initial page load < 1.5s on 4G
- All E2E mobile tests passing
