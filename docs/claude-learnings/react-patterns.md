# React Patterns

Patterns and pitfalls discovered during React development.

## Circular Dependency When Extracting Hooks

When extracting a custom hook that both **produces** derived state and **consumes** that derived state for further computation, pass primitive values (strings, numbers) into the hook rather than resolved objects.

### The Problem

A hook builds `currencyOptions` from balances and needs `sellingCurrency` (an object resolved from `currencyOptions`) to fetch orderbook data. If the caller must pass `sellingCurrency` as a prop, it needs `currencyOptions` from the hook to resolve it — creating a circular dependency.

### The Solution

Accept string identifiers and resolve internally:

```typescript
// BAD: Circular — caller needs currencyOptions to compute sellingCurrency
function useTradingData({ sellingCurrency }: { sellingCurrency: CurrencyOption | null }) {
  const currencyOptions = useMemo(() => /* build from balances */);
  // sellingCurrency was needed to call this hook, but it depends on currencyOptions...
}

// GOOD: Accept primitives, resolve internally
function useTradingData({ sellingValue }: { sellingValue: string }) {
  const currencyOptions = useMemo(() => /* build from balances */);
  const sellingCurrency = useMemo(
    () => currencyOptions.find((o) => o.value === sellingValue) ?? null,
    [currencyOptions, sellingValue],
  );
  // Return both for the caller
  return { currencyOptions, sellingCurrency, /* ... */ };
}
```

### When This Applies

- Extracting data-fetching hooks that also build option lists
- Any hook that derives state and then uses that derived state for side effects (fetches, subscriptions)
