/**
 * =============================================================================
 * 1health API — shared wire & domain types
 * =============================================================================
 *
 * Types that model the 1health platform's generic engines. They are the SAME
 * for every app — only the object-type names, attribute names, and field labels
 * you plug into them are app-specific.
 *
 * Concepts (see docs/api/DATA-MODEL.md):
 *   - A "data object type" is a PascalCase STRING key (e.g. "Person"), not a GUID.
 *   - An instance is identified by a numeric `id` / `instanceId`.
 *   - `customData` is a schemaless JSON blob hanging off an instance.
 *   - "Attribute" means two different things — schema attribute names (strings,
 *     for /query) vs. dynamic step-field identifiers (per-env GUIDs). Don't mix
 *     them up. See DATA-MODEL.md § Attributes.
 * =============================================================================
 */

// ============================================================================
// Generic entity query — POST /api/v2/query
// ============================================================================

/**
 * A relationship traversal within a query. `key` is a dot-path
 * `SourceType.EdgeName.TargetType` (all three segments required). Nest
 * `relationships` for multi-hop traversal.
 */
export interface RelationshipSpec {
  /** `SourceType.EdgeName.TargetType`, e.g. `Person.PersonHasInsurance.Insurance`. */
  key: string
  /** Attribute names projected on the TARGET entity. */
  attributes: string[]
  /** Attributes of the join/edge record itself (rarely needed). */
  relationAttributes?: string[]
  /** RSQL filter scoped to the target entity's attributes. */
  filter?: string
  limit?: number
  offset?: number
  relationships?: RelationshipSpec[]
}

/**
 * Request body for `POST /api/v2/query`.
 * `filter` uses RSQL/FIQL grammar — build it with the helpers in `query.ts`
 * (`eq`, `ilike`, `inList`, `and`, `or`) rather than hand-concatenating strings.
 */
export interface QueryRequest {
  /** The data-object-type name, e.g. "Person", "Organization". */
  key: string
  /** Projection: which attributes of the root entity to return. */
  attributes: string[]
  /** RSQL filter scoped to the root entity's attributes, e.g. `id==123`. */
  filter?: string
  relationships?: RelationshipSpec[]
  limit?: number
  offset?: number
}

/** A related-entity wrapper inside a query response's `relationships` map. */
export interface QueryRelatedInstance {
  instance: {
    /** Prefixed `<EdgeName>.<TargetType>.<attr>` (leading source type dropped). */
    attributes: Record<string, unknown>
    relationships?: Record<string, QueryRelatedInstance[]>
  }
}

/** A single row from `POST /api/v2/query`. */
export interface QueryResponseRow {
  /** Numeric id of the root instance (always present). */
  instanceId: number
  /** Prefixed `ROOT.<Type>.<attr>` at the root level. */
  attributes: Record<string, unknown>
  /** Keyed by the exact relationship `key` you requested. */
  relationships?: Record<string, QueryRelatedInstance[]>
}

export interface QueryResponse {
  data: QueryResponseRow[]
  pageNumber?: number
  pageSize?: number
  totalElements?: number
  totalPages?: number
}

// ============================================================================
// Grid / view query — POST /api/v3/health/grid/<view>
// ============================================================================

export type GridFilterOperator = "equals" | "contains" | "greaterThan" | "lessThan" | "in"

export interface FilterCondition {
  key: string
  value: string | number
  operator: GridFilterOperator
}

export interface OrderByCondition {
  key: string
  order: "ASC" | "DESC"
}

export interface GridRequest {
  filterBy?: FilterCondition[]
  orderBy?: OrderByCondition[]
}

/** Standard paginated envelope returned by the grid endpoints. */
export interface PaginatedResponse<T> {
  data: T[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  offset?: number
  numberOfElements?: number
  firstPage?: boolean
  lastPage?: boolean
  emptyPage?: boolean
}

// ============================================================================
// Custom data — POST /api/v2/data/custom-data/bulk
// ============================================================================

/** APPEND = shallow (top-level-only) merge into customData; REPLACE = overwrite the blob. */
export type CustomDataOperation = "APPEND" | "REPLACE"

export interface CustomDataUpdate {
  /** Numeric id of ANY instance that carries customData (journey, org, person…). */
  instanceId: number
  customData: Record<string, unknown>
  operation: CustomDataOperation
}

// ============================================================================
// Workflows — templates, journeys, steps
// ============================================================================

/** Known dynamic-field widget types. Kept open (`| string`) — new types appear. */
export type DynamicFieldType =
  | "customField.textEntry"
  | "customField.date"
  | "customField.select.dropdown"
  | "customField.select.checkboxes"
  | "customField.fileUpload"
  | "fileUpload"
  | "customText"
  | (string & {})

export type DynamicFieldOption = string | { label: string; value: string | number }

export interface DynamicFieldValidation {
  type: string
  pattern?: string
  message?: string
}

/**
 * One configurable field on a workflow step. Resolve fields by `label` (stable
 * across environments) — NEVER hardcode `fieldIdentifier` (a per-env GUID).
 */
export interface DynamicField {
  /** Human label — stable across environments; use it to find the field. */
  label: string
  type: DynamicFieldType
  /** Per-environment GUID; the key you submit values under. */
  fieldIdentifier: string
  value?: unknown
  uiOrder?: number
  description?: string
  /** Lets a value be saved as draft without completing the step. */
  requiredToSave?: boolean
  /** Blocks step completion (advancement) until present. */
  requiredToComplete?: boolean
  required?: boolean
  options?: DynamicFieldOption[]
  validation?: DynamicFieldValidation
  /** Present on file fields once a file is attached. */
  fileMetadata?: unknown
  [key: string]: unknown
}

/**
 * A notification (email) subscription on a step's configuration.
 * Shapes verified against live 1health captures. `emailSubject`/`emailMessage`
 * are FLAT strings. The backend validates the sibling scalars (`notifyPatient`,
 * `notifyCustomer`, `sendCompletionLink`, `smsMessage`, `completionButtonLabel`)
 * on write, so round-trip them even when unchanged.
 */
export interface StepNotification {
  /** Returned by GET; omit on PUT (server reuses it). */
  id?: number
  name?: string
  isActive?: boolean
  /** Trigger phase(s), e.g. ["On Step Completion"]. */
  whenToExecute?: string[]
  /** Email recipient list — the field a notifications UI edits. */
  additionalEmails?: string[]
  emailSubject?: string
  emailMessage?: string
  smsMessage?: string
  completionButtonLabel?: string
  notifyPatient?: boolean
  notifyCustomer?: boolean
  sendCompletionLink?: boolean
  retryIntervalMinutes?: number
  tryCount?: number
  [key: string]: unknown
}

/** A webhook subscription on a step's configuration. */
export interface StepWebhook {
  /** Returned by GET; omit on PUT (server reuses it). */
  id?: number
  name?: string
  endpointUrl?: string
  method?: string
  isActive?: boolean
  whenToExecute?: string[]
  /** Custom headers as a plain object (name → value), NOT an array. */
  header?: Record<string, string> | null
  /** Emails notified on delivery failure (wire is an array). */
  failureNotificationEmails?: string[] | null
  retryIntervalMinutes?: number
  numberOfRetriesBeforeFail?: number
  customBody?: boolean
  customBodyModel?: string
  [key: string]: unknown
}

/**
 * A step's configuration DTO. The same GET returns the field schema
 * (`metadata.dynamicFields`) AND its `notifications`/`webhooks` subscriptions.
 * See lib/api/step-config.ts and docs/api/PROVISIONING.md § step config.
 */
export interface StepConfiguration {
  id?: number
  metadata?: {
    dynamicFields?: {
      custom?: {
        fields?: DynamicField[]
      }
    }
  }
  notifications?: StepNotification[]
  webhooks?: StepWebhook[]
  [key: string]: unknown
}

export interface UploadedFile {
  id: number
  name: string
  /** Matches the `fieldIdentifier` of the field the file was uploaded for. */
  identifier?: string
  [key: string]: unknown
}

/** Live state of a single step on a journey instance (`.../step/{id}/info`). */
export interface StepInfo {
  id: number
  name: string
  status?: string
  type?: string
  configuration?: StepConfiguration
  uploadedFiles?: UploadedFile[]
  stepActions?: unknown[]
  dueDate?: string
  /** True when this is the currently actionable step. */
  canSubmit?: boolean
}

/** A step as listed on a journey (`.../{journeyId}/steps`). */
export interface WorkflowTemplateStep {
  id: number
  name: string
  type?: string
  status?: string
  /** Sequence position. */
  order?: number
  canSubmit?: boolean
  dueDate?: string
  /** Steps sharing a group can run in parallel branches. */
  groupId?: string | number
  /** Pointer back to the template's abstract step definition. */
  availableWorkflowStep?: { id: number; name: string; type?: string }
  [key: string]: unknown
}

export interface JourneyStepsData {
  workflowTemplateSteps: WorkflowTemplateStep[]
  customData?: Record<string, unknown>
}

/** Result of creating a journey (`POST /api/v2/journey`). */
export interface CreatedJourney {
  id: number
  name?: string
  message?: string
}

/**
 * A step to seed+submit at journey-creation time. `key` is the step NAME and
 * `data` is a plain flat JSON body (Recipe A — see docs/api/WORKFLOWS.md).
 */
export interface SeedStep {
  key: string
  data: Record<string, unknown>
}

// ============================================================================
// Workflow template hierarchy (Campaign → Group → Template → Step config)
// ============================================================================

export interface ResolvedTemplate {
  campaignId: number
  workflowTemplateGroupId: number
  workflowTemplateId: number
  /** Whether the published or draft version was used. */
  version: "published" | "draft"
}

/**
 * One node in a WorkflowTemplate's `rootNodes` step-tree DEFINITION. Steps are a
 * (usually linear) sequence: each node nests its successor via `.node`; terminal
 * nodes omit it. `availableStepId` is the shared step-type this node instantiates;
 * `metadata` is canvas-only (position/style) — ignore it for logic.
 */
export interface WorkflowTemplateNode {
  id: number
  name: string
  key: string
  type?: string
  nodeId?: string
  availableStepId?: number
  availableStepIsActive?: boolean
  metadata?: Record<string, unknown>
  /** Next step in sequence (linked-list style). Absent on terminal nodes. */
  node?: WorkflowTemplateNode
  [key: string]: unknown
}

/**
 * GET /api/v2/health/workflow-template/{id} — a template's step-tree definition
 * (the `rootNodes` linked list). Use `flattenTemplateNodes` to linearize it.
 */
export interface WorkflowTemplateDefinition {
  id: number
  name: string
  rootNodes: WorkflowTemplateNode[]
  stickyNotes?: unknown[]
  [key: string]: unknown
}

/**
 * The template refs a campaign points at — see WORKFLOWS.md § the template layers.
 * Read from the campaign GET (`baseWorkflowTemplate`, `workflowTemplateGroup`,
 * `previousBaseWorkflowTemplates`).
 */
export interface CampaignTemplateRefs {
  campaignId: number
  /** CAMPAIGN BASE: the clone this campaign's NEW journeys copy from. Editing it → future journeys. */
  baseWorkflowTemplateId: number | null
  /** DESIGN-TIME (tenant) template — the group's published version the base was cloned from. */
  designTimeWorkflowTemplateId: number | null
  workflowTemplateGroupId: number | null
  /** Prior base clones (each roll-forward mints a new base and archives the old). */
  previousBaseWorkflowTemplateIds: number[]
}

// ============================================================================
// Campaigns (a template group's running instance at the tenant level)
// ============================================================================

export interface CampaignOrganization {
  id: number
  name: string
  tenantId: number
}

export interface CampaignSharedPartner {
  id: number
  tenantId: number
  sharedPartnerOrganizationName: string
  shareAccess: string
  status: string
}

/** A workflow campaign (loose — extra platform fields allowed). */
export interface Campaign {
  id: number
  name: string
  status?: string
  description?: string
  startDate?: string
  category?: string
  workflowCategory?: string
  /** Grid-row shape: flat group id/name (from `listCampaigns`). */
  workflowTemplateGroupId?: number
  workflowTemplateGroupName?: string
  /**
   * GET-one shape: the CAMPAIGN BASE template — the clone this campaign's journeys
   * copy from. `designTimeWorkflowTemplateId` points back to the group's published
   * (design-time) template it was cloned from. Present only on the GET, not the grid row.
   */
  baseWorkflowTemplate?: {
    id: number
    name?: string
    designTimeWorkflowTemplateId?: number
    lastTimeStepConfigUpdated?: string
  }
  /** GET-one shape: the nested group object, incl. its `published`/`draft` template refs. */
  workflowTemplateGroup?: {
    id: number
    name?: string
    type?: string
    published?: { id: number; name?: string }
    draft?: { id: number; name?: string }
  }
  /** Prior base-template clones (roll-forward history). GET-one shape. */
  previousBaseWorkflowTemplates?: Array<{ id: number; name?: string }>
  ownerOrganization?: CampaignOrganization
  sharedPartnerOrganizations?: CampaignSharedPartner[] | null
  created?: string
  updated?: string
  [key: string]: unknown
}

/** One status bucket in a campaign dashboard rollup (incl. a "Total" bucket). */
export interface CampaignDashboardCount {
  number: number
  /** Config-defined journey status, e.g. "In Progress" | "Completed" | "Cancelled" | "On Hold" | "Total". */
  status: string
}

/** Optional filters for the dashboard rollup; defaults match the platform UI. */
export interface CampaignDashboardOptions {
  /** Time bucketing for the calendar view. Default "week". */
  calendar?: "day" | "week" | "month" | (string & {})
  /** Restrict to journeys carrying these label-tag ids. */
  journeyTags?: number[]
  /** Restrict the rollup to specific step ids. */
  steps?: number[]
}

/** POST /api/v2/health/workflow-campaign/{id}/dashboard — journey counts by status. */
export interface CampaignDashboard {
  total: CampaignDashboardCount[]
  calendar: string
  tenantId: number
  campaignId: number
  [key: string]: unknown
}

export interface CreateCampaignInput {
  name: string
  description?: string
  labelTagIds?: number[]
  /** ISO start date. The helper defaults this to "now" when omitted. */
  startDate?: string
  workflowTemplateGroupId: number
  allowMultiplePatientJourneys?: boolean
}

/** One share grant for a campaign. */
export interface ShareTarget {
  /** e.g. "Partner Organization". */
  targetAccessEntity: string
  targetEntityId: number
  /** e.g. "Read". */
  shareAccess: string
}

// ============================================================================
// Workflow provisioning / bootstrap (the "define" side)
// ============================================================================

export interface TemplateVersion {
  id: number
  name?: string
}

export interface TemplateGroupSummary {
  id: number
  name: string
  [key: string]: unknown
}

export interface TemplateGroupDetail {
  id: number
  name: string
  category?: string
  type?: string
  published: TemplateVersion | null
  draft: TemplateVersion | null
  [key: string]: unknown
}

/** Progress phases emitted by the bootstrap orchestrator. */
export type BootstrapStep =
  | "finding"
  | "cloning"
  | "publishing"
  | "creating"
  | "activating"
  | "sharing"
  | "done"
  | "error"

export interface BootstrapProgress {
  step: BootstrapStep
  message: string
}

export interface BootstrapResult {
  success: boolean
  campaignId?: number
  workflowTemplateGroupId?: number
  /** True when an existing campaign was reused instead of created. */
  reusedExisting?: boolean
  error?: string
}
