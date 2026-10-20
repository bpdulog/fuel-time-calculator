// Optional dependency-free browser smoke check using Chrome's DevTools protocol.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const browserPath = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!browserPath) throw new Error('Set CHROME_PATH to an installed Chrome or Edge executable.');
  const tempRoot = path.resolve(os.tmpdir());
  const profile = fs.mkdtempSync(path.join(tempRoot, 'fuel-time-browser-'));
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const activePort = path.join(profile, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 100 && !fs.existsSync(activePort); attempt++) await delay(100);
    const port = Number(fs.readFileSync(activePort, 'utf8').split('\n')[0]);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(item => item.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (!message.id) return;
      const job = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) job.reject(new Error(message.error.message));
      else job.resolve(message.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(path.resolve(__dirname, '../index.html')).href });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.querySelector('#cost-delta')?.textContent === '$9.39'`)) break;
      await delay(100);
    }
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$9.39');
    await evaluate(`document.querySelector('#ev-speed-tab').click()`);
    assert.equal(await evaluate(`document.querySelector('#gas-vehicle-picker').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('label[for="mpg"]').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#price').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('#units').selectedOptions[0].textContent`), 'Miles / kWh');
    assert.equal(await evaluate(`document.querySelector('#ev-sidebar-inputs').contains(document.querySelector('#ev-efficiency'))`), true);
    assert.equal(await evaluate(`document.querySelector('#baseline-detail').textContent.includes('kWh')`), true);
    await evaluate(`document.querySelector('#ev-vehicle-year').value = '2024'; document.querySelector('#ev-vehicle-year').dispatchEvent(new Event('change')); document.querySelector('#ev-vehicle-make').value = 'Toyota'; document.querySelector('#ev-vehicle-make').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`Array.from(document.querySelector('#ev-vehicle-model').options).some(option => /Prius|Camry|RAV4/i.test(option.textContent))`), false);
    assert.equal(await evaluate(`document.querySelector('#ev-vehicle-model').options.length > 1`), true);
    await evaluate(`document.querySelector('#ev-vehicle-model').selectedIndex = 1; document.querySelector('#ev-vehicle-model').dispatchEvent(new Event('change')); document.querySelector('#ev-vehicle-options').selectedIndex = 1; document.querySelector('#ev-vehicle-options').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`document.querySelector('#ev-vehicle-status').textContent.includes('EPA highway')`), true);
    const evEfficiency = await evaluate(`document.querySelector('#ev-efficiency').valueAsNumber`);
    await evaluate(`document.querySelector('#units').value = 'metric'; document.querySelector('#units').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`document.querySelector('#ev-efficiency-unit').textContent`), 'kWh/100 km');
    assert.ok(Math.abs(await evaluate(`document.querySelector('#ev-efficiency').valueAsNumber`) - 160.9344 / evEfficiency) < 0.00001);
    await evaluate(`document.querySelector('#ev-tab').click()`);
    assert.equal(await evaluate(`document.querySelector('.ev-inputs').contains(document.querySelector('#ev-efficiency'))`), true);
    assert.equal(await evaluate(`document.querySelector('#gas-vehicle-picker').hidden`), false);
    await evaluate(`document.querySelector('#speed-tab').click(); document.querySelector('#trip-form').reset(); new Promise(resolve => setTimeout(resolve,20))`);
    assert.equal(await evaluate(`document.querySelectorAll('#results-table tr').length`), 8);
    assert.equal(await evaluate(`document.querySelector('#time-delta').textContent`), '19.8 min');
    await evaluate(`document.querySelector('[data-speed="80"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#cost-label').textContent`), 'Extra fuel cost');
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$52.68');
    await evaluate(`document.querySelector('#baseline').value = '55'; document.querySelector('#baseline').dispatchEvent(new Event('input', {bubbles:true}))`);
    assert.equal(await evaluate(`document.querySelector('#table-baseline').textContent`), '55');
    await evaluate(`document.querySelector('#distance').value = ''; document.querySelector('#distance').dispatchEvent(new Event('input', {bubbles:true}))`);
    assert.equal(await evaluate(`document.querySelector('#input-error').hidden`), false);
    assert.equal(await evaluate(`document.querySelector('#export').disabled`), true);
    await evaluate(`document.querySelector('#trip-form').reset(); new Promise(resolve => setTimeout(resolve,20))`);
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$9.39');
    assert.equal(await evaluate(`document.querySelector('#input-error').hidden`), true);
    await evaluate(`document.querySelector('#price').value = '0'; document.querySelector('#price').dispatchEvent(new Event('input',{bubbles:true}))`);
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$0.00');
    assert.equal(await evaluate(`document.querySelector('#chart').innerHTML.includes('NaN')`), false);
    await evaluate(`document.querySelector('#trip-form').reset(); new Promise(resolve => setTimeout(resolve,20))`);
    await evaluate(`document.querySelector('#units').value = 'metric'; document.querySelector('#units').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$9.39');
    assert.equal(await evaluate(`document.querySelector('#time-delta').textContent`), '19.8 min');
    assert.equal(await evaluate(`document.querySelector('#volume-heading').textContent`), 'Liters');
    assert.equal(await evaluate(`document.querySelector('#baseline-detail').textContent.includes('liters')`), true);
    assert.equal(await evaluate(`document.querySelector('#selected-speed').textContent`), '104.6');
    assert.ok(Math.abs(await evaluate(`document.querySelector('#distance').valueAsNumber`) - 482.8032) < 0.00001);
    await evaluate(`window.fetch = async url => ({ok: true, json: async () => url.includes('menu/year') ? {menuItem: {text:'2024', value:'2024'}} : url.includes('menu/make') ? {menuItem: {text:'Toyota', value:'Toyota'}} : url.includes('menu/model') ? {menuItem: {text:'Camry', value:'Camry'}} : url.includes('menu/options') ? {menuItem: {text:'Automatic', value:'123'}} : {comb08:32, fuelType1:'Regular Gasoline'}}); document.querySelector('.vehicle-picker').open = true; new Promise(resolve => setTimeout(resolve,30))`);
    for (const [field, value] of [['year','2024'], ['make','Toyota'], ['model','Camry'], ['options','123']]) {
      await evaluate(`document.querySelector('#vehicle-${field}').value = '${value}'; document.querySelector('#vehicle-${field}').dispatchEvent(new Event('change')); new Promise(resolve => setTimeout(resolve,20))`);
    }
    assert.ok(Math.abs(await evaluate(`document.querySelector('#mpg').valueAsNumber`) - 235.214583 / 32) < 0.0001);
    assert.equal(await evaluate(`document.querySelector('#vehicle-status').textContent.includes('32 MPG')`), true);
    await evaluate(`window.fetch = async () => {throw new Error('offline')}; document.querySelector('#vehicle-options').dispatchEvent(new Event('change')); new Promise(resolve => setTimeout(resolve,20))`);
    assert.equal(await evaluate(`document.querySelector('#vehicle-retry').hidden`), false);
    await evaluate(`document.querySelector('#trip-form').reset(); new Promise(resolve => setTimeout(resolve,20))`);
    assert.equal(await evaluate(`document.querySelector('#volume-heading').textContent`), 'US gallons');
    assert.equal(await evaluate(`document.querySelector('#cost-delta').textContent`), '$9.39');
    const desktop = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const screenshotPath = path.join(tempRoot, 'fuel-time-calculator-desktop.png');
    fs.writeFileSync(screenshotPath, Buffer.from(desktop.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Mobile page must not overflow horizontally');
    assert.deepEqual(errors, [], 'Browser must have no JavaScript exceptions');
    console.log('Browser checks passed: defaults, speed selection, baseline changes, invalid inputs, reset, free fuel, and mobile layout.');
    console.log(`Desktop screenshot: ${screenshotPath}`);
  } finally {
    if (socket) socket.close();
    browser.kill();
    await delay(500);
    // Delete only the unique temporary profile created by this check.
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('fuel-time-browser-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Browser may still hold temporary files. */ }
    }
  }
}
const timeout = setTimeout(() => { console.error('Browser check timed out.'); process.exit(1); }, 45000);
main().then(() => { clearTimeout(timeout); }, error => { clearTimeout(timeout); console.error(error); process.exitCode = 1; });
