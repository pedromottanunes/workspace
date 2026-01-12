#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getStagedFiles(){
  try{
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    return out.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  }catch(e){
    console.error('Erro ao listar arquivos staged:', e.message || e);
    process.exit(1);
  }
}

const patterns = [
  { name: 'PRIVATE KEY', re: /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/i },
  { name: 'MONGO URI with password', re: /mongodb\+srv:\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'REDIS URL with password', re: /redis:\/\/[^:\s]+:[^@\s]+@/i },
  { name: 'GOOGLE PRIVATE KEY ENV', re: /GOOGLE_PRIVATE_KEY\s*=\s*"?-----BEGIN PRIVATE KEY-----/i },
];

function scanFile(file){
  try{
    const content = fs.readFileSync(file, { encoding: 'utf8' });
    for(const p of patterns){
      if(p.re.test(content)){
        return { file, matched: p.name };
      }
    }
    return null;
  }catch(e){
    return null; // binary or unreadable
  }
}

const files = getStagedFiles();
// Ignore our own scanner, husky hooks and common binary folders
const IGNORED_PATH_PARTS = ['scripts/secret-scan.cjs', 'scripts/secret-scan.js', '.husky/', 'node_modules/', '.git/'];
if(files.length === 0){
  process.exit(0);
}

const findings = [];
for(const f of files){
  // skip ignored paths
  const skip = IGNORED_PATH_PARTS.some(part => f.includes(part));
  if(skip) continue;
  const filePath = path.resolve(f);
  if(!fs.existsSync(filePath)) continue;
  const r = scanFile(filePath);
  if(r) findings.push(r);
}

if(findings.length){
  console.error('\nSecret scan failed — patterns found in staged files:');
  for(const it of findings){
    console.error(` - ${it.file}: ${it.matched}`);
  }
  console.error('\nRemove secrets from staged files or unstage them before committing.');
  process.exit(1);
}

process.exit(0);
