"""
EcoAssistAI - Prompt Engineering & Environmental System Prompts
Provides domain-specific guidance, dataset context injection, and response styling for Gemini API.
"""

BASE_SYSTEM_PROMPT = """You are EcoAssistAI, an intelligent, friendly, and knowledgeable AI-powered environmental assistance chatbot.

Your role:
1. Provide accurate, practical, and scientifically sound advice on environmental sustainability, carbon emission reduction, energy conservation, waste management, and sustainable living.
2. Answer in clear, accessible, and respectful language suitable for university students, educators, and eco-conscious citizens.
3. Quantify carbon emission savings (in kg CO2e) where relevant using recognized environmental benchmarks.
4. If asked about the user's recorded environmental actions, statistics, or database records, consult the provided "Actual User Environmental Dataset Summary" below.
   - If the requested data is present in the dataset, answer accurately using the real numbers.
   - If the requested information is NOT in the dataset, clearly state that it is currently unavailable in the records instead of inventing facts.
5. Support normal conversational follow-up questions and maintain helpful context.
"""

QUICK_SUGGESTIONS = [
    {
        "title": "Room Plastic Reduction",
        "prompt": "How can I eliminate single-use plastics in a student dorm or apartment on a modest budget?"
    },
    {
        "title": "Commute Carbon Audit",
        "prompt": "Estimate the monthly carbon footprint for a daily 10 km scooter commute versus public transit."
    },
    {
        "title": "Dorm Energy Efficiency",
        "prompt": "What are 5 practical ways to reduce electricity consumption in computer labs and study rooms?"
    },
    {
        "title": "Dataset Summary",
        "prompt": "Summarize the environmental actions recorded in my database and tell me which category has saved the most CO2."
    }
]

def get_system_prompt(dataset_context="", response_style="detailed"):
    """
    Construct the system instruction string for Google Gemini.
    Integrates actual database context and user's response length preference.
    """
    system_content = BASE_SYSTEM_PROMPT

    if dataset_context:
        system_content += f"\n\n--- CURRENT REAL DATASET CONTEXT ---\n{dataset_context}\n-----------------------------------"

    if response_style == "concise":
        system_content += "\n\nResponse Format: Provide a concise, focused response in 2-4 sentences with 2-3 brief bullet points. Avoid unnecessary fluff."
    else:
        system_content += "\n\nResponse Format: Provide a comprehensive, structured response with clear headings, bullet points, quantitative estimates, and actionable steps."

    return system_content

def format_chat_prompt(conversation_history, current_user_message, dataset_context="", response_style="detailed"):
    """
    Backward-compatible helper returning message list.
    """
    system_content = get_system_prompt(dataset_context, response_style)
    messages = [{"role": "system", "content": system_content}]

    for msg in conversation_history[-8:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    messages.append({
        "role": "user",
        "content": current_user_message
    })

    return messages
