'use strict';
(() => {
  const { SPEEDS, calculate, toCsv } = window.FuelCalculator;
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
  let selectedSpeed = 65;
  let rows = [];
  let baselineSpeed = 70;
  let valid = false;
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
    const ticks = rows.map(row => `<text x="${x(row.speed)}" y="${height - 14}" text-anchor="middle">${row.speed}</text>`).join('');
    const dots = rows.map(row => `<circle cx="${x(row.speed)}" cy="${y(row.cost)}" r="${row.speed === selectedSpeed ? 6 : 3.5}" fill="${row.speed === selectedSpeed ? '#204d3c' : '#fffefa'}" stroke="#204d3c" stroke-width="2"/>`).join('');
    const selected = rows.find(row => row.speed === selectedSpeed);
    const anchor = selectedSpeed === 80 ? 'end' : selectedSpeed === 45 ? 'start' : 'middle';
    $('chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc"><title id="chart-title">Fuel cost by driving speed</title><desc id="chart-desc">At ${selectedSpeed} mph, estimated fuel cost is ${money(selected.cost)}. Full values are available in the comparison table.</desc><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a6be77" stop-opacity=".3"/><stop offset="100%" stop-color="#a6be77" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${left},${height-bottom} ${points} ${width-right},${height-bottom}" fill="url(#area)"/><line x1="${x(baselineSpeed)}" x2="${x(baselineSpeed)}" y1="${top}" y2="${height-bottom}" stroke="#aeb8a8" stroke-dasharray="4 4"/><polyline points="${points}" fill="none" stroke="#204d3c" stroke-width="2.5" stroke-linejoin="round"/>${dots}<text class="point-label" x="${x(selectedSpeed)}" y="${y(selected.cost)-13}" text-anchor="${anchor}">${money(selected.cost)}</text>${ticks}</svg>`;
  }
  function render() {
    if (!valid) return;
    const selected = rows.find(row => row.speed === selectedSpeed);
    const baseline = rows.find(row => row.speed === baselineSpeed);
    $('selected-speed').textContent = selectedSpeed;
    const diff = selectedSpeed - baselineSpeed;
    $('speed-tag').textContent = diff === 0 ? 'Your baseline' : `${Math.abs(diff)} mph ${diff < 0 ? 'slower' : 'faster'}`;
    speedButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(SPEEDS[index] === selectedSpeed)));
    $('baseline-cost').textContent = money(baseline.cost);
    $('baseline-time').textContent = baseline.duration;
    $('baseline-detail').textContent = `${baselineSpeed} mph · ${baseline.mpg.toFixed(1)} MPG · ${baseline.gallons.toFixed(2)} gallons`;
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
    $('selected-mpg').textContent = `${selected.mpg.toFixed(1)} estimated MPG`;
    $('insight').textContent = slower
      ? `At ${selectedSpeed} mph, you ${selected.savings >= 0 ? 'save' : 'spend an extra'} ${money(Math.abs(selected.savings))} and add ${number(selected.extraMinutes)} minutes versus ${baselineSpeed} mph. That's ${money(selected.hourlyValue)} in fuel savings per extra hour on the road.`
      : faster
      ? `At ${selectedSpeed} mph, you save ${number(-selected.extraMinutes)} minutes and ${selected.savings <= 0 ? 'spend an extra' : 'save'} ${money(Math.abs(selected.savings))} versus ${baselineSpeed} mph. ${hourly >= 0 ? 'Those minutes cost' : 'Fuel savings are'} ${money(Math.abs(hourly))} per hour saved.`
      : `This is your baseline: ${money(selected.cost)} in fuel for a ${selected.duration} trip. Select another speed to compare the difference.`;
    $('table-baseline').textContent = baselineSpeed;
    $('results-table').innerHTML = rows.map(row => `<tr class="${row.speed === selectedSpeed ? 'selected' : ''}"><td><button class="row-speed" type="button" data-speed="${row.speed}" aria-label="Compare ${row.speed} miles per hour" aria-pressed="${row.speed === selectedSpeed}">${row.speed} mph</button>${row.speed === baselineSpeed ? '<span class="row-tag">BASE</span>' : ''}</td><td>${row.mpg.toFixed(1)}</td><td>${row.duration}</td><td>${money(row.cost)}</td><td>${row.gallons.toFixed(2)}</td><td class="${row.savings < 0 ? 'negative' : row.savings > 0 ? 'positive' : ''}">${money(row.savings)}</td><td>${row.extraMinutes > 0 ? '+' : ''}${row.extraMinutes.toFixed(1)} min</td><td>${row.extraMinutes > 0 ? money(row.hourlyValue) : '—'}</td></tr>`).join('');
    drawChart();
  }
  function update() {
    try {
      baselineSpeed = Number($('baseline').value);
      rows = calculate({ distance: $('distance').valueAsNumber, baseMpg: $('mpg').valueAsNumber, fuelPrice: $('price').valueAsNumber, baseline: baselineSpeed });
      valid = true;
      $('input-error').hidden = true;
      $('export').disabled = false;
      speedButtons.forEach(button => { button.disabled = false; });
      $('results-table').querySelectorAll('button').forEach(button => { button.disabled = false; });
      document.querySelectorAll('.results-area, .table-card').forEach(element => { element.style.opacity = '1'; });
      render();
    } catch (error) {
      valid = false;
      $('input-error').textContent = `${error.message} Results below show the last valid inputs.`;
      $('input-error').hidden = false;
      $('export').disabled = true;
      speedButtons.forEach(button => { button.disabled = true; });
      $('results-table').querySelectorAll('button').forEach(button => { button.disabled = true; });
      document.querySelectorAll('.results-area, .table-card').forEach(element => { element.style.opacity = '.5'; });
    }
  }
  $('trip-form').addEventListener('input', update);
  $('trip-form').addEventListener('submit', event => event.preventDefault());
  $('trip-form').addEventListener('reset', () => { selectedSpeed = 65; setTimeout(update, 0); });
  $('results-table').addEventListener('click', event => {
    const button = event.target.closest('button[data-speed]');
    if (!button || !valid) return;
    selectedSpeed = Number(button.dataset.speed);
    render();
    $('results-table').querySelector(`button[data-speed="${selectedSpeed}"]`).focus();
  });
  $('export').addEventListener('click', () => {
    if (!valid) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fuel-time-comparison-${baselineSpeed}mph-baseline.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  update();
})();
