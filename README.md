# Hausilo

The site at hausilo.com: off-market Houston deals for investors, wholesalers and homeowners.

## What's in here

| File | What it is |
| --- | --- |
| `index.html` | The page shell and all the styling |
| `app.js` | The whole app: pages, forms and the deal math (Silo's check, Hilo's score, Lumi's matching, Xilo's "new" flag) |
| `ilos3d.js` | The four ilos as 3D models |
| `config.js` | Two settings that connect the site to its database |
| `supabase/schema.sql` | The database: tables, and the rules for who can see and change what |
| `.github/workflows/keepalive.yml` | Asks the database one small question a day so the free plan doesn't pause it |

The site is plain files served by GitHub Pages. There is no build step: change a file here and the live site updates in about a minute.

## Turning the full site on

Until `config.js` has its two values, the site shows a "coming soon" page.

1. Create a free account at supabase.com and a new project. Any name, a US region, and save the database password somewhere safe.
2. In the project, open **SQL Editor** and start a new query. Paste everything from `supabase/schema.sql` and press **Run**. If it warns about destructive operations, confirm: the file only removes rules it is about to recreate.
3. Open **Authentication**, then **Sign In / Providers**, then **Email**. Turn **Confirm email** off and save. Supabase's built-in email only reaches your own team, so new members could never confirm.
4. Open **Authentication**, then **URL Configuration**. Set **Site URL** to `https://hausilo.com`.
5. Press **Connect** at the top of the project page (or open **Settings**, then **API Keys**). Copy the **Project URL** and the **Publishable key**, which starts with `sb_publishable_`. Never use a key that starts with `sb_secret_`.
6. Here on GitHub, open `config.js`, press the pencil, paste the two values between the quotes and commit.
7. Wait a minute, open hausilo.com, press **Join free** and create your own account.
8. Back in the SQL Editor, run `select public.make_admin('the email you just used');` and reload hausilo.com. An **Admin** button appears.

## Running it day to day

- New deals wait in **Admin**, under **Review**, until you approve them. Reject one with a reason and the poster sees it.
- Press **Mark proof seen** only after you have looked at the purchase contract or the deed yourself.
- Homeowner requests land in **Admin**, under **Homeowners**.
- A member who forgot their password: run `select public.set_password('their email', 'a temporary password');` in the SQL Editor, then tell them to change it on their account page. Once Supabase sends email from your own address (**Authentication**, **Emails**, **SMTP**), set `resetByEmail: true` in `config.js` and the site handles resets itself. Turn **Confirm email** back on at the same time.

## Before you promote it

Have a Texas real estate attorney look at the Terms and Privacy pages and at how the site will earn money. Both pages are plain-language starting drafts.
