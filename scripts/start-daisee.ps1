param([switch]$NoBrowser, [switch]$SetupOnly, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$apiRoot = Join-Path $taskRoot 'hf-emotion-api'
$taskState = Join-Path $taskRoot '.local-daisee'
$pidFile = Join-Path $taskState 'processes.json'
$pythonExe = Join-Path $apiRoot '.venv-daisee\Scripts\python.exe'
Set-Location -LiteralPath $taskRoot
New-Item -ItemType Directory -Force -Path $taskState | Out-Null

function Test-HttpReady([string]$Uri) {
  try { $null = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 3; return $true } catch { return $false }
}
function Get-OwnedProcesses {
  if (-not (Test-Path -LiteralPath $pidFile)) { return @() }
  return @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json)
}

if ($Stop) {
  foreach ($item in (Get-OwnedProcesses)) {
    $process = Get-Process -Id $item.Id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $item.Started) {
      & taskkill.exe /PID $process.Id /T /F | Out-Null
    }
  }
  Write-Host 'EmoAcademy のローカルサーバーを停止しました。'
  exit 0
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Node.js をインストールしてください。' }
if (-not (Test-Path -LiteralPath (Join-Path $apiRoot 'models\daisee_efficientnet_b2.pt'))) { throw 'DAiSEE checkpoint が見つかりません。' }
if (-not (Test-Path -LiteralPath $pythonExe)) {
  Write-Host 'Python 3.11 の仮想環境を準備しています。'
  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3.11 -m venv (Join-Path $apiRoot '.venv-daisee')
  } else {
    & python -c "import sys; assert sys.version_info[:2] == (3,11), 'Python 3.11 required'"
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 をインストールしてください。' }
    & python -m venv (Join-Path $apiRoot '.venv-daisee')
  }
  if ($LASTEXITCODE -ne 0) { throw 'Python 仮想環境を作成できませんでした。' }
}
$ErrorActionPreference = 'Continue'
& $pythonExe -c "import fastapi, uvicorn, multipart, numpy, PIL, mediapipe, cv2, torch, timm; assert hasattr(mediapipe, 'solutions')" 2>$null
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) {
  Write-Host '初回の推論ライブラリをインストールしています。数分かかる場合があります。'
  & $pythonExe -m pip install --upgrade pip --disable-pip-version-check
  & $pythonExe -m pip install torch==2.3.1+cpu torchvision==0.18.1+cpu --extra-index-url https://download.pytorch.org/whl/cpu --disable-pip-version-check
  if ($LASTEXITCODE -ne 0) { throw 'PyTorch の準備に失敗しました。' }
  & $pythonExe -m pip install -r (Join-Path $apiRoot 'requirements.txt') --disable-pip-version-check
  if ($LASTEXITCODE -ne 0) { throw '推論APIの依存準備に失敗しました。' }
}
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules'))) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'サイトの依存準備に失敗しました。' }
}
if ($SetupOnly) { Write-Host '起動準備が完了しました。'; exit 0 }

$owned = [Collections.Generic.List[object]]::new()
foreach ($item in (Get-OwnedProcesses)) {
  $process = Get-Process -Id $item.Id -ErrorAction SilentlyContinue
  if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $item.Started) { $owned.Add($item) }
}
$env:NEXT_PUBLIC_EMOTION_API_URL = 'http://127.0.0.1:7860'
$env:OMP_NUM_THREADS = '4'
$env:MKL_NUM_THREADS = '4'
if (-not (Test-HttpReady 'http://127.0.0.1:7860/health')) {
  $connection = Get-NetTCPConnection -LocalPort 7860 -State Listen -ErrorAction SilentlyContinue
  if ($connection) { throw '7860番ポートのAPIがDAiSEEに対応していません。先にそのサーバーを停止してください。' }
  $process = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app:app','--host','127.0.0.1','--port','7860') -WorkingDirectory $apiRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskState 'api.log') -RedirectStandardError (Join-Path $taskState 'api-error.log') -PassThru
  $owned.Add(@{Id=$process.Id; Started=$process.StartTime.ToUniversalTime().ToString('o'); Service='api'})
}
if (-not (Test-HttpReady 'http://127.0.0.1:3004/dashboard')) {
  $process = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('node_modules/next/dist/bin/next','dev','-p','3004','-H','127.0.0.1') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskState 'web.log') -RedirectStandardError (Join-Path $taskState 'web-error.log') -PassThru
  $owned.Add(@{Id=$process.Id; Started=$process.StartTime.ToUniversalTime().ToString('o'); Service='web'})
}
ConvertTo-Json -InputObject @($owned.ToArray()) | Set-Content -LiteralPath $pidFile -Encoding UTF8
Write-Host 'サイトとDAiSEE APIの起動を待っています。'
for ($attempt=0; $attempt -lt 90; $attempt++) {
  if ((Test-HttpReady 'http://127.0.0.1:7860/health') -and (Test-HttpReady 'http://127.0.0.1:3004/dashboard')) {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:7860/health' -TimeoutSec 5
    if (-not $health.learning_affect_ready -or $health.model_path -notlike '*daisee*') { throw 'DAiSEEモデルの読み込みを確認できません。' }
    Write-Host '起動しました: http://127.0.0.1:3004/dashboard'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:3004/dashboard' }
    exit 0
  }
  Start-Sleep -Seconds 1
}
throw '起動を確認できませんでした。.local-daisee フォルダのログを確認してください。'
