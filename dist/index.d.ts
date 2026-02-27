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
export declare function inferShape(value: unknown, options?: ThumbOptions): Shape;
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
export declare function thumb(value: unknown, options?: ThumbOptions): string;
//# sourceMappingURL=index.d.ts.map