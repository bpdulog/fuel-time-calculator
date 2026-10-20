# Mile & Minute

A fuel expense vs. time savings calculator, ready for GitHub Pages. Plain HTML, CSS, and JavaScript; no dependencies, backend, or build step.

[Open the calculator](https://bpdulog.github.io/fuel-time-calculator/) · [Source repository](https://github.com/bpdulog/fuel-time-calculator)

## Preview

Open `index.html` in your browser. The page works directly from disk. Alternatively, from this folder:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then visit http://localhost:8000. Stop the server with Ctrl+C.

## Publish on GitHub Pages

1. Create a GitHub repository named `fuel-time-calculator` (public if you use GitHub Free).
2. Upload this folder's **contents** to the repository root, so `index.html` is at the top level. Include `.nojekyll`.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select **main** and **/(root)**, then **Save**.
6. Once deployment finishes, the Pages settings will show your site link, typically `https://YOUR-USERNAME.github.io/fuel-time-calculator/`.

See GitHub's [publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). All asset paths are relative, so the site works under a repository subpath.

If you prefer Git, create an empty repository on GitHub and run the following from this folder (replace `YOUR-USERNAME`):

```powershell
git add .
git commit -m "Create fuel and time savings calculator"
git remote add origin https://github.com/YOUR-USERNAME/fuel-time-calculator.git
git push -u origin main
```

The local project is initialized on branch `main`. Follow steps 3–6 above after pushing.

## Features

The EV speed tab has its own sidebar with electricity price, EV efficiency, and a battery electric vehicle selector. The bundled EPA catalog works offline and excludes hybrids and plug-in hybrids. Vehicle selection fills EPA highway efficiency as an editable starting estimate; it is not a measurement at 65 mph. Regenerate the catalog from FuelEconomy.gov with `./scripts/update-ev-catalog.ps1` in PowerShell.

- Adjustable distance, base MPG, fuel price, and baseline speed.
- Eight speeds from 45 to 80 mph, using the original Python MPG formula.
- Selected-speed summary of cost savings, time differences, and hourly trade-offs.
- Fuel cost chart, full comparison table, and CSV export.
- Responsive layout, keyboard controls, and input validation.
- Calculations run locally in the browser; optional vehicle lookup requests FuelEconomy.gov data. No analytics.
- Switch between miles / US gallons / MPG and kilometers / liters / L/100 km, including CSV exports. Switching preserves the trip and converts fuel price; currency remains USD.
- Optional year, make, model, and configuration picker uses EPA combined MPG as an editable base estimate. Internet is required; manual entry works if the service is unavailable. Electric, hydrogen, and natural-gas vehicles are excluded because their energy units do not fit this model.

## Calculation details

Defaults are 300 miles, 28 base MPG, $3.50/gallon, and a 70 mph baseline. Base MPG is the unadjusted input to the supplied model; it is **not** measured MPG at the selected baseline speed. For example, with 28 base MPG the model estimates 20.1 MPG at 70 mph.

The model uses a factor of 1.05 at 45–50 mph, 1.12 at 55 mph, and `1.12 * (1 - 0.018*d - 0.0004*d*d)` above 55 mph, where `d = speed - 55`. MPG is floored at 10. Calculations use unrounded MPG for gallons and fuel costs, then round metrics before computing baseline deltas, following the original Python sequence. Decimal ties use half-even rounding within floating point tolerance; extreme tie cases can differ from Python due to binary floating point representation.

The table's hourly savings value is defined only when the trip takes longer than the baseline. The CSV preserves the original Python value of `0` for baseline and faster trips; the table displays `—` for those rows. The summary also calculates extra fuel cost per hour saved for faster trips.

This is an illustrative model, not a vehicle-specific efficiency prediction. Constant-speed trip times exclude stops and traffic.

## Validation

With Node.js installed:

```powershell
node --test tests/calculator.test.cjs
```

The tests cover independent Python reference values, every baseline, the MPG floor, free fuel, invalid inputs, and CSV output. An optional browser check uses a local Chrome/Edge installation without npm dependencies:

```powershell
node tests/browser.cjs
```

Set `CHROME_PATH` to your browser executable if it is not in a standard Windows location.

## Files

`calculator.js` contains the pure calculation model. `app.js` connects it to the UI and draws the SVG chart. `index.html` and `styles.css` provide the page. `.nojekyll` enables direct static publishing.
