/*
  Warnings:

  - You are about to drop the column `recipient_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `recipients` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "recipients" DROP CONSTRAINT "recipients_user_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_recipient_id_fkey";

-- DropIndex
DROP INDEX "transactions_user_id_recipient_id_idx";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "recipient_id",
ADD COLUMN     "recipient" TEXT;

-- DropTable
DROP TABLE "recipients";
