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
- internal document lock operation for first signature
- list / metadata / authenticated PDF download endpoints
- generation moves loan to `WAITING_LENDER_SIGNATURE`

## Important alpha constraint
The final PDF currently requires both lender and borrower to already have accounts with completed FIO + IIN profiles. The invitation/onboarding flow that links a new borrower is the next block (DOLG-055–058).

## Next implementation boundary
DOLG-046–058: signature provider abstraction, SIGEX/eGov signing and borrower invitations.
