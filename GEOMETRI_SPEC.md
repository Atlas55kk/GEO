# GEOMETRI Specification (`.gmtri` Format)

**GEOMETRI** (saved as `.gmtri` files) is a compact, space-delimited, line-oriented pre-visualization language designed for AI models and CAD tools to express wireframe 3D geometries.

Its main purpose is to **reduce token usage by 60%–80%** compared to verbose JSON, decreasing context overhead, API latency, and syntax errors for generating AI agents.

---

## 1. Syntax Rules & Tokenizer

1. **Line-Oriented**: The parser reads and evaluates the file line-by-line.
2. **Whitespace Separation**: Command elements and parameters are separated by one or more spaces or tabs.
3. **No Spaces in Expressions**: To prevent parsing ambiguity, mathematical expressions must contain **no whitespace**.
   * *Correct*: `v v1 width*cos(pi/3) height/2 0`
   * *Incorrect*: `v v1 width * cos(pi / 3) height / 2 0` (breaks argument counting)
4. **Comments**: Lines starting with `#` (after ignoring leading spaces) or text following a `#` are treated as comments and skipped.
5. **Blank Lines**: Empty lines are ignored.

---

## 2. Command Set

### Metadata
Provides model identification and descriptors.
* **Syntax**: `meta <key> <value...>`
* **Arguments**: `<key>` is a single word; `<value...>` is the remainder of the line.
* **Example**:
  ```text
  meta name 3D Mount Plate
  meta version 1.0.1
  ```

### Parameters
Declares algebraic variables for coordinate formulas.
* **Syntax**: `p <id> <expression>`
* **Arguments**: `<id>` (variable name), `<expression>` (mathematical expression).
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
| **Bezier** | `b <p0> <p1> <p2> [p3]` | Quadratic (3 points) or Cubic (4 points) spline | `b v0 v1 v2` |

---

## 3. Loophole Protection & Security

To prevent parsing errors or code injection:
1. **Sequential Declaration**: A parameter `p` must be declared before it is referenced in an expression. A vertex `v` must be declared before it is used in a primitive. If an undefined identifier is referenced, the line is skipped and logged as an error without crashing the visualizer.
2. **Strict Token Counts**: Command lines are validated against their exact expected token counts:
   - `p`: 3 tokens
   - `v`: 5 tokens
   - `l`: 3 tokens
   - `c`: 6 tokens
   - `a`: 8 tokens
   - `e`: 7 tokens
   - `b`: 4 or 5 tokens
3. **Math Sandbox**: Expressions are validated against a whitelist of characters: digits, standard operators (`+`, `-`, `*`, `/`, `(`, `)`, `,`, `.`), and math keywords (`sin`, `cos`, `tan`, `sqrt`, `pow`, `abs`, `pi`, `PI`). Any other characters block evaluation, securing the runtime.
