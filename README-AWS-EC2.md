# 🚀 DEPLOY AWS EC2 - WORKSPACE UNIFICADO

Guia completo para fazer deploy do Workspace Unificado OD Drive em servidor AWS EC2.

## 📦 ESTRUTURA DO PROJETO

O sistema possui 3 aplicações Node.js:

```
WORKSPACE UNIFICADO/
├── gerenciador-de-campanhas/   # Backend (porta 5174)
│   └── backend/
│       └── server.js
├── gerador-de-orcamentos/       # API Gerador (porta 5173)
│   └── server/
│       └── index.js
└── workspace/                   # Frontend estático (porta 4173 - via nginx)
    ├── index.html
    └── login.html
```

## 🔐 PRÉ-REQUISITOS

### Credenciais AWS Necessárias

Para acessar o servidor EC2, você precisa de:

- ✅ **IP público do EC2** (ex: `54.123.45.67`)
- ✅ **Chave SSH** (arquivo `.pem`)
- ✅ **Security Group** com portas abertas:
  - 22 (SSH)
  - 80 (HTTP)
  - 443 (HTTPS)
  - 5173 (API Gerador)
  - 5174 (Backend)

### Serviços Externos

- **MongoDB Atlas**: String de conexão configurada
- **Google Cloud**: Credenciais para Slides/Drive API

---

## 📋 PASSO 1: PREPARAR O SERVIDOR EC2

### 1.1 Conectar ao Servidor via SSH

**Windows (PowerShell):**
```powershell
# Ajustar permissões da chave (primeira vez)
icacls "sua-chave.pem" /inheritance:r
icacls "sua-chave.pem" /grant:r "$($env:USERNAME):R"

# Conectar
ssh -i "sua-chave.pem" ubuntu@IP_DO_EC2
```

**Linux/Mac:**
```bash
chmod 400 sua-chave.pem
ssh -i sua-chave.pem ubuntu@IP_DO_EC2
```

### 1.2 Instalar Dependências no Servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2

# Instalar Nginx (servidor web)
sudo apt install -y nginx

# Instalar Git
sudo apt install -y git

# Verificar instalações
node --version  # Deve mostrar v20.x.x
npm --version
pm2 --version
nginx -v
```

---

## 📥 PASSO 2: CLONAR O REPOSITÓRIO

```bash
# Criar diretório para aplicação
cd ~
mkdir -p apps
cd apps

# Clonar repositório (substitua pela URL do seu repo)
git clone https://github.com/SEU-USUARIO/SEU-REPO.git oddrive
cd oddrive
```

---

## ⚙️ PASSO 3: CONFIGURAR VARIÁVEIS DE AMBIENTE

### 3.1 Backend (Gerenciador de Campanhas)

```bash
cd ~/apps/oddrive/gerenciador-de-campanhas
nano .env
```

Adicione as variáveis:

```env
# Ambiente
NODE_ENV=production

# Servidor
PORT=5174
TRUST_PROXY=1

# MongoDB Atlas
MONGO_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/odrive_app?retryWrites=true&w=majority
DB_TYPE=mongo

# Sessão
SESSION_SECRET=GERE_UM_RANDOM_AQUI_64_CARACTERES

# Google Service Account
GOOGLE_CLIENT_EMAIL=oddrive-backend@oddrive.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# APIs
public_key=mltyemmj
Private_key=e9389577-fb30-4297-81eb-7acf508bc261

# CORS - URLs de produção
BACKEND_URL=http://IP_DO_EC2:5174
GERADOR_URL=http://IP_DO_EC2:5173
WORKSPACE_URL=http://IP_DO_EC2

# Rate Limiting
DISABLE_RATE_LIMIT=0

# Redis (opcional)
USE_REDIS=false

# Captura
CAPTURE_MAX_AGE_MINUTES=60
JSON_BODY_LIMIT=12mb
```

**Salvar:** `Ctrl + O` → `Enter` → `Ctrl + X`

### 3.2 Gerador de Orçamentos

```bash
cd ~/apps/oddrive/gerador-de-orcamentos
nano .env
```

Adicione as variáveis:

```env
# Ambiente
NODE_ENV=production
PORT=5173

# Aplicação
APP_NAME=OD Drive - Gerador de Orçamentos
APP_VERSION=1.0.0

# MongoDB (mesmo do backend)
MONGO_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/odrive_app?retryWrites=true&w=majority
MONGO_DB_NAME=odrive_app

# Google OAuth
GOOGLE_CLIENT_ID=91797665925-XXXXX.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XXXXX
GOOGLE_REDIRECT_URI=http://IP_DO_EC2:5173/api/slides/oauth/callback

# Google Templates IDs
GOOGLE_TEMPLATE_ODIN_ID=1abcd...
GOOGLE_TEMPLATE_OD_VT_ID=1efgh...
GOOGLE_TEMPLATE_OD_DROP_ID=1ijkl...
GOOGLE_TEMPLATE_OD_PACK_ID=1mnop...
GOOGLE_TEMPLATE_OD_FULL_ID=1qrst...

# Google Drive Folders
GOOGLE_PRESENTATIONS_FOLDER_ID=1uvwx...
GOOGLE_DRIVE_ASSETS_FOLDER_ID=1yzab...
GOOGLE_SHARE_PRESENTATIONS=true

# Caminhos
STORAGE_PATH=./data/proposals
EXPORTS_PATH=./tmp/exports
UPLOADS_PATH=./tmp/uploads
```

**Salvar:** `Ctrl + O` → `Enter` → `Ctrl + X`

---

## 📦 PASSO 4: INSTALAR DEPENDÊNCIAS

```bash
# Backend
cd ~/apps/oddrive/gerenciador-de-campanhas
npm install

# Gerador
cd ~/apps/oddrive/gerador-de-orcamentos
npm install
```

---

## 🚀 PASSO 5: CONFIGURAR PM2 (AUTO-START)

### 5.1 Iniciar Aplicações com PM2

```bash
# Backend
cd ~/apps/oddrive/gerenciador-de-campanhas
pm2 start backend/server.js --name "oddrive-backend" --time

# Gerador
cd ~/apps/oddrive/gerador-de-orcamentos
pm2 start server/index.js --name "oddrive-gerador" --time

# Verificar status
pm2 status

# Ver logs
pm2 logs

# Ver logs de uma app específica
pm2 logs oddrive-backend
pm2 logs oddrive-gerador
```

### 5.2 Configurar Auto-Start (Reiniciar após Reboot)

```bash
# Salvar configuração atual
pm2 save

# Configurar para iniciar com o sistema
pm2 startup
# Execute o comando que aparecer (geralmente começa com sudo)

# Exemplo:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## 🌐 PASSO 6: CONFIGURAR NGINX (FRONTEND + PROXY)

### 6.1 Criar Configuração do Nginx

```bash
sudo nano /etc/nginx/sites-available/oddrive
```

Adicione a configuração:

```nginx
# Frontend (Workspace)
server {
    listen 80;
    server_name IP_DO_EC2;  # Substitua pelo IP real

    # Frontend estático
    location / {
        root /home/ubuntu/apps/oddrive/workspace;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy para Backend (porta 5174)
    location /api/campaigns {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/session {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/admin {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/config {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/imports {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/storage {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Gerador de Orçamentos (porta 5173)
server {
    listen 5173;
    server_name IP_DO_EC2;  # Substitua pelo IP real

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Salvar:** `Ctrl + O` → `Enter` → `Ctrl + X`

### 6.2 Ativar Configuração

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/oddrive /etc/nginx/sites-enabled/

# Remover configuração padrão (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx

# Verificar status
sudo systemctl status nginx
```

---

## ✅ PASSO 7: TESTAR O DEPLOY

### 7.1 URLs de Teste

Acesse no navegador (substitua pelo IP real):

- **Workspace**: `http://IP_DO_EC2/`
- **Login**: `http://IP_DO_EC2/login.html`
- **Backend Health**: `http://IP_DO_EC2:5174/api/session/health`
- **Gerador Health**: `http://IP_DO_EC2:5173/health`

### 7.2 Verificar Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 ATUALIZAÇÕES (DEPLOY DE NOVAS VERSÕES)

### Script de Atualização Rápida

Crie um script para facilitar atualizações:

```bash
cd ~/apps/oddrive
nano deploy.sh
```

Adicione o conteúdo:

```bash
#!/bin/bash
echo "🚀 Iniciando atualização do Workspace OD Drive..."

# Puxar últimas mudanças
git pull origin main

# Reinstalar dependências se necessário
cd gerenciador-de-campanhas && npm install
cd ../gerador-de-orcamentos && npm install
cd ..

# Reiniciar serviços
pm2 restart oddrive-backend
pm2 restart oddrive-gerador

# Recarregar Nginx (frontend estático)
sudo systemctl reload nginx

echo "✅ Atualização concluída!"
pm2 status
```

Tornar executável:

```bash
chmod +x deploy.sh
```

Executar atualizações:

```bash
cd ~/apps/oddrive
./deploy.sh
```

---

## 🛡️ SEGURANÇA (OPCIONAL MAS RECOMENDADO)

### Configurar Firewall UFW

```bash
# Ativar firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5173/tcp
sudo ufw allow 5174/tcp
sudo ufw enable

# Verificar status
sudo ufw status
```

### Configurar HTTPS com Let's Encrypt (Certificado SSL)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado (substitua pelo seu domínio)
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática (já configurada pelo Certbot)
sudo certbot renew --dry-run
```

---

## 🆘 COMANDOS ÚTEIS

### PM2
```bash
pm2 list                    # Listar processos
pm2 logs                    # Ver todos os logs
pm2 logs oddrive-backend    # Logs do backend
pm2 logs oddrive-gerador    # Logs do gerador
pm2 restart all             # Reiniciar tudo
pm2 restart oddrive-backend # Reiniciar backend
pm2 stop all                # Parar tudo
pm2 delete all              # Remover processos
pm2 monit                   # Monitor em tempo real
```

### Nginx
```bash
sudo systemctl status nginx   # Status
sudo systemctl restart nginx  # Reiniciar
sudo systemctl reload nginx   # Recarregar config
sudo nginx -t                 # Testar configuração
sudo tail -f /var/log/nginx/error.log  # Ver erros
```

### Sistema
```bash
df -h              # Espaço em disco
free -h            # Memória RAM
htop               # Monitor de processos
journalctl -xe     # Logs do sistema
```

---

## 📝 CHECKLIST FINAL

- [ ] Servidor EC2 acessível via SSH
- [ ] Node.js 20.x instalado
- [ ] PM2 instalado globalmente
- [ ] Nginx instalado e configurado
- [ ] Repositório clonado
- [ ] `.env` configurado no backend
- [ ] `.env` configurado no gerador
- [ ] Dependências instaladas (`npm install`)
- [ ] Serviços iniciados com PM2
- [ ] PM2 configurado para auto-start
- [ ] Nginx servindo frontend
- [ ] URLs de teste funcionando
- [ ] Security Group com portas corretas
- [ ] Firewall UFW configurado (opcional)
- [ ] HTTPS configurado (opcional)

---

## 🎯 PRÓXIMOS PASSOS

1. **Domínio Customizado** (opcional):
   - Registrar domínio
   - Configurar DNS apontando para IP do EC2
   - Atualizar Nginx com o domínio
   - Configurar HTTPS com Let's Encrypt

2. **Monitoramento**:
   - Configurar alertas no CloudWatch (AWS)
   - Monitorar uso de CPU/memória
   - Logs centralizados

3. **Backup**:
   - Configurar snapshot automático do EC2
   - Backup do MongoDB Atlas (já automático)

---

**Pronto! Seu Workspace OD Drive está rodando na AWS EC2! 🎉**
