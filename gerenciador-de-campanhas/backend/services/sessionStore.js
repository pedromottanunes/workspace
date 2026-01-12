/**
 * Armazenamento seguro de sessões em Redis com expiração automática.
 * Permite escalonamento horizontal e persistência entre reinícios.
 */
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';
// Enable Redis only when a REDIS_URL is provided and USE_REDIS is not explicitly 'false'
const USE_REDIS = !!REDIS_URL && process.env.USE_REDIS !== 'false';

let redis = null;

if (USE_REDIS) {
  try {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[sessionStore] Redis connection failed after 3 retries');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000); // exponential backoff
      },
    });
    redis.on('error', (err) => console.error('[sessionStore] Redis error:', err?.message || err));
    redis.on('connect', () => console.log('[sessionStore] Redis connected'));
  } catch (err) {
    console.error('[sessionStore] Failed to initialize Redis:', err?.message || err);
    redis = null;
  }
} else {
  console.log('[sessionStore] Redis disabled (no REDIS_URL or explicitly turned off)');
}

const ADMIN_SESSION_TTL_SEC = 24 * 60 * 60; // 24 horas
const USER_SESSION_TTL_SEC = 7 * 24 * 60 * 60; // 7 dias
const ADMIN_PREFIX = 'session:admin:';
const USER_PREFIX = 'session:user:';

// Fallback in-memory storage (usado se Redis não estiver disponível)
const memoryAdminSessions = new Map();
const memoryUserSessions = new Map();

/**
 * Cria uma nova sessão de administrador
 */
export async function createAdminSession(token, userData) {
  const now = Date.now();
  const session = {
    token,
    userId: userData.userId || userData.id,
    username: userData.username,
    name: userData.name,
    role: userData.role || 'admin',
    createdAt: now,
    lastAccessAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_SEC * 1000,
  };
  
  if (redis) {
    try {
      const key = `${ADMIN_PREFIX}${token}`;
      await redis.set(key, JSON.stringify(session), 'EX', ADMIN_SESSION_TTL_SEC);
    } catch (err) {
      console.error('[sessionStore] Redis error on createAdminSession:', err.message);
      memoryAdminSessions.set(token, session); // fallback
    }
  } else {
    memoryAdminSessions.set(token, session);
  }
  
  return session;
}

/**
 * Busca sessão de administrador
 */
export async function getAdminSession(token) {
  if (!token) return null;
  
  if (redis) {
    try {
      const key = `${ADMIN_PREFIX}${token}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      
      const session = JSON.parse(raw);
      
      // Verifica expiração
      if (session.expiresAt && session.expiresAt < Date.now()) {
        await redis.del(key);
        return null;
      }
      
      // Atualiza último acesso e renova TTL
      session.lastAccessAt = Date.now();
      await redis.set(key, JSON.stringify(session), 'EX', ADMIN_SESSION_TTL_SEC);
      
      return session;
    } catch (err) {
      console.error('[sessionStore] Redis error on getAdminSession:', err.message);
      // fallback to memory
      return memoryAdminSessions.get(token) || null;
    }
  }
  
  // Memory fallback
  const session = memoryAdminSessions.get(token);
  if (!session) return null;
  
  if (session.expiresAt && session.expiresAt < Date.now()) {
    memoryAdminSessions.delete(token);
    return null;
  }
  
  session.lastAccessAt = Date.now();
  return session;
}

/**
 * Remove sessão de administrador
 */
export async function deleteAdminSession(token) {
  if (!token) return false;
  
  if (redis) {
    try {
      const result = await redis.del(`${ADMIN_PREFIX}${token}`);
      return result > 0;
    } catch (err) {
      console.error('[sessionStore] Redis error on deleteAdminSession:', err.message);
      return memoryAdminSessions.delete(token);
    }
  }
  
  return memoryAdminSessions.delete(token);
}

/**
 * Lista todas as sessões de administrador ativas
 */
export async function listAdminSessions() {
  if (redis) {
    try {
      const keys = await redis.keys(`${ADMIN_PREFIX}*`);
      const sessions = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (raw) {
          const session = JSON.parse(raw);
          if (!session.expiresAt || session.expiresAt >= Date.now()) {
            sessions.push(session);
          }
        }
      }
      return sessions;
    } catch (err) {
      console.error('[sessionStore] Redis error on listAdminSessions:', err.message);
      const now = Date.now();
      return Array.from(memoryAdminSessions.values()).filter(
        s => !s.expiresAt || s.expiresAt >= now
      );
    }
  }
  
  const now = Date.now();
  return Array.from(memoryAdminSessions.values()).filter(
    s => !s.expiresAt || s.expiresAt >= now
  );
}

/**
 * Cria uma nova sessão de usuário (motorista/arte)
 */
export async function createUserSession(token, userData) {
  const now = Date.now();
  const session = {
    token,
    userId: userData.userId || userData.id,
    name: userData.name,
    type: userData.type, // 'driver' ou 'graphic'
    role: userData.type, // Compatibilidade com código legado
    driverId: userData.type === 'driver' ? userData.userId : null, // Compatibilidade
    campaignId: userData.campaignId,
    identity: userData.identity, // CPF, placa, etc
    meta: {
      graphicId: userData.type === 'graphic' ? userData.userId : null,
      graphicName: userData.type === 'graphic' ? userData.name : null,
      responsibleName: userData.type === 'graphic' ? userData.name : null,
    },
    createdAt: now,
    lastAccessAt: now,
    expiresAt: now + USER_SESSION_TTL_SEC * 1000,
  };
  
  if (redis) {
    try {
      const key = `${USER_PREFIX}${token}`;
      await redis.set(key, JSON.stringify(session), 'EX', USER_SESSION_TTL_SEC);
    } catch (err) {
      console.error('[sessionStore] Redis error on createUserSession:', err.message);
      memoryUserSessions.set(token, session);
    }
  } else {
    memoryUserSessions.set(token, session);
  }
  
  return session;
}

/**
 * Busca sessão de usuário
 */
export async function getUserSession(token) {
  if (!token) return null;
  
  if (redis) {
    try {
      const key = `${USER_PREFIX}${token}`;
      const raw = await redis.get(key);
      if (!raw) return null;
      
      const session = JSON.parse(raw);
      
      // Verifica expiração
      if (session.expiresAt && session.expiresAt < Date.now()) {
        await redis.del(key);
        return null;
      }
      
      // Atualiza último acesso e renova TTL
      session.lastAccessAt = Date.now();
      await redis.set(key, JSON.stringify(session), 'EX', USER_SESSION_TTL_SEC);
      
      return session;
    } catch (err) {
      console.error('[sessionStore] Redis error on getUserSession:', err.message);
      return memoryUserSessions.get(token) || null;
    }
  }
  
  const session = memoryUserSessions.get(token);
  if (!session) return null;
  
  if (session.expiresAt && session.expiresAt < Date.now()) {
    memoryUserSessions.delete(token);
    return null;
  }
  
  session.lastAccessAt = Date.now();
  return session;
}

/**
 * Remove sessão de usuário
 */
export async function deleteUserSession(token) {
  if (!token) return false;
  
  if (redis) {
    try {
      const result = await redis.del(`${USER_PREFIX}${token}`);
      return result > 0;
    } catch (err) {
      console.error('[sessionStore] Redis error on deleteUserSession:', err.message);
      return memoryUserSessions.delete(token);
    }
  }
  
  return memoryUserSessions.delete(token);
}

/**
 * Lista todas as sessões de usuário ativas
 */
export async function listUserSessions() {
  if (redis) {
    try {
      const keys = await redis.keys(`${USER_PREFIX}*`);
      const sessions = [];
      for (const key of keys) {
        const raw = await redis.get(key);
        if (raw) {
          const session = JSON.parse(raw);
          if (!session.expiresAt || session.expiresAt >= Date.now()) {
            sessions.push(session);
          }
        }
      }
      return sessions;
    } catch (err) {
      console.error('[sessionStore] Redis error on listUserSessions:', err.message);
      const now = Date.now();
      return Array.from(memoryUserSessions.values()).filter(
        s => !s.expiresAt || s.expiresAt >= now
      );
    }
  }
  
  const now = Date.now();
  return Array.from(memoryUserSessions.values()).filter(
    s => !s.expiresAt || s.expiresAt >= now
  );
}

/**
 * Remove todas as sessões (usado em testes/manutenção)
 */
export async function clearAllSessions() {
  if (redis) {
    try {
      const adminKeys = await redis.keys(`${ADMIN_PREFIX}*`);
      const userKeys = await redis.keys(`${USER_PREFIX}*`);
      const all = [...adminKeys, ...userKeys];
      if (all.length > 0) {
        await redis.del(...all);
      }
    } catch (err) {
      console.error('[sessionStore] Redis error on clearAllSessions:', err.message);
    }
  }
  
  memoryAdminSessions.clear();
  memoryUserSessions.clear();
}

/**
 * Estatísticas do armazenamento de sessões
 */
export async function getSessionStats() {
  if (redis) {
    try {
      const adminKeys = await redis.keys(`${ADMIN_PREFIX}*`);
      const userKeys = await redis.keys(`${USER_PREFIX}*`);
      return {
        adminSessions: adminKeys.length,
        userSessions: userKeys.length,
        total: adminKeys.length + userKeys.length,
        storage: 'redis',
      };
    } catch (err) {
      console.error('[sessionStore] Redis error on getSessionStats:', err.message);
    }
  }
  
  return {
    adminSessions: memoryAdminSessions.size,
    userSessions: memoryUserSessions.size,
    total: memoryAdminSessions.size + memoryUserSessions.size,
    storage: 'memory',
  };
}
