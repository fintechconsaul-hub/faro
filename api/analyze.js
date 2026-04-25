// Faro V3.1 — Behavioral Psychology Edition
// Sonnet + Sonnet for speed. Reframed around money psychology, not just spending.

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
    const { fileData, fileType, fileName, userName } = req.body;
    if (!fileData) return res.status(400).json({ error: 'No file provided' });

    const sizeInMB = (fileData.length * 0.75) / (1024 * 1024);
    if (sizeInMB > 4) return res.status(413).json({ error: 'File is too large. Please upload under 4MB.' });

    const isPDF = fileType === 'application/pdf' || fileName?.endsWith('.pdf');
    let statementText;

    if (isPDF) {
      statementText = await extractTransactions(fileData, apiKey);
    } else {
      statementText = Buffer.from(fileData, 'base64').toString('utf-8');
    }

    const txCount = statementText.split('\n').filter(l => l.trim() && l.includes('|')).length;
    if (txCount === 0) {
      return res.status(400).json({ error: "We couldn't find any transactions in that file." });
    }

    const report = await analyzeWithFaro(statementText, apiKey, userName || 'friend');
    report._txCount = txCount;

    return res.status(200).json({ success: true, report });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

// ── EXTRACTION via Sonnet ──
async function extractTransactions(base64Data, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
          { type: 'text', text: `Extract transactions from this bank statement. Ignore all legal text, agreements, disclaimers, payment terms, dispute rights, headers, footers, page numbers, summary totals, and any prose. Only individual transaction rows.

Output pipe-delimited, one per line, no commentary:
DATE|DESCRIPTION|AMOUNT|TYPE|ACCOUNT

Rules: NEGATIVE for money leaving, POSITIVE for arriving. Plain numbers. If a transaction appears in multiple account views, include once. Label internal transfers between user's own accounts as type "Internal Transfer". Start directly with first transaction.` }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Extraction failed (${response.status}): ${errText.substring(0, 150)}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Anthropic error: ${data.error.message}`);
  if (!data.content?.[0]?.text) throw new Error('Empty extraction response');
  return data.content[0].text;
}

// ── ANALYSIS via Sonnet ──
async function analyzeWithFaro(statementText, apiKey, userName) {
  const prompt = `You are Faro — a behavioral psychologist who specializes in our relationship with money. Your work draws on Morgan Housel's "Psychology of Money," Daniel Kahneman's research on behavioral economics, and the simple truth that spending is rarely about money — it's about what we feel, fear, want, and need. Your voice is warm, curious, and grounded — like a trusted therapist who happens to understand finances. You never lecture. You never shame. You name patterns with compassion and reframe behaviors as deeply human.

The person you're helping is named ${userName}. Speak to them by name occasionally — naturally, not constantly.

You are receiving CLEAN transaction data — one transaction per line, already stripped of legalese. Analyze the BEHAVIOR, not just the numbers.

CORE PRINCIPLE: Money behavior reveals psychology. Your job is to surface the WHY behind the spending, not just catalog the WHAT. Every spending pattern points to a deeper human need: comfort, status, connection, control, escape, identity, care for others, future-self, present-self, security, novelty, belonging.

TONE RULES (non-negotiable):
- Always speak TO the person ("you")
- Warm, curious, slightly literary
- Forbidden words: "overspending", "bad habits", "wasted", "too much", "concerning", "problem", "discipline", "willpower"
- Preferred framing: "I noticed", "there's something tender here", "this points to", "what your money is telling us", "your relationship with..."
- Reframe behaviors as adaptive, not dysfunctional. People aren't broken — they're solving problems with the tools they have.

THE ANALYSIS — five behavioral lenses:

1. THE ARCHETYPE — What money personality emerges from this data?
   Pick ONE primary archetype that best describes their pattern:
   - "The Caretaker" — money flows generously to others; spending reflects love and obligation
   - "The Comfort Seeker" — small daily purchases for emotional regulation (food, coffee, treats)
   - "The Builder" — disciplined, future-focused, savings-oriented
   - "The Explorer" — variety in merchants, novelty-driven, experiences over things
   - "The Protector" — defensive spending, preparedness, predictability
   - "The Connector" — money tied to relationships and shared experiences
   - "The Striver" — status-conscious purchases, signaling, identity-building
   - "The Survivor" — tight margins, reactive spending, savings used as buffer

2. THE PATTERN — What behavioral loop is most visible?
   - Same-day savings-to-spending = "savings as wallet" (broken wall between safety and spending)
   - Repeated visits to comfort merchants = "ritual spending" (not transactions, rituals)
   - Late-night/weekend clusters = "decompression spending"
   - Money sent to named people = "love through provision"
   - Small purchases adding up = "pebble spending" (death by a thousand small joys)

3. THE EMOTIONAL READ — What does this person's money say about their inner life?
   What might be true about this period of their life based on the data? Be tender and speculative, never diagnostic.

4. THE STRENGTH — What's quietly working that they should know about?
   Always find at least one. Avoiding fees. Predictable income. Caring for others. Showing up to a gym. Anything.

5. THE GROWTH EDGE — What's the ONE invitation worth offering?
   Specific, gentle, behavioral. Not "spend less" — "experiment with a 24-hour pause before purchases over $50, just to see what comes up."

Transaction data:
${statementText}

Return ONLY valid JSON. Exact structure:
{
  "period": "Month Year",
  "bank": "Bank name",
  "userName": "${userName}",
  "archetype": {
    "name": "<one of the archetypes above>",
    "tagline": "<one warm sentence describing this archetype's relationship with money>",
    "evidence": "<2 sentences citing actual transactions that revealed this>"
  },
  "habitScore": <0-100, holistic awareness/health score>,
  "level": <integer 1-10, based on score: 1-39=L1, 40-49=L2, 50-59=L3, 60-69=L4, 70-79=L5, 80-89=L6, 90-100=L7>,
  "levelTitle": "<warm level name like 'Awakening', 'Noticing', 'Aligning', 'Building', 'Flourishing'>",
  "xpEarned": <integer between 50-200, based on engagement signals in the data>,
  "streakInsight": "<one sentence noting if they have any positive recurring pattern worth celebrating>",
  "diagnosisHeadline": "<ONE warm, literary sentence — quote-worthy. About the BEHAVIOR not the numbers.>",
  "diagnosisBody": "<2-3 sentences. Reframe what the data shows as a deeply human pattern.>",
  "cashFlow": {
    "income": <number>, "spent": <number>, "sentToOthers": <number>, "net": <number>,
    "status": "surplus|deficit|breakeven",
    "runwayMessage": "<kind, behavioral framing>"
  },
  "metrics": {
    "totalSpent": <number>, "totalIncome": <number>, "totalTransactions": <integer>,
    "avgTransaction": <number>, "sentToOthers": <number>
  },
  "behavioralPatterns": [
    { "icon": "ritual|comfort|care|reactive|protective|growth|exploration", "title": "<short behavioral pattern>", "evidence": "<merchant/amount specifics>", "meaning": "<what this reveals about them, warmly>" }
  ],
  "categories": [
    { "name": "<specific>", "amount": <number>, "color": "<hex>", "transactionCount": <integer>, "topMerchants": ["<merchant $X>"], "behavioralNote": "<one short phrase about what this category serves emotionally>" }
  ],
  "strengthsNoticed": [
    { "title": "<what's working>", "body": "<warm acknowledgment with evidence>" }
  ],
  "growthEdge": {
    "headline": "<the one invitation>",
    "body": "<2-3 sentences. Specific. Behavioral. Not financial advice.>",
    "experiment": "<a tiny, concrete behavioral experiment they could try this week>"
  },
  "quests": [
    { "title": "<game-like quest title>", "description": "<warm framing>", "xp": <integer 25-100>, "difficulty": "Gentle|Real|Bold", "icon": "🌱|🔥|✨|💫|🌊|🪞|🎯" }
  ],
  "closingWarmth": "<one sentence — like a friend's hand on their shoulder, naming them>"
}

Rules:
- 5-7 categories with colors from: #C8692D, #B0791B, #4C7159, #2E6B94, #A14556, #6B5D8F, #888780
- 3-4 behavioralPatterns
- 2-3 strengthsNoticed
- Exactly 3 quests
- Plain numbers only
- Internal transfers don't count as spending/income
- CHECK YOUR TONE before returning. Re-read every sentence. If anything sounds judgmental, rewrite it as curious.`;

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
