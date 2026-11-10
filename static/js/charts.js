/**
 * EcoAssistAI - Chart.js & Environmental Analytics Controller
 * Renders category comparisons and 7-day trendlines using actual SQLite database records.
 * Manages the environmental ledger, category filtering, search, and activity logging.
 */

let categoryChart = null;
let trendChart = null;
let currentDataFilter = "all";
let currentSearchTerm = "";

document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    loadAnalyticsData();
    initActivityForm();
    initDataViewControls();
});

// --- Initialize Chart.js Instances ---
function initCharts() {
    const isDark = document.body.classList.contains("dark-theme");
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(226, 232, 240, 0.8)";

    // 1. Category Distribution Doughnut Chart
    const ctxCat = document.getElementById("categoryDoughnutChart");
    if (ctxCat) {
        categoryChart = new Chart(ctxCat.getContext("2d"), {
            type: "doughnut",
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        "#0284c7", // Sky Blue (Transport)
                        "#f59e0b", // Amber (Energy)
                        "#10b981", // Emerald (Food & Diet)
                        "#8b5cf6", // Purple (Waste & Recycling)
                        "#ec4899", // Pink (General/Other)
                        "#14b8a6"  // Teal
                    ],
                    borderWidth: 2,
                    borderColor: isDark ? "#0f2119" : "#ffffff",
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            boxWidth: 12,
                            padding: 14,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" },
                            color: textColor
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw} kg CO₂e`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. 7-Day Trend Smooth Line Chart
    const ctxTrend = document.getElementById("weeklyTrendLineChart");
    if (ctxTrend) {
        const gradient = ctxTrend.getContext("2d").createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.35)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

        trendChart = new Chart(ctxTrend.getContext("2d"), {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "CO₂e Avoided (kg)",
                    data: [],
                    borderColor: "#10b981",
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.38,
                    pointBackgroundColor: isDark ? "#0f2119" : "#ffffff",
                    pointBorderColor: "#059669",
                    pointBorderWidth: 2.5,
                    pointRadius: 4.5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Saved: ${context.raw} kg CO₂e`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
                        }
                    }
                }
            }
        });
    }
}

// --- Fetch and Update Analytics ---
async function loadAnalyticsData() {
    try {
        const res = await fetch("/api/analytics");
        const json = await res.json();

        if (json.summary) {
            updateDashboardKPIs(json.summary);
            updateCharts(json.summary);
            handleEmptyState(json.summary.has_data);
        }

        if (json.recent_activities) {
            renderRecentActivityTable(json.recent_activities);
        }
    } catch (err) {
        console.error("Failed to load analytics data:", err);
    }
}

// Show/Hide Empty State based on real record count
function handleEmptyState(hasData) {
    const emptyState = document.getElementById("dashboardEmptyState");
    const chartsGrid = document.getElementById("dashboardChartsGrid");

    if (emptyState && chartsGrid) {
        if (!hasData) {
            emptyState.style.display = "block";
            chartsGrid.style.opacity = "0.4";
            chartsGrid.style.pointerEvents = "none";
        } else {
            emptyState.style.display = "none";
            chartsGrid.style.opacity = "1";
            chartsGrid.style.pointerEvents = "auto";
        }
    }
}

// Update Top Metric Cards with strictly real numbers
function updateDashboardKPIs(summary) {
    const statActionCount = document.getElementById("statActionCount");
    const statTotalCo2 = document.getElementById("statTotalCo2");
    const statTrees = document.getElementById("statTrees");
    const statTargetNumber = document.getElementById("statTargetNumber");
    const statProgressPct = document.getElementById("statProgressPct");
    const statProgressBar = document.getElementById("statProgressBar");

    if (statActionCount) statActionCount.textContent = summary.activities_count;
    if (statTotalCo2) statTotalCo2.textContent = summary.total_co2_kg.toFixed(2);
    if (statTrees) statTrees.textContent = summary.trees_equivalent.toFixed(2);
    if (statTargetNumber) statTargetNumber.textContent = summary.target_kg;
    if (statProgressPct) statProgressPct.textContent = `${summary.progress_pct}%`;
    if (statProgressBar) statProgressBar.style.width = `${Math.min(100, summary.progress_pct)}%`;
}

// Update Chart.js datasets from actual database values
function updateCharts(summary) {
    const isDark = document.body.classList.contains("dark-theme");
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(226, 232, 240, 0.8)";

    if (categoryChart && summary.categories) {
        categoryChart.data.labels = summary.categories.labels;
        categoryChart.data.datasets[0].data = summary.categories.data;
        categoryChart.options.plugins.legend.labels.color = textColor;
        categoryChart.data.datasets[0].borderColor = isDark ? "#0f2119" : "#ffffff";
        categoryChart.update();
    }

    if (trendChart && summary.weekly_trend) {
        trendChart.data.labels = summary.weekly_trend.labels;
        trendChart.data.datasets[0].data = summary.weekly_trend.data;
        trendChart.options.scales.x.ticks.color = textColor;
        trendChart.options.scales.y.ticks.color = textColor;
        trendChart.options.scales.y.grid.color = gridColor;
        trendChart.update();
    }
}

// Render Recent 5 Activities in Dashboard View
function renderRecentActivityTable(activities) {
    const recentBody = document.getElementById("recentActivityTableBody");
    if (!recentBody) return;

    recentBody.innerHTML = "";
    const top5 = activities.slice(0, 5);

    if (top5.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No environmental records logged yet. Click 'Log Eco Action' to start!</td></tr>`;
        return;
    }

    top5.forEach(act => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${act.date}</td>
            <td><span class="cat-badge ${getBadgeClass(act.category)}">${act.category}</span></td>
            <td><strong>${escapeHtml(act.activity_name)}</strong></td>
            <td><span class="co2-badge">-${act.co2_saved_kg} kg</span></td>
        `;
        recentBody.appendChild(tr);
    });
}

// --- Environmental Data View (Complete Ledger) ---
function initDataViewControls() {
    const filterChips = document.querySelectorAll(".filter-chip");
    const searchInput = document.getElementById("dataSearchInput");

    filterChips.forEach(chip => {
        chip.addEventListener("click", () => {
            filterChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            currentDataFilter = chip.dataset.filter;
            loadFullActivityTable();
        });
    });

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentSearchTerm = e.target.value.trim();
                loadFullActivityTable();
            }, 300);
        });
    }
}

async function loadFullActivityTable() {
    const fullBody = document.getElementById("fullDataTableBody");
    if (!fullBody) return;

    fullBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading records...</td></tr>`;

    try {
        let url = `/api/activities?category=${encodeURIComponent(currentDataFilter)}`;
        if (currentSearchTerm) {
            url += `&search=${encodeURIComponent(currentSearchTerm)}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        const records = data.activities || [];

        fullBody.innerHTML = "";
        if (records.length === 0) {
            fullBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2.5rem;">No matching environmental observations found.</td></tr>`;
            return;
        }

        records.forEach((act, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${act.date}</td>
                <td><span class="cat-badge ${getBadgeClass(act.category)}">${act.category}</span></td>
                <td><strong>${escapeHtml(act.activity_name)}</strong></td>
                <td><span class="co2-badge">-${act.co2_saved_kg} kg</span></td>
                <td style="color:var(--text-secondary); font-size:0.8rem;">${escapeHtml(act.notes || "—")}</td>
                <td>
                    <button class="btn-action-del" title="Delete record" data-id="${act.id}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            const delBtn = tr.querySelector(".btn-action-del");
            delBtn.addEventListener("click", () => {
                window.showConfirmDialog(
                    "Delete Environmental Record",
                    `Are you sure you want to delete observation "${act.activity_name}"? This will recalculate carbon avoidance metrics.`,
                    async () => {
                        try {
                            const delRes = await fetch(`/api/activity/${act.id}`, { method: "DELETE" });
                            const delData = await delRes.json();
                            if (delRes.ok) {
                                window.showToast("Record removed.", "success");
                                loadFullActivityTable();
                                loadAnalyticsData();
                            } else {
                                window.showToast("Failed to delete record.", "error");
                            }
                        } catch (e) {
                            window.showToast("Network error deleting record.", "error");
                        }
                    }
                );
            });

            fullBody.appendChild(tr);
        });
    } catch (err) {
        fullBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:1.5rem;">Error loading records.</td></tr>`;
    }
}

window.loadFullActivityTable = loadFullActivityTable;

// --- Form Submission for Logging New Activity ---
function initActivityForm() {
    const form = document.getElementById("logActivityForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const category = document.getElementById("actCategory").value;
        const activity_name = document.getElementById("actName").value.trim();
        const co2_saved_kg = parseFloat(document.getElementById("actCo2").value);
        const date = document.getElementById("actDate").value;
        const notes = document.getElementById("actNotes").value.trim();

        if (!activity_name || isNaN(co2_saved_kg) || co2_saved_kg <= 0) {
            window.showToast("Please enter a valid activity title and positive CO2 value.", "error");
            return;
        }

        const saveBtn = document.getElementById("saveActivityBtn");
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        try {
            const res = await fetch("/api/activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, activity_name, co2_saved_kg, date, notes })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                window.showToast(data.message, "success");
                if (data.summary) {
                    updateDashboardKPIs(data.summary);
                    updateCharts(data.summary);
                    handleEmptyState(data.summary.has_data);
                }
                if (data.recent_activities) {
                    renderRecentActivityTable(data.recent_activities);
                }
                loadFullActivityTable();

                form.reset();
                document.getElementById("actDate").value = new Date().toISOString().split("T")[0];
                if (window.closeLogActionModal) window.closeLogActionModal();
            } else {
                window.showToast(data.error || "Failed to save observation.", "error");
            }
        } catch (err) {
            window.showToast("Network error communicating with server.", "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save to Database`;
        }
    });
}

function getBadgeClass(cat) {
    const c = (cat || "").toLowerCase();
    if (c.includes("trans")) return "transport";
    if (c.includes("energy")) return "energy";
    if (c.includes("food") || c.includes("diet")) return "food";
    return "waste";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

window.refreshDashboardCharts = () => {
    if (categoryChart) categoryChart.resize();
    if (trendChart) trendChart.resize();
};
