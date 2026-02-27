-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "matchedFaqId" TEXT,
    "matchScore" INTEGER,
    "wasHelpful" BOOLEAN,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);
