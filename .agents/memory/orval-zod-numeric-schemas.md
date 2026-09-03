---
name: Orval and Zod numeric schemas
description: Compatibility constraint between the current Orval generator and the workspace’s installed Zod runtime.
---

The current workspace validation dependency is Zod 3.x while the installed Orval generator emits `zod.int()` for OpenAPI `integer` fields. Keep generated API numeric fields on the compatible number path unless the validation dependency is upgraded deliberately.

**Why:** Code generation succeeds, but the chained library typecheck fails when generated schemas call a helper absent from the installed Zod runtime.

**How to apply:** When extending `lib/api-spec/openapi.yaml`, prefer numeric fields that codegen maps to `zod.number()` and rerun the API codegen/typecheck after contract changes.