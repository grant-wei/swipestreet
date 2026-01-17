"""
SwipeStreet Card Generator v2
Converts Bernstein research into tweet-sized learning cards
Format: Fact + Context + Implication
"""

import json
import uuid
import re
import os
from pathlib import Path
from datetime import datetime

# Load API key from proxera .env if not in environment
def load_api_key():
    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]

    # Try loading from proxera .env
    proxera_env = Path("C:/Github/proxera/.env")
    if proxera_env.exists():
        with open(proxera_env, 'r') as f:
            for line in f:
                if line.startswith("ANTHROPIC_API_KEY="):
                    key = line.strip().split("=", 1)[1]
                    os.environ["ANTHROPIC_API_KEY"] = key
                    return key
    return None

api_key = load_api_key()

try:
    from anthropic import Anthropic
    if api_key:
        client = Anthropic(api_key=api_key)
        HAS_ANTHROPIC = True
    else:
        client = None
        HAS_ANTHROPIC = False
except:
    HAS_ANTHROPIC = False
    client = None

# Paths
BASE_DIR = Path(__file__).parent.parent
TRAINING_DIR = BASE_DIR / "training_data"
SOURCES_DIR = TRAINING_DIR / "sources"
DATA_DIR = SOURCES_DIR / "bernstein"  # Primary source (legacy JSON)
CUSTOM_DIR = SOURCES_DIR / "custom"   # User-added sources
EXTRACTED_DIR = TRAINING_DIR / "extracted"  # New: extracted chunks
OUTPUT_DIR = BASE_DIR / "content" / "cards"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CARD_PROMPT = """Convert this research into 1-2 educational investing lessons.

PURPOSE: Teach investors timeless principles through real examples. Focus on HIGH-LEVEL IDEAS that transfer across sectors and time periods.

CARD FORMAT:
Write 3-4 flowing sentences that:
1. State the investing principle clearly
2. Show how the research illustrates it
3. End with what investors should remember

Do NOT use labels like "THE LESSON:" or "THE EXAMPLE:" - just write naturally.

CARD TYPES:
- lesson: a timeless investing principle with example
- pattern: a recurring market pattern to recognize
- framework: a mental model for analyzing investments

RULES:
- Use proper grammar and complete sentences
- 3-4 sentences, 60-120 words
- No hedging language (remove "may", "could", "potentially")
- No research jargon or meta-commentary
- Focus on the PRINCIPLE, not the specific company/sector
- Each card should teach something applicable to other situations

AVOID:
- Specific prices, multiples, or market caps
- Company-specific details that won't age well
- Jargon that requires finance background

CATEGORIES (pick 1-2):
- Valuation: how to think about price vs value
- Moats: identifying sustainable advantages
- Psychology: behavioral errors and biases
- Business Models: how companies create value
- Capital Allocation: management decisions
- Cycles: recognizing patterns over time

RESEARCH:
Title: {title}
Content: {content}

Return JSON array only:
[{{"type": "lesson|pattern|framework", "content": "...", "tickers": [], "categories": ["Valuation", "Moats"]}}]

Keep the JSON simple - no expanded field in the response.
"""

# Valid categories
VALID_CATEGORIES = ["Valuation", "Moats", "Psychology", "Business Models", "Capital Allocation", "Cycles", "Data"]


def clean_text(text: str) -> str:
    """Clean research text."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'Exhibit \d+', '', text)
    text = re.sub(r'For the exclusive use of.*?on \d+-\w+-\d+', '', text)
    text = re.sub(r'Source:.*?(?=\.|$)', '', text)
    return text.strip()


def extract_numbers(text: str) -> list:
    """Extract compelling numbers from text."""
    patterns = [
        r'(\d+(?:\.\d+)?%)',  # percentages
        r'(\$\d+(?:\.\d+)?(?:\s*(?:billion|million|bn|mn|B|M))?)',  # dollar amounts
        r'(\d+(?:\.\d+)?x)',  # multiples
        r'(\d+(?:\.\d+)?(?:\s*(?:billion|million|bn|mn)))',  # amounts
    ]
    numbers = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        numbers.extend(matches)
    return numbers[:3]


def remove_hedging(text: str) -> str:
    """Remove hedging language."""
    hedges = [
        r'\bmay\b', r'\bmight\b', r'\bcould\b', r'\bpotentially\b',
        r'\blikely\b', r'\bprobably\b', r'\bpossibly\b', r'\bperhaps\b',
        r'\bseems to\b', r'\bappears to\b', r'\btends to\b',
        r'\bin our view\b', r'\bin our opinion\b',
    ]
    for hedge in hedges:
        text = re.sub(hedge, '', text, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', text).strip()


def clean_prose(text: str) -> str:
    """Clean up research language while preserving proper grammar."""
    # Remove research meta-language
    removals = [
        r'^we believe that\s*', r'^we believe\s*', r'^we think that\s*',
        r'^we think\s*', r'^we expect that\s*', r'^we expect\s*',
        r'^our view is that\s*', r'^it is important to note that\s*',
        r'^importantly,?\s*', r'^critically,?\s*',
        r'^in conclusion,?\s*', r'^the bottom line is that\s*',
        r'^the key (insight|point|takeaway) is that\s*',
    ]
    for pattern in removals:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # Clean up spacing
    text = re.sub(r'\s+', ' ', text).strip()

    # Ensure first letter is capitalized
    if text:
        text = text[0].upper() + text[1:]

    return text


def is_complete_card(text: str) -> bool:
    """Check if card is a complete, well-formed thought."""
    text = text.strip()

    # Must end with proper punctuation
    if not text.endswith(('.', '!', '?')):
        return False

    # Reject truncated content
    if text.endswith('...') or '...' in text[-20:]:
        return False

    # Reject cards with obvious cut-offs
    bad_endings = [
        'such as', 'including', 'for example', 'e.g.', 'i.e.',
        'which', 'that', 'and', 'or', 'but', 'the', 'a', 'an',
        'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
    ]
    # Check last word before punctuation
    words = text.rstrip('.!?').split()
    if words and words[-1].lower() in bad_endings:
        return False

    # Must have at least 2 sentences for context
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if s.strip()]
    if len(sentences) < 2:
        return False

    # Reject repetitive/malformed text
    if re.search(r'\b(\w+)\s+\1\b', text):  # repeated words
        return False

    # Reject obvious research fragments
    research_fragments = [
        'current estimates the current',
        'the understanding of',
        'entities such as',
        'consultancies',
        'volumes are wrong',
    ]
    for frag in research_fragments:
        if frag in text.lower():
            return False

    return True


def generate_expanded_content(card_content: str, category: str, card_type: str, source_content: str = "") -> str:
    """Generate expanded deep dive content for a card using AI."""

    if HAS_ANTHROPIC and client:
        try:
            deep_dive_prompt = f"""You are writing the "deep dive" section for a financial learning app. The user has seen a brief insight and tapped to learn more.

ORIGINAL INSIGHT:
{card_content}

CATEGORY: {category}

Write 3-4 paragraphs that:
1. EXPLAIN the underlying principle - why does this pattern exist? What economic or psychological forces drive it?
2. GIVE A CONCRETE EXAMPLE - describe a real historical case where this played out (use real companies/events)
3. TEACH HOW TO APPLY IT - what should an investor look for? What questions should they ask?

RULES:
- Write in clear, educational prose
- No bullet points or lists
- Use specific examples and numbers where helpful
- Assume the reader is intelligent but not a finance expert
- Each paragraph should be 2-3 sentences
- Total length: 150-200 words

Return ONLY the paragraphs, no headers or labels."""

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": deep_dive_prompt}]
            )

            expanded = response.content[0].text.strip()
            if len(expanded) > 100:
                return expanded
        except Exception as e:
            print(f"Deep dive generation error: {e}")

    # Fallback to templated content
    principles = {
        "Valuation": "Valuation is ultimately about comparing what you pay to what you get. Markets frequently misprice assets when they extrapolate recent trends too far into the future, or when they fail to account for mean reversion in business fundamentals.",
        "Moats": "Sustainable competitive advantages come from structural barriers that competitors cannot easily replicate. The key is distinguishing between temporary advantages and durable moats that compound over time.",
        "Psychology": "Markets are driven by human behavior, which creates predictable patterns of overreaction and underreaction. Understanding these behavioral biases helps investors recognize when prices deviate from fundamentals.",
        "Business Models": "How a company makes money determines its long-term trajectory. Business model analysis reveals whether current earnings are sustainable and how management decisions affect future cash flows.",
        "Capital Allocation": "How management deploys capital often matters more than the underlying business quality. Great businesses can be destroyed by poor capital allocation, while mediocre businesses can create value through disciplined decisions.",
        "Cycles": "Industries and markets move in cycles that create recurring opportunities. Recognizing where you are in a cycle helps avoid buying at peaks and selling at troughs.",
        "Data": "The right metrics reveal what really drives business performance. Focusing on leading indicators rather than lagging ones helps anticipate changes before they appear in financial statements.",
    }

    applications = {
        "Valuation": "When evaluating investments, compare the current price to historical ranges and peer valuations. Ask what assumptions are embedded in the price, and whether those assumptions are reasonable given the business fundamentals.",
        "Moats": "Look for businesses with pricing power, high switching costs, network effects, or cost advantages. Test the moat by asking: what would it take for a well-funded competitor to replicate this advantage?",
        "Psychology": "Notice when market sentiment becomes extreme in either direction. Ask whether the consensus view is based on facts or on extrapolation of recent events. Variant perceptions often emerge when reality differs from expectations.",
        "Business Models": "Map out how revenue flows through the business and what drives profitability. Consider how industry changes might affect each component of the model, and whether management has flexibility to adapt.",
        "Capital Allocation": "Track management's capital allocation decisions over time. Compare returns on invested capital to the cost of capital, and assess whether acquisitions and investments have created or destroyed value.",
        "Cycles": "Study the historical patterns in the industry and identify the typical cycle length and amplitude. Watch for leading indicators that signal cycle turns, and maintain discipline when cycles stretch longer than expected.",
        "Data": "Identify the 2-3 metrics that most directly drive the investment thesis. Understand what causes these metrics to change, and establish thresholds that would cause you to reassess your view.",
    }

    principle = principles.get(category, principles["Psychology"])
    application = applications.get(category, applications["Psychology"])

    # Build the expanded content
    expanded = f"{principle}\n\n"
    expanded += f"This insight demonstrates these dynamics in practice. The pattern observed here has played out across many different industries and time periods, suggesting it reflects fundamental market behavior rather than a one-time occurrence.\n\n"
    expanded += application

    return expanded


def generate_card_ai(insight: dict) -> list:
    """Generate cards using Claude."""
    if not HAS_ANTHROPIC or not client:
        return generate_card_rules(insight)

    content = clean_text(insight.get("insight", insight.get("view", insight.get("prediction", ""))))
    if len(content) < 30:
        return []

    title = insight.get("title", "")
    categories = insight.get("categories", ["General"])

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": CARD_PROMPT.format(title=title, content=content[:800])
            }]
        )

        text = response.content[0].text.strip()

        # Debug: print first 200 chars of response
        # print(f"DEBUG: {text[:200]}")

        # Parse JSON
        if text.startswith('['):
            cards = json.loads(text)
        elif text.startswith('{'):
            # Single card returned
            cards = [json.loads(text)]
        else:
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                cards = json.loads(match.group())
            else:
                # Try to find a single JSON object
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    cards = [json.loads(match.group())]
                else:
                    return generate_card_rules(insight)

        # Validate
        valid = []
        for card in cards:
            if isinstance(card, dict) and card.get("content"):
                c = card["content"].strip()
                # Ensure first letter is capitalized
                if c:
                    c = c[0].upper() + c[1:]
                # Skip is_complete_card for now - may be too strict
                if len(c) > 30:
                    # Use AI-generated categories, validate against allowed list
                    ai_cats = card.get("categories", [])
                    card_cats = [cat for cat in ai_cats if cat in VALID_CATEGORIES]
                    if not card_cats:
                        card_cats = ["Psychology"]  # Default fallback

                    # Generate expanded content based on card type and category
                    cat = card_cats[0] if card_cats else "Psychology"
                    card_type = card.get("type", "lesson")
                    expanded = generate_expanded_content(c, cat, card_type)

                    valid.append({
                        "id": str(uuid.uuid4())[:8],
                        "type": card.get("type", "lesson"),
                        "content": c,
                        "expanded": expanded,
                        "tickers": card.get("tickers", []),
                        "source": "bernstein",
                        "source_title": title,
                        "categories": card_cats,
                        "created_at": datetime.now().isoformat()
                    })

        return valid if valid else generate_card_rules(insight)

    except Exception as e:
        print(f"AI error: {e}")
        return generate_card_rules(insight)


def generate_card_rules(insight: dict) -> list:
    """Generate cards using rules."""
    raw = insight.get("insight", insight.get("view", insight.get("prediction", "")))
    content = clean_text(raw)
    if len(content) < 40:
        return []

    title = insight.get("title", "")
    categories = insight.get("categories", ["General"])

    # Extract components
    numbers = extract_numbers(content)
    sentences = [s.strip() for s in re.split(r'[.!?]', content) if len(s.strip()) > 15]

    if not sentences:
        return []

    # Build card: find best sentence with a number, add context
    best_sentence = None
    for s in sentences:
        if any(n.lower() in s.lower() for n in numbers):
            best_sentence = s
            break

    if not best_sentence:
        best_sentence = sentences[0]

    # Get a second sentence for context if available
    context_sentence = ""
    for s in sentences:
        if s != best_sentence and len(s) > 20:
            context_sentence = s
            break

    # Combine and clean
    if context_sentence:
        card_text = f"{best_sentence}. {context_sentence}"
    else:
        card_text = best_sentence

    card_text = clean_prose(remove_hedging(card_text))

    # Truncate smartly - but only at sentence boundaries
    if len(card_text) > 280:
        parts = card_text.split('. ')
        card_text = parts[0] + '.'
        if len(card_text) > 280:
            # Can't truncate cleanly, skip this card
            return []

    # Determine type
    card_type = "insight"
    lower = content.lower()
    if any(w in lower for w in ["contrary", "unlike", "wrong", "disagree", "consensus", "miss"]):
        card_type = "contrarian"
    elif numbers:
        card_type = "stat"
    elif any(w in lower for w in ["because", "driven by", "due to", "works by", "mechanism"]):
        card_type = "mechanic"

    # Extract tickers
    ticker_matches = re.findall(r'\$([A-Z]{2,5})|(?<![a-zA-Z])([A-Z]{2,4})(?:\s+(?:US|LN|GR|FP))', raw)
    tickers = list(set(t[0] or t[1] for t in ticker_matches if t[0] or t[1]))
    skip = {'THE', 'AND', 'FOR', 'ARE', 'WE', 'OUR', 'CEO', 'GDP', 'EPS', 'USD', 'EUR', 'THIS', 'THAT', 'LME', 'WSA'}
    tickers = [t for t in tickers if t not in skip][:3]

    # Skip bad cards
    if len(card_text) < 30:
        return []
    if card_text.startswith(('that ', 'this ', 'it ')):
        # Try to fix orphan starts
        card_text = card_text[card_text.find(' ', 5)+1:] if ' ' in card_text[5:15] else card_text

    # Validate completeness
    if not is_complete_card(card_text):
        return []

    # Map card type to general category
    type_to_category = {
        "contrarian": "Psychology",
        "stat": "Data",
        "mechanic": "Business Models",
        "insight": "Psychology",
    }
    card_cats = [type_to_category.get(card_type, "Psychology")]

    # Generate expanded content based on type (multi-paragraph, proper grammar)
    expanded_templates = {
        "contrarian": "Markets frequently anchor to conventional wisdom long after the underlying reality has changed. This represents a classic case where consensus thinking missed an important shift. When most investors agree on something, it often means the obvious factors are already priced in.\n\nThe outcome here illustrates why variant perception matters in investing. Being right is not enough—you need to be right when others are wrong. The challenge is distinguishing genuine insight from contrarian positioning for its own sake.\n\nTo apply this pattern, look for situations where the consensus relies on stale assumptions or ignores structural changes. Ask yourself: what would need to be true for the consensus to be correct, and is that still the case?",
        "stat": "Data only becomes valuable when placed in proper context. This metric reveals something important about the underlying business dynamics, but only when compared against the right benchmarks. A number in isolation tells you very little.\n\nThe key lesson is that great investors develop frameworks for contextualizing data quickly. They instinctively compare against historical ranges, peer medians, and their own expectations. The signal comes from deviation from these baselines.\n\nWhen evaluating metrics, always ask: Is this above or below historical averages? How does it compare to competitors? What would cause this number to change materially in either direction?",
        "mechanic": "Understanding the mechanics of how businesses actually operate provides an edge over surface-level analysis. Most investors focus on 'what happened' without understanding 'why' it happened. This deeper knowledge enables better predictions.\n\nThe pattern here generalizes beyond this specific example. Once you understand a business mechanism, you can recognize similar dynamics across different industries. Business models often rhyme across sectors and time periods.\n\nTo build this kind of structural knowledge, focus on understanding causation rather than just correlation. Ask how the business creates value, what drives its margins, and what could disrupt its model.",
    }
    expanded = expanded_templates.get(card_type, expanded_templates["mechanic"])

    return [{
        "id": str(uuid.uuid4())[:8],
        "type": card_type,
        "content": card_text,
        "expanded": expanded,
        "tickers": tickers,
        "source": "bernstein",
        "source_title": title,
        "categories": card_cats,
        "created_at": datetime.now().isoformat()
    }]


def load_data() -> dict:
    """Load training data from bernstein and custom directories."""
    data = {"insights": [], "contrarian_views": [], "ai_views": [], "custom": []}

    # Load Bernstein data
    f = DATA_DIR / "comprehensive_insights.json"
    if f.exists():
        with open(f, 'r', encoding='utf-8') as file:
            d = json.load(file)
            data["insights"] = d.get("top_100_insights", [])
            data["contrarian_views"] = d.get("contrarian_views", [])

    f = DATA_DIR / "ai_views.json"
    if f.exists():
        with open(f, 'r', encoding='utf-8') as file:
            data["ai_views"] = json.load(file)

    f = DATA_DIR / "current_views_2025.json"
    if f.exists():
        with open(f, 'r', encoding='utf-8') as file:
            d = json.load(file)
            if isinstance(d, list):
                data["ai_views"].extend(d)

    # Load custom training data
    if CUSTOM_DIR.exists():
        for json_file in CUSTOM_DIR.glob("**/*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as file:
                    custom_data = json.load(file)
                    if isinstance(custom_data, list):
                        data["custom"].extend(custom_data)
                    elif isinstance(custom_data, dict):
                        # Support both formats
                        if "insights" in custom_data:
                            data["custom"].extend(custom_data["insights"])
                        elif "key_views" in custom_data:
                            data["ai_views"].append(custom_data)
                        else:
                            data["custom"].append(custom_data)
                print(f"Loaded custom data: {json_file.name}")
            except Exception as e:
                print(f"Error loading {json_file}: {e}")

    return data


def main(use_ai: bool = False):
    print("=" * 50)
    print("SWIPESTREET CARD GENERATOR v2")
    print(f"Mode: {'AI' if use_ai else 'Rules'}")
    print("=" * 50)

    data = load_data()
    cards = []

    print(f"\nData: {len(data['insights'])} insights, {len(data['contrarian_views'])} contrarian, {len(data['ai_views'])} AI reports, {len(data['custom'])} custom")

    gen = generate_card_ai if use_ai else generate_card_rules

    # Process insights
    print("\nProcessing insights...")
    for i, item in enumerate(data["insights"][:100]):
        cards.extend(gen(item))
        if (i+1) % 25 == 0:
            print(f"  {i+1} done -> {len(cards)} cards")

    # Process contrarian
    print("Processing contrarian views...")
    for item in data["contrarian_views"][:50]:
        item["insight"] = item.get("view", "")
        result = gen(item)
        for c in result:
            c["type"] = "contrarian"
        cards.extend(result)

    # Process AI views
    print("Processing AI reports...")
    for report in data["ai_views"][:30]:
        title = report.get("title", "")
        for view in report.get("key_views", [])[:2]:
            item = {"insight": view, "title": title, "categories": ["AI/Technology"]}
            cards.extend(gen(item))

    # Process custom training data
    if data["custom"]:
        print(f"Processing {len(data['custom'])} custom items...")
        for i, item in enumerate(data["custom"]):
            # Normalize format
            if "insight" not in item and "content" in item:
                item["insight"] = item["content"]
            if "insight" not in item and "text" in item:
                item["insight"] = item["text"]
            if "insight" in item:
                cards.extend(gen(item))
            if (i+1) % 25 == 0:
                print(f"  {i+1} done -> {len(cards)} cards")

    # Dedupe
    seen = set()
    unique = []
    for c in cards:
        key = c["content"][:40]
        if key not in seen:
            seen.add(key)
            unique.append(c)

    print(f"\nTotal: {len(unique)} unique cards")

    # Save
    out = OUTPUT_DIR / "cards.json"
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "total_cards": len(unique),
            "cards": unique
        }, f, indent=2, ensure_ascii=False)

    print(f"Saved: {out}")

    # Samples
    print("\n" + "=" * 50)
    print("SAMPLES")
    print("=" * 50)
    for c in unique[:8]:
        print(f"\n[{c['type'].upper()}]")
        print(f"{c['content']}")


if __name__ == "__main__":
    import sys
    main(use_ai="--ai" in sys.argv)
