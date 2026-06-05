# GEO // 3D Wireframe Representation Engine

**GEO** is a lightweight, open-source 3D visualizer and pre-visualization tool for the **`geometri`** representation standard. 

Its core mission is to solve the **spatial reasoning bottleneck** of AI models generating CAD structures. Instead of jumping from a natural language prompt directly to complex, stateful CAD programming scripts (like Blender `bpy` or FreeCAD Python), the AI first generates a lightweight mathematical definition in `geometri` format. GEO parses and renders this structure instantly so you can verify the design before generating the final production CAD script.

---

## Key Features

*   **Zero Manual Interventions**: Automatically visualizes designs with zero copy-pasting required.
*   **Dual Mode Architecture**:
    *   **Online**: Hosted entirely serverless on **GitHub Pages**. Visualizations open automatically in a new browser tab via URL-encoded state parameters.
    *   **Local/Offline**: Runs as a dedicated native desktop application via a lightweight Python WebView. Local AI models (like Ollama or IDE agents) push designs directly into the running desktop window via a local background server.
*   **Version Comparison Tabs**: Manage multiple design iterations in separate tabs directly inside the GEO workspace to easily compare and track changes.
*   **Dynamic Parametric Solving**: Supports math formulas and variable declarations (e.g., `width * 0.5`) evaluated dynamically.

---

## Installation & Setup

GEO runs entirely on the client-side. You can clone and run it locally with zero complex dependencies.

### 1. Clone the repository
```bash
git clone https://github.com/Atlas55kk/GEO.git
cd GEO
```

### 2. Launching the Local Application
You can run the launcher script using Python:
```bash
python launcher.py
```
*   **Desktop App Mode**: If `pywebview` is installed, it will automatically open as a standalone native desktop window.
*   **Web Server Mode (Fallback)**: If `pywebview` is not found, it starts a local concurrent web server. Open `http://127.0.0.1:4360/index.html` in your web browser.

> [!TIP]
> To install pywebview for native desktop mode, run:
> `pip install pywebview`

---

## The `geometri` Schema Specification

The `geometri` format is a simple, declerative JSON schema. It is designed to be extremely easy for AIs to output without syntax errors.

```json
{
  "metadata": {
    "name": "Model Name",
    "version": "1.0.0",
    "description": "Short explanation of the geometry"
  },
  "parameters": {
    "width": 10.0,
    "height": 5.0,
    "radius": 1.5
  },
  "vertices": [
    { "id": "v0", "x": 0.0, "y": 0.0, "z": 0.0 },
    { "id": "v1", "x": "width", "y": 0.0, "z": 0.0 },
    { "id": "v2", "x": "width", "y": "height", "z": 0.0 },
    { "id": "v3", "x": 0.0, "y": "height", "z": 0.0 },
    { "id": "v_center", "x": "width / 2", "y": "height / 2", "z": 0.0 }
  ],
  "primitives": [
    { "type": "line", "start": "v0", "end": "v1" },
    { "type": "line", "start": "v1", "end": "v2" },
    { "type": "line", "start": "v2", "end": "v3" },
    { "type": "line", "start": "v3", "end": "v0" },
    { "type": "circle", "center": "v_center", "radius": "radius", "normal": [0, 0, 1] }
  ]
}
```

### Supported Primitives
*   **`line`**: Standard straight edge. Connects two vertex IDs.
*   **`circle`**: A circle in 3D space. Requires a `center` vertex, `radius` (numeric or parameter formula), and a `normal` vector defining its orientation in 3D.
*   **`bezier`**: A cubic Bezier spline. Requires a `control_points` array containing 4 vertex IDs ($P_0$ start, $P_1$ control 1, $P_2$ control 2, $P_3$ end).

---

## How it works: Automating the Workflow

### 1. Online AI (ChatGPT / Gemini / Claude)
When an online AI model designs a model, it generates the `geometri` JSON, encodes it, and displays a link in the chat.
The link format is:
```
https://atlas55kk.github.io/GEO/?data=<URL_Encoded_JSON>&tab=<Tab_Name>
```
When you click it, it opens GEO in a new tab and immediately renders the model.

### 2. Local/Offline AI (Ollama / Local agents)
The local server in `launcher.py` listens on port `4360`. When a local AI is running, it can update the active visualizer window by making a simple HTTP POST request:

```bash
curl -X POST http://127.0.0.1:4360/update \
  -H "Content-Type: application/json" \
  -d '{
    "tab": "Bracket_V2",
    "data": {
      "vertices": [{"id": "v0", "x": 0, "y": 0, "z": 0}, {"id": "v1", "x": 10, "y": 10, "z": 0}],
      "primitives": [{"type": "line", "start": "v0", "end": "v1"}]
    }
  }'
```
The desktop application automatically listens for this and displays it in a new tab without reloading or manual steps.

---

## AI System Instruction Prompt
Copy and paste this prompt to teach any AI model how to write code for GEO:

```text
You are a geometry design assistant. When the user asks you to design a structure, you must first output the visual pre-visualization code using the "geometri" JSON format.

Output ONLY the raw JSON block without markdown code blocks, formatting, or extra chat.

JSON Schema structure:
{
  "metadata": { "name": "Name", "version": "1.0.0", "description": "Desc" },
  "parameters": { "param_name": float },
  "vertices": [ { "id": "v0", "x": float_or_string_math_formula, "y": float_or_formula, "z": float_or_formula } ],
  "primitives": [
    { "type": "line", "start": "v_id", "end": "v_id" },
    { "type": "circle", "center": "v_id", "radius": float_or_formula, "normal": [x, y, z] },
    { "type": "bezier", "control_points": ["v0", "v1", "v2", "v3"] }
  ]
}

To display the 3D model, append the URL-encoded JSON string to:
https://atlas55kk.github.io/GEO/?data=<URL_Encoded_JSON_String>&tab=<Tab_Name>
Present this URL as a clear markdown link: [View 3D Model in GEO](URL).
```
