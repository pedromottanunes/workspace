const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class DataStore {
  constructor(filePath, defaults = {}) {
    this.filePath = filePath;
    this.defaults = defaults;
    this.data = null;
    this.readyPromise = null;
  }

  async ensureReady() {
    if (!this.readyPromise) {
      this.readyPromise = this.load();
    }
    return this.readyPromise;
  }

  async load() {
    const dir = path.dirname(this.filePath);
    await fsp.mkdir(dir, { recursive: true });

    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.data = { ...this.defaults };
        await this.save();
      } else {
        console.error('[DataStore] Falha ao ler arquivo:', error);
        this.data = { ...this.defaults };
      }
    }

    return this.data;
  }

  async save() {
    if (!this.data) {
      this.data = { ...this.defaults };
    }

    const tmpPath = `${this.filePath}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fsp.rename(tmpPath, this.filePath);
  }

  async get(key, fallback = undefined) {
    await this.ensureReady();
    if (!key) return this.data;
    const value = key.split('.').reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
        return acc[part];
      }
      return undefined;
    }, this.data);
    return value === undefined ? fallback : value;
  }

  async set(key, value) {
    await this.ensureReady();
    if (!key) {
      this.data = value;
    } else {
      const parts = key.split('.');
      let cursor = this.data;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!cursor[part] || typeof cursor[part] !== 'object') {
          cursor[part] = {};
        }
        cursor = cursor[part];
      }
      cursor[parts[parts.length - 1]] = value;
    }
    await this.save();
    return value;
  }

  async update(key, updater) {
    await this.ensureReady();
    const current = await this.get(key);
    const nextValue = typeof updater === 'function' ? updater(current) : updater;
    await this.set(key, nextValue);
    return nextValue;
  }
}

module.exports = DataStore;
