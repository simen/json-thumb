# json-thumb Design Spec

## Goal

Generate a compact, recursive type description of any JSON value — a "thumbnail" that tells you enough to write a correct jq expression against the data without seeing it.

## API

```ts
thumb(value: unknown, options?: ThumbOptions): string
```

### Options
- `sampleSize` — max array elements to sample for type inference (default: 100)
- `maxDepth` — max nesting depth before collapsing (default: 8)

## Output Format

The output is a recursive type description. Every level gets described uniformly.

### Scalars
- `string`, `number`, `boolean`, `null`

### Objects
Curly braces with key: type pairs:
```
{name: string, age: number, active: boolean}
```

### Arrays
`Array(count)` with element type described recursively:
```
Array(502) of {id: string, name: string, price: number}
```

For short arrays (≤5 items), show as tuple-like:
```
Array(3) of number
```

### Nested structures
Recurse fully:
```
{
  results: Array(502) of {
    id: string,
    name: string,
    tags: Array(2-5) of string,
    metadata: {created: string, author: {name: string, email: string}}
  },
  pagination: {page: number, pageSize: number, total: number, hasNext: boolean},
  _meta: {requestId: string, timing: number}
}
```

### Heterogeneous types (varied)
Use `|` for union types:
```
string | number
```

### Optional fields
Use `?` suffix for fields not present in all sampled elements:
```
{name: string, admin?: boolean, score: string | number}
```

### Array length ranges
When array lengths vary across elements, show range:
```
Array(2-5) of string
```

### Empty collections
```
Array(0)
{}
```

### Depth collapse
At maxDepth, show `{...}` or `Array(N) of ...`

## Implementation Architecture

### Phase 1: inferShape(value, sampleSize)
Walk the data and produce a shape AST:

```ts
type Shape =
  | { kind: "scalar"; type: "string" | "number" | "boolean" | "null" }
  | { kind: "array"; length: number; children: Shape }
  | { kind: "object"; keys: Record<string, FieldShape> }
  | { kind: "varied"; variants: Shape[] }

type FieldShape = {
  shape: Shape;
  optional: boolean;  // true if not present in all sampled elements
}
```

For arrays:
1. Sample up to sampleSize elements
2. Infer shape of each sampled element
3. Merge shapes: same structure → unified shape, different → varied
4. Track which object keys appear in all vs some samples → optional flag
5. Track min/max array lengths for nested arrays

### Phase 2: renderThumb(shape)
Render the shape AST to the compact string format.

Rules:
- Objects: `{key1: type1, key2: type2}`
- Arrays: `Array(N) of type` or `Array(min-max) of type`
- Varied: `type1 | type2`
- Optional: `key?: type`
- Recurse into all children — no budget-based collapsing (for now)
- At maxDepth: `{...}` / `Array(N) of ...`

## Key Design Decisions

1. **Pure type description** — no sample values in v1. Types + counts + structure is enough for jq.
2. **Recursive all the way** — every nested object/array gets fully described until maxDepth.
3. **Sampling for large arrays** — don't iterate all 100K items, sample 100 and merge.
4. **Optional field detection** — critical for heterogeneous data where not all records have all fields.
5. **Array length ranges** — when nested arrays vary in size, show the range.
6. **No budget/truncation in v1** — keep it simple. Truncation of leaf nodes can come later.
