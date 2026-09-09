/*
  Warnings:

  - A unique constraint covering the columns `[provider_document_id]` on the table `documents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('SIGEX');

-- CreateEnum
CREATE TYPE "SignatureRole" AS ENUM ('LENDER', 'BORROWER');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('CREATED', 'WAITING_FOR_USER', 'PROCESSING', 'SIGNED', 'CANCELED', 'FAILED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "provider_document_id" TEXT;

-- CreateTable
CREATE TABLE "loan_invitations" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_by_user_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'SIGEX',
    "role" "SignatureRole" NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'CREATED',
    "provider_operation_id" TEXT,
    "provider_sign_id" INTEGER,
    "certificate_info" JSONB,
    "provider_context" JSONB,
    "qr_code" TEXT,
    "launch_link" TEXT,
    "expire_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "signed_at" TIMESTAMP(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_invitations_token_hash_key" ON "loan_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "loan_invitations_loan_id_status_idx" ON "loan_invitations"("loan_id", "status");

-- CreateIndex
CREATE INDEX "loan_invitations_phone_status_idx" ON "loan_invitations"("phone", "status");

-- CreateIndex
CREATE INDEX "signatures_document_id_role_created_at_idx" ON "signatures"("document_id", "role", "created_at");

-- CreateIndex
CREATE INDEX "signatures_user_id_status_idx" ON "signatures"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_provider_document_id_key" ON "documents"("provider_document_id");

-- AddForeignKey
ALTER TABLE "loan_invitations" ADD CONSTRAINT "loan_invitations_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
