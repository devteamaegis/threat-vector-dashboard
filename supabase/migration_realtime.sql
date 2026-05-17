-- ─────────────────────────────────────────────────────────────────
-- Kairos: Enable Supabase Realtime for live dashboard updates
-- Run this ONCE in the Supabase SQL editor (project → SQL editor → New query)
-- ─────────────────────────────────────────────────────────────────

-- 1. Enroll tables in the realtime publication so INSERT/UPDATE events
--    are broadcast to subscribed clients (this is what the dashboard subscribes to)
ALTER PUBLICATION supabase_realtime ADD TABLE tips;
ALTER PUBLICATION supabase_realtime ADD TABLE live_calls;

-- 2. Confirm enrollment
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
