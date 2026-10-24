# Mystic Blessings Command Centre

A private planning and client tracker for Lynn at Mystic Blessings. Vercel hosts the app; Supabase provides email-and-password sign-in and stores each user's workspace.

## Set up your live app

1. In your own [Supabase dashboard](https://supabase.com/dashboard), create a new project named **Mystic Blessings Command Centre**. Choose a region near you, such as Singapore.
2. Open that project's **SQL Editor**. Paste and run the full contents of [`supabase/migrations/20261024_create_workspaces.sql`](supabase/migrations/20261024_create_workspaces.sql). This creates the private workspace table and its access rules.
3. In Supabase, open **Connect** or **Settings → API Keys**. Copy the **Project URL** and a key beginning with `sb_publishable_`. Do not use the secret or service role key.
4. In [Vercel](https://vercel.com/new), choose **Import Git Repository** and select `yeanlynng1-gif/LynnComandCentre`. Vercel should recognize **Vite**. The build command is `npm run build`, and the output directory is `dist`.
5. Before deploying, add these Vercel **Environment Variables** for **Production** (and **Preview** if you plan to use previews):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Your Supabase Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |

6. Deploy. Copy the final Vercel address, such as `https://your-project.vercel.app`.
7. In Supabase, open **Authentication → URL Configuration**. Set the **Site URL** to that Vercel address and add the same address to **Redirect URLs**. Sign-in links must return to this site.
8. Open the Vercel site and sign in with the email and password of a user you created under **Supabase Authentication → Users**. If that user has no password, the email-link button is available as a fallback. Supabase's default email service sends links only to project team members; sending links elsewhere requires [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

The first sign-in creates an empty private workspace with the Christmas planning tasks. Keep the site address private if you prefer, although its client records remain protected by sign-in and database access rules.

### If sign-in returns HTTP 429

The email-and-password sign-in does not send an email, so use it if your Supabase user has a password. For the optional email-link button, check your inbox for an earlier link before requesting another. Supabase normally allows one magic-link request per email address per 60 seconds. Its built-in mail service is also limited to two emails per project per hour. If you reached that hourly limit, wait for it to reset or configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Supabase shows your project's limits under **Authentication → Rate Limits**. The sign-in screen temporarily disables repeat link requests and displays the Auth error code when available.

## Features

- Track enquiries, booking stages, payment verification, appointments, and follow-ups.
- See the next client or event task that needs attention.
- Plan the Christmas 2026 event, calculate ticket prices, and use WhatsApp message starters.
- Export and import JSON backups. Importing replaces the signed-in user's current workspace.

The app drafts WhatsApp messages; it does not send them or process QR payments. Verify payment before marking a booking confirmed.

## Local development

1. Install Node.js 22 or later and run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and **publishable** key. Never put a secret or service role key in a Vite variable.
3. Run the migration in `supabase/migrations` on your Supabase project.
4. In Supabase Auth URL Configuration, allow `http://localhost:5173` as a redirect URL for local testing.
5. Run `npm run dev`.

`npm run build` produces the static Vercel site in `dist`.

The Supabase `public.workspaces` table has row level security policies tied to the signed-in user ID. No service role key belongs in this repository or in Vercel frontend variables. Only the public site shell is served by Vercel; client data is fetched after sign-in.

To move records from the old local HTML version, use **Export backup** there, sign in to the hosted app, then use **Import**. Keep the downloaded backup private and do not commit it to GitHub.
