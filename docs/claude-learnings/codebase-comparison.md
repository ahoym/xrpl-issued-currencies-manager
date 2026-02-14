# Codebase Comparison for Feature Porting

Methodology for comparing two codebases to identify features worth porting.

## When to Use

When a reference project (e.g., a prototype or sibling repo) has features that should be brought into the current project. Common scenarios:
- Porting UI improvements from a design exploration repo
- Adopting patterns from a more mature sibling project
- Consolidating features from parallel development efforts

## Methodology

### Step 1: Parallel Exploration

Launch 2 Explore agents simultaneously — one per project. Each agent reads ALL components in the target area and summarizes:
- What each component does
- Key features and functionality
- Props/interfaces it accepts
- Notable patterns (responsive design, loading states, accessibility)

Running in parallel cuts exploration time roughly in half vs sequential reads.

### Step 2: Build the Feature Matrix

Compare the two summaries to categorize features:

| Category | Action |
|----------|--------|
| Features A has, B doesn't | Port candidates — prioritize by impact |
| Features B has, A doesn't | Preserve — don't break during porting |
| Shared features, different implementations | Compare quality, adopt the better one |
| Architectural differences | Evaluate — some may not be worth porting (e.g., wallet adapter vs seed-based auth) |

### Step 3: Prioritize

Rank port candidates by:
- **User impact** — how much the feature improves the experience
- **Implementation effort** — small (single file) vs large (new API + component + hook)
- **Dependencies** — does it require architectural changes?
- **Risk** — could it break existing functionality?

### Step 4: Write the Plan

For each feature to port:
1. Note which files need to change
2. Reference existing utilities/patterns to reuse (don't reinvent)
3. Flag what to preserve from the current project
4. Assign to phases if using parallel execution

## Example

Comparing `xrpl-dex-portal/app/trade/` with `xrpl-issued-currencies-manager/app/trade/`:

| Feature | Portal | Manager | Decision |
|---------|--------|---------|----------|
| Auto-polling (3s) | Yes | No | Port — high impact, medium effort |
| Depth controls | Yes | No | Port — medium impact, small effort |
| Balance validation | Yes | No | Port — high impact, small effort |
| Wallet adapter | Yes | No | Skip — large architectural change, low ROI |
| Domain/permissioned DEX | No | Yes | Preserve |
| Make Market modal | No | Yes | Preserve |

This analysis identified 6 features to port and 1 to skip, resulting in a focused plan with clear scope.

## Tips

- Use the same Explore agent prompt template for both projects to get comparable output
- Don't try to port everything — skip features that require architectural changes unless justified
- Preserve the current project's unique features — porting shouldn't be a replacement
- Write the plan with parallel execution in mind (see `/parallel-execute`)
