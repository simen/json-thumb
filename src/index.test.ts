import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { thumb, inferShape } from './index.js';

// =============================================================================
// 1. Scalar Values
// =============================================================================
describe('Scalar Values', () => {
  it('null → "null"', () => {
    assert.equal(thumb(null), 'null');
  });

  it('true → "boolean"', () => {
    assert.equal(thumb(true), 'boolean');
  });

  it('false → "boolean"', () => {
    assert.equal(thumb(false), 'boolean');
  });

  it('42 → "number"', () => {
    assert.equal(thumb(42), 'number');
  });

  it('3.14 → "number"', () => {
    assert.equal(thumb(3.14), 'number');
  });

  it('0 → "number"', () => {
    assert.equal(thumb(0), 'number');
  });

  it('"" (empty string) → "string"', () => {
    assert.equal(thumb(''), 'string');
  });

  it('"hello" → "string"', () => {
    assert.equal(thumb('hello'), 'string');
  });
});

// =============================================================================
// 2. Empty Collections
// =============================================================================
describe('Empty Collections', () => {
  it('[] → "Array(0)"', () => {
    assert.equal(thumb([]), 'Array(0)');
  });

  it('{} → "{}"', () => {
    assert.equal(thumb({}), '{}');
  });
});

// =============================================================================
// 3. Simple Arrays (homogeneous)
// =============================================================================
describe('Simple Arrays', () => {
  it('[1, 2, 3] → "Array(3) of number"', () => {
    assert.equal(thumb([1, 2, 3]), 'Array(3) of number');
  });

  it('["a", "b"] → "Array(2) of string"', () => {
    assert.equal(thumb(['a', 'b']), 'Array(2) of string');
  });

  it('[true, false, true] → "Array(3) of boolean"', () => {
    assert.equal(thumb([true, false, true]), 'Array(3) of boolean');
  });

  it('[null, null] → "Array(2) of null"', () => {
    assert.equal(thumb([null, null]), 'Array(2) of null');
  });
});

// =============================================================================
// 4. Heterogeneous Arrays
// =============================================================================
describe('Heterogeneous Arrays', () => {
  it('[1, "two", true, null] → contains all four types with |', () => {
    const result = thumb([1, 'two', true, null]);
    // Should be Array(4) of <union of types>
    assert.ok(result.startsWith('Array(4) of '), `Expected "Array(4) of ...", got: ${result}`);
    // All four scalar types should appear in the union (order may vary)
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
    assert.ok(result.includes('boolean'), `Missing "boolean" in: ${result}`);
    assert.ok(result.includes('null'), `Missing "null" in: ${result}`);
    // Should use | separator
    assert.ok(result.includes('|'), `Missing "|" separator in: ${result}`);
  });

  it('[1, "two"] → Array(2) of number | string', () => {
    const result = thumb([1, 'two']);
    assert.ok(result.startsWith('Array(2) of '), `Expected "Array(2) of ...", got: ${result}`);
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
    assert.ok(result.includes('|'), `Missing "|" separator in: ${result}`);
  });
});

// =============================================================================
// 5. Simple Objects
// =============================================================================
describe('Simple Objects', () => {
  it('{a: 1} → "{a: number}"', () => {
    assert.equal(thumb({ a: 1 }), '{a: number}');
  });

  it('{name: "Alice", age: 30} → contains both keys with correct types', () => {
    const result = thumb({ name: 'Alice', age: 30 });
    assert.ok(result.includes('name: string'), `Missing "name: string" in: ${result}`);
    assert.ok(result.includes('age: number'), `Missing "age: number" in: ${result}`);
    // Should be wrapped in braces
    assert.ok(result.startsWith('{'), `Should start with "{": ${result}`);
    assert.ok(result.endsWith('}'), `Should end with "}": ${result}`);
  });

  it('{x: true, y: null} → correct types for each key', () => {
    const result = thumb({ x: true, y: null });
    assert.ok(result.includes('x: boolean'), `Missing "x: boolean" in: ${result}`);
    assert.ok(result.includes('y: null'), `Missing "y: null" in: ${result}`);
  });
});

// =============================================================================
// 6. Nested Objects
// =============================================================================
describe('Nested Objects', () => {
  it('{a: {b: {c: 1}}} → nested type description', () => {
    const result = thumb({ a: { b: { c: 1 } } });
    // Should show nested structure
    assert.ok(result.includes('a:'), `Missing "a:" in: ${result}`);
    assert.ok(result.includes('b:'), `Missing "b:" in: ${result}`);
    assert.ok(result.includes('c: number'), `Missing "c: number" in: ${result}`);
  });

  it('user with nested address → fully recursive description', () => {
    const data = {
      user: {
        name: 'Alice',
        address: { city: 'NYC', zip: '10001' },
      },
    };
    const result = thumb(data);
    assert.ok(result.includes('name: string'), `Missing "name: string" in: ${result}`);
    assert.ok(result.includes('city: string'), `Missing "city: string" in: ${result}`);
    assert.ok(result.includes('zip: string'), `Missing "zip: string" in: ${result}`);
    assert.ok(result.includes('user:'), `Missing "user:" in: ${result}`);
    assert.ok(result.includes('address:'), `Missing "address:" in: ${result}`);
  });
});

// =============================================================================
// 7. Arrays of Objects (most common case)
// =============================================================================
describe('Arrays of Objects', () => {
  it('[{id: 1, name: "a"}, {id: 2, name: "b"}] → Array(2) of {id: number, name: string}', () => {
    const result = thumb([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    assert.ok(result.startsWith('Array(2) of '), `Expected "Array(2) of ...", got: ${result}`);
    assert.ok(result.includes('id: number'), `Missing "id: number" in: ${result}`);
    assert.ok(result.includes('name: string'), `Missing "name: string" in: ${result}`);
  });

  it('large array of 500 identical-shape objects → correct count', () => {
    const data = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      value: `item-${i}`,
    }));
    const result = thumb(data);
    assert.ok(result.includes('Array(500)'), `Expected "Array(500)" in: ${result}`);
    assert.ok(result.includes('id: number'), `Missing "id: number" in: ${result}`);
    assert.ok(result.includes('value: string'), `Missing "value: string" in: ${result}`);
  });

  it('array of 1000 objects → correct count and shape', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({
      key: `k${i}`,
      num: i * 2,
      flag: i % 2 === 0,
    }));
    const result = thumb(data);
    assert.ok(result.includes('Array(1000)'), `Expected "Array(1000)" in: ${result}`);
    assert.ok(result.includes('key: string'), `Missing "key: string" in: ${result}`);
    assert.ok(result.includes('num: number'), `Missing "num: number" in: ${result}`);
    assert.ok(result.includes('flag: boolean'), `Missing "flag: boolean" in: ${result}`);
  });
});

// =============================================================================
// 8. Optional Fields
// =============================================================================
describe('Optional Fields', () => {
  it('[{a: 1, b: 2}, {a: 3}] → b should be marked optional with ?', () => {
    const result = thumb([{ a: 1, b: 2 }, { a: 3 }]);
    // "a" should be required (no ?)
    assert.ok(result.includes('a: number'), `Missing "a: number" in: ${result}`);
    // "b" should be optional
    assert.ok(result.includes('b?'), `Missing "b?" in: ${result}`);
    assert.ok(result.includes('b?: number'), `Missing "b?: number" in: ${result}`);
    // "a" should NOT have ?
    assert.ok(!result.includes('a?'), `"a" should not be optional in: ${result}`);
  });

  it('mixed record types → correct optional detection', () => {
    const data = [
      { type: 'user', name: 'Alice' },
      { type: 'org', title: 'Acme' },
    ];
    const result = thumb(data);
    // "type" is in both → required
    assert.ok(!result.includes('type?'), `"type" should not be optional in: ${result}`);
    assert.ok(result.includes('type: string'), `Missing "type: string" in: ${result}`);
    // "name" only in first → optional
    assert.ok(result.includes('name?'), `Missing "name?" in: ${result}`);
    // "title" only in second → optional
    assert.ok(result.includes('title?'), `Missing "title?" in: ${result}`);
  });

  it('all objects have the field → not optional', () => {
    const data = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 },
    ];
    const result = thumb(data);
    assert.ok(!result.includes('a?'), `"a" should not be optional in: ${result}`);
    assert.ok(!result.includes('b?'), `"b" should not be optional in: ${result}`);
  });
});

// =============================================================================
// 9. Varied Types in Fields
// =============================================================================
describe('Varied Types in Fields', () => {
  it('[{score: 1}, {score: "high"}] → score should be number | string', () => {
    const result = thumb([{ score: 1 }, { score: 'high' }]);
    assert.ok(result.includes('score:'), `Missing "score:" in: ${result}`);
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
    assert.ok(result.includes('|'), `Missing "|" for union type in: ${result}`);
  });

  it('[{val: 1}, {val: null}] → val should be number | null', () => {
    const result = thumb([{ val: 1 }, { val: null }]);
    assert.ok(result.includes('val:'), `Missing "val:" in: ${result}`);
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
    assert.ok(result.includes('null'), `Missing "null" in: ${result}`);
    assert.ok(result.includes('|'), `Missing "|" for union type in: ${result}`);
  });
});

// =============================================================================
// 10. Nested Arrays
// =============================================================================
describe('Nested Arrays', () => {
  it('{tags: [["a", "b"], ["c"]]} → array of arrays with correct types', () => {
    const result = thumb({ tags: [['a', 'b'], ['c']] });
    assert.ok(result.includes('tags:'), `Missing "tags:" in: ${result}`);
    // Should describe an array of arrays of string
    assert.ok(result.includes('Array(2)'), `Missing "Array(2)" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
  });

  it('[[1, 2], [3, 4, 5]] → Array(2) of Array(2-3) of number', () => {
    const result = thumb([[1, 2], [3, 4, 5]]);
    assert.ok(result.startsWith('Array(2) of '), `Expected "Array(2) of ...", got: ${result}`);
    // Inner arrays have lengths 2 and 3, so should show range
    assert.ok(result.includes('2-3'), `Expected length range "2-3" in: ${result}`);
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
  });

  it('array of arrays with same length → no range', () => {
    const result = thumb([[1, 2], [3, 4]]);
    assert.ok(result.startsWith('Array(2) of '), `Expected "Array(2) of ...", got: ${result}`);
    // Inner arrays both have length 2, so should show Array(2) not a range
    // The full result should be something like "Array(2) of Array(2) of number"
    assert.ok(
      result.includes('Array(2) of number'),
      `Expected inner "Array(2) of number" in: ${result}`
    );
  });
});

// =============================================================================
// 11. Array Length Ranges
// =============================================================================
describe('Array Length Ranges', () => {
  it('[{items: [1, 2]}, {items: [3, 4, 5, 6]}] → items shows Array(2-4) of number', () => {
    const result = thumb([
      { items: [1, 2] },
      { items: [3, 4, 5, 6] },
    ]);
    assert.ok(result.includes('items:'), `Missing "items:" in: ${result}`);
    // Should show range 2-4
    assert.ok(result.includes('2-4'), `Expected length range "2-4" in: ${result}`);
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
  });

  it('varying nested array lengths across many objects', () => {
    const data = [
      { tags: ['a'] },
      { tags: ['a', 'b', 'c'] },
      { tags: ['a', 'b'] },
    ];
    const result = thumb(data);
    // Lengths are 1, 3, 2 → range 1-3
    assert.ok(result.includes('1-3'), `Expected length range "1-3" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
  });

  it('all same length nested arrays → single number, no range', () => {
    const data = [
      { items: [1, 2, 3] },
      { items: [4, 5, 6] },
    ];
    const result = thumb(data);
    // All inner arrays have length 3 — should not show a range
    assert.ok(result.includes('Array(3) of number'), `Expected "Array(3) of number" in: ${result}`);
    assert.ok(!result.includes('3-3'), `Should not show "3-3" range in: ${result}`);
  });
});

// =============================================================================
// 12. Complex Real-World Shapes
// =============================================================================
describe('Complex Real-World Shapes', () => {
  it('API response pattern → correct structure', () => {
    const data = {
      results: Array.from({ length: 100 }, (_, i) => ({
        id: `id-${i}`,
        name: `Item ${i}`,
        price: i * 10.5,
        tags: ['tag1', 'tag2'],
        metadata: {
          created: '2024-01-01',
          author: { name: 'Alice', email: 'a@b.com' },
        },
      })),
      pagination: { page: 1, pageSize: 50, total: 100, hasNext: true },
      _meta: { requestId: 'req-123', timing: 0.5 },
    };
    const result = thumb(data);

    // Top-level keys
    assert.ok(result.includes('results:'), `Missing "results:" in: ${result}`);
    assert.ok(result.includes('pagination:'), `Missing "pagination:" in: ${result}`);
    assert.ok(result.includes('_meta:'), `Missing "_meta:" in: ${result}`);

    // Results array count
    assert.ok(result.includes('Array(100)'), `Missing "Array(100)" in: ${result}`);

    // Results element fields
    assert.ok(result.includes('id: string'), `Missing "id: string" in: ${result}`);
    assert.ok(result.includes('price: number'), `Missing "price: number" in: ${result}`);

    // Nested tags array
    assert.ok(result.includes('tags:'), `Missing "tags:" in: ${result}`);

    // Nested metadata
    assert.ok(result.includes('metadata:'), `Missing "metadata:" in: ${result}`);
    assert.ok(result.includes('created: string'), `Missing "created: string" in: ${result}`);
    assert.ok(result.includes('author:'), `Missing "author:" in: ${result}`);
    assert.ok(result.includes('email: string'), `Missing "email: string" in: ${result}`);

    // Pagination fields
    assert.ok(result.includes('page: number'), `Missing "page: number" in: ${result}`);
    assert.ok(result.includes('pageSize: number'), `Missing "pageSize: number" in: ${result}`);
    assert.ok(result.includes('total: number'), `Missing "total: number" in: ${result}`);
    assert.ok(result.includes('hasNext: boolean'), `Missing "hasNext: boolean" in: ${result}`);

    // _meta fields
    assert.ok(result.includes('requestId: string'), `Missing "requestId: string" in: ${result}`);
    assert.ok(result.includes('timing: number'), `Missing "timing: number" in: ${result}`);
  });

  it('Elasticsearch-like logs → correct structure', () => {
    const data = Array.from({ length: 200 }, (_, i) => ({
      _index: 'logs',
      _id: `doc-${i}`,
      _source: {
        '@timestamp': '2024-01-01T00:00:00Z',
        message: 'Something happened',
        level: 'info',
        host: { name: 'server-1', ip: '10.0.0.1' },
      },
    }));
    const result = thumb(data);

    // Array count
    assert.ok(result.includes('Array(200)'), `Missing "Array(200)" in: ${result}`);

    // Top-level fields of each element
    assert.ok(result.includes('_index: string'), `Missing "_index: string" in: ${result}`);
    assert.ok(result.includes('_id: string'), `Missing "_id: string" in: ${result}`);
    assert.ok(result.includes('_source:'), `Missing "_source:" in: ${result}`);

    // Nested _source fields
    assert.ok(result.includes('@timestamp: string'), `Missing "@timestamp: string" in: ${result}`);
    assert.ok(result.includes('message: string'), `Missing "message: string" in: ${result}`);
    assert.ok(result.includes('level: string'), `Missing "level: string" in: ${result}`);

    // Nested host
    assert.ok(result.includes('host:'), `Missing "host:" in: ${result}`);
    assert.ok(result.includes('ip: string'), `Missing "ip: string" in: ${result}`);
  });
});

// =============================================================================
// 13. Depth Limiting
// =============================================================================
describe('Depth Limiting', () => {
  it('deeply nested structure with maxDepth: 3 → inner levels collapsed', () => {
    // Create a 10-level deep nested object
    let deep: any = { value: 42 };
    for (let i = 9; i >= 0; i--) {
      deep = { [`level${i}`]: deep };
    }

    const result = thumb(deep, { maxDepth: 3 });

    // First few levels should be expanded
    assert.ok(result.includes('level0:'), `Missing "level0:" in: ${result}`);
    assert.ok(result.includes('level1:'), `Missing "level1:" in: ${result}`);
    assert.ok(result.includes('level2:'), `Missing "level2:" in: ${result}`);

    // At maxDepth, should collapse to {...} or similar
    assert.ok(
      result.includes('{...}') || result.includes('...'),
      `Expected depth collapse marker "{...}" or "..." in: ${result}`
    );

    // Deep levels should NOT appear
    assert.ok(!result.includes('value: number'), `"value: number" should be collapsed at depth 3: ${result}`);
  });

  it('deeply nested array with maxDepth → collapsed', () => {
    // Nested arrays: build deep nesting
    let deep: any = [1, 2, 3];
    for (let i = 0; i < 10; i++) {
      deep = [deep, deep];
    }

    const result = thumb(deep, { maxDepth: 3 });
    // Should show Array at top levels but collapse inner ones
    assert.ok(result.includes('Array('), `Expected "Array(" in: ${result}`);
    assert.ok(
      result.includes('...'),
      `Expected collapse marker "..." in: ${result}`
    );
  });

  it('maxDepth: 1 → top-level object keys shown, nested objects collapsed', () => {
    const data = { a: { b: { c: 1 } }, x: 42 };
    const result = thumb(data, { maxDepth: 1 });
    assert.ok(result.includes('a:'), `Missing "a:" in: ${result}`);
    assert.ok(result.includes('x: number'), `Missing "x: number" in: ${result}`);
    // Nested object should be collapsed
    assert.ok(
      result.includes('{...}') || result.includes('...'),
      `Expected collapse at depth 1 in: ${result}`
    );
  });

  it('maxDepth: 0 → everything collapsed at root for objects', () => {
    const data = { a: 1, b: 2 };
    const result = thumb(data, { maxDepth: 0 });
    // At depth 0, the object itself should be collapsed
    assert.ok(
      result.includes('{...}') || result.includes('...'),
      `Expected collapse at depth 0 in: ${result}`
    );
  });
});

// =============================================================================
// 14. Sampling
// =============================================================================
describe('Sampling', () => {
  it('array of 10000 identical-shape objects → correct output with sampling', () => {
    const data = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      active: true,
    }));
    const result = thumb(data);

    // Count should reflect actual array length, not sample size
    assert.ok(result.includes('Array(10000)'), `Expected "Array(10000)" in: ${result}`);
    // Shape should still be correctly inferred from samples
    assert.ok(result.includes('id: number'), `Missing "id: number" in: ${result}`);
    assert.ok(result.includes('name: string'), `Missing "name: string" in: ${result}`);
    assert.ok(result.includes('active: boolean'), `Missing "active: boolean" in: ${result}`);
  });

  it('custom sampleSize option is respected', () => {
    // Create array where all items have same shape
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      label: `label-${i}`,
    }));
    const result = thumb(data, { sampleSize: 10 });
    assert.ok(result.includes('Array(1000)'), `Expected "Array(1000)" in: ${result}`);
    assert.ok(result.includes('id: number'), `Missing "id: number" in: ${result}`);
  });

  it('large array count is preserved even with small sample', () => {
    const data = Array.from({ length: 50000 }, () => ({ x: 1 }));
    const result = thumb(data, { sampleSize: 50 });
    assert.ok(result.includes('Array(50000)'), `Expected "Array(50000)" in: ${result}`);
  });
});

// =============================================================================
// 15. Edge Cases
// =============================================================================
describe('Edge Cases', () => {
  it('undefined value → handled gracefully (treated as null)', () => {
    // undefined is not valid JSON, but the library should handle it
    const result = thumb(undefined as any);
    assert.equal(result, 'null');
  });

  it('nested nulls: {a: null} → {a: null}', () => {
    const result = thumb({ a: null });
    assert.equal(result, '{a: null}');
  });

  it('array containing empty objects: [{}, {}] → Array(2) of {}', () => {
    const result = thumb([{}, {}]);
    assert.ok(result.startsWith('Array(2)'), `Expected "Array(2)..." in: ${result}`);
    assert.ok(result.includes('{}'), `Expected "{}" for empty objects in: ${result}`);
  });

  it('array containing empty arrays: [[], []] → Array(2) of Array(0)', () => {
    const result = thumb([[], []]);
    assert.ok(result.startsWith('Array(2)'), `Expected "Array(2)..." in: ${result}`);
    assert.ok(result.includes('Array(0)'), `Expected "Array(0)" for empty arrays in: ${result}`);
  });

  it('single-element array: [{a: 1}] → Array(1) of {a: number}', () => {
    const result = thumb([{ a: 1 }]);
    assert.ok(result.startsWith('Array(1) of '), `Expected "Array(1) of ...", got: ${result}`);
    assert.ok(result.includes('a: number'), `Missing "a: number" in: ${result}`);
  });

  it('object with many keys (20+) → all keys should appear', () => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < 25; i++) {
      obj[`key${i}`] = i;
    }
    const result = thumb(obj);
    // All 25 keys should be present
    for (let i = 0; i < 25; i++) {
      assert.ok(
        result.includes(`key${i}: number`),
        `Missing "key${i}: number" in: ${result}`
      );
    }
  });

  it('object with string, number, boolean, and null values', () => {
    const result = thumb({ s: 'hi', n: 42, b: true, nil: null });
    assert.ok(result.includes('s: string'), `Missing "s: string" in: ${result}`);
    assert.ok(result.includes('n: number'), `Missing "n: number" in: ${result}`);
    assert.ok(result.includes('b: boolean'), `Missing "b: boolean" in: ${result}`);
    assert.ok(result.includes('nil: null'), `Missing "nil: null" in: ${result}`);
  });

  it('array with single null → Array(1) of null', () => {
    assert.equal(thumb([null]), 'Array(1) of null');
  });

  it('deeply nested empty objects', () => {
    const result = thumb({ a: { b: { c: {} } } });
    assert.ok(result.includes('c: {}'), `Missing "c: {}" in: ${result}`);
  });

  it('array of mixed empty and non-empty objects → optional fields', () => {
    const result = thumb([{ a: 1 }, {}]);
    // "a" should be optional since it's missing from the second object
    assert.ok(result.includes('a?'), `Missing "a?" (optional) in: ${result}`);
  });

  it('negative numbers → "number"', () => {
    assert.equal(thumb(-42), 'number');
  });

  it('very large number → "number"', () => {
    assert.equal(thumb(Number.MAX_SAFE_INTEGER), 'number');
  });

  it('NaN → "number" (typeof NaN is number)', () => {
    // NaN is technically typeof "number" in JS
    const result = thumb(NaN);
    assert.equal(result, 'number');
  });
});

// =============================================================================
// 16. inferShape API Tests
// =============================================================================
describe('inferShape API', () => {
  describe('scalar shapes', () => {
    it('null → scalar shape with type "null"', () => {
      const shape = inferShape(null);
      assert.equal(shape.kind, 'scalar');
      if (shape.kind === 'scalar') {
        assert.equal(shape.type, 'null');
      }
    });

    it('number → scalar shape with type "number"', () => {
      const shape = inferShape(42);
      assert.equal(shape.kind, 'scalar');
      if (shape.kind === 'scalar') {
        assert.equal(shape.type, 'number');
      }
    });

    it('string → scalar shape with type "string"', () => {
      const shape = inferShape('hello');
      assert.equal(shape.kind, 'scalar');
      if (shape.kind === 'scalar') {
        assert.equal(shape.type, 'string');
      }
    });

    it('boolean → scalar shape with type "boolean"', () => {
      const shape = inferShape(true);
      assert.equal(shape.kind, 'scalar');
      if (shape.kind === 'scalar') {
        assert.equal(shape.type, 'boolean');
      }
    });

    it('false → scalar shape with type "boolean"', () => {
      const shape = inferShape(false);
      assert.equal(shape.kind, 'scalar');
      if (shape.kind === 'scalar') {
        assert.equal(shape.type, 'boolean');
      }
    });
  });

  describe('array shapes', () => {
    it('empty array → array shape with length 0', () => {
      const shape = inferShape([]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.length, 0);
      }
    });

    it('[1, 2, 3] → array shape with length 3 and scalar number child', () => {
      const shape = inferShape([1, 2, 3]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.length, 3);
        assert.equal(shape.children.kind, 'scalar');
        if (shape.children.kind === 'scalar') {
          assert.equal(shape.children.type, 'number');
        }
      }
    });

    it('array length tracking for nested arrays', () => {
      // [[1, 2], [3, 4, 5]] — inner arrays have lengths 2 and 3
      const shape = inferShape([[1, 2], [3, 4, 5]]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.length, 2);
        // The children shape should be an array with length info
        assert.equal(shape.children.kind, 'array');
      }
    });
  });

  describe('object shapes', () => {
    it('{a: 1} → object shape with key "a"', () => {
      const shape = inferShape({ a: 1 });
      assert.equal(shape.kind, 'object');
      if (shape.kind === 'object') {
        assert.ok('a' in shape.keys, 'Missing key "a" in shape');
        assert.equal(shape.keys.a.shape.kind, 'scalar');
        assert.equal(shape.keys.a.optional, false);
      }
    });

    it('empty object → object shape with no keys', () => {
      const shape = inferShape({});
      assert.equal(shape.kind, 'object');
      if (shape.kind === 'object') {
        assert.equal(Object.keys(shape.keys).length, 0);
      }
    });

    it('multi-key object → all keys present in shape', () => {
      const shape = inferShape({ name: 'Alice', age: 30, active: true });
      assert.equal(shape.kind, 'object');
      if (shape.kind === 'object') {
        assert.ok('name' in shape.keys, 'Missing key "name"');
        assert.ok('age' in shape.keys, 'Missing key "age"');
        assert.ok('active' in shape.keys, 'Missing key "active"');
        // Check types
        if (shape.keys.name.shape.kind === 'scalar') {
          assert.equal(shape.keys.name.shape.type, 'string');
        }
        if (shape.keys.age.shape.kind === 'scalar') {
          assert.equal(shape.keys.age.shape.type, 'number');
        }
        if (shape.keys.active.shape.kind === 'scalar') {
          assert.equal(shape.keys.active.shape.type, 'boolean');
        }
      }
    });
  });

  describe('varied shapes', () => {
    it('[1, "two"] → array with varied children', () => {
      const shape = inferShape([1, 'two']);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.children.kind, 'varied');
        if (shape.children.kind === 'varied') {
          // Should have two variants: number and string
          assert.equal(shape.children.variants.length, 2);
          const variantKinds = shape.children.variants.map(
            (v: any) => (v.kind === 'scalar' ? v.type : v.kind)
          );
          assert.ok(variantKinds.includes('number'), `Missing "number" variant in: ${variantKinds}`);
          assert.ok(variantKinds.includes('string'), `Missing "string" variant in: ${variantKinds}`);
        }
      }
    });

    it('[1, "two", true, null] → varied with 4 variants', () => {
      const shape = inferShape([1, 'two', true, null]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.children.kind, 'varied');
        if (shape.children.kind === 'varied') {
          assert.equal(shape.children.variants.length, 4);
        }
      }
    });

    it('homogeneous array → NOT varied', () => {
      const shape = inferShape([1, 2, 3]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        // Should be scalar, not varied, since all elements are the same type
        assert.equal(shape.children.kind, 'scalar');
      }
    });
  });

  describe('optional field detection in shape AST', () => {
    it('[{a: 1, b: 2}, {a: 3}] → b is optional in shape', () => {
      const shape = inferShape([{ a: 1, b: 2 }, { a: 3 }]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.children.kind, 'object');
        if (shape.children.kind === 'object') {
          // "a" should be required
          assert.ok('a' in shape.children.keys, 'Missing key "a"');
          assert.equal(shape.children.keys.a.optional, false);
          // "b" should be optional
          assert.ok('b' in shape.children.keys, 'Missing key "b"');
          assert.equal(shape.children.keys.b.optional, true);
        }
      }
    });

    it('all objects have same keys → none optional', () => {
      const shape = inferShape([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.children.kind, 'object');
        if (shape.children.kind === 'object') {
          assert.equal(shape.children.keys.x.optional, false);
          assert.equal(shape.children.keys.y.optional, false);
        }
      }
    });

    it('three objects with progressively fewer keys → correct optionality', () => {
      const shape = inferShape([
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5 },
        { a: 6 },
      ]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array' && shape.children.kind === 'object') {
        assert.equal(shape.children.keys.a.optional, false, '"a" should be required');
        assert.equal(shape.children.keys.b.optional, true, '"b" should be optional');
        assert.equal(shape.children.keys.c.optional, true, '"c" should be optional');
      }
    });
  });

  describe('array length tracking in shape AST', () => {
    it('nested arrays with varying lengths → length info in shape', () => {
      const shape = inferShape([
        { items: [1, 2] },
        { items: [3, 4, 5, 6] },
      ]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.children.kind, 'object');
        if (shape.children.kind === 'object') {
          const itemsShape = shape.children.keys.items.shape;
          assert.equal(itemsShape.kind, 'array');
          // The array shape should track length info — could be min/max or a range
          // The exact representation depends on implementation, but the length
          // should reflect the range of observed lengths
        }
      }
    });

    it('top-level array length is preserved', () => {
      const shape = inferShape([1, 2, 3, 4, 5]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.length, 5);
      }
    });

    it('single-element array → length 1', () => {
      const shape = inferShape([42]);
      assert.equal(shape.kind, 'array');
      if (shape.kind === 'array') {
        assert.equal(shape.length, 1);
      }
    });
  });
});

// =============================================================================
// Integration tests
// =============================================================================
describe('Integration: round-trip consistency', () => {
  it('thumb output is always a string', () => {
    assert.equal(typeof thumb(null), 'string');
    assert.equal(typeof thumb(42), 'string');
    assert.equal(typeof thumb([1, 2]), 'string');
    assert.equal(typeof thumb({ a: 1 }), 'string');
    assert.equal(typeof thumb([]), 'string');
    assert.equal(typeof thumb({}), 'string');
  });

  it('thumb with default options matches thumb with explicit defaults', () => {
    const data = [{ id: 1, name: 'test' }];
    const defaultResult = thumb(data);
    const explicitResult = thumb(data, { sampleSize: 100, maxDepth: 8 });
    assert.equal(defaultResult, explicitResult);
  });

  it('inferShape followed by manual inspection matches thumb output semantics', () => {
    const data = { name: 'Alice', age: 30 };
    const shape = inferShape(data);
    const result = thumb(data);

    // Shape should be an object
    assert.equal(shape.kind, 'object');
    // thumb output should contain the same keys
    assert.ok(result.includes('name: string'));
    assert.ok(result.includes('age: number'));
  });
});

describe('Integration: complex nested with optional and varied', () => {
  it('array of objects with optional nested objects and varied types', () => {
    const data = [
      { id: 1, meta: { score: 10, tags: ['a', 'b'] } },
      { id: 2, meta: { score: 'high', tags: ['c'] } },
      { id: 3 },
    ];
    const result = thumb(data);

    // id should be required
    assert.ok(result.includes('id: number'), `Missing "id: number" in: ${result}`);
    // meta should be optional (missing from third element)
    assert.ok(result.includes('meta?'), `Missing "meta?" in: ${result}`);
    // score should be number | string (varied)
    assert.ok(result.includes('number'), `Missing "number" in: ${result}`);
    assert.ok(result.includes('string'), `Missing "string" in: ${result}`);
  });

  it('real-world GitHub API-like response', () => {
    const data = {
      items: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        full_name: `owner/repo-${i}`,
        private: false,
        owner: {
          login: 'owner',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
        },
        description: i % 3 === 0 ? null : `Description for repo ${i}`,
        fork: i % 5 === 0,
        stargazers_count: i * 100,
        language: i % 4 === 0 ? null : 'JavaScript',
        topics: Array.from({ length: (i % 4) + 1 }, (_, j) => `topic-${j}`),
      })),
      total_count: 1000,
      incomplete_results: false,
    };
    const result = thumb(data);

    // Top-level structure
    assert.ok(result.includes('items:'), `Missing "items:" in: ${result}`);
    assert.ok(result.includes('Array(30)'), `Missing "Array(30)" in: ${result}`);
    assert.ok(result.includes('total_count: number'), `Missing "total_count: number" in: ${result}`);
    assert.ok(result.includes('incomplete_results: boolean'), `Missing "incomplete_results: boolean" in: ${result}`);

    // Nested owner object
    assert.ok(result.includes('owner:'), `Missing "owner:" in: ${result}`);
    assert.ok(result.includes('login: string'), `Missing "login: string" in: ${result}`);
    assert.ok(result.includes('avatar_url: string'), `Missing "avatar_url: string" in: ${result}`);

    // description is sometimes null, sometimes string → varied
    assert.ok(result.includes('description:'), `Missing "description:" in: ${result}`);

    // language is sometimes null, sometimes string → varied
    assert.ok(result.includes('language:'), `Missing "language:" in: ${result}`);

    // topics is an array of varying length
    assert.ok(result.includes('topics:'), `Missing "topics:" in: ${result}`);
  });
});
