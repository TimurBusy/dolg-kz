# Dolg.kz — Implementation Status

Snapshot: 2026-09-07

## Implemented

### Sprint 1 / Foundation — DOLG-001–010
- npm workspaces monorepo
- Next.js 16.3.3 web app
- NestJS 12.0.1 API
- PostgreSQL + Redis docker-compose
- Prisma 7.10 with PostgreSQL driver adapter
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
- deterministic IIN hash for future matching
- masked IIN output
- login and profile pages

### Sprint 3 / Loans Core — DOLG-026–038
- Loan, LoanTerms, LoanSequence models
- human-readable contract numbers `DLG-YYYY-NNNNNN`
- loan state machine definition
- create / list / get / update / delete draft APIs
- borrower linking by phone if already registered
- access control for loan parties
- responsive loans list
- 4-step create-loan wizard
- loan details page

## Verification performed in this environment
- JSON configuration parsing: PASS
- TS/TSX syntax transpilation check: PASS
- `git diff --check`: PASS

## Not runtime-verified here
The execution environment does not provide Docker and npm registry access timed out, so dependencies could not be installed and PostgreSQL/Redis containers could not be launched here. Run the documented local setup to perform full build, Prisma generation/migration and end-to-end tests.

## Next implementation boundary
DOLG-039–058: documents, immutable versions, PDF generation, signature provider abstraction, SIGEX/eGov signing and borrower invitations.
