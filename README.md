# Trichy Insight — Lovable.dev Migration

Tamil news portal for Tiruchirappalli (Trichy), Tamil Nadu.

## Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **UI**: Shadcn/ui (New York style) + Radix UI
- **Backend**: Express.js API server (separate folder)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth

---

## Setup in Lovable

### 1. Environment Variables
Set these in your project settings:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |

### 2. Frontend (`/`)
The main React app lives in `src/`. Import this folder as your Lovable project root.

### 3. Backend API (`/api-server`)
The Express API server handles:
- AI article generation (`/api/ai/generate`)
- RSS feed aggregation (`/api/aggregator/fetch`)
- Social publishing (Facebook, Instagram, WhatsApp, Twitter, Bluesky)
- YouTube OAuth
- Push notifications (VAPID)
- Newsletter management
- Sitemap & RSS feed generation

For Lovable, you can deploy this as a separate service (Railway, Render, Fly.io) and set `VITE_API_URL` to point to it.

### 4. Supabase Tables Required
- `news_posts`
- `page_view_events`
- `user_roles`
- `social_publish_settings`
- `site_settings`
- `newsletter_subscribers`
- `push_subscriptions`
- `ad_placements`
- `direct_channels`

### 5. Secrets Needed (for API server)
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (or Gemini — see `src/routes/ai-generate.ts`)
- `SARVAM_API_KEY` (Tamil TTS/translation)
- `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID`
- `YOUTUBE_REFRESH_TOKEN` + `YOUTUBE_CLIENT_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_ACCOUNT_ID` + `R2_BUCKET_NAME` + `R2_PUBLIC_URL`

---

## Running Locally

### Frontend
```bash
npm install
npm run dev
```

### API Server
```bash
cd api-server
npm install
npm run dev
```
