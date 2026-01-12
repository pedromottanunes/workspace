# ✅ CHECKLIST - PREPARAÇÃO PARA DEPLOY

## ANTES DE SUBIR NO GITHUB

### Segurança (CRÍTICO!)
- [ ] Arquivo `.env` NÃO está incluído (verificar com `git status`)
- [ ] Arquivo `.gitignore` existe na raiz do projeto
- [ ] Chaves privadas/certificados estão no `.gitignore`
- [ ] Não há senhas hardcoded no código
- [ ] `.env.example` tem apenas placeholders, sem valores reais

### Arquivos Necessários
- [ ] `.gitignore` criado na raiz
- [ ] `render.yaml` criado na raiz
- [ ] `README-DEPLOY.md` criado na raiz
- [ ] `workspace/assets/config.js` criado
- [ ] `.env.example` em `gerenciador de Campanhas/`
- [ ] `.env.example` em `Gerador de Orçamentos/`

### Código Atualizado
- [ ] `workspace/assets/login.js` usa `WORKSPACE_CONFIG`
- [ ] `workspace/assets/workspace.js` usa `WORKSPACE_CONFIG`
- [ ] `workspace/login.html` carrega `config.js`
- [ ] `workspace/index.html` carrega `config.js`

## UPLOAD NO GITHUB

### Opção Manual
- [ ] Pasta compactada (opcional)
- [ ] Acessou repositório no GitHub
- [ ] Upload feito via "Add file" → "Upload files"
- [ ] Commit com mensagem: "Initial commit - Workspace Unificado"

### Opção Git CLI
- [ ] `git init` executado
- [ ] `git add .` executado
- [ ] `git commit -m "..."` executado
- [ ] `git remote add origin ...` executado
- [ ] `git push -u origin main` executado

## DEPLOY NO RENDER

### Conexão
- [ ] Conta criada em render.com
- [ ] GitHub conectado ao Render
- [ ] Blueprint criado apontando para o repositório
- [ ] `render.yaml` detectado automaticamente

### Backend (oddrive-backend)
- [ ] Serviço criado
- [ ] `MONGO_URI` configurado
- [ ] `SESSION_SECRET` configurado (random)
- [ ] `GOOGLE_CLIENT_EMAIL` configurado
- [ ] `GOOGLE_PRIVATE_KEY` configurado (com \n)
- [ ] `public_key` configurado
- [ ] `Private_key` configurado
- [ ] Health check verde

### Gerador (oddrive-gerador)
- [ ] Serviço criado
- [ ] `GOOGLE_CLIENT_ID` configurado
- [ ] `GOOGLE_CLIENT_SECRET` configurado
- [ ] `GOOGLE_REDIRECT_URI` configurado (URL produção)
- [ ] Todos os `GOOGLE_TEMPLATE_*_ID` configurados
- [ ] `GOOGLE_PRESENTATIONS_FOLDER_ID` configurado
- [ ] `GOOGLE_DRIVE_ASSETS_FOLDER_ID` configurado
- [ ] Health check verde

### Workspace (oddrive-workspace)
- [ ] Serviço criado (static site)
- [ ] `ENV_BACKEND_URL` configurado (opcional)
- [ ] `ENV_GERADOR_URL` configurado (opcional)
- [ ] Status "Live"

## VALIDAÇÃO

### Testes Básicos
- [ ] Backend responde: `https://oddrive-backend.onrender.com/api/session/me`
- [ ] Gerador carrega: `https://oddrive-gerador.onrender.com/`
- [ ] Workspace carrega: `https://oddrive-workspace.onrender.com/`
- [ ] Login funciona no workspace
- [ ] Token passa entre serviços (workspace → backend)
- [ ] Gerador abre após login no workspace

### Logs
- [ ] Backend sem erros críticos nos logs
- [ ] Gerador sem erros críticos nos logs
- [ ] Workspace servindo arquivos estáticos

## PÓS-DEPLOY

### Domínios (Opcional)
- [ ] Domínios customizados adicionados no Render
- [ ] Registros DNS configurados no Hostinger
- [ ] Aguardado propagação DNS (até 24h)
- [ ] HTTPS funcionando (certificado automático)

### Upgrade (Opcional)
- [ ] Backend upgrade para Starter ($7/mês)
- [ ] Gerador upgrade para Starter ($7/mês)
- [ ] Pagamento configurado

### Monitoramento
- [ ] Render Dashboard favorito no navegador
- [ ] Notificações configuradas (email)
- [ ] URLs de produção salvas

## MANUTENÇÃO

### Atualizações Futuras
- [ ] Sei como fazer commit e push no GitHub
- [ ] Sei que Render faz deploy automático após push
- [ ] Sei como fazer rollback (Events → Rollback)
- [ ] Sei onde ver logs em tempo real

---

**Data de conclusão:** ___/___/______

**URLs finais:**
- Backend: ________________________________
- Gerador: ________________________________
- Workspace: ________________________________

**Notas:**
_________________________________________________
_________________________________________________
_________________________________________________
