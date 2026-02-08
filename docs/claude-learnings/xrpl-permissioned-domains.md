# XRPL Permissioned Domains & Credentials — Research Notes

> Sourced from [xrpl.org](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/permissioned-domains), [XLS-0080 spec](https://xls.xrpl.org/xls/XLS-0080-permissioned-domains.html), [XLS-81d discussion](https://github.com/XRPLF/XRPL-Standards/discussions/229), and related pages.

## Status

- **Permissioned Domains (XLS-80)** — Activated on XRPL mainnet **February 4, 2026** with 91%+ validator approval.
- **Permissioned DEX (XLS-81)** — Proposed, not yet activated. Depends on XLS-80.
- **Credentials (XLS-70)** — Activated (prerequisite for Permissioned Domains).

## Overview

Permissioned Domains are credential-gated access layers on the public XRP Ledger. They let institutions create controlled zones where only accounts holding required credentials can participate, enabling compliant on-chain services without private blockchains.

Domains don't do anything by themselves — they're building blocks for features like Permissioned DEXes and Lending Protocols that restrict participation to credentialed accounts.

---

## Conceptual Model

### Three Independent Roles

The permissioned domain system involves three roles that are **completely independent** of each other. They can be the same account, overlap, or be entirely separate:

```
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  Currency Issuer     │   │  Credential Issuer   │   │  Domain Owner        │
│  (rTokenBank)        │   │  (rComplianceCorp)   │   │  (rExchange)         │
│                      │   │                      │   │                      │
│  Issues tokens       │   │  Attests identity    │   │  Creates trading     │
│  (e.g., USD, EUR)    │   │  (e.g., KYC, AML)   │   │  environments        │
│                      │   │                      │   │                      │
│  Uses: Payment       │   │  Uses:               │   │  Uses:               │
│  (issuer → recipient)│   │  CredentialCreate    │   │  PermissionedDomain  │
│                      │   │  CredentialDelete    │   │  Set / Delete        │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
         │                          │                          │
         │                          │                          │
    No relationship            Referenced by              References
    to domains or              domain's Accepted          credential issuer
    credentials                Credentials array          + type pairs
```

Key insight: **"Issuer" is overloaded**. In `AcceptedCredentials[].Issuer` on a domain, "Issuer" means the *credential issuer*, NOT the currency issuer.

### What Each Layer Controls

```
┌───────────────────────────────────────────────────────────────┐
│                    WHAT gets traded?                           │
│                                                               │
│   Controlled by: Currency Issuers + Trust Lines               │
│   Any token from any issuer can appear in any order book.     │
│   Permissioned domains have NO say in this.                   │
├───────────────────────────────────────────────────────────────┤
│                    WHO can trade?                              │
│                                                               │
│   Controlled by: Permissioned Domains + Credentials           │
│   Only accounts holding a valid credential accepted by        │
│   the domain can place offers in that domain's order book.    │
│   The domain has NO say in what currencies are traded.        │
├───────────────────────────────────────────────────────────────┤
│                    WHERE does matching happen?                 │
│                                                               │
│   Controlled by: DomainID on OfferCreate                      │
│   Each domain has its own isolated order book.                │
│   No DomainID = open DEX. With DomainID = domain book.       │
│   Domain books and open book are strictly separated.          │
└───────────────────────────────────────────────────────────────┘
```

### End-to-End Flow

```
  rComplianceCorp                rAlice                    rExchange
  (Credential Issuer)           (Trader)                  (Domain Owner)
        │                          │                          │
        │  1. CredentialCreate     │                          │
        │  {Subject: rAlice,       │                          │
        │   CredentialType: "KYC"} │                          │
        │─────────────────────────>│                          │
        │                          │                          │
        │                          │  2. CredentialAccept     │
        │                          │  {Issuer: rComplianceCorp│
        │                          │   CredentialType: "KYC"} │
        │                          │─────────(self)           │
        │                          │                          │
        │                          │     3. PermissionedDomainSet
        │                          │     {AcceptedCredentials: │
        │                          │      [{Issuer: rComplianceCorp,
        │                          │        CredentialType: "KYC"}]}
        │                          │                          │──(self)
        │                          │                          │
        │                          │                   Returns DomainID:
        │                          │                   "ABC123..."
        │                          │                          │
        │                          │  4. OfferCreate          │
        │                          │  {TakerGets: 100 USD,    │
        │                          │   TakerPays: 50 XRP,     │
        │                          │   DomainID: "ABC123..."} │
        │                          │─────────(to ledger)      │
        │                          │                          │
        │                     Ledger checks:                  │
        │                     - Does domain "ABC123" exist? ✓  │
        │                     - Does rAlice hold a credential  │
        │                       matching AcceptedCredentials? ✓│
        │                     - Place offer in domain book ✓   │
        │                          │                          │
        │  rBob (also KYC'd)       │                          │
        │  places matching offer   │                          │
        │  in same domain ──────> MATCH ✓ (same domain)       │
        │                          │                          │
        │  rCharlie (no credential)│                          │
        │  tries OfferCreate with  │                          │
        │  DomainID: "ABC123" ──> REJECTED ✗ (not a member)  │
```

### No Asset-Level Restrictions

Permissioned domains control **participants**, not **assets**. There is no on-chain mechanism to restrict which currencies can be traded within a domain. Any credentialed member can place offers for any currency pair.

The design assumption is that vetting participants (via credentials) is sufficient compliance. Enforcement against illicit assets is **reactive**, not preventive:

- **Credential issuer** can delete a credential → member's offers become invalid (lazy cleanup)
- **Domain owner** can update `AcceptedCredentials` to change who qualifies
- **Credentials can expire** → forces periodic re-verification

```
  Asset restriction?     ──── NOT enforced by domains
  Participant restriction? ── ENFORCED by credentials + domains
  Order book isolation?  ──── ENFORCED by DomainID on offers
```

---

## Credentials (XLS-70)

Credentials are the identity primitive that Permissioned Domains rely on. They are on-chain attestations (e.g., KYC verification) stored as ledger objects.

### Credential Lifecycle

1. **Create** — Issuer submits `CredentialCreate` → credential exists on ledger but is **not yet valid**.
2. **Accept** — Subject submits `CredentialAccept` → flips `lsfAccepted` flag, credential becomes valid; reserve burden transfers from issuer to subject.
3. **Delete** — Either issuer or subject can submit `CredentialDelete` at any time. Anyone can delete an expired credential.

### CredentialCreate Transaction Fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `Subject` | Yes | AccountID | The account the credential is about |
| `Issuer` | Yes | AccountID | Must be the transaction sender |
| `CredentialType` | Yes | Blob (hex) | Identifies credential type; max 64 bytes |
| `Expiration` | No | UInt32 | Seconds since Ripple Epoch; must be in the future |
| `URI` | No | String | Link to off-chain data (e.g., VC document); max 256 bytes |

### CredentialAccept Transaction

Sent by the **subject**. References the credential by `Issuer` + `CredentialType`. Flips `lsfAccepted` and moves the reserve to the subject.

### CredentialDelete Transaction

| Field | Required | Type | Notes |
|---|---|---|---|
| `Account` | Yes | AccountID | Sender (issuer, subject, or anyone if expired) |
| `Issuer` | Conditional | AccountID | Required if sender is not the issuer |
| `Subject` | Conditional | AccountID | Required if sender is not the subject |
| `CredentialType` | Yes | Blob (hex) | Identifies which credential to delete |

### Credential Ledger Object

| Field | Description |
|---|---|
| `Subject` | Account the credential is about |
| `Issuer` | Account that issued the credential |
| `CredentialType` | Hex-encoded type identifier |
| `Expiration` | Optional expiration time |
| `URI` | Optional link to additional data |
| `lsfAccepted` | Flag: whether subject has accepted |
| `IssuerNode` / `SubjectNode` | Directory pagination hints |
| `PreviousTxnID` / `PreviousTxnLgrSeq` | Last modification tracking |

A credential is **valid** only when `lsfAccepted` is true AND it hasn't expired.

### DepositPreauth Integration

`DepositPreauth` objects can now hold arrays of issuer–credential-type pairs instead of whitelisting individual accounts. Incoming transactions include a `CredentialIDs` field, and the ledger validates that referenced credentials are valid.

---

## Permissioned Domains (XLS-80)

### PermissionedDomain Ledger Object

| Field | Type | Description |
|---|---|---|
| `Owner` | AccountID | Domain creator; only they can modify/delete |
| `Sequence` | UInt32 | Sequence number of the creating transaction |
| `AcceptedCredentials` | STArray | List of 1–10 accepted credential descriptors |
| `Flags` | UInt32 | Object flags |
| `OwnerNode` | UInt64 | Directory pagination hint |
| `PreviousTxnID` | Hash256 | Hash of last modifying transaction |
| `PreviousTxnLgrSeq` | UInt32 | Ledger index of last modification |

### AcceptedCredentials Array

Each entry contains:
- `Issuer` (AccountID) — the **credential issuer** (NOT the currency issuer — "Issuer" is overloaded)
- `CredentialType` (Blob, hex) — max 64 bytes; the type label from `CredentialCreate`

The array is sorted by `Issuer` for efficient lookup. **OR logic**: an account needs only **one** matching credential to be a domain member (AND is not supported).

### Membership Rules

- Membership is **automatic** — if you hold an accepted credential, you're in.
- No explicit "join" transaction needed.
- The domain owner does **not** need to hold a credential themselves.
- A `PermissionedDomain` is a **deletion blocker** — the owner account can't be deleted while a domain exists.

### PermissionedDomainSet Transaction

Creates or modifies a domain.

| Field | Required | Type | Notes |
|---|---|---|---|
| `TransactionType` | Yes | String | `"PermissionedDomainSet"` |
| `Account` | Yes | AccountID | Must be the domain owner |
| `DomainID` | No | Hash256 | Required for modifications; omit to create |
| `AcceptedCredentials` | Yes | STArray | 1–10 credential descriptors |

**Failure conditions:**
- Credential issuer doesn't exist on ledger
- `AcceptedCredentials` empty or > 10 items
- `CredentialType` empty or > 64 bytes
- On modify: domain doesn't exist or sender isn't owner

### PermissionedDomainDelete Transaction

| Field | Required | Type |
|---|---|---|
| `TransactionType` | Yes | `"PermissionedDomainDelete"` |
| `Account` | Yes | AccountID (must be owner) |
| `DomainID` | Yes | Hash256 |

---

## Permissioned DEX (XLS-81) — Proposed

The Permissioned DEX amendment extends the open DEX to support credential-gated order books. It builds on XLS-80 and modifies `Offer` objects, `OfferCreate`, and `Payment` transactions.

### Key Concept

Each permissioned domain gets its own **separate order book**. Offers in one domain cannot match offers in another domain or the open DEX. This is enforced at the protocol level.

### OfferCreate Modifications

New optional field:
- **`DomainID`** (Hash256) — if present, the offer is placed in the domain-specific order book instead of the open one.

**Credential check**: the account must hold at least one credential accepted by the domain, or the transaction fails.

### Offer Ledger Object Modifications

| New Field | Type | Description |
|---|---|---|
| `DomainID` | Hash256 | Present only on permissioned offers |
| `BookDirectories` | Vector256 | Replaces `BookDirectory` for multi-directory support |
| `BookNodes` | STArray | Pagination hints for multiple directories |

An offer becomes **invalid** if:
- Its domain is deleted
- The owner's matching credential expires or is revoked

### Matching Rules (Strict Separation)

| Scenario | Allowed? |
|---|---|
| Permissioned offer ↔ same-domain permissioned offer | Yes |
| Permissioned offer ↔ different-domain offer | **No** |
| Permissioned offer ↔ open offer | **No** |
| Open offer ↔ permissioned offer | **No** |
| Open offer ↔ open offer | Yes |

### Payment Transaction Modifications

New optional field:
- **`DomainID`** (Hash256) — only valid for cross-currency payments.

When present:
- Payment must be cross-currency
- Domain must exist
- Sender must be a domain member
- Paths must comply with domain rules

### RPC Method Updates

| Method | Change |
|---|---|
| `book_offers` | New `domain` parameter to filter by domain |
| `path_find` | New `domain` parameter for domain-compliant routes |
| `ripple_path_find` | New `domain` parameter |
| `books` subscription | New `domain` parameter for streaming |
| `book_changes` | Response includes `domain` field |
| `book_changes` subscription | Tracks changes per domain |

### Not Yet Covered

- AMMs in permissioned domains (noted as future work)
- NFT offers in permissioned domains (excluded from XLS-81)

---

## Relevance to This Project

Our app currently supports open DEX trading via `OfferCreate`. The existing currency issuer wallet is completely independent of the permissioned domain system — currency issuance and trust lines don't change.

### Role Mapping for Our App

The simplest approach is to have the existing **issuer wallet** serve as both the credential issuer and the domain owner. This collapses three roles into one for ease of use, but the API routes themselves don't enforce this coupling.

```
Our "issuer" wallet  ──→  Currency Issuer    (already does this)
                     ──→  Credential Issuer  (new: issues KYC-like credentials)
                     ──→  Domain Owner       (new: creates permissioned domains)

Our "recipient" wallets ──→  Credential Subjects  (accept credentials)
                        ──→  Domain Members        (automatic if credentialed)
                        ──→  Traders               (place offers in domain books)
```

### Integration Points

1. **Credential management** — UI for creating, accepting, and viewing credentials (`CredentialCreate`, `CredentialAccept`).
2. **Domain creation** — Let the issuer create permissioned domains referencing credential types (`PermissionedDomainSet`).
3. **Permissioned trading** — Add `DomainID` field to `OfferCreate` to place offers in domain-specific order books.
4. **Domain-filtered order book** — Pass `domain` parameter to `book_offers` to show permissioned order book depth.
5. **Credential-gated access** — Check if a user holds required credentials before showing permissioned trading UI.

### Implementation Priority

- XLS-80 (Permissioned Domains) + XLS-70 (Credentials) are **live on mainnet** — can implement credential and domain management now.
- XLS-81 (Permissioned DEX) is **proposed but not yet activated** — however, xrpl.js v4.5.0 already supports `DomainID` on `OfferCreate` and `domain` on `BookOffersRequest`, so we can build the full stack and test when the amendment activates on testnet/devnet.

### xrpl.js v4.5.0 Support

All transaction types are fully typed in the installed xrpl package:
- `CredentialCreate`, `CredentialAccept`, `CredentialDelete`
- `PermissionedDomainSet`, `PermissionedDomainDelete`
- `OfferCreate.DomainID` (optional field)
- `OfferCreateFlags.tfHybrid` (offer in both domain + open book)
- `BookOffersRequest.domain` (optional filter)
- `AuthorizeCredential` type for `AcceptedCredentials`

---

## Sources

- [Permissioned Domains concept](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/permissioned-domains)
- [XLS-0080: Permissioned Domains spec](https://xls.xrpl.org/xls/XLS-0080-permissioned-domains.html)
- [XLS-81d: Permissioned DEXes discussion](https://github.com/XRPLF/XRPL-Standards/discussions/229)
- [Credentials concept](https://xrpl.org/docs/concepts/decentralized-storage/credentials)
- [CredentialCreate transaction](https://xrpl.org/docs/references/protocol/transactions/types/credentialcreate)
- [Credential ledger object](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/credential)
- [Create Permissioned Domains tutorial](https://xrpl.org/docs/tutorials/javascript/compliance/create-permissioned-domains)
- [Credentials: Building a Compliant Identity Layer (DEV article)](https://dev.to/ripplexdev/credentials-building-a-compliant-identity-layer-for-the-xrp-ledger-155e)
- [XLS-0070: On-Chain Credentials spec](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0070d-credentials)
