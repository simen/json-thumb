// json-thumb — compact type-aware thumbnails of JSON data
// Optimized for agents who need to write jq queries against data they can't see.
//
// No dependencies. Pure TypeScript.

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Scalar type shape: string, number, boolean, or null */
export type ScalarShape = {
  kind: "scalar";
  type: "string" | "number" | "boolean" | "null";
};

/**
 * Array shape with length info and merged children shape.
 *
 * - `length`: actual length of THIS specific array (-1 for merged/synthetic shapes)
 * - `minLength`/`maxLength`: range of lengths seen when merging multiple arrays
 *   (e.g., a `tags` field across 100 records might have lengths 2–5)
 * - `children`: merged shape of all array elements
 */
export type ArrayShape = {
  kind: "array";
  length: number;
  minLength?: number;
  maxLength?: number;
  children: Shape;
};

/** Object shape: maps each key to its shape and whether it's optional */
export type ObjectShape = {
  kind: "object";
  keys: Record<string, FieldShape>;
};

/** Union of multiple distinct shapes */
export type VariedShape = {
  kind: "varied";
  variants: Shape[];
};

export type Shape = ScalarShape | ArrayShape | ObjectShape | VariedShape;

export type FieldShape = {
  shape: Shape;
  /** true if this key was absent in some sampled elements */
  optional: boolean;
};

export interface ThumbOptions {
  /** Max array elements to sample for type inference (default: 100) */
  sampleSize?: number;
  /** Max nesting depth before collapsing to `{...}` / `...` (default: 8) */
  maxDepth?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SAMPLE_SIZE = 100;
const DEFAULT_MAX_DEPTH = 8;

// ─── Shape Equality ──────────────────────────────────────────────────────────

/**
 * Structural equality for shapes. Ignores array length ranges —
 * only compares the type structure itself.
 */
function shapesEqual(a: Shape, b: Shape): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "scalar":
      return a.type === (b as ScalarShape).type;

    case "array":
      return shapesEqual(a.children, (b as ArrayShape).children);

    case "object": {
      const bb = b as ObjectShape;
      const aKeys = Object.keys(a.keys).sort();
      const bKeys = Object.keys(bb.keys).sort();
      if (aKeys.length !== bKeys.length) return false;
      for (let i = 0; i < aKeys.length; i++) {
        if (aKeys[i] !== bKeys[i]) return false;
        if (!shapesEqual(a.keys[aKeys[i]].shape, bb.keys[bKeys[i]].shape)) return false;
      }
      return true;
    }

    case "varied": {
      const bb = b as VariedShape;
      if (a.variants.length !== bb.variants.length) return false;
      return a.variants.every(av => bb.variants.some(bv => shapesEqual(av, bv)));
    }
  }
}

// ─── Shape Merging ───────────────────────────────────────────────────────────

/**
 * Merge two shapes into one that describes both.
 *
 * This is the core algorithm. Given shapes from two different values,
 * produce a single shape that accurately describes both:
 *
 * - Same scalar type → keep it
 * - Different scalar types → varied with both
 * - Two objects → union keys, recurse shared, mark missing-from-one as optional
 * - Two arrays → merge children shapes, combine length ranges
 * - Incompatible kinds → varied
 * - Anything + varied → fold into varied's variant list (deduplicated)
 */
function mergeShapes(a: Shape, b: Shape): Shape {
  // Handle varied on either side first
  if (a.kind === "varied" || b.kind === "varied") {
    return mergeWithVaried(a, b);
  }

  // Same kind
  if (a.kind === b.kind) {
    switch (a.kind) {
      case "scalar":
        if (a.type === (b as ScalarShape).type) return a;
        return { kind: "varied", variants: [a, b as ScalarShape] };

      case "object":
        return mergeObjectShapes(a, b as ObjectShape);

      case "array":
        return mergeArrayShapes(a, b as ArrayShape);
    }
  }

  // Different kinds → varied
  return { kind: "varied", variants: [a, b] };
}

function mergeObjectShapes(a: ObjectShape, b: ObjectShape): ObjectShape {
  const allKeys = new Set([...Object.keys(a.keys), ...Object.keys(b.keys)]);
  const merged: Record<string, FieldShape> = {};

  for (const key of allKeys) {
    const inA = key in a.keys;
    const inB = key in b.keys;

    if (inA && inB) {
      // Present in both: merge value shapes.
      // Stays non-optional only if it was non-optional in both inputs.
      merged[key] = {
        shape: mergeShapes(a.keys[key].shape, b.keys[key].shape),
        optional: a.keys[key].optional && b.keys[key].optional,
      };
    } else if (inA) {
      // Only in a → mark optional (missing from b's samples)
      merged[key] = { shape: a.keys[key].shape, optional: true };
    } else {
      // Only in b → mark optional (missing from a's samples)
      merged[key] = { shape: b.keys[key].shape, optional: true };
    }
  }

  return { kind: "object", keys: merged };
}

function mergeArrayShapes(a: ArrayShape, b: ArrayShape): ArrayShape {
  // Compute effective min/max from both sides.
  // If no range info exists, the single `length` value IS the min and max.
  const aMin = a.minLength ?? a.length;
  const aMax = a.maxLength ?? a.length;
  const bMin = b.minLength ?? b.length;
  const bMax = b.maxLength ?? b.length;

  const minLength = Math.min(aMin, bMin);
  const maxLength = Math.max(aMax, bMax);

  // Merge children — handle empty arrays gracefully.
  // An empty array has no meaningful children shape to contribute.
  const aEmpty = a.length === 0 && a.minLength === undefined;
  const bEmpty = b.length === 0 && b.minLength === undefined;

  let children: Shape;
  if (aEmpty && bEmpty) {
    children = a.children; // both empty, keep placeholder
  } else if (aEmpty) {
    children = b.children;
  } else if (bEmpty) {
    children = a.children;
  } else {
    children = mergeShapes(a.children, b.children);
  }

  return {
    kind: "array",
    length: -1, // merged — no single true length
    minLength,
    maxLength,
    children,
  };
}

/**
 * Merge shapes where at least one is a varied.
 * Collects all variants, deduplicates scalars, and merges
 * compatible complex structures (objects with objects, arrays with arrays).
 */
function mergeWithVaried(a: Shape, b: Shape): Shape {
  const aVariants = a.kind === "varied" ? a.variants : [a];
  const bVariants = b.kind === "varied" ? b.variants : [b];

  const variants: Shape[] = [];
  for (const v of [...aVariants, ...bVariants]) {
    addToVariants(variants, v);
  }

  if (variants.length === 1) return variants[0];
  return { kind: "varied", variants };
}

/**
 * Add a shape to a variants list, merging with compatible existing entries:
 * - Duplicate scalars → deduplicated (same kind + same type)
 * - Objects merge with existing objects (union keys, optional tracking)
 * - Arrays merge with existing arrays (merge children + length ranges)
 * - Everything else → added as a new variant
 */
function addToVariants(variants: Shape[], shape: Shape): void {
  for (let i = 0; i < variants.length; i++) {
    const existing = variants[i];

    // Exact scalar match → skip (deduplicate)
    if (existing.kind === "scalar" && shape.kind === "scalar" && existing.type === shape.type) {
      return;
    }

    // Merge objects together (keeps one object variant with all keys)
    if (existing.kind === "object" && shape.kind === "object") {
      variants[i] = mergeObjectShapes(existing, shape);
      return;
    }

    // Merge arrays together (merge children + length ranges)
    if (existing.kind === "array" && shape.kind === "array") {
      variants[i] = mergeArrayShapes(existing, shape);
      return;
    }
  }

  // No compatible match — add as new variant
  variants.push(shape);
}

// ─── Evenly-Spaced Sampling ─────────────────────────────────────────────────

/**
 * Pick up to sampleSize indices from an array of given length,
 * evenly spaced across the array. Deterministic (no randomness).
 *
 * For length=1000, sampleSize=100: picks 0, 10, 20, ... 990
 */
function sampleIndices(length: number, sampleSize: number): number[] {
  if (length <= sampleSize) {
    return Array.from({ length }, (_, i) => i);
  }
  const indices: number[] = [];
  for (let i = 0; i < sampleSize; i++) {
    indices.push(Math.floor((i * length) / sampleSize));
  }
  return indices;
}

// ─── Shape Inference ─────────────────────────────────────────────────────────

/**
 * Infer the structural shape of any JSON value.
 *
 * Walks the data recursively, sampling large arrays for efficiency,
 * and produces a Shape AST describing the type structure.
 *
 * @param value - Any JSON-compatible value
 * @param options - sampleSize (default 100), maxDepth (default 8)
 * @returns Shape AST
 */
export function inferShape(value: unknown, options?: ThumbOptions): Shape {
  const sampleSize = options?.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  return _inferShape(value, sampleSize, maxDepth, 0);
}

function _inferShape(
  value: unknown,
  sampleSize: number,
  maxDepth: number,
  depth: number
): Shape {
  // null / undefined → scalar null
  if (value === null || value === undefined) {
    return { kind: "scalar", type: "null" };
  }

  const t = typeof value;

  // Primitive scalars
  if (t === "string") return { kind: "scalar", type: "string" };
  if (t === "number") return { kind: "scalar", type: "number" };
  if (t === "boolean") return { kind: "scalar", type: "boolean" };

  // Arrays
  if (Array.isArray(value)) {
    return _inferArrayShape(value, sampleSize, maxDepth, depth);
  }

  // Objects (plain objects)
  if (t === "object") {
    return _inferObjectShape(value as Record<string, unknown>, sampleSize, maxDepth, depth);
  }

  // Fallback for exotic types (bigint, symbol, function, etc.)
  return { kind: "scalar", type: "string" };
}

function _inferArrayShape(
  arr: unknown[],
  sampleSize: number,
  maxDepth: number,
  depth: number
): ArrayShape {
  const len = arr.length;

  // Empty array — no children to describe
  if (len === 0) {
    return {
      kind: "array",
      length: 0,
      children: { kind: "scalar", type: "null" }, // placeholder; won't render
    };
  }

  // At depth limit: record the length but don't recurse into children.
  // The renderer will show "Array(N) of ..." at this depth.
  if (depth >= maxDepth) {
    return {
      kind: "array",
      length: len,
      children: { kind: "scalar", type: "null" }, // sentinel
    };
  }

  // Sample elements and infer their shapes
  const indices = sampleIndices(len, sampleSize);
  const shapes = indices.map(i => _inferShape(arr[i], sampleSize, maxDepth, depth + 1));

  // Merge all sampled element shapes into one unified shape
  let merged = shapes[0];
  for (let i = 1; i < shapes.length; i++) {
    merged = mergeShapes(merged, shapes[i]);
  }

  return {
    kind: "array",
    length: len,
    children: merged,
  };
}

function _inferObjectShape(
  obj: Record<string, unknown>,
  sampleSize: number,
  maxDepth: number,
  depth: number
): ObjectShape {
  const entries = Object.keys(obj);

  // Empty object or at depth limit → return empty keys.
  // The renderer distinguishes genuinely empty ({}) from depth-collapsed ({...})
  // by checking its own depth counter.
  if (entries.length === 0 || depth >= maxDepth) {
    return { kind: "object", keys: {} };
  }

  const keys: Record<string, FieldShape> = {};
  for (const key of entries) {
    keys[key] = {
      shape: _inferShape(obj[key], sampleSize, maxDepth, depth + 1),
      optional: false,
    };
  }

  return { kind: "object", keys };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Can this shape be rendered inline (on a single line) without becoming unreadable?
 *
 * Inline-able shapes:
 * - Scalars: `string`, `number`, etc.
 * - Varied of inline-able shapes: `string | number`
 * - Empty arrays: `Array(0)`
 * - Arrays of inline-able children: `Array(5) of string`
 * - Compact objects (≤3 keys, all inline-able values): `{a: number, b: string}`
 *
 * This is used to decide whether an object should render single-line or multiline.
 * The recursion naturally limits depth — an object inside an object inside an object
 * will eventually have too many keys or non-inline values.
 */
function isInlineShape(shape: Shape): boolean {
  switch (shape.kind) {
    case "scalar":
      return true;
    case "varied":
      return shape.variants.every(isInlineShape);
    case "array":
      // Empty arrays and arrays of inline children are inline-able
      if (isEmptyArray(shape)) return true;
      return isInlineShape(shape.children);
    case "object":
      return isCompactObject(shape);
  }
}

/**
 * Should this object render on a single line?
 * Yes if ≤3 keys and all values are inline-able.
 */
function isCompactObject(shape: ObjectShape): boolean {
  const keys = Object.keys(shape.keys);
  if (keys.length === 0) return true;
  if (keys.length > 3) return false;
  return keys.every(k => isInlineShape(shape.keys[k].shape));
}

/**
 * Format the length portion of an array descriptor.
 * - Known single length: "502"
 * - Range with different min/max: "2-5"
 * - Range with equal min/max: "3"
 */
function formatArrayLength(shape: ArrayShape): string {
  if (shape.minLength !== undefined && shape.maxLength !== undefined) {
    if (shape.minLength === shape.maxLength) {
      return String(shape.minLength);
    }
    return `${shape.minLength}-${shape.maxLength}`;
  }
  return String(shape.length);
}

/** Is this array effectively empty? */
function isEmptyArray(shape: ArrayShape): boolean {
  if (shape.minLength !== undefined && shape.maxLength !== undefined) {
    return shape.maxLength === 0;
  }
  return shape.length === 0;
}

/**
 * Render a Shape AST to the compact thumbnail string format.
 *
 * @param shape - The shape to render
 * @param indent - Current indentation level (number of spaces)
 * @param maxDepth - Maximum rendering depth
 * @param depth - Current rendering depth
 */
function renderShape(shape: Shape, indent: number, maxDepth: number, depth: number): string {
  switch (shape.kind) {
    case "scalar":
      return shape.type;

    case "varied":
      return shape.variants
        .map(v => renderShape(v, indent, maxDepth, depth))
        .join(" | ");

    case "array":
      return renderArray(shape, indent, maxDepth, depth);

    case "object":
      return renderObject(shape, indent, maxDepth, depth);
  }
}

function renderArray(shape: ArrayShape, indent: number, maxDepth: number, depth: number): string {
  const lenStr = formatArrayLength(shape);

  // Empty array
  if (isEmptyArray(shape)) {
    return "Array(0)";
  }

  // At depth limit → collapse children to "..."
  if (depth >= maxDepth) {
    return `Array(${lenStr}) of ...`;
  }

  const childStr = renderShape(shape.children, indent, maxDepth, depth + 1);
  return `Array(${lenStr}) of ${childStr}`;
}

function renderObject(shape: ObjectShape, indent: number, maxDepth: number, depth: number): string {
  const keys = Object.keys(shape.keys);

  // Empty keys: either genuinely empty or depth-collapsed.
  // At depth limit → show {...} to indicate truncation.
  // Below depth limit → genuinely empty → show {}.
  if (keys.length === 0) {
    return depth >= maxDepth ? "{...}" : "{}";
  }

  // Single-line for compact objects (≤3 simple keys)
  if (isCompactObject(shape)) {
    const parts = keys.map(k => {
      const field = shape.keys[k];
      const opt = field.optional ? "?" : "";
      const val = renderShape(field.shape, indent, maxDepth, depth + 1);
      return `${k}${opt}: ${val}`;
    });
    return `{${parts.join(", ")}}`;
  }

  // Multiline with 2-space indentation
  const innerIndent = indent + 2;
  const pad = " ".repeat(innerIndent);
  const closePad = " ".repeat(indent);

  const lines = keys.map(k => {
    const field = shape.keys[k];
    const opt = field.optional ? "?" : "";
    const val = renderShape(field.shape, innerIndent, maxDepth, depth + 1);
    return `${pad}${k}${opt}: ${val}`;
  });

  return `{\n${lines.join(",\n")}\n${closePad}}`;
}

// ─── Main API ────────────────────────────────────────────────────────────────

/**
 * Generate a compact type-aware thumbnail of a JSON value.
 *
 * The output is a recursive type description optimized for agents
 * who need to write jq queries against data they can't see.
 *
 * @param value - Any JSON-compatible value
 * @param options - sampleSize (default 100), maxDepth (default 8)
 * @returns Compact string describing the type structure
 *
 * @example
 * ```ts
 * thumb([{id: 1, name: "Alice"}, {id: 2, name: "Bob"}])
 * // → 'Array(2) of {id: number, name: string}'
 *
 * thumb(null)
 * // → 'null'
 *
 * thumb({a: 1, b: "two", c: true})
 * // → '{a: number, b: string, c: boolean}'
 *
 * thumb([[1,2], [3,4,5]])
 * // → 'Array(2) of Array(2-3) of number'
 * ```
 */
export function thumb(value: unknown, options?: ThumbOptions): string {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const shape = inferShape(value, options);
  return renderShape(shape, 0, maxDepth, 0);
}
