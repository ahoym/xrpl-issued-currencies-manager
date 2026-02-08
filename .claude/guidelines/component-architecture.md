# Component Architecture Guideline

## Large Pages: Decompose into Sub-Components with Shared Hooks

When a page component grows beyond ~200 lines, decompose it into:

1. **Slim orchestrator page** (~100-150 lines) — owns top-level state, wires props between sections
2. **Sub-components** in a dedicated subdirectory (e.g., `app/components/compliance/`) — each manages its own submission/loading/error state
3. **Shared hooks** in `lib/hooks/` — extract repeated data-fetching and action patterns

### Pattern

```
app/
  some-feature/
    page.tsx              ← Slim orchestrator (state, layout, wiring)
  components/
    some-feature/
      form-a.tsx          ← Self-contained form with own submit state
      list-b.tsx          ← Self-contained list with own loading state
      detail-c.tsx        ← Self-contained detail view
lib/
  hooks/
    use-some-data.ts      ← Shared fetch hook (address, network) → { data, loading, refresh }
    use-some-action.ts    ← Shared action hook () → { loading, error, execute }
```

### Rules

- **Each sub-component owns its action state** (loading, error for its own POST calls). The orchestrator doesn't need to know about submission details.
- **Shared hooks own fetch state** (data, loading, refresh). Multiple components can consume the same hook independently.
- **The orchestrator provides context** (wallet addresses, network, callbacks for cross-component refresh).
- **Refresh coordination**: Pass `refreshKey` numbers or `onChanged` callbacks down to trigger sibling refreshes when one component modifies shared data.

### Example: Compliance Page

Before refactoring: 750-line monolith with inline forms, tables, fetch logic, and submission handlers.

After refactoring:
- `compliance/page.tsx` (131 lines) — orchestrates wallet setup, credentials section, domains section
- `compliance/issue-credential-form.tsx` — form with own submit state
- `compliance/issued-credentials-table.tsx` — table with inline delete
- `compliance/recipient-credentials.tsx` — manages own credential fetch per recipient
- `compliance/create-domain-form.tsx` — form with dynamic credential list
- `compliance/domains-list.tsx` — domain display with inline delete
- `lib/hooks/use-account-credentials.ts` — shared fetch hook
- `lib/hooks/use-account-domains.ts` — shared fetch hook
- `lib/hooks/use-wallet-generation.ts` — shared action hook

### When NOT to Extract

- Don't extract a hook for a one-off action unique to a single component
- Don't extract a sub-component for a section that's < 50 lines
- Don't extract a shared hook if only one consumer exists (extract when a second consumer appears)
