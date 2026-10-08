/* Pure calculation module: usable in the browser and in Node tests. */
(function (root) {
  'use strict';
  const SPEEDS = Object.freeze([45, 50, 55, 60, 65, 70, 75, 80]);
  const DEFAULTS = Object.freeze({ distance: 300, baseMpg: 28, baseline: 70, fuelPrice: 3.5 });
  // Round ties to even, as in Python's round(), within floating point tolerance.
  function round(value, digits) {
    const scale = 10 ** digits;
    const scaled = Math.abs(value) * scale;
    const floor = Math.floor(scaled);
    const fraction = scaled - floor;
    const tolerance = Number.EPSILON * Math.max(1, scaled) * 2;
    const rounded = Math.abs(fraction - 0.5) <= tolerance
      ? floor + (floor % 2)
      : Math.round(scaled);
    return (Math.sign(value) * rounded / scale) || 0;
  }
  function validate({ distance, baseMpg, baseline, fuelPrice }) {
    if (!Number.isFinite(distance) || distance < 1 || distance > 100000) throw new RangeError('Enter a trip distance between 1 and 100,000 miles.');
    if (!Number.isFinite(baseMpg) || baseMpg < 1 || baseMpg > 200) throw new RangeError('Enter base fuel economy between 1 and 200 MPG.');
    if (!Number.isFinite(fuelPrice) || fuelPrice < 0 || fuelPrice > 100) throw new RangeError('Enter a fuel price between $0 and $100 per gallon.');
    if (!SPEEDS.includes(baseline)) throw new RangeError('Choose a baseline speed from 45 to 80 mph in 5 mph increments.');
  }
  function calculate(options = {}) {
    const inputs = { ...DEFAULTS, ...options };
    validate(inputs);
    const { distance, baseMpg, baseline, fuelPrice } = inputs;
    const rows = SPEEDS.map(speed => {
      const diff = speed - 55;
      const factor = speed <= 50 ? 1.05 : speed <= 55 ? 1.12 : 1.12 * (1 - diff * 0.018 - diff ** 2 * 0.0004);
      const mpg = Math.max(baseMpg * factor, 10);
      const hours = distance / speed;
      const gallons = distance / mpg;
      return {
        speed,
        mpg: round(mpg, 1),
        duration: `${Math.trunc(hours)}h ${String(Math.trunc((hours % 1) * 60)).padStart(2, '0')}m`,
        minutes: round(hours * 60, 1),
        cost: round(gallons * fuelPrice, 2),
        gallons: round(gallons, 2)
      };
    });
    const base = rows.find(row => row.speed === baseline);
    return rows.map(row => ({
      ...row,
      savings: round(base.cost - row.cost, 2),
      extraMinutes: round(row.minutes - base.minutes, 1),
      hourlyValue: row.minutes > base.minutes
        ? round((base.cost - row.cost) / ((row.minutes - base.minutes) / 60), 2)
        : 0
    }));
  }
  function toCsv(rows) {
    const header = ['Speed (mph)', 'Est MPG', 'Time (hrs:min)', 'Time (min)', 'Fuel Cost ($)', 'Gallons', 'Cost Savings vs Baseline ($)', 'Extra Time vs Baseline (min)', 'Implied Value of Time ($/hr)'];
    const lines = rows.map(row => [row.speed, row.mpg.toFixed(1), row.duration, row.minutes.toFixed(1), row.cost.toFixed(2), row.gallons.toFixed(2), row.savings.toFixed(2), row.extraMinutes.toFixed(1), row.hourlyValue.toFixed(2)].join(','));
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
  }
  const api = Object.freeze({ SPEEDS, DEFAULTS, calculate, toCsv });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FuelCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
