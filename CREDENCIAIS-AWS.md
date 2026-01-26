# 🔐 CREDENCIAIS AWS - O QUE VOCÊ TEM vs O QUE PRECISA

## 📋 O QUE VOCÊ RECEBEU

✅ **User name** - Nome de usuário para acessar console AWS  
✅ **Password** - Senha para acessar console AWS  
✅ **Console sign-in URL** - Link para fazer login (ex: https://123456789.signin.aws.amazon.com/console)

### ⚠️ IMPORTANTE
Essas credenciais servem **APENAS** para acessar a interface web da AWS (console). Elas **NÃO** permitem fazer deploy automatizado!

---

## 🎯 O QUE VOCÊ PRECISA PARA DEPLOY

Para fazer deploy do projeto no EC2, você precisa de:

### 1️⃣ Informações do Servidor EC2
- **IP Público** (ex: `54.123.45.67`)
- **Região** (ex: `us-east-1`, `sa-east-1`)
- **ID da Instância** (ex: `i-0123456789abcdef`)

### 2️⃣ Acesso SSH
- **Arquivo .pem** (chave privada)
- **Usuário SSH** (geralmente `ubuntu` ou `ec2-user`)

### 3️⃣ Security Group Configurado
Portas que precisam estar abertas:
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)
- 5173 (API Gerador)
- 5174 (Backend)

---

## 📱 COMO OBTER O QUE FALTA

### Opção 1: Você Mesmo (Usando as Credenciais)

1. **Acesse o Console AWS**
   - Entre no link fornecido (Console sign-in URL)
   - Use User name e Password

2. **Navegue até EC2**
   - No menu superior, busque por "EC2"
   - Clique em "Instâncias (Instances)"

3. **Localize a Instância do Projeto**
   - Você verá uma lista de servidores
   - Identifique qual é o servidor do projeto OD Drive
   - **Me envie um print desta tela!**

4. **Informações Importantes**
   - Anote o **IP Público** (coluna IPv4 público)
   - Anote o **Nome da instância**
   - Anote o **Estado** (deve estar "Em execução")

5. **Security Group**
   - Clique na instância
   - Na aba "Segurança"
   - Clique no Security Group
   - **Me envie um print das regras de entrada (Inbound rules)**

6. **Chave SSH (.pem)**
   - Se você não tem o arquivo `.pem`:
   - Pergunte ao responsável AWS onde está
   - ⚠️ A chave é criada na criação da instância e não pode ser baixada depois

---

### Opção 2: Solicitar ao Responsável AWS

Envie esta mensagem para o responsável:

```
Olá! Preciso das seguintes informações para fazer deploy do projeto OD Drive no servidor EC2:

1. IP público da instância EC2
2. Arquivo .pem (chave SSH) para acesso ao servidor
3. Usuário SSH (ubuntu ou ec2-user?)
4. Confirmar que as seguintes portas estão abertas no Security Group:
   - 22 (SSH)
   - 80 (HTTP)
   - 443 (HTTPS)
   - 5173 (API - Gerador de Orçamentos)
   - 5174 (API - Backend)

Com essas informações, consigo fazer o deploy seguindo a documentação.

Obrigado!
```

---

## 🖼️ PRINTS ÚTEIS PARA ME ENVIAR

Quando acessar o console AWS, envie prints de:

1. **Lista de Instâncias EC2**
   - EC2 > Instâncias
   - Mostre as colunas: Nome, ID, Estado, IP Público

2. **Detalhes da Instância**
   - Clique na instância do projeto
   - Mostre a aba "Detalhes"

3. **Security Group - Regras de Entrada**
   - Dentro da instância > Segurança > Security Group
   - Mostre as "Regras de entrada" (Inbound rules)

4. **Pares de Chaves**
   - EC2 > Rede e segurança > Pares de chaves
   - Mostre qual chave está associada à instância

---

## 💡 DICAS

### Como Saber se a Porta Está Aberta?

Na aba **Security Group > Inbound rules**, você deve ver algo assim:

```
Tipo         Protocolo   Intervalo de portas   Origem
SSH          TCP         22                    0.0.0.0/0
HTTP         TCP         80                    0.0.0.0/0
HTTPS        TCP         443                   0.0.0.0/0
TCP          TCP         5173                  0.0.0.0/0
TCP          TCP         5174                  0.0.0.0/0
```

Se alguma porta estiver faltando, precisa ser adicionada!

### O Servidor Já Está Criado?

O responsável AWS disse que "com essas credenciais você consegue fazer deploy", então provavelmente:
- ✅ O servidor EC2 já existe
- ✅ Está configurado e rodando
- ⚠️ Mas você precisa dos dados de acesso SSH

---

## 📞 PRÓXIMO PASSO

**Escolha uma opção:**

1. **Acessar você mesmo** → Entre no console AWS e me envie os prints
2. **Solicitar ao responsável** → Use a mensagem modelo acima

Quando tiver as informações, volte aqui e siga o [README-AWS-EC2.md](README-AWS-EC2.md)!
