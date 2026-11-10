"""
EcoAssistAI - Core Flask Server & API Orchestration
Integrates Google Gemini API (via official google-genai SDK) with SQLite persistence
and serves the responsive environmental dashboard on port 5000.
"""

import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment configuration (.env)
load_dotenv()

from google import genai
from google.genai import types

import database
import eco_prompts

app = Flask(__name__, static_folder="static", template_folder="templates")

# Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

# Initialize Gemini Client if key is configured
def get_gemini_client():
    if not GEMINI_API_KEY:
        return None
    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"[!] Error initializing Gemini client: {e}")
        return None

# Initialize database on application startup
database.init_db()

@app.route("/")
def index():
    """Serve the primary EcoAssistAI web interface."""
    return render_template("index.html")

@app.route("/api/status", methods=["GET"])
def check_status():
    """
    Diagnostic endpoint to verify Gemini API readiness.
    Never exposes sensitive API keys in the response.
    """
    if not GEMINI_API_KEY:
        return jsonify({
            "online": False,
            "provider": "Google Gemini",
            "model": GEMINI_MODEL,
            "message": "GEMINI_API_KEY is not set in your .env file."
        }), 503

    client = get_gemini_client()
    if not client:
        return jsonify({
            "online": False,
            "provider": "Google Gemini",
            "model": GEMINI_MODEL,
            "message": "Failed to initialize Google Gemini client."
        }), 500

    return jsonify({
        "online": True,
        "provider": "Google Gemini",
        "model": GEMINI_MODEL,
        "message": f"Connected to Google Gemini ({GEMINI_MODEL})."
    })

@app.route("/api/suggestions", methods=["GET"])
def get_suggestions():
    """Return prompt templates for UI quick-chips."""
    return jsonify({"suggestions": eco_prompts.QUICK_SUGGESTIONS})

# --- Conversations & Chat Endpoints ---

@app.route("/api/conversations", methods=["GET"])
def list_conversations():
    """Retrieve all conversations for the sidebar history."""
    try:
        convs = database.get_all_conversations()
        return jsonify({"conversations": convs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/conversations", methods=["POST"])
def new_conversation():
    """Create a new blank conversation session."""
    try:
        data = request.get_json() or {}
        title = data.get("title", "New Eco Session")
        conv = database.create_conversation(title=title)
        return jsonify(conv)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/conversations/<conv_id>", methods=["GET"])
def get_conversation_history(conv_id):
    """Retrieve message history for a specific conversation session."""
    try:
        conv = database.get_conversation(conv_id)
        if not conv:
            return jsonify({"error": "Conversation not found"}), 404
        messages = database.get_messages(conv_id)
        return jsonify({
            "conversation": conv,
            "messages": messages
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/conversations/<conv_id>", methods=["DELETE"])
def delete_conversation_route(conv_id):
    """Delete a conversation session and associated messages."""
    try:
        database.delete_conversation(conv_id)
        return jsonify({"success": True, "message": "Conversation deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat/clear", methods=["POST"])
def clear_all_chats_route():
    """
    Clear all chat conversations and messages while safely preserving
    all environmental dataset records and activities in SQLite.
    """
    try:
        new_conv = database.clear_all_chats()
        return jsonify({
            "success": True,
            "message": "Chat history cleared successfully. Environmental dataset preserved.",
            "new_conversation": new_conv
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Main generative AI endpoint powered by Google Gemini API.
    1. Validates user prompt.
    2. Injects real environmental dataset context from SQLite into system instructions.
    3. Handles concise vs detailed response preferences.
    4. Calls official google-genai SDK.
    5. Saves conversation in SQLite and returns JSON response.
    """
    try:
        data = request.get_json()
        if not data or not data.get("message", "").strip():
            return jsonify({"error": "Message content cannot be empty."}), 400

        user_message = data.get("message").strip()
        conv_id = data.get("conversation_id")
        response_style = data.get("response_style", "detailed")

        if not GEMINI_API_KEY:
            return jsonify({
                "error": "Google Gemini API key is not configured in .env file.",
                "offline": True
            }), 503

        client = get_gemini_client()
        if not client:
            return jsonify({
                "error": "Failed to create Gemini client.",
                "offline": True
            }), 500

        # Create new conversation if none passed
        if not conv_id or not database.get_conversation(conv_id):
            title = user_message[:34] + ("..." if len(user_message) > 34 else "")
            new_conv = database.create_conversation(title=title)
            conv_id = new_conv["id"]
        else:
            history = database.get_messages(conv_id)
            if len(history) <= 1:
                title = user_message[:34] + ("..." if len(user_message) > 34 else "")
                database.update_conversation_title(conv_id, title)

        # 1. Save user message to database
        database.add_message(conv_id, "user", user_message)

        # 2. Retrieve history for context
        history = database.get_messages(conv_id)

        # 3. Fetch real environmental dataset context from SQLite
        dataset_context = database.get_dataset_context_for_ai()

        # 4. Build system instruction with dataset context & style
        system_instruction = eco_prompts.get_system_prompt(
            dataset_context=dataset_context,
            response_style=response_style
        )

        # 5. Format conversation contents for Gemini API
        contents = []
        # Sliding context window: send last 8 messages
        for msg in history[-8:-1]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg["content"])]
            ))

        # Add current user prompt
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)]
        ))

        # 6. Call Gemini API with automatic candidate resilience
        ai_reply = ""
        model_candidates = [GEMINI_MODEL]
        for fallback in ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"]:
            if fallback not in model_candidates:
                model_candidates.append(fallback)

        last_error = None
        for model_to_use in model_candidates:
            try:
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7,
                )
                response = client.models.generate_content(
                    model=model_to_use,
                    contents=contents,
                    config=config
                )
                if response and response.text:
                    ai_reply = response.text.strip()
                    break
            except Exception as api_err:
                last_error = api_err
                print(f"[!] Warning: Model {model_to_use} encounter: {api_err}. Trying alternate supported model...")
                continue

        if not ai_reply and last_error:
            error_msg = f"Gemini API request notice: {str(last_error)}"
            database.add_message(conv_id, "assistant", f"⚠️ **Service Notice**: {error_msg}")
            return jsonify({
                "error": error_msg,
                "conversation_id": conv_id
            }), 502

        if not ai_reply:
            ai_reply = "I analyzed your query, but could not produce a response. Please try rephrasing."

        # 7. Save assistant reply in SQLite
        database.add_message(conv_id, "assistant", ai_reply)

        return jsonify({
            "conversation_id": conv_id,
            "reply": ai_reply,
            "role": "assistant"
        })

    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# --- Environmental Analytics & Activity Logger Endpoints ---

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    """Return carbon footprint metrics, category breakdown, and 7-day trend."""
    try:
        summary = database.get_analytics_summary()
        recent = database.get_recent_activities(limit=8)
        return jsonify({
            "summary": summary,
            "recent_activities": recent
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/activities", methods=["GET"])
def list_activities():
    """Return all environmental activity records with optional category & search filter."""
    try:
        category = request.args.get("category")
        search = request.args.get("search")
        activities = database.get_all_activities(category=category, search=search)
        return jsonify({"activities": activities})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/activity", methods=["POST"])
def add_activity():
    """
    Log an environmental action into SQLite.
    Recalculates metrics and returns refreshed analytics.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No activity data provided"}), 400

        category = data.get("category", "General")
        activity_name = data.get("activity_name", "").strip()
        co2_saved = data.get("co2_saved_kg", 0)
        date = data.get("date")
        notes = data.get("notes", "")

        if not activity_name:
            return jsonify({"error": "Activity name is required"}), 400

        try:
            co2_saved = float(co2_saved)
            if co2_saved <= 0:
                return jsonify({"error": "CO2 saved must be greater than 0 kg"}), 400
        except ValueError:
            return jsonify({"error": "CO2 saved must be a valid number"}), 400

        database.log_activity(category, activity_name, co2_saved, date, notes)

        # Return refreshed analytics
        summary = database.get_analytics_summary()
        recent = database.get_recent_activities(limit=8)

        return jsonify({
            "success": True,
            "message": f"Successfully logged '{activity_name}' (-{co2_saved} kg CO2e)!",
            "summary": summary,
            "recent_activities": recent
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/activity/<int:activity_id>", methods=["DELETE"])
def delete_activity_route(activity_id):
    """Delete a single environmental activity record by ID."""
    try:
        database.delete_activity(activity_id)
        summary = database.get_analytics_summary()
        return jsonify({
            "success": True,
            "message": "Activity record removed.",
            "summary": summary
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/about", methods=["GET"])
def get_about():
    """Return friendly, non-technical project description."""
    return jsonify({
        "project_name": "EcoAssistAI",
        "description": "EcoAssistAI is an environmental assistance platform that helps users learn about environmental topics, track carbon savings, and discover practical ways to protect nature in everyday life."
    })

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(" EcoAssistAI - Environmental Assistance Platform")
    print(f" Powered by Google Gemini ({GEMINI_MODEL}) & Flask")
    print(" Dashboard URL: http://127.0.0.1:5000")
    print("=" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
