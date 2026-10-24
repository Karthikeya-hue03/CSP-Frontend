/**
 * =============================================================================
 * Campus Infrastructure Monitoring & Predictive Maintenance System
 * AI Predictive Maintenance Interactive Sandbox & Evaluation Tool
 * =============================================================================
 */

/**
 * Main DOM Initialization:
 * Attaches form submission handlers and asset auto-fill event listeners.
 */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('aiPredictForm');
    const assetSelect = document.getElementById('predictAssetSelect');

    // Step 1: Bind asset dropdown selection handler for quick telemetry loading
    if (assetSelect) {
        assetSelect.addEventListener('change', async (e) => {
            const assetId = e.target.value;
            if (!assetId) return;

            // Fetch selected asset telemetry from the server
            try {
                const res = await fetch(`/api/assets/${assetId}`);
                if (!res.ok) throw new Error("Could not fetch asset telemetry");
                const data = await res.json();
                const a = data.asset;

                // Step 1a: Pre-fill input form fields with live asset telemetry
                document.getElementById('inputAge').value = a.age_years || 2;
                document.getElementById('inputFailures').value = a.previous_failures || 0;
                document.getElementById('inputHealth').value = a.health_score || 85;
                document.getElementById('inputComplaints').value = a.complaint_count || 0;
                document.getElementById('inputCondition').value = a.condition_status || 'Good';
                
                // Step 1b: Automatically trigger Scikit-learn inference with loaded features
                runAiPrediction();
            } catch (err) {
                console.error("Asset telemetry retrieval error:", err);
            }
        });
    }

    // Step 2: Bind manual form submit for custom telemetry simulation
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent standard HTTP form submission
            runAiPrediction();
        });
    }
});

/**
 * Executes real-time Machine Learning model inference by sending telemetry
 * features to the Flask /api/predict endpoint and rendering the output probabilities,
 * days-to-failure estimations, and recommended prescriptive actions.
 * 
 * @returns {Promise<void>}
 */
async function runAiPrediction() {
    // Step 1: Extract feature inputs from the telemetry control form
    const age = document.getElementById('inputAge').value;
    const failures = document.getElementById('inputFailures').value;
    const health = document.getElementById('inputHealth').value;
    const complaints = document.getElementById('inputComplaints').value;
    const condition = document.getElementById('inputCondition').value;
    const daysSince = document.getElementById('inputDaysSince') ? document.getElementById('inputDaysSince').value : 30;
    const inspection = document.getElementById('inputInspection') ? document.getElementById('inputInspection').value : 4;
    const maintCount = document.getElementById('inputMaintCount') ? document.getElementById('inputMaintCount').value : 1;

    // Step 2: Grab DOM container references for result card and loading spinner
    const resultCard = document.getElementById('predictionResultCard');
    const spinner = document.getElementById('predictSpinner');

    // Display loading indicator
    if (spinner) spinner.classList.remove('d-none');

    try {
        // Step 3: Dispatch asynchronous POST request to the Scikit-learn prediction endpoint
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                age_years: age,
                previous_failures: failures,
                health_score: health,
                complaint_count: complaints,
                condition: condition,
                days_since_last_maintenance: daysSince,
                inspection_frequency: inspection,
                previous_maintenance_count: maintCount
            })
        });

        if (!response.ok) throw new Error("AI prediction request failed on the server");
        const res = await response.json();

        // Step 4: Render inference results into the evaluation card
        if (resultCard) {
            resultCard.classList.remove('d-none');
            
            // Step 4a: Update classification risk badge and color token
            const badgeEl = document.getElementById('resRiskBadge');
            badgeEl.className = `badge fs-5 px-3 py-2 bg-${res.badge_color}`;
            badgeEl.textContent = res.risk_level.toUpperCase();

            // Step 4b: Populate predictive maintenance windows and days to failure
            document.getElementById('resWindow').textContent = res.recommended_window;
            document.getElementById('resAction').textContent = res.recommended_action;
            document.getElementById('resDays').textContent = `${res.predicted_failure_days} Days`;

            // Step 4c: Update probability progress distribution bars
            const highBar = document.getElementById('barHighRisk');
            const medBar = document.getElementById('barMedRisk');
            const lowBar = document.getElementById('barLowRisk');

            if (highBar) {
                highBar.style.width = `${res.high_risk_probability}%`;
                highBar.textContent = `${res.high_risk_probability}%`;
            }
            if (medBar) {
                medBar.style.width = `${res.medium_risk_probability}%`;
                medBar.textContent = `${res.medium_risk_probability}%`;
            }
            if (lowBar) {
                lowBar.style.width = `${res.low_risk_probability}%`;
                lowBar.textContent = `${res.low_risk_probability}%`;
            }
        }
    } catch (err) {
        // Step 5: Notify user if the prediction request failed
        showToast(err.message, 'danger');
    } finally {
        // Step 6: Dismiss loading spinner regardless of success or failure
        if (spinner) spinner.classList.add('d-none');
    }
}
