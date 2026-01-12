const express = require('express');
const { buildGoogleConfig } = require('../../src/lib/google/config');

function normalizeConfig(payload = {}) {
  const cleaned = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'publicShare') {
      cleaned.publicShare = Boolean(value);
      return;
    }

    if (value === undefined || value === null) {
      return;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length) {
        cleaned[key] = trimmed;
      }
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned;
}

module.exports = function buildSettingsRouter(store) {
  const router = express.Router();

  router.get('/google', async (req, res) => {
    const stored = (await store.get('googleConfig')) || {};
    res.json({
      success: true,
      stored,
      effective: buildGoogleConfig(stored),
      defaults: buildGoogleConfig({})
    });
  });

  router.post('/google', async (req, res) => {
    const payload = normalizeConfig(req.body || {});
    await store.set('googleConfig', payload);
    res.json({
      success: true,
      effective: buildGoogleConfig(payload)
    });
  });

  return router;
};
