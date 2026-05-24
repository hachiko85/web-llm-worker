const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8787";
const files = [
  { path: "chat_template.jinja", minBytes: 1 },
  { path: "config.json", minBytes: 1 },
  { path: "generation_config.json", minBytes: 1 },
  { path: "tokenizer.json", minBytes: 1 },
  { path: "tokenizer_config.json", minBytes: 1 },
  { path: "onnx/model_q2f16.onnx", minBytes: 459167 },
  { path: "onnx/model_q2f16.onnx_data", minBytes: 1086368163, range: "bytes=0-1023" }
];

const root = `${baseUrl}/models/onnx-community/Ternary-Bonsai-4B-ONNX/resolve/main`;
const results = [];

for (const file of files) {
  const url = `${root}/${file.path}`;
  const head = await fetch(url, { method: "HEAD" });
  const length = Number(head.headers.get("content-length") || "0");
  const range = file.range
    ? await fetch(url, { headers: { Range: file.range } })
    : null;

  results.push({
    path: file.path,
    headStatus: head.status,
    contentLength: length,
    rangeStatus: range?.status,
    ok: head.ok && length >= file.minBytes && (!range || range.status === 206)
  });
}

console.log(JSON.stringify(results, null, 2));

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  throw new Error(`Model serving verification failed for: ${failed.map((item) => item.path).join(", ")}`);
}
