# Weekend Finder 📅

Find the weekend that works for everyone.

---

## Deployment Guide

Follow these steps in order. Everything can be done in a browser — no terminal needed.

---

### Step 1 — Create a Supabase project (your database)

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign up with GitHub (easiest) or email
3. Click **New project**
4. Fill in:
   - **Name:** `weekend-finder` (or anything you like)
   - **Database password:** pick something strong and save it somewhere
   - **Region:** pick the one closest to you
5. Click **Create new project** and wait ~1 minute for it to spin up

---

### Step 2 — Set up the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-setup.sql` from this project
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" — that means it worked

---

### Step 3 — Get your Supabase API keys

1. In Supabase, click **Project Settings** (gear icon, bottom left)
2. Click **API** in the settings menu
3. You need two values — copy them somewhere:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public key** — a long string starting with `eyJ...`

---

### Step 4 — Put your code on GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click **New repository** (green button, top right)
3. Name it `weekend-finder`, leave it **Public**, click **Create repository**
4. On the next page, click **uploading an existing file**
5. Upload all the files from this project. The structure should be:
   ```
   weekend-finder/
   ├── index.html
   ├── package.json
   ├── vite.config.js
   ├── .gitignore
   ├── public/
   │   └── favicon.svg
   └── src/
       ├── main.jsx
       ├── App.jsx
       ├── supabase.js
       ├── utils.js
       ├── styles.js
       └── index.css
   ```
   > ⚠️ Do NOT upload `.env` or `supabase-setup.sql` to GitHub

6. Click **Commit changes**

---

### Step 5 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and click **Sign Up**
2. Sign up with GitHub — this lets Vercel see your repos
3. Click **Add New Project**
4. Find and select your `weekend-finder` repository, click **Import**
5. Vercel will detect it's a Vite project automatically
6. Before clicking Deploy, click **Environment Variables** and add:
   - Name: `VITE_SUPABASE_URL` → Value: your Project URL from Step 3
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon public key from Step 3
7. Click **Deploy**
8. Wait ~1 minute — Vercel will give you a live URL like `weekend-finder-abc.vercel.app` 🎉

---

### Step 6 — Test it

1. Open your Vercel URL
2. Create a poll
3. Copy the share link and open it in a new tab / send it to a friend
4. Both of you fill in availability — you should see each other's responses appear in real time

---

## Custom domain (optional)

If you want a custom URL like `weekendfinder.com`:
1. Buy a domain from Namecheap, Cloudflare, or similar
2. In Vercel, go to your project → **Settings** → **Domains**
3. Add your domain and follow the DNS instructions

---

## How it works

| Part | Technology | Cost |
|------|-----------|------|
| Frontend | React + Vite | Free |
| Hosting | Vercel | Free |
| Database | Supabase (Postgres) | Free up to 500MB |
| Realtime | Supabase Realtime | Free up to 200 concurrent |

The free tiers are very generous — you'd need thousands of active polls before hitting any limits.

---

## Troubleshooting

**"Poll not found" error**
- Check that you ran the SQL setup in Step 2 correctly
- Make sure your environment variables in Vercel are correct (no extra spaces)

**Changes don't appear in real time**
- Check that you ran the last two lines of `supabase-setup.sql` (the `alter publication` lines)
- Realtime must be enabled per-table in Supabase

**Vercel build fails**
- Make sure you uploaded all files including `vite.config.js` and `package.json`
- Check the build logs in Vercel for the specific error

**Need help?**
- Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Vercel docs: [vercel.com/docs](https://vercel.com/docs)
