# GEOMETRI Specification (`.gmtri` Format)

**GEOMETRI** (saved as `.gmtri` files) is a compact, space-delimited, line-oriented pre-visualization language designed for AI models and CAD tools to express wireframe 3D geometries.

Its main purpose is to **reduce token usage by 60%–80%** compared to verbose JSON, decreasing context overhead, API latency, and syntax errors for generating AI agents.

---

## 1. Syntax Rules & Tokenizer

1. **Line-Oriented**: The parser reads and evaluates the file line-by-line.
2. **Whitespace Separation**: Command elements and parameters are separated by one or more spaces or tabs.
3. **Space-Fragile Expression Tolerance**: To ensure parsing safety, the parser automatically strips spaces around arithmetic operators (`+`, `-`, `*`, `/`) inside coordinate formulas. 
   - However, for clarity and token efficiency, AI agents should avoid spaces in expressions. E.g., prefer `width*-1` over `width * -1`.
   - **Unary Minus Space Rule**: Unary minus signs must bind directly to the number or variable. Space before a negative sign acts as a list separator (e.g. `v0 0.0 0.0 -5.0`).
4. **Comments**: Lines starting with `#` (after ignoring leading spaces) or text following a `#` are treated as comments and skipped.
5. **Blank Lines**: Empty lines are ignored.

---

## 2. Command Set

### Metadata
Provides model identification and descriptors. Multi-word strings are fully preserved.
* **Syntax**: `meta <key> <value...>`
* **Arguments**: `<key>` is a single word; `<value...>` is the remainder of the line.
* **Example**:
  ```text
  meta name 3D Mount Plate
  meta version 1.0.1
  ```

### Parameters
Declares algebraic variables for coordinate formulas. Parameters are evaluated sequentially.
* **Syntax**: `p <id> <expression>`
* **Arguments**: `<id>` (variable name matching `/^[a-zA-Z_][a-zA-Z0-9_]*$/`; cannot be a reserved math keyword like `sin` or `pi`), `<expression>` (mathematical expression).
* **Example**:
  ```text
  p width 12.0
  p radius width*0.15
  ```

### Vertices
Declares a 3D coordinate point.
* **Syntax**: `v <id> <x_expr> <y_expr> <z_expr>`
* **Arguments**: `<id>` (unique vertex name), followed by three space-free coordinate expressions.
* **Example**:
  ```text
  v v0 0 0 0
  v v1 width*cos(pi/4) width*sin(pi/4) 0
  ```

### Primitives
Draws wireframe connections between vertices.

| Command | Syntax | Target Description | Example |
| :--- | :--- | :--- | :--- |
| **Line** | `l <start_id> <end_id>` | Connects two vertices with a straight segment | `l v0 v1` |
| **Circle** | `c <center_id> <radius> <nx> <ny> <nz>` | Draws a 3D circle of given radius and normal vector | `c v0 3.0 0 0 1` |
| **Arc** | `a <center_id> <radius> <start_rad> <end_rad> <nx> <ny> <nz>` | Draws a circle arc between two angles (radians) | `a v0 4.5 0 pi/2 0 0 1` |
| **Ellipse** | `e <center_id> <rx> <ry> <nx> <ny> <nz>` | Draws a 3D ellipse with X/Y radii | `e v0 5.0 2.5 0 1 0` |
| **b3** | `b3 <p0> <p1> <p2>` | Quadratic Bezier spline (exactly 3 control points) | `b3 v0 v1 v2` |
| **b4** | `b4 <p0> <p1> <p2> <p3>` | Cubic Bezier spline (exactly 4 control points) | `b4 v0 v1 v2 v3` |

*Note: The legacy command `b` is supported as a fallback, but new generators must use `b3` or `b4` for strict validation.*

---

## 3. Loophole Protection & Security

To prevent parsing errors or viewport crashes:
1. **Sequential Declaration**: A parameter `p` must be declared before it is referenced in an expression. A vertex `v` must be declared before it is used in a primitive. Cyclic parameters (e.g. `p A B` and `p B A` where neither is initialized) will resolve immediately to `0` at parse-time.
2. **Strict Token Counts**: Command lines are validated against their exact expected token counts:
   - `p`: 3 tokens
   - `v`: 5 tokens
   - `l`: 3 tokens
   - `c`: 6 tokens
   - `a`: 8 tokens
   - `e`: 7 tokens
   - `b3`: 4 tokens
   - `b4`: 5 tokens
3. **Math Sandbox**: Expressions are validated against a whitelist of characters: digits, standard operators (`+`, `-`, `*`, `/`, `(`, `)`, `,`, `.`), and math keywords (`sin`, `cos`, `tan`, `sqrt`, `pow`, `abs`, `pi`). Any other characters block evaluation, securing the runtime.
4. **Degenerate Normal Safeguard**: Normal vectors for circles, arcs, and ellipses must not equal `0 0 0`. If a degenerate normal vector is parsed, the visualizer automatically defaults it to `[0, 0, 1]` (along the Z-axis) to prevent mathematical undefined orientation and WebGL render crashes.
5. **Arc Orientation Direction**: Arcs are always drawn counter-clockwise relative to the direction the normal vector points (conforming to the Right-Hand Rule).
6. **Parameter Naming Rules**: Parameter identifiers (`p <id> <expression>`) must be valid variable names. They must start with a letter or underscore (`[a-zA-Z_]`) and contain only alphanumeric characters or underscores (`[a-zA-Z0-9_]`). They **must not** conflict with reserved mathematical keywords (`sin`, `cos`, `tan`, `sqrt`, `pow`, `abs`, `pi`). Parameter IDs violating these rules are skipped to prevent regular expression parsing crashes during substitution.
7. **Mathematical Domain Safety**: If an expression evaluates to division by zero (`Infinity`) or an undefined real number (`NaN` from complex roots like `sqrt(-1)`), the parser intercepts it and defaults the result to `0`, preventing invalid values from propagating to Three.js coordinates.
