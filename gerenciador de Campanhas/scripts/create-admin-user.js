import dotenv from 'dotenv';
// IMPORTANTE: carregar .env ANTES de importar qualquer módulo que use process.env
dotenv.config();

import { createInterface } from 'readline';
import bcrypt from 'bcrypt';
import { findAdminUserByUsername, createAdminUser } from '../backend/services/db.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    let password = '';
    process.stdin.on('data', (char) => {
      char = char.toString('utf8');
      
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007F') {
        password = password.slice(0, -1);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(prompt + '*'.repeat(password.length));
      } else {
        password += char;
        process.stdout.write('*');
      }
    });
  });
}

async function main() {
  console.log('\n========================================');
  console.log('   CRIAR USUARIO ADMINISTRADOR');
  console.log('========================================\n');

  const username = await question('Username (ex: maria): ');
  if (!username || username.trim() === '') {
    console.error('❌ Username é obrigatório.');
    process.exit(1);
  }

  const normalizedUsername = username.toLowerCase().trim();

  // Verifica se já existe
  try {
    const existing = await findAdminUserByUsername(normalizedUsername);
    if (existing) {
      console.error(`❌ Usuário "${normalizedUsername}" já existe!`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erro ao verificar usuário existente:', err.message);
    process.exit(1);
  }

  const name = await question('Nome completo (ex: Maria Silva): ');
  const email = await question('Email (opcional, Enter para pular): ');

  const password = await questionHidden('Senha (mínimo 6 caracteres): ');
  if (!password || password.length < 6) {
    console.error('\n❌ Senha deve ter no mínimo 6 caracteres.');
    process.exit(1);
  }

  const confirmPassword = await questionHidden('Confirme a senha: ');
  if (password !== confirmPassword) {
    console.error('\n❌ As senhas não coincidem.');
    process.exit(1);
  }

  console.log('\n⏳ Gerando hash da senha (bcrypt)...');
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('⏳ Criando usuário no MongoDB...');
  try {
    const user = await createAdminUser({
      username: normalizedUsername,
      passwordHash,
      name: name || normalizedUsername,
      email: email || null,
      role: 'admin',
      active: true,
      createdBy: 'script',
    });

    console.log('\n✅ Usuário criado com sucesso!\n');
    console.log('-------------------------------------');
    console.log(`  Username: ${user.username}`);
    console.log(`  Nome:     ${user.name}`);
    console.log(`  Email:    ${user.email || '(não informado)'}`);
    console.log(`  Role:     ${user.role}`);
    console.log(`  ID:       ${user._id}`);
    console.log('-------------------------------------\n');
    console.log('🔐 O usuário já pode fazer login no dashboard admin.\n');
  } catch (err) {
    console.error('\n❌ Erro ao criar usuário:', err.message);
    process.exit(1);
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
