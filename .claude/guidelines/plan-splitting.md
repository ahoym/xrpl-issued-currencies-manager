# Plan Splitting: Fast/Slow Track Workflow

When a plan contains multiple independent suggestions of varying complexity, split them into separate tracks rather than batching everything into one plan.

## When to Split

Split when a plan has items that are **both**:
- Independent of each other (no shared prerequisites or ordering constraints)
- Different in complexity or discussion-worthiness

## How to Split

1. **Fast track** — Ship obvious, low-risk changes immediately in their own plan (documentation edits, trivial additions, mechanical refactors with clear specs).
2. **Slow track** — Open a separate plan for changes that benefit from discussion (new abstractions, API design, architectural choices, anything with multiple valid approaches).

## Why

- Trivial wins ship faster instead of being blocked by unrelated design discussions.
- Complex changes get the focused attention they deserve without pressure to rush.
- Smaller plans are easier for users to review and approve.
