# ============================================
# DEPLOY.PS1 - Subir PACROS a GitHub
# Ejecutar: .\deploy.ps1
# ============================================

$repoName = "PACROS"
$repoDescription = "Media Rosquilla - Pac-Man Caleno Multijugador"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY - Media Rosquilla a GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Paso 1: Verificar autenticacion ---
Write-Host "[1/4] Verificando autenticacion de GitHub..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  No estas autenticado. Iniciando login..." -ForegroundColor Red
    Write-Host "  Se abrira tu navegador para autorizar acceso." -ForegroundColor White
    Write-Host ""
    gh auth login -p https -h github.com -w
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: No se pudo autenticar. Intenta de nuevo." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Autenticacion exitosa!" -ForegroundColor Green
} else {
    Write-Host "  Ya estas autenticado." -ForegroundColor Green
}

# --- Paso 2: Verificar/crear repositorio en GitHub ---
Write-Host ""
Write-Host "[2/4] Verificando repositorio en GitHub..." -ForegroundColor Yellow
$repoCheck = gh repo view $repoName 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creando repositorio '$repoName' en GitHub..." -ForegroundColor White
    gh repo create $repoName --public --description $repoDescription --source . --remote origin --push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Repositorio creado y codigo subido!" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  LISTO! Tu repo esta en GitHub" -ForegroundColor Green
        $ghUser = gh api user --jq '.login' 2>&1
        Write-Host "  https://github.com/$ghUser/$repoName" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "ERROR: No se pudo crear el repositorio." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Repositorio ya existe en GitHub." -ForegroundColor Green
}

# --- Paso 3: Verificar que el remote existe ---
Write-Host ""
Write-Host "[3/4] Configurando remote..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin 2>&1
if ($LASTEXITCODE -ne 0) {
    $ghUser = gh api user --jq '.login' 2>&1
    git remote add origin "https://github.com/$ghUser/$repoName.git"
    Write-Host "  Remote 'origin' configurado." -ForegroundColor Green
} else {
    Write-Host "  Remote ya configurado: $remoteUrl" -ForegroundColor Green
}

# --- Paso 4: Commit y Push ---
Write-Host ""
Write-Host "[4/4] Subiendo cambios..." -ForegroundColor Yellow

$changes = git status --porcelain
if ($changes) {
    git add -A
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "Actualizar: $timestamp"
    Write-Host "  Commit creado." -ForegroundColor Green
} else {
    Write-Host "  No hay cambios nuevos para commitear." -ForegroundColor White
}

git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  LISTO! Cambios subidos a GitHub" -ForegroundColor Green
    $ghUser = gh api user --jq '.login' 2>&1
    Write-Host "  https://github.com/$ghUser/$repoName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "ERROR: No se pudo hacer push. Revisa tu conexion." -ForegroundColor Red
    exit 1
}
