/**
 * =============================================================================
 * Campus Infrastructure Monitoring & Predictive Maintenance System
 * Dashboard Data Visualizations using Chart.js v4.x
 * =============================================================================
 */

// Global object to maintain references to active Chart instances for proper destruction/re-draw
let charts = {};

/**
 * Main DOM Initialization:
 * Triggers chart creation once the DOM hierarchy has fully resolved.
 */
document.addEventListener('DOMContentLoaded', () => {
    initDashboardCharts();
});

/**
 * Asynchronously loads aggregated dashboard metric payloads from the Flask backend
 * and dispatches datasets to the corresponding Chart.js canvas renderers.
 * 
 * @returns {Promise<void>}
 */
async function initDashboardCharts() {
    try {
        // Step 1: Request structured chart payloads from backend REST endpoint
        const response = await fetch('/api/dashboard/charts');
        if (!response.ok) throw new Error("Failed to load chart datasets from /api/dashboard/charts");
        const data = await response.json();

        // Step 2: Render Chart 1 - Overall Campus Health Score (Semi-Gauge / Doughnut)
        renderOverallHealthChart(data.overall_health);

        // Step 3: Render Chart 2 - Asset Condition Distribution (Categorical Bar Chart)
        renderConditionChart(data.condition_distribution);

        // Step 4: Render Chart 3 - 6-Month Maintenance Activity Trends (Dual-Line Chart)
        renderTrendsChart(data.maintenance_trends);

        // Step 5: Render Chart 4 - Critical Issues Grouped by Asset Type (Horizontal Bar Chart)
        renderProblemsByTypeChart(data.problems_by_type);

        // Step 6: Render Chart 5 - Monthly Work Order Distribution by Priority (Doughnut Chart)
        renderMonthlyStatsChart(data.monthly_stats);

    } catch (err) {
        console.error("Dashboard visualizer initialization error:", err);
    }
}

/**
 * Visualizes the campus-wide health score using a radial semi-gauge doughnut chart.
 * 
 * @param {Object} healthData - Health metric payload containing 'score' and 'data'.
 * @param {number} healthData.score - Calculated campus health index (0 to 100).
 * @param {number[]} healthData.data - [score, 100 - score] distribution.
 * @returns {void}
 */
function renderOverallHealthChart(healthData) {
    const ctx = document.getElementById('overallHealthChart');
    if (!ctx) return;

    // Step 1: Destroy previous instance to prevent canvas memory leaks / ghosting
    if (charts.health) charts.health.destroy();

    // Step 2: Select theme color based on operational health thresholds
    const score = healthData.score || 78;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    // Step 3: Instantiate Chart.js doughnut with a 270-degree circumference arc
    charts.health = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Health Score', 'Deficit'],
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [color, '#e2e8f0'],
                borderWidth: 0,
                circumference: 270,
                rotation: 225
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%', // Thin arc resembling a modern vehicle or equipment gauge
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Visualizes distribution of campus infrastructure condition ratings across 4 tiers.
 * 
 * @param {Object} condData - Condition classification data.
 * @param {string[]} condData.labels - Rating names: ['Good', 'Moderate', 'Poor', 'Critical'].
 * @param {number[]} condData.data - Asset counts per condition.
 * @param {string[]} condData.colors - Hex codes corresponding to each rating level.
 * @returns {void}
 */
function renderConditionChart(condData) {
    const ctx = document.getElementById('conditionChart');
    if (!ctx) return;

    // Step 1: Destroy previous chart instance if present
    if (charts.condition) charts.condition.destroy();

    // Step 2: Build vertical column bar chart with rounded corners
    charts.condition = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: condData.labels,
            datasets: [{
                label: 'Assets Count',
                data: condData.data,
                backgroundColor: condData.colors,
                borderRadius: 8,
                barThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Renders a dual-line trend chart comparing reported maintenance issues vs resolved tickets.
 * 
 * @param {Object} trendsData - Time series data over a 6-month trailing window.
 * @param {string[]} trendsData.labels - Month names: ['Apr', 'May', 'Jun', ...].
 * @param {number[]} trendsData.reported - Monthly count of reported problems.
 * @param {number[]} trendsData.completed - Monthly count of completed work orders.
 * @returns {void}
 */
function renderTrendsChart(trendsData) {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;

    // Step 1: Clean up any prior line chart instance
    if (charts.trends) charts.trends.destroy();

    // Step 2: Build multi-dataset area spline line chart
    charts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendsData.labels,
            datasets: [
                {
                    label: 'Issues Reported',
                    data: trendsData.reported,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35, // Smooth cubic spline curvature
                    pointRadius: 4
                },
                {
                    label: 'Resolved / Completed',
                    data: trendsData.completed,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 14, font: { size: 12 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Renders a horizontal bar chart identifying defect concentrations by infrastructure category.
 * 
 * @param {Object} probData - Problem count dataset.
 * @param {string[]} probData.labels - Category names ('Streetlights', 'Roads', etc.).
 * @param {number[]} probData.data - Counts of assets in Poor or Critical condition.
 * @param {string[]} probData.colors - Palette colors for each category bar.
 * @returns {void}
 */
function renderProblemsByTypeChart(probData) {
    const ctx = document.getElementById('problemsByTypeChart');
    if (!ctx) return;

    // Step 1: Destroy prior instance
    if (charts.problems) charts.problems.destroy();

    // Step 2: Build horizontal bar chart (indexAxis: 'y') for optimal label readability
    charts.problems = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: probData.labels,
            datasets: [{
                label: 'Critical / Poor Issues',
                data: probData.data,
                backgroundColor: probData.colors,
                borderRadius: 8,
                barThickness: 24
            }]
        },
        options: {
            indexAxis: 'y', // Renders bars horizontally
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Renders a doughnut breakdown of active work orders grouped by priority urgency.
 * 
 * @param {Object} monthlyData - Priority volume distribution.
 * @param {string[]} monthlyData.labels - Urgency tiers: ['Urgent', 'High Priority', ...].
 * @param {number[]} monthlyData.data - Task counts per priority.
 * @param {string[]} monthlyData.colors - Contextual hex color codes.
 * @returns {void}
 */
function renderMonthlyStatsChart(monthlyData) {
    const ctx = document.getElementById('monthlyStatsChart');
    if (!ctx) return;

    // Step 1: Destroy prior instance
    if (charts.monthly) charts.monthly.destroy();

    // Step 2: Build priority distribution doughnut chart
    charts.monthly = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                data: monthlyData.data,
                backgroundColor: monthlyData.colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                }
            }
        }
    });
}
