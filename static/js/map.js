/**
 * =============================================================================
 * Campus Infrastructure Monitoring & Predictive Maintenance System
 * Leaflet.js & OpenStreetMap Interactive GIS Map
 * Featuring Interactive "Add Streetlight on Map" Placement Mode
 * =============================================================================
 */

// Global GIS map instances, placement mode flags, and asset data cache
let campusMap = null;
let markersLayer = null;
let allAssetsData = [];
let isPlacementMode = false;
let tempPlacementMarker = null;

/**
 * Main DOM Initialization:
 * Boots the interactive GIS map once the map canvas element is present in the DOM.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('campusMap')) {
        initCampusMap();
    }
});

/**
 * Initializes the Leaflet.js map canvas, mounts OpenStreetMap cartographic tiles,
 * requests asset coordinates and AI risk ratings from the backend REST API,
 * renders interactive geospatial map pins, and sets up map controls.
 * 
 * @returns {Promise<void>}
 */
async function initCampusMap() {
    const mapEl = document.getElementById('campusMap');
    if (!mapEl) return;

    // Step 1: Read dynamic campus coordinates from data attributes or fallback
    const defaultLat = parseFloat(mapEl.dataset.lat) || 16.350975;
    const defaultLng = parseFloat(mapEl.dataset.lng) || 81.042576;
    const defaultZoom = parseInt(mapEl.dataset.zoom) || 17;

    // Step 2: Initialize Leaflet map instance centered on campus with high-detail zoom
    campusMap = L.map('campusMap').setView([defaultLat, defaultLng], defaultZoom);

    // Step 3: Add OpenStreetMap standard raster tile layer with attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(campusMap);

    // Step 4: Create a dedicated LayerGroup for batch rendering and clearing marker pins
    markersLayer = L.layerGroup().addTo(campusMap);

    // Step 5: Setup Interactive Map Click Listener for "Add Streetlight on Map"
    campusMap.on('click', handleMapClick);

    // Step 6: Setup UI handlers for Placement Mode and Modals
    setupPlacementModeHandlers();

    // Step 7: Fetch all assets with GPS coordinates and AI predictions from the backend
    try {
        const response = await fetch('/api/assets');
        if (!response.ok) throw new Error("Could not load assets for map rendering");
        allAssetsData = await response.json();

        // Plot all initial pins and bind UI filter controls
        renderMapMarkers(allAssetsData);
        setupMapFilters();
    } catch (err) {
        console.error("GIS Campus Map initialization error:", err);
    }
}

/**
 * Computes marker color token according to asset condition, health score, and AI risk:
 * - 'red': Critical condition, health < 40, or High AI failure risk
 * - 'blue': Preventative maintenance due within 14 days
 * - 'orange': Poor condition or health < 60
 * - 'yellow': Moderate condition or health < 80
 * - 'green': Healthy asset operating normally
 * 
 * @param {Object} asset - Asset dictionary containing telemetry and health metrics.
 * @returns {string} Color token ('red', 'blue', 'orange', 'yellow', or 'green').
 */
function getMarkerColor(asset) {
    const health = asset.health_score;
    const cond = (asset.condition_status || '').toLowerCase();
    const aiRisk = (asset.ai_risk || '').toLowerCase();

    // Condition 1: Immediate failure risk or critical degradation
    if (cond === 'critical' || health < 40 || aiRisk === 'high risk') {
        return 'red';
    }
    // Condition 2: Upcoming preventative maintenance window
    if (asset.next_maintenance && isDueSoon(asset.next_maintenance)) {
        return 'blue';
    }
    // Condition 3: Poor condition / moderate deterioration
    if (cond === 'poor' || health < 60) {
        return 'orange';
    }
    // Condition 4: Fair / moderate condition
    if (cond === 'moderate' || health < 80) {
        return 'yellow';
    }
    // Condition 5: Normal optimal condition
    return 'green';
}

/**
 * Evaluates whether an upcoming maintenance schedule date falls within a 14-day threshold.
 * 
 * @param {string} dateStr - Target date in YYYY-MM-DD format.
 * @returns {boolean} True if maintenance is due within 14 days.
 */
function isDueSoon(dateStr) {
    if (!dateStr) return false;
    try {
        const target = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 14;
    } catch (e) {
        return false;
    }
}

/**
 * Returns the appropriate Bootstrap Icon CSS class for an infrastructure category.
 * 
 * @param {string} assetType - Asset category ('streetlight' or 'road').
 * @returns {string} Bootstrap icon class identifier.
 */
function getAssetIconClass(assetType) {
    switch (assetType) {
        case 'streetlight': return 'bi-lightbulb-fill';
        case 'road': return 'bi-signpost-split-fill';
        default: return 'bi-geo-alt-fill';
    }
}

/**
 * Clears existing Leaflet markers from the map and renders a new set of pins
 * with custom SVG badges, health indicators, and detail inspection popups.
 * 
 * @param {Array<Object>} assets - List of asset objects to plot on the map.
 * @returns {void}
 */
function renderMapMarkers(assets) {
    // Step 1: Wipe current markers from the map canvas
    markersLayer.clearLayers();

    if (!assets || assets.length === 0) return;

    const bounds = [];

    // Step 2: Iterate over each asset and construct its custom HTML pin
    assets.forEach(asset => {
        if (!asset.latitude || !asset.longitude) return;

        const color = getMarkerColor(asset);
        const iconClass = getAssetIconClass(asset.asset_type);

        // Step 2a: Define custom HTML marker element using Leaflet DivIcon
        const customIcon = L.divIcon({
            className: 'custom-leaflet-pin',
            html: `<div class="custom-marker-icon marker-${color}"><i class="bi ${iconClass}"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const marker = L.marker([asset.latitude, asset.longitude], { icon: customIcon });

        // Step 2b: Compose interactive information popup layout
        const popupContent = `
            <div style="min-width: 240px; font-family: 'Segoe UI', sans-serif;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge bg-dark">${asset.asset_tag}</span>
                    <span class="badge ${asset.health_score >= 80 ? 'bg-success' : asset.health_score >= 60 ? 'bg-warning text-dark' : 'bg-danger'}">Health: ${asset.health_score}</span>
                </div>
                <h6 class="fw-bold mb-1 text-dark">${asset.name}</h6>
                <p class="small text-muted mb-2"><i class="bi bi-geo-alt"></i> ${asset.location}</p>
                
                <div class="small mb-2 p-2 rounded bg-light border">
                    <div><strong>Type:</strong> <span class="text-capitalize">${asset.asset_type.replace('_', ' ')}</span></div>
                    <div><strong>Status:</strong> ${asset.condition_status}</div>
                    <div><strong>AI Risk:</strong> <span class="fw-bold ${asset.ai_risk === 'High Risk' ? 'text-danger' : asset.ai_risk === 'Medium Risk' ? 'text-warning' : 'text-success'}">${asset.ai_risk || 'Normal'}</span></div>
                    <div><strong>Inspection:</strong> ${asset.last_inspection || 'N/A'}</div>
                    <div><strong>Next Maint:</strong> ${asset.next_maintenance || 'N/A'}</div>
                </div>
                
                <button class="btn btn-sm btn-primary w-100 py-1" onclick="viewAssetDetails(${asset.id})">
                    <i class="bi bi-info-circle"></i> View Full Details
                </button>
            </div>
        `;

        // Step 2c: Bind popup and attach marker to the layer
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
        bounds.push([asset.latitude, asset.longitude]);
    });

    // Step 3: Automatically adjust camera zoom and center to tightly encompass all plotted markers
    if (bounds.length > 0) {
        campusMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }
}

/**
 * Binds DOM event listeners for the map category filter buttons and search input bar.
 * 
 * @returns {void}
 */
function setupMapFilters() {
    const filterButtons = document.querySelectorAll('[data-map-filter]');
    const searchInput = document.getElementById('mapSearchInput');

    // Step 1: Bind click listeners to filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active styling across button group
            filterButtons.forEach(b => b.classList.remove('active', 'btn-primary'));
            filterButtons.forEach(b => b.classList.add('btn-outline-secondary'));

            btn.classList.add('active', 'btn-primary');
            btn.classList.remove('btn-outline-secondary');

            // Apply selected filter rule
            const filter = btn.getAttribute('data-map-filter');
            applyMapFilter(filter, searchInput ? searchInput.value : '');
        });
    });

    // Step 2: Bind input listener for real-time text search filtering
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const activeFilterBtn = document.querySelector('[data-map-filter].active');
            const activeFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-map-filter') : 'all';
            applyMapFilter(activeFilter, e.target.value);
        });
    }
}

/**
 * Filters the in-memory asset collection by category and keyword, then updates the map.
 * 
 * @param {string} category - Category filter ('all', 'streetlight', 'road', 'critical', 'maintenance').
 * @param {string} searchText - Keyword to search within name, tag, or location.
 * @returns {void}
 */
function applyMapFilter(category, searchText) {
    let filtered = [...allAssetsData];

    // Step 1: Filter by category or operational urgency status
    if (category && category !== 'all') {
        if (category === 'critical') {
            filtered = filtered.filter(a => a.health_score < 40 || a.condition_status === 'Critical' || a.ai_risk === 'High Risk');
        } else if (category === 'maintenance') {
            filtered = filtered.filter(a => isDueSoon(a.next_maintenance));
        } else {
            // Match infrastructure category name ('streetlight' or 'road')
            filtered = filtered.filter(a => a.asset_type === category);
        }
    }

    // Step 2: Filter by text search query across asset tag, name, or campus location
    if (searchText && searchText.trim() !== '') {
        const query = searchText.toLowerCase().trim();
        filtered = filtered.filter(a =>
            (a.name && a.name.toLowerCase().includes(query)) ||
            (a.asset_tag && a.asset_tag.toLowerCase().includes(query)) ||
            (a.location && a.location.toLowerCase().includes(query))
        );
    }

    // Step 3: Re-render the map pins with the filtered subset
    renderMapMarkers(filtered);
}

/**
 * =============================================================================
 * Interactive Streetlight Placement Mode
 * Allows administrators to click anywhere on the campus map to drop a new pole
 * =============================================================================
 */

/**
 * Sets up button listeners and modal submission hooks for Map Streetlight Placement.
 */
function setupPlacementModeHandlers() {
    const btnToggle = document.getElementById('btnTogglePlacement');
    const btnCancel = document.getElementById('btnCancelPlacement');
    const modalEl = document.getElementById('addStreetlightOnMapModal');
    const form = document.getElementById('addStreetlightOnMapForm');

    if (btnToggle) {
        btnToggle.addEventListener('click', togglePlacementMode);
    }
    if (btnCancel) {
        btnCancel.addEventListener('click', disablePlacementMode);
    }

    // Cleanup temporary marker if modal is dismissed without saving
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', () => {
            if (tempPlacementMarker && campusMap) {
                campusMap.removeLayer(tempPlacementMarker);
                tempPlacementMarker = null;
            }
            disablePlacementMode();
        });
    }

    // Form submission handler via AJAX
    if (form) {
        form.addEventListener('submit', submitNewStreetlightOnMap);
    }
}

/**
 * Toggles the interactive pin placement mode on and off.
 */
function togglePlacementMode() {
    if (isPlacementMode) {
        disablePlacementMode();
    } else {
        enablePlacementMode();
    }
}

/**
 * Activates placement mode: changes cursor to crosshairs and displays instructional banner.
 */
function enablePlacementMode() {
    isPlacementMode = true;
    const banner = document.getElementById('placementBanner');
    if (banner) banner.classList.remove('d-none');

    const mapContainer = document.getElementById('campusMap');
    if (mapContainer) mapContainer.style.cursor = 'crosshair';

    const btnToggle = document.getElementById('btnTogglePlacement');
    if (btnToggle) {
        btnToggle.classList.remove('btn-success');
        btnToggle.classList.add('btn-warning');
        btnToggle.innerHTML = '<i class="bi bi-x-circle me-1"></i> Exit Placement Mode';
    }

    showToast("📍 Placement Mode Active! Click anywhere on the campus map to place the new streetlight pole.", "info");
}

/**
 * Deactivates placement mode: restores default cursor and hides banner.
 */
function disablePlacementMode() {
    isPlacementMode = false;
    const banner = document.getElementById('placementBanner');
    if (banner) banner.classList.add('d-none');

    const mapContainer = document.getElementById('campusMap');
    if (mapContainer) mapContainer.style.cursor = '';

    const btnToggle = document.getElementById('btnTogglePlacement');
    if (btnToggle) {
        btnToggle.classList.remove('btn-warning');
        btnToggle.classList.add('btn-success');
        btnToggle.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> + Add Streetlight on Map';
    }
}

/**
 * Handles map click event when in placement mode.
 * Captures clicked GPS coordinates, drops a temporary pin, and opens the creation modal.
 * 
 * @param {Object} e - Leaflet map click event.
 */
async function handleMapClick(e) {
    if (!isPlacementMode) return;

    const lat = parseFloat(e.latlng.lat).toFixed(6);
    const lng = parseFloat(e.latlng.lng).toFixed(6);

    // Remove any previous temporary marker
    if (tempPlacementMarker && campusMap) {
        campusMap.removeLayer(tempPlacementMarker);
    }

    // Drop an interactive pulsating temporary pin at clicked location
    const tempIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div class="custom-marker-icon marker-yellow shadow-lg" style="width: 38px; height: 38px; border: 3px solid #ffffff;"><i class="bi bi-lightbulb-fill fs-6"></i></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38]
    });
    tempPlacementMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(campusMap);

    // Pre-fill coordinate inputs in modal
    document.getElementById('mapInputLat').value = lat;
    document.getElementById('mapInputLng').value = lng;
    document.getElementById('mapDisplayCoords').textContent = `${lat}° N, ${lng}° E`;

    // Fetch the next auto-suggested streetlight tag & pole number from the backend
    try {
        const res = await fetch('/api/streetlights/next-tag');
        if (res.ok) {
            const tagData = await res.json();
            document.getElementById('mapAssetTag').value = tagData.next_tag;
            document.getElementById('mapPoleNumber').value = tagData.next_pole;
            document.getElementById('mapAssetName').value = `LED Pole ${tagData.next_pole} - Pathway`;
        }
    } catch (err) {
        console.warn("Could not fetch next streetlight tag:", err);
    }

    // Open the Add Streetlight Modal
    const modalEl = document.getElementById('addStreetlightOnMapModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

/**
 * Submits the new streetlight form via AJAX and immediately plots it on the map.
 * 
 * @param {Event} e - Form submission event.
 */
async function submitNewStreetlightOnMap(e) {
    e.preventDefault();

    const form = e.target;
    const spinner = document.getElementById('submitStreetlightSpinner');
    const submitBtn = document.getElementById('btnSubmitStreetlightOnMap');

    // UI Loading state
    if (spinner) spinner.classList.remove('d-none');
    if (submitBtn) submitBtn.disabled = true;

    // Collect form data into payload dictionary
    const formData = new FormData(form);
    const payload = {};
    formData.forEach((value, key) => {
        payload[key] = value;
    });

    try {
        const response = await fetch('/api/assets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to create streetlight.");
        }

        // Close modal
        const modalEl = document.getElementById('addStreetlightOnMapModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        // Remove temporary marker
        if (tempPlacementMarker && campusMap) {
            campusMap.removeLayer(tempPlacementMarker);
            tempPlacementMarker = null;
        }

        // Add newly created streetlight record to in-memory asset list
        const newAsset = result.asset;
        allAssetsData.push(newAsset);

        // Re-render map markers with updated asset list
        renderMapMarkers(allAssetsData);

        // Smoothly zoom and fly to the new streetlight pole
        campusMap.flyTo([newAsset.latitude, newAsset.longitude], 18, {
            animate: true,
            duration: 1.2
        });

        // Show success toast notification
        showToast(`🎉 Streetlight ${newAsset.asset_tag} (${newAsset.name}) successfully placed on the campus map!`, "success");

        // Turn off placement mode
        disablePlacementMode();
        form.reset();

    } catch (err) {
        showToast(err.message, "danger");
    } finally {
        if (spinner) spinner.classList.add('d-none');
        if (submitBtn) submitBtn.disabled = false;
    }
}
