// evaluationSchema.js
export const evaluationSchema = {
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

      strengths: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 5, maxLength: 160 }
      },

      issues: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 5, maxLength: 160 }
      },

      nextSteps: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 5, maxLength: 160 }
      },

      revisionSuggestion: {
        type: "string",
        minLength: 20,
        maxLength: 600
      },

      teacherComment: {
        type: "string",
        minLength: 20,
        maxLength: 400
      }
    },
    required: ["ok", "score", "rubric", "strengths", "issues", "nextSteps", "revisionSuggestion", "teacherComment"]
  }
};
