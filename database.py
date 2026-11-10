"""
EcoAssistAI - SQLite Database Layer
Handles relational data storage for conversations, messages, and environmental records.
Designed for reliability, ACID compliance, and academic project evaluation.
"""

import sqlite3
import os
import uuid
from datetime import datetime, timedelta

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ecoassist.db")

def get_db_connection():
    """Establish and return a connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Enables column access by name
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initialize database schema and seed initial sample records if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Conversations Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Chat Messages Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    # 3. Environmental Activity & Carbon Savings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS eco_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            activity_name TEXT NOT NULL,
            co2_saved_kg REAL NOT NULL,
            date TEXT NOT NULL,
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 4. User Profile / Target Goals Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY,
            name TEXT DEFAULT 'EcoAssistAI User',
            monthly_target_kg REAL DEFAULT 60.0
        )
    """)

    # Check if initial profile data is needed
    cursor.execute("SELECT COUNT(*) FROM user_profile")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO user_profile (id, name, monthly_target_kg) VALUES (1, 'EcoAssistAI User', 60.0)")

    # Check if initial sample data is needed for eco_activities
    cursor.execute("SELECT COUNT(*) FROM eco_activities")
    if cursor.fetchone()[0] == 0:
        today = datetime.now()
        sample_activities = [
            ("Transport", "Cycled to campus instead of motor scooter (6 km)", 1.45, (today - timedelta(days=6)).strftime("%Y-%m-%d"), "Saved fossil fuel on commute"),
            ("Energy", "Used natural lighting & switched off AC for 4 hours", 2.20, (today - timedelta(days=5)).strftime("%Y-%m-%d"), "Hostel study room energy savings"),
            ("Food & Diet", "Opted for vegetarian campus meals all day", 2.80, (today - timedelta(days=4)).strftime("%Y-%m-%d"), "Reduced meat-associated carbon footprint"),
            ("Waste & Recycling", "Refused single-use plastic bottles; used steel flask", 0.45, (today - timedelta(days=3)).strftime("%Y-%m-%d"), "Eliminated 3 PET bottles"),
            ("Transport", "Took metro/public bus instead of cab", 2.10, (today - timedelta(days=2)).strftime("%Y-%m-%d"), "Shared transit reduction"),
            ("Waste & Recycling", "Segregated & recycled electronic waste (old cables)", 1.75, (today - timedelta(days=1)).strftime("%Y-%m-%d"), "Sent e-waste to certified recycler"),
            ("Energy", "Turned off standby laptops & equipment overnight", 0.85, today.strftime("%Y-%m-%d"), "Phantom load power reduction")
        ]
        cursor.executemany("""
            INSERT INTO eco_activities (category, activity_name, co2_saved_kg, date, notes)
            VALUES (?, ?, ?, ?, ?)
        """, sample_activities)

    # Pre-seed a welcome conversation if none exist
    cursor.execute("SELECT COUNT(*) FROM conversations")
    if cursor.fetchone()[0] == 0:
        conv_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, "Welcome to EcoAssistAI"))
        cursor.execute("""
            INSERT INTO messages (conversation_id, role, content)
            VALUES (?, ?, ?)
        """, (
            conv_id, 
            "assistant", 
            "Hello! I am **EcoAssistAI**, your local AI environmental assistant powered by Qwen2.5. How can I help you analyze carbon savings, optimize energy usage, or explore sustainable lifestyle practices today?"
        ))

    conn.commit()
    conn.close()

# --- Conversation Management ---

def create_conversation(title="New Eco Session"):
    """Create a new conversation session and return its metadata."""
    conn = get_db_connection()
    conv_id = str(uuid.uuid4())
    conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, title))
    conn.commit()
    conn.close()
    return {"id": conv_id, "title": title}

def get_all_conversations():
    """Retrieve all conversation sessions ordered by most recently updated."""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM conversations ORDER BY updated_at DESC").fetchall()
    convs = [dict(row) for row in rows]
    conn.close()
    return convs

def get_conversation(conv_id):
    """Retrieve details of a single conversation."""
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_conversation(conv_id):
    """Delete a conversation and all its associated messages."""
    conn = get_db_connection()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()
    return True

def clear_all_chats():
    """
    Safely delete all conversation sessions and messages.
    Preserves all environmental records in eco_activities and user_profile completely intact.
    Creates a fresh initial conversation session.
    """
    conn = get_db_connection()
    conn.execute("DELETE FROM messages")
    conn.execute("DELETE FROM conversations")
    
    # Create a fresh welcome conversation
    conv_id = str(uuid.uuid4())
    conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, "New Eco Session"))
    conn.execute("""
        INSERT INTO messages (conversation_id, role, content)
        VALUES (?, ?, ?)
    """, (
        conv_id, 
        "assistant", 
        "Chat history has been cleared. I am ready for your environmental questions!"
    ))
    conn.commit()
    conn.close()
    return {"id": conv_id, "title": "New Eco Session"}

def update_conversation_title(conv_id, title):
    """Update conversation title based on user query topic."""
    conn = get_db_connection()
    conn.execute("UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, conv_id))
    conn.commit()
    conn.close()

# --- Message Management ---

def add_message(conv_id, role, content):
    """Save a user or assistant message to SQLite and touch conversation updated_at."""
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conv_id, role, content)
    )
    conn.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()

def get_messages(conv_id):
    """Fetch all messages for a given conversation sorted chronologically."""
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conv_id,)
    ).fetchall()
    messages = [dict(row) for row in rows]
    conn.close()
    return messages

# --- Environmental Activity & Analytics ---

def log_activity(category, activity_name, co2_saved_kg, date=None, notes=""):
    """Record an environmental action and its CO2e reduction in kilograms."""
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO eco_activities (category, activity_name, co2_saved_kg, date, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (category, activity_name, float(co2_saved_kg), date, notes))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def delete_activity(activity_id):
    """Delete a single environmental activity record by ID."""
    conn = get_db_connection()
    conn.execute("DELETE FROM eco_activities WHERE id = ?", (activity_id,))
    conn.commit()
    conn.close()
    return True

def get_all_activities(category=None, search=None):
    """Fetch environmental activity log entries with optional category and search filters."""
    conn = get_db_connection()
    query = "SELECT * FROM eco_activities WHERE 1=1"
    params = []

    if category and category.lower() != "all":
        query += " AND category = ?"
        params.append(category)

    if search:
        query += " AND (activity_name LIKE ? OR notes LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term])

    query += " ORDER BY date DESC, id DESC"
    rows = conn.execute(query, params).fetchall()
    activities = [dict(row) for row in rows]
    conn.close()
    return activities

def get_recent_activities(limit=10):
    """Fetch recent activity log entries."""
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM eco_activities ORDER BY date DESC, id DESC LIMIT ?", 
        (limit,)
    ).fetchall()
    activities = [dict(row) for row in rows]
    conn.close()
    return activities

def get_analytics_summary():
    """
    Calculate high-level sustainability metrics, category breakdown, 
    and weekly trend data calculated strictly from actual database records.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Overall stats
    cursor.execute("SELECT COALESCE(SUM(co2_saved_kg), 0), COUNT(*) FROM eco_activities")
    total_co2, activity_count = cursor.fetchone()
    total_co2 = round(total_co2, 2)

    has_data = activity_count > 0

    # Trees equivalent: 1 mature tree absorbs ~21 kg CO2 per year
    trees_equivalent = round(total_co2 / 21.0, 2) if total_co2 > 0 else 0.0

    # User profile target
    cursor.execute("SELECT monthly_target_kg FROM user_profile WHERE id = 1")
    target_row = cursor.fetchone()
    target_kg = target_row[0] if target_row else 60.0
    progress_pct = min(100, round((total_co2 / target_kg) * 100, 1)) if target_kg > 0 else 0.0

    # 2. Category Breakdown calculated strictly from actual records
    cursor.execute("""
        SELECT category, ROUND(SUM(co2_saved_kg), 2) as total, COUNT(*) as count 
        FROM eco_activities 
        GROUP BY category 
        ORDER BY total DESC
    """)
    category_rows = cursor.fetchall()
    categories = [r["category"] for r in category_rows]
    category_totals = [r["total"] for r in category_rows]
    category_counts = [r["count"] for r in category_rows]

    # Distinct categories count
    categories_count = len(categories)

    # 3. Last 7 Days Savings Trend based on actual dates
    trend_labels = []
    trend_values = []
    for i in range(6, -1, -1):
        day = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        cursor.execute("SELECT COALESCE(SUM(co2_saved_kg), 0) FROM eco_activities WHERE date = ?", (day,))
        day_total = cursor.fetchone()[0]
        
        day_obj = datetime.strptime(day, "%Y-%m-%d")
        trend_labels.append(day_obj.strftime("%a %d"))
        trend_values.append(round(day_total, 2))

    # Top impact category
    top_category = categories[0] if categories else "None"

    conn.close()

    return {
        "has_data": has_data,
        "total_co2_kg": total_co2,
        "activities_count": activity_count,
        "categories_count": categories_count,
        "trees_equivalent": trees_equivalent,
        "target_kg": target_kg,
        "progress_pct": progress_pct,
        "top_category": top_category,
        "categories": {
            "labels": categories,
            "data": category_totals,
            "counts": category_counts
        },
        "weekly_trend": {
            "labels": trend_labels,
            "data": trend_values
        }
    }

def get_dataset_context_for_ai():
    """
    Format actual SQLite environmental records as a concise context summary
    to be injected into the Qwen2.5 system prompt for RAG responses.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*), COALESCE(SUM(co2_saved_kg), 0) FROM eco_activities")
    total_count, total_co2 = cursor.fetchone()

    cursor.execute("""
        SELECT category, COUNT(*), ROUND(SUM(co2_saved_kg), 2) 
        FROM eco_activities 
        GROUP BY category
    """)
    cat_breakdown = cursor.fetchall()

    cursor.execute("SELECT category, activity_name, co2_saved_kg, date FROM eco_activities ORDER BY date DESC LIMIT 8")
    recent = cursor.fetchall()
    conn.close()

    if total_count == 0:
        return "Current database contains 0 recorded environmental activities. If the user asks about dataset statistics, inform them that no records are currently logged."

    context_lines = [
        f"Actual User Environmental Dataset Summary (from SQLite database):",
        f"- Total Environmental Records: {total_count}",
        f"- Total Verified CO2e Avoided: {round(total_co2, 2)} kg",
        f"- Category Breakdown:"
    ]
    for cat in cat_breakdown:
        context_lines.append(f"  * {cat[0]}: {cat[1]} records, {cat[2]} kg CO2e saved")

    context_lines.append("- Recent Activity Records:")
    for r in recent:
        context_lines.append(f"  * [{r['date']}] {r['category']}: \"{r['activity_name']}\" ({r['co2_saved_kg']} kg CO2e)")

    return "\n".join(context_lines)

if __name__ == "__main__":
    init_db()
    summary = get_analytics_summary()
    print("[OK] Database layer initialized.")
    print("Summary:", summary)
