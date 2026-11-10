/**
 * EcoAssistAI - Generative Environmental Chatbot Controller
 * Generative environmental assistant with SQLite environmental dataset context,
 * manages assistant orb animation states, prevents duplicate submissions, and handles TTS.
 */

let activeConversationId = null;
let lastAssistantSpeechText = "";
let isGenerating = false;

document.addEventListener("DOMContentLoaded", () => {
    initChatInterface();
    loadConversations();
    loadQuickSuggestions();
});

// --- Assistant Orb State Animator ---
function setOrbState(state) {
    const dashboardOrb = document.getElementById("dashboardAiOrb");
    const chatOrb = document.getElementById("chatAiOrb");
    const orbs = [dashboardOrb, chatOrb].filter(Boolean);

    orbs.forEach(orb => {
        orb.classList.remove("thinking", "responding");
        if (state === "thinking") {
            orb.classList.add("thinking");
        } else if (state === "responding") {
            orb.classList.add("responding");
        }
    });
}

// --- Chat Interface Initialization ---
function initChatInterface() {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const newChatBtn = document.getElementById("newChatBtn");
    const clearChatViewBtn = document.getElementById("clearChatViewBtn");
    const exportChatBtn = document.getElementById("exportChatBtn");
    const refreshConvsBtn = document.getElementById("refreshConvsBtn");
    const voiceSpeakBtn = document.getElementById("voiceSpeakBtn");

    // Auto-expand textarea height
    chatInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    // Submit on Enter without Shift
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) {
                chatForm.dispatchEvent(new Event("submit"));
            }
        }
    });

    chatForm.addEventListener("submit", handleSendMessage);

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => startNewSession());
    }

    if (clearChatViewBtn) {
        clearChatViewBtn.addEventListener("click", () => {
            const container = document.getElementById("messagesContainer");
            container.innerHTML = "";
            renderWelcomeMessage();
        });
    }

    if (exportChatBtn) {
        exportChatBtn.addEventListener("click", exportConversation);
    }

    if (refreshConvsBtn) {
        refreshConvsBtn.addEventListener("click", loadConversations);
    }

    if (voiceSpeakBtn) {
        voiceSpeakBtn.addEventListener("click", speakLastResponse);
    }
}

// --- Conversation Management ---
async function loadConversations() {
    const list = document.getElementById("conversationsList");
    if (!list) return;

    try {
        const res = await fetch("/api/conversations");
        const data = await res.json();

        list.innerHTML = "";
        if (!data.conversations || data.conversations.length === 0) {
            list.innerHTML = `<div class="history-loading">No saved sessions yet.</div>`;
            return;
        }

        data.conversations.forEach(conv => {
            const item = document.createElement("div");
            item.className = `history-item ${conv.id === activeConversationId ? 'active' : ''}`;
            item.dataset.id = conv.id;
            
            item.innerHTML = `
                <span class="history-title" title="${escapeHtml(conv.title)}">
                    <i class="fa-regular fa-message" style="margin-right:6px;"></i>${escapeHtml(conv.title)}
                </span>
                <button class="history-del-btn" title="Delete session" data-id="${conv.id}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            // Click to load
            item.addEventListener("click", (e) => {
                if (e.target.closest(".history-del-btn")) return;
                selectConversation(conv.id, conv.title);
            });

            // Delete action with confirmation
            const delBtn = item.querySelector(".history-del-btn");
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                window.showConfirmDialog(
                    "Delete Conversation",
                    `Delete "${conv.title}"? Your environmental observations will not be affected.`,
                    () => deleteConversation(conv.id)
                );
            });

            list.appendChild(item);
        });

        // Default to first conversation if none selected
        if (!activeConversationId && data.conversations.length > 0) {
            selectConversation(data.conversations[0].id, data.conversations[0].title);
        }
    } catch (err) {
        list.innerHTML = `<div class="history-loading" style="color:#ef4444;">Failed to load history</div>`;
    }
}

window.loadConversations = loadConversations;

async function selectConversation(convId, title) {
    activeConversationId = convId;

    const chatTitle = document.getElementById("currentChatTitle");
    if (chatTitle) chatTitle.textContent = title || "EcoAssistAI";

    document.querySelectorAll(".history-item").forEach(item => {
        if (item.dataset.id === convId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    const container = document.getElementById("messagesContainer");
    container.innerHTML = `<div class="history-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading conversation...</div>`;

    try {
        const res = await fetch(`/api/conversations/${convId}`);
        const data = await res.json();

        container.innerHTML = "";
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                appendMessageToUI(msg.role, msg.content, false);
            });
            const lastAssistant = [...data.messages].reverse().find(m => m.role === "assistant");
            if (lastAssistant) lastAssistantSpeechText = lastAssistant.content;
        } else {
            renderWelcomeMessage();
        }
    } catch (err) {
        container.innerHTML = `<div class="history-loading" style="color:#ef4444;">Failed to load messages.</div>`;
    }
}

function startNewSession() {
    activeConversationId = null;
    const chatTitle = document.getElementById("currentChatTitle");
    if (chatTitle) chatTitle.textContent = "New Eco Session";

    document.querySelectorAll(".history-item").forEach(i => i.classList.remove("active"));
    const container = document.getElementById("messagesContainer");
    container.innerHTML = "";
    renderWelcomeMessage();

    if (window.switchAppView) {
        window.switchAppView("chat");
    }
}

window.startNewSession = startNewSession;

async function deleteConversation(convId) {
    try {
        const res = await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
        if (res.ok) {
            window.showToast("Conversation deleted.", "success");
            if (activeConversationId === convId) {
                startNewSession();
            }
            loadConversations();
        }
    } catch (err) {
        window.showToast("Failed to delete session.", "error");
    }
}

// --- Quick Prompt Suggestions ---
async function loadQuickSuggestions() {
    try {
        const res = await fetch("/api/suggestions");
        const data = await res.json();
        if (!data.suggestions) return;

        // Dashboard Chips
        const dashChips = document.getElementById("dashboardChips");
        if (dashChips) {
            dashChips.innerHTML = "";
            data.suggestions.forEach(s => {
                const chip = document.createElement("button");
                chip.className = "quick-chip";
                chip.textContent = s.title;
                chip.addEventListener("click", () => {
                    if (window.switchAppView) window.switchAppView("chat");
                    sendPromptDirectly(s.prompt);
                });
                dashChips.appendChild(chip);
            });
        }

        // Chat Suggestions Row
        const chatChips = document.getElementById("chatSuggestionsRow");
        if (chatChips) {
            chatChips.innerHTML = "";
            data.suggestions.forEach(s => {
                const chip = document.createElement("button");
                chip.className = "chat-chip";
                chip.innerHTML = `<i class="fa-regular fa-lightbulb"></i> ${s.title}`;
                chip.addEventListener("click", () => sendPromptDirectly(s.prompt));
                chatChips.appendChild(chip);
            });
        }
    } catch (err) {
        console.warn("Could not load suggestions:", err);
    }
}

function sendPromptDirectly(promptText) {
    if (isGenerating) return;
    const chatInput = document.getElementById("chatInput");
    chatInput.value = promptText;
    document.getElementById("chatForm").dispatchEvent(new Event("submit"));
}

// --- Sending & Receiving Messages ---
async function handleSendMessage(e) {
    e.preventDefault();
    if (isGenerating) return;

    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const message = chatInput.value.trim();

    if (!message) return;

    // Lock submission state
    isGenerating = true;
    sendBtn.disabled = true;
    chatInput.disabled = true;
    chatInput.value = "";
    chatInput.style.height = "auto";

    // 1. Append user message to UI
    appendMessageToUI("user", message);

    // 2. Set Assistant Orb to 'thinking' state
    setOrbState("thinking");

    // 3. Show typing indicator
    const typingId = showTypingIndicator();

    // 4. Retrieve response style preference
    const response_style = localStorage.getItem("ecoassist_response_style") || "detailed";

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                conversation_id: activeConversationId,
                message: message,
                response_style: response_style
            })
        });

        const data = await res.json();
        removeTypingIndicator(typingId);

        if (res.ok && data.reply) {
            activeConversationId = data.conversation_id;
            lastAssistantSpeechText = data.reply;

            // Orb state to responding
            setOrbState("responding");

            // Append assistant reply
            appendMessageToUI("assistant", data.reply);

            // Refresh conversation title in sidebar
            loadConversations();
        } else {
            setOrbState("idle");
            const errorMsg = data.error || "Unable to reach AI service. Please check your network and API key.";
            appendMessageToUI("assistant", `⚠️ **Inference Notice**: ${errorMsg}`);
            window.showToast("Inference request failed.", "error");
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        setOrbState("idle");
        appendMessageToUI("assistant", "⚠️ **Connection Error**: Could not connect to the Flask server. Please check your terminal.");
        window.showToast("Backend connection error", "error");
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
        setTimeout(() => setOrbState("idle"), 2500);
    }
}

// --- UI Rendering Helpers ---
function appendMessageToUI(role, content, scroll = true) {
    const container = document.getElementById("messagesContainer");
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${role}`;

    const icon = role === "user" ? "fa-user" : "fa-leaf";
    
    // Format markdown for assistant
    let parsedContent = content;
    if (role === "assistant" && window.marked) {
        parsedContent = marked.parse(content);
    } else {
        parsedContent = `<p>${escapeHtml(content)}</p>`;
    }

    wrapper.innerHTML = `
        <div class="msg-avatar">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="msg-bubble">
            <div class="msg-text">${parsedContent}</div>
            ${role === "assistant" ? `
                <div class="msg-actions">
                    <button class="msg-btn-action copy-btn" title="Copy text">
                        <i class="fa-regular fa-copy"></i> Copy
                    </button>
                    <button class="msg-btn-action speak-btn" title="Read aloud">
                        <i class="fa-solid fa-volume-high"></i> Speak
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    // Copy action
    const copyBtn = wrapper.querySelector(".copy-btn");
    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
                setTimeout(() => copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`, 2000);
            });
        });
    }

    // Speak action
    const speakBtn = wrapper.querySelector(".speak-btn");
    if (speakBtn) {
        speakBtn.addEventListener("click", () => speakText(content));
    }

    container.appendChild(wrapper);

    if (scroll) {
        container.scrollTop = container.scrollHeight;
    }
}

function showTypingIndicator() {
    const container = document.getElementById("messagesContainer");
    const typingDiv = document.createElement("div");
    const id = "typing-" + Date.now();
    typingDiv.id = id;
    typingDiv.className = "message-wrapper assistant";
    typingDiv.innerHTML = `
        <div class="msg-avatar">
            <i class="fa-solid fa-leaf"></i>
        </div>
        <div class="msg-bubble">
            <div class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function renderWelcomeMessage() {
    appendMessageToUI(
        "assistant",
        "Hello! I am **EcoAssistAI**, your environmental assistant.\n\n" +
        "You can ask me to:\n" +
        "- **Estimate carbon avoidance** for daily commuting, energy conservation, or sustainable food choices.\n" +
        "- **Analyze your recorded data**, such as which category contributed the highest emission savings.\n" +
        "- **Provide practical sustainability guidance** tailored for everyday life and eco-friendly habits.\n\n" +
        "How can I assist you with your environmental goals today?"
    );
}

// --- Text-To-Speech (SpeechSynthesis) ---
function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = text.replace(/[*#_`>]/g, "").replace(/\[.*?\]\(.*?\)/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function speakLastResponse() {
    if (lastAssistantSpeechText) {
        speakText(lastAssistantSpeechText);
    } else {
        window.showToast("No assistant response available to read aloud.", "error");
    }
}

// --- Export Conversation ---
function exportConversation() {
    const container = document.getElementById("messagesContainer");
    if (!container) return;

    let transcript = "EcoAssistAI - Conversation Transcript\n";
    transcript += "Generated: " + new Date().toLocaleString() + "\n";
    transcript += "AI Provider: EcoAssistAI\n";
    transcript += "=".repeat(50) + "\n\n";

    const messages = container.querySelectorAll(".message-wrapper");
    messages.forEach(msg => {
        const isUser = msg.classList.contains("user");
        const role = isUser ? "USER" : "ECOASSIST AI";
        const text = msg.querySelector(".msg-text") ? msg.querySelector(".msg-text").innerText : "";
        transcript += `[${role}]:\n${text}\n\n`;
    });

    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecoassist_session_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast("Conversation exported successfully!", "success");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}
