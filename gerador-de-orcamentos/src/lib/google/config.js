const INTERNAL_PRODUCT_ID = 'od-in';
const EXTERNAL_PRODUCT_IDS = ['od-vt', 'od-drop', 'od-pack', 'od-full'];
const ALLOWED_PRODUCT_IDS = [INTERNAL_PRODUCT_ID, ...EXTERNAL_PRODUCT_IDS];

function buildGoogleConfig(overrides = {}) {
  const normalized = overrides || {};
  const productOverrides = normalized.templateProductIds || {};

  const templateProductIds = {
    [INTERNAL_PRODUCT_ID]:
      productOverrides[INTERNAL_PRODUCT_ID] ||
      normalized.templateOdInId ||
      process.env.GOOGLE_TEMPLATE_ODIN_ID ||
      '',
    'od-vt':
      productOverrides['od-vt'] ||
      normalized.templateOdVtId ||
      process.env.GOOGLE_TEMPLATE_OD_VT_ID ||
      '',
    'od-drop':
      productOverrides['od-drop'] ||
      normalized.templateOdDropId ||
      process.env.GOOGLE_TEMPLATE_OD_DROP_ID ||
      '',
    'od-pack':
      productOverrides['od-pack'] ||
      normalized.templateOdPackId ||
      process.env.GOOGLE_TEMPLATE_OD_PACK_ID ||
      '',
    'od-full':
      productOverrides['od-full'] ||
      normalized.templateOdFullId ||
      process.env.GOOGLE_TEMPLATE_OD_FULL_ID ||
      ''
  };

  const templatePresentationId =
    normalized.templatePresentationId ||
    process.env.GOOGLE_TEMPLATE_PRESENTATION_ID ||
    templateProductIds[INTERNAL_PRODUCT_ID] ||
    '';

  const credentials = {
    clientId:
      normalized.clientId ||
      normalized.googleClientId ||
      process.env.GOOGLE_CLIENT_ID ||
      '',
    clientSecret:
      normalized.clientSecret ||
      normalized.googleClientSecret ||
      process.env.GOOGLE_CLIENT_SECRET ||
      '',
    redirectUri:
      normalized.redirectUri ||
      normalized.googleRedirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      'https://oddrive-gerador.onrender.com/api/slides/oauth/callback'
  };

  return {
    templatePresentationId,
    templateProductIds,
    templateExternalFallbackId:
      normalized.templateExternalFallbackId ||
      normalized.templateExternosId ||
      process.env.GOOGLE_TEMPLATE_EXTERNOS_ID ||
      '',
    templateComboFallbackId:
      normalized.templateComboFallbackId ||
      process.env.GOOGLE_TEMPLATE_COMBO_ID ||
      '',
    presentationsFolderId:
      normalized.presentationsFolderId ||
      process.env.GOOGLE_PRESENTATIONS_FOLDER_ID ||
      '',
    assetsFolderId:
      normalized.assetsFolderId ||
      process.env.GOOGLE_DRIVE_ASSETS_FOLDER_ID ||
      '',
    publicShare:
      typeof normalized.publicShare === 'boolean'
        ? normalized.publicShare
        : process.env.GOOGLE_SHARE_PRESENTATIONS === 'true',
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri
  };
}

module.exports = {
  INTERNAL_PRODUCT_ID,
  EXTERNAL_PRODUCT_IDS,
  ALLOWED_PRODUCT_IDS,
  buildGoogleConfig
};
