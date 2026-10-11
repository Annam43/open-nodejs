# open-nodejs

Validates and coerces key-value attribute pairs against OpenTelemetry semantic type constraints before they are handed to an exporter.

```js
import { sanitizeAttributes } from 'open-nodejs';

const { attributes, dropped } = sanitizeAttributes({
  'http.method': 'GET',
  'http.status_code': 200,
  'http.request.size': [1024, 2048],
  'telemetry.bad': NaN,
});
console.log(attributes); // { 'http.method': 'GET', 'http.status_code': 200, 'http.request.size': [1024, 2048] }
console.log(dropped);    // ['telemetry.bad']
```

## Why this exists

OTel exporters silently drop attributes that violate the spec, which makes telemetry vanish at the boundary with no diagnostic. This library moves that boundary into application code where you can log what was rejected before it disappears.

The trade-off: values that cannot be represented are not silently dropped. Over-long strings are replaced with the sentinel `MAX_VALUE_LENGTH_EXCEEDED`; over-full arrays are replaced with `['MAX_VALUE_COUNT_EXCEEDED']`; attribute sets with more than 128 entries stop early and report `MAX_ATTR_COUNT_REACHED` in `dropped`. The original data is lost, but the loss is visible.

## Edge cases

- `NaN`, `Infinity`, and `-Infinity` are dropped (OTel forbids non-finite numbers).
- Arrays must be homogeneous. A mixed-type array like `[1, 'two']` is dropped entirely.
- Empty arrays are dropped; OTel attributes with zero elements carry no information.
- `bigint` values are clamped to ±1_000_000_000 to avoid collector overflow.
- Symbol keys are skipped silently (they cannot survive JSON serialisation in collectors).
- Object values (including `{}` inside an array) are dropped.

Run the tests with `node --test`.
