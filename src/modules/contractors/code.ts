import { db } from "@/core/db";

export async function generateContractorCode(): Promise<string> {
  const lastContractor = await db.contractor.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  if (!lastContractor || !lastContractor.code) {
    return "CON-0001";
  }

  const match = lastContractor.code.match(/CON-(\d+)/);
  if (!match || !match[1]) {
    return "CON-0001";
  }

  const nextSeq = parseInt(match[1], 10) + 1;
  return `CON-${String(nextSeq).padStart(4, "0")}`;
}

export async function generateContractorRequestCode(): Promise<string> {
  const lastRequest = await db.contractorRequest.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  if (!lastRequest || !lastRequest.code) {
    return "CRQ-0001";
  }

  const match = lastRequest.code.match(/CRQ-(\d+)/);
  if (!match || !match[1]) {
    return "CRQ-0001";
  }

  const nextSeq = parseInt(match[1], 10) + 1;
  return `CRQ-${String(nextSeq).padStart(4, "0")}`;
}

export const generateRequestCode = generateContractorRequestCode;
