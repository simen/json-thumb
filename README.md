# json-thumb

**Compact type-aware thumbnails of JSON data.**

```
Array(502) of {id: string, name: string, price: number, tags: Array(2-5) of string, inStock?: boolean}
```

---

## The problem

You fetched a large API response. It's 800 KB of JSON — too big to display, so it gets stashed with a reference ID. Now you need to write a `jq` query against it. But what are the field names? Which fields are optional? How deep does it nest?

**json-thumb** solves this by generating a compact, recursive type description of any JSON value — a *thumbnail* that shows the shape without the bulk. One glance tells you exactly what's in the data and how to query it.

---

## Install

```sh
npm install json-thumb
```

---

## Quick example

```js
import { thumb } from 'json-thumb';

const apiResponse = {
  results: [
    { id: "p1", name: "Widget A", price: 9.99,  tags: ["sale", "new"],                inStock: true  },
    { id: "p2", name: "Widget B", price: 24.99, tags: ["featured"],                   inStock: false },
    { id: "p3", name: "Widget C", price: 4.49,  tags: ["sale", "budget", "clearance"]               },
    // ... 499 more items
  ],
  pagination: { page: 1, pageSize: 20, total: 502, hasNext: true },
  _meta: { requestId: "abc-123", timing: 84 }
};

console.log(thumb(apiResponse));
```

Output:

```
{
  results: Array(502) of {id: string, name: string, price: number, tags: Array(1-3) of string, inStock?: boolean},
  pagination: {page: number, pageSize: number, total: number, hasNext: boolean},
  _meta: {requestId: string, timing: number}
}
```

You now know: there are 502 results, each with those exact fields, `inStock` is optional, and `tags` is a variable-length array of strings. Ready to write your query.

---

## API

### `thumb(value, options?)`

Returns a compact thumbnail string describing the shape of any JSON value.

```ts
thumb(value: unknown, options?: ThumbOptions): string
```

### `inferShape(value, options?)`

Returns the intermediate shape AST — useful if you want to inspect or transform the structure programmatically before rendering.

```ts
inferShape(value: unknown, options?: ThumbOptions): Shape
```

### Types

```ts
interface ThumbOptions {
  sampleSize?: number;  // max array elements to sample (default: 100)
  maxDepth?:   number;  // max nesting depth before collapsing (default: 8)
}

type Shape =
  | { kind: "scalar"; type: "string" | "number" | "boolean" | "null" }
  | { kind: "array";  length: number; children: Shape }
  | { kind: "object"; keys: Record<string, FieldShape> }
  | { kind: "varied"; variants: Shape[] }

type FieldShape = {
  shape:    Shape;
  optional: boolean;  // true if absent in any sampled element
}
```

---

## Output format reference

| Notation | Meaning |
|---|---|
| `string` `number` `boolean` `null` | Scalar types |
| `{key: type}` | Object with fields |
| `{key?: type}` | Field present in *some* but not all elements |
| `Array(N) of type` | Array of N elements, all the same shape |
| `Array(min-max) of type` | Nested arrays whose lengths vary across elements |
| `type1 | type2` | Field or element takes more than one type |
| `Array(0)` | Empty array |
| `{}` | Empty object |
| `{...}` | Object collapsed at `maxDepth` |
| `Array(N) of ...` | Array collapsed at `maxDepth` |

---

## More examples

### Simple array of strings

```js
thumb(["apple", "banana", "cherry"])
// → Array(3) of string
```

### Heterogeneous array

```js
thumb([1, "two", 3, "four"])
// → Array(4) of number | string
```

### Nested objects

```js
thumb({
  user: { name: "Alice", address: { city: "Oslo", country: "NO" } },
  score: 42
})
// → {user: {name: string, address: {city: string, country: string}}, score: number}
```

### Optional fields

```js
thumb([
  { id: 1, name: "Alice", admin: true },
  { id: 2, name: "Bob" },
  { id: 3, name: "Carol" }
])
// → Array(3) of {id: number, name: string, admin?: boolean}
```

### Array length ranges

```js
thumb([
  { tags: ["a", "b"] },
  { tags: ["x", "y", "z", "w"] },
  { tags: ["p"] }
])
// → Array(3) of {tags: Array(1-4) of string}
```

---

## Options

### `sampleSize` (default: `100`)

For large arrays, json-thumb samples up to `sampleSize` elements rather than iterating all of them. Shapes are merged across the sample — optional fields and type unions are detected from the sample.

```js
thumb(hugeArray, { sampleSize: 20 })   // faster, less accurate
thumb(hugeArray, { sampleSize: 500 })  // slower, more accurate
```

### `maxDepth` (default: `8`)

Nesting deeper than `maxDepth` is collapsed to `{...}` or `Array(N) of ...` to keep the output readable.

```js
thumb(deeplyNested, { maxDepth: 3 })
// → {a: {b: {c: {...}}}}
```

---

## Use case: AI agents querying stashed data

json-thumb is designed for the workflow where an AI agent fetches data that's too large to fit in context:

**1. Agent fetches data** — response is 600 KB, gets stashed as `result:abc123`

**2. Thumbnail is shown** — agent sees the shape, not the data:

```
Array(1240) of {
  id: string,
  event: string,
  timestamp: string,
  payload: {userId: string, action: string, meta?: {ip: string, ua: string}},
  severity: string | number
}
```

**3. Agent writes the query** — first try, no guessing:

```sh
jq '[.[] | select(.severity == "error") | {id, ts: .timestamp, user: .payload.userId}]'
```

Without the thumbnail, the agent would have to guess field names, check whether `meta` is always present, and figure out whether `severity` is a string or number. With it, the answer is immediate.

---

## License

MIT © Simen Svale Skogsrud
