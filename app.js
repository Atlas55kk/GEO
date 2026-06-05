/**
 * GEO Visualizer — Application Logic v2
 * Professional CAD-grade 3D engine, parser, tab controller.
 */

/* =====================================================================
   STATE
   ===================================================================== */
const state = {
    tabs: [], // Array of tab objects: { id, name, versions: [ { id, data, timestamp } ], activeVersionId: null }
    activeTabId: null,
    showVersionsPanel: true,
    theme: 'dark',
    showGrid: true,
    showAxes: true,
    ortho: false,
    scene: null,
    perspCamera: null,
    orthoCamera: null,
    renderer: null,
    controls: null,
    gridGroup: null,
    axesGroup: null,
    modelGroup: null,
    raycaster: null,
    mouse: new THREE.Vector2(),
};

/* =====================================================================
   DOM REFERENCES
   ===================================================================== */
const $ = id => document.getElementById(id);
const els = {
    canvas:            $('canvas-container'),
    tabs:              $('tabs-container'),
    params:            $('params-container'),
    json:              $('json-viewer'),
    onboarding:        $('onboarding-view'),
    btnDemo:           $('btn-load-demo'),
    btnClearVersions:  $('btn-clear-versions'),
    btnCopy:           $('btn-copy-code'),
    btnPrompt:         $('btn-copy-prompt'),
    ctrlGrid:          $('ctrl-grid'),
    ctrlAxes:          $('ctrl-axes'),
    ctrlCamera:        $('ctrl-camera'),
    ctrlOrtho:         $('ctrl-ortho'),
    ctrlTheme:         $('ctrl-theme'),
    infoV:             $('info-vertices'),
    infoP:             $('info-primitives'),
    infoB:             $('info-bounds'),
    toasts:            $('toast-container'),
    status:            $('connection-status'),
    coordX:            $('coord-x'),
    coordY:            $('coord-y'),
    coordZ:            $('coord-z'),
    axisX:             $('axis-label-x'),
    axisY:             $('axis-label-y'),
    axisZ:             $('axis-label-z'),
    versionsPanel:     $('versions-panel'),
    versionsList:      $('versions-list'),
    btnToggleVersions: $('btn-toggle-versions'),
    headerCode:        $('header-code'),
    headerVersions:    $('header-versions'),
    panelCode:         $('panel-code'),
    btnShareDesign:    $('btn-share-design'),
    ctrlCapture:       $('ctrl-capture'),
};

/* =====================================================================
   THREE.JS ENGINE
   ===================================================================== */
function initThree() {
    const w = els.canvas.clientWidth;
    const h = els.canvas.clientHeight;

    // Scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x0a0a0c);

    // Perspective Camera
    state.perspCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 2000);
    state.perspCamera.position.set(18, 14, 22);

    // Orthographic Camera
    const frustum = 15;
    const aspect = w / h;
    state.orthoCamera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect,
        frustum, -frustum, 0.1, 2000
    );
    state.orthoCamera.position.set(18, 14, 22);

    // Renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    state.renderer.setSize(w, h);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    els.canvas.appendChild(state.renderer.domElement);

    // Controls
    state.controls = new THREE.OrbitControls(getCamera(), state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.rotateSpeed = 0.6;
    state.controls.zoomSpeed = 0.8;
    state.controls.panSpeed = 0.5;
    state.controls.minDistance = 2;
    state.controls.maxDistance = 200;

    // Lights
    state.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.65);
    dir.position.set(12, 25, 18);
    state.scene.add(dir);

    // Grid
    state.gridGroup = new THREE.Group();
    buildGrid();
    state.scene.add(state.gridGroup);

    // Axes
    state.axesGroup = new THREE.Group();
    buildAxes();
    state.scene.add(state.axesGroup);

    // Model container
    state.modelGroup = new THREE.Group();
    state.scene.add(state.modelGroup);

    // Raycaster for coordinate readout
    state.raycaster = new THREE.Raycaster();

    // Events
    window.addEventListener('resize', onResize);
    els.canvas.addEventListener('mousemove', onMouseMove);

    animate();
}

function getCamera() {
    return state.ortho ? state.orthoCamera : state.perspCamera;
}

function syncCameras() {
    const target = state.controls.target;
    if (state.ortho) {
        // Perspective to Orthographic
        const dist = state.perspCamera.position.distanceTo(target);
        const halfHeight = dist * Math.tan((state.perspCamera.fov * Math.PI) / 360);
        const baseFrustum = 15;
        state.orthoCamera.zoom = baseFrustum / halfHeight;
        
        state.orthoCamera.position.copy(state.perspCamera.position);
        state.orthoCamera.quaternion.copy(state.perspCamera.quaternion);
        state.orthoCamera.updateProjectionMatrix();
    } else {
        // Orthographic to Perspective
        const baseFrustum = 15;
        const halfHeight = baseFrustum / state.orthoCamera.zoom;
        const dist = halfHeight / Math.tan((state.perspCamera.fov * Math.PI) / 360);
        
        const dir = new THREE.Vector3().subVectors(state.orthoCamera.position, target).normalize();
        state.perspCamera.position.copy(target).addScaledVector(dir, dist);
        state.perspCamera.quaternion.copy(state.orthoCamera.quaternion);
        state.perspCamera.updateProjectionMatrix();
    }
}

function buildGrid() {
    // Clear existing
    while (state.gridGroup.children.length) state.gridGroup.remove(state.gridGroup.children[0]);

    const isDark = state.theme === 'dark';

    // Major grid (every 5 units)
    const majorGrid = new THREE.GridHelper(50, 10,
        isDark ? 0x2c2c30 : 0xd4d4d8,
        isDark ? 0x2c2c30 : 0xd4d4d8
    );
    majorGrid.position.y = -0.01;
    state.gridGroup.add(majorGrid);

    // Minor grid (every 1 unit)
    const minorGrid = new THREE.GridHelper(50, 50,
        isDark ? 0x18181b : 0xe4e4e7,
        isDark ? 0x18181b : 0xe4e4e7
    );
    minorGrid.position.y = -0.02;
    state.gridGroup.add(minorGrid);
}

function buildAxes() {
    while (state.axesGroup.children.length) state.axesGroup.remove(state.axesGroup.children[0]);

    const len = 25;
    const colors = [0xef4444, 0x22c55e, 0x3b82f6]; // X, Y, Z
    const dirs = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
    ];

    dirs.forEach((dir, i) => {
        const pts = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(len)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: colors[i], transparent: true, opacity: 0.6 });
        state.axesGroup.add(new THREE.Line(geo, mat));
    });
}

function animate() {
    requestAnimationFrame(animate);
    state.controls.update();

    const cam = getCamera();
    state.renderer.render(state.scene, cam);

    // Update axis label positions (project 3D → 2D screen coords)
    if (state.showAxes) {
        updateAxisLabel(els.axisX, new THREE.Vector3(26, 0, 0), cam);
        updateAxisLabel(els.axisY, new THREE.Vector3(0, 26, 0), cam);
        updateAxisLabel(els.axisZ, new THREE.Vector3(0, 0, 26), cam);
    }
}

function updateAxisLabel(labelEl, worldPos, cam) {
    if (!labelEl) return;
    const v = worldPos.clone().project(cam);
    const hw = els.canvas.clientWidth / 2;
    const hh = els.canvas.clientHeight / 2;
    const sx = (v.x * hw) + hw;
    const sy = -(v.y * hh) + hh;

    if (v.z > 1 || sx < 0 || sy < 0 || sx > els.canvas.clientWidth || sy > els.canvas.clientHeight) {
        labelEl.style.display = 'none';
    } else {
        labelEl.style.display = 'block';
        labelEl.style.left = sx + 'px';
        labelEl.style.top = sy + 'px';
    }
}

function onResize() {
    const w = els.canvas.clientWidth;
    const h = els.canvas.clientHeight;
    if (w === 0 || h === 0) return;

    state.perspCamera.aspect = w / h;
    state.perspCamera.updateProjectionMatrix();

    const frustum = 15;
    const aspect = w / h;
    state.orthoCamera.left = -frustum * aspect;
    state.orthoCamera.right = frustum * aspect;
    state.orthoCamera.top = frustum;
    state.orthoCamera.bottom = -frustum;
    state.orthoCamera.updateProjectionMatrix();

    state.renderer.setSize(w, h);
}

function onMouseMove(e) {
    const rect = els.canvas.getBoundingClientRect();
    state.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to ground plane for coordinate readout
    const cam = getCamera();
    state.raycaster.setFromCamera(state.mouse, cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    state.raycaster.ray.intersectPlane(plane, pt);

    if (pt) {
        els.coordX.textContent = pt.x.toFixed(2);
        els.coordY.textContent = pt.y.toFixed(2);
        els.coordZ.textContent = pt.z.toFixed(2);
    }
}

/* =====================================================================
   MATH EXPRESSION PARSER
   ===================================================================== */
function evalExpr(expr, params = {}) {
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') return 0;

    let s = expr.replace(/\s+/g, '');

    // 1. Substitute whitelisted math functions and constants
    const allowedMath = ['sin', 'cos', 'tan', 'sqrt', 'pow', 'abs', 'pi'];
    let mathReplaced = s;
    allowedMath.forEach(fn => {
        const regex = new RegExp(`\\b${fn}\\b`, 'gi');
        if (fn.toLowerCase() === 'pi') {
            mathReplaced = mathReplaced.replace(regex, 'Math.PI');
        } else {
            mathReplaced = mathReplaced.replace(regex, `Math.${fn}`);
        }
    });

    // 2. Substitute parameters
    const keys = Object.keys(params).sort((a, b) => b.length - a.length);
    for (const k of keys) {
        const regex = new RegExp(`\\b${k}\\b`, 'g');
        mathReplaced = mathReplaced.replace(regex, `(${params[k]})`);
    }

    // 3. Safety validation check
    let checkStr = mathReplaced;
    allowedMath.forEach(fn => {
        const regex = new RegExp(`Math\\.${fn}`, 'gi');
        checkStr = checkStr.replace(regex, '');
    });
    if (!/^[0-9+\-*/(),.\s]+$/.test(checkStr)) {
        console.warn('GEO: unsafe math expression', expr);
        return 0;
    }

    try {
        return Function(`"use strict"; return (${mathReplaced})`)();
    }
    catch {
        return 0;
    }
}

/* =====================================================================
   GEOMETRI (.geo) FORMAT PARSER
   ===================================================================== */
function parseGeoFormat(text) {
    const lines = text.split(/\r?\n/);
    const metadata = { name: "Geometri Model", version: "1.0.0", description: "" };
    const parameters = {};
    const vertices = [];
    const primitives = [];

    lines.forEach((line, index) => {
        const commentIdx = line.indexOf('#');
        let cleanLine = commentIdx !== -1 ? line.substring(0, commentIdx) : line;
        cleanLine = cleanLine.trim();
        if (cleanLine === '') return;

        const tokens = cleanLine.split(/\s+/);
        const cmd = tokens[0].toLowerCase();

        switch (cmd) {
            case 'meta': {
                if (tokens.length >= 3) {
                    const key = tokens[1].toLowerCase();
                    const val = tokens.slice(2).join(' ');
                    metadata[key] = val;
                }
                break;
            }
            case 'p': {
                if (tokens.length === 3) {
                    const id = tokens[1];
                    const val = evalExpr(tokens[2], parameters);
                    parameters[id] = val;
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'p' command. Expected 3 tokens.`);
                }
                break;
            }
            case 'v': {
                if (tokens.length === 5) {
                    vertices.push({
                        id: tokens[1],
                        x: tokens[2],
                        y: tokens[3],
                        z: tokens[4]
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'v' command. Expected 5 tokens.`);
                }
                break;
            }
            case 'l': {
                if (tokens.length === 3) {
                    primitives.push({
                        type: 'line',
                        start: tokens[1],
                        end: tokens[2]
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'l' command. Expected 3 tokens.`);
                }
                break;
            }
            case 'c': {
                if (tokens.length === 6) {
                    primitives.push({
                        type: 'circle',
                        center: tokens[1],
                        radius: tokens[2],
                        normal: [
                            evalExpr(tokens[3], parameters),
                            evalExpr(tokens[4], parameters),
                            evalExpr(tokens[5], parameters)
                        ]
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'c' command. Expected 6 tokens.`);
                }
                break;
            }
            case 'a': {
                if (tokens.length === 8) {
                    primitives.push({
                        type: 'arc',
                        center: tokens[1],
                        radius: tokens[2],
                        start_angle: tokens[3],
                        end_angle: tokens[4],
                        normal: [
                            evalExpr(tokens[5], parameters),
                            evalExpr(tokens[6], parameters),
                            evalExpr(tokens[7], parameters)
                        ]
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'a' command. Expected 8 tokens.`);
                }
                break;
            }
            case 'e': {
                if (tokens.length === 7) {
                    primitives.push({
                        type: 'ellipse',
                        center: tokens[1],
                        radius_x: tokens[2],
                        radius_y: tokens[3],
                        normal: [
                            evalExpr(tokens[4], parameters),
                            evalExpr(tokens[5], parameters),
                            evalExpr(tokens[6], parameters)
                        ]
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'e' command. Expected 7 tokens.`);
                }
                break;
            }
            case 'b': {
                if (tokens.length === 4 || tokens.length === 5) {
                    primitives.push({
                        type: 'bezier',
                        control_points: tokens.slice(1)
                    });
                } else {
                    console.warn(`GEO Parser Line ${index + 1}: Invalid 'b' command. Expected 4 or 5 tokens.`);
                }
                break;
            }
            default:
                console.warn(`GEO Parser Line ${index + 1}: Unknown command '${cmd}'.`);
        }
    });

    return {
        metadata: metadata,
        parameters: parameters,
        vertices: vertices,
        primitives: primitives
    };
}

/* =====================================================================
   MODEL RENDERING
   ===================================================================== */
function renderModel(data, autoFrame = false) {
    // Clear
    while (state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]);
    if (!data || !data.vertices) return;

    const params = data.parameters || {};
    const verts = {};
    const isDark = state.theme === 'dark';

    // Vertices
    const dotGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: isDark ? 0x0ea5e9 : 0x0284c7 });

    data.vertices.forEach(v => {
        const pos = new THREE.Vector3(
            evalExpr(v.x, params),
            evalExpr(v.y, params),
            evalExpr(v.z, params)
        );
        verts[v.id] = pos;

        const mesh = new THREE.Mesh(dotGeo, dotMat);
        mesh.position.copy(pos);
        state.modelGroup.add(mesh);
    });

    // Edge material
    const edgeMat = new THREE.LineBasicMaterial({
        color: isDark ? 0xe4e4e7 : 0x27272a
    });

    let primCount = 0;

    if (data.primitives) {
        data.primitives.forEach(p => {
            if (p.type === 'line') {
                const a = verts[p.start], b = verts[p.end];
                if (a && b) {
                    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
                    state.modelGroup.add(new THREE.Line(g, edgeMat));
                    primCount++;
                }
            }
            else if (p.type === 'circle') {
                const c = verts[p.center];
                const r = evalExpr(p.radius, params);
                if (c && r > 0) {
                    const pts = [];
                    for (let i = 0; i <= 64; i++) {
                        const t = (i / 64) * Math.PI * 2;
                        pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
                    }
                    const g = new THREE.BufferGeometry().setFromPoints(pts);
                    const circle = new THREE.Line(g, edgeMat);
                    circle.position.copy(c);
                    if (p.normal && p.normal.length === 3) {
                        const n = new THREE.Vector3(...p.normal).normalize();
                        circle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
                    }
                    state.modelGroup.add(circle);
                    primCount++;
                }
            }
            else if (p.type === 'arc') {
                const c = verts[p.center];
                const r = evalExpr(p.radius, params);
                const start = evalExpr(p.start_angle, params);
                const end = evalExpr(p.end_angle, params);
                if (c && r > 0) {
                    const pts = [];
                    const steps = 32;
                    for (let i = 0; i <= steps; i++) {
                        const t = start + (i / steps) * (end - start);
                        pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
                    }
                    const g = new THREE.BufferGeometry().setFromPoints(pts);
                    const arcLine = new THREE.Line(g, edgeMat);
                    arcLine.position.copy(c);
                    if (p.normal && p.normal.length === 3) {
                        const n = new THREE.Vector3(...p.normal).normalize();
                        arcLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
                    }
                    state.modelGroup.add(arcLine);
                    primCount++;
                }
            }
            else if (p.type === 'ellipse') {
                const c = verts[p.center];
                const rx = evalExpr(p.radius_x, params);
                const ry = evalExpr(p.radius_y, params);
                if (c && rx > 0 && ry > 0) {
                    const pts = [];
                    for (let i = 0; i <= 64; i++) {
                        const t = (i / 64) * Math.PI * 2;
                        pts.push(new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, 0));
                    }
                    const g = new THREE.BufferGeometry().setFromPoints(pts);
                    const ellipseLine = new THREE.Line(g, edgeMat);
                    ellipseLine.position.copy(c);
                    if (p.normal && p.normal.length === 3) {
                        const n = new THREE.Vector3(...p.normal).normalize();
                        ellipseLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
                    }
                    state.modelGroup.add(ellipseLine);
                    primCount++;
                }
            }
            else if (p.type === 'bezier') {
                if (p.control_points?.length === 3) {
                    const [p0, p1, p2] = p.control_points.map(id => verts[id]);
                    if (p0 && p1 && p2) {
                        const pts = [];
                        for (let i = 0; i <= 48; i++) {
                            const t = i / 48, mt = 1 - t;
                            pts.push(new THREE.Vector3(
                                mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
                                mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y,
                                mt*mt*p0.z + 2*mt*t*p1.z + t*t*p2.z
                            ));
                        }
                        const curveMat = new THREE.LineBasicMaterial({ color: isDark ? 0x0ea5e9 : 0x0284c7 });
                        const g = new THREE.BufferGeometry().setFromPoints(pts);
                        state.modelGroup.add(new THREE.Line(g, curveMat));
                        primCount++;
                    }
                }
                else if (p.control_points?.length === 4) {
                    const [p0, p1, p2, p3] = p.control_points.map(id => verts[id]);
                    if (p0 && p1 && p2 && p3) {
                        const pts = [];
                        for (let i = 0; i <= 48; i++) {
                            const t = i / 48, mt = 1 - t;
                            pts.push(new THREE.Vector3(
                                mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
                                mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
                                mt*mt*mt*p0.z + 3*mt*mt*t*p1.z + 3*mt*t*t*p2.z + t*t*t*p3.z
                            ));
                        }
                        const curveMat = new THREE.LineBasicMaterial({ color: isDark ? 0x0ea5e9 : 0x0284c7 });
                        const g = new THREE.BufferGeometry().setFromPoints(pts);
                        state.modelGroup.add(new THREE.Line(g, curveMat));
                        primCount++;
                    }
                }
            }
        });
    }

    // HUD
    els.infoV.textContent = data.vertices.length;
    els.infoP.textContent = primCount;

    if (data.vertices.length > 0) {
        const box = new THREE.Box3().setFromObject(state.modelGroup);
        const sz = new THREE.Vector3();
        box.getSize(sz);
        els.infoB.textContent = `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)}`;

        if (autoFrame) {
            const center = new THREE.Vector3();
            box.getCenter(center);
            state.controls.target.copy(center);
            const maxD = Math.max(sz.x, sz.y, sz.z, 1);
            const cam = getCamera();
            if (state.ortho) {
                const baseFrustum = 15;
                state.orthoCamera.zoom = baseFrustum / (maxD * 1.2);
                state.orthoCamera.position.set(center.x + maxD * 1.4, center.y + maxD * 1.2, center.z + maxD * 1.8);
                state.orthoCamera.updateProjectionMatrix();
            } else {
                state.perspCamera.position.set(center.x + maxD * 1.4, center.y + maxD * 1.2, center.z + maxD * 1.8);
            }
            state.controls.update();
        }
    } else {
        els.infoB.textContent = '—';
    }
}

/* =====================================================================
   TABS AND VERSIONS MANAGEMENT
   ===================================================================== */
function formatDateTime(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate().toString().padStart(2, '0');
    const m = months[date.getMonth()];
    const hrs = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${d} ${m} | ${hrs}:${mins}`;
}

function addTab(name, data, rawText = null) {
    const versionId = 'ver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newVersion = {
        id: versionId,
        data: data,
        rawText: rawText,
        timestamp: new Date()
    };

    let tab = state.tabs.find(t => t.name === name);

    if (tab) {
        // Prevent duplicate updates if data is identical to the active version's data
        const activeVer = tab.versions.find(v => v.id === tab.activeVersionId);
        if (activeVer && JSON.stringify(activeVer.data) === JSON.stringify(data)) {
            // If it is identical, just make sure we switch to this tab and return
            switchTab(tab.id, false);
            return;
        }
        tab.versions.push(newVersion);
        tab.activeVersionId = versionId;
        switchTab(tab.id, false); // Switch tab, but KEEP camera stable (no autoframe)
        toast(`Added V:${tab.versions.length} to "${name}"`, 'success');
    } else {
        const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        tab = {
            id: tabId,
            name: name,
            versions: [newVersion],
            activeVersionId: versionId
        };
        state.tabs.push(tab);
        switchTab(tabId, true); // Auto-frame ONLY on initial loading of new tab!
        toast(`New design: "${name}"`, 'success');
    }

    if (state.tabs.length > 0) {
        els.onboarding.style.opacity = '0';
        setTimeout(() => { els.onboarding.style.display = 'none'; }, 200);
    }
    updateTabsUI();
    updateVersionsUI();
}

function switchTab(id, autoFrame = false) {
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return;
    state.activeTabId = id;
    
    const activeVersion = tab.versions.find(v => v.id === tab.activeVersionId);
    if (activeVersion) {
        renderModel(activeVersion.data, autoFrame);
        els.json.value = activeVersion.rawText ? activeVersion.rawText : JSON.stringify(activeVersion.data, null, 2);
        renderParams(activeVersion.data.parameters);
    }
    
    updateTabsUI();
    updateVersionsUI();
}

function switchVersion(versionId) {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;
    
    tab.activeVersionId = versionId;
    const version = tab.versions.find(v => v.id === versionId);
    if (version) {
        renderModel(version.data, false); // Keep camera stable (no autoframe)
        els.json.value = version.rawText ? version.rawText : JSON.stringify(version.data, null, 2);
        renderParams(version.data.parameters);
    }
    updateVersionsUI();
}

function closeTab(id, e) {
    if (e) e.stopPropagation();
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    state.tabs.splice(idx, 1);

    if (!state.tabs.length) {
        state.activeTabId = null;
        els.onboarding.style.display = 'flex';
        setTimeout(() => { els.onboarding.style.opacity = '1'; }, 30);
        while (state.modelGroup.children.length) state.modelGroup.remove(state.modelGroup.children[0]);
        els.json.value = '';
        els.infoV.textContent = '0';
        els.infoP.textContent = '0';
        els.infoB.textContent = '—';
        renderParams(null);
    } else if (state.activeTabId === id) {
        switchTab(state.tabs[Math.max(0, idx - 1)].id, false);
    }
    updateTabsUI();
    updateVersionsUI();
}

function updateTabsUI() {
    els.tabs.innerHTML = '';
    state.tabs.forEach(t => {
        const el = document.createElement('div');
        el.className = `tab-item${t.id === state.activeTabId ? ' active' : ''}`;
        el.onclick = () => switchTab(t.id, false);
        el.innerHTML = `
            <span class="tab-name"><i class="fa-solid fa-cube" style="font-size:10px;opacity:0.5"></i> ${t.name}</span>
            <button class="tab-close" onclick="closeTab('${t.id}',event)"><i class="fa-solid fa-xmark"></i></button>`;
        els.tabs.appendChild(el);
    });
}

function updateVersionsUI() {
    els.versionsList.innerHTML = '';
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) {
        els.versionsList.innerHTML = '<div class="empty-state">No design selected</div>';
        return;
    }

    tab.versions.forEach((v, index) => {
        const el = document.createElement('div');
        el.className = `version-item${v.id === tab.activeVersionId ? ' active' : ''}`;
        el.onclick = () => switchVersion(v.id);
        
        const verLabel = `V : ${index + 1} ; ${formatDateTime(v.timestamp)}`;
        
        el.innerHTML = `
            <span class="version-name">${verLabel}</span>
            ${v.id === tab.activeVersionId ? '<span class="version-active-tag">Active</span>' : ''}
        `;
        els.versionsList.appendChild(el);
    });
}

function renderParams(params) {
    els.params.innerHTML = '';
    if (!params || !Object.keys(params).length) {
        els.params.innerHTML = '<div class="empty-state">No parameters</div>';
        return;
    }
    Object.entries(params).forEach(([k, v]) => {
        const d = document.createElement('div');
        d.className = 'param-badge';
        d.innerHTML = `
            <span class="param-name">${k}</span>
            <input type="number" step="any" class="param-input" value="${v}" data-param="${k}">
        `;

        const input = d.querySelector('.param-input');
        const updateVal = () => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                const tab = state.tabs.find(t => t.id === state.activeTabId);
                if (tab) {
                    const activeVer = tab.versions.find(ver => ver.id === tab.activeVersionId);
                    if (activeVer) {
                        activeVer.data.parameters[k] = val;
                        renderModel(activeVer.data, false); // Keep camera stable
                        els.json.value = JSON.stringify(activeVer.data, null, 2);
                    }
                }
            }
        };

        input.oninput = updateVal;
        input.onchange = updateVal;
        els.params.appendChild(d);
    });
}

/* =====================================================================
   UI CONTROLS
   ===================================================================== */
function initControls() {
    // Collapsible Panels Toggle (Accordion)
    if (state.showVersionsPanel) {
        els.versionsPanel.classList.remove('collapsed');
        els.btnToggleVersions.classList.add('active');
    } else {
        els.versionsPanel.classList.add('collapsed');
        els.btnToggleVersions.classList.remove('active');
    }

    const toggleVersions = () => {
        state.showVersionsPanel = !state.showVersionsPanel;
        els.versionsPanel.classList.toggle('collapsed', !state.showVersionsPanel);
        els.btnToggleVersions.classList.toggle('active', state.showVersionsPanel);
    };

    els.btnToggleVersions.onclick = toggleVersions;
    els.headerVersions.onclick = toggleVersions;

    // Toggle Source Code panel
    els.headerCode.onclick = (e) => {
        // Prevent copy button click from toggling panel
        if (e.target.closest('#btn-copy-code') || e.target.closest('.icon-btn')) return;
        els.panelCode.classList.toggle('collapsed');
    };

    // Demo Loading
    els.btnDemo.onclick = () => {
        addTab('Parametric Bracket', GEO_EXAMPLES.Parametric_Bracket);
    };

    // Parametric Demo Loading
    const btnParametric = $('btn-load-parametric');
    if (btnParametric) {
        btnParametric.onclick = () => {
            addTab('Parametric Demo', GEO_EXAMPLES.Parametric_CAD_Demo);
        };
    }

    // Clear Versions
    els.btnClearVersions.onclick = () => {
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab) return;
        
        const activeVer = tab.versions.find(v => v.id === tab.activeVersionId);
        if (activeVer) {
            tab.versions = [activeVer];
            updateVersionsUI();
            toast('Cleared version history, kept active design', 'info');
        }
    };

    // Copy JSON
    els.btnCopy.onclick = () => {
        if (!els.json.value) return;
        navigator.clipboard.writeText(els.json.value).then(() => toast('Copied JSON source', 'success'));
    };

    // Copy AI prompt
    els.btnPrompt.onclick = () => {
        const p = `You are a geometry generation assistant. When asked to design a structure, output ONLY raw JSON in the "geometri" schema. No markdown, no extra text.\n\nSchema:\n{\n  "metadata": { "name": "Name", "version": "1.0.0", "description": "..." },\n  "parameters": { "param": float },\n  "vertices": [ { "id": "v0", "x": float_or_formula, "y": ..., "z": ... } ],\n  "primitives": [\n    { "type": "line", "start": "v_id", "end": "v_id" },\n    { "type": "circle", "center": "v_id", "radius": float_or_formula, "normal": [x,y,z] },\n    { "type": "bezier", "control_points": ["v0","v1","v2","v3"] }\n  ]\n}\n\nTo visualize, encode the JSON and link:\nhttps://atlas55kk.github.io/GEO/?data=<URL_Encoded_JSON>&tab=<Name>`;
        navigator.clipboard.writeText(p).then(() => toast('AI prompt template copied', 'success'));
    };

    // Grid Toggle
    els.ctrlGrid.onclick = () => {
        state.showGrid = !state.showGrid;
        state.gridGroup.visible = state.showGrid;
        els.ctrlGrid.classList.toggle('active', state.showGrid);
    };

    // Axes Toggle
    els.ctrlAxes.onclick = () => {
        state.showAxes = !state.showAxes;
        state.axesGroup.visible = state.showAxes;
        els.ctrlAxes.classList.toggle('active', state.showAxes);
        [els.axisX, els.axisY, els.axisZ].forEach(l => {
            if (l) l.style.display = state.showAxes ? '' : 'none';
        });
    };

    // Reset Camera / Auto-frame view
    els.ctrlCamera.onclick = () => {
        if (state.activeTabId) {
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (tab) {
                const activeVer = tab.versions.find(v => v.id === tab.activeVersionId);
                if (activeVer) {
                    renderModel(activeVer.data, true); // Force auto-frame on demand
                    toast('View reset to model bounds', 'info');
                    return;
                }
            }
        }
        // Default camera position fallback
        const cam = getCamera();
        cam.position.set(18, 14, 22);
        state.controls.target.set(0, 0, 0);
        state.controls.update();
        toast('View reset to origin', 'info');
    };

    // Ortho / Perspective toggle
    els.ctrlOrtho.onclick = () => {
        state.ortho = !state.ortho;
        els.ctrlOrtho.classList.toggle('active', state.ortho);

        // Seamless transition without jumping sizes/angles
        syncCameras();

        state.controls.object = getCamera();
        state.controls.update();
    };

    // Theme toggle
    els.ctrlTheme.onclick = () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', state.theme);

        state.scene.background = new THREE.Color(state.theme === 'dark' ? 0x0a0a0c : 0xf4f4f5);
        buildGrid();

        if (state.activeTabId) {
            const tab = state.tabs.find(t => t.id === state.activeTabId);
            if (tab) {
                const activeVer = tab.versions.find(v => v.id === tab.activeVersionId);
                if (activeVer) renderModel(activeVer.data, false); // Keep camera stable
            }
        }
    };

    // Share design
    els.btnShareDesign.onclick = () => {
        generateShareLink();
    };

    // Capture viewport
    els.ctrlCapture.onclick = () => {
        captureViewport();
    };
}

/* =====================================================================
   TOASTS
   ===================================================================== */
function toast(msg, type = 'info') {
    if (!els.toasts) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-triangle-exclamation' };
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    els.toasts.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2500);
}

/* =====================================================================
   URL LOADING
   ===================================================================== */
function checkUrl() {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('data');
    if (!d) return;

    try {
        let text;
        const decoded = decodeURIComponent(d);
        if (decoded.trim().startsWith('{') || decoded.includes('\n') || decoded.includes(' ') || decoded.includes('v ') || decoded.includes('p ')) {
            text = decoded;
        } else {
            try {
                text = atob(d.replace(/-/g, '+').replace(/_/g, '/'));
            } catch {
                text = decoded;
            }
        }
        
        let parsed;
        let rawText = null;
        const trimmed = text.trim();
        if (trimmed.startsWith('{')) {
            parsed = JSON.parse(trimmed);
        } else {
            parsed = parseGeoFormat(trimmed);
            rawText = trimmed;
        }
        addTab(p.get('tab') || parsed.metadata?.name || 'AI Model', parsed, rawText);
    } catch (e) {
        console.error('GEO: URL parse error', e);
        toast('Failed to load from URL', 'error');
    }
}

/* =====================================================================
   GLOBAL API (for local AI agents)
   ===================================================================== */
window.loadGeometriModel = function(jsonData, tabName = 'Live_Update') {
    try {
        let parsed;
        let rawText = null;
        if (typeof jsonData === 'string') {
            const trimmed = jsonData.trim();
            if (trimmed.startsWith('{')) {
                parsed = JSON.parse(trimmed);
            } else {
                parsed = parseGeoFormat(trimmed);
                rawText = trimmed;
            }
        } else {
            parsed = jsonData;
        }
        addTab(tabName, parsed, rawText);
    } catch (e) {
        console.error('GEO API error', e);
        toast('Failed to load model', 'error');
    }
};

/* =====================================================================
   SSE LISTENER (local launcher)
   ===================================================================== */
function initSSE() {
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

    const es = new EventSource('/events');
    es.onopen = () => {
        if (els.status) {
            els.status.classList.add('connected');
            els.status.querySelector('.status-label').textContent = 'Live';
        }
        toast('Connected to local AI', 'success');
    };
    es.onerror = () => {
        if (els.status) {
            els.status.classList.remove('connected');
            els.status.querySelector('.status-label').textContent = 'Offline';
        }
    };
    es.onmessage = (e) => {
        try {
            const payload = JSON.parse(e.data);
            if (payload?.data) window.loadGeometriModel(payload.data, payload.tab || 'Local_Design');
        } catch {}
    };
}

/* =====================================================================
   ADVANCED UTILITIES
   ===================================================================== */
function captureViewport() {
    if (!state.renderer) return;
    state.renderer.render(state.scene, getCamera());

    const dataUrl = state.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    
    let name = 'GEO_design';
    if (state.activeTabId) {
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (tab) name = tab.name.replace(/\s+/g, '_');
    }
    
    link.download = `${name}.png`;
    link.href = dataUrl;
    link.click();
    toast('Viewport screenshot captured', 'success');
}

function generateShareLink() {
    if (!state.activeTabId) {
        toast('No design loaded to share', 'error');
        return;
    }
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;
    const activeVer = tab.versions.find(v => v.id === tab.activeVersionId);
    if (!activeVer) return;

    try {
        const jsonStr = JSON.stringify(activeVer.data);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const safeB64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        
        const host = location.hostname === 'localhost' || location.hostname === '127.0.0.1' 
            ? 'https://atlas55kk.github.io/GEO/' 
            : location.origin + location.pathname;
            
        const shareUrl = `${host}?data=${safeB64}&tab=${encodeURIComponent(tab.name)}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            toast('Shareable URL copied to clipboard!', 'success');
        }).catch(() => {
            toast('Failed to copy link automatically', 'error');
        });
    } catch (e) {
        console.error(e);
        toast('Failed to generate share link', 'error');
    }
}

/* =====================================================================
   INIT
   ===================================================================== */
window.onload = () => {
    initThree();
    initControls();
    checkUrl();
    initSSE();
};
