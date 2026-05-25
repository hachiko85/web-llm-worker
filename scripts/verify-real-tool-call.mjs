import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8787";
const headless = !process.argv.includes("--headed");

const browserCandidates = [
  process.env.BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const executablePath = browserCandidates.find((path) => existsSync(path));
if (!executablePath) {
  throw new Error("Chrome or Edge executable was not found. Set BROWSER_PATH to run real model verification.");
}

const browser = await chromium.launch({
  executablePath,
  headless,
  args: ["--enable-features=WebGPU"]
});

const context = await browser.newContext({
  viewport: {
    width: 1280,
    height: 900
  }
});

const page = await context.newPage();
page.setDefaultTimeout(20 * 60 * 1000);

try {
  await page.goto(`${baseUrl}/test-sites/site-a/`);
  await page.waitForFunction(() => typeof window.RewriteLLM === "function");

  const result = await page.evaluate(async () => {
    const searchTool = {
      type: "function",
      function: {
        name: "searchArticles",
        description: "記事検索フィルターを作成する",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            keyword: {
              type: "string",
              description: "検索キーワード。自然な日本語から名詞句だけを短く抽出する。「お祭り」は「祭り」に正規化する。"
            },
            "ins-from": {
              type: "string",
              description: "掲載日の開始日。YYYY-MM-DD。"
            },
            "ins-to": {
              type: "string",
              description: "掲載日の終了日。YYYY-MM-DD。"
            },
            tags: {
              type: "array",
              description: "タグ候補から選ぶ。",
              items: {
                type: "string",
                enum: ["報知", "記事", "お知らせ"]
              }
            }
          },
          required: ["keyword", "ins-from", "ins-to", "tags"]
        }
      }
    };

    const parseChecks = {
      valid: window.RewriteLLM.parseToolCall(
        '<tool_call>\n{"name":"searchArticles","arguments":{"keyword":"祭り","ins-from":"2026-01-01","ins-to":"2026-03-03","tags":["記事"]}}\n</tool_call>',
        searchTool
      ),
      normalTextFailure: null,
      malformedFailure: null,
      unknownToolFailure: null
    };

    for (const [key, raw] of Object.entries({
      normalTextFailure: "検索条件を作れませんでした。",
      malformedFailure: "<tool_call>{broken json</tool_call>",
      unknownToolFailure: '<tool_call>{"name":"deleteEverything","arguments":{}}</tool_call>'
    })) {
      try {
        window.RewriteLLM.parseToolCall(raw, searchTool);
      } catch (error) {
        parseChecks[key] = {
          name: error.name,
          message: error.message,
          reason: error.reason,
          raw: error.raw
        };
      }
    }

    const llm = new window.RewriteLLM({
      alias: "rewrite-llm-real-tool-call",
      mock: false,
      modelSource: {
        remoteHost: new URL("/models/", window.location.origin).href,
        remotePathTemplate: "{model}/resolve/{revision}/",
        cacheKey: "rewrite-llm-local-models"
      },
      persistence: false,
      timeoutMs: 20 * 60 * 1000
    });

    await llm.ready();
    const call = await llm.extractToolCall(
      "今年の一月から2026-03-03に掲載されたお祭りに関する記事を調べて",
      searchTool,
      {
        currentDate: "2026-05-24",
        max_new_tokens: 192,
        do_sample: false,
        return_full_text: false
      },
      {
        timeoutMs: 20 * 60 * 1000
      }
    );

    const conditionPrompt = [
      "You are configuring only the provided article search condition tool.",
      "Call the tool only when the user request can be converted into article search conditions.",
      "A valid request should provide or imply a search keyword, publication date range, and one of the available tag candidates.",
      "If the prompt is unrelated to article search conditions, do not call the tool.",
      "When you do not call the tool, return this exact Japanese message: 記事検索条件を設定するには、検索キーワード、掲載日の開始日と終了日、タグ候補を指定してください。"
    ].join("\n");

    const unrelated = await llm.tryExtractToolCall(
      "カレーの作り方を教えて",
      searchTool,
      {
        currentDate: "2026-05-25",
        toolMode: "auto",
        systemPrompt: conditionPrompt,
        max_new_tokens: 192,
        do_sample: false,
        return_full_text: false
      },
      {
        timeoutMs: 20 * 60 * 1000
      }
    );

    return {
      parseChecks,
      call,
      unrelated
    };
  });

  console.log(JSON.stringify({
    executablePath,
    baseUrl,
    ...result
  }, null, 2));

  const args = result.call.arguments;
  const hasRequiredShape = (
    result.call.name === "searchArticles"
    && typeof args.keyword === "string"
    && typeof args["ins-from"] === "string"
    && typeof args["ins-to"] === "string"
    && Array.isArray(args.tags)
  );
  const matchesExpectedExample = (
    String(args.keyword).includes("祭")
    && args["ins-from"] === "2026-01-01"
    && args["ins-to"] === "2026-03-03"
    && args.tags.length === 1
    && args.tags[0] === "記事"
  );

  if (!hasRequiredShape) {
    throw new Error("Real Bonsai tool call did not return the required parsed shape.");
  }
  if (!matchesExpectedExample) {
    throw new Error(`Real Bonsai tool call parsed, but did not match the expected example arguments: ${JSON.stringify(args)}`);
  }

  for (const key of ["normalTextFailure", "malformedFailure", "unknownToolFailure"]) {
    if (result.parseChecks[key]?.name !== "ToolCallParseError") {
      throw new Error(`Parser failure case "${key}" did not return ToolCallParseError.`);
    }
  }
  if (result.unrelated.ok !== false) {
    throw new Error(`Unrelated prompt unexpectedly returned a tool call: ${JSON.stringify(result.unrelated)}`);
  }
  if (!result.unrelated.message || result.unrelated.message.length < 10) {
    throw new Error("Unrelated prompt did not return a useful guidance message.");
  }
} finally {
  await browser.close();
}
