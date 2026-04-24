// Faro V3 — Serverless Analysis Endpoint
// Deployed to Vercel as /api/analyze
// Your Anthropic API key lives here as an env var, never in the browser

// In-memory rate limiter (resets on each serverless cold start, ~good enough for MVP)
// For production scale, swap for Upstash Redis
const rateLimits = new Map();
const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ipOrUserId) {
  const now = Date.now();
  const key = ipOrUserId || 'anonymous';
  const record = rateLimits.get(key) || { count: 0, windowStart: now };
  
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    record.count = 0;
    record.windowStart = now;
  }
  
  if (record.count >= RATE_LIMIT_PER_HOUR) {
    return { allowed: false, resetIn: Math.ceil((RATE_LIMIT_WINDOW - (now - record.windowStart)) / 60000) };
  }
  
  record.count++;
  rateLimits.set(key, record);
  return { allowed: true };
}

export default async function handler(req, res) {
  // CORS for future mobile apps
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `You've reached the hourly limit. Please try again in ${rateCheck.resetIn} minute${rateCheck.resetIn === 1 ? '' : 's'}.`
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured. Please contact support.' });
  }

  try {
    const { fileData, fileType, fileName } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Reject files that are too large (Vercel has payload limits; be safe at 4MB)
    const sizeInMB = (fileData.length * 0.75) / (1024 * 1024);
    if (sizeInMB > 4) {
      return res.status(413).json({ error: 'File is too large. Please upload a statement under 4MB.' });
    }

    // Step 1: Extract clean transactions
    const isPDF = fileType === 'application/pdf' || fileName?.endsWith('.pdf');
    let statementText;
    
    if (isPDF) {
      statementText = await extractTransactionsFromPDF(fileData, apiKey);
    } else {
      // It's already text (CSV/TXT)
      statementText = atob(fileData);
    }

    // Count clean transactions
    const txCount = statementText.split('\n').filter(l => l.trim() && l.includes('|')).length;

    if (txCount === 0) {
      return res.status(400).json({ 
        error: "We couldn't find any transactions in that file. Please check it's a bank statement." 
      });
    }

    // Step 2: Analyze with warm coaching tone
    const report = await analyzeWithFaro(statementText, apiKey);
    report._txCount = txCount;

    return res.status(200).json({ success: true, report });

  } catch (err) {
    console.error('Analysis error:', err.message);
    return res.status(500).json({ 
      error: "Something went wrong on our end. Please try again in a moment." 
    });
  }
}

// ── EXTRACT TRANSACTIONS FROM PDF ──
async function extractTransactionsFromPDF(base64Data, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
          },
          {
            type: 'text',
            text: `You are a transaction extraction engine. Your ONLY job is to pull transaction rows from this bank statement.

STRICTLY IGNORE and do NOT include:
- Legal disclaimers, terms & conditions, agreements
- Payment terms, error resolution, dispute rights
- Credit reporting notices, foreign currency policies
- Marketing messages, benefits descriptions
- Customer service info, addresses, phone numbers
- Page headers, footers, page numbers, statement metadata
- "What to do if..." sections, billing rights
- Any paragraph-style prose, instructional text
- Summary rows like "Total for this period" or "Previous balance"
- Any text that is NOT an individual transaction line

ONLY extract rows that represent a SINGLE FINANCIAL TRANSACTION — rows with a date, merchant/description, and dollar amount.

Output format — pipe-delimited, one transaction per line, nothing else:
DATE|DESCRIPTION|AMOUNT|TYPE|ACCOUNT

Rules:
- Amount NEGATIVE for money leaving, POSITIVE for money arriving
- Preserve full merchant description including location
- Plain numbers only (no $ signs, no commas)
- If the same transaction appears in multiple account views, include it ONCE
- Label internal transfers between user's own accounts as type "Internal Transfer"

Start directly with the first transaction. No commentary.`
          }
        ]
      }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

// ── ANALYZE WITH WARM COACHING TONE ──
async function analyzeWithFaro(statementText, apiKey) {
  const prompt = `You are Faro — a warm, thoughtful financial psychologist and money coach. You sit across from someone who trusted you enough to share their bank statement. Your voice is kind, curious, and grounded — never clinical, never shaming, never preachy. You notice patterns with compassion. You treat money as deeply human: tied to stress, joy, relationships, identity, and meaning.

You are receiving PRE-CLEANED transaction data — one transaction per line, stripped of all bank legalese. Every line is a real financial event. Analyze the transactions ONLY.

TONE RULES — these matter as much as accuracy:
- Speak TO the person ("you") in second person
- Warm, conversational, human — like a trusted friend brilliant with money
- Never shame. Never scold. Never use words: "overspending", "bad habits", "wasted", "too much", "need to stop", "concerning", "problem"
- Use curious framing: "I noticed", "it looks like", "there's a pattern", "what if we tried", "something worth getting curious about"
- Acknowledge humanity behind numbers — stress, routine, comfort, care for others
- Celebrate what's working before naming what isn't
- Reference emotions and life context where data suggests them
- Avoid corporate language: "financial position", "cash flow status", "deficit spending". Say "more going out than coming in" or "the math is tight"

Analyze at five levels:

1. MERCHANT-LEVEL — which merchants appear repeatedly? Top 5 by total spend. Any duplicates worth gently surfacing?
2. CATEGORY-LEVEL — granular: Restaurants vs Groceries vs Coffee separately. Money to people is its own category (frame as care).
3. TRUE CASH FLOW — real income minus real outflow. Internal transfers don't count.
4. TIMING & EMOTIONAL PATTERNS — same-day savings-to-spending transfers, weekend spikes, payday behavior
5. MONEY SHARED WITH PEOPLE — frame as relationship, not leak

Transaction data:
${statementText}

Return ONLY valid JSON. Exact structure:
{
  "period": "Month Year",
  "bank": "Bank name + account type",
  "habitScore": <0-100>,
  "diagnosisHeadline": "<ONE warm, kind sentence naming what's happening in this person's money life. Human, not clinical.>",
  "diagnosisBody": "<2-3 sentences. Gently name the pattern. Acknowledge humanity. End with warmth.>",
  "cashFlow": {
    "income": <number>,
    "spent": <number>,
    "sentToOthers": <number>,
    "net": <number>,
    "status": "surplus|deficit|breakeven",
    "runwayMessage": "<one kind honest sentence — gentle, never alarming>"
  },
  "metrics": {
    "totalSpent": <number>,
    "totalIncome": <number>,
    "totalTransactions": <integer>,
    "avgTransaction": <number>,
    "sentToOthers": <number>
  },
  "projection": {
    "annualizedSpending": <number>,
    "topCategoryAnnual": <number>,
    "topCategoryName": "<name>",
    "projectionNote": "<gentle awareness: 'If this rhythm continues, that adds up to about $X over a year — something worth sitting with'>"
  },
  "categories": [
    { "name": "<specific human category>", "amount": <number>, "color": "<hex>", "transactionCount": <integer>, "topMerchants": ["<merchant $X>", "<merchant $Y>"] }
  ],
  "insights": [
    { "type": "alert|warn|good|info|note", "badge": "<warm label: 'Worth noticing', 'A pattern', 'Quietly happening', 'Something good', 'Curious'. NEVER 'Critical', 'Overspending', 'Watch out'>", "title": "<specific, curious, never shaming>", "body": "<2-3 sentences citing real merchants and amounts. Acknowledge the human.>", "evidence": "<data point>" }
  ],
  "actionPlan": [
    { "title": "<gentle invitation — 'Give your savings a little breathing room' NOT 'Stop withdrawing from savings'>", "description": "<warm, concrete. Framed as invitation or experiment>", "impact": "Could free up $X/mo", "difficulty": "Easy|Medium|Hard", "timeline": "This week|This month|Ongoing" }
  ],
  "goalSuggestion": {
    "goalTitle": "<most meaningful goal, framed warmly>",
    "goalDescription": "<why this would feel good to achieve>"
  },
  "closingWarmth": "<one kind sentence to end the report — something that feels like a friend's hand on your shoulder>"
}

Rules:
- 5-8 GRANULAR categories with colors from: #BA7517, #993C1D, #185FA5, #534AB7, #0F6E56, #993556, #888780, #7F77DD
- Separate Restaurants / Groceries / Coffee
- Every insight cites specific merchant + amount
- Exactly 3 actionPlan items
- Plain numbers only
- Internal transfers between own accounts don't count as spending/income
- CHECK YOUR TONE before returning. Read each sentence. If it sounds like a lecture, rewrite as a caring conversation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const raw = data.content[0].text.trim();
  const clean = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}
