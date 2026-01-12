// ... existing code ...

## Checklist for New Query Actions

- [ ] File named `query-{entity-type}.ts` in `app/actions/query/`
- [ ] Entity type, attributes, and relationships are documented/verified
- [ ] Function exported from `query/index.ts`
- [ ] Types added to `query/types.ts` if reusable
- [ ] Response parsing handles flattened attribute format

---

## Query Relationship Key Format

When building queries with relationships, the relationship key must follow a specific format.

### CORRECT Format

```
{FromType}.{relKey}.{ToType}
```

Where `relKey` is the **EXACT value from the API's `relationship.relKey` property**.

**IMPORTANT:** Do NOT construct the relKey yourself by concatenating type names! Always use the `relKey` provided by the `GET /v2/type/key/{type}` API response.

**Example:**
```
WorkflowTemplate.WorkflowTemplateStepIsRootOfWorkflowTemplate.WorkflowTemplateStep
```

This format consists of:
1. **FromType** - The source type boKey (e.g., `WorkflowTemplate`)
2. A dot separator
3. **relKey** - The exact relationship key from the API (e.g., `WorkflowTemplateStepIsRootOfWorkflowTemplate`)
4. A dot separator  
5. **ToType** - The target type boKey (e.g., `WorkflowTemplateStep`)

### INCORRECT Format (Do NOT use)

```
{FromType}.{ConstructedRelName}.{ToType}
```

**Wrong Examples:**
```
WorkflowTemplate.RootNode.WorkflowTemplateStep  ❌  (using relationship.name)
WorkflowTemplate.WorkflowTemplateRootNodeWorkflowTemplateStep.WorkflowTemplateStep  ❌  (concatenating types)
```

### Getting the relKey

The `relKey` comes from the `/v2/type/key/{typeName}` API response:

```json
{
  "relationships": [
    {
      "name": "Root Node",
      "relKey": "WorkflowTemplateStepIsRootOfWorkflowTemplate",
      "toBoClassName": "Workflow Template Step",
      ...
    }
  ]
}
```

Use `relationship.relKey` (e.g., `"WorkflowTemplateStepIsRootOfWorkflowTemplate"`), NOT `relationship.name` (e.g., `"Root Node"`).

### Implementation

The `formatRelationshipPath()` function in `lib/utils/type-helpers.ts` handles this formatting:

```typescript
import { formatRelationshipPath } from "@/lib/utils/type-helpers"

// Pass the fromType, relKey (from API), and toType
const path = formatRelationshipPath("WorkflowTemplate", "WorkflowTemplateStepIsRootOfWorkflowTemplate", "WorkflowTemplateStep")
// Returns: "WorkflowTemplate.WorkflowTemplateStepIsRootOfWorkflowTemplate.WorkflowTemplateStep"
```

### Nested Relationships

For nested relationships (chaining types), each level follows the same format using the relKey from each type's API response:

```json
{
  "key": "WorkflowTemplate",
  "relationships": [
    {
      "key": "WorkflowTemplate.WorkflowTemplateStepIsRootOfWorkflowTemplate.WorkflowTemplateStep",
      "relationships": [
        {
          "key": "WorkflowTemplateStep.WorkflowTemplateStepStepDirectionWorkflowTemplateStep.WorkflowTemplateStep"
        }
      ]
    }
  ]
}
