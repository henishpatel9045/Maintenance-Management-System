import { db } from "../../core/db";

export async function generateSevaCode(): Promise<string> {
  // Query max code number matching SEV-XXXX
  const latest = await db.seva.findFirst({
    where: { code: { startsWith: "SEV-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!latest) {
    return "SEV-0001";
  }

  const parts = latest.code.split("-");
  const num = parseInt(parts[1] || "0", 10);
  const nextNum = isNaN(num) ? 1 : num + 1;
  return `SEV-${String(nextNum).padStart(4, "0")}`;
}
