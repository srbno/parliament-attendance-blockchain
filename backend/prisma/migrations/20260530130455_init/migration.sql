/*
  Warnings:

  - You are about to drop the column `evidencePayloadJson` on the `AttendanceRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "evidencePayloadJson";
