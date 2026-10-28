import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { ContractorService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

const setTradesSchema = z.object({
  trades: z.array(
    z.object({
      tradeId: z.string().uuid(),
      isPrimary: z.boolean().optional().default(false),
    })
  ),
}).strict();

export const PUT = withAuth<{ id: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(setTradesSchema, req);
  const result = await ContractorService.setTrades(params.id, body.trades, user.id);

  return NextResponse.json({ success: true, data: result });
});
