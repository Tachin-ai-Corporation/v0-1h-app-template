/**
 * =============================================================================
 * 1health API — endpoint paths & app configuration
 * =============================================================================
 *
 * Central registry of endpoint path builders plus the two app-specific lookup
 * tables you WILL need to fill in for any real app:
 *   1. RECORD_TYPES  — the data-object-type string keys your app talks to.
 *   2. ATTRIBUTES    — per-type schema attribute names used in /query.
 *
 * The 1health API version prefix is NOT uniform — most endpoints are `v2`, the
 * grid/list family is `v3`, and GraphQL has no version segment. Paths are
 * therefore written out per-endpoint rather than derived from one constant.
 *
 * All paths are relative to `getOneHealthBaseUrl()`; pass them to `callApi`.
 * =============================================================================
 */

/**
 * Data-object-type name keys (PascalCase strings — NOT GUIDs) your app queries.
 * These are 1health platform type names; fill in the ones your app uses. The
 * examples below are common platform types (uncomment / extend as needed).
 */
export const RECORD_TYPES = {
  // person: "Person",
  // organization: "Organization",
  // A journey INSTANCE is typed "WorkflowTemplate" in the query engine (see
  // DATA-MODEL.md § "the confusing bit").
  // workflowTemplate: "WorkflowTemplate",
  // workflowTemplateStep: "WorkflowTemplateStep",
} as const

/**
 * The REST resource path for a type often differs from its query/GraphQL key.
 * Keep the mapping explicit rather than assuming `key === path segment`.
 *   e.g. type "WorkflowTemplate" -> REST "/api/v2/journey"
 *        type "LabelTag"         -> REST "/api/v2/tag"
 */
export const TYPE_REST_PATH: Record<string, string> = {
  // WorkflowTemplate: "/api/v2/journey",
  // LabelTag: "/api/v2/tag",
}

/**
 * OPTIONAL schema attribute-name registry for /query.
 *
 * You don't have to hardcode attribute names — the platform is introspectable at
 * runtime (`GET /api/v2/type/key/{type}`, see lib/api/schema.ts and
 * docs/api/SCHEMA-DISCOVERY.md). But for a FIXED app, pinning the handful of
 * attribute keys you use here avoids a metadata round trip and makes renames a
 * one-line change. Use discovery for dynamic/generic tooling; use this for
 * hardcoded convenience. Both are valid.
 *
 * @example
 * export const ATTRIBUTES = {
 *   Person: { id: "id", firstName: "firstName", birthDate: "birthDate", customData: "customData" },
 *   Organization: { id: "id", name: "name", npi: "npi", customData: "customData" },
 * } as const
 */
export const ATTRIBUTES: Record<string, Record<string, string>> = {
  // Fill in per app (optional — or discover at runtime via lib/api/schema.ts).
}

// ============================================================================
// Endpoint path builders
// ============================================================================

export const endpoints = {
  // --- Generic engines -----------------------------------------------------
  /** Generic entity+relationship read. Body: QueryRequest. */
  query: () => "/api/v2/query",
  /** Schema discovery: list all data object types. */
  typeAll: () => "/api/v2/type/all",
  /** Schema discovery: one type's attributes + relationships. */
  typeByKey: (typeName: string) => `/api/v2/type/key/${encodeURIComponent(typeName)}`,
  /** Generic customData patch for any instance. Body: CustomDataUpdate[]. */
  customDataBulk: () => "/api/v2/data/custom-data/bulk",
  /** Grid/list query for a named server-defined view. */
  grid: (view: string) => `/api/v3/health/grid/${view}`,
  /** GraphQL (alternate read path). Body: { query, variables }. */
  graphql: () => "/api/graphql",

  // --- Journeys (workflow instances) --------------------------------------
  journeyCreate: () => "/api/v2/journey",
  journey: (journeyId: number | string) => `/api/v2/journey/${journeyId}`,
  journeySteps: (journeyId: number | string) => `/api/v2/journey/${journeyId}/steps`,
  journeyStatusBulk: () => "/api/v2/journey/status/bulk",
  journeyAssignUsers: () => "/api/v2/journey/assign-users",
  journeyUnassignUsers: () => "/api/v2/journey/unassign-users",

  // --- Steps ---------------------------------------------------------------
  stepInfo: (journeyId: number | string, stepId: number | string) =>
    `/api/v2/journey/${journeyId}/step/${stepId}/info`,
  stepSubmit: (journeyId: number | string, stepId: number | string, attachment = false) =>
    `/api/v2/journey/${journeyId}/step/${stepId}/submit${attachment ? "?attachment" : ""}`,
  step: (journeyId: number | string, stepId: number | string) =>
    `/api/v2/journey/${journeyId}/step/${stepId}`,

  // --- Workflow template hierarchy (definition side) -----------------------
  workflowCampaign: (campaignId: number | string) => `/api/v2/health/workflow-campaign/${campaignId}`,
  workflowTemplateGroup: (groupId: number | string) => `/api/v2/health/workflow-template-group/${groupId}`,
  workflowTemplate: (templateId: number | string) => `/api/v2/health/workflow-template/${templateId}`,
  workflowTemplateStepConfig: (templateId: number | string, stepId: number | string) =>
    `/api/v2/health/workflow-template/${templateId}/step/${stepId}/configuration`,
  /** WRITE step configuration (notifications/webhooks/etc.) — note: step-scoped, no templateId. */
  stepConfigWrite: (stepId: number | string) =>
    `/api/v2/health/workflow-template-step/${stepId}/configuration`,

  // --- Workflow provisioning (bootstrap: define templates & campaigns) -----
  /** List local template groups by name (idempotency check). */
  templateGroupList: (name: string, page = 0, size = 12) =>
    `/api/v2/health/workflow-template-group/list?page=${page}&size=${size}&name=${encodeURIComponent(name)}`,
  /** List published (shared/catalog) template groups available to clone. */
  publishedTemplateGroupList: (name: string, page = 0, size = 12) =>
    `/api/v2/health/workflow-template-group/published/list?page=${page}&size=${size}&name=${encodeURIComponent(name)}`,
  /** Clone a published template group into the current tenant. */
  templateGroupClone: (publishedId: number | string) =>
    `/api/v2/health/workflow-template-group/${publishedId}/clone`,
  /** Publish a draft template version (with rootNodes payload). */
  publishTemplate: (draftId: number | string) =>
    `/api/v2/health/workflow-template/${draftId}?setAsPublished=true`,

  // --- Campaign lifecycle --------------------------------------------------
  campaignCreate: () => "/api/v2/health/workflow-campaign",
  campaignRun: (campaignId: number | string, batchSize = 33) =>
    `/api/v2/health/workflow-campaign/${campaignId}/run?batchSize=${batchSize}`,
  campaignShare: (campaignId: number | string) => `/api/v2/health/workflow-campaign/${campaignId}/share`,
  /** Campaign KPI rollup (journey counts by status). Body: { calendar, journeyTags, steps }. */
  campaignDashboard: (campaignId: number | string) => `/api/v2/health/workflow-campaign/${campaignId}/dashboard`,

  // --- Partnerships (resolve share targets) --------------------------------
  partnerships: () => "/api/v2/organization/partnership",

  // --- Attachments & files -------------------------------------------------
  journeyDocuments: (journeyId: number | string) => `/api/v2/journey/${journeyId}/documents`,
  /** Generic typed-entity relation file upload. */
  stepFileUpload: (stepId: number | string, fileName: string, isPublic = false) =>
    `/api/v2/health/type/WorkflowTemplateStep/${stepId}/relation/WorkflowTemplateStepHasAttachmentFile/file/upload?fileName=${encodeURIComponent(fileName)}&isPublic=${isPublic}`,
  fileDownload: (fileId: number | string) => `/api/v2/file/${fileId}/download`,
  fileDelete: (fileId: number | string, hardDelete = true) =>
    `/api/v2/file/${fileId}?hardDelete=${hardDelete}`,

  // --- Comments ------------------------------------------------------------
  commentGrid: () => "/api/v3/health/grid/comment",
  journeyComment: (journeyId: number | string) => `/api/v2/journey/${journeyId}/comment`,
} as const
