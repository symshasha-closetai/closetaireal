

# Supabase Migration Plan

## What This Migration Means

Your app currently runs on **Lovable Cloud**, which manages your database, authentication, edge functions, and storage behind the scenes. Migration means setting up your **own standalone Supabase project** so you fully own and control all backend infrastructure. This is necessary for deploying outside Lovable (e.g., with Capacitor for iOS/Android).

## Current Setup (What You Have)

| Component | Current Provider | Notes |
|-----------|-----------------|-------|
| Database (15 tables) | Lovable Cloud | PostgreSQL with RLS policies |
| Auth (email + Google/Apple OAuth) | Lovable Cloud + `@lovable.dev/cloud-auth-js` | OAuth goes through Lovable's proxy |
| Edge Functions (14 functions) | Lovable Cloud | Auto-deployed |
| File Storage | Cloudflare R2 | Already standalone, no migration needed |
| Secrets (16 secrets) | Lovable Cloud | Need to recreate in new project |

## Migration Steps (In Order)

### Step 1: Create a Supabase Project
- Go to [supabase.com](https://supabase.com) and create a free account
- Create a new project (pick a region close to your users)
- Save your **Project URL**, **anon key**, and **service role key** -- you'll need these later

### Step 2: Migrate Database Schema
- Export all table definitions, functions, triggers, and RLS policies as SQL
- I will generate a single migration SQL file containing all 15 tables, 4 functions, and all RLS policies
- You run this SQL in your new Supabase project's SQL Editor

### Step 3: Migrate Data
- Export existing data from each table as CSV/SQL inserts
- Import into the new project
- Tables with data: `profiles`, `wardrobe`, `drip_history`, `style_profiles`, `friends`, `saved_outfits`, `saved_suggestions`, `daily_looks`, `daily_ratings`, `outfit_calendar`, `conversations`, `messages`, `conversation_participants`, `wardrobe_categories`, `user_suggestions`, `outfits`

### Step 4: Set Up Authentication
- Configure email/password auth in your new Supabase project (enabled by default)
- Set up Google OAuth: create credentials in Google Cloud Console, add to Supabase Auth settings
- Set up Apple OAuth: create credentials in Apple Developer Console, add to Supabase Auth settings
- Replace `lovable.auth.signInWithOAuth()` with standard `supabase.auth.signInWithOAuth()`
- Remove the `@lovable.dev/cloud-auth-js` dependency

### Step 5: Migrate Edge Functions
- Install the Supabase CLI locally (`npm install -g supabase`)
- Copy the 14 edge function folders to your local project
- Deploy with `supabase functions deploy`
- Re-add all secrets via `supabase secrets set KEY=VALUE`

### Step 6: Update Frontend Config
- Replace the Supabase URL and anon key in your `.env` to point to your new project
- Update `src/integrations/supabase/client.ts` (or just change env vars)
- Remove `src/integrations/lovable/index.ts` dependency

### Step 7: Migrate Auth Users
- Export users from Lovable Cloud (if possible) or have users re-register
- This is the trickiest part -- password hashes can be exported from Supabase's `auth.users` table if you have DB access

### Step 8: Test Everything
- Auth flow (sign up, sign in, OAuth)
- Wardrobe CRUD
- Drip rating
- Style Me / Surprise Me
- Messaging
- Profile editing

---

## What I Can Do Right Now (Inside Lovable)

I can help with Steps 2-3 immediately:
1. **Generate the full migration SQL** -- all tables, functions, triggers, RLS policies in one file
2. **Export your data** as CSV files you can download

## What You'll Need To Do Externally
- Create the Supabase account and project
- Set up Google/Apple OAuth credentials
- Deploy edge functions via CLI

---

## Recommended Order of Execution

Let's start with **Step 2** -- I'll generate the complete database schema migration SQL that you can run in your new Supabase project. Want me to proceed?

