# ⚠️ ARQUIVOS .ENV DETECTADOS - AÇÃO NECESSÁRIA

## 🔴 SITUAÇÃO ATUAL

O script `verificar-segredos.ps1` detectou arquivos que **NÃO DEVEM** ser enviados ao GitHub:

### Arquivos .env (contêm credenciais):
- `Gerador de Orçamentos\.env`
- `gerenciador de Campanhas\.env`

### Certificados:
- `gerenciador de Campanhas\backend\certs\oddrive-local.pfx`

## ✅ SOLUÇÃO

### Opção 1: Manter arquivos localmente (RECOMENDADO)

Os arquivos `.env` e certificados estão protegidos pelo `.gitignore` e **NÃO serão enviados** ao GitHub automaticamente se você usar Git CLI:

```bash
git add .
git commit -m "Initial commit"
git push
```

O `.gitignore` garante que eles fiquem apenas no seu computador.

### Opção 2: Upload manual no GitHub (Cuidado!)

Se você fizer upload manualmente pelo navegador:

1. **NÃO selecione** as pastas que contêm `.env`:
   - Não selecione `Gerador de Orçamentos/` completamente
   - Não selecione `gerenciador de Campanhas/` completamente

2. **Ou** faça upload e depois delete os arquivos:
   - Após upload, navegue até os arquivos .env no GitHub
   - Clique nos 3 pontinhos → Delete file
   - Commit a remoção

### Opção 3: Remover temporariamente (Mais seguro para upload manual)

Antes de fazer upload manual:

1. Mova os arquivos `.env` para fora da pasta:
```powershell
Move-Item "Gerador de Orçamentos\.env" "C:\Temp\env-gerador.env.backup"
Move-Item "gerenciador de Campanhas\.env" "C:\Temp\env-backend.env.backup"
```

2. Faça o upload no GitHub

3. Restaure os arquivos após o upload:
```powershell
Move-Item "C:\Temp\env-gerador.env.backup" "Gerador de Orçamentos\.env"
Move-Item "C:\Temp\env-backend.env.backup" "gerenciador de Campanhas\.env"
```

## 📋 CONFIGURAR NO RENDER

Após fazer deploy, você precisará configurar manualmente as variáveis de ambiente no painel do Render usando os valores dos seus arquivos `.env` locais.

### Backend (oddrive-backend):

Copie os valores de `gerenciador de Campanhas\.env`:
- MONGO_URI
- SESSION_SECRET
- GOOGLE_CLIENT_EMAIL
- GOOGLE_PRIVATE_KEY
- public_key
- Private_key

### Gerador (oddrive-gerador):

Copie os valores de `Gerador de Orçamentos\.env`:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI (ajuste URL para produção)
- GOOGLE_TEMPLATE_* (todos os IDs)
- GOOGLE_PRESENTATIONS_FOLDER_ID
- GOOGLE_DRIVE_ASSETS_FOLDER_ID

## 🛡️ POR QUE ISSO É IMPORTANTE?

- ✅ `.gitignore` protege automaticamente (Git CLI)
- ⚠️ Upload manual pode acidentalmente incluir arquivos
- 🔒 Credenciais no GitHub = **risco de segurança grave**
- 💰 Alguém pode usar suas credenciais para acessar MongoDB, Google Drive, etc.

## ✅ VERIFICAÇÃO FINAL

Após fazer upload, verifique no GitHub:

1. Vá ao seu repositório
2. Navegue até `Gerador de Orçamentos/`
3. **NÃO deve aparecer** arquivo `.env` (apenas `.env.example`)
4. Navegue até `gerenciador de Campanhas/`
5. **NÃO deve aparecer** arquivo `.env` (apenas `.env.example`)

Se aparecer `.env`, delete imediatamente:
- Clique no arquivo → 3 pontinhos → Delete file

## 📞 PRÓXIMOS PASSOS

1. Escolha uma das opções acima
2. Faça upload no GitHub
3. Verifique que `.env` não está no repositório
4. Configure variáveis no Render usando `README-DEPLOY.md`

---

**Lembre-se:** `.env.example` (templates) DEVEM ir pro GitHub. Apenas `.env` (valores reais) não deve.
