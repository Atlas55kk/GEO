/**
 * GEO Preloaded Examples
 * Standard geometri format models for representation testing.
 */
const GEO_EXAMPLES = {
    "Parametric_Bracket": {
        "metadata": {
            "name": "Parametric Bracket",
            "version": "1.0.0",
            "description": "A mounting plate with a center mounting hole and chamfered layout"
        },
        "parameters": {
            "width": 12.0,
            "height": 8.0,
            "thickness": 0.5,
            "hole_radius": 1.5
        },
        "vertices": [
            { "id": "v0", "x": 0, "y": 0, "z": 0 },
            { "id": "v1", "x": "width", "y": 0, "z": 0 },
            { "id": "v2", "x": "width", "y": "height", "z": 0 },
            { "id": "v3", "x": 0, "y": "height", "z": 0 },
            { "id": "v_center", "x": "width / 2", "y": "height / 2", "z": 0 }
        ],
        "primitives": [
            { "type": "line", "start": "v0", "end": "v1" },
            { "type": "line", "start": "v1", "end": "v2" },
            { "type": "line", "start": "v2", "end": "v3" },
            { "type": "line", "start": "v3", "end": "v0" },
            { "type": "circle", "center": "v_center", "radius": "hole_radius", "normal": [0, 0, 1] }
        ]
    },

    "3D_Pyramid": {
        "metadata": {
            "name": "3D Pyramid",
            "version": "1.0.0",
            "description": "A 3D square-based pyramid showing vertical elevation representation"
        },
        "parameters": {
            "base_size": 10.0,
            "height": 12.0
        },
        "vertices": [
            { "id": "v0", "x": "-base_size/2", "y": 0, "z": "-base_size/2" },
            { "id": "v1", "x": "base_size/2", "y": 0, "z": "-base_size/2" },
            { "id": "v2", "x": "base_size/2", "y": 0, "z": "base_size/2" },
            { "id": "v3", "x": "-base_size/2", "y": 0, "z": "base_size/2" },
            { "id": "v_apex", "x": 0, "y": "height", "z": 0 }
        ],
        "primitives": [
            /* Base Square */
            { "type": "line", "start": "v0", "end": "v1" },
            { "type": "line", "start": "v1", "end": "v2" },
            { "type": "line", "start": "v2", "end": "v3" },
            { "type": "line", "start": "v3", "end": "v0" },
            /* Side Edges */
            { "type": "line", "start": "v0", "end": "v_apex" },
            { "type": "line", "start": "v1", "end": "v_apex" },
            { "type": "line", "start": "v2", "end": "v_apex" },
            { "type": "line", "start": "v3", "end": "v_apex" }
        ]
    },

    "Spline_Curve": {
        "metadata": {
            "name": "Bezier Spline Curve",
            "version": "1.0.0",
            "description": "A smooth cubic Bezier spline showing complex path routing"
        },
        "parameters": {
            "span": 16.0,
            "wave_height": 6.0
        },
        "vertices": [
            { "id": "p0", "x": 0, "y": 0, "z": 0 },
            { "id": "p_ctrl1", "x": "span * 0.25", "y": "wave_height", "z": "wave_height / 2" },
            { "id": "p_ctrl2", "x": "span * 0.75", "y": "-wave_height", "z": "-wave_height / 2" },
            { "id": "p1", "x": "span", "y": 0, "z": 0 }
        ],
        "primitives": [
            { 
                "type": "bezier", 
                "control_points": ["p0", "p_ctrl1", "p_ctrl2", "p1"] 
            },
            /* Guide lines showing the control cage (dashed or grayed) */
            { "type": "line", "start": "p0", "end": "p_ctrl1" },
            { "type": "line", "start": "p_ctrl1", "end": "p_ctrl2" },
            { "type": "line", "start": "p_ctrl2", "end": "p1" }
        ]
    }
};
