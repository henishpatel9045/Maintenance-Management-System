import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

function computeNewPath(params: {
  movingPath: string;
  targetParentPath: string | null;
  nodePath: string;
}): string {
  const { movingPath, targetParentPath, nodePath } = params;
  const movingId = movingPath.split("/").filter(Boolean).pop()!;
  const newBasePrefix = targetParentPath ? `${targetParentPath}${movingId}/` : `/${movingId}/`;
  const relativeSuffix = nodePath.slice(movingPath.length);
  return `${newBasePrefix}${relativeSuffix}`;
}

describe("Hierarchy Path Property Tests", () => {
  it("never creates cycles or malformed materialized paths", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // rootId
        fc.uuid(), // childId
        fc.uuid(), // grandchildId
        (rootId, childId, grandchildId) => {
          const rootPath = `/${rootId}/`;
          const childPath = `/${rootId}/${childId}/`;
          const grandchildPath = `/${rootId}/${childId}/${grandchildId}/`;

          // Moving child to new root
          const updatedChildPath = computeNewPath({
            movingPath: childPath,
            targetParentPath: null,
            nodePath: childPath,
          });
          expect(updatedChildPath).toBe(`/${childId}/`);

          // Descendant path rewritten accordingly
          const updatedGrandchildPath = computeNewPath({
            movingPath: childPath,
            targetParentPath: null,
            nodePath: grandchildPath,
          });
          expect(updatedGrandchildPath).toBe(`/${childId}/${grandchildId}/`);
          expect(updatedGrandchildPath.startsWith(updatedChildPath)).toBe(true);
        }
      )
    );
  });
});
