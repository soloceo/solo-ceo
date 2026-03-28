#!/bin/bash
# Run this script from the solo-ceo v2 directory on your Mac:
#   cd ~/Projects/solo-ceo\ v2 && bash fix-and-push.sh

set -e

echo "🔧 Cleaning up git lock files..."
rm -f .git/index.lock .git/index2.lock .git/HEAD.lock .git/objects/maintenance.lock
find .git/objects -name 'tmp_obj_*' -delete 2>/dev/null || true
rm -f .git/index2

echo "⏪ Undoing bad commit..."
git reset --soft HEAD~1

echo "📦 Staging all changes..."
git add \
  src/app/QuickCreateMenu.tsx \
  src/app/SyncIndicator.tsx \
  src/app/UserMenu.tsx \
  src/app/useClickOutside.ts \
  src/components/OfflineBanner.tsx \
  src/components/PageErrorBoundary.tsx \
  src/lib/date-utils.ts \
  src/app/App.tsx \
  src/db/api.ts \
  src/db/supabase-api.ts \
  src/db/supabase-interceptor.ts \
  src/db/sync-manager.ts \
  src/features/clients/ClientList.tsx \
  src/features/clients/LeadsBoard.tsx \
  src/features/finance/FinancePage.tsx \
  src/features/home/widgets/PomodoroWidget.tsx \
  src/features/settings/PlanSection.tsx \
  src/features/work/KanbanBoard.tsx \
  src/features/work/TaskCard.tsx \
  src/features/work/WorkPage.tsx \
  src/hooks/useRealtimeRefresh.ts \
  src/i18n/context.tsx \
  src/i18n/en/common.ts \
  src/main.tsx \
  src/store/useUIStore.ts \
  package.json \
  package-lock.json

echo "✅ Committing..."
git commit -m "perf: comprehensive optimization — component splitting, query fixes, sync batching, a11y

- Extract QuickCreateMenu, UserMenu, SyncIndicator from App.tsx (~20% reduction)
- Add reusable useClickOutside hook (eliminates 3 duplicate effects)
- Fix toast race condition with monotonic ID in useUIStore
- Add PageErrorBoundary for per-page error isolation
- Add OfflineBanner for persistent offline/sync status
- Consolidate duplicate date utils into src/lib/date-utils.ts
- Optimize N+1 queries in supabase-api.ts (push filters to SQL)
- Batch sync events (9 dispatches → 1 batch + individual)
- Fix auth listener leaks in supabase-interceptor and supabase-api
- Lazy-load English i18n with idle-time preloading
- Fix 30+ TypeScript any types with proper interfaces
- Improve a11y: ARIA roles, labels, expanded states on menus/kanban

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Changes pushed to https://github.com/soloceo/solo-ceo"
echo "GitHub Actions will auto-deploy to https://soloceo.github.io/solo-ceo/"
