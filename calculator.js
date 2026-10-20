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
  const KM_PER_MILE = 1.609344, LITERS_PER_GALLON = 3.785411784;
  const ECONOMY_FACTOR = 100 * LITERS_PER_GALLON / KM_PER_MILE;
  function displayRow(row, metric = false) {
    return metric ? { ...row, speed: round(row.speed * KM_PER_MILE, 1), mpg: ECONOMY_FACTOR / row.mpg, gallons: row.gallons * LITERS_PER_GALLON } : row;
  }
  function toCsv(rows, metric = false) {
    const header = [metric ? 'Speed (km/h)' : 'Speed (mph)', metric ? 'Est L/100 km' : 'Est MPG', 'Time (hrs:min)', 'Time (min)', 'Fuel Cost ($)', metric ? 'Liters' : 'US Gallons', 'Cost Savings vs Baseline ($)', 'Extra Time vs Baseline (min)', 'Implied Value of Time ($/hr)'];
    const lines = rows.map(original => { const row = displayRow(original, metric); return [row.speed, row.mpg.toFixed(1), row.duration, row.minutes.toFixed(1), row.cost.toFixed(2), row.gallons.toFixed(2), row.savings.toFixed(2), row.extraMinutes.toFixed(1), row.hourlyValue.toFixed(2)].join(','); });
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
  }
  function compareEv({ distance, gasCost, driveMinutes, milesPerKwh, batteryKwh, startSoc, arrivalSoc, electricityPrice, chargeKw }) {
    const values = [distance, gasCost, driveMinutes, milesPerKwh, batteryKwh, startSoc, arrivalSoc, electricityPrice, chargeKw];
    if (values.some(value => !Number.isFinite(value)) || distance <= 0 || gasCost < 0 || driveMinutes < 0 || milesPerKwh <= 0 || batteryKwh <= 0 || startSoc < 0 || startSoc > 100 || arrivalSoc < 0 || arrivalSoc >= startSoc || electricityPrice < 0 || chargeKw <= 0) throw new RangeError('Enter valid EV values. Start charge must exceed arrival reserve.');
    const tripKwh = distance / milesPerKwh;
    const chargeKwh = Math.max(0, tripKwh - batteryKwh * (startSoc - arrivalSoc) / 100);
    const chargingMinutes = chargeKwh / chargeKw * 60;
    const evCost = tripKwh * electricityPrice;
    return { tripKwh, chargeKwh, chargingMinutes, evCost, savings: gasCost - evCost, totalMinutes: driveMinutes + chargingMinutes, savingsPerHour: chargingMinutes > 0 ? (gasCost - evCost) / (chargingMinutes / 60) : null };
  }
  function calculateEvSpeeds({ distance, milesPerKwh, electricityPrice, baseline }) {
    if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(milesPerKwh) || milesPerKwh <= 0 || !Number.isFinite(electricityPrice) || electricityPrice < 0 || !SPEEDS.includes(baseline)) throw new RangeError('Enter valid EV efficiency, electricity price, trip distance, and baseline speed.');
    // Illustrative road-load model: 70% speed-independent, 30% aerodynamic at 65 mph.
    const row = speed => {
      const rate = (0.7 + 0.3 * (speed / 65) ** 2) / milesPerKwh;
      const kwh = distance * rate;
      return { speed, efficiency: 1 / rate, kwh, cost: kwh * electricityPrice, minutes: distance / speed * 60 };
    };
    const base = row(baseline);
    return SPEEDS.map(speed => { const value = row(speed); const extraMinutes = value.minutes - base.minutes; const savings = base.cost - value.cost; return { ...value, extraMinutes, savings, hourlyValue: extraMinutes > 0 ? savings / (extraMinutes / 60) : null }; });
  }
  const api = Object.freeze({ SPEEDS, DEFAULTS, calculate, toCsv, displayRow, compareEv, calculateEvSpeeds, KM_PER_MILE, LITERS_PER_GALLON, ECONOMY_FACTOR });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FuelCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
