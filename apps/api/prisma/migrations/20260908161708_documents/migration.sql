-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LOAN_AGREEMENT', 'ADDENDUM', 'TRANSFER_CONFIRMATION', 'CLOSURE_CONFIRMATION', 'CLAIM', 'LEGAL_PACKAGE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('GENERATED', 'LOCKED', 'SIGNED', 'VOIDED');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "file_key" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_loan_id_created_at_idx" ON "documents"("loan_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_loan_id_type_version_key" ON "documents"("loan_id", "type", "version");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
