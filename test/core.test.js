import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { serialize, parse, packRaw } from '../src/core.js';

// \x3f800000 is 0x3f800000, written this way to keep tooling that strips non-ASCII happy.
const BYTES_1_0_SINGLE = [0x3f, 0x80, 0x00, 0x00]; // 1.0
const BYTES_M1_0_SINGLE = [0xbf, 0x80, 0x00, 0x00]; // -1.0
const BYTES_0_0_SINGLE = [0x00, 0x00, 0x00, 0x00]; // +0.0
const BYTES_N0_0_SINGLE = [0x80, 0x00, 0x00, 0x00]; // -0.0
const BYTES_INF_SINGLE = [0x7f, 0x80, 0x00, 0x00]; // +Infinity
const BYTES_NINF_SINGLE = [0xff, 0x80, 0x00, 0x00]; // -Infinity
const BYTES_QNAN_SINGLE = [0x7f, 0xc0, 0x00, 0x00]; // qNaN
const BYTES_SNAN_SINGLE = [0x7f, 0x80, 0x00, 0x01]; // sNaN
const BYTES_SUBNORM_SINGLE = [0x00, 0x7f, 0xff, 0xff]; // largest subnormal

const BYTES_1_0_DOUBLE = [0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // 1.0
const BYTES_INF_DOUBLE = [0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // +Infinity


test('serialize: 1.0 single', () => {
  assert.deepEqual(serialize(0, 127, 0n, 'single'), BYTES_1_0_SINGLE);
});

test('parse: 1.0 single round trips through serialize', () => {
  const d = parse(BYTES_1_0_SINGLE, 'single');
  assert.equal(d.sign, 0);
  assert.equal(d.exponent, 127);
  assert.equal(d.mantissa, 0n);
  assert.equal(d.kind, 'finite');
  assert.deepEqual(serialize(d.sign, d.exponent, d.mantissa, 'single'), BYTES_1_0_SINGLE);
});

test('parse: -1.0 single', () => {
  const d = parse(BYTES_M1_0_SINGLE, 'single');
  assert.equal(d.sign, 1);
  assert.equal(d.exponent, 127);
  assert.equal(d.mantissa, 0n);
  assert.equal(d.kind, 'finite');
});

test('parse: +0.0 single', () => {
  const d = parse(BYTES_0_0_SINGLE, 'single');
  assert.equal(d.sign, 0);
  assert.equal(d.exponent, 0);
  assert.equal(d.mantissa, 0n);
  assert.equal(d.kind, 'zero');
});

test('parse: -0.0 single', () => {
  const d = parse(BYTES_N0_0_SINGLE, 'single');
  assert.equal(d.sign, 1);
  assert.equal(d.exponent, 0);
  assert.equal(d.mantissa, 0n);
  assert.equal(d.kind, 'zero');
});

test('parse: +Infinity single', () => {
  const d = parse(BYTES_INF_SINGLE, 'single');
  assert.equal(d.kind, 'infinite');
  assert.equal(d.exponent, 255);
  assert.equal(d.mantissa, 0n);
});

test('parse: -Infinity single', () => {
  const d = parse(BYTES_NINF_SINGLE, 'single');
  assert.equal(d.sign, 1);
  assert.equal(d.kind, 'infinite');
});

test('parse: quiet NaN single', () => {
  const d = parse(BYTES_QNAN_SINGLE, 'single');
  assert.equal(d.kind, 'nan');
  assert.equal(d.exponent, 255);
  assert.equal(d.mantissa, 0x400000n);
});

test('parse: signalling NaN single', () => {
  const d = parse(BYTES_SNAN_SINGLE, 'single');
  assert.equal(d.kind, 'nan');
  assert.equal(d.mantissa, 1n);
});

test('parse: largest subnormal single', () => {
  const d = parse(BYTES_SUBNORM_SINGLE, 'single');
  assert.equal(d.exponent, 0);
  assert.equal(d.mantissa, 0x7fffffn);
  assert.equal(d.kind, 'subnormal');
});

test('parse: double precision 1.0', () => {
  const d = parse(BYTES_1_0_DOUBLE, 'double');
  assert.equal(d.sign, 0);
  assert.equal(d.exponent, 1023);
  assert.equal(d.mantissa, 0n);
  assert.equal(d.kind, 'finite');
});

test('parse: double precision Infinity', () => {
  const d = parse(BYTES_INF_DOUBLE, 'double');
  assert.equal(d.kind, 'infinite');
  assert.equal(d.exponent, 2047);
});

test('serialize + parse round trip preserves NaN payload', () => {
  const nanBytes = serialize(0, 255, 0x400000n, 'single');
  const d = parse(nanBytes, 'single');
  assert.equal(d.kind, 'nan');
  assert.equal(d.mantissa, 0x400000n);
});

test('packRaw: constructs the expected integer for 1.0 single', () => {
  // 0x3f800000 as a bigint literal.
  assert.equal(packRaw(0, 127, 0n, 'single'), 0x3f800000n);
});

test('parse: Uint8Array input works the same as Array', () => {
  const arr = new Uint8Array(BYTES_1_0_SINGLE);
  const d = parse(arr, 'single');
  assert.equal(d.exponent, 127);
  assert.equal(d.mantissa, 0n);
});

test('parse: wrong byte count throws RangeError', () => {
  assert.throws(
    () => parse([0x00, 0x00], 'single'),
    { name: 'RangeError' },
  );
});

test('parse: invalid precision throws TypeError', () => {
  assert.throws(
    () => parse(BYTES_1_0_SINGLE, 'half'),
    { name: 'TypeError' },
  );
});

test('serialize: exponent out of range throws RangeError', () => {
  assert.throws(
    () => serialize(0, 256, 0n, 'single'),
    { name: 'RangeError' },
  );
});

test('serialize: mantissa out of range throws RangeError', () => {
  assert.throws(
    () => serialize(0, 127, 1n << 23n, 'single'),
    { name: 'RangeError' },
  );
});
