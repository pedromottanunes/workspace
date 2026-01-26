#!/bin/bash
# ============================================
# Script de Deploy Rápido - AWS EC2
# ============================================
# Uso: ./deploy.sh
# Este script atualiza o código e reinicia os serviços

set -e  # Parar em caso de erro

echo "🚀 Iniciando atualização do Workspace OD Drive..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está no diretório correto
if [ ! -d "gerenciador-de-campanhas" ] || [ ! -d "gerador-de-orcamentos" ]; then
    echo "❌ Erro: Execute este script na raiz do projeto!"
    exit 1
fi

# 1. Puxar últimas mudanças do GitHub
echo -e "${BLUE}📥 Puxando últimas mudanças do GitHub...${NC}"
git pull origin main || {
    echo "❌ Erro ao puxar mudanças do Git"
    exit 1
}
echo ""

# 2. Atualizar dependências do Backend
echo -e "${BLUE}📦 Atualizando dependências do Backend...${NC}"
cd gerenciador-de-campanhas
npm install --production
cd ..
echo ""

# 3. Atualizar dependências do Gerador
echo -e "${BLUE}📦 Atualizando dependências do Gerador...${NC}"
cd gerador-de-orcamentos
npm install --production
cd ..
echo ""

# 4. Reiniciar serviços PM2
echo -e "${BLUE}🔄 Reiniciando serviços...${NC}"
pm2 restart oddrive-backend
pm2 restart oddrive-gerador
echo ""

# 5. Recarregar Nginx (frontend estático)
echo -e "${BLUE}🌐 Recarregando Nginx...${NC}"
sudo systemctl reload nginx
echo ""

# 6. Verificar status
echo -e "${GREEN}✅ Atualização concluída!${NC}"
echo ""
echo -e "${YELLOW}Status dos serviços:${NC}"
pm2 status
echo ""

# 7. Mostrar últimos logs
echo -e "${YELLOW}Últimas linhas dos logs:${NC}"
pm2 logs --lines 5 --nostream

echo ""
echo -e "${GREEN}🎉 Deploy finalizado com sucesso!${NC}"
echo -e "${BLUE}📊 Para monitorar em tempo real: ${NC}pm2 logs"
echo -e "${BLUE}🔍 Para ver status: ${NC}pm2 status"
