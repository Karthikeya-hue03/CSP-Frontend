/**
 * =============================================================================
 * Campus Infrastructure Monitoring & Predictive Maintenance System
 * Global Client Script: UI Interactions, Modals, Toasts, and AJAX Handlers
 * =============================================================================
 */

/**
 * Global Document Initialization:
 * Binds responsive navigation toggles, mobile backdrop dismissals,
 * and auto-dismiss timers for flash notification alerts.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Step 1: Bind Mobile Sidebar Drawer Toggle
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            // Toggle visibility classes for mobile screens
            sidebar.classList.toggle('show-mobile');
            if (backdrop) backdrop.classList.toggle('show');
        });
    }

    // Step 2: Close mobile sidebar when backdrop is tapped
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('show-mobile');
            backdrop.classList.remove('show');
        });
    }

    // Step 3: Automatically dismiss server flash banners after 5 seconds
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            if (bsAlert) bsAlert.close();
        }, 5000);
    });
});

/**
 * Displays a non-intrusive Bootstrap 5 Toast notification in the lower-right viewport.
 * 
 * @param {string} message - Text notification message to display to the user.
 * @param {string} [type='info'] - Alert severity level: 'success', 'danger'/'error', 'warning', or 'info'.
 * @returns {void}
 */
function showToast(message, type = 'info') {
    // Step 1: Locate or create the fixed toast container in the DOM
    let toastContainer = document.getElementById('toastPlacement');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastPlacement';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '1090';
        document.body.appendChild(toastContainer);
    }

    // Step 2: Determine appropriate Bootstrap contextual color class
    const colorClass = (type === 'error' || type === 'danger') ? 'danger' : type;

    // Step 3: Select matching icon based on notification type
    const iconClass = type === 'success' 
        ? 'bi-check-circle-fill' 
        : (type === 'danger' || type === 'error') 
            ? 'bi-exclamation-triangle-fill' 
            : 'bi-info-circle-fill';

    // Step 4: Construct toast DOM element with accessibility attributes
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${colorClass} border-0 shadow-lg`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${iconClass}"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    // Step 5: Mount to container, trigger Bootstrap animation, and schedule auto-cleanup
    toastContainer.appendChild(toastEl);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
    bsToast.show();

    // Remove element from DOM once fade-out completes
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * Asynchronously retrieves complete telemetry and AI prediction insights for an asset
 * and populates the details modal popup dialog.
 * 
 * @param {number} assetId - Primary key ID of the target asset.
 * @returns {Promise<void>}
 */
async function viewAssetDetails(assetId) {
    // Step 1: Ensure modal element exists on current page
    const modalEl = document.getElementById('assetDetailModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);

    // Step 2: Display loading spinner while network request is pending
    const bodyEl = document.getElementById('assetDetailModalBody');
    bodyEl.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Fetching asset telemetry and AI predictions...</p>
        </div>
    `;
    modal.show();

    // Step 3: Fetch joined asset details, subtable telemetry, and Scikit-learn predictions
    try {
        const res = await fetch(`/api/assets/${assetId}`);
        if (!res.ok) throw new Error("Could not fetch asset details from server");
        const data = await res.json();
        
        const a = data.asset;
        const details = data.details || {};
        const ai = data.ai_prediction || {};

        // Step 4: Format category-specific telemetry specifications
        let specificHtml = '';
        if (a.asset_type === 'streetlight') {
            specificHtml = `
                <div class="col-md-6 mb-2"><strong>Pole Number:</strong> ${details.pole_number || 'N/A'}</div>
                <div class="col-md-6 mb-2"><strong>Wattage:</strong> ${details.wattage || 70}W</div>
                <div class="col-md-6 mb-2"><strong>Power Status:</strong> <span class="badge ${details.power_status === 'ON' ? 'bg-success' : 'bg-danger'}">${details.power_status}</span></div>
                <div class="col-md-6 mb-2"><strong>Light Status:</strong> ${details.light_status || 'Working'}</div>
                <div class="col-md-6 mb-2"><strong>Lumens:</strong> ${details.lumens || 6500} lm</div>
            `;
        } else if (a.asset_type === 'road') {
            specificHtml = `
                <div class="col-md-6 mb-2"><strong>Length:</strong> ${details.length_km || 1.0} km</div>
                <div class="col-md-6 mb-2"><strong>Surface Type:</strong> ${details.surface_type || 'Asphalt'}</div>
                <div class="col-md-6 mb-2"><strong>Pothole Count:</strong> ${details.pothole_count || 0}</div>
                <div class="col-md-6 mb-2"><strong>Crack Severity:</strong> ${details.crack_severity || 'None'}</div>
                <div class="col-md-6 mb-2"><strong>Priority:</strong> <span class="badge bg-secondary">${details.priority}</span></div>
            `;
        } else if (a.asset_type === 'water_pipeline') {
            specificHtml = `
                <div class="col-md-6 mb-2"><strong>Pipeline Code:</strong> ${details.pipeline_code || 'N/A'}</div>
                <div class="col-md-6 mb-2"><strong>Length:</strong> ${details.length_km || 0.5} km</div>
                <div class="col-md-6 mb-2"><strong>Pipe Material:</strong> ${details.pipe_material || 'HDPE'}</div>
                <div class="col-md-6 mb-2"><strong>Leak Status:</strong> <span class="badge ${details.leak_status === 'Normal' ? 'bg-success' : 'bg-danger'}">${details.leak_status}</span></div>
                <div class="col-md-6 mb-2"><strong>Flow Rate:</strong> ${details.water_flow_rate || 45} L/min</div>
                <div class="col-md-6 mb-2"><strong>Pressure:</strong> ${details.pressure_psi || 55} PSI</div>
            `;
        } else if (a.asset_type === 'drainage') {
            specificHtml = `
                <div class="col-md-6 mb-2"><strong>Drain Code:</strong> ${details.drain_code || 'N/A'}</div>
                <div class="col-md-6 mb-2"><strong>Type:</strong> ${details.drain_type || 'Storm Water'}</div>
                <div class="col-md-6 mb-2"><strong>Flow Status:</strong> <span class="badge ${details.flow_status === 'Normal' ? 'bg-success' : 'bg-danger'}">${details.flow_status}</span></div>
                <div class="col-md-6 mb-2"><strong>Blockage Level:</strong> ${details.blockage_level || 'None'}</div>
                <div class="col-md-6 mb-2"><strong>Stagnation Risk:</strong> ${details.stagnation_risk || 'Low'}</div>
            `;
        }

        // Step 5: Determine risk badge color based on AI classification
        const riskBadge = ai.risk_level === 'High Risk' 
            ? 'bg-danger' 
            : ai.risk_level === 'Medium Risk' 
                ? 'bg-warning text-dark' 
                : 'bg-success';

        // Step 6: Render HTML layout with KPI header, AI card, and telemetry grid
        bodyEl.innerHTML = `
            <div class="card border-0 mb-3 bg-light p-3 rounded-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary text-uppercase me-1">${a.asset_type.replace('_', ' ')}</span>
                        <span class="badge bg-dark">${a.asset_tag}</span>
                        <h5 class="mt-2 mb-0 fw-bold">${a.name}</h5>
                        <p class="text-muted small mb-0"><i class="bi bi-geo-alt"></i> ${a.location}</p>
                    </div>
                    <div class="text-end">
                        <div class="display-6 fw-bold ${a.health_score >= 80 ? 'text-success' : a.health_score >= 60 ? 'text-warning' : 'text-danger'}">${a.health_score}</div>
                        <span class="text-muted small">Health Score</span>
                    </div>
                </div>
            </div>

            <!-- AI Risk Card -->
            <div class="card border mb-3 p-3 rounded-3" style="background: linear-gradient(to right, #f8fafc, #f1f5f9);">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold small text-uppercase text-secondary"><i class="bi bi-cpu"></i> Scikit-Learn AI Health Prediction</span>
                    <span class="badge ${riskBadge} px-3 py-1">${ai.risk_level}</span>
                </div>
                <div class="row g-2 small">
                    <div class="col-6"><strong>Predicted Action:</strong> ${ai.recommended_window}</div>
                    <div class="col-6"><strong>Failure Prob:</strong> ${ai.high_risk_probability}% High / ${ai.medium_risk_probability}% Med</div>
                    <div class="col-12 text-muted fst-italic mt-1">${ai.recommended_action}</div>
                </div>
            </div>

            <h6 class="fw-bold text-dark border-bottom pb-2 mb-3">Specifications & Telemetry</h6>
            <div class="row g-2 small text-secondary mb-3">
                <div class="col-md-6 mb-2"><strong>Coordinates:</strong> ${a.latitude}, ${a.longitude}</div>
                <div class="col-md-6 mb-2"><strong>Condition:</strong> <span class="badge bg-secondary">${a.condition_status}</span></div>
                <div class="col-md-6 mb-2"><strong>Age:</strong> ${a.age_years} Years</div>
                <div class="col-md-6 mb-2"><strong>Previous Failures:</strong> ${a.previous_failures}</div>
                <div class="col-md-6 mb-2"><strong>Complaints:</strong> ${a.complaint_count}</div>
                <div class="col-md-6 mb-2"><strong>Last Inspection:</strong> ${a.last_inspection || 'N/A'}</div>
                <div class="col-md-6 mb-2"><strong>Next Maintenance:</strong> ${a.next_maintenance || 'N/A'}</div>
                ${specificHtml}
            </div>
        `;
    } catch (err) {
        // Step 7: Handle network or parsing errors gracefully
        bodyEl.innerHTML = `<div class="alert alert-danger">Failed to load asset details: ${err.message}</div>`;
    }
}

/**
 * Universal deletion confirmation handler with HTTP DELETE AJAX call.
 * 
 * @param {string} url - Target REST API endpoint to issue the DELETE request against.
 * @param {string} itemLabel - User-friendly label of the resource being removed.
 * @returns {void}
 */
function confirmDelete(url, itemLabel) {
    // Step 1: Prompt user for confirmation before irrevocable action
    if (confirm(`Are you sure you want to delete ${itemLabel}? This operation cannot be undone.`)) {
        // Step 2: Issue asynchronous DELETE request with JSON headers
        fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            // Step 3: Handle deletion outcome and refresh UI
            if (data.success) {
                showToast(data.message || 'Deleted successfully', 'success');
                setTimeout(() => window.location.reload(), 800);
            } else {
                showToast(data.error || 'Failed to delete', 'danger');
            }
        })
        .catch(err => showToast(err.message, 'danger'));
    }
}
