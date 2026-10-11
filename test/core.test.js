import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAttributes } from '../src/core.js';

describe('sanitizeAttributes', () => {
  it('accepts primitives', () => {
    const r = sanitizeAttributes({ a: 'hello', b: 42, c: true });
    assert.deepEqual(r.attributes, { a: 'hello', b: 42, c: true });
    assert.deepEqual(r.dropped, []);
  });

  it('rejects NaN and Infinity', () => {
    const r = sanitizeAttributes({ a: NaN, b: Infinity, c: -Infinity });
    assert.deepEqual(r.attributes, {});
    assert.deepEqual(r.dropped, ['a', 'b', 'c']);
  });

  it('accepts bigint and clamps large magnitudes', () => {
    const r = sanitizeAttributes({ a: 5n, b: 9999999999n, c: -9999999999n });
    assert.equal(r.attributes.a, 5n);
    assert.equal(r.attributes.b, 1000000000n);
    assert.equal(r.attributes.c, -1000000000n);
  });

  it('accepts homogeneous arrays', () => {
    const r = sanitizeAttributes({ ns: [1, 2, 3], ss: ['a', 'b'], bs: [true, false] });
    assert.deepEqual(r.attributes.ns, [1, 2, 3]);
    assert.deepEqual(r.attributes.ss, ['a', 'b']);
    assert.deepEqual(r.attributes.bs, [true, false]);
  });

  it('drops heterogeneous arrays entirely', () => {
    const r = sanitizeAttributes({ mixed: [1, 'two'] });
    assert.deepEqual(r.attributes, {});
    assert.deepEqual(r.dropped, ['mixed']);
  });

  it('drops empty arrays entirely', () => {
    const r = sanitizeAttributes({ empty: [] });
    assert.deepEqual(r.attributes, {});
    assert.deepEqual(r.dropped, ['empty']);
  });

  it('truncates arrays longer than 128 to a sentinel', () => {
    const long = Array.from({ length: 200 }, (_, i) => i);
    const r = sanitizeAttributes({ long });
    assert.deepEqual(r.attributes.long, ['MAX_VALUE_COUNT_EXCEEDED']);
  });

  it('replaces over-long strings with a sentinel value', () => {
    const long = 'x'.repeat(9000);
    const r = sanitizeAttributes({ long, ok: 'fine' });
    assert.equal(r.attributes.long, 'MAX_VALUE_LENGTH_EXCEEDED');
    assert.equal(r.attributes.ok, 'fine');
  });

  it('drops non-string non-number keys silently', () => {
    const r = sanitizeAttributes({ [Symbol('x')]: 'v' });
    assert.deepEqual(r.attributes, {});
    assert.deepEqual(r.dropped, []);
  });

  it('drops object-typed values', () => {
    const r = sanitizeAttributes({ obj: { x: 1 }, arr: [{}] });
    assert.deepEqual(r.attributes, {});
    assert.deepEqual(r.dropped, ['obj', 'arr']);
  });

  it('handles non-object input gracefully', () => {
    assert.deepEqual(sanitizeAttributes(null).attributes, {});
    assert.deepEqual(sanitizeAttributes(undefined).attributes, {});
    assert.deepEqual(sanitizeAttributes('x').attributes, {});
    assert.deepEqual(sanitizeAttributes([]).attributes, {});
  });

  it('stops accepting after 128 attributes and reports a sentinel', () => {
    const input = {};
    for (let i = 0; i < 150; i++) input['k' + i] = i;
    const r = sanitizeAttributes(input);
    assert.equal(Object.keys(r.attributes).length, 128);
    assert.deepEqual(r.dropped, ['MAX_ATTR_COUNT_REACHED']);
  });
});
