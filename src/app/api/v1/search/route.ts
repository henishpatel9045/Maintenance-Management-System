import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (req, { user }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const canViewQuotes = can(user, "quotes.view");

  // 1. Search Sevas
  const sevas = await db.seva.findMany({
    where: {
      isArchived: false,
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      priority: true,
      isGroup: true,
      category: { select: { name: true } },
    },
    take: 15,
  });

  // 2. Search Files
  const files = await db.sevaFile.findMany({
    where: {
      deletedAt: null,
      ...(!canViewQuotes ? { bucket: "ARTEFACT" } : {}),
      OR: [
        { caption: { contains: q, mode: "insensitive" } },
        { label: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { fileObject: { originalName: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      sevaId: true,
      bucket: true,
      caption: true,
      label: true,
      supplierName: true,
      fileObject: { select: { originalName: true, mimeType: true } },
      seva: { select: { code: true, title: true } },
    },
    take: 15,
  });

  // 3. Search Comments
  const comments = await db.comment.findMany({
    where: {
      deletedAt: null,
      body: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      entityId: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    take: 10,
  });

  // 4. Search Contractors
  let contractorResults: any[] = [];
  const isContractorsEnabled = user.settings?.["module.contractors.enabled"] !== false;
  if (isContractorsEnabled && can(user, "contractors.read")) {
    const { contractorsManifest } = await import("@/modules/contractors/manifest");
    if (contractorsManifest.searchProvider) {
      contractorResults = await contractorsManifest.searchProvider(q, user.id);
    }
  }

  // 5. Search Licences
  let licenceResults: any[] = [];
  const isLicencesEnabled = user.settings?.["module.licences.enabled"] !== false;
  if (isLicencesEnabled) {
    const { licencesManifest } = await import("@/modules/licences/manifest");
    if (licencesManifest.searchProvider) {
      licenceResults = await licencesManifest.searchProvider(q, user.id);
    }
  }

  const results = [
    ...sevas.map((s) => ({
      type: "SEVA",
      id: s.id,
      title: `${s.code}: ${s.title}`,
      subtitle: `${s.category.name} • ${s.priority}${s.isGroup ? " • Project Group" : ""}`,
      linkUrl: `/seva/${s.id}`,
    })),
    ...contractorResults,
    ...licenceResults,
    ...files.map((f) => ({
      type: "FILE",
      id: f.id,
      title: f.label || f.fileObject.originalName,
      subtitle: `${f.bucket} in ${f.seva.code} • ${f.supplierName || f.caption || ""}`,
      linkUrl: `/seva/${f.sevaId}?tab=files`,
    })),
    ...comments.map((c) => ({
      type: "COMMENT",
      id: c.id,
      title: `Comment by ${c.user.name}`,
      subtitle: c.body.slice(0, 100),
      linkUrl: `/seva/${c.entityId}`,
    })),
  ];

  return NextResponse.json({ data: results });
});
