# Connecting the Flogger server

The app works on its own. These steps switch on sign-in, sync between devices, shared shopper prices and stock, push notifications and email reminders. All services used here have free plans.

## 1. Supabase project
1. Sign up at supabase.com and create a project (any name, pick the region closest to your users).
2. **SQL Editor → New query**: paste `schema.sql`, click **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to `https://octrainhash.github.io/flogger/` and add the same address under **Redirect URLs**.
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key** into `config.js`. Both are safe to publish.

## 2. Email (Resend)
1. Sign up at resend.com and create an API key.
2. Until you verify a domain, Resend only delivers to your own sign-up address, which is fine for testing.

## 3. Reminder function
1. **Edge Functions → Deploy a new function → Via editor**, name it `notify`, paste `functions/notify/index.ts`, deploy.
2. In the function's settings, turn **Verify JWT** off (the function checks its own secret).
3. **Edge Functions → Secrets**, add:
   - `VAPID_PUBLIC_KEY`: the key in `config.js`
   - `VAPID_PRIVATE_KEY`: kept private, never committed to the repo
   - `VAPID_SUBJECT`: `mailto:` plus your email
   - `RESEND_API_KEY`: from Resend
   - `EMAIL_FROM`: `Larder <onboarding@resend.dev>` until you verify a domain
   - `CRON_SECRET`: any long random text
   - `APP_URL`: `https://octrainhash.github.io/flogger/`
4. **SQL Editor**: open `cron.sql`, replace `PROJECT_REF` and `CRON_SECRET`, run it. Reminders now go out hourly to whoever it's 9am for.

## Notes
- iPhone push notifications need iOS 16.4 or later and Larder opened from the Home Screen icon.
- Shopper reports are shared within a country and kept for 30 days in the app view.
