# IEEE 754 Float Parser

A small, zero-dependency TypeScript-free ESM library for serializing and parsing the binary representation of IEEE 754 single and double precision floats. It works with raw bit fields (sign, biased exponent, mantissa) and classifies values (finite, zero, subnormal, infinite, NaN), preserving NaN payloads.

## Usage

```js
import { serialize, parse } from './src/index.js';

// 1.0 as single precision: sign 0, biased exponent 127, mantissa 0
const bytes = serialize(0, 127, 0n, 'single');
// => [0x3f, 0x80, 0x00, 0x00]

const d = parse(bytes, 'single');
// => { sign: 0, exponent: 127, mantissa: 0n, precision: 'single', kind: 'finite' }

// NaN payloads are preserved end to end
const nanBytes = serialize(0, 255, 0x400000n, 'single');
const parsed = parse(nanBytes, 'single');
// => { sign: 0, exponent: 255, mantissa: 4194304n, precision: 'single', kind: 'nan' }
```

## Why this exists

The library exists to inspect and construct IEEE 754 floats at the bit level without dragging in a buffer manipulation framework. The deliberate trade-off is that it does **not** convert to or from JavaScript `Number` values. JS `number` is already IEEE 754 double; the point of this library is field-level control over the binary layout, including NaN payloads and signed zero, which `Number` exposes only indirectly.

## Edge cases

The output is always **big-endian**, regardless of host architecture. If your data is little-endian, reverse the byte array before calling `parse` and after calling `serialize`.

`mantissa` is a `bigint` because single precision has a 23-bit field and double precision has a 52-bit field; the latter exceeds the safe integer range of a signed 32-bit context and using `bigint` everywhere keeps the API uniform across precisions.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

