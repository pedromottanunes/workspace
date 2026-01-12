<#
Script de preparação do repositório local antes de fazer push ao GitHub.
Ele: (1) inicializa git se necessário; (2) remove do index arquivos sensíveis;
(3) adiciona e comita arquivos comuns; (4) instrui sobre criar repo remoto.

Execute na raiz do projeto (PowerShell):
  .\scripts\prepare-git.ps1
#>

Write-Host "Preparando repositório para push ao GitHub..." -ForegroundColor Cyan

if (-not (Test-Path .git)) {
  Write-Host "Repositório git não inicializado. Executando 'git init'..." -ForegroundColor Yellow
  git init
} else {
  Write-Host "Repositório git já inicializado." -ForegroundColor Green
}

# Arquivos sensíveis que não devem ser versionados
$sensitive = @('.env','backend/data/db.json')

foreach ($f in $sensitive) {
  if (Test-Path $f) {
    Write-Host "Removendo do índice (git rm --cached) -> $f" -ForegroundColor Yellow
    git rm --cached --ignore-unmatch $f | Out-Null
  } else {
    Write-Host "Arquivo não encontrado (ok): $f" -ForegroundColor DarkGray
  }
}

# Garante que .gitignore existe
if (-not (Test-Path .gitignore)) {
  Write-Host "Criando .gitignore padrão" -ForegroundColor Yellow
  @(
    'node_modules/',
    '.env',
    '.env.*',
    'backend/data/db.json',
    'dist/',
    'coverage/',
    'npm-debug.log*'
  ) | Out-File -FilePath .gitignore -Encoding utf8
} else {
  Write-Host ".gitignore já existe. Verifique se contém '.env' e 'backend/data/db.json'" -ForegroundColor Green
}

# Criar .env.example se não existir
if (-not (Test-Path .env.example)) {
  Write-Host "Criando .env.example (placeholders)" -ForegroundColor Yellow
  @(
    'DB_TYPE=mongo',
    'MONGO_URI=mongodb+srv://<USUARIO>:<SENHA>@cluster0.xxxxx.mongodb.net/odrive_app?retryWrites=true&w=majority',
    'MONGO_DB_NAME=odrive_app',
    'GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com',
    'GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"'
  ) | Out-File -FilePath .env.example -Encoding utf8
} else {
  Write-Host ".env.example já existe." -ForegroundColor Green
}

git add .gitignore .env.example README.md 2>$null
if (-not $?) { git add . }

if ((git status --porcelain) -ne '') {
  git commit -m "chore: prepare repo, remove sensitive files and add .env.example" -q
  Write-Host "Commit criado." -ForegroundColor Green
} else {
  Write-Host "Nada a commitar (worktree limpo)." -ForegroundColor DarkGray
}

Write-Host "
Próximos passos (manuais):
1) Crie o repositório no GitHub (Settings -> New repository) e copie a URL SSH/HTTPS.
2) Adicione remoto e faça push:
   git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git
   git branch -M main
   git push -u origin main
3) No GitHub: Settings -> Secrets and variables -> Actions -> New repository secret
   Adicione: MONGO_URI, MONGO_DB_NAME, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, DB_TYPE
4) Configure deploy (Render / Hostinger) e use esses secrets no pipeline.
" -ForegroundColor Cyan

Write-Host "Script finalizado." -ForegroundColor Green