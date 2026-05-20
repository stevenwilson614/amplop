-- Reschedule FX sync to run daily at 06:00 Asia/Jakarta (WIB, UTC+7).
-- pg_cron schedules in UTC unless configured otherwise, so 06:00 WIB = 23:00 UTC (previous day).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any old schedule to avoid duplicate runs.
select cron.unschedule('fx-rate-sync-daily')
where exists (select 1 from cron.job where jobname = 'fx-rate-sync-daily');

select cron.schedule(
  'fx-rate-sync-daily',
  '0 23 * * *',
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
