# EcoAssistAI 🌿
> **AI-Powered Environmental Assistance Chatbot & Carbon-Tracking Platform**

---

## 🌟 Project Overview
**EcoAssistAI** is an environmental assistance platform that bridges generative artificial intelligence with quantifiable carbon tracking. It is designed to assist users in learning about environmental topics, assessing carbon footprints, optimizing energy conservation, and establishing sustainable habits in everyday life.

EcoAssistAI is powered by the **Google Gemini API** (using the official `google-genai` SDK) integrated with a local SQLite database for conversation history and environmental records.

---

## 🏗️ Technical Architecture

| Component | Technology | Description |
|---|---|---|
| **Generative AI Provider** | Google Gemini API (`google-genai` SDK) | Cloud generative language model configured via `.env` (`GEMINI_API_KEY` and `GEMINI_MODEL`). |
| **Backend & REST API** | Python 3.13 + Flask | Lightweight web server handling chat orchestration, environmental dataset context, and analytics. |
| **Database** | SQLite (`ecoassist.db`) | Serverless relational database for conversations, messages, and environmental records. |
| **Frontend UI** | HTML5, CSS3, JavaScript | Forest Green theme (`#052317`), glassmorphism, responsive navigation, and light/dark theme toggle. |
| **Visualizations** | Chart.js | Dynamic responsive charts for emission breakdowns and trends based on real database records. |

---

## 📁 File Structure

```
EcoAssistAI/
├── .env                    # Environment configuration (GEMINI_API_KEY, GEMINI_MODEL)
├── app.py                  # Core Flask server & REST API endpoints
├── database.py             # SQLite database layer (sessions, messages, eco-logs)
├── eco_prompts.py          # Prompt engineering & system persona for Gemini
├── requirements.txt        # Python package dependencies
├── ecoassist.db            # SQLite database file
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Main unified application dashboard
└── static/
    ├── css/
    │   └── style.css       # Deep forest theme, emerald glow, subtle animations, light/dark modes
    └── js/
        ├── ui.js           # Navigation, theme toggle, modals, settings, scroll button & status check
        ├── charts.js       # Chart.js initialization & dynamic data updates
        └── chat.js         # Chatbot logic, assistant orb reaction states, and text-to-speech
```

---

## 🚀 How to Run and Test the Application Locally

### Step 1: Configure Environment Variables
Verify your `.env` file in the `EcoAssistAI` workspace root contains:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

### Step 2: Install Python Dependencies
```powershell
py -m pip install -r requirements.txt
```

### Step 3: Start the EcoAssistAI Application
In your terminal, inside the `EcoAssistAI` workspace folder:
```powershell
py app.py
```

### Step 4: Open in Browser
Visit:
```
http://127.0.0.1:5000
```

---

## 🧪 Application Features & Navigation

1. **Dashboard**:
   - Live environmental statistics (Total Observations, Total CO₂e Avoided, Tree Absorption Equivalent, Target Progress).
   - Category distribution doughnut chart and 7-day reduction trendline chart generated strictly from real database records.
   - Animated Assistant indicator orb and quick consultation chips.
   - Small attractive scroll button to jump smoothly to the AI Assistant.
   - Empty state banner when no records exist.
2. **AI Chatbot**:
   - Generative conversations with Google Gemini.
   - Real-time assistant orb indicator (Idle, Thinking, Responding states).
   - Real dataset context injection: ask questions about your logged records and receive accurate answers from the database.
   - Text-to-speech option to read replies aloud, and transcript export.
3. **Environmental Data**:
   - Full tabular ledger of verified observations stored in SQLite.
   - Filter by category (Transport, Energy, Food & Diet, Waste & Recycling) and real-time text search.
   - Log new actions with instant metric recalculation, or delete existing records with confirmation.
4. **Settings**:
   - **Appearance**: Toggle between Light Theme and Dark Theme with instant persistence in local storage.
   - **Response Preferences**: Select between Detailed and Concise response styles.
   - **Chat Management**: Safely clear all chat conversations with confirmation while preserving all environmental observation records in SQLite.
5. **About**:
   - Short, friendly overview of EcoAssistAI helping users discover practical ways to protect nature.
