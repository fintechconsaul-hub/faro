// Faro V3.1.2 — Browser-side PDF parsing
// The frontend extracts PDF text and sends clean text to this endpoint.
// No vision model needed. No PDF library on server. Single fast Sonnet call.

const rateLimits = new Map();
const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
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

// Filter legal text and boilerplate from raw statement text
function filterLegalText(rawText) {
  const lines = rawText.split('\n');
  const kept = [];
  
  const LEGAL_MARKERS = [
    'What To Do If You Think', 'Your Rights If You Are', 'Error Resolution',
    'Cash Deposits:', 'Foreign Currency', 'Credit Reporting:',
    'Member FDIC', 'Issued by', 'Cardholder Agreement', 'You must contact us',
    'While we investigate', 'Application of Payments', 'Irregular Payments',
    'Non-Conforming Payments', 'Other Payment Options', 'In your communication',
    'Member Services', 'PO Box', 'P.O. Box',
  ];

  const txPattern = /\d{1,2}[\/\-]\d{1,2}.*[\d,]+\.\d{2}/;
  const datePattern = /\d{1,2}[\/\-]\d{1,2}/;
  const amountPattern = /[\d,]+\.\d{2}/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length > 250) continue;
    if (!/\d/.test(trimmed)) continue;
    
    let isLegal = false;
    for (const marker of LEGAL_MARKERS) {
      if (trimmed.includes(marker)) { isLegal = true; break; }
    }
    if (isLegal) continue;
    if (/^Page \d+ of \d+/i.test(trimmed)) continue;

    if (txPattern.test(trimmed) || (datePattern.test(trimmed) && amountPattern.test(trimmed))) {
      kept.push(trimmed);
    } else if (/(Purchase|Transfer|Payment|Deposit|Round Up|Cash back|Withdrawal|Credit)/i.test(trimmed) && amountPattern.test(trimmed)) {
      kept.push(trimmed);
    }
  }
  return kept.join('\n');
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
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });
  if (!apiKey.startsWith('sk-ant-')) return res.status(500).json({ error: 'API key is malformed.' });

  try {
    const { statementText, userName } = req.body;
    if (!statementText) return res.status(400).json({ error: 'No statement text provided' });

    const cleanText = filterLegalText(statementText);
    
    if (!cleanText || cleanText.split('\n').length < 3) {
      console.error('Too few transactions found. Raw length:', statementText.length, 'Clean length:', cleanText.length);
      return res.status(400).json({ error: "We couldn't find clear transactions in that file. Please check it's a bank statement." });
    }

    const report = await analyzeWithFaro(cleanText, apiKey, userName || 'friend');
    report._txCount = cleanText.split('\n').filter(l => l.trim()).length;

    return res.status(200).json({ success: true, report });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

async function analyzeWithFaro(transactionText, apiKey, userName) {
  const prompt = `You are Faro — a behavioral psychologist who specializes in our relationship with money. Your work draws on Morgan Housel's "Psychology of Money" and Daniel Kahneman's research. Your voice is warm, curious, grounded — like a trusted therapist who happens to understand finances.

The person you're helping is named ${userName}. Speak to them by name occasionally — naturally, not constantly.

You are receiving raw transaction text from a bank statement. Each line typically contains a date, merchant or transfer description, and dollar amount. Focus on the actual transactions; ignore any leftover headers or fragments.

CORE PRINCIPLE: Money behavior reveals psychology. Surface the WHY behind the spending. Every pattern points to a deeper need: comfort, status, connection, control, escape, identity, care for others, security, novelty, belonging.

TONE RULES:
- Speak TO the person ("you")
- Warm, curious, slightly literary
- Forbidden words: "overspending", "bad habits", "wasted", "too much", "concerning", "problem", "discipline", "willpower"
- Preferred framing: "I noticed", "there's something tender here", "this points to", "your relationship with..."
- Reframe behaviors as adaptive, not dysfunctional

ANALYSIS — five lenses:
1. THE ARCHETYPE — Pick ONE: "The Caretaker", "The Comfort Seeker", "The Builder", "The Explorer", "The Protector", "The Connector", "The Striver", "The Survivor"
2. THE PATTERN — Behavioral loops visible
3. THE EMOTIONAL READ — What money says about inner life
4. THE STRENGTH — What's quietly working
5. THE GROWTH EDGE — One gentle invitation

Transaction data:
${transactionText}

Return ONLY valid JSON:
{
  "period": "Month Year",
  "bank": "Bank name",
  "userName": "${userName}",
  "archetype": {
    "name": "<archetype>",
    "tagline": "<warm sentence>",
    "evidence": "<2 sentences citing actual transactions>"
  },
  "habitScore": <0-100>,
  "level": <1-7>,
  "levelTitle": "<Awakening|Noticing|Aligning|Building|Flourishing>",
  "xpEarned": <50-200>,
  "streakInsight": "<one sentence>",
  "diagnosisHeadline": "<warm, literary, quote-worthy>",
  "diagnosisBody": "<2-3 sentences, reframe data as human pattern>",
  "cashFlow": {
    "income": <number>, "spent": <number>, "sentToOthers": <number>, "net": <number>,
    "status": "surplus|deficit|breakeven",
    "runwayMessage": "<kind sentence>"
  },
  "metrics": {
    "totalSpent": <number>, "totalIncome": <number>, "totalTransactions": <integer>,
    "avgTransaction": <number>, "sentToOthers": <number>
  },
  "behavioralPatterns": [
    { "icon": "ritual|comfort|care|reactive|protective|growth|exploration", "title": "<short>", "evidence": "<merchant/amount>", "meaning": "<warm reveal>" }
  ],
  "categories": [
    { "name": "<specific>", "amount": <number>, "color": "<hex>", "transactionCount": <integer>, "topMerchants": ["<merchant $X>"], "behavioralNote": "<emotional purpose>" }
  ],
  "strengthsNoticed": [
    { "title": "<what's working>", "body": "<warm acknowledgment>" }
  ],
  "growthEdge": {
    "headline": "<the invitation>",
    "body": "<2-3 sentences>",
    "experiment": "<tiny experiment for this week>"
  },
  "quests": [
    { "title": "<game-like quest>", "description": "<warm framing>", "xp": <25-100>, "difficulty": "Gentle|Real|Bold", "icon": "🌱|🔥|✨|💫|🌊|🪞|🎯" }
  ],
  "closingWarmth": "<one sentence, name them>"
}

Rules: 5-7 categories, colors from #C8692D, #B0791B, #4C7159, #2E6B94, #A14556, #6B5D8F, #888780. 3-4 patterns. 2-3 strengths. Exactly 3 quests. Plain numbers. Internal transfers don't count.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
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
    console.error('JSON parse failed. Raw:', raw.substring(0, 500));
    throw new Error(`Analysis returned invalid JSON: ${parseErr.message}`);
  }
}
