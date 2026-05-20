import { copyFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await mkdir(dist, { recursive: true });
await copyFile(new URL("USAGE.md", root), new URL("USAGE.md", dist));
await copyFile(new URL("DEPLOYMENT_JA.md", root), new URL("DEPLOYMENT_JA.md", dist));
