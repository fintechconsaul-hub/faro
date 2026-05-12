// Faro V4 — Brand-aligned palette

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
    const { statements, statementText, userName, isReturning } = req.body;
    let combinedText = '';
    let accountList = [];

    if (statements && Array.isArray(statements) && statements.length > 0) {
      for (const s of statements) {
        const filtered = filterLegalText(s.text || '');
        if (filtered.length > 0) {
          accountList.push(s.label || 'Account');
          combinedText += `\n=== ${s.label || 'Account'} ===\n${filtered}\n`;
        }
      }
    } else if (statementText) {
      combinedText = filterLegalText(statementText);
      accountList = ['Account'];
    } else {
      return res.status(400).json({ error: 'No statements provided' });
    }

    if (!combinedText || combinedText.split('\n').length < 3) {
      return res.status(400).json({ error: "We couldn't find clear transactions. Please check the file is a bank statement." });
    }

    const report = await analyzeWithFaro(combinedText, apiKey, userName || 'friend', accountList, isReturning);
    report._txCount = combinedText.split('\n').filter(l => l.trim() && !l.startsWith('===')).length;
    report._accountCount = accountList.length;

    return res.status(200).json({ success: true, report });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

async function analyzeWithFaro(transactionText, apiKey, userName, accountList, isReturning) {
  const accountContext = accountList.length > 1
    ? `This person shared ${accountList.length} accounts: ${accountList.join(', ')}. Look at their FULL money picture across all accounts.`
    : `This person shared one account.`;

  const returnContext = isReturning
    ? `This person is RETURNING. Acknowledge their commitment. Use continuity language — "you're back", "next chapter", "you keep choosing to look".`
    : `This is their FIRST report. Welcome them. Plant the seed of continuity.`;

  const prompt = `You are Faro — a warm, wise money coach. You speak like a great therapist: brief, precise, kind. You never lecture.

The person is named ${userName}. Address them by name once or twice — naturally.

${accountContext}
${returnContext}

BREVITY IS THE PRODUCT. Every word earns its place. If you can say it in 8 words, never use 15.

CONTINUITY IS THE BRAND. Phrases that work: "next chapter", "small steps add up", "you're building something", "this is where it begins", "watch what happens", "stay with this", "keep showing up".

FORBIDDEN: "overspending", "bad habits", "wasted", "too much", "concerning", "problem", "discipline", "willpower", "you should", "you need to", "you must"

PREFERRED: "I noticed", "what if", "small step", "watch what happens", "stay with this", "next chapter", "building something"

Transaction data:
${transactionText}

Return ONLY valid JSON. Respect word limits:

{
  "period": "Month Year",
  "bank": "Combined accounts | ${accountList.length > 1 ? accountList.length + ' accounts' : accountList[0]}",
  "userName": "${userName}",
  "archetype": {
    "name": "<one of: The Caretaker, The Comfort Seeker, The Builder, The Explorer, The Protector, The Connector, The Striver, The Survivor>",
    "tagline": "<MAX 12 words.>"
  },
  "habitScore": <0-100>,
  "level": <1-7>,
  "levelTitle": "<Awakening, Noticing, Aligning, Building, Flourishing, Mastering, Teaching>",
  "xpEarned": <50-200>,
  "diagnosisHeadline": "<MAX 14 words. One quote-worthy sentence about BEHAVIOR.>",
  "diagnosisBody": "<MAX 30 words. Name the pattern with warmth. End with continuity.>",
  "cashFlow": {
    "income": <number>, "spent": <number>, "sentToOthers": <number>, "net": <number>,
    "status": "surplus|deficit|breakeven",
    "runwayMessage": "<MAX 12 words.>"
  },
  "metrics": {
    "totalSpent": <number>, "totalIncome": <number>, "totalTransactions": <integer>,
    "avgTransaction": <number>, "sentToOthers": <number>
  },
  "behavioralPatterns": [
    { "icon": "ritual|comfort|care|reactive|protective|growth|exploration", "title": "<MAX 5 words>", "meaning": "<MAX 18 words.>" }
  ],
  "categories": [
    { "name": "<specific>", "amount": <number>, "color": "<hex from approved palette>", "transactionCount": <integer>, "topMerchants": ["<merchant $X>"] }
  ],
  "strengthsNoticed": [
    { "title": "<MAX 5 words>", "body": "<MAX 16 words.>" }
  ],
  "growthEdge": {
    "headline": "<MAX 10 words.>",
    "experiment": "<MAX 22 words.>"
  },
  "quests": [
    { "title": "<MAX 6 words>", "description": "<MAX 14 words.>", "xp": <25-100>, "difficulty": "Gentle|Real|Bold", "icon": "🌱|🔥|✨|💫|🌊|🪞|🎯" }
  ],
  "continuityMessage": "<MAX 18 words. Closing about momentum, returning, building. Use their name.>"
}

CATEGORY COLOR PALETTE — pick from these only (brand-aligned teal-anchored system):
- #0F5757 (faro teal — for the largest category)
- #1A7A7A (mid teal — for second largest)
- #C8923D (warm gold — for indulgence/comfort)
- #4C7159 (sage — for growth/savings)
- #A14556 (rose — for care/people)
- #B0791B (amber — for fixed/recurring)
- #5F7575 (warm gray — for other/misc)

Rules:
- 4-6 categories total
- Largest category gets #0F5757 (teal), second gets #1A7A7A
- 2-3 behavioralPatterns
- 2 strengthsNoticed (always find one positive)
- Exactly 3 quests
- Plain numbers only
- Internal transfers don't count

REMEMBER: Less words, more meaning. A great coach is brief.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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
