/**
 * =============================================================================
 * 1health API — public surface
 * =============================================================================
 *
 * One import site for the whole API layer:  import { runQuery } from "@/lib/api"
 *
 * When you add a new module, re-export it here under a banner so it's
 * discoverable. See docs/api/CONVENTIONS.md.
 * =============================================================================
 */

// --- Core client + shared types -------------------------------------------
export { callApi, callApiRaw, ok, err, type ApiResponse } from "./client"
export * from "./types"
export { endpoints, RECORD_TYPES, TYPE_REST_PATH, ATTRIBUTES } from "./config"

// --- Generic engines -------------------------------------------------------
export {
  runQuery,
  runQueryRows,
  runQueryAll,
  getRootAttr,
  findAttr,
  getRelated,
  getRelatedAttr,
  parseCustomData,
  // RSQL filter builders
  eq,
  neq,
  gt,
  ge,
  lt,
  le,
  range,
  inList,
  ilike,
  contains,
  containsI,
  notContains,
  like,
  re,
  nre,
  jsonContains,
  hasKey,
  hasAnyKey,
  hasAllKeys,
  pathExists,
  pathMatches,
  and,
  or,
  buildFilter,
} from "./query"
export {
  fetchAllTypes,
  fetchTypeDetails,
  prefetchTypeDetails,
  getCachedTypeDetails,
  clearTypeCache,
  getRelationshipTargetType,
  formatRelationshipPath,
  relationshipPath,
  operatorsForType,
  BASELINE_ATTRIBUTES,
  type TypeSummary,
  type TypeDefinition,
  type TypeAttribute,
  type TypeRelationship,
  type AttributeValue,
  type AttributeType,
} from "./schema"
export { runGridQuery, fetchAllGridPages, type GridPageOptions } from "./grid"
export {
  updateCustomData,
  appendCustomData,
  replaceCustomData,
  readCustomData,
  deleteCustomDataKeys,
  appData,
} from "./custom-data"

// --- Workflows -------------------------------------------------------------
export {
  fetchCampaignGroupId,
  fetchTemplateIdFromGroup,
  resolveTemplate,
  fetchStepConfiguration,
  getDynamicFields,
  findFieldByLabel,
  resolveFieldsByLabel,
} from "./workflow-template"
export {
  createJourney,
  fetchJourney,
  listJourneys,
  updateJourneyStatus,
  assignUsersToJourneys,
  unassignUsersFromJourneys,
  type JourneyDetail,
} from "./journey"
export {
  fetchJourneySteps,
  fetchStepInfo,
  findStepByName,
  findActionableStep,
  buildStepMetadata,
  submitStep,
  submitStepFields,
  submitStepWithFile,
  deleteStepFile,
  updateStepDueDate,
} from "./journey-step"
export {
  fetchJourneyDocuments,
  uploadStepAttachment,
  downloadFile,
  deleteFile,
  type JourneyDocuments,
} from "./attachments"
export { fetchJourneyComments, postJourneyComment, type JourneyComment } from "./comments"

// --- Campaigns & provisioning (the "define/bootstrap" side) ---------------
export {
  createCampaign,
  activateCampaign,
  shareCampaign,
  shareCampaignWithPartner,
  fetchCampaign,
  listCampaigns,
  findCampaignByName,
} from "./campaign"
export {
  findTemplateGroupByName,
  findPublishedTemplateByName,
  cloneTemplateGroup,
  getTemplateGroupDetail,
  getDraftTemplateConfig,
  publishDraftTemplate,
  ensurePublishedVersion,
  ensureTemplateGroup,
  ensureWorkflow,
  type EnsureWorkflowOptions,
} from "./workflow-provisioning"
export {
  fetchPartnerships,
  type PartnerOrganization,
  type Partnership,
  type PartnershipsPage,
  type FetchPartnershipsOptions,
} from "./partnerships"
export {
  resolveCampaignSteps,
  updateStepConfiguration,
  setStepNotificationEmails,
  setStepWebhook,
  WHEN_ON_STEP_COMPLETION,
  MAX_NOTIFICATION_EMAILS,
  type CampaignStep,
  type ResolvedCampaignSteps,
} from "./step-config"

// --- Existing entity modules ----------------------------------------------
export { fetchMyself, isSystemAdmin, type UserInfo, type MyselfResult } from "./user"
export { fetchTenantConfig, type TenantConfig, type TenantConfigResult } from "./tenant"
