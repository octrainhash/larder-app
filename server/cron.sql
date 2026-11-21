-- Runs the reminder job every hour. Replace the two values in CAPITALS first.
-- PROJECT_REF: from your Supabase URL, https://PROJECT_REF.supabase.co
-- CRON_SECRET: the same random text you saved as the CRON_SECRET function secret
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('larder-notify') where exists (select 1 from cron.job where jobname = 'larder-notify');
select cron.schedule('larder-notify', '0 * * * *', $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/notify',
    headers := '{"Content-Type":"application/json","x-cron-secret":"CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
