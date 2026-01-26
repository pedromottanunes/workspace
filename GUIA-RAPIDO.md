# 📋 GUIA RÁPIDO - AWS EC2 DEPLOY

## ✅ O QUE FOI FEITO

### Removido (Específico do Render)
- ❌ `render.yaml` (raiz e gerador)
- ❌ `README-DEPLOY.md`, `CHECKLIST-DEPLOY.md`, `RESUMO-DEPLOY.md`
- ❌ Scripts: `render-setup.js`, `render-monitor.js`, `render-monitor.ps1`
- ❌ URLs hardcoded do Render em `server.js`

### Adicionado (AWS EC2)
- ✅ `README-AWS-EC2.md` - Guia completo de deploy
- ✅ `setup-server.sh` - Script de setup inicial
- ✅ `deploy.sh` - Script de atualização rápida
- ✅ `.env.example` atualizados (backend e gerador)
- ✅ Código atualizado para usar variáveis de ambiente

---

## 🚀 PRÓXIMOS PASSOS

### 1️⃣ SOLICITAR CREDENCIAIS AWS CORRETAS

As credenciais que você recebeu (User/Password/Console) servem apenas para **acessar o painel AWS**.

**Solicite ao responsável AWS:**

```
Preciso dos seguintes acessos para fazer deploy no EC2:

1. IP público do servidor EC2: _____________
2. Chave SSH (.pem) para acessar o servidor
3. Confirmar que as seguintes portas estão abertas no Security Group:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)
   - 5173 (API Gerador)
   - 5174 (Backend)
4. Usuário SSH (geralmente "ubuntu" ou "ec2-user")
```

### 2️⃣ QUANDO RECEBER OS ACESSOS

**Abra o arquivo:** [README-AWS-EC2.md](README-AWS-EC2.md)

Ele contém:
- ✅ Guia passo-a-passo completo
- ✅ Comandos prontos para copiar/colar
- ✅ Checklist de verificação
- ✅ Troubleshooting

---

## 📝 RESUMO DO PROCESSO

1. **Conectar ao EC2 via SSH**
   ```bash
   ssh -i sua-chave.pem ubuntu@IP_DO_EC2
   ```

2. **Executar script de setup** (primeira vez)
   ```bash
   cd ~/apps/oddrive
   ./setup-server.sh
   ```

3. **Configurar variáveis de ambiente**
   - Backend: `~/apps/oddrive/gerenciador-de-campanhas/.env`
   - Gerador: `~/apps/oddrive/gerador-de-orcamentos/.env`

4. **Testar**
   - Workspace: `http://IP_DO_EC2/`
   - Backend: `http://IP_DO_EC2:5174/api/session/health`
   - Gerador: `http://IP_DO_EC2:5173/health`

5. **Atualizações futuras**
   ```bash
   cd ~/apps/oddrive
   ./deploy.sh
   ```

---

## 🆘 DÚVIDAS?

1. Leia: [README-AWS-EC2.md](README-AWS-EC2.md)
2. Verifique os logs no servidor:
   ```bash
   pm2 logs
   ```
3. Me envie prints da interface AWS que vou te guiar!

---

## 📂 ESTRUTURA DE ARQUIVOS

```
WORKSPACE GITHUB/
├── README-AWS-EC2.md          ← GUIA COMPLETO
├── GUIA-RAPIDO.md             ← Este arquivo
├── setup-server.sh            ← Setup inicial (execute no servidor)
├── deploy.sh                  ← Atualizações (execute no servidor)
│
├── gerenciador-de-campanhas/
│   ├── .env.example           ← Template atualizado
│   └── backend/
│       └── server.js          ← Código atualizado (sem Render)
│
├── gerador-de-orcamentos/
│   ├── .env.example           ← Template atualizado
│   └── server/
│
└── workspace/                 ← Frontend estático
```

---

**Pronto! O código está preparado para AWS EC2! 🎉**

Agora é só seguir o README-AWS-EC2.md quando tiver as credenciais corretas.
