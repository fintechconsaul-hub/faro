# Faro V3 — Your Financial Lighthouse

A warm, minimalist financial habits app. Users upload a bank statement and receive a kind, interactive report — no API key required from them, no account needed for V1.

## What's in this folder

```
faro-v3/
├── api/
│   └── analyze.js       ← Serverless function (your API key lives here)
├── public/
│   └── index.html       ← The app itself
├── package.json
├── vercel.json
└── README.md
```

## Deploying to Vercel — 10 minutes

### Step 1: Get your Anthropic API key (2 min)
Go to [console.anthropic.com](https://console.anthropic.com), sign up, and create an API key. Copy it. It starts with `sk-ant-`. New accounts get $5 free credit.

### Step 2: Push this folder to GitHub (3 min)
Create a free account at [github.com](https://github.com). Create a new repository called `faro`. Upload this entire folder to it — you can drag and drop all the files through the GitHub web interface.

### Step 3: Deploy to Vercel (3 min)
Go to [vercel.com](https://vercel.com) and sign up with your GitHub account. Click "Add New Project" → select your `faro` repo → click "Deploy". Takes about 90 seconds.

### Step 4: Add your API key (2 min)
In your Vercel project dashboard, go to **Settings → Environment Variables**. Add one variable:
- **Name:** `ANTHROPIC_API_KEY`
- **Value:** Paste your `sk-ant-...` key
- **Environments:** Check all three (Production, Preview, Development)

Click **Save**, then go to the **Deployments** tab and click the three dots on the latest deployment → **Redeploy** (so it picks up the new environment variable).

### Step 5: You're live
Your app is now at `your-project-name.vercel.app`. Share the link. Users upload statements, get warm reports. Nothing is stored. The API key is hidden server-side.

## Optional: Custom domain
Buy a domain at Namecheap or GoDaddy (`getfaro.com`, `faro.app`, etc. — ~$12/year). In Vercel, go to Settings → Domains and add it. Takes 5 minutes to propagate.

## Safety built in

- **Rate limiting:** Each IP can analyze 5 statements per hour (adjust in `api/analyze.js`)
- **File size limit:** 4MB max per upload
- **Cost cap:** Set a monthly spending limit at [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) to prevent surprise bills
- **No storage:** Statements are analyzed in memory and immediately discarded

## What users see

1. Warm upload screen — no signup, no key
2. Pulsing "taking a careful look" animation while analyzing
3. Interactive report:
   - Score circle with a warm greeting based on health
   - Italic diagnosis headline in a navy card
   - Cash flow visualizer with color-coded segments
   - Expandable categories (tap to see top merchants per category)
   - Insight cards with "Ask Faro about this" coaching buttons
   - Checkable action plan items
   - Goal suggestion with commit button
   - Closing note — warm sentence like a friend's hand on your shoulder

## Costs at scale

| Active users/month | API cost | Total |
|---|---|---|
| 100 | ~$23 | $23 |
| 500 | ~$113 | $113 |
| 2,000 | ~$450 | $450 |
| 10,000 | ~$2,270 | $2,270 |

Based on ~$0.15 per analysis (Opus 4.7), ~1.5 analyses per user/month average.

## Roadmap from here

**V4 (Month 2)**: User accounts via Clerk (free tier up to 10k users). Month-over-month comparison persists across devices. Email for returning users.

**V5 (Month 3)**: Stripe billing. Free tier = 1 analysis/month. Pro at $7.99/mo = unlimited + coaching conversations + goal tracking.

**V6 (Month 4)**: Real coaching endpoint — the "Ask Faro about this" buttons connect to Claude for multi-turn conversations about specific patterns. This becomes the Pro tier's killer feature.

**V7**: Plaid integration for live bank connections (no more manual upload).

## Testing locally (optional — skip if deploying directly)

If you want to test before deploying:
1. Install Node.js 20+
2. Install Vercel CLI: `npm i -g vercel`
3. Create a `.env.local` file with: `ANTHROPIC_API_KEY=sk-ant-...`
4. Run `vercel dev` in this folder
5. Open `http://localhost:3000`

That's it. Go build something beautiful.
