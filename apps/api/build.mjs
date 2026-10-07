import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { zipSync } from "fflate";

const root = dirname(fileURLToPath(import.meta.url));
const handlersDir = join(root, "src/handlers");
const distDir = join(root, "dist");

// Local time on purpose: zip stores DOS timestamps without timezone,
// and 1980-01-01 local is the DOS epoch (earliest representable date).
const ZIP_MTIME = new Date(1980, 0, 1);

const names = readdirSync(handlersDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const manifest = {};

for (const name of names) {
	const result = await build({
		absWorkingDir: root,
		entryPoints: [`src/handlers/${name}/index.ts`],
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node24",
		write: false,
		outfile: "index.mjs",
		legalComments: "none",
		// Lets CJS dependencies call require() inside an ESM bundle.
		banner: {
			js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
		},
	});

	const zip = zipSync({
		"index.mjs": [result.outputFiles[0].contents, { mtime: ZIP_MTIME }],
	});
	writeFileSync(join(distDir, `${name}.zip`), zip);

	manifest[name] = {
		zip: `${name}.zip`,
		handler: "index.handler",
		// Same format as Terraform filebase64sha256 / Lambda CodeSha256.
		sha256: createHash("sha256").update(zip).digest("base64"),
	};
	console.log(`${name}: ${zip.byteLength} B ${manifest[name].sha256}`);
}

writeFileSync(
	join(distDir, "manifest.json"),
	`${JSON.stringify(manifest, null, "\t")}\n`,
);
