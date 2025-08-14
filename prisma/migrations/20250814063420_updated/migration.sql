-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_number" TEXT,
    "statement_period" JSONB,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "file_path" TEXT NOT NULL,
    "extracted_data" JSONB,
    "analysis_result" JSONB,
    "error_message" TEXT,
    "processing_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_transactions" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DECIMAL(10,2),
    "reference" TEXT,
    "category" TEXT,
    "merchant" TEXT,
    "confidence" DOUBLE PRECISION,
    "raw_data" JSONB,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_with_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statements_user_id_idx" ON "bank_statements"("user_id");

-- CreateIndex
CREATE INDEX "bank_statements_status_idx" ON "bank_statements"("status");

-- CreateIndex
CREATE INDEX "bank_statements_created_at_idx" ON "bank_statements"("created_at");

-- CreateIndex
CREATE INDEX "statement_transactions_statement_id_idx" ON "statement_transactions"("statement_id");

-- CreateIndex
CREATE INDEX "statement_transactions_date_idx" ON "statement_transactions"("date");

-- CreateIndex
CREATE INDEX "statement_transactions_category_idx" ON "statement_transactions"("category");

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_transactions" ADD CONSTRAINT "statement_transactions_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
