import { nanoid } from 'nanoid';
import { STATUS, normalizeStatus, normalizeName } from './normalize.js';

function sanitizeDigits(value) {
  return value ? String(value).replace(/\D+/g, '') : '';
}

function sanitizePlate(value) {
  return value ? String(value).replace(/[^a-z0-9]/gi, '').toUpperCase() : '';
}

function sanitizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : '';
}

export function createStatusCounter() {
  return STATUS.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
}

export function resolveSheetName(name, fallback) {
  const base = (name || fallback || '').trim();
  if (!base) return fallback || '';
  const lower = base.toLowerCase();
  if (lower === 'pagina1' || lower === 'p\u00E1gina1') return 'P\u00E1gina1';
  return base;
}

export function buildDriversFromRows(rows, { campaignId, now, previousDrivers = [] }) {
  const result = {
    drivers: [],
    counts: createStatusCounter(),
    imported: 0,
    review: 0,
    reviewEntries: [],
  };

  const previousMap = new Map(
    previousDrivers.map(driver => [
      driver.nameKey || normalizeName(driver.name),
      driver,
    ]),
  );

  rows.forEach((row, index) => {
    const name =
      row['Nome'] ||
      row['NOME'] ||
      row['name'] ||
      row['nome'] ||
      row['Motorista'] ||
      '';

    if (!name) return;

    const nameKey = normalizeName(name);
    const previous = previousMap.get(nameKey);

    const rowNumber =
      row.__rowNumber ||
      previous?.rowNumber ||
      index + 2; // inclui cabecalho
    const raw = { ...row };
    delete raw.__rowNumber;

    const city = row['Cidade'] || row['CIDADE'] || row['cidade'] || '';
    const pix = row['PIX'] || row['Pix'] || row['pix'] || '';
    const statusRaw = row['Status'] || row['STATUS'] || row['status'] || '';
    const status = normalizeStatus(statusRaw);
    const phoneValue =
      row['Numero'] ||
      row['Numero '] ||
      row['Número'] ||
      row['N\u00FAmero'] ||
      row['telefone'] ||
      row['Telefone'] ||
      row['CELULAR'] ||
      row['Celular'] ||
      row['WhatsApp'] ||
      '';
    const cpfValue = row['CPF'] || row['Cpf'] || row['cpf'] || '';
    const plateValue = row['Placa'] || row['placa'] || row['PLACA'] || '';
    const emailValue = row['Email'] || row['EMAIL'] || row['email'] || '';

    const driverId = previous?.id || nanoid();

    const driver = {
      id: driverId,
      campaignId,
      name,
      nameKey,
      city,
      pix,
      status,
      statusRaw,
      phone: phoneValue || '',
      phoneDigits: sanitizeDigits(phoneValue),
      cpf: sanitizeDigits(cpfValue),
      plate: sanitizePlate(plateValue),
      email: sanitizeEmail(emailValue),
      rowNumber,
      raw,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };

    if (previous?.km) driver.km = previous.km;
    if (previous?.adh) driver.adh = previous.adh;
    if (previous?._CPF_HASH) driver._CPF_HASH = previous._CPF_HASH;
    if (previous?._InviteLink) driver._InviteLink = previous._InviteLink;

    result.drivers.push(driver);
    result.counts[status] = (result.counts[status] || 0) + 1;

    if (status === 'revisar') {
      result.review += 1;
      result.reviewEntries.push({
        id: nanoid(),
        type: 'STATUS_INVALIDO',
        campaignId,
        driverId,
        driverName: name,
        column: 'Status',
        value: statusRaw || '',
        rowNumber,
        createdAt: now,
        note: statusRaw
          ? `Status "${statusRaw}" fora do padrao`
          : 'Status vazio ou invalido',
      });
    } else {
      result.imported += 1;
    }

    previousMap.delete(nameKey);
  });

  result.review = result.reviewEntries.length;
  return result;
}

