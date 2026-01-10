"""
SwipeStreet Backend API
FastAPI server for card feed, user progress, and subscriptions
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import sqlite3
from pathlib import Path
from datetime import datetime
import hashlib
import secrets

app = FastAPI(title="SwipeStreet API", version="1.0.0")

# CORS for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "content" / "cards"
DB_PATH = BASE_DIR / "backend" / "swipestreet.db"


# Models
class UserCreate(BaseModel):
    device_id: str


class UserProgress(BaseModel):
    card_id: str
    action: str  # seen, saved, unsaved


class QuizAnswer(BaseModel):
    card_id: str
    correct: bool


class SubscriptionVerify(BaseModel):
    receipt_data: str
    platform: str  # ios, android


# Database setup
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            device_id TEXT UNIQUE,
            token TEXT UNIQUE,
            is_subscribed INTEGER DEFAULT 0,
            subscription_expires TEXT,
            created_at TEXT,
            last_active TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_progress (
            user_id TEXT,
            card_id TEXT,
            seen_at TEXT,
            saved INTEGER DEFAULT 0,
            quiz_attempts INTEGER DEFAULT 0,
            quiz_correct INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, card_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cards_cache (
            id TEXT PRIMARY KEY,
            data TEXT,
            updated_at TEXT
        )
    """)

    conn.commit()
    conn.close()


# Initialize on startup
init_db()


def load_cards():
    """Load cards from JSON file."""
    cards_file = DATA_DIR / "cards.json"
    if cards_file.exists():
        with open(cards_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("cards", [])
    return []


def get_user_from_token(authorization: str = Header(None)):
    """Extract user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE token = ?", (token,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None


# Routes
@app.get("/")
def root():
    return {"status": "ok", "service": "SwipeStreet API"}


@app.post("/api/auth/register")
def register_user(data: UserCreate):
    """Register a new user with device ID."""
    conn = get_db()
    cursor = conn.cursor()

    # Check if device already registered
    cursor.execute("SELECT * FROM users WHERE device_id = ?", (data.device_id,))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        return {"token": existing["token"], "user_id": existing["id"]}

    # Create new user
    user_id = hashlib.sha256(data.device_id.encode()).hexdigest()[:16]
    token = secrets.token_urlsafe(32)
    now = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO users (id, device_id, token, created_at, last_active)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, data.device_id, token, now, now))

    conn.commit()
    conn.close()

    return {"token": token, "user_id": user_id}


@app.get("/api/feed")
def get_feed(
    limit: int = 20,
    offset: int = 0,
    category: Optional[str] = None,
    card_type: Optional[str] = None,
    user: dict = Depends(get_user_from_token)
):
    """Get personalized card feed."""
    cards = load_cards()

    # Filter by category
    if category:
        cards = [c for c in cards if category in c.get("categories", [])]

    # Filter by type
    if card_type:
        cards = [c for c in cards if c.get("type") == card_type]

    # Get user progress to filter seen cards
    seen_ids = set()
    if user:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT card_id FROM user_progress WHERE user_id = ? AND seen_at IS NOT NULL",
            (user["id"],)
        )
        seen_ids = {row["card_id"] for row in cursor.fetchall()}
        conn.close()

    # Prioritize unseen cards
    unseen = [c for c in cards if c["id"] not in seen_ids]
    seen = [c for c in cards if c["id"] in seen_ids]

    # Combine: unseen first, then seen
    ordered = unseen + seen

    # Paginate
    paginated = ordered[offset:offset + limit]

    return {
        "cards": paginated,
        "total": len(cards),
        "offset": offset,
        "has_more": offset + limit < len(ordered)
    }


@app.get("/api/feed/categories")
def get_categories():
    """Get available categories with counts."""
    cards = load_cards()
    categories = {}

    for card in cards:
        for cat in card.get("categories", ["General"]):
            categories[cat] = categories.get(cat, 0) + 1

    return {
        "categories": [
            {"name": name, "count": count}
            for name, count in sorted(categories.items(), key=lambda x: -x[1])
        ]
    }


@app.get("/api/card/{card_id}")
def get_card(card_id: str):
    """Get single card with full details."""
    cards = load_cards()
    card = next((c for c in cards if c["id"] == card_id), None)

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return card


@app.post("/api/progress")
def update_progress(data: UserProgress, user: dict = Depends(get_user_from_token)):
    """Update user progress on a card."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    if data.action == "seen":
        cursor.execute("""
            INSERT INTO user_progress (user_id, card_id, seen_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, card_id) DO UPDATE SET seen_at = ?
        """, (user["id"], data.card_id, now, now))

    elif data.action == "saved":
        cursor.execute("""
            INSERT INTO user_progress (user_id, card_id, saved)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, card_id) DO UPDATE SET saved = 1
        """, (user["id"], data.card_id))

    elif data.action == "unsaved":
        cursor.execute("""
            UPDATE user_progress SET saved = 0
            WHERE user_id = ? AND card_id = ?
        """, (user["id"], data.card_id))

    conn.commit()
    conn.close()

    return {"status": "ok"}


@app.get("/api/saved")
def get_saved_cards(user: dict = Depends(get_user_from_token)):
    """Get user's saved cards."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT card_id FROM user_progress WHERE user_id = ? AND saved = 1",
        (user["id"],)
    )
    saved_ids = [row["card_id"] for row in cursor.fetchall()]
    conn.close()

    cards = load_cards()
    saved_cards = [c for c in cards if c["id"] in saved_ids]

    return {"cards": saved_cards, "total": len(saved_cards)}


@app.get("/api/quiz")
def get_quiz_cards(limit: int = 5, user: dict = Depends(get_user_from_token)):
    """Get cards for quiz mode (prioritize saved, unseen in quiz)."""
    cards = load_cards()

    # Prefer cards with numbers/predictions for quiz
    quizzable = [
        c for c in cards
        if c.get("type") in ["number", "prediction", "contrarian"]
    ]

    if not quizzable:
        quizzable = cards[:limit]

    return {"cards": quizzable[:limit]}


@app.post("/api/quiz/answer")
def submit_quiz_answer(data: QuizAnswer, user: dict = Depends(get_user_from_token)):
    """Submit quiz answer."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO user_progress (user_id, card_id, quiz_attempts, quiz_correct)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, card_id) DO UPDATE SET
            quiz_attempts = quiz_attempts + 1,
            quiz_correct = quiz_correct + ?
    """, (user["id"], data.card_id, 1 if data.correct else 0, 1 if data.correct else 0))

    conn.commit()
    conn.close()

    return {"status": "ok"}


@app.get("/api/stats")
def get_user_stats(user: dict = Depends(get_user_from_token)):
    """Get user learning stats."""
    if not user:
        return {"cards_seen": 0, "cards_saved": 0, "quiz_accuracy": 0}

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(*) as total_seen,
            SUM(saved) as total_saved,
            SUM(quiz_attempts) as total_attempts,
            SUM(quiz_correct) as total_correct
        FROM user_progress WHERE user_id = ?
    """, (user["id"],))

    stats = cursor.fetchone()
    conn.close()

    attempts = stats["total_attempts"] or 0
    correct = stats["total_correct"] or 0

    return {
        "cards_seen": stats["total_seen"] or 0,
        "cards_saved": stats["total_saved"] or 0,
        "quiz_attempts": attempts,
        "quiz_accuracy": round(correct / attempts * 100, 1) if attempts > 0 else 0
    }


@app.post("/api/subscription/verify")
def verify_subscription(data: SubscriptionVerify, user: dict = Depends(get_user_from_token)):
    """Verify iOS/Android subscription receipt."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # TODO: Implement actual receipt validation with Apple/Google
    # For now, mark as subscribed for testing
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users SET is_subscribed = 1 WHERE id = ?
    """, (user["id"],))

    conn.commit()
    conn.close()

    return {"status": "ok", "is_subscribed": True}


@app.get("/api/subscription/status")
def get_subscription_status(user: dict = Depends(get_user_from_token)):
    """Check subscription status."""
    if not user:
        return {"is_subscribed": False}

    return {"is_subscribed": bool(user.get("is_subscribed", 0))}


# Offline sync endpoint
@app.get("/api/sync/cards")
def sync_all_cards(since: Optional[str] = None):
    """Get all cards for offline storage."""
    cards = load_cards()

    # Filter by update time if provided
    if since:
        cards = [c for c in cards if c.get("created_at", "") > since]

    return {
        "cards": cards,
        "total": len(cards),
        "synced_at": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
