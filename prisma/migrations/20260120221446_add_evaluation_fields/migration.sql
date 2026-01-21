/*
  Warnings:

  - You are about to drop the column `evaluation` on the `Submission` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "evaluation",
ADD COLUMN     "bodyParagraphCount" INTEGER,
ADD COLUMN     "coachTip" TEXT,
ADD COLUMN     "gradeLevel" INTEGER,
ADD COLUMN     "hasConclusion" BOOLEAN,
ADD COLUMN     "hasIntroduction" BOOLEAN,
ADD COLUMN     "nextSteps" JSONB,
ADD COLUMN     "requiresRewrite" BOOLEAN,
ADD COLUMN     "rubricComments" JSONB,
ADD COLUMN     "rubricVersionId" TEXT,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "scoreApplication" INTEGER,
ADD COLUMN     "scoreCommunication" INTEGER,
ADD COLUMN     "scoreKnowledge" INTEGER,
ADD COLUMN     "scoreThinking" INTEGER,
ADD COLUMN     "strengths" JSONB,
ADD COLUMN     "structureComplete" BOOLEAN,
ADD COLUMN     "tagsApplication" JSONB,
ADD COLUMN     "tagsCommunication" JSONB,
ADD COLUMN     "tagsKnowledge" JSONB,
ADD COLUMN     "tagsThinking" JSONB;

-- CreateIndex
CREATE INDEX "Submission_score_idx" ON "Submission"("score");

-- CreateIndex
CREATE INDEX "Submission_rubricVersionId_idx" ON "Submission"("rubricVersionId");
