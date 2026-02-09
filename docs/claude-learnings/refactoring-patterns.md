# Refactoring Patterns

Patterns for large-scale refactoring, especially when using parallel subagents.

## Coordinating Prop Removal Across Parallel Subagents

When removing a prop from many components using parallel subagents, each agent must update **both** the component interface and any child component call sites within the same file.

### The Problem

Agent A removes `network` from `RecipientCard`'s props. Agent B removes `network` from `BalanceDisplay`'s props. But `RecipientCard` renders `<BalanceDisplay network={network} />` — if Agent A doesn't also remove that prop from the JSX, the build breaks because `BalanceDisplay` no longer accepts `network`.

### The Rule

Each subagent that modifies a component should:

1. Remove the prop from the component's interface
2. Remove the prop from the destructured parameters
3. Add the replacement (e.g., `useAppState()`) inside the component
4. **Remove the prop from all child component JSX within that file** where the child is also being refactored

### Execution Order

1. **First**: Run parallel subagents to update all child components (remove prop from interface, add hook)
2. **After all complete**: Update parent pages to stop passing the prop

This order matters because parent pages may share files or have dependencies that make parallel editing risky.

### Example Grouping Strategy

Group components by dependency tree depth:
- **Leaf components first** (e.g., `BalanceDisplay`, `WalletSetupModal`) — no children to update
- **Mid-level components** (e.g., `RecipientCard`) — update own interface + remove prop from leaf children
- **Parent pages last** (e.g., `page.tsx`) — remove prop from all top-level component calls
