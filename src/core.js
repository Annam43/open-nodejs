const MAX_ATTR_COUNT = 128;
const MAX_KEY_LENGTH = 255;
const MAX_VALUE_LENGTH = 8 * 1024;
const MAX_ATTR_COUNT_REACHED = 'MAX_ATTR_COUNT_REACHED';
const MAX_VALUE_LENGTH_EXCEEDED = 'MAX_VALUE_LENGTH_EXCEEDED';
const MAX_VALUE_COUNT_EXCEEDED = 'MAX_VALUE_COUNT_EXCEEDED';

/**
 * Why a 1e9 clamp rather than a rejection: OTel collectors commonly apply a
 * 1 ns resolution cap; allowing larger numbers risks collector-side overflow.
 * We keep the value but normalise so callers can still correlate logs.
 */
function clampBigInt(v) {
  if (v > 1_000_000_000n) return 1_000_000_000n;
  if (v < -1_000_000_000n) return -1_000_000_000n;
  return v;
}

function toOutputKey(k) {
  if (typeof k === 'number') return String(k);
  if (typeof k !== 'string') return null;
  if (k.length === 0 || k.length > MAX_KEY_LENGTH) return null;
  return k;
}

function coerceValue(v) {
  switch (typeof v) {
    case 'boolean':
      return v;
    case 'number':
      if (!Number.isFinite(v)) return null;
      return v;
    case 'bigint':
      return clampBigInt(v);
    case 'string':
      if (v.length > MAX_VALUE_LENGTH) return MAX_VALUE_LENGTH_EXCEEDED;
      return v;
    case 'object':
      if (v === null) return null;
      if (Array.isArray(v)) return coerceArray(v);
      return null;
    default:
      return null;
  }
}

function coerceArray(arr) {
  if (arr.length === 0) return null;
  if (arr.length > MAX_ATTR_COUNT) return [MAX_VALUE_COUNT_EXCEEDED];
  const type = typeof arr[0];
  if (type !== 'boolean' && type !== 'number' && type !== 'string') return null;
  const out = [];
  for (const el of arr) {
    const et = typeof el;
    if (et !== type) return null;
    if (et === 'number' && !Number.isFinite(el)) return null;
    if (et === 'string' && el.length > MAX_VALUE_LENGTH) return MAX_VALUE_LENGTH_EXCEEDED;
    out.push(el);
  }
  return out;
}

/**
 * Validates and coerces key-value attribute pairs against OpenTelemetry
 * semantic type constraints.
 *
 * Per the OTel spec, an attribute value may be a primitive (string, number,
 * boolean, null) or a homogeneous array of primitives.
 *
 * Return type decisions made deliberately (documented in the README):
 * - The map includes only accepted keys; dropped keys are reported in `dropped`.
 * - A string value that exceeds 8 KiB is replaced with the sentinel
 *   `MAX_VALUE_LENGTH_EXCEEDED` so the loss is visible in downstream tools.
 * - Large arrays that exceed 128 elements are replaced with the sentinel
 *   `['MAX_VALUE_COUNT_EXCEEDED']`.
 *
 * @param {Record<string, unknown>} attributes
 * @returns {{attributes: Record<string, boolean|number|string|null|boolean[]|number[]|string[]>, dropped: string[]}}
 */
export function sanitizeAttributes(attributes) {
  const out = {};
  const dropped = [];
  if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return { attributes: out, dropped };
  }
  let count = 0;
  for (const k of Object.keys(attributes)) {
    if (count >= MAX_ATTR_COUNT) {
      dropped.push(MAX_ATTR_COUNT_REACHED);
      break;
    }
    const key = toOutputKey(k);
    const value = coerceValue(attributes[k]);
    if (key === null || value === null || value === undefined) {
      dropped.push(k);
      continue;
    }
    out[key] = value;
    count++;
  }
  return { attributes: out, dropped };
}
