# Manual test — invitation + eGov/SIGEX signing

This is an alpha E2E scenario. Use test amounts and two real people/accounts whose eGov Mobile signatures can be used legitimately.

## Preparation

Run the current main branch:

```bash
git pull
npm install
docker compose up -d
npm run db:generate
npm run prisma:migrate -w @dolg/api -- --name add_invitations_and_signatures
npm run dev
```

Make sure the API has access to the internet because signing talks to SIGEX/eGov.

## Account A — lender

1. Log in to Dolg.kz.
2. Open Profile.
3. Fill surname, first name and a real IIN belonging to Account A.
4. Create a new interest-free loan.
5. Set borrower phone to Account B's phone.
6. Open the loan.
7. Click **Create invitation**.
8. Copy the generated invitation URL.

## Account B — borrower

Use an incognito window, another browser profile or another device.

1. Open the invitation URL.
2. Log in with exactly the borrower phone configured in the loan.
3. Accept the invitation.
4. If redirected to Profile, fill surname, first name and Account B's real IIN.
5. Save. The browser returns to the loan.

## Generate agreement

Back in Account A:

1. Refresh/open the loan.
2. Confirm the borrower is shown as connected.
3. Click **Generate agreement**.
4. Open the PDF and verify names, IINs, amount and due date.
5. The loan should move to `WAITING_LENDER_SIGNATURE`.

## Lender signature

1. In Account A click **Sign through eGov**.
2. Scan the QR in eGov Mobile or use the mobile deep link.
3. Review the document in eGov Mobile and sign it.
4. Dolg.kz polls the signing state.
5. After success, Account A's signature should be `SIGNED`.
6. The loan should move to `WAITING_BORROWER_SIGNATURE`.

If an EDS belonging to another IIN signs the operation, Dolg.kz must reject the result.

## Borrower signature

1. Open the same loan as Account B.
2. Click **Sign through eGov**.
3. Sign with Account B's eGov Mobile.
4. Wait for automatic polling.
5. The document should become `SIGNED`.
6. The loan should become `SIGNED`.

Again, signing with a different IIN must fail.

## What to inspect if something fails

- API console output
- Network request response in browser DevTools
- `signatures.status`, `error`, `providerOperationId` in Prisma Studio
- `documents.providerDocumentId`
- loan state
- GitHub Actions CI output for build/lint failures

Do not paste private keys, EDS files or passwords into issues, logs or chat.
