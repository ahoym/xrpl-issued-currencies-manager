# XRPL Implementation Gotchas

Practical lessons learned while building against xrpl.js v4.5.0 and Next.js 16.

---

## 1. xrpl.js v4.5.0 Type Awareness

xrpl.js v4.5.0 has full TypeScript definitions for all Permissioned Domain and Credential transaction types. Always check the actual type definitions before building request interfaces:

- `CredentialCreate`, `CredentialAccept`, `CredentialDelete` — fully typed
- `PermissionedDomainSet`, `PermissionedDomainDelete` — fully typed
- `AuthorizeCredential` — the nested type for `AcceptedCredentials` entries, uses `{ Credential: { Issuer, CredentialType } }` wrapping
- `OfferCreate.DomainID` — optional field for permissioned DEX offers
- `OfferCreateFlags.tfHybrid` — value 1048576, for offers in both domain + open book
- `BookOffersRequest.domain` — optional filter for domain-specific order books

**Lesson**: Grep `node_modules/xrpl/dist/npm/models` to verify field names and flag values before coding. The types are authoritative and save guesswork.

---

## 2. `client.getOrderbook()` vs Raw `book_offers`

The xrpl.js sugar method `client.getOrderbook()` does NOT support the `domain` parameter for permissioned DEX order books. When you need domain-filtered books, you must use raw requests:

```typescript
// Sugar method — open DEX only (no domain support)
const book = await client.getOrderbook(takerPays, takerGets);

// Raw request — supports domain filtering
const response = await client.request({
  command: "book_offers",
  taker_gets: takerGets,
  taker_pays: takerPays,
  domain: domainID, // only works with raw request
  limit: 20,
});
```

When using raw `book_offers`, you need two requests (one per direction) and must normalize the offer format yourself, since the sugar method handles bid/ask categorization automatically.

**Lesson**: Always check whether sugar methods support new protocol fields. When they don't, fall back to `client.request()` with the raw command.

---

## 3. Credential Type Hex Encoding != Currency Hex Encoding

XRPL credential types and currency codes both use hex encoding, but they are **different formats**:

| | Credential Type | Currency Code |
|---|---|---|
| Encoding | Raw UTF-8 → hex (`Buffer.from(str, 'utf-8').toString('hex')`) | Padded to exactly 40 hex chars (20 bytes) with trailing zeros |
| Max length | 64 bytes | 20 bytes (3-char codes use a different non-hex format) |
| Helper | `encodeCredentialType()` in `lib/xrpl/credentials.ts` | `encodeXrplCurrency()` in `lib/xrpl/currency.ts` |

Using the wrong encoder will produce valid-looking hex that silently fails on the ledger. Keep them in separate utility files to avoid confusion.

**Lesson**: Don't reuse currency encoding helpers for credential types. They have different padding and length rules.

---

## 4. TransactionMetadata Double Cast

xrpl.js `TransactionMetadataBase` types don't expose `AffectedNodes` with enough type detail to extract created ledger objects (e.g., getting a `DomainID` from a `PermissionedDomainSet` result). Direct casting fails because `Node` types lack string index signatures.

The fix is a double cast through `unknown`:

```typescript
const nodes = (meta as unknown as {
  AffectedNodes: Array<Record<string, unknown>>;
}).AffectedNodes;

const created = nodes.find(
  (n) =>
    "CreatedNode" in n &&
    (n.CreatedNode as Record<string, unknown>).LedgerEntryType === "PermissionedDomain",
);
```

**Lesson**: When extracting data from XRPL transaction metadata, use `as unknown as T` to bypass strict type constraints. This is a known limitation of the xrpl.js type definitions for metadata introspection.

---

## Sources

- xrpl.js v4.5.0 type definitions: `node_modules/xrpl/dist/npm/models/`
- [PermissionedDomainSet](https://xrpl.org/docs/references/protocol/transactions/types/permissioneddomainset)
- [CredentialCreate](https://xrpl.org/docs/references/protocol/transactions/types/credentialcreate)
- [BookOffersRequest](https://xrpl.org/docs/references/protocol/transactions/types/bookoffers)
