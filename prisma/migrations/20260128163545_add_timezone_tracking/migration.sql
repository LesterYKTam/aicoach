-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "localDate" DATE,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';

-- CreateIndex
CREATE INDEX "Submission_localDate_idx" ON "Submission"("localDate");
