const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const OpenAI = require("openai");

const ssm = new SSMClient({});
let cachedApiKey = null;
let cachedClient = null;

const CORS_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "access-control-allow-methods": "OPTIONS,GET,POST",
};


const evaluationSchema = {
  name: "essay_evaluation_v1",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ok: { type: "boolean" },
      score: { type: "integer", minimum: 0, maximum: 100 },
      rubric: {
        type: "object",
        additionalProperties: false,
        properties: {
          ideas: { type: "integer", minimum: 0, maximum: 25 },
          organization: { type: "integer", minimum: 0, maximum: 25 },
          voice: { type: "integer", minimum: 0, maximum: 25 },
          conventions: { type: "integer", minimum: 0, maximum: 25 }
        },
        required: ["ideas", "organization", "voice", "conventions"]
      },
      strengths: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 5, maxLength: 160 } },
      issues: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 5, maxLength: 160 } },
      nextSteps: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 5, maxLength: 160 } },
      revisionSuggestion: { type: "string", minLength: 20, maxLength: 600 },
      teacherComment: { type: "string", minLength: 20, maxLength: 400 }
    },
    required: ["ok","score","rubric","strengths","issues","nextSteps","revisionSuggestion","teacherComment"]
  }
};



async function getOpenAIClient() {
  if (cachedClient) return cachedClient;

  const paramName = process.env.OPENAI_API_KEY_PARAM;
  if (!paramName) throw new Error("Missing env OPENAI_API_KEY_PARAM");

  if (!cachedApiKey) {
    const resp = await ssm.send(
      new GetParameterCommand({ Name: paramName, WithDecryption: true })
    );
    cachedApiKey = resp && resp.Parameter && resp.Parameter.Value;
    if (!cachedApiKey) throw new Error("SSM parameter value missing");
  }

  cachedClient = new OpenAI({ apiKey: cachedApiKey });
  return cachedClient;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function buildPrompt(grade, essayText) {
  return `
You are a strict but fair school teacher grading a student's ESSAY (not a story).
Return feedback that is age-appropriate for grade ${grade}.

Rules:
- Do NOT praise vaguely (no "great job" / no emojis).
- Be specific and actionable.
- If the essay is missing parts, say so directly and grade accordingly.
- Keep each bullet concise (max ~1 sentence).
- The rubric must total 100 with 4 categories, each 0–25.

Rubric categories:
- Ideas (0–25): thesis/opinion, reasons, relevant evidence/details, stays on topic
- Organization (0–25): clear intro/body/conclusion, topic sentences, logical flow, transitions
- Voice (0–25): clarity, appropriate tone, sentence variety, word choice
- Conventions (0–25): grammar, spelling, punctuation, capitalization, paragraphing

Student essay:
"""
${essayText}
"""
`.trim();
}


exports.handler = async (event) => {
  if (event?.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const raw = event && event.body ? JSON.parse(event.body) : {};
    const submissionId = String(raw.submissionId || "").trim();
    const grade = Number(raw.grade);
    const essayText = String(raw.essayText || "").trim();

    if (!submissionId) return jsonResponse(400, { ok: false, error: "submissionId is required" });
    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return jsonResponse(400, { ok: false, error: "grade must be 1-12" });
    }
    if (essayText.length < 50) return jsonResponse(400, { ok: false, error: "essayText too short" });

    const client = await getOpenAIClient();



const resp = await client.responses.create({
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  input: buildPrompt(grade, essayText),
  text: {
    format: {
      type: "json_schema",
      name: evaluationSchema.name,
      schema: evaluationSchema.schema
    }
  }
});

    const textOut = resp && resp.output_text;
    if (!textOut) throw new Error("No output_text from OpenAI");

    const parsed = JSON.parse(textOut);

    // Ensure rubric totals to 100 and score matches
    const r = parsed.rubric || {};
    const sum = (r.ideas||0) + (r.organization||0) + (r.voice||0) + (r.conventions||0);
    parsed.score = sum;     // since schema forces each category 0-25, sum should be 100
    parsed.ok = true;

    return jsonResponse(200, parsed);

  } catch (err) {
    console.error("evaluateSubmission error:", err);
    return jsonResponse(500, { ok: false, error: "Internal server error" });
  }
};
