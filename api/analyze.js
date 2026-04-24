// Faro V3 — Serverless Analysis Endpoint
// Deployed to Vercel as /api/analyze
// Your Anthropic API key lives here as an env var, never in the browser

// In-memory rate limiter (resets on each serverless cold start, ~good enough for MVP)

// For production scale, swap for Upstash Redis
// Faro V3.1 — Serverless Analysis Endpoint (speed-optimized)

const rateLimits = new Map();
const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `You've reached the hourly limit. Please try again in ${rateCheck.resetIn} minute${rateCheck.resetIn === 1 ? '' : 's'}.`
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY env var is missing');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ error: 'API key is malformed. Re-paste it in Vercel env vars.' });
  }

  try {
    const { fileData, fileType, fileName } = req.body;
    if (!fileData) return res.status(400).json({ error: 'No file provided' });

    const sizeInMB = (fileData.length * 0.75) / (1024 * 1024);
    if (sizeInMB > 4) {
      return res.status(413).json({ error: 'File is too large. Please upload a statement under 4MB.' });
    }

    const isPDF = fileType === 'application/pdf' || fileName?.endsWith('.pdf');
    let statementText;

    if (isPDF) {
      statementText = await extractTransactionsFromPDF(fileData, apiKey);
    } else {
      statementText = Buffer.from(fileData, 'base64').toString('utf-8');
    }

    const txCount = statementText.split('\n').filter(l => l.trim() && l.includes('|')).length;
    if (txCount === 0) {
      console.error('No transactions found. Raw output:', statementText.substring(0, 500));
      return res.status(400).json({ error: "We couldn't find any transactions in that file." });
    }

    const report = await analyzeWithFaro(statementText, apiKey);
    report._txCount = txCount;

    return res.status(200).json({ success: true, report });

  } catch (err) {
    console.error('Full error:', err);
    return res.status(500).json({
      error: `${err.message || 'Unknown error'}`
    });
  }
}

// ── EXTRACTION: Uses Sonnet for speed ──
async function extractTransactionsFromPDF(base64Data, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
          { type: 'text', text: `Extract transactions from this bank statement. Ignore all legal text, agreements, disclaimers, payment terms, dispute rights, headers, footers, page numbers, and summary totals. Only extract individual transaction rows with a date, merchant, and amount.

Output pipe-delimited, one per line, no commentary:
DATE|DESCRIPTION|AMOUNT|TYPE|ACCOUNT

Rules: NEGATIVE for money leaving, POSITIVE for arriving. Plain numbers. If a transaction appears in multiple account views, include once. Label internal transfers as type "Internal Transfer". Start directly with first transaction.` }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Extraction API error:', response.status, errText);
    throw new Error(`Extraction failed (${response.status}): ${errText.substring(0, 150)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`Anthropic error: ${data.error.message}`);
  if (!data.content?.[0]?.text) throw new Error('Empty extraction response');
  return data.content[0].text;
}

// ── ANALYSIS: Uses Opus for depth ──
async function analyzeWithFaro(statementText, apiKey) {
  const prompt = `You are Faro — a warm, thoughtful financial psychologist and money coach. Your voice is kind, curious, and grounded — never clinical, never shaming, never preachy. You treat money as deeply human: tied to stress, joy, relationships, identity, meaning.

You are receiving PRE-CLEANED transaction data — one per line, stripped of legalese. Analyze the transactions ONLY.

TONE: Second person ("you"). Warm, conversational. Never use: "overspending", "bad habits", "wasted", "too much", "need to stop", "concerning", "problem". Use: "I noticed", "it looks like", "there's a pattern", "what if we tried". Acknowledge humanity — stress, routine, comfort, care for others. Celebrate what's working before naming what isn't. Avoid corporate language.

Transaction data:
${statementText}

Return ONLY valid JSON, this exact structure:
{
  "period": "Month Year",
  "bank": "Bank name + account type",
  "habitScore": <0-100>,
  "diagnosisHeadline": "<warm sentence naming what's happening>",
  "diagnosisBody": "<2-3 sentences, gentle pattern naming, end with warmth>",
  "cashFlow": {
    "income": <number>, "spent": <number>, "sentToOthers": <number>, "net": <number>,
    "status": "surplus|deficit|breakeven",
    "runwayMessage": "<one kind sentence>"
  },
  "metrics": {
    "totalSpent": <number>, "totalIncome": <number>, "totalTransactions": <integer>,
    "avgTransaction": <number>, "sentToOthers": <number>
  },
  "projection": {
    "annualizedSpending": <number>, "topCategoryAnnual": <number>,
    "topCategoryName": "<n>", "projectionNote": "<gentle awareness>"
  },
  "categories": [
    { "name": "<specific>", "amount": <number>, "color": "<hex>", "transactionCount": <integer>, "topMerchants": ["<merchant $X>", "<merchant $Y>"] }
  ],
  "insights": [
    { "type": "alert|warn|good|info|note", "badge": "<warm label>", "title": "<specific>", "body": "<cite real merchants + amounts>", "evidence": "<data point>" }
  ],
  "actionPlan": [
    { "title": "<gentle invitation>", "description": "<warm, concrete>", "impact": "Could free up $X/mo", "difficulty": "Easy|Medium|Hard", "timeline": "This week|This month|Ongoing" }
  ],
  "goalSuggestion": { "goalTitle": "<warm goal>", "goalDescription": "<why it would feel good>" },
  "closingWarmth": "<one kind closing sentence>"
}

Rules: 5-8 categories from #BA7517, #993C1D, #185FA5, #534AB7, #0F6E56, #993556, #888780, #7F77DD. Separate Restaurants/Groceries/Coffee. Every insight cites specific merchant + amount. Exactly 3 actions. Plain numbers only. Internal transfers don't count.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Analysis API error:', response.status, errText);
    throw new Error(`Analysis failed (${response.status}): ${errText.substring(0, 150)}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`Anthropic error: ${data.error.message}`);
  if (!data.content?.[0]?.text) throw new Error('Empty analysis response');

  const raw = data.content[0].text.trim();
  const clean = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');

  try {
    return JSON.parse(clean);
  } catch (parseErr) {
    console.error('JSON parse failed. Raw response:', raw.substring(0, 500));
    throw new Error(`Analysis returned invalid JSON: ${parseErr.message}`);
  }
}
