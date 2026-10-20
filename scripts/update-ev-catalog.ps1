$ErrorActionPreference = 'Stop'
$source = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv'
$csv = (Invoke-WebRequest -UseBasicParsing -Uri $source).Content
if ($csv -is [byte[]]) { $csv = [System.Text.Encoding]::UTF8.GetString($csv) }
$vehicles = @($csv | ConvertFrom-Csv | Where-Object { $_.fuelType1 -eq 'Electricity' -and -not $_.fuelType2 } | ForEach-Object {
  [ordered]@{ id = $_.id; year = [int]$_.year; make = $_.make; model = $_.model; configuration = (@($_.drive, $_.evMotor, $_.trany) | Where-Object { $_ }) -join ' / '; highwayKwhPer100Miles = [double]$_.highwayE; combinedKwhPer100Miles = [double]$_.combE }
})
$catalog = [ordered]@{ source = $source; updated = (Get-Date -Format 'yyyy-MM-dd'); vehicles = $vehicles }
$json = ConvertTo-Json -InputObject $catalog -Depth 4 -Compress
$target = Join-Path $PSScriptRoot '..\ev-vehicles.js'
[System.IO.File]::WriteAllText($target, "// Battery electric vehicles only. Regenerate with scripts/update-ev-catalog.ps1.`nwindow.EvVehicles = $json;`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Saved $($vehicles.Count) battery electric vehicles."
