const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, SPEEDS, toCsv } = require('../calculator.js');

// Independent reference output from the user's Python calculation.
const expected = [
  [45,29.4,'6h 40m',400,35.71,10.2,16.61,142.9,6.97],
  [50,29.4,'6h 00m',360,35.71,10.2,16.61,102.9,9.69],
  [55,31.4,'5h 27m',327.3,33.48,9.57,18.84,70.2,16.1],
  [60,28.2,'5h 00m',300,37.2,10.63,15.12,42.9,21.15],
  [65,24.5,'4h 36m',276.9,42.93,12.26,9.39,19.8,28.45],
  [70,20.1,'4h 17m',257.1,52.32,14.95,0,0,0],
  [75,15.1,'4h 00m',240,69.75,19.93,-17.43,-17.1,0],
  [80,10,'3h 45m',225,105,30,-52.68,-32.1,0]
];
test('default results match independent Python output for all metrics', () => {
  assert.deepEqual(calculate().map(row => Object.values(row)), expected);
});
test('every supported baseline is zero and time differences have the right sign', () => {
  for (const baseline of SPEEDS) {
    const rows = calculate({ baseline });
    const base = rows.find(row => row.speed === baseline);
    assert.equal(base.savings, 0);
    assert.equal(base.extraMinutes, 0);
    assert.equal(base.hourlyValue, 0);
    for (const row of rows) {
      assert.equal(Math.sign(row.extraMinutes), Math.sign(baseline - row.speed));
      if (row.speed >= baseline) assert.equal(row.hourlyValue, 0);
    }
  }
});
test('MPG floor controls actual fuel consumption', () => {
  for (const row of calculate({ baseMpg: 1 })) {
    assert.equal(row.mpg, 10);
    assert.equal(row.gallons, 30);
    assert.equal(row.cost, 105);
    assert.equal(row.savings, 0);
  }
});
test('zero fuel price is valid and produces finite zero costs and savings', () => {
  for (const row of calculate({ fuelPrice: 0 })) {
    assert.equal(row.cost, 0);
    assert.equal(row.savings, 0);
    assert.equal(row.hourlyValue, 0);
  }
});
test('invalid and nonfinite inputs fail rather than producing misleading values', () => {
  for (const inputs of [{ distance: 0 }, { distance: NaN }, { distance: Infinity }, { distance: 100001 }, { baseMpg: -1 }, { baseMpg: 201 }, { fuelPrice: -1 }, { fuelPrice: NaN }, { fuelPrice: 101 }, { baseline: 71 }]) {
    assert.throws(() => calculate(inputs), RangeError);
  }
});
test('small and large valid trips stay finite', () => {
  for (const distance of [1, 1.25, 100000]) {
    for (const row of calculate({ distance })) {
      for (const value of Object.values(row)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
    }
  }
});
test('CSV contains every metric, negative deltas, and Python-style hourly zeros', () => {
  const lines = toCsv(calculate()).trim().split('\r\n');
  assert.equal(lines.length, 9);
  assert.equal(lines[0].split(',').length, 9);
  assert.equal(lines[5], '65,24.5,4h 36m,276.9,42.93,12.26,9.39,19.8,28.45');
  assert.equal(lines[8], '80,10.0,3h 45m,225.0,105.00,30.00,-52.68,-32.1,0.00');
});
