# Faro Brand System v1.0
*The complete identity guide for building trust at every touchpoint.*

---

## Brand Foundations

### Mission
Faro helps people understand the psychology behind their money — so they can build healthier financial habits, gently, over time.

### Brand Archetype
**Sage + Caregiver** — the most trust-building archetype combination in financial services. The Sage brings intellectual credibility (we understand your money on a deeper level). The Caregiver brings emotional safety (we will never judge you).

### Brand Promise
*"The lighthouse that helps you understand your money mind."*

### Voice Pillars
- **Wise, not preachy** — we share insight, not opinion
- **Warm, not casual** — we're caring, but we're also serious
- **Brief, not terse** — every word earns its place
- **Continuous, not episodic** — we speak about building something over time

---

## Color System (Tiered)

Based on the **Fintech Color Trust Hierarchy** — each color has a job. Use each color for its job, consistently.

### Tier 1: Anchor — Deep Teal
The dominant color. Used on logo, headers, primary surfaces, primary buttons. Combines blue's trustworthiness with green's growth associations. More distinctive than navy. Recommended in research for fintech startups targeting people underserved by traditional financial advisors.

```
--faro-deep:        #0B3D3D    /* Logo, hero gradients, dark surfaces */
--faro:             #0F5757    /* Primary brand color */
--faro-mid:         #1A7A7A    /* Hover states, accents */
--faro-bright:      #3FA8A8    /* Bright accents, focus rings */
--faro-soft:        #E1F0F0    /* Soft backgrounds, subtle fills */
--faro-glow:        #F4FAFA    /* Lightest surface */
```

### Tier 2: Action — Warm Gold + Sage
Action colors guide behavior without creating anxiety. Used on CTAs, success states, completed actions.

```
--gold:             #C8923D    /* Gentle action, achievement */
--gold-soft:        #FAF1DC    /* Achievement backgrounds */
--sage:             #4C7159    /* Positive states, "doing well" */
--sage-soft:        #E8EFE9    /* Success backgrounds */
```

### Tier 3: Signal — Rose + Amber
Signal colors flag attention without alarm. Used very sparingly, only when something genuinely matters.

```
--rose:             #A14556    /* Concern, never alarm */
--rose-soft:        #F7E8EB    /* Soft attention backgrounds */
--amber:            #B0791B    /* Notice, gentle warning */
--amber-soft:       #F7EEDA    /* Notice backgrounds */
```

### Tier 4: Neutral — The Foundation
The whites and warm grays that make everything else readable.

```
--bg:               #FAFAF7    /* Page background — warm white */
--surface:          #FFFFFF    /* Cards, primary surfaces */
--surface-warm:     #FDFAF5    /* Secondary surfaces */
--ink:              #0A1F1F    /* Primary text — almost-black with teal undertone */
--ink-2:            #2A3F3F    /* Secondary text */
--ink-3:            #5F7575    /* Tertiary text */
--ink-4:            #94A8A8    /* Disabled, very subtle */
--line:             rgba(11,61,61,0.08)   /* Subtle dividers */
--line-2:           rgba(11,61,61,0.14)   /* Stronger dividers */
```

### Color Usage Rules

1. **Teal is dominant.** Every screen should feel anchored by teal. If you remove the teal accents and the screen still looks teal-leaning, you've done it right.
2. **One signal color per screen, max.** Never combine rose and amber on the same view. Trust comes from calm consistency.
3. **Gold for action, sage for affirmation, teal for navigation.** Don't mix these jobs.
4. **Backgrounds breathe.** Default to white or warm white. Color appears on purpose, not by default.
5. **Dark mode is teal too.** When dark mode arrives in V4, the dark surfaces will be `--faro-deep` (#0B3D3D), not pure black. Stay on-brand even in shadow.

---

## Typography System

### Type Pairing — Fraunces + Inter
**Fraunces** is the brand serif. Modern, slightly literary, warmly authoritative. It carries the "wise advisor" half of the archetype. Use for: logos, headers, scores, quotes, archetype names, anywhere we want gravity.

**Inter** is the brand sans. Open, clean, professional. Carries the "trustworthy partner" half. Use for: body text, UI labels, buttons, data, anywhere we want clarity.

### Type Scale

```
Display:          Fraunces 500 · 42px · -1.5px tracking      (logo, hero only)
Display 2:        Fraunces 500 · 32px · -0.8px tracking      (archetype names)
Title:            Fraunces 500 · 24px · -0.5px tracking      (section heros)
Subtitle:         Fraunces 500 · 18px · -0.3px tracking      (section headers)
Quote:            Fraunces 500 italic · 18px                 (diagnosis quotes)

Body:             Inter 400 · 14px · 1.6 line-height         (main body text)
Body-sm:          Inter 400 · 13px · 1.55                    (secondary body)
Caption:          Inter 500 · 11px · 0.4px letter-spacing    (labels, metadata)
Microlabel:       Inter 600 · 10px · 0.8px uppercase         (kickers, badges)

Number-display:   Fraunces 500 · 32px                        (big totals)
Number:           Fraunces 600 · 16px                        (inline amounts)
```

### Typography Rules

1. **Fraunces is for moments. Inter is for movement.** Headers and emotional beats in Fraunces. Everything functional in Inter.
2. **Numbers feel different in serif.** Money amounts always in Fraunces — it makes them feel weightier, more considered, more honest.
3. **Letter spacing matters at small sizes.** Anything 11px or smaller gets positive letter-spacing for readability.
4. **No more than 3 sizes per screen.** Restraint reads as confidence.

---

## Logo System

### Primary Logo
The wordmark `faro.` in Fraunces 500 with the period in `--faro-mid` (#1A7A7A). The period is the dot that punctuates — a tiny visual signature.

### Beacon Mark
A stylized lighthouse: glow, top, base. Three stacked elements suggesting light, focus, foundation. Used alongside the wordmark on splash screens and standalone in tight spaces.

```
beacon-glow:  ellipse, 24×11, #7FD0D0 (light teal)
beacon-top:   rectangle, 15×8, #1A7A7A (mid teal)
beacon-base:  rectangle, 9×18, #0F5757 (primary teal)
```

### Clear Space
Always at least the height of the logo's x-height around it. Never crowd. Restraint reads as confidence.

### Usage
- On light backgrounds: dark teal logo
- On dark teal: white logo
- On photography: white logo with subtle drop shadow
- Never on busy backgrounds. Never with effects. Never tilted.

---

## Voice & Tone

### Voice Principles
1. **Notice, don't diagnose.** "I noticed you visited Eataly five times" not "You're overspending on food."
2. **Invite, don't instruct.** "What if you tried..." not "You should..."
3. **Acknowledge the human.** Behavior is data plus a person. We always see both.
4. **Continuity language.** Talk about building, returning, next chapters, small steps adding up.
5. **Brevity is care.** Long explanations exhaust. A great coach says less.

### Word List

**Use these:**
- noticed · what if · stay with this · small step · next chapter · building · honest · gentle · warm · curious · pattern · invitation · experiment · showing up · together

**Never these:**
- overspending · bad habit · wasted · too much · concerning · problem · discipline · willpower · you should · you need to · you must · failed · poor

### Tone Calibration by Context

| Context | Tone | Example |
|---|---|---|
| First report | Welcoming, curious | "This is where it begins. Let's look together." |
| Returning user | Acknowledging, building | "Welcome back. 3 reports in. Keep showing up." |
| Surplus month | Quiet pride, momentum | "You're building something here." |
| Deficit month | Gentle honesty, never alarm | "The math is tight this month. We see you." |
| New pattern noticed | Curious, never alarming | "There's something tender here..." |
| Strength to celebrate | Warm, specific | "You did something worth honoring." |

---

## Layout & Spacing

### Spacing Scale (8-point grid)
```
4px   — tight relationships (icon to label)
8px   — within a component
12px  — between related components
16px  — within a section
24px  — between sections
32px  — between section groups
48px  — major breaks
```

### Container Widths
- Mobile: full-width with 16px gutter
- Tablet: 680px max width
- Desktop: 720px max width (we never sprawl — focus = trust)

### Border Radius
```
--r-sm:   8px    /* Tight UI elements */
--r:      12px   /* Standard cards, inputs */
--r-lg:   18px   /* Hero cards, sections */
--r-xl:   24px   /* Major containers */
--r-pill: 999px  /* Buttons, badges */
```

### Shadow System
```
--shadow-sm:  0 1px 2px rgba(11,61,61,0.04)                              /* Tiny lift */
--shadow:     0 4px 16px rgba(11,61,61,0.04), 0 1px 2px rgba(11,61,61,0.03)  /* Card lift */
--shadow-lg:  0 10px 30px rgba(11,61,61,0.06), 0 2px 6px rgba(11,61,61,0.03) /* Major lift */
```

---

## Interaction Principles

1. **Every action gets feedback within 100ms.** Trust dies in silence.
2. **Loading states are intentional, not apologetic.** We say "Listening carefully," not "Please wait."
3. **Animations are gentle.** 200-300ms ease-out for most things. Never bouncy. Trust isn't playful.
4. **Hover states are subtle.** A slight lift, a color shift, never a transformation.
5. **Errors are kind.** "We couldn't read that file" not "Error 4007."

---

## Accessibility Commitments

1. **WCAG AA contrast on every text/background pair.** Verified.
2. **Color is never the only signal.** Icons + text reinforce status.
3. **Focus rings always visible.** A 3px ring in `--faro-bright`.
4. **Keyboard navigation works everywhere.** Test by unplugging your mouse.
5. **Reduced motion respected.** `prefers-reduced-motion` disables animation.

---

## Mobile-First Principles

1. **Thumb zones matter.** Primary actions in the bottom third of the screen on mobile.
2. **Touch targets 44×44 minimum.** Always.
3. **Text is readable without zoom.** Body text 14px minimum on mobile.
4. **One-column always.** Never side-by-side on small screens.
5. **Native feel.** Use `safe-area-inset` to respect notches and home bars.

---

## Trust Signals — The Invisible Brand

These appear throughout the product as quiet trust-building cues:

- **"Never stored" badge** wherever data enters the app
- **Lock icon next to anything sensitive**
- **Plain-language privacy statements** instead of legalese
- **"This is what we see" disclosure** before every analysis
- **No dark patterns ever.** No forced subscriptions. No hidden cancellations. No buried unsubscribes.
- **Honest loading states.** "Reading your story" tells the truth about what we're doing.
- **Continuity language** signals we're a relationship, not a transaction.

---

## Marketing Application

### Tagline System

**Primary tagline:** *Understand your money mind.*

**Secondary taglines** (rotating, by context):
- *The psychology of your money, gently revealed.*
- *Where your money goes is who you are.*
- *Small steps. Every month. Together.*

### Email Sender Name
Always: **Faro** (never "noreply" or "team@")

### Social Profile Templates
- **Twitter/X:** `@thefaroapp` — share one money-psychology insight per day
- **Instagram:** `@faro.app` — visual carousels of behavioral patterns
- **TikTok:** `@faro.app` — short founder explanations of psychology of money

### Tone Across Channels
The voice is consistent. The format adapts. On social, Faro is briefer. In email, slightly warmer. In-product, focused. But the underlying voice — wise, warm, brief, building — never changes.

---

## What Faro Never Does

- Never sends "we miss you" emails — that's manipulation
- Never auto-charges without consent
- Never gamifies in ways that pressure or shame
- Never compares one user to another
- Never claims to be a financial advisor
- Never shares user data with anyone, ever
- Never uses fear of missing out
- Never speaks down to users

---

## The 30-Second Brand Test

A new user lands on Faro for the first time. In 30 seconds, can they answer these?

1. **What is this?** A money psychology app, gently revealing patterns
2. **Can I trust it?** Yes — visual calm, plain language, "never stored" promise
3. **Is it for me?** Yes — warm welcome, no jargon, no shame
4. **What do I do next?** Upload a statement, see what they notice

If yes to all four, the brand is working.
