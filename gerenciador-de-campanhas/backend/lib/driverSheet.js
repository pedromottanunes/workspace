import { normalizeMasterKey } from './masterHeader.js';

export function mergeDriverRawSources(driver) {
  const raw = { ...(driver?.raw || {}) };
  if (driver?.km && driver.km.raw && typeof driver.km.raw === 'object') {
    for (const [key, value] of Object.entries(driver.km.raw)) {
      if (raw[key] === undefined || raw[key] === null || String(raw[key]).trim() === '') {
        raw[key] = value;
      }
    }
  }
  return raw;
}

export function applyCanonicalRaw(driver) {
  if (!driver) return {};
  const raw = mergeDriverRawSources(driver);

  const set = (key, value, { overwrite = false } = {}) => {
    if (value === undefined || value === null) return;
    if (!overwrite) {
      const current = raw[key];
      if (current !== undefined && current !== null && String(current).trim() !== '') return;
    }
    raw[key] = value;
  };

  set('DRIVER ID', driver.id, { overwrite: true });
  set('Nome', driver.name || '', { overwrite: true });
  set('Cidade', driver.city || '');
  set('Status', driver.statusRaw || driver.status || '');
  set('PIX', driver.pix || '');
  if (driver.email) set('Email', driver.email, { overwrite: true });
  if (driver.cpf) set('CPF', driver.cpf, { overwrite: true });
  if (driver.plate) set('Placa', driver.plate, { overwrite: true });
  if (driver.phone) {
    set('Numero', driver.phone, { overwrite: true });
    set('Telefone', driver.phone, { overwrite: true });
  }

  if (driver.km && driver.km.total) {
    const total = driver.km.total;
    if (total.kmRodado !== undefined && total.kmRodado !== null) {
      set('KM RODADO TOTAL', total.kmRodado, { overwrite: true });
    }
    if (total.metaKm !== undefined && total.metaKm !== null) {
      set('META KM TOTAL', total.metaKm, { overwrite: true });
    }
    if (total.status !== undefined && total.status !== null) {
      set('STATUS TOTAL', total.status, { overwrite: true });
    }
    if (total.percent !== undefined && total.percent !== null && total.metaKm) {
      const percent = Number.isFinite(total.percent) ? Math.round(total.percent) : total.percent;
      set('PERCENT TOTAL', percent, { overwrite: true });
    }
  }

  raw['_ATUALIZADO EM'] = new Date().toISOString();
  raw['_ORIGEM'] = driver._origin || 'ADMIN';

  driver.raw = raw;
  if (driver.km) {
    driver.km.raw = { ...(driver.km.raw || {}), ...raw };
  }
  return raw;
}

export function buildSheetRowValues(header = [], driver) {
  const raw = applyCanonicalRaw(driver);
  const normalized = new Map();
  Object.entries(raw).forEach(([key, value]) => {
    normalized.set(normalizeMasterKey(key), value);
  });

  return header.map(col => {
    const value = raw[col];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    const alt = normalized.get(normalizeMasterKey(col));
    if (alt !== undefined && alt !== null) return alt;
    return '';
  });
}

export default {
  applyCanonicalRaw,
  buildSheetRowValues,
  mergeDriverRawSources,
};
