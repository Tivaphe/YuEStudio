<#
================================================================================
 YueStudio - installateur Windows
================================================================================
 Telecharge et installe tout ce qu'il faut pour creer de la musique en local
 avec le modele YuE2-3B (version GGUF) :

   1. le moteur audio.cpp  (binaires Windows precompiles, officiel)
   2. le modele YuE2-3B    (GGUF quantifie + VAE + fichiers annexes)
   3. verifie Python       (necessaire uniquement pour la petite interface)

 Rien n'est installe dans Windows : tout reste dans ce dossier.

 Utilisation :
   clic droit > Executer avec PowerShell
   ou, dans PowerShell :
       Set-ExecutionPolicy -Scope Process Bypass -Force
       .\installer.ps1

 Options :
   .\installer.ps1 -Backend cuda        force CUDA (12.4 ou 13.3 auto)
   .\installer.ps1 -Backend vulkan      force Vulkan (telechargement leger)
   .\installer.ps1 -Backend cpu         force CPU (tres lent, depannage)
   .\installer.ps1 -ToutesQualites      telecharge Q4 + Q8 + BF16 (~14 Go)
   .\installer.ps1 -Qualite q4          telecharge uniquement la version Q4
   .\installer.ps1 -Verifier            affiche un diagnostic, ne telecharge pas
================================================================================
#>

[CmdletBinding()]
param(
    [ValidateSet('auto', 'cuda', 'cuda12.4', 'cuda13.3', 'vulkan', 'cpu')]
    [string]$Backend = 'auto',

    [ValidateSet('q8', 'q4', 'bf16')]
    [string]$Qualite = 'q8',

    [switch]$ToutesQualites,
    [switch]$Verifier
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# ---------------------------------------------------------------------------
# Chemins et constantes
# ---------------------------------------------------------------------------

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$EngineDir = Join-Path $Root 'engine'
$ModelDir  = Join-Path $Root 'models\Yue2-3B-GGUF'
$TmpDir    = Join-Path $Root '_tmp'

$Version   = 'v0.8.1'
$GhBase    = "https://github.com/0xShug0/audio.cpp/releases/download/$Version"
$HfBase    = 'https://huggingface.co/audio-cpp/Yue2-3B-GGUF/resolve/main'
$HfApi     = 'https://huggingface.co/api/models/audio-cpp/Yue2-3B-GGUF/tree/main?recursive=true'

$Sidecars = @(
    'sidecars/yue2-model-config.json',
    'sidecars/yue2-generation-config.json',
    'sidecars/yue2-qwen.tiktoken',
    'sidecars/yue2-vae-config.json'
)

$Qualites = @{
    'q4'   = @{ Nom = 'Rapide (Q4_0)';      Fichiers = @('yue2-3b-q4_0.gguf', 'yue2-vae-f16.gguf');   Vram = '~8 Go' }
    'q8'   = @{ Nom = 'Equilibre (Q8_0)';   Fichiers = @('yue2-3b-q8_0.gguf', 'yue2-vae-f16.gguf');   Vram = '~9 Go' }
    'bf16' = @{ Nom = 'Maximale (BF16)';    Fichiers = @('yue2-3b-bf16.gguf', 'yue2-vae-f32.gguf');   Vram = '~13 Go' }
}

# ---------------------------------------------------------------------------
# Fonctions d'affichage
# ---------------------------------------------------------------------------

function Write-Title($t) { Write-Host ''; Write-Host "=== $t" -ForegroundColor Cyan }
function Write-Ok($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Write-Info($t)  { Write-Host "  [..] $t" -ForegroundColor Gray }
function Write-Warn2($t) { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Write-Err2($t)  { Write-Host "  [XX] $t" -ForegroundColor Red }

function Get-HumanSize([long]$bytes) {
    if ($bytes -ge 1GB) { return ('{0:N2} Go' -f ($bytes / 1GB)) }
    if ($bytes -ge 1MB) { return ('{0:N1} Mo' -f ($bytes / 1MB)) }
    return ('{0:N0} Ko' -f ($bytes / 1KB))
}

# Taille d'un fichier distant, via le meme mecanisme que le telechargement
# (HttpWebRequest suit les redirections de Hugging Face / GitHub).
function Get-RemoteSize($url) {
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = 'HEAD'
        $req.AllowAutoRedirect = $true
        $req.Timeout = 40000
        $req.UserAgent = 'YueStudio-installer/1.0'
        $resp = $req.GetResponse()
        $len = $resp.ContentLength
        $resp.Close()
        if ($len -gt 0) { return [long]$len }
    } catch {}
    return 0
}

function Get-RemoteSizesHf {
    $map = @{}
    try {
        $req = [System.Net.HttpWebRequest]::Create($HfApi)
        $req.AllowAutoRedirect = $true
        $req.Timeout = 40000
        $req.UserAgent = 'YueStudio-installer/1.0'
        $resp = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $text = $reader.ReadToEnd()
        $reader.Close(); $resp.Close()
        $json = $text | ConvertFrom-Json
        foreach ($f in $json) { if ($f.size) { $map[$f.path] = [long]$f.size } }
    } catch {
        Write-Warn2 "Tailles distantes indisponibles ($($_.Exception.Message))."
        Write-Warn2 'La progression affichera des tailles inconnues, mais le telechargement fonctionne.'
    }
    return $map
}

# Telechargement robuste : reprise, nouvelles tentatives, barre de progression.
function Save-FileFromUrl {
    param([string]$Url, [string]$OutFile, [long]$ExpectedSize = 0, [string]$Label = '')

    $dir = Split-Path -Parent $OutFile
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    if (Test-Path $OutFile) {
        $current = (Get-Item $OutFile).Length
        if ($ExpectedSize -gt 0 -and $current -ge $ExpectedSize) {
            Write-Ok "$Label deja present ($(Get-HumanSize $current)) - ignore."
            return
        }
        if ($current -gt 0) { Write-Info "$Label : reprise a $(Get-HumanSize $current)" }
    }

    if (-not $Label) { $Label = Split-Path -Leaf $OutFile }
    Write-Info "Telechargement : $Label"

    $attempt = 0
    $maxAttempts = 6
    while ($true) {
        $attempt++
        try {
            $req = [System.Net.HttpWebRequest]::Create($Url)
            $req.AllowAutoRedirect = $true
            $req.Timeout = 60000
            $req.ReadWriteTimeout = 120000
            $req.UserAgent = 'YueStudio-installer/1.0'

            $existing = 0
            if (Test-Path $OutFile) { $existing = (Get-Item $OutFile).Length }
            if ($existing -gt 0) { $req.AddRange($existing) }

            $resp = $req.GetResponse()
            $statusCode = [int]$resp.StatusCode
            if ($existing -gt 0 -and $statusCode -ne 206) {
                # Le serveur ignore la demande de reprise : on repart du debut.
                $resp.Close()
                Remove-Item $OutFile -Force -ErrorAction SilentlyContinue
                $existing = 0
                Write-Info 'Reprise refusee par le serveur : telechargement complet.'
                $req = [System.Net.HttpWebRequest]::Create($Url)
                $req.AllowAutoRedirect = $true
                $req.Timeout = 60000
                $req.ReadWriteTimeout = 120000
                $req.UserAgent = 'YueStudio-installer/1.0'
                $resp = $req.GetResponse()
            }
            $total = $existing + $resp.ContentLength
            if ($ExpectedSize -gt 0) { $total = $ExpectedSize }

            $mode = if ($existing -gt 0) { 'Append' } else { 'Create' }
            $fs = [System.IO.File]::Open($OutFile, [System.IO.FileMode]::$mode)
            $rs = $resp.GetResponseStream()

            $buffer = New-Object byte[] 262144
            $done = $existing
            Write-Host ("`r  [{0,-25}] {1,5:N1}%  {2,10} / {3,-10} {4,8} Mo/s   " -f '', 0.0, (Get-HumanSize $done), $(if ($total -gt 0) { Get-HumanSize $total } else { '?' }), '...') -NoNewline
            $lastDraw = [DateTime]::MinValue
            $lastBytes = $done
            $lastTime = [DateTime]::Now

            while (($read = $rs.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $fs.Write($buffer, 0, $read)
                $done += $read
                $now = [DateTime]::Now
                if (($now - $lastDraw).TotalMilliseconds -gt 400) {
                    $speed = ($done - $lastBytes) / [Math]::Max(0.001, ($now - $lastTime).TotalSeconds)
                    $pct = if ($total -gt 0) { [Math]::Min(100, 100.0 * $done / $total) } else { 0 }
                    $bar = '#' * [int]($pct / 4)
                    Write-Host ("`r  [{0,-25}] {1,5:N1}%  {2,10} / {3,-10} {4,8:N1} Mo/s   " -f `
                        $bar, $pct, (Get-HumanSize $done), $(if ($total -gt 0) { Get-HumanSize $total } else { '?' }), ($speed / 1MB)) -NoNewline
                    $lastDraw = $now; $lastBytes = $done; $lastTime = $now
                }
            }
            $fs.Flush(); $fs.Close(); $rs.Close(); $resp.Close()
            Write-Host ''
            Write-Ok "$Label termine ($(Get-HumanSize (Get-Item $OutFile).Length))"
            return
        }
        catch {
            Write-Host ''
            Write-Warn2 "Echec ($($_.Exception.Message))"
            if ($attempt -ge $maxAttempts) { throw "Telechargement impossible apres $maxAttempts tentatives : $Url" }
            $wait = 3 * $attempt
            Write-Info "Nouvelle tentative $attempt/$maxAttempts dans $wait s (reprise du fichier)..."
            Start-Sleep -Seconds $wait
        }
    }
}

function Expand-ZipSafe {
    param([string]$Zip, [string]$Destination)
    Write-Info "Extraction : $(Split-Path -Leaf $Zip)"
    if (-not (Test-Path $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    try {
        # 3e argument = ecraser les fichiers existants (.NET 4.6.1+ / PowerShell 5.1+)
        [System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $Destination, $true)
    } catch {
        # Repli compatible : extraction entree par entree avec ecrasement
        $archive = [System.IO.Compression.ZipFile]::OpenRead($Zip)
        try {
            foreach ($entry in $archive.Entries) {
                $target = Join-Path $Destination ($entry.FullName -replace '/', '\')
                if ($entry.FullName.EndsWith('/')) {
                    New-Item -ItemType Directory -Path $target -Force | Out-Null
                    continue
                }
                $targetDir = Split-Path -Parent $target
                if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
            }
        } finally { $archive.Dispose() }
    }
    Write-Ok "Extrait dans $Destination"
}

# ---------------------------------------------------------------------------
# Diagnostic materiel
# ---------------------------------------------------------------------------

function Get-GpuInfo {
    $info = @{ Nom = ''; Vram = 0; Driver = ''; Nvidia = $false; DriverVersion = '' }
    if ((Get-Variable -Name IsWindows -ErrorAction SilentlyContinue) -and -not $IsWindows) { return $info }
    try {
        $g = Get-CimInstance Win32_VideoController | Select-Object -First 5
        foreach ($card in $g) {
            Write-Info ("Carte graphique : {0}  ({1} Mo de memoire video)" -f $card.Name, [int]($card.AdapterRAM / 1MB))
            if ($card.Name -match 'NVIDIA') { $info.Nvidia = $true; $info.Nom = $card.Name }
        }
    } catch { Write-Warn2 "Detection des cartes graphiques impossible." }

    $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $smi -and (Test-Path "$env:SystemRoot\System32\nvidia-smi.exe")) {
        $smi = "$env:SystemRoot\System32\nvidia-smi.exe"
    } elseif ($smi) { $smi = $smi.Source }

    if ($smi) {
        try {
            $out = & $smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>$null
            if ($out) {
                $parts = ($out | Select-Object -First 1) -split ','
                $info.Nom = $parts[0].Trim()
                $info.Nvidia = $true
                $mem = ($parts[1] -replace '[^0-9]', '')
                if ($mem) { $info.Vram = [int]$mem }
                $info.DriverVersion = $parts[2].Trim()
                Write-Ok ("NVIDIA detectee : {0} - {1} Mo - pilote {2}" -f $info.Nom, $info.Vram, $info.DriverVersion)
            }
        } catch {}
    }
    return $info
}

function Test-Python {
    foreach ($cmd in @('py', 'python', 'python3')) {
        $c = Get-Command $cmd -ErrorAction SilentlyContinue
        if (-not $c) { continue }
        try {
            $v = & $cmd -c "import sys;print('%d.%d' % sys.version_info[:2])" 2>$null
            if ($v -and $v.Trim() -match '^(\d+)\.(\d+)') {
                $major = [int]$Matches[1]; $minor = [int]$Matches[2]
                if ($major -eq 3 -and $minor -ge 8) {
                    Write-Ok "Python $v trouve ($cmd)"
                    return $cmd
                }
            }
        } catch {}
    }
    return $null
}

# ---------------------------------------------------------------------------
# Mode verification
# ---------------------------------------------------------------------------

if ($Verifier) {
    Write-Host ''
    Write-Host '============== DIAGNOSTIC YueStudio ==============' -ForegroundColor Cyan
    Write-Title 'Materiel'
    $gpu = Get-GpuInfo
    if (-not $gpu.Nvidia) { Write-Warn2 'Aucune carte NVIDIA detectee : le backend Vulkan sera utilise.' }
    Write-Title 'Memoire / disque'
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        Write-Info ("RAM : {0:N1} Go disponibles" -f ($os.FreePhysicalMemory / 1MB))
    } catch { Write-Warn2 'Information RAM indisponible sur ce systeme.' }
    try {
        $drive = (Get-Item $Root).PSDrive
        if ($drive.Free) { Write-Info ("Disque {0} : {1:N1} Go libres" -f $drive.Name, ($drive.Free / 1GB)) }
    } catch { Write-Warn2 'Information disque indisponible.' }
    Write-Title 'Fichiers'
    $exe = Join-Path $EngineDir 'audiocpp_server.exe'
    if (Test-Path $exe) { Write-Ok "Moteur : $exe" } else { Write-Err2 'Moteur manquant : lancez cet installateur.' }
    $bf = Join-Path $EngineDir 'backend.txt'
    $cudaDll = @(Get-ChildItem -Path $EngineDir -Filter 'cublas*' -ErrorAction SilentlyContinue).Count
    if ($cudaDll -gt 0) { Write-Ok "Bibliotheques CUDA presentes ($cudaDll fichiers cublas*)" }
    if (Test-Path $bf) {
        Write-Ok ('Backend enregistre : ' + (Get-Content $bf -Raw).Trim())
    } elseif (Test-Path $exe) {
        $deduit = if ($cudaDll -gt 0) { 'cuda' } else { 'vulkan' }
        Set-Content -Path $bf -Value $deduit -Encoding ASCII -NoNewline
        Write-Warn2 "backend.txt absent : backend deduit puis enregistre ($deduit)."
    }
    foreach ($f in $Sidecars) {
        $p = Join-Path $ModelDir ($f -replace '/', '\')
        if (Test-Path $p) { Write-Ok "Modele : $f" } else { Write-Err2 "Modele manquant : $f" }
    }
    foreach ($q in $Qualites.Keys) {
        foreach ($f in $Qualites[$q].Fichiers) {
            $p = Join-Path $ModelDir $f
            if (Test-Path $p) { Write-Ok ("Modele [{0}] : {1} ({2})" -f $q, $f, (Get-HumanSize (Get-Item $p).Length)) }
        }
    }
    Write-Title 'Python'
    $py = Test-Python
    if (-not $py) {
        Write-Err2 'Python est absent. Installez-le :'
        Write-Host '        winget install -e --id Python.Python.3.12' -ForegroundColor White
        Write-Host '        (puis fermez et rouvrez PowerShell)' -ForegroundColor Gray
    }
    Write-Host ''
    Write-Host '============== FIN DU DIAGNOSTIC ==============' -ForegroundColor Cyan
    return
}

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host '################################################################' -ForegroundColor Cyan
Write-Host '#                    YueStudio - installation                  #' -ForegroundColor Cyan
Write-Host '#         Creation de musique en local avec YuE2-3B (GGUF)     #' -ForegroundColor Cyan
Write-Host '################################################################' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Dossier d'installation : $Root" -ForegroundColor Gray
Write-Host ''

# --- 1. Detection du backend -----------------------------------------------
Write-Title '1/4  Detection du materiel'
$gpu = Get-GpuInfo

$chosen = $Backend
if ($chosen -eq 'auto') {
    if ($gpu.Nvidia) {
        $major = 0
        if ($gpu.DriverVersion -match '^(\d+)') { $major = [int]$Matches[1] }
        if ($major -ge 580) { $chosen = 'cuda13.3' } else { $chosen = 'cuda12.4' }
        Write-Ok "Backend retenu : CUDA ($chosen) - pilote $major"
    } else {
        $chosen = 'vulkan'
        Write-Warn2 'Pas de carte NVIDIA : backend Vulkan retenu.'
    }
}
if ($chosen -eq 'cuda') { $chosen = 'cuda12.4' }

$binZip = switch ($chosen) {
    'cuda12.4' { "audio-$Version-bin-windows-x64-cuda12.4.zip" }
    'cuda13.3' { "audio-$Version-bin-windows-x64-cuda13.3.zip" }
    'vulkan'   { "audio-$Version-bin-windows-x64-vulkan.zip" }
    default    { "audio-$Version-bin-windows-x64-cpu.zip" }
}
$cudartZip = switch ($chosen) {
    'cuda12.4' { "audio-$Version-cudart-windows-x64-cuda12.4.zip" }
    'cuda13.3' { "audio-$Version-cudart-windows-x64-cuda13.3.zip" }
    default    { $null }
}

# --- 2. Moteur --------------------------------------------------------------
Write-Title '2/4  Moteur audio.cpp'
New-Item -ItemType Directory -Path $EngineDir -Force | Out-Null
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

$serverExe = Join-Path $EngineDir 'audiocpp_server.exe'
$backendFile = Join-Path $EngineDir 'backend.txt'
$recorded = ''
if (Test-Path $backendFile) { $recorded = (Get-Content $backendFile -Raw).Trim().ToLower() }
$wantedBackend = if ($chosen -like 'cuda*') { 'cuda' } else { $chosen }

# Un moteur CUDA se reconnait a ses bibliotheques d'execution (cudart/cublas) :
# sous Windows, ggml est compile statiquement dans audiocpp_server.exe.
$cudaRuntime = @(Get-ChildItem -Path $EngineDir -Filter 'cublas*' -ErrorAction SilentlyContinue).Count

$engineOk = (Test-Path $serverExe) -and (
    ($recorded -eq $wantedBackend) -or
    (-not $recorded -and (($wantedBackend -eq 'cuda' -and $cudaRuntime -gt 0) -or ($wantedBackend -ne 'cuda')))
)

if ($engineOk) {
    Write-Ok "Moteur deja installe (backend $wantedBackend) - etape ignoree."
} else {
    if (Test-Path $serverExe) { Write-Warn2 "Le moteur actuel ne correspond pas au backend $wantedBackend : re-telechargement." }
    $binPath = Join-Path $TmpDir $binZip
    Save-FileFromUrl -Url "$GhBase/$binZip" -OutFile $binPath -ExpectedSize (Get-RemoteSize "$GhBase/$binZip") -Label "Moteur ($chosen)"
    Expand-ZipSafe -Zip $binPath -Destination $EngineDir
    Remove-Item $binPath -Force -ErrorAction SilentlyContinue

    if ($cudartZip) {
        $rtPath = Join-Path $TmpDir $cudartZip
        Save-FileFromUrl -Url "$GhBase/$cudartZip" -OutFile $rtPath -ExpectedSize (Get-RemoteSize "$GhBase/$cudartZip") -Label 'Bibliotheques CUDA'
        Expand-ZipSafe -Zip $rtPath -Destination $EngineDir
        Remove-Item $rtPath -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $serverExe)) { throw "audiocpp_server.exe introuvable apres extraction." }

# Le backend choisi est memorise : l'interface (app/server.py) le relit au demarrage.
$backendName = if ($chosen -like 'cuda*') { 'cuda' } else { $chosen }
Set-Content -Path (Join-Path $EngineDir 'backend.txt') -Value $backendName -Encoding ASCII -NoNewline
Write-Ok "Backend enregistre : $backendName"
Write-Ok 'Moteur pret.'

# --- 3. Modele --------------------------------------------------------------
Write-Title '3/4  Modele YuE2-3B (GGUF)'
New-Item -ItemType Directory -Path $ModelDir -Force | Out-Null

$wanted = if ($ToutesQualites) { @('q4', 'q8', 'bf16') } else { @($Qualite) }
$files = New-Object System.Collections.Generic.List[string]
foreach ($f in $Sidecars) { $files.Add($f) }
foreach ($q in $wanted) {
    foreach ($f in $Qualites[$q].Fichiers) { if (-not $files.Contains($f)) { $files.Add($f) } }
}

$sizes = Get-RemoteSizesHf
$totalBytes = 0
foreach ($f in $files) { if ($sizes.ContainsKey($f)) { $totalBytes += $sizes[$f] } }
Write-Info ("A telecharger : {0} fichier(s), environ {1}" -f $files.Count, $(if ($totalBytes -gt 0) { Get-HumanSize $totalBytes } else { '?' }))
Write-Host ''

foreach ($f in $files) {
    $local = Join-Path $ModelDir ($f -replace '/', '\')
    $expected = 0
    if ($sizes.ContainsKey($f)) { $expected = $sizes[$f] }
    Save-FileFromUrl -Url "$HfBase/$f" -OutFile $local -ExpectedSize $expected -Label $f
}

# --- 4. Python --------------------------------------------------------------
Write-Title '4/4  Python (interface)'
$py = Test-Python

# --- Nettoyage --------------------------------------------------------------
if (Test-Path $TmpDir) { Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue }

# --- Resume -----------------------------------------------------------------
Write-Host ''
Write-Host '################################################################' -ForegroundColor Green
Write-Host '#                     INSTALLATION TERMINEE                    #' -ForegroundColor Green
Write-Host '################################################################' -ForegroundColor Green
Write-Host ''
Write-Host "  Moteur    : $EngineDir  (backend $chosen)"
Write-Host "  Modele    : $ModelDir"
foreach ($q in $wanted) { Write-Host ("  Qualite   : {0}  -  VRAM {1}" -f $Qualites[$q].Nom, $Qualites[$q].Vram) }
Write-Host ''
if (-not $py) {
    Write-Warn2 "Python manque : installez-le puis relancez 2-LANCER.bat"
    Write-Host '        winget install -e --id Python.Python.3.12' -ForegroundColor White
    Write-Host ''
} else {
    Write-Ok "Tout est pret. Double-cliquez sur  2-LANCER.bat  pour creer votre premiere chanson."
    Write-Host ''
    Write-Host '  A savoir :' -ForegroundColor Gray
    Write-Host '   - La 1re generation charge le modele en VRAM (30 a 60 s de plus).' -ForegroundColor Gray
    Write-Host '   - Comptez ensuite 1 a 4 minutes pour une chanson de 3 minutes.' -ForegroundColor Gray
    Write-Host '   - Les morceaux sont enregistres dans le dossier "Mes chansons".' -ForegroundColor Gray
    Write-Host '   - Poids YuE2 sous licence CC BY-NC 4.0 : usage non commercial.' -ForegroundColor Gray
    Write-Host ''
    $rep = Read-Host '  Lancer YueStudio maintenant ? (O/n)'
    if ($rep -notmatch '^[nN]') {
        Start-Process -FilePath (Join-Path $Root '2-LANCER.bat') -WorkingDirectory $Root
    }
}
Write-Host ''
