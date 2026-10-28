import fs from "fs/promises";
import path from "path";

async function main() {
  const args = process.argv.slice(2);
  const moduleName = args[0]?.toLowerCase().trim();

  if (!moduleName) {
    console.error("Usage: npm run new:module -- <module_name>");
    process.exit(1);
  }

  const capitalized = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const targetDir = path.resolve(process.cwd(), "src/modules", moduleName);

  try {
    await fs.mkdir(targetDir, { recursive: true });

    // 1. Manifest
    const manifestContent = `import { ModuleManifest } from "../registry";

export const ${moduleName}Manifest: ModuleManifest = {
  id: "${moduleName}",
  name: "${capitalized} Module",
  version: "1.0.0",
  description: "Capability module for ${moduleName}",
  navItems: [
    {
      id: "${moduleName}",
      label: "${capitalized}",
      href: "/${moduleName}",
      icon: "Layers",
      order: 80,
      requiredPermission: "${moduleName}.view",
    },
  ],
  permissionKeys: ["${moduleName}.view", "${moduleName}.manage"],
  settingsKeys: ["module.${moduleName}.enabled"],
  dashboardWidgets: ["${capitalized}Widget"],
  reportSections: ["${capitalized}Section"],
  searchProvider: async (query: string, userId: string) => {
    return [];
  },
};
`;
    await fs.writeFile(path.join(targetDir, "manifest.ts"), manifestContent);

    // 2. Schemas
    const schemasContent = `import { z } from "zod";

export const create${capitalized}Schema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const update${capitalized}Schema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
  })
  .strict();

export type Create${capitalized}Input = z.infer<typeof create${capitalized}Schema>;
export type Update${capitalized}Input = z.infer<typeof update${capitalized}Schema>;
`;
    await fs.writeFile(path.join(targetDir, "schemas.ts"), schemasContent);

    // 3. Service
    const serviceContent = `import { Create${capitalized}Input, Update${capitalized}Input } from "./schemas";
import { logAudit } from "../../core/audit/audit";

export class ${capitalized}Service {
  public static async create(input: Create${capitalized}Input, userId: string) {
    await logAudit({
      entityType: "${moduleName.toUpperCase()}",
      entityId: "new-id",
      userId,
      action: "CREATE_${moduleName.toUpperCase()}",
      newValue: input,
    });
    return { id: "mock-id", ...input, createdAt: new Date() };
  }

  public static async list() {
    return [];
  }
}
`;
    await fs.writeFile(path.join(targetDir, "service.ts"), serviceContent);

    // 4. Index
    const indexContent = `export * from "./manifest";
export * from "./schemas";
export * from "./service";
`;
    await fs.writeFile(path.join(targetDir, "index.ts"), indexContent);

    console.log(`\nSuccessfully scaffolded module "${moduleName}" at: src/modules/${moduleName}/`);
    console.log(`\nTo register this module:`);
    console.log(`1. Add to src/modules/registry.ts:`);
    console.log(`   import { ${moduleName}Manifest } from "./${moduleName}";`);
    console.log(`   registerModule(${moduleName}Manifest);`);
    console.log(`2. If database models are needed, add an additive section to prisma/schema.prisma\n`);
  } catch (err) {
    console.error("Failed to generate module:", err);
    process.exit(1);
  }
}

main();
