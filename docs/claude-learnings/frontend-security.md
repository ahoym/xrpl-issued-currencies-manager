# Frontend Security Patterns

## Stored XSS via On-Ledger URI Fields

**Context**: XRPL credentials (XLS-70) include an optional `uri` field that is set by the credential issuer and stored on the ledger. When rendering this field in a React frontend, it's tempting to use it directly in an `<a href>`:

```tsx
// VULNERABLE — uri could be "javascript:alert(document.cookie)"
<a href={c.uri} target="_blank" rel="noopener noreferrer">{c.uri}</a>
```

**Risk**: Any data from an external ledger, blockchain, or third-party API that ends up in an `href`, `src`, or other URL-position attribute is a stored XSS vector. An attacker writes a `javascript:` URI to the ledger, and every user who views it in the frontend is vulnerable.

**Fix**: Validate the protocol before rendering as a clickable link:

```tsx
{c.uri ? (
  /^https?:\/\//i.test(c.uri) ? (
    <a href={c.uri} target="_blank" rel="noopener noreferrer">{c.uri}</a>
  ) : (
    <span className="text-zinc-500">{c.uri}</span>
  )
) : "—"}
```

**Broader principle**: Any value from an external/untrusted source that flows into a URL-position attribute (`href`, `src`, `action`, `formaction`, `data`, `poster`, etc.) must be validated against an allowlist of safe protocols. React's JSX auto-escaping only protects text content, not attribute values in URL positions.
