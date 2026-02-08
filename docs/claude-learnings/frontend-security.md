# Frontend Security Learnings

## URI XSS via `javascript:` Protocol in `<a href>`

### The Problem

When rendering URIs from external or user-controlled sources (e.g., XRPL ledger credential data) as clickable `<a href>` links, the URI protocol must be validated before use. A malicious actor can store a URI like `javascript:alert(document.cookie)` on the ledger, which executes arbitrary JavaScript when a user clicks the rendered link.

This is a **stored XSS vector** -- the payload persists on the XRPL ledger and affects any user who views the credential in the UI.

### The Fix

Check that the URI uses `http:` or `https:` before rendering it as a clickable link. For any other protocol, render the value as inert text instead.

**Protocol validation pattern (React/JSX):**

```tsx
{uri ? (
  /^https?:\/\//i.test(uri) ? (
    <a href={uri} target="_blank" rel="noopener noreferrer">{uri}</a>
  ) : (
    <span>{uri}</span>
  )
) : "—"}
```

### Why It Matters

- **Stored XSS**: The malicious payload lives on-chain, not in a transient URL parameter. It persists indefinitely and affects every user who views the credential.
- **Trust assumption**: Developers may assume ledger data is "safe" because it comes from a blockchain, but any account can write arbitrary strings into credential fields.
- **Broad impact**: Any UI that renders ledger-sourced URIs as `<a href>` without validation is vulnerable -- this applies to credential URIs, NFT metadata links, domain fields, and similar data.

### General Rule

Never pass untrusted strings directly into `href` attributes. Always allowlist the expected protocols (`http:`, `https:`, and potentially `mailto:` if needed) and treat everything else as plain text.
