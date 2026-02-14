# Parallel Execute Skill

## Writing Plans for Parallel Execution

When authoring a plan that will be run with `/parallel-execute`, structure it for parallelism from the start:

1. **Assign named agents** — label each step with an agent (A, B, C...) so the executor can map work directly
2. **List file ownership** — for each step, explicitly list files it creates, modifies, or deletes
3. **Group into phases** — steps modifying the same file go in different phases; steps touching independent files run in parallel
4. **Draw the dependency graph** — show which phases depend on which, and identify the critical path
5. **Document agent outputs** — for the integration phase, list what each prior agent produces (new props, new exports, new state variables) so the integration agent's prompt can be precise
6. **Include a measurement table** — track time, tool uses, and speedup to refine the approach over time

### Example Plan Structure

```markdown
## Parallel Execution Strategy

Phase 1 (4 agents, no file conflicts):
  Agent A: component-a.tsx    (feature X)
  Agent B: component-b.tsx    (feature Y)
  Agent C: component-c.tsx    (feature Z)
  Agent D: new-hooks + types  (infrastructure)

Phase 2 (1 agent, depends on D):
  Agent E: data-layer.ts      (wire infrastructure)

Phase 3 (1 agent, depends on all):
  Agent F: parent.tsx          (thread props, add state)

| Phase | Agent | Task | Time | Tool uses |
|-------|-------|------|------|-----------|
| 1     | A     | ...  | _    | _         |
```

This structure was validated in practice: a 6-feature plan executed with zero integration rework and a first-try build pass, achieving 1.35x overall speedup (1.8x in the parallel phase).
