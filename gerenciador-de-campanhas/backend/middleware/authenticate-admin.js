import { getAdminSession } from '../services/sessionStore.js';

export async function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  
  if (!token) {
    return res.status(401).json({ error: 'Autenticacao necessaria' });
  }

  const session = await getAdminSession(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada' });
  }

  // Adiciona dados do admin no request
  req.adminUser = {
    id: session.userId,
    username: session.username,
    name: session.name,
    role: session.role || 'admin',
    sessionToken: token,
  };

  next();
}

export async function optionalAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');
  
  if (!token) {
    req.adminUser = null;
    return next();
  }

  const session = await getAdminSession(token);
  
  if (!session) {
    req.adminUser = null;
    return next();
  }

  req.adminUser = {
    id: session.userId,
    username: session.username,
    name: session.name,
    role: session.role || 'admin',
    sessionToken: token,
  };

  next();
}
