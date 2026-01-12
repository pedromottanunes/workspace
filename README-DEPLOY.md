# 🚀 WORKSPACE UNIFICADO - GUIA DE DEPLOY

Sistema completo de gerenciamento OD Drive com 3 módulos integrados.

## 📦 Estrutura do Projeto

```
WORKSPACE UNIFICADO/
├── gerenciador de Campanhas/   # Backend Node.js (porta 5174)
├── Gerador de Orçamentos/       # API Node.js (porta 5173)
├── workspace/                   # Frontend estático (porta 4173)
├── render.yaml                  # Configuração automática de deploy
└── .gitignore                   # Proteção de segredos
```

## 🔐 SEGURANÇA - ANTES DE SUBIR NO GITHUB

### ✅ Verificações Obrigatórias

**NUNCA commite no GitHub:**
- ❌ Arquivos `.env` com credenciais reais
- ❌ Chaves privadas, certificados (`.pem`, `.pfx`, `.key`)
- ❌ Tokens, senhas, API keys hardcoded no código
- ❌ `node_modules/` (pesado e desnecessário)

**O que DEVE estar no GitHub:**
- ✅ `.gitignore` (já criado na raiz)
- ✅ `.env.example` (templates sem valores reais)
- ✅ `render.yaml` (configuração de deploy)
- ✅ Código-fonte sem segredos

### 🔍 Verificação Final

Antes de fazer upload, execute:

```bash
# Verifique se .env está ignorado
git status

# Se aparecer .env na lista, PARE e adicione ao .gitignore
# Apenas .env.example deve aparecer
```

## 📤 SUBIR PARA O GITHUB

### Opção 1: Upload Manual (mais simples)

1. **Comprima a pasta** (opcional, mas recomendado):
   - Botão direito na pasta `WORKSPACE UNIFICADO`
   - "Enviar para" → "Pasta compactada"

2. **No GitHub**:
   - Vá ao seu repositório
   - Clique em "Add file" → "Upload files"
   - Arraste a pasta (ou arquivos descompactados)
   - Escreva mensagem: "Initial commit - Workspace Unificado"
   - Clique em "Commit changes"

3. **IMPORTANTE**: 
   - NÃO delete o repositório inteiro quando atualizar
   - Apenas sobrescreva/adicione arquivos novos
   - Isso preserva histórico e configurações

### Opção 2: Git Command Line (recomendado)

```bash
# Na pasta do projeto
cd "D:\Clientes Agentes\OD Drive\WORKSPACE UNIFICADO"

# Inicializar Git
git init

# Adicionar todos os arquivos (respeitando .gitignore)
git add .

# Fazer primeiro commit
git commit -m "Initial commit - Workspace Unificado"

# Conectar ao seu repositório GitHub
git remote add origin https://github.com/seu-usuario/seu-repo.git

# Enviar para o GitHub
git push -u origin main
```

## 🌐 DEPLOY NO RENDER.COM

### Passo 1: Conectar GitHub ao Render

1. Acesse [dashboard.render.com](https://dashboard.render.com/)
2. Clique em **"New +"** → **"Blueprint"**
3. Selecione **"Connect a repository"**
4. Escolha seu repositório do GitHub
5. Render detecta `render.yaml` automaticamente
6. Clique em **"Apply"**

### Passo 2: Configurar Variáveis de Ambiente (CRÍTICO!)

#### Backend (oddrive-backend)

No painel do serviço, vá em **Environment** e adicione:

```env
MONGO_URI=mongodb+srv://pedromottanunes:Calango3488@cluster0.gsd0urm.mongodb.net/odrive_app?retryWrites=true&w=majority
SESSION_SECRET=[GERE UM SECRET RANDOM - veja abaixo]
GOOGLE_CLIENT_EMAIL=oddrive-backend@oddrive.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=[COLE A CHAVE DO SEU .ENV - com \n]
public_key=mltyemmj
Private_key=e9389577-fb30-4297-81eb-7acf508bc261
```

**Gerar SESSION_SECRET random:**
```bash
# No PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

#### Gerador (oddrive-gerador)

No painel do serviço, adicione:

```env
GOOGLE_CLIENT_ID=91797665925-7h92l9o1gl0i89sic1q4ck26n7c9e93t.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://oddrive-gerador.onrender.com/api/slides/oauth/callback
GOOGLE_TEMPLATE_ODIN_ID=1QMX_2VJW4Or8JJLOKQocra02Tkst-zLu3oR7ed1kIcs
GOOGLE_TEMPLATE_OD_VT_ID=1Gdwo0gYZMpcUmSdwYMVJmt4kxbVr9Ocmouzh140qHWE
GOOGLE_TEMPLATE_OD_DROP_ID=1qPkcUU_Zvk7QXhKwT9SE_BD2a1voH2YqZ1Kr7BGiUEM
GOOGLE_TEMPLATE_OD_PACK_ID=1SsX-Kr9eRIgnsTOwsO8-FfxGyNZ4xQpo2MnRdcKNyhg
GOOGLE_TEMPLATE_OD_FULL_ID=1YzuRvxW2fcH1nDTJX1IOr1A05t87A-tcol5Ic7gYeOc
GOOGLE_PRESENTATIONS_FOLDER_ID=1d0PfCcye-w4veGqnA_JVXk7CKzps3Ali
GOOGLE_DRIVE_ASSETS_FOLDER_ID=10_v5oRGmCu4CNHROE5jjt1MJtDmzymyd
```

#### Workspace (oddrive-workspace)

Após obter as URLs dos outros serviços, adicione (opcional):

```env
ENV_BACKEND_URL=https://oddrive-backend.onrender.com
ENV_GERADOR_URL=https://oddrive-gerador.onrender.com
```

### Passo 3: Monitorar Deploy

1. Render mostra logs em tempo real durante o build
2. Aguarde até aparecer **"Live"** em verde
3. Health checks devem ficar verdes após ~2-3 minutos
4. Teste cada URL gerada

### Passo 4: URLs de Acesso

Após deploy bem-sucedido:

```
🌐 Backend:   https://oddrive-backend.onrender.com
🌐 Gerador:   https://oddrive-gerador.onrender.com
🌐 Workspace: https://oddrive-workspace.onrender.com
```

**Login no workspace:**
- URL: `https://oddrive-workspace.onrender.com/login.html`
- Usuário: `admin`
- Senha: `admin123456789`

## 🌍 DOMÍNIO CUSTOMIZADO (oddrive.com.br)

### Opção 1: Subdomínios (RECOMENDADO)

Configuração mais simples e profissional.

#### No Render (cada serviço):

1. Vá em **Settings** → **Custom Domains**
2. Adicione:
   - Backend: `api.oddrive.com.br`
   - Gerador: `gerador.oddrive.com.br`
   - Workspace: `workspace.oddrive.com.br` ou `oddrive.com.br`
3. Render mostrará registros DNS para configurar

#### No Hostinger DNS:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| CNAME | api | oddrive-backend.onrender.com | 3600 |
| CNAME | gerador | oddrive-gerador.onrender.com | 3600 |
| CNAME | workspace | oddrive-workspace.onrender.com | 3600 |
| ALIAS/A | @ | [IP do Render - veja painel] | 3600 |

**Aguarde:** Propagação DNS leva 5min-24h (geralmente <1h).

### Opção 2: Path-based (oddrive.com.br/gerador)

Requer proxy (VPS ou serviço adicional) - mais complexo, **não recomendado**.

## 🔄 ATUALIZAÇÕES FUTURAS

### Método Simples (Upload Manual):

1. Faça alterações localmente
2. Vá ao GitHub → seu repositório
3. Navegue até o arquivo alterado
4. Clique em "Edit" (ícone lápis)
5. Cole o novo conteúdo
6. "Commit changes"
7. Render detecta e faz deploy automático

### Método Git (Recomendado):

```bash
# Fazer alterações no código
# ...

# Commitar mudanças
git add .
git commit -m "Descrição da alteração"

# Enviar para GitHub
git push origin main

# Render detecta automaticamente e faz deploy
```

### Rollback (Desfazer Deploy):

No painel do Render:
1. Vá em **"Events"** do serviço
2. Encontre o deploy anterior que funcionava
3. Clique em **"Rollback"**

## 💰 CUSTOS RENDER.COM

### Começar Grátis (Teste/MVP):
- Backend: **FREE** ($0/mês)
- Gerador: **FREE** ($0/mês)
- Workspace: **FREE** ($0/mês)
- **Total: $0/mês**

⚠️ Free tier "dorme" após 15min inatividade (leva 30s para acordar)

### Produção Recomendada:
- Backend: **STARTER** ($7/mês - sempre online)
- Gerador: **STARTER** ($7/mês - sempre online)
- Workspace: **FREE** ($0/mês - static sites nunca dormem)
- **Total: $14/mês (~R$85)**

### Upgrade (quando necessário):

No painel do serviço:
1. Vá em **Settings** → **Plan**
2. Escolha "Starter" ou superior
3. Confirme pagamento

## 🐛 TROUBLESHOOTING

### Erro: "Build failed"
- Verifique logs no painel do Render
- Confirme que `package.json` existe na pasta correta
- Teste build localmente: `npm install && npm run build`

### Erro: "Service Unavailable"
- Aguarde ~2-3 minutos após deploy
- Verifique health check no painel
- Veja logs em tempo real: clique em "Logs"

### Erro: "Cannot find module"
- Build command pode estar errado no `render.yaml`
- Confirme `rootDir` e caminhos relativos
- Tente "Manual Deploy" com "Clear build cache"

### Login não funciona
- Verifique que MONGO_URI está configurado no Render
- Teste conexão MongoDB Atlas (whitelist IP 0.0.0.0/0)
- Veja logs do backend para erros de autenticação

### CORS errors no frontend
- Backend deve aceitar origin do workspace
- Verifique configuração de CORS no backend/server.js
- Use URLs absolutas (https://...) não relativas

## 📞 SUPORTE

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **MongoDB Atlas**: https://cloud.mongodb.com
- **Google Cloud Console**: https://console.cloud.google.com

## ✅ CHECKLIST FINAL

Antes de considerar completo:

- [ ] Arquivo `.env` NÃO está no GitHub
- [ ] `.gitignore` protege segredos
- [ ] `render.yaml` está no repositório
- [ ] Código enviado para GitHub (push feito)
- [ ] Blueprint aplicado no Render (3 serviços criados)
- [ ] Todas as env vars configuradas no painel
- [ ] Health checks verdes (serviços "Live")
- [ ] Login funciona no workspace
- [ ] Backend responde APIs
- [ ] Gerador acessa Google Drive
- [ ] (Opcional) Domínios customizados configurados
- [ ] (Opcional) Upgrade para Starter se necessário

---

**Pronto para produção! 🎉**

Qualquer dúvida durante o deploy, consulte os logs do Render ou este README.
