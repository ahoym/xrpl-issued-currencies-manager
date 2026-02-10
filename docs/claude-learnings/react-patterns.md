# React Patterns

Learnings about React component patterns, state management, and UI update strategies.

## Lift execution state to parent for non-blocking UI

**Utility: Medium**

When a modal triggers a long-running async operation (e.g., placing 6 DEX orders sequentially), lift the execution state (`progress`, `results`) to the parent component. This lets the modal close immediately after confirmation while the parent continues running the operation. The parent can reflect progress in its own UI (e.g., a header button showing "Placing 3/6...") without blocking user interaction with the rest of the page.

## Modal as form-only with parent-owned execution

**Utility: Medium**

Design modals to handle only form input and preview, then call an `onExecute(data)` callback instead of running async operations internally. The parent owns the execution loop and state. This separates concerns: the modal is pure UI for gathering user intent, and the parent manages side effects.

Pattern: Modal exposes `onExecute` prop (not `onComplete`). Parent closes modal on execute and runs the work independently.

## Per-iteration refreshKey bump for live updates

**Utility: High**

In sequential async loops (e.g., placing multiple DEX orders one at a time), bump `refreshKey` after each successful iteration rather than only at the end. This triggers data re-fetching hooks (orderbook, balances, open orders) after every placement, so the user sees orders appear in real time as the ladder builds out.

```tsx
for (const order of orders) {
  const res = await placeOrder(order);
  if (res.ok) {
    successCount += 1;
    setRefreshKey((k) => k + 1); // triggers re-fetch after each order
  }
}
```

This works because the `await` between iterations yields control back to React, allowing re-renders and data fetches to fire between each API call.
