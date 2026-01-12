/**
 * backend/services/db.js
 *
 * Única fonte de dados: MongoDB (mongo.js). As rotas importam desta camada
 * para manter uma API estável.
 */

import * as mongo from './mongo.js';

export const {
  uploadBase64ImageMongo,
  upsertCampaignRecord,
  upsertDriverRecord,
  insertEvidenceRecord,
  deleteEvidenceRecord,
  deleteStorageFile,
  deleteStorageFilesByFolder,
  upsertMasterRecord,
  deleteMastersByCampaign,
  deleteAllCampaignData,
  deleteMasterByDriver,
  ensureDatabaseSchema,
  getCampaignTableName,
  ensureCampaignMasterTable,
  upsertCampaignMasterRows,
  getCampaignGraphicsTableName,
  ensureCampaignGraphicsTable,
  upsertCampaignGraphicsRows,
  deleteCampaignGraphicsTable,
  deleteGraphicRow,
  getDriverStorageBasePath,
  listDriverStorageTree,
  listStorageEntriesByCampaign,
  findDriverByIdentityMongo,
  getCampaignRecordById,
  findCampaignByCodeMongo,
  listCampaignGraphicsRecords,
  findDriverRowInMasterTables,
  findAdminUserByUsername,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  insertAuditLog,
  listAuditLogs,
} = mongo;

export default mongo;
