/**
 * GEO Visualizer Application Logic
 * Core 3D engine, parser, and tab controller.
 */

// State Management
const state = {
    tabs: [],
    activeTabId: null,
    theme: 'dark',
    showGrid: true,
    showAxes: true,
    // Three.js Objects
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    gridHelper: null,
    axesHelper: null,
    modelGroup: null // Group to hold current 3D representation
};

// UI Elements
const els = {
    canvasContainer: document.getElementById('canvas-container'),
    tabsContainer: document.getElementById('tabs-container'),
    paramsContainer: document.getElementById('params-container'),
    jsonViewer: document.getElementById('json-viewer'),
    onboardingView: document.getElementById('onboarding-view'),
    btnLoadDemo: document.getElementById('btn-load-demo'),
    btnClearTabs: document.getElementById('btn-clear-tabs'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnCopyPrompt: document.getElementById('btn-copy-prompt'),
    // Controls
    ctrlGrid: document.getElementById('ctrl-grid'),
    ctrlAxes: document.getElementById('ctrl-axes'),
    ctrlCamera: document.getElementById('ctrl-camera'),
    ctrlTheme: document.getElementById('ctrl-theme'),
    // Info panel
    infoVertices: document.getElementById('info-vertices'),
    infoPrimitives: document.getElementById('info-primitives'),
    infoBounds: document.getElementById('info-bounds'),
    toastContainer: document.getElementById('toast-container'),
    connectionStatus: document.getElementById('connection-status')
};

/* ==========================================================================
   Three.js Engine Initialization
   ========================================================================== */
function initThree() {
    // Create Scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(state.theme === 'dark' ? 0x08090c : 0xf0f0f0);

    // Create Camera
    const aspect = els.canvasContainer.clientWidth / els.canvasContainer.clientHeight;
    state.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    state.camera.position.set(15, 15, 20);

    // Create Renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    state.renderer.setSize(els.canvasContainer.clientWidth, els.canvasContainer.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    els.canvasContainer.appendChild(state.renderer.domElement);

    // Add Orbit Controls
    state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go too far below ground

    // Add Helpers
    state.gridHelper = new THREE.GridHelper(30, 30, 0x9333ea, 0x1e293b);
    state.gridHelper.position.y = -0.01; // Avoid z-fighting with shapes
    state.scene.add(state.gridHelper);

    state.axesHelper = new THREE.AxesHelper(10);
    // Custom colors for axes: X = redish, Y = greenish, Z = blueish
    state.scene.add(state.axesHelper);

    // Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 15);
    state.scene.add(dirLight);

    // Model group container
    state.modelGroup = new THREE.Group();
    state.scene.add(state.modelGroup);

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize);

    // Animation Loop
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    state.renderer.render(state.scene, state.camera);
}

function onWindowResize() {
    const width = els.canvasContainer.clientWidth;
    const height = els.canvasContainer.clientHeight;
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(width, height);
}

/* ==========================================================================
   Expression Parser & Math Solver
   ========================================================================== */
function evaluateExpression(expr, params = {}) {
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') return 0;

    // Remove whitespace
    let sanitized = expr.replace(/\s+/g, '');

    // Substitute parameter values
    // Sort parameters by length descending so longer parameters are replaced first (avoid partial substring match issues)
    const sortedParamKeys = Object.keys(params).sort((a, b) => b.length - a.length);
    for (const key of sortedParamKeys) {
        const regex = new RegExp(key, 'g');
        sanitized = sanitized.replace(regex, `(${params[key]})`);
    }

    // Sanitize string to prevent arbitrary code execution
    // Only allow numbers, math operators, decimals, and parentheses
    if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
        console.warn(`GEO Parser: Unsafe expression detected: "${expr}" resolved to "${sanitized}"`);
        return 0;
    }

    try {
        // Safe evaluation since it's sanitized to mathematical characters only
        return Function(`"use strict"; return (${sanitized})`)();
    } catch (e) {
        console.error(`GEO Parser: Failed to evaluate expression: "${expr}" (resolved: "${sanitized}")`, e);
        return 0;
    }
}

/* ==========================================================================
   Model Parsing & 3D Wireframe Generation
   ========================================================================== */
function renderModel(modelData) {
    // Clear previous model representation
    while(state.modelGroup.children.length > 0){ 
        const obj = state.modelGroup.children[0];
        state.modelGroup.remove(obj);
    }

    if (!modelData || !modelData.vertices) return;

    const params = modelData.parameters || {};
    const resolvedVertices = {};

    // 1. Resolve Vertices coordinates
    modelData.vertices.forEach(v => {
        const x = evaluateExpression(v.x, params);
        const y = evaluateExpression(v.y, params);
        const z = evaluateExpression(v.z, params);
        resolvedVertices[v.id] = new THREE.Vector3(x, y, z);

        // Render Vertex Sphere (Dots)
        const dotGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ 
            color: state.theme === 'dark' ? 0x9333ea : 0x7e22ce // Neon Purple
        });
        const dotMesh = new THREE.Mesh(dotGeo, dotMat);
        dotMesh.position.copy(resolvedVertices[v.id]);
        state.modelGroup.add(dotMesh);
    });

    let primitiveCount = 0;

    // 2. Render Primitives (Lines, Circles, Curves)
    if (modelData.primitives) {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: state.theme === 'dark' ? 0x06b6d4 : 0x0891b2, // Neon Cyan
            linewidth: 2 // Note: linewidth parameter is ignored by WebGL canvas in most browsers
        });

        modelData.primitives.forEach(prim => {
            if (prim.type === 'line') {
                const startPt = resolvedVertices[prim.start];
                const endPt = resolvedVertices[prim.end];
                if (startPt && endPt) {
                    const points = [startPt, endPt];
                    const geo = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geo, lineMaterial);
                    state.modelGroup.add(line);
                    primitiveCount++;
                }
            } 
            else if (prim.type === 'circle') {
                const center = resolvedVertices[prim.center];
                const radius = evaluateExpression(prim.radius, params);
                if (center && radius > 0) {
                    const segments = 64;
                    const points = [];
                    // Generate circle points in local XY plane
                    for (let i = 0; i <= segments; i++) {
                        const theta = (i / segments) * Math.PI * 2;
                        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
                    }

                    const geo = new THREE.BufferGeometry().setFromPoints(points);
                    const circle = new THREE.Line(geo, lineMaterial);
                    circle.position.copy(center);

                    // Re-orient if custom normal is supplied
                    if (prim.normal && Array.isArray(prim.normal) && prim.normal.length === 3) {
                        const norm = new THREE.Vector3(prim.normal[0], prim.normal[1], prim.normal[2]).normalize();
                        const up = new THREE.Vector3(0, 0, 1);
                        const q = new THREE.Quaternion().setFromUnitVectors(up, norm);
                        circle.quaternion.copy(q);
                    }
                    
                    state.modelGroup.add(circle);
                    primitiveCount++;
                }
            }
            else if (prim.type === 'bezier') {
                // Cubic Bezier curve (4 control points)
                if (prim.control_points && prim.control_points.length === 4) {
                    const p0 = resolvedVertices[prim.control_points[0]];
                    const p1 = resolvedVertices[prim.control_points[1]];
                    const p2 = resolvedVertices[prim.control_points[2]];
                    const p3 = resolvedVertices[prim.control_points[3]];

                    if (p0 && p1 && p2 && p3) {
                        const segments = 48;
                        const points = [];
                        
                        // Cubic Bezier formula: B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
                        for (let i = 0; i <= segments; i++) {
                            const t = i / segments;
                            const mt = 1 - t;
                            
                            const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
                            const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
                            const z = mt*mt*mt*p0.z + 3*mt*mt*t*p1.z + 3*mt*t*t*p2.z + t*t*t*p3.z;
                            
                            points.push(new THREE.Vector3(x, y, z));
                        }

                        const curveMat = new THREE.LineBasicMaterial({
                            color: 0xa855f7, // Purple for Bezier splines
                            linewidth: 2
                        });
                        const geo = new THREE.BufferGeometry().setFromPoints(points);
                        const curve = new THREE.Line(geo, curveMat);
                        state.modelGroup.add(curve);
                        primitiveCount++;
                    }
                }
            }
        });
    }

    // 3. Update Floating Info Metrics
    const vertCount = modelData.vertices.length;
    els.infoVertices.textContent = vertCount;
    els.infoPrimitives.textContent = primitiveCount;

    // Calculate Bounding Box dimensions
    if (vertCount > 0) {
        const box = new THREE.Box3().setFromObject(state.modelGroup);
        const size = new THREE.Vector3();
        box.getSize(size);
        els.infoBounds.textContent = `${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`;
        
        // Auto-center camera to fit model nicely
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Adjust control target
        state.controls.target.copy(center);
        
        // Set camera position safely out
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            state.camera.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.5, center.z + maxDim * 2.0);
        }
        state.controls.update();
    } else {
        els.infoBounds.textContent = "0.0 x 0.0";
    }
}

/* ==========================================================================
   Tabs Management (Multiple Geometries)
   ========================================================================== */
function addTab(name, data) {
    const tabId = 'tab_' + Date.now();
    state.tabs.push({ id: tabId, name, data });
    
    // Auto switch to new tab
    switchTab(tabId);
    
    // Hide onboarding if visible
    if (state.tabs.length > 0) {
        els.onboardingView.style.opacity = '0';
        setTimeout(() => { els.onboardingView.style.display = 'none'; }, 250);
    }
    
    updateTabsUI();
}

function switchTab(tabId) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    state.activeTabId = tabId;
    
    // 1. Render in 3D
    renderModel(tab.data);
    
    // 2. Load JSON into inspector
    els.jsonViewer.value = JSON.stringify(tab.data, null, 2);
    
    // 3. Render Parameters table
    renderParameters(tab.data.parameters);
    
    // Update active state in list
    updateTabsUI();
}

function closeTab(tabId, event) {
    if (event) event.stopPropagation(); // Avoid triggering tab switch on close click
    
    const index = state.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    
    state.tabs.splice(index, 1);
    
    if (state.tabs.length === 0) {
        // Show onboarding
        state.activeTabId = null;
        els.onboardingView.style.display = 'flex';
        setTimeout(() => { els.onboardingView.style.opacity = '1'; }, 50);
        
        // Clear 3D canvas
        while(state.modelGroup.children.length > 0){
            state.modelGroup.remove(state.modelGroup.children[0]);
        }
        els.jsonViewer.value = '';
        els.infoVertices.textContent = '0';
        els.infoPrimitives.textContent = '0';
        els.infoBounds.textContent = '0.0 x 0.0';
        renderParameters(null);
    } else if (state.activeTabId === tabId) {
        // Switch to adjacent tab
        const nextActiveIndex = Math.max(0, index - 1);
        switchTab(state.tabs[nextActiveIndex].id);
    }
    
    updateTabsUI();
}

function updateTabsUI() {
    els.tabsContainer.innerHTML = '';
    
    state.tabs.forEach(tab => {
        const isActive = tab.id === state.activeTabId;
        const tabEl = document.createElement('div');
        tabEl.className = `tab-item ${isActive ? 'active' : ''}`;
        tabEl.onclick = () => switchTab(tab.id);
        
        tabEl.innerHTML = `
            <span class="tab-name" title="${tab.name}"><i class="fa-solid fa-cube"></i> ${tab.name}</span>
            <button class="tab-close" onclick="closeTab('${tab.id}', event)"><i class="fa-solid fa-xmark"></i></button>
        `;
        
        els.tabsContainer.appendChild(tabEl);
    });
}

function renderParameters(parameters) {
    els.paramsContainer.innerHTML = '';
    
    if (!parameters || Object.keys(parameters).length === 0) {
        els.paramsContainer.innerHTML = '<div class="empty-state">No parameters defined.</div>';
        return;
    }
    
    Object.keys(parameters).forEach(key => {
        const val = parameters[key];
        const badge = document.createElement('div');
        badge.className = 'param-badge';
        badge.innerHTML = `
            <span class="param-name">${key}</span>
            <span class="param-val">${val}</span>
        `;
        els.paramsContainer.appendChild(badge);
    });
}

/* ==========================================================================
   UI Interactions & Controls
   ========================================================================== */
function initUIControls() {
    // Onboarding Button
    els.btnLoadDemo.onclick = () => {
        addTab("Parametric Bracket", GEO_EXAMPLES.Parametric_Bracket);
        showToast("Demo design loaded successfully", "success");
    };
    
    // Clear all tabs
    els.btnClearTabs.onclick = () => {
        state.tabs = [];
        state.activeTabId = null;
        els.tabsContainer.innerHTML = '';
        els.onboardingView.style.display = 'flex';
        els.onboardingView.style.opacity = '1';
        while(state.modelGroup.children.length > 0) {
            state.modelGroup.remove(state.modelGroup.children[0]);
        }
        els.jsonViewer.value = '';
        renderParameters(null);
        showToast("All tabs cleared", "info");
    };

    // Copy geometri JSON
    els.btnCopyCode.onclick = () => {
        const code = els.jsonViewer.value;
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            showToast("JSON code copied to clipboard", "success");
        }).catch(() => {
            showToast("Failed to copy code", "error");
        });
    };

    // Copy AI Prompt
    els.btnCopyPrompt.onclick = () => {
        const promptText = `Teaching prompt for writing geometri format:
---
You are a geometry generation AI. Output ONLY a raw JSON string adhering to the "geometri" schema. Do not wrap it in markdown or write conversational text.

Schema Definition:
{
  "metadata": { "name": "Model Name", "version": "1.0.0", "description": "Short description" },
  "parameters": { "param_name": float_value },
  "vertices": [ { "id": "v0", "x": float_or_formula_string, "y": float_or_formula, "z": float_or_formula } ],
  "primitives": [
    { "type": "line", "start": "start_vertex_id", "end": "end_vertex_id" },
    { "type": "circle", "center": "center_vertex_id", "radius": float_or_formula, "normal": [x, y, z] },
    { "type": "bezier", "control_points": ["v_start", "v_ctrl1", "v_ctrl2", "v_end"] }
  ]
}

To display the design, encode this JSON and append it to the URL like this:
https://atlas55kk.github.io/GEO/?data=<URL_Encoded_JSON_String>
---`;
        navigator.clipboard.writeText(promptText).then(() => {
            showToast("AI Prompt copied to clipboard", "success");
        });
    };

    // Grid Toggle
    els.ctrlGrid.onclick = () => {
        state.showGrid = !state.showGrid;
        state.gridHelper.visible = state.showGrid;
        els.ctrlGrid.classList.toggle('active', state.showGrid);
        showToast(`Grid ${state.showGrid ? 'enabled' : 'disabled'}`, 'info');
    };

    // Axes Toggle
    els.ctrlAxes.onclick = () => {
        state.showAxes = !state.showAxes;
        state.axesHelper.visible = state.showAxes;
        els.ctrlAxes.classList.toggle('active', state.showAxes);
        showToast(`Axes ${state.showAxes ? 'enabled' : 'disabled'}`, 'info');
    };

    // Reset Camera
    els.ctrlCamera.onclick = () => {
        state.controls.reset();
        showToast("Camera view reset", "info");
    };

    // Theme Toggle
    els.ctrlTheme.onclick = () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', state.theme);
        
        // Update Three Scene background
        state.scene.background = new THREE.Color(state.theme === 'dark' ? 0x08090c : 0xf0f0f0);
        
        // Update grid helper colors
        state.scene.remove(state.gridHelper);
        state.gridHelper = new THREE.GridHelper(30, 30, state.theme === 'dark' ? 0x9333ea : 0x7e22ce, state.theme === 'dark' ? 0x1e293b : 0xcbd5e1);
        state.scene.add(state.gridHelper);
        
        // Redraw current active tab to adjust vertex colors
        if (state.activeTabId) {
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (tab) renderModel(tab.data);
        }

        const icon = els.ctrlTheme.querySelector('i');
        icon.className = state.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        showToast(`Theme switched to ${state.theme} mode`, 'info');
    };
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    els.toastContainer.appendChild(toast);
    
    // Auto-destruct after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.remove(); }, 300);
    }, 3000);
}

/* ==========================================================================
   External Loading (URL Parameter Parsing & Hot Reload Endpoint)
   ========================================================================== */
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    if (!dataParam) return;
    
    try {
        let jsonString = '';
        
        if (dataParam.trim().startsWith('{')) {
            // Raw JSON string
            jsonString = decodeURIComponent(dataParam);
        } else {
            // Attempt Base64 decode
            try {
                // Handle url-safe base64 differences
                const cleanedBase64 = dataParam.replace(/-/g, '+').replace(/_/g, '/');
                jsonString = atob(cleanedBase64);
            } catch (b64Error) {
                // Fallback to basic URL decode if not valid base64
                jsonString = decodeURIComponent(dataParam);
            }
        }
        
        const parsedData = JSON.parse(jsonString);
        const tabName = urlParams.get('tab') || parsedData.metadata?.name || "AI_Model";
        
        // Load the model
        addTab(tabName, parsedData);
        showToast(`Successfully loaded model "${tabName}" from URL`, "success");
        
    } catch (err) {
        console.error("GEO URL Parser: Failed to parse query parameter data", err);
        showToast("Failed to parse geometric model from URL link", "error");
    }
}

// Global hook for local python server or local agents to trigger update
window.loadGeometriModel = function(jsonData, tabName = "Live_Update") {
    try {
        const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        
        // Check if tab with this exact name already exists. If so, update it instead of making a new one
        const existingTab = state.tabs.find(t => t.name === tabName);
        if (existingTab) {
            existingTab.data = parsed;
            if (state.activeTabId === existingTab.id) {
                // If it's the active view, render it
                renderModel(parsed);
                els.jsonViewer.value = JSON.stringify(parsed, null, 2);
                renderParameters(parsed.parameters);
            } else {
                switchTab(existingTab.id);
            }
            showToast(`Updated active design tab "${tabName}"`, "success");
        } else {
            // Open a new tab
            addTab(tabName, parsed);
            showToast(`Created new design tab "${tabName}"`, "success");
        }
    } catch (e) {
        console.error("GEO API: Failed to load incoming JSON", e);
        showToast("Error updating model from local API", "error");
    }
};

/* ==========================================================================
   Local Offline SSE Listener (For launcher.py)
   ========================================================================== */
function initSseListener() {
    // If we are running in the pywebview local environment or localhost, listen for SSE events
    // We check if hostname is localhost or 127.0.0.1
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const eventSource = new EventSource('/events');
        
        eventSource.onopen = function() {
            els.connectionStatus.classList.add('connected');
            els.connectionStatus.querySelector('.status-label').textContent = 'Connected';
            showToast("Connected to local AI launcher", "success");
        };
        
        eventSource.onerror = function() {
            els.connectionStatus.classList.remove('connected');
            els.connectionStatus.querySelector('.status-label').textContent = 'Offline';
        };
        
        eventSource.onmessage = function(event) {
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.data) {
                    window.loadGeometriModel(payload.data, payload.tab || "Local_Design");
                }
            } catch (e) {
                console.error("GEO SSE: Failed to process message", e);
            }
        };
    }
}

/* ==========================================================================
   Page Entry Point
   ========================================================================== */
window.onload = () => {
    initThree();
    initUIControls();
    checkUrlParameters();
    initSseListener();
};
