'use strict';
(() => {
  const { SPEEDS, calculate, toCsv, displayRow, compareEv, calculateEvSpeeds, KM_PER_MILE, LITERS_PER_GALLON, ECONOMY_FACTOR } = window.FuelCalculator;
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
  let metric = false;
  const speedValue = speed => number(metric ? speed * KM_PER_MILE : speed);
  const speedUnit = () => metric ? 'km/h' : 'mph';
  const economy = row => `${displayRow(row, metric).mpg.toFixed(1)} ${metric ? 'L/100 km' : 'MPG'}`;
  let selectedSpeed = 65;
  let rows = [];
  let baselineSpeed = 70;
  let valid = false;
  let selectedEvSpeed = 65;
  let activeTab = 'speed';
  const evEfficiency = () => metric ? 100 * KM_PER_MILE / $('ev-efficiency').valueAsNumber : $('ev-efficiency').valueAsNumber;
  const evInputGroup = document.querySelector('.ev-inputs');
  const evSpeedButtons = SPEEDS.map(speed => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'speed-button';
    button.addEventListener('click', () => { selectedEvSpeed = speed; renderEvSpeeds(); });
    $('ev-speed-buttons').append(button);
    return button;
  });
  function renderEvSpeeds() {
    if (!valid) return;
    try {
      const distance = $('distance').valueAsNumber / (metric ? KM_PER_MILE : 1);
      const evRows = calculateEvSpeeds({ distance, milesPerKwh: evEfficiency(), electricityPrice: $('ev-price').valueAsNumber, baseline: baselineSpeed });
      const selected = evRows.find(row => row.speed === selectedEvSpeed);
      const extra = selected.extraMinutes;
      $('ev-selected-speed').textContent = speedValue(selectedEvSpeed);
      $('ev-speed-tag').textContent = selectedEvSpeed === baselineSpeed ? 'Your baseline' : `${speedValue(Math.abs(selectedEvSpeed - baselineSpeed))} ${speedUnit()} ${selectedEvSpeed < baselineSpeed ? 'slower' : 'faster'}`;
      $('ev-speed-savings').textContent = money(selected.savings);
      $('ev-speed-savings').className = selected.savings < 0 ? 'negative' : 'positive';
      $('ev-speed-cost').textContent = `${money(selected.cost)} total energy cost`;
      $('ev-speed-time').textContent = `${extra > 0 ? '+' : ''}${number(extra)} min`;
      $('ev-speed-duration').textContent = `${number(selected.minutes / 60)} hours driving`;
      $('ev-speed-hourly').textContent = selected.hourlyValue === null ? '—' : `${money(selected.hourlyValue)}/hr`;
      $('ev-speed-efficiency').textContent = metric ? `${number(100 * KM_PER_MILE / selected.efficiency)} kWh/100 km` : `${number(selected.efficiency)} mi/kWh`;
      evSpeedButtons.forEach((button, index) => { button.textContent = speedValue(SPEEDS[index]); button.setAttribute('aria-label', `Compare ${speedValue(SPEEDS[index])} ${speedUnit()}`); button.setAttribute('aria-pressed', String(SPEEDS[index] === selectedEvSpeed)); });
      $('ev-speed-results').innerHTML = evRows.map(row => `<tr class="${row.speed === selectedEvSpeed ? 'selected' : ''}"><td>${speedValue(row.speed)} ${speedUnit()}</td><td>${metric ? `${number(100 * KM_PER_MILE / row.efficiency)} kWh/100 km` : `${number(row.efficiency)} mi/kWh`}</td><td>${number(row.kwh)} kWh</td><td>${number(row.minutes)} min</td><td>${money(row.cost)}</td><td class="${row.savings < 0 ? 'negative' : 'positive'}">${money(row.savings)}</td><td>${row.extraMinutes > 0 ? '+' : ''}${number(row.extraMinutes)} min</td><td>${row.hourlyValue === null ? '—' : money(row.hourlyValue)}</td></tr>`).join('');
      $('ev-speed-error').hidden = true;
      if (activeTab === 'ev-speed') {
        const base = evRows.find(row => row.speed === baselineSpeed);
        $('baseline-cost').textContent = money(base.cost);
        $('baseline-time').textContent = `${number(base.minutes / 60)} hours driving`;
        $('baseline-detail').textContent = `${speedValue(baselineSpeed)} ${speedUnit()} / ${number(base.kwh)} kWh / electricity cost`;
      }
    } catch (error) {
      $('ev-speed-error').textContent = error.message; $('ev-speed-error').hidden = false; $('ev-speed-results').replaceChildren();
      if (activeTab === 'ev-speed') { $('baseline-cost').textContent = '—'; $('baseline-time').textContent = '—'; $('baseline-detail').textContent = 'Enter valid EV efficiency and electricity price.'; }
    }
  }
  function renderEv() {
    if (!valid) return;
    try {
      const gas = rows.find(row => row.speed === baselineSpeed);
      const options = { distance: $('distance').valueAsNumber / (metric ? KM_PER_MILE : 1), gasCost: gas.cost, driveMinutes: gas.minutes, milesPerKwh: evEfficiency(), batteryKwh: $('ev-battery').valueAsNumber, startSoc: $('ev-start').valueAsNumber, arrivalSoc: $('ev-reserve').valueAsNumber, electricityPrice: $('ev-price').valueAsNumber };
      const results = [['Level 2', $('ev-l2').valueAsNumber], ['Level 3', $('ev-l3').valueAsNumber]].map(([label, chargeKw]) => ({ label, ...compareEv({ ...options, chargeKw }) }));
      const duration = minutes => { const rounded = Math.round(minutes); return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, '0')}m`; };
      $('ev-results').innerHTML = `<tr><td>Gas car</td><td>${money(gas.cost)}</td><td>0 min</td><td>${duration(gas.minutes)}</td><td>—</td><td>—</td></tr>` + results.map(row => `<tr><td>EV · ${row.label}</td><td>${money(row.evCost)}</td><td>${number(row.chargingMinutes)} min</td><td>${duration(row.totalMinutes)}</td><td class="${row.savings >= 0 ? 'positive' : 'negative'}">${money(row.savings)}</td><td>${row.savingsPerHour === null ? '—' : `${money(row.savingsPerHour)}/hr`}</td></tr>`).join('');
      $('ev-detail').textContent = `EV uses ${number(results[0].tripKwh)} kWh for the trip; ${number(results[0].chargeKwh)} kWh must be added en route. Energy cost includes the full trip energy, including energy in the starting battery. Charging time is energy added ÷ average charging power; driving time is the same for both cars. Stops, detours, charging losses, variable prices, and charging taper are not included.`;
      $('ev-error').hidden = true;
    } catch (error) { $('ev-error').textContent = error.message; $('ev-error').hidden = false; $('ev-results').replaceChildren(); $('ev-detail').textContent = ''; }
  }
  function selectTab(tab) {
    activeTab = tab;
    for (const name of ['speed', 'ev', 'ev-speed']) {
      const active = name === tab;
      $(`${name}-tab`).setAttribute('aria-selected', String(active));
      $(`${name}-tab`).tabIndex = active ? 0 : -1;
      $(`${name}-panel`).hidden = !active;
    }
    $('speed-table').hidden = tab !== 'speed';
    const electric = tab === 'ev-speed';
    $('gas-vehicle-picker').hidden = electric;
    $('ev-sidebar').hidden = !electric;
    for (const id of ['mpg', 'price']) {
      document.querySelector(`label[for="${id}"]`).hidden = electric;
      $(id).closest('.input-wrap').hidden = electric;
      $(id).disabled = electric;
    }
    $('mpg-help').hidden = electric;
    $('gas-model-notes').hidden = electric;
    if (electric) {
      $('ev-sidebar-inputs').append($('ev-efficiency-field'), $('ev-price-field'));
    } else {
      evInputGroup.prepend($('ev-efficiency-field'));
      evInputGroup.insertBefore($('ev-price-field'), $('ev-l2').closest('label'));
    }
    if (tab === 'ev') $('ev-panel').insertBefore(evInputGroup, $('ev-error'));
    unitLabels(); update();
  }
  for (const name of ['speed', 'ev', 'ev-speed']) $(`${name}-tab`).addEventListener('click', () => selectTab(name));
  document.querySelector('.tabs').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const names = ['speed', 'ev', 'ev-speed']; const current = names.findIndex(name => $(`${name}-tab`).getAttribute('aria-selected') === 'true'); const next = names[(current + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; selectTab(next); $(`${next}-tab`).focus(); });
  evInputGroup.querySelectorAll('input').forEach(input => input.addEventListener('input', () => { renderEv(); renderEvSpeeds(); }));
  const speedButtons = SPEEDS.map(speed => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'speed-button';
    button.textContent = speed;
    button.setAttribute('aria-label', `Compare ${speed} miles per hour`);
    button.addEventListener('click', () => { selectedSpeed = speed; render(); });
    $('speed-buttons').append(button);
    return button;
  });
  function drawChart() {
    const width = 680, height = 210;
    const left = 54, right = 24, top = 26, bottom = 36;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const minCost = Math.min(...rows.map(row => row.cost));
    const maxCost = Math.max(...rows.map(row => row.cost));
    const span = Math.max(maxCost - minCost, 1);
    const low = Math.max(0, minCost - span * 0.2), high = maxCost + span * 0.25;
    const x = speed => left + (speed - 45) / 35 * plotWidth;
    const y = cost => top + (high - cost) / (high - low) * plotHeight;
    const points = rows.map(row => `${x(row.speed)},${y(row.cost)}`).join(' ');
    const grid = Array.from({ length: 4 }, (_, index) => {
      const cost = low + (high - low) * index / 3;
      const ordinate = y(cost);
      const label = cost < 100 ? money(cost) : `$${number(cost)}`;
      return `<line x1="${left}" y1="${ordinate}" x2="${width - right}" y2="${ordinate}" stroke="#e5e7dd" stroke-dasharray="3 5"/><text x="${left - 9}" y="${ordinate + 4}" text-anchor="end">${label}</text>`;
    }).join('');
    const ticks = rows.map(row => `<text x="${x(row.speed)}" y="${height - 14}" text-anchor="middle">${speedValue(row.speed)}</text>`).join('');
    const dots = rows.map(row => `<circle cx="${x(row.speed)}" cy="${y(row.cost)}" r="${row.speed === selectedSpeed ? 6 : 3.5}" fill="${row.speed === selectedSpeed ? '#204d3c' : '#fffefa'}" stroke="#204d3c" stroke-width="2"/>`).join('');
    const selected = rows.find(row => row.speed === selectedSpeed);
    const anchor = selectedSpeed === 80 ? 'end' : selectedSpeed === 45 ? 'start' : 'middle';
    $('chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">Fuel cost by driving speed</title><desc id="chart-desc">At ${speedValue(selectedSpeed)} ${speedUnit()}, estimated fuel cost is ${money(selected.cost)}. Full values are available in the comparison table.</desc><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a6be77" stop-opacity=".3"/><stop offset="100%" stop-color="#a6be77" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${left},${height-bottom} ${points} ${width-right},${height-bottom}" fill="url(#area)"/><line x1="${x(baselineSpeed)}" x2="${x(baselineSpeed)}" y1="${top}" y2="${height-bottom}" stroke="#aeb8a8" stroke-dasharray="4 4"/><polyline points="${points}" fill="none" stroke="#204d3c" stroke-width="2.5" stroke-linejoin="round"/>${dots}<text class="point-label" x="${x(selectedSpeed)}" y="${y(selected.cost)-13}" text-anchor="${anchor}">${money(selected.cost)}</text>${ticks}</svg>`;
  }
  function render() {
    if (!valid) return;
    const selected = rows.find(row => row.speed === selectedSpeed);
    const baseline = rows.find(row => row.speed === baselineSpeed);
    $('selected-speed').textContent = speedValue(selectedSpeed);
    const diff = selectedSpeed - baselineSpeed;
    $('speed-tag').textContent = diff === 0 ? 'Your baseline' : `${speedValue(Math.abs(diff))} ${speedUnit()} ${diff < 0 ? 'slower' : 'faster'}`;
    speedButtons.forEach((button, index) => { button.textContent = speedValue(SPEEDS[index]); button.setAttribute('aria-label', `Compare ${speedValue(SPEEDS[index])} ${speedUnit()}`); button.setAttribute('aria-pressed', String(SPEEDS[index] === selectedSpeed)); });
    $('baseline-cost').textContent = money(baseline.cost);
    $('baseline-time').textContent = baseline.duration;
    $('baseline-detail').textContent = `${speedValue(baselineSpeed)} ${speedUnit()} ? ${economy(baseline)} ? ${displayRow(baseline, metric).gallons.toFixed(2)} ${metric ? 'liters' : 'US gallons'}`;
    $('cost-label').textContent = selected.savings < 0 ? 'Extra fuel cost' : 'Fuel savings';
    $('cost-delta').textContent = money(Math.abs(selected.savings));
    $('cost-delta').className = selected.savings < 0 ? 'negative' : 'positive';
    $('selected-cost').textContent = `${money(selected.cost)} total fuel cost`;
    $('time-label').textContent = selected.extraMinutes < 0 ? 'Time saved' : 'Extra travel time';
    $('time-delta').textContent = `${number(Math.abs(selected.extraMinutes))} min`;
    $('selected-time').textContent = `${selected.duration} total trip time`;
    const faster = selected.extraMinutes < 0;
    const slower = selected.extraMinutes > 0;
    const hourly = faster ? -selected.savings / (-selected.extraMinutes / 60) : selected.hourlyValue;
    $('value-label').textContent = faster ? 'Cost per hour saved' : 'Savings per extra hour';
    $('time-value').textContent = slower || faster ? `${money(hourly)}/hr` : '—';
    $('selected-mpg').textContent = `${economy(selected)} estimated`;
    $('insight').textContent = slower
      ? `At ${speedValue(selectedSpeed)} ${speedUnit()}, you ${selected.savings >= 0 ? 'save' : 'spend an extra'} ${money(Math.abs(selected.savings))} and add ${number(selected.extraMinutes)} minutes versus ${speedValue(baselineSpeed)} ${speedUnit()}. That's ${money(selected.hourlyValue)} in fuel savings per extra hour on the road.`
      : faster
      ? `At ${speedValue(selectedSpeed)} ${speedUnit()}, you save ${number(-selected.extraMinutes)} minutes and ${selected.savings <= 0 ? 'spend an extra' : 'save'} ${money(Math.abs(selected.savings))} versus ${speedValue(baselineSpeed)} ${speedUnit()}. ${hourly >= 0 ? 'Those minutes cost' : 'Fuel savings are'} ${money(Math.abs(hourly))} per hour saved.`
      : `This is your baseline: ${money(selected.cost)} in fuel for a ${selected.duration} trip. Select another speed to compare the difference.`;
    $('table-baseline').textContent = speedValue(baselineSpeed);
    $('results-table').innerHTML = rows.map(row => `<tr class="${row.speed === selectedSpeed ? 'selected' : ''}"><td><button class="row-speed" type="button" data-speed="${row.speed}" aria-label="Compare ${speedValue(row.speed)} ${speedUnit()}" aria-pressed="${row.speed === selectedSpeed}">${speedValue(row.speed)} ${speedUnit()}</button>${row.speed === baselineSpeed ? '<span class="row-tag">BASE</span>' : ''}</td><td>${displayRow(row, metric).mpg.toFixed(1)}</td><td>${row.duration}</td><td>${money(row.cost)}</td><td>${displayRow(row, metric).gallons.toFixed(2)}</td><td class="${row.savings < 0 ? 'negative' : row.savings > 0 ? 'positive' : ''}">${money(row.savings)}</td><td>${row.extraMinutes > 0 ? '+' : ''}${row.extraMinutes.toFixed(1)} min</td><td>${row.extraMinutes > 0 ? money(row.hourlyValue) : '—'}</td></tr>`).join('');
    drawChart();
    renderEv();
    renderEvSpeeds();
  }
  function update() {
    try {
      baselineSpeed = Number($('baseline').value);
      rows = calculate({ distance: $('distance').valueAsNumber / (metric ? KM_PER_MILE : 1), baseMpg: activeTab === 'ev-speed' ? 28 : metric ? ECONOMY_FACTOR / $('mpg').valueAsNumber : $('mpg').valueAsNumber, fuelPrice: activeTab === 'ev-speed' ? 3.5 : $('price').valueAsNumber * (metric ? LITERS_PER_GALLON : 1), baseline: baselineSpeed });
      valid = true;
      $('input-error').hidden = true;
      $('export').disabled = false;
      speedButtons.forEach(button => { button.disabled = false; });
      $('results-table').querySelectorAll('button').forEach(button => { button.disabled = false; });
      document.querySelectorAll('.results-area, .table-card').forEach(element => { element.style.opacity = '1'; });
      render();
    } catch (error) {
      valid = false;
      $('ev-error').textContent = 'Correct the trip inputs to update this comparison.';
      $('ev-error').hidden = false;
      $('ev-results').replaceChildren();
      $('ev-speed-error').textContent = 'Correct the trip inputs to update this comparison.';
      $('ev-speed-error').hidden = false;
      $('ev-speed-results').replaceChildren();
      $('input-error').textContent = activeTab === 'ev-speed' ? `Enter a trip distance between ${number(metric ? KM_PER_MILE : 1)} and ${number(100000 * (metric ? KM_PER_MILE : 1))} ${metric ? 'km' : 'miles'}.` : `${metric ? 'Enter valid values within the distance, L/100 km, and price-per-liter limits.' : error.message} Results below show the last valid inputs.`;
      $('input-error').hidden = false;
      $('export').disabled = true;
      speedButtons.forEach(button => { button.disabled = true; });
      $('results-table').querySelectorAll('button').forEach(button => { button.disabled = true; });
      document.querySelectorAll('.results-area, .table-card').forEach(element => { element.style.opacity = '.5'; });
    }
  }
  $('trip-form').addEventListener('input', event => { if (event.target.id !== 'units' && !event.target.id.includes('vehicle-')) update(); });
  $('trip-form').addEventListener('submit', event => event.preventDefault());
  $('trip-form').addEventListener('reset', () => { selectedSpeed = 65; selectedEvSpeed = 65; metric = false; resetVehicle(); setTimeout(() => { $('ev-efficiency').value = 3.5; $('ev-price').value = 0.2; resetEvVehicle(); unitLabels(); update(); }, 0); });
  $('results-table').addEventListener('click', event => {
    const button = event.target.closest('button[data-speed]');
    if (!button || !valid) return;
    selectedSpeed = Number(button.dataset.speed);
    render();
    $('results-table').querySelector(`button[data-speed="${selectedSpeed}"]`).focus();
  });
  $('export').addEventListener('click', () => {
    if (!valid) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows, metric)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fuel-time-comparison-${speedValue(baselineSpeed)}${metric ? 'kmh' : 'mph'}-baseline.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const vehicleFields = ['year', 'make', 'model', 'options'];
  const evVehicles = window.EvVehicles?.vehicles || [];
  function evCandidates(index) {
    return evVehicles.filter(vehicle => vehicleFields.slice(0, Math.min(index, 3)).every(field => String(vehicle[field]) === $(`ev-vehicle-${field}`).value));
  }
  function evMenu(index) {
    const select = $(`ev-vehicle-${vehicleFields[index]}`);
    select.replaceChildren(new Option(`Choose ${index === 3 ? 'configuration' : vehicleFields[index]}`, ''));
    const candidates = evCandidates(index);
    if (index === 3) {
      candidates.forEach(vehicle => select.add(new Option(`${vehicle.configuration || 'Electric drive'} (EPA ${vehicle.id})`, vehicle.id)));
    } else {
      const values = [...new Set(candidates.map(vehicle => String(vehicle[vehicleFields[index]])))];
      values.sort(index === 0 ? (a, b) => Number(b) - Number(a) : (a, b) => a.localeCompare(b));
      values.forEach(value => select.add(new Option(value, value)));
    }
    select.disabled = select.options.length === 1;
  }
  function resetEvVehicle() {
    evMenu(0);
    vehicleFields.slice(1).forEach(field => {
      const select = $(`ev-vehicle-${field}`);
      select.replaceChildren(new Option(`Choose ${field === 'options' ? 'configuration' : field}`, ''));
      select.disabled = true;
    });
    $('ev-vehicle-status').textContent = evVehicles.length ? `Choose a battery electric vehicle. EPA catalog updated ${window.EvVehicles.updated}.` : 'EV catalog unavailable. Enter efficiency manually.';
  }
  vehicleFields.forEach((field, index) => {
    $(`ev-vehicle-${field}`).addEventListener('change', () => {
      vehicleFields.slice(index + 1).forEach(child => {
        const select = $(`ev-vehicle-${child}`);
        select.replaceChildren(new Option(`Choose ${child === 'options' ? 'configuration' : child}`, ''));
        select.disabled = true;
      });
      if (index < 3) {
        if ($(`ev-vehicle-${field}`).value) evMenu(index + 1);
        $('ev-vehicle-status').textContent = 'Choose your EV configuration to fill in efficiency.';
        return;
      }
      const vehicle = evVehicles.find(item => item.id === $('ev-vehicle-options').value);
      if (!vehicle) return;
      const consumption = vehicle.highwayKwhPer100Miles || vehicle.combinedKwhPer100Miles;
      if (!(consumption > 0)) { $('ev-vehicle-status').textContent = 'EPA efficiency is unavailable for this EV. Enter efficiency manually.'; return; }
      $('ev-efficiency').value = metric ? consumption / KM_PER_MILE : 100 / consumption;
      $('ev-vehicle-status').textContent = `Using EPA ${vehicle.highwayKwhPer100Miles > 0 ? 'highway' : 'combined'} ${number(consumption)} kWh/100 miles as an editable starting estimate. Adjust it for your driving at 65 mph (104.6 km/h).`;
      update();
    });
  });
  resetEvVehicle();
  let lookupController;
  let retryLookup = () => loadVehicle(0);
  function clearMenu(index) {
    const select = $(`vehicle-${vehicleFields[index]}`);
    select.replaceChildren(new Option(`Choose ${index === 3 ? 'configuration' : vehicleFields[index]}`, ''));
    select.disabled = true;
  }
  function resetVehicle() {
    lookupController?.abort();
    vehicleFields.slice(1).forEach((_, index) => clearMenu(index + 1));
    $('vehicle-status').textContent = 'Choose your vehicle to use its EPA combined MPG as an editable starting estimate.';
    $('vehicle-retry').hidden = true;
  }
  async function loadVehicle(index) {
    lookupController?.abort();
    const controller = new AbortController();
    lookupController = controller;
    const timer = setTimeout(() => controller.abort(new Error('Vehicle lookup timed out.')), 15000);
    retryLookup = () => loadVehicle(index);
    $('vehicle-retry').hidden = true;
    $('vehicle-status').textContent = 'Loading vehicle data?';
    try {
      const query = new URLSearchParams();
      for (let i = 0; i < Math.min(index, 3); i++) query.set(vehicleFields[i], $(`vehicle-${vehicleFields[i]}`).value);
      const endpoint = index === 4 ? `vehicle/${encodeURIComponent($('vehicle-options').value)}` : `vehicle/menu/${vehicleFields[index]}?${query}`;
      const response = await fetch(`https://www.fueleconomy.gov/ws/rest/${endpoint}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Vehicle service unavailable.');
      const data = await response.json();
      if (lookupController !== controller) return;
      if (index === 4) {
        const mpg = Number(data.comb08);
        if (!Number.isFinite(mpg) || mpg < 1 || mpg > 200 || /electricity|hydrogen|natural gas/i.test(data.fuelType1 || '')) {
          $('vehicle-status').textContent = 'This vehicle uses a fuel or energy unit this calculator does not support. Your manual fuel economy is unchanged.';
          return;
        }
        $('mpg').value = metric ? ECONOMY_FACTOR / mpg : mpg;
        $('vehicle-status').textContent = `Using EPA combined ${mpg} MPG (${data.fuelType1 || 'primary fuel'}) as your base estimate. You can edit it below.`;
        update();
      } else {
        const items = data.menuItem ? (Array.isArray(data.menuItem) ? data.menuItem : [data.menuItem]) : [];
        clearMenu(index);
        const select = $(`vehicle-${vehicleFields[index]}`);
        items.forEach(item => select.add(new Option(item.text, item.value)));
        select.disabled = items.length === 0;
        $('vehicle-status').textContent = items.length ? 'Choose your vehicle to fill in base fuel economy.' : 'No vehicles found. You can enter fuel economy manually.';
      }
    } catch (error) {
      if (lookupController !== controller || (controller.signal.aborted && !controller.signal.reason?.message?.includes('timed out'))) return;
      $('vehicle-status').textContent = 'Vehicle lookup unavailable. Retry or enter fuel economy manually.';
      $('vehicle-retry').hidden = false;
    } finally { clearTimeout(timer); }
  }
  vehicleFields.forEach((field, index) => {
    $(`vehicle-${field}`).addEventListener('change', () => {
      lookupController?.abort();
      vehicleFields.forEach((_, child) => { if (child > index) clearMenu(child); });
      if ($(`vehicle-${field}`).value) loadVehicle(index + 1);
      else { $('vehicle-status').textContent = 'Choose your vehicle to fill in base fuel economy.'; $('vehicle-retry').hidden = true; }
    });
  });
  $('vehicle-retry').addEventListener('click', () => retryLookup());
  document.querySelector('.vehicle-picker').addEventListener('toggle', event => {
    if (event.target.open && $('vehicle-year').options.length === 1) loadVehicle(0);
  });
  function unitLabels() {
    [...$('units').options].forEach(option => { option.textContent = activeTab === 'ev-speed' ? (option.value === 'metric' ? 'Kilometers / kWh' : 'Miles / kWh') : (option.value === 'metric' ? 'Kilometers / liters' : 'Miles / US gallons'); });
    $('ev-efficiency-unit').textContent = metric ? 'kWh/100 km' : 'mi/kWh';
    $('distance-unit').textContent = metric ? 'km' : 'miles';
    $('economy-unit').textContent = metric ? 'L/100 km' : 'mpg';
    $('price-unit').textContent = metric ? '/ liter' : '/ US gallon';
    $('economy-heading').textContent = metric ? 'Est. L/100 km' : 'Est. MPG';
    $('volume-heading').textContent = metric ? 'Liters' : 'US gallons';
    document.querySelectorAll('.speed-unit').forEach(el => { el.textContent = speedUnit(); });
    [...$('baseline').options].forEach(option => { option.textContent = `${speedValue(Number(option.value))} ${speedUnit()}`; });
    for (const [id, min, max] of [['distance', 1, 100000], ['mpg', 1, 200], ['price', 0, 100]]) {
      const factor = id === 'distance' ? KM_PER_MILE : id === 'price' ? 1 / LITERS_PER_GALLON : 1;
      $(id).min = metric ? (id === 'mpg' ? ECONOMY_FACTOR / max : min * factor) : min;
      $(id).max = metric ? (id === 'mpg' ? ECONOMY_FACTOR / min : max * factor) : max;
    }
  }
  $('units').addEventListener('change', () => {
    const next = $('units').value === 'metric';
    if (next === metric) return;
    for (const [id, factor] of [['distance', KM_PER_MILE], ['price', 1 / LITERS_PER_GALLON]]) {
      if (Number.isFinite($(id).valueAsNumber)) $(id).value = $(id).valueAsNumber * (next ? factor : 1 / factor);
    }
    if ($('mpg').valueAsNumber > 0) $('mpg').value = ECONOMY_FACTOR / $('mpg').valueAsNumber;
    if ($('ev-efficiency').valueAsNumber > 0) $('ev-efficiency').value = 100 * KM_PER_MILE / $('ev-efficiency').valueAsNumber;
    metric = next; unitLabels(); update();
  });
  update();
})();
