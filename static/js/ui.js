/**
 * EcoAssistAI - UI & State Management Controller
 * Handles view navigation, theme persistence (light/dark), response styling,
 * smooth scrolling to AI assistant, confirmation dialogs, and Gemini health checks.
 */

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNavigation();
    initSettingsAndPreferences();
    initModals();
    checkGeminiStatus();

    // Periodic Gemini status check every 45s
    setInterval(checkGeminiStatus, 45000);
});

// --- Theme Management (Light / Dark Mode Persistence) ---
function initTheme() {
    const savedTheme = localStorage.getItem("ecoassist_theme") || "light";
    applyTheme(savedTheme);

    const quickToggleBtn = document.getElementById("quickThemeToggleBtn");
    if (quickToggleBtn) {
        quickToggleBtn.addEventListener("click", () => {
            const current = document.body.classList.contains("dark-theme") ? "dark" : "light";
            const next = current === "light" ? "dark" : "light";
            applyTheme(next);
        });
    }

    const lightOpt = document.getElementById("themeLightOption");
    const darkOpt = document.getElementById("themeDarkOption");

    if (lightOpt) {
        lightOpt.addEventListener("click", () => applyTheme("light"));
    }
    if (darkOpt) {
        darkOpt.addEventListener("click", () => applyTheme("dark"));
    }
}

function applyTheme(theme) {
    const quickToggleBtn = document.getElementById("quickThemeToggleBtn");
    const lightOpt = document.getElementById("themeLightOption");
    const darkOpt = document.getElementById("themeDarkOption");

    if (theme === "dark") {
        document.body.classList.add("dark-theme");
        if (quickToggleBtn) quickToggleBtn.innerHTML = '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>';
        if (lightOpt) lightOpt.classList.remove("active");
        if (darkOpt) darkOpt.classList.add("active");
    } else {
        document.body.classList.remove("dark-theme");
        if (quickToggleBtn) quickToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        if (lightOpt) lightOpt.classList.add("active");
        if (darkOpt) darkOpt.classList.remove("active");
    }

    localStorage.setItem("ecoassist_theme", theme);

    // Refresh charts if open to adapt colors
    if (window.refreshDashboardCharts) {
        window.refreshDashboardCharts();
    }
}

// --- View Navigation & Smooth Content Scroll ---
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view-container");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    const sidebar = document.getElementById("sidebar");
    const openSidebarBtn = document.getElementById("openSidebarBtn");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const jumpToChatBtn = document.getElementById("jumpToChatBtn");
    const viewAllActivityBtn = document.getElementById("viewAllActivityBtn");
    const heroScrollBtn = document.getElementById("heroScrollBtn");
    const brandScrollBtn = document.getElementById("brandScrollBtn");

    const titles = {
        dashboard: {
            title: "Eco Dashboard",
            sub: "Real-time Environmental Analytics & Insights"
        },
        chat: {
            title: "AI Chatbot",
            sub: "Interactive Environmental Assistant"
        },
        data: {
            title: "Environmental Records Ledger",
            sub: "Actual Observations and Carbon Reductions Stored in SQLite"
        },
        settings: {
            title: "Application Settings",
            sub: "Manage Appearance, Response Preferences, and Chat Storage"
        },
        about: {
            title: "About EcoAssistAI",
            sub: "Environmental Learning & Sustainability Companion"
        }
    };

    function switchView(viewName) {
        navItems.forEach(item => {
            if (item.dataset.view === viewName) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        views.forEach(view => {
            if (view.id === `view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`) {
                view.classList.add("active");
            } else {
                view.classList.remove("active");
            }
        });

        if (titles[viewName]) {
            pageTitle.textContent = titles[viewName].title;
            pageSubtitle.textContent = titles[viewName].sub;
        }

        // Close mobile sidebar on navigate
        if (sidebar && sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
        }

        // Trigger specific view loaders
        if (viewName === "dashboard" && window.refreshDashboardCharts) {
            window.refreshDashboardCharts();
        } else if (viewName === "data" && window.loadFullActivityTable) {
            window.loadFullActivityTable();
        }
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => switchView(item.dataset.view));
    });

    if (jumpToChatBtn) {
        jumpToChatBtn.addEventListener("click", () => switchView("chat"));
    }

    if (viewAllActivityBtn) {
        viewAllActivityBtn.addEventListener("click", () => switchView("data"));
    }

    // Smooth Scroll to Content / Assistant
    function scrollToMainContent() {
        const dashboardView = document.getElementById("viewDashboard");
        if (!dashboardView || !dashboardView.classList.contains("active")) {
            switchView("dashboard");
        }

        // Allow micro-tick for view display update if switched
        setTimeout(() => {
            const spotlight = document.getElementById("assistantSpotlightSection");
            const mainWorkspace = document.getElementById("mainWorkspace");
            if (spotlight && mainWorkspace) {
                spotlight.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 60);
    }

    if (heroScrollBtn) {
        heroScrollBtn.addEventListener("click", scrollToMainContent);
    }
    if (brandScrollBtn) {
        brandScrollBtn.addEventListener("click", scrollToMainContent);
    }

    // Mobile Sidebar Toggles
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener("click", () => sidebar.classList.add("open"));
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("open"));
    }

    window.switchAppView = switchView;
}

// --- Response Preferences & Settings ---
function initSettingsAndPreferences() {
    const savedStyle = localStorage.getItem("ecoassist_response_style") || "detailed";
    applyResponseStyle(savedStyle);

    const detailedOpt = document.getElementById("responseDetailedOption");
    const conciseOpt = document.getElementById("responseConciseOption");

    if (detailedOpt) {
        detailedOpt.addEventListener("click", () => applyResponseStyle("detailed"));
    }
    if (conciseOpt) {
        conciseOpt.addEventListener("click", () => applyResponseStyle("concise"));
    }

    // Clear Chat History Button with Safe Confirmation Dialog
    const clearAllChatsBtn = document.getElementById("clearAllChatsBtn");
    if (clearAllChatsBtn) {
        clearAllChatsBtn.addEventListener("click", () => {
            showConfirmDialog(
                "Clear Chat History",
                "Are you sure you want to clear your chat history? All conversation sessions and messages will be removed from SQLite. Your environmental records, observation ledger, and dashboard statistics will remain completely safe.",
                async () => {
                    try {
                        const res = await fetch("/api/chat/clear", { method: "POST" });
                        const data = await res.json();
                        if (res.ok) {
                            showToast(data.message || "Chat history cleared successfully.", "success");
                            if (window.loadConversations) window.loadConversations();
                            if (window.startNewSession) window.startNewSession();
                        } else {
                            showToast("Failed to clear chat history.", "error");
                        }
                    } catch (err) {
                        showToast("Network error clearing chat history.", "error");
                    }
                }
            );
        });
    }
}

function applyResponseStyle(style) {
    const detailedOpt = document.getElementById("responseDetailedOption");
    const conciseOpt = document.getElementById("responseConciseOption");

    if (style === "concise") {
        if (conciseOpt) conciseOpt.classList.add("active");
        if (detailedOpt) detailedOpt.classList.remove("active");
    } else {
        if (detailedOpt) detailedOpt.classList.add("active");
        if (conciseOpt) conciseOpt.classList.remove("active");
    }

    localStorage.setItem("ecoassist_response_style", style);
}

// --- Modals Management ---
function initModals() {
    const logModal = document.getElementById("logModal");
    const confirmModal = document.getElementById("confirmModal");
    const openLogBtn = document.getElementById("openLogModalBtn");
    const openLogFromDataBtn = document.getElementById("openLogModalFromDataBtn");
    const emptyStateLogBtn = document.getElementById("emptyStateLogBtn");
    const closeLogBtn = document.getElementById("closeLogModalBtn");
    const cancelLogBtn = document.getElementById("cancelLogModalBtn");

    const closeConfirmBtn = document.getElementById("closeConfirmModalBtn");
    const cancelConfirmBtn = document.getElementById("cancelConfirmBtn");

    const actDateInput = document.getElementById("actDate");
    if (actDateInput) {
        actDateInput.value = new Date().toISOString().split("T")[0];
    }

    function openModal(modal) {
        if (modal) modal.classList.add("active");
    }

    function closeModal(modal) {
        if (modal) modal.classList.remove("active");
    }

    if (openLogBtn) openLogBtn.addEventListener("click", () => openModal(logModal));
    if (openLogFromDataBtn) openLogFromDataBtn.addEventListener("click", () => openModal(logModal));
    if (emptyStateLogBtn) emptyStateLogBtn.addEventListener("click", () => openModal(logModal));
    if (closeLogBtn) closeLogBtn.addEventListener("click", () => closeModal(logModal));
    if (cancelLogBtn) cancelLogBtn.addEventListener("click", () => closeModal(logModal));

    if (closeConfirmBtn) closeConfirmBtn.addEventListener("click", () => closeModal(confirmModal));
    if (cancelConfirmBtn) cancelConfirmBtn.addEventListener("click", () => closeModal(confirmModal));

    window.addEventListener("click", (e) => {
        if (e.target === logModal) closeModal(logModal);
        if (e.target === confirmModal) closeModal(confirmModal);
    });

    window.closeLogActionModal = () => closeModal(logModal);
}

// --- Custom Confirmation Dialog ---
function showConfirmDialog(title, message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const confirmBtn = document.getElementById("actionConfirmBtn");

    if (!modal) return;

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> ${title}`;
    if (msgEl) msgEl.textContent = message;

    // Remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", () => {
        modal.classList.remove("active");
        if (onConfirm) onConfirm();
    });

    modal.classList.add("active");
}

window.showConfirmDialog = showConfirmDialog;

// --- Toast Notifications ---
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    
    const icon = type === "success" ? "fa-circle-check" : "fa-triangle-exclamation";
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.showToast = showToast;

// --- Gemini Health Check ---
async function checkGeminiStatus() {
    const statusPulse = document.getElementById("statusPulse");
    const statusText = document.getElementById("statusText");
    const statusSub = document.getElementById("statusSub");

    if (!statusPulse || !statusText || !statusSub) return;

    try {
        const res = await fetch("/api/status");
        const data = await res.json();

        if (data.online) {
            statusPulse.classList.remove("offline");
            statusText.textContent = "AI Online";
            statusSub.textContent = "AI Assistant";
        } else {
            statusPulse.classList.add("offline");
            statusText.textContent = "AI Offline";
            statusSub.textContent = "Service Unavailable";
        }
    } catch (err) {
        statusPulse.classList.add("offline");
        statusText.textContent = "Server Error";
        statusSub.textContent = "Check Flask Backend";
    }
}
