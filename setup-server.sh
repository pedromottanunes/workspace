#!/bin/bash
# ============================================
# Script de Setup Inicial - AWS EC2
# ============================================
# Uso: ./setup-server.sh
# Execute este script DENTRO do servidor EC2 pela primeira vez

set -e  # Parar em caso de erro

echo "🚀 Configurando servidor AWS EC2 para OD Drive..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está rodando como usuário correto (não root)
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Não execute este script como root/sudo!${NC}"
    echo "Execute como usuário normal (ex: ubuntu)"
    exit 1
fi

# 1. Atualizar sistema
echo -e "${BLUE}📦 Atualizando sistema...${NC}"
sudo apt update
sudo apt upgrade -y
echo ""

# 2. Instalar Node.js 20.x
echo -e "${BLUE}📦 Instalando Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js já instalado: $(node --version)"
fi
echo ""

# 3. Instalar PM2
echo -e "${BLUE}📦 Instalando PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "PM2 já instalado: $(pm2 --version)"
fi
echo ""

# 4. Instalar Nginx
echo -e "${BLUE}📦 Instalando Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
else
    echo "Nginx já instalado: $(nginx -v 2>&1)"
fi
echo ""

# 5. Instalar Git
echo -e "${BLUE}📦 Instalando Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
else
    echo "Git já instalado: $(git --version)"
fi
echo ""

# 6. Criar diretório de apps
echo -e "${BLUE}📁 Criando diretórios...${NC}"
mkdir -p ~/apps
cd ~/apps
echo ""

# 7. Solicitar URL do repositório
echo -e "${YELLOW}Digite a URL do repositório GitHub:${NC}"
read -p "URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}❌ URL não fornecida!${NC}"
    exit 1
fi

# 8. Clonar repositório
echo -e "${BLUE}📥 Clonando repositório...${NC}"
if [ -d "oddrive" ]; then
    echo -e "${YELLOW}Diretório 'oddrive' já existe. Removendo...${NC}"
    rm -rf oddrive
fi
git clone "$REPO_URL" oddrive
cd oddrive
echo ""

# 9. Instalar dependências
echo -e "${BLUE}📦 Instalando dependências...${NC}"
echo "Backend..."
cd gerenciador-de-campanhas
npm install --production
cd ..

echo "Gerador..."
cd gerador-de-orcamentos
npm install --production
cd ..
echo ""

# 10. Instruções para variáveis de ambiente
echo -e "${YELLOW}⚙️  PRÓXIMO PASSO: Configurar variáveis de ambiente${NC}"
echo ""
echo "1️⃣  Configure o Backend:"
echo "   nano ~/apps/oddrive/gerenciador-de-campanhas/.env"
echo ""
echo "2️⃣  Configure o Gerador:"
echo "   nano ~/apps/oddrive/gerador-de-orcamentos/.env"
echo ""
echo -e "${BLUE}📄 Consulte README-AWS-EC2.md para ver todas as variáveis necessárias${NC}"
echo ""
echo -e "${YELLOW}Pressione ENTER quando terminar de configurar os arquivos .env${NC}"
read -p ""

# 11. Iniciar com PM2
echo -e "${BLUE}🚀 Iniciando aplicações com PM2...${NC}"
cd ~/apps/oddrive/gerenciador-de-campanhas
pm2 start backend/server.js --name "oddrive-backend" --time

cd ~/apps/oddrive/gerador-de-orcamentos
pm2 start server/index.js --name "oddrive-gerador" --time

# Salvar configuração PM2
pm2 save
echo ""

# 12. Configurar auto-start PM2
echo -e "${BLUE}⚙️  Configurando auto-start do PM2...${NC}"
pm2 startup | grep "sudo" | bash
echo ""

# 13. Solicitar IP para configuração Nginx
echo -e "${YELLOW}Digite o IP público deste servidor EC2:${NC}"
read -p "IP: " SERVER_IP

if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}❌ IP não fornecido! Configure o Nginx manualmente.${NC}"
else
    # 14. Configurar Nginx
    echo -e "${BLUE}🌐 Configurando Nginx...${NC}"
    
    sudo tee /etc/nginx/sites-available/oddrive > /dev/null <<EOF
# Frontend (Workspace)
server {
    listen 80;
    server_name $SERVER_IP;

    # Frontend estático
    location / {
        root /home/ubuntu/apps/oddrive/workspace;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy para Backend APIs
    location /api/ {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Gerador de Orçamentos
server {
    listen 5173;
    server_name $SERVER_IP;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Ativar site
    sudo ln -sf /etc/nginx/sites-available/oddrive /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar e reiniciar Nginx
    sudo nginx -t
    sudo systemctl restart nginx
    echo ""
fi

# 15. Status final
echo -e "${GREEN}✅ Setup concluído!${NC}"
echo ""
echo -e "${YELLOW}📊 Status dos serviços:${NC}"
pm2 status
echo ""

echo -e "${BLUE}🌐 URLs de acesso:${NC}"
if [ -n "$SERVER_IP" ]; then
    echo "   Workspace: http://$SERVER_IP/"
    echo "   Backend Health: http://$SERVER_IP:5174/api/session/health"
    echo "   Gerador Health: http://$SERVER_IP:5173/health"
fi
echo ""

echo -e "${YELLOW}📝 Comandos úteis:${NC}"
echo "   pm2 logs                 # Ver logs"
echo "   pm2 status               # Ver status"
echo "   pm2 restart all          # Reiniciar tudo"
echo "   sudo systemctl status nginx  # Status do Nginx"
echo ""

echo -e "${GREEN}🎉 Servidor configurado com sucesso!${NC}"
