# Dolg.kz — Implementation Status

Snapshot: 2026-09-08

## Implemented

### Sprint 1 / Foundation — DOLG-001–010
- npm workspaces monorepo
- Next.js web app
- NestJS API
- PostgreSQL + Redis docker-compose
- Prisma 7 with PostgreSQL driver adapter
- Swagger at `/api/docs`
- `/api/v1/health`
- responsive app shell and UI primitives
- GitHub Actions CI scaffold

### Sprint 2 / Auth & Profile — DOLG-012–025
- User, Identity, UserSession models
- OTP request / verify endpoints
- Redis OTP TTL and rate limiting
- access + refresh JWT
- refresh token rotation / reuse detection
- session revocation
- `/me` profile API
- AES-256-GCM field encryption for IIN
- deterministic IIN hash for matching
- masked IIN output
- login and profile pages

### Sprint 3 / Loans Core — DOLG-026–038
- Loan, LoanTerms, LoanSequence models
- human-readable contract numbers `DLG-YYYY-NNNNNN`
- loan state machine
- create / list / get / update / delete draft APIs
- borrower linking by phone
- access control for loan parties
- loans list, dashboard and create-loan wizard
- active-route navigation

### Sprint 4 / Documents — DOLG-039–045
- Document model, types, versions and statuses
- S3-compatible document storage
- local MinIO service
- Cyrillic PDF loan agreement generation
- SHA-256 document integrity hash
- immutable loan terms after agreement generation
- document locking before the first signature
- list / metadata / authenticated PDF download endpoints
- generation moves loan to `WAITING_LENDER_SIGNATURE`

### Sprint 5 / Invitations & Signing — DOLG-046–058
- signature provider abstraction
- SIGEX provider implementation
- eGov Mobile QR / deep-link flow
- first signer (lender) signs PDF through eGov
- first signature is registered in SIGEX together with document bytes
- signer IIN is checked against the expected lender IIN
- SIGEX document ID and signature ID are persisted
- certificate/signature technical metadata is persisted for audit
- document remains immutable after signing begins
- borrower signs second through the document eGov QR flow
- borrower IIN is checked against the expected borrower IIN
- after two valid signatures document and loan become `SIGNED`
- invitation model with hashed one-time token
- invitation is restricted to the borrower phone specified in the loan
- public invitation preview page
- login return path and borrower profile onboarding
- loan page UI for invitation link, eGov QR, deep link and signing status polling

## Security notes
- raw invitation tokens are not stored in the database; only SHA-256 hashes are persisted
- private EDS keys are never handled or stored by Dolg.kz
- SIGEX-returned operation URLs are allow-listed to HTTPS SIGEX hosts
- IIN from the actual electronic signature is compared with the IIN stored for the expected party
- certificate metadata is stored internally but not exposed by the public signature response

## Manual E2E verification still required
The SIGEX/eGov implementation uses the live external signing flow. CI can validate TypeScript/build structure, but a real two-person signing scenario must be verified manually using eGov Mobile before the feature is considered production-ready.

See `docs/TESTING_SIGNING.md`.

## Next implementation boundary
DOLG-059–067: transfer of money, receipt upload, borrower confirmation and active-loan dashboard state.
