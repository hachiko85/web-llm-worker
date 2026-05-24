import { createWriteStream, existsSync, statSync } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const repo = "onnx-community/Ternary-Bonsai-4B-ONNX";
const revision = "main";
const baseUrl = `https://huggingface.co/${repo}/resolve/${revision}`;
const outputRoot = resolve("public", "models", repo, "resolve", revision);

const files = [
  { path: "chat_template.jinja", size: 4063 },
  { path: "config.json", size: 2348 },
  { path: "generation_config.json", size: 290 },
  { path: "tokenizer.json", size: 9117036 },
  { path: "tokenizer_config.json", size: 4598 },
  { path: "onnx/model_q2f16.onnx", size: 459167 },
  { path: "onnx/model_q2f16.onnx_data", size: 1086368163 }
];

const formatBytes = (bytes) => {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const downloadFile = async ({ path, size }) => {
  const url = `${baseUrl}/${path}`;
  const destination = join(outputRoot, path);
  const temporary = `${destination}.part`;
  await mkdir(dirname(destination), { recursive: true });

  if (existsSync(destination) && statSync(destination).size === size) {
    console.log(`skip ${path} (${formatBytes(size)})`);
    return;
  }

  if (existsSync(destination)) {
    await unlink(destination);
  }

  let offset = existsSync(temporary) ? statSync(temporary).size : 0;
  if (offset > size) {
    await unlink(temporary);
    offset = 0;
  }

  const headers = offset > 0 ? { Range: `bytes=${offset}-` } : {};
  console.log(`${offset > 0 ? "resume" : "download"} ${path} from ${formatBytes(offset)} / ${formatBytes(size)}`);

  const response = await fetch(url, {
    headers,
    redirect: "follow"
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createWriteStream(temporary, { flags: offset > 0 ? "a" : "w" });
    let downloaded = offset;
    let lastLog = Date.now();

    response.body.pipeTo(new WritableStream({
      write(chunk) {
        downloaded += chunk.byteLength;
        const now = Date.now();
        if (now - lastLog > 2000) {
          lastLog = now;
          const pct = size ? `${(downloaded / size * 100).toFixed(1)}%` : "unknown";
          console.log(`  ${path}: ${formatBytes(downloaded)} / ${formatBytes(size)} (${pct})`);
        }
        return new Promise((resolveWrite, rejectWrite) => {
          stream.write(Buffer.from(chunk), (error) => {
            if (error) {
              rejectWrite(error);
            } else {
              resolveWrite();
            }
          });
        });
      },
      close() {
        stream.end(resolvePromise);
      },
      abort(error) {
        stream.destroy();
        rejectPromise(error);
      }
    })).catch((error) => {
      stream.destroy();
      rejectPromise(error);
    });
  });

  const actual = statSync(temporary).size;
  if (actual !== size) {
    throw new Error(`Downloaded size mismatch for ${path}: expected ${size}, got ${actual}`);
  }

  await rename(temporary, destination);
  console.log(`done ${path} (${formatBytes(size)})`);
};

for (const file of files) {
  await downloadFile(file);
}

console.log(`Bonsai q2f16 mirror is ready under ${outputRoot}`);
