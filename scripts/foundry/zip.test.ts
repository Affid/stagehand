import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { zip } from "./zip.ts";

describe("the test packages' zip", () => {
  test("another zip reader lists and reads back every file", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-zip-"));
    try {
      const file = join(dir, "pkg.zip");
      writeFileSync(
        file,
        zip([
          { name: "module.json", data: Buffer.from('{"id":"x"}') },
          { name: "scripts/a.js", data: Buffer.alloc(5000, 7) },
        ]),
      );
      // Python's zipfile checks the CRCs as it reads.
      const out = execFileSync(
        "python3",
        [
          "-I",
          "-c",
          "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(*[f'{i.filename}:{i.file_size}' for i in z.infolist()]);print(z.read('module.json').decode())",
          file,
        ],
        { encoding: "utf8" },
      ).trim();
      expect(out.split("\n")).toEqual([
        "None",
        "module.json:10 scripts/a.js:5000",
        '{"id":"x"}',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
