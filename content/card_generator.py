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
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "content" / "cards"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CARD_PROMPT = """Convert this research into 1-2 learning cards.

CARD FORMAT (required structure):
1. FACT: One specific number or claim
2. CONTEXT: Why it matters (1 sentence)
3. IMPLICATION: So what / who wins/loses (1 sentence)

CARD TYPES:
- stat: number + context + significance
- mechanic: how X works + why + implication
- contrarian: consensus view + actual reality + evidence

RULES:
- 2-4 sentences, 50-100 words max
- lowercase, casual voice ("u" not "you")
- no hedging (remove "may", "could", "potentially", "likely")
- no meta ("this report argues", "we believe")
- declarative, confident prose
- each card must stand alone

NUMBERS RULE (important):
- AVOID absolute prices, multiples, market caps that go stale (not "$150", "45x P/E", "$50B market cap")
- USE relative comparisons instead ("2x peers", "30% premium to historical avg", "half the market's multiple")
- ONLY use specific % for durable traits: growth rates, margins, market share, CAGR
- Good: "trades at 2x the sector average" Bad: "trades at 45x earnings"
- Good: "15% operating margins vs 8% peers" Bad: "$2.3B EBITDA"

VOICE EXAMPLES:
- "ferrari trades at nearly 2x the luxury sector multiple. their brand lets them raise prices 8-10% annually without killing demand. pricing power is the moat."
- "ngl midstream has real barriers unlike most energy. u need the full chain: processing → pipeline → fractionation → export. hard to replicate."
- "consensus thinks china steel data is accurate. it's not. the un and major producers are using wrong numbers."

RESEARCH:
Title: {title}
Content: {content}

Return JSON array only:
[{{"type": "stat|mechanic|contrarian", "content": "...", "tickers": []}}]
"""


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


def casualize(text: str) -> str:
    """Convert to casual voice."""
    text = text.lower()

    # Remove research language
    removals = [
        r'^we believe that\s*', r'^we believe\s*', r'^we think that\s*',
        r'^we think\s*', r'^we expect that\s*', r'^we expect\s*',
        r'^our view is that\s*', r'^it is important to note that\s*',
        r'^importantly,?\s*', r'^critically,?\s*', r'^however,?\s*',
        r'^therefore,?\s*', r'^furthermore,?\s*', r'^additionally,?\s*',
        r'^in conclusion,?\s*', r'^the bottom line is that\s*',
        r'^the key (insight|point|takeaway) is that\s*',
    ]
    for pattern in removals:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # Casual replacements
    replacements = [
        (r'\byou\b', 'u'), (r'\byour\b', 'ur'), (r'\breally\b', 'rly'),
        (r'\bpercent\b', '%'), (r'\bversus\b', 'vs'),
        (r'\bcannot\b', "can't"), (r'\bwill not\b', "won't"),
    ]
    for old, new in replacements:
        text = re.sub(old, new, text)

    return text.strip()


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

        # Parse JSON
        if text.startswith('['):
            cards = json.loads(text)
        else:
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                cards = json.loads(match.group())
            else:
                return generate_card_rules(insight)

        # Validate
        valid = []
        for card in cards:
            if isinstance(card, dict) and card.get("content"):
                c = card["content"].lower().strip()
                if 30 < len(c) < 300:
                    valid.append({
                        "id": str(uuid.uuid4())[:8],
                        "type": card.get("type", "insight"),
                        "content": c,
                        "tickers": card.get("tickers", []),
                        "source": "bernstein",
                        "source_title": title,
                        "categories": categories,
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

    card_text = casualize(remove_hedging(card_text))

    # Truncate smartly
    if len(card_text) > 280:
        # Try to cut at sentence boundary
        parts = card_text.split('. ')
        card_text = parts[0]
        if len(card_text) > 280:
            card_text = card_text[:277] + "..."

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

    return [{
        "id": str(uuid.uuid4())[:8],
        "type": card_type,
        "content": card_text,
        "tickers": tickers,
        "source": "bernstein",
        "source_title": title,
        "categories": categories if isinstance(categories, list) else [categories],
        "created_at": datetime.now().isoformat()
    }]


def load_data() -> dict:
    """Load Bernstein data."""
    data = {"insights": [], "contrarian_views": [], "ai_views": []}

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

    return data


def main(use_ai: bool = False):
    print("=" * 50)
    print("SWIPESTREET CARD GENERATOR v2")
    print(f"Mode: {'AI' if use_ai else 'Rules'}")
    print("=" * 50)

    data = load_data()
    cards = []

    print(f"\nData: {len(data['insights'])} insights, {len(data['contrarian_views'])} contrarian, {len(data['ai_views'])} AI reports")

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
