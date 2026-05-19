-- ============================================================
-- AMPLOP — Migration 4: Daily FX rate cron job
-- Run AFTER deploying the fx-rate-sync Edge Function.
-- ============================================================

-- Enable required extensions (safe to run if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule daily FX sync at 00:00 UTC (07:00 WIB / Jakarta time).
-- Uses pg_net to POST to the Edge Function.
-- The anon key is included so Supabase's gateway accepts the request;
-- the function itself authenticates to the DB via its service role env var.
select cron.schedule(
  'fx-rate-sync-daily',
  '0 0 * * *',
  format(
    $cron$
    select net.http_post(
      url     := 'https://vqvknxpbdbqlibzhqutz.supabase.co/functions/v1/fx-rate-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
      body    := '{}'::jsonb
    );
    $cron$,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtueHBiZGJxbGliemhxdXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTA2MDAsImV4cCI6MjA5NDc2NjYwMH0.IfhzbhJrLaBObr5Mugc8wHjQQ9aN-FQkCZRYApJlKBM'
  )
);

-- To verify the schedule was created:
-- select * from cron.job;

-- To remove the schedule later:
-- select cron.unschedule('fx-rate-sync-daily');
