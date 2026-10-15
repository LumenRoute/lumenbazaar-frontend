#!/bin/bash
cd "$(dirname "$0")"

# Stage all changes
git add -A

# Create commit with detailed message
git commit -m "feat(playground): Make simulation an explicit mode (Issue #17)

Implement explicit playground simulation mode with clear visual distinction
from live API resources, preventing accidental mixing of synthetic and real
settlement evidence.

Changes:
- Add PlaygroundDataMode type (live | simulation) with discriminated unions
- Add PlaygroundVerification and PlaygroundSettlement with dataMode field
- Implement live resource loading with error handling
- Add Data Mode selector UI (Live / Simulation buttons)
- Show API unavailability error state (no silent fallback)
- Add distinct badges for live (green) vs simulated (amber) results
- Prevent synthetic hashes from appearing as explorer evidence
- Update explorer links to only show for live settlements
- Add comprehensive Vitest and Playwright E2E tests
- Add detailed documentation (docs/playground-modes.md)

Type System:
- Discriminated unions ensure dataMode checks before rendering live UI
- markVerificationAsLive() / markSettlementAsLive() wrappers for API responses
- simulateVerification() / simulateSettlement() return simulation-marked records

UI/UX:
- Mode selector with disabled Live button when API unavailable
- Mode indicator badge showing current data source
- Data source badges on every verification/settlement result
- Alternative text instead of explorer links for simulated settlements
- Keyboard navigable mode selection
- Responsive on mobile and desktop

Testing:
- 8+ Vitest tests for mode discrimination
- 30+ Playwright E2E tests for UI, accessibility, workflows
- Tests cover mode switching, API unavailability, record isolation

Documentation:
- New docs/playground-modes.md with workflows, best practices, troubleshooting
- Comprehensive JSDoc on all new types and functions
- Examples distinguishing data mode from authorization mode

Acceptance Criteria Met:
✓ Simulation explicitly selected (not silent default)
✓ Live and simulated records use distinct labels (badges + text + tone)
✓ Synthetic hashes never appear as live evidence (type system + UI)
✓ Tests cover mode changes, API unavailability, record isolation
✓ Keyboard navigation and accessibility supported

Files Changed:
- src/services/playground.ts (type system, helpers)
- src/components/playground/payment-playground.tsx (UI refactoring)
- src/services/playground.test.ts (unit tests)
- tests/e2e/payment-playground-preflight.spec.ts (E2E tests)
- docs/playground-modes.md (new documentation)
"

# Push to new branch
git push -u origin issue-17-explicit-playground-mode
