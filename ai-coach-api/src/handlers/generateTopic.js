const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const OpenAI = require("openai");

const ssm = new SSMClient({});

let cachedKey = null;
let cachedOpenAI = null;

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
};


async function getOpenAIClient() {
  if (cachedOpenAI) return cachedOpenAI;

  const paramName = process.env.OPENAI_API_KEY_PARAM;
  if (!paramName) throw new Error("Missing env OPENAI_API_KEY_PARAM");

  if (!cachedKey) {
    const resp = await ssm.send(
      new GetParameterCommand({ Name: paramName, WithDecryption: true })
    );
    cachedKey = resp.Parameter && resp.Parameter.Value;
    if (!cachedKey) throw new Error("SSM parameter returned empty OpenAI key");
  }

  cachedOpenAI = new OpenAI({ apiKey: cachedKey });
  return cachedOpenAI;
}

exports.handler = async (event) => {

  if (event?.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const grade = Number(body.grade ?? 7);

    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return {
        statusCode: 400,
        headers: { CORS_HEADERS },
        body: JSON.stringify({ ok: false, error: "grade must be a number between 1 and 12" }),
      };
    }

    const client = await getOpenAIClient();


    const wordCountByGrade = {
    1: 60, 2: 80, 3: 100, 4: 130, 5: 160, 6: 200,
    7: 250, 8: 300, 9: 350, 10: 400, 11: 450, 12: 500,
    };
    const targetWordCount = wordCountByGrade[grade] ?? 250;

    const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
            title: { type: "string" },
            prompt: { type: "string" },
            tags: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
            wordCount: { type: "integer", minimum: 50, maximum: 800 },
            paragraphStructure: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        paragraph: { type: "string" },
                        guidance: { type: "string" },
                    },
                    required: ["paragraph", "guidance"],
                },
            },
        },
        required: ["title", "prompt", "tags", "wordCount", "paragraphStructure"],
    };


    const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
        {
        role: "system",
        content:
            "You generate ONE school-appropriate essay topic for students. " +
            "No story prompts. No graphic/sensitive content. " +
            "Return JSON that matches the schema exactly.",
        },
        {
        role: "user",
        content: [
            `Grade: ${grade}`,
            "Generate ONE essay topic.",
            "Include:",
            "- title (short)",
            "- prompt (clear instructions for an essay)",
            "- tags (themes)",
            `- wordCount (ONE number): ${targetWordCount}`,
            "- paragraphStructure: exactly 4 paragraphs (Introduction, Body Paragraph 1, Body Paragraph 2, Conclusion).",
        ].join("\n"),
        },
    ],
    text: {
        format: {
            type: "json_schema",
            name: "essay_topic",
            schema,
        },
    },

    });

    const data = JSON.parse(resp.output_text);

    // Force exact paragraph labels (optional strictness)
    const expected = ["Introduction", "Body Paragraph 1", "Body Paragraph 2", "Conclusion"];
    data.paragraphStructure = data.paragraphStructure.map((p, i) => ({
    paragraph: expected[i],
    guidance: p.guidance,
    }));
    data.wordCount = targetWordCount;

    return {
    statusCode: 200,
    headers:  CORS_HEADERS ,
    body: JSON.stringify({ ok: true, ...data }),
    };






  } catch (err) {
    console.error("generateTopic error:", err);
    return {
      statusCode: 500,
      headers:  CORS_HEADERS ,
      body: JSON.stringify({ ok: false, error: err.message || "Internal error" }),
    };
  }
};
