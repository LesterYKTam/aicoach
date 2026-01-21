import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

// Load evaluation prompt template
async function loadEvaluationTemplate() {
  const templatePath = path.join(process.cwd(), 'prompts', 'evaluation.json');
  const content = await fs.readFile(templatePath, 'utf-8');
  return JSON.parse(content);
}

// Load grade profile (contains rubric) based on grade
async function loadGradeProfile(grade: number) {
  // Map grades to profile files (use closest available profile)
  let profileGrade: number;
  if (grade <= 6) {
    profileGrade = 5;
  } else {
    profileGrade = 7;
  }

  const profilePath = path.join(process.cwd(), 'grade_profile', `profile_g${profileGrade}_canada_ontrio_2026.json`);
  const content = await fs.readFile(profilePath, 'utf-8');
  return JSON.parse(content);
}

interface EvaluationTemplate {
  systemPrompt: {
    role: string;
    mission: string;
  };
  languageRules: {
    title: string;
    rules: string[];
  };
  rubricCommentGuidance: {
    instruction: string;
    examples: string[];
  };
  feedbackFields: {
    strengths: { count: number; description: string };
    nextSteps: {
      count: number;
      description: string;
      rankingRules?: {
        instruction: string;
        scoring: {
          impact_score: string;
          ease_score: string;
          priority_score: string;
        };
        requirements: string[];
      };
    };
    coachTip: { description: string; toneGuidelines?: string[] };
  };
  trainingModeRules: string[];
  structureTemplates: {
    introWithPosition: string;
    introSimple: string;
    bodyParagraphsMin: string;
    bodyRuleSimple: string;
    bodyRuleArgument: string;
    bodyRuleWithExplanation: string;
    bodyRuleWithExample: string;
    conclusion: string;
    counterpointRequired: string;
    structureIncomplete: string;
    counterpointPenalty: string;
    counterpointFeedback: string;
  };
  outputSchema: {
    rubricCommentsPerCategory: {
      min: number;
      max: number;
      minLength: number;
      maxLength: number;
    };
    feedbackArrays: {
      minItems: number;
      maxItems: number;
      minLength: number;
      maxLength: number;
    };
    textFields: {
      coachTip: { minLength: number; maxLength: number };
    };
  };
}

interface Rubric {
  version: {
    id: string;
    name: string;
    region: string;
    year: number;
    revision: number;
  };
  categories: Array<{
    name: string;
    weight: number;
    criteria: string[];
    requiredStructure?: {
      introduction: boolean;
      minBodyParagraphs: number;
      bodyParagraphRules: {
        oneMainIdea?: boolean;
        minSupportingSentences?: number;
        oneMainArgument?: boolean;
        requiresExplanation?: boolean;
        requiresExample?: boolean;
      };
      conclusion: boolean;
      counterpointRequired?: boolean;
    };
  }>;
  trainingRules: {
    structureRequired: boolean;
    missingStructureScoreCap: number;
    rewriteRequiredBelow: number;
    counterpointMissingPenalty?: {
      enabled: boolean;
      deductPoints: number;
      note: string;
    };
  };
  scoreMeaning: Array<{
    range: string;
    description: string;
  }>;
  gradingPrinciples: string[];
}

// Build evaluation schema dynamically based on rubric weights and template
function buildEvaluationSchema(rubric: Rubric, template: EvaluationTemplate) {
  // Get weights from rubric categories
  const getWeight = (name: string) => rubric.categories.find(c => c.name === name)?.weight ?? 20;

  const knowledgeMax = getWeight('Knowledge & Understanding');
  const thinkingMax = getWeight('Thinking');
  const communicationMax = getWeight('Communication & Structure');
  const applicationMax = getWeight('Application');

  // Check if counterpoint is required (G7+)
  const structureCat = rubric.categories.find(c => c.requiredStructure);
  const hasCounterpoint = structureCat?.requiredStructure?.counterpointRequired ?? false;

  // Get schema config from template
  const commentConfig = template.outputSchema.rubricCommentsPerCategory;
  const feedbackConfig = template.outputSchema.feedbackArrays;
  const textConfig = template.outputSchema.textFields;

  return {
    name: 'essay_evaluation_v5',
    schema: {
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        score: { type: 'integer', minimum: 0, maximum: 100 },
        rubric: {
          type: 'object',
          additionalProperties: false,
          properties: {
            knowledgeUnderstanding: { type: 'integer', minimum: 0, maximum: knowledgeMax },
            thinking: { type: 'integer', minimum: 0, maximum: thinkingMax },
            communicationStructure: { type: 'integer', minimum: 0, maximum: communicationMax },
            application: { type: 'integer', minimum: 0, maximum: applicationMax },
          },
          required: ['knowledgeUnderstanding', 'thinking', 'communicationStructure', 'application'],
        },
        rubricComments: {
          type: 'object',
          additionalProperties: false,
          properties: {
            knowledgeUnderstanding: {
              type: 'array',
              minItems: commentConfig.min,
              maxItems: commentConfig.max,
              items: { type: 'string', minLength: commentConfig.minLength, maxLength: commentConfig.maxLength },
            },
            thinking: {
              type: 'array',
              minItems: commentConfig.min,
              maxItems: commentConfig.max,
              items: { type: 'string', minLength: commentConfig.minLength, maxLength: commentConfig.maxLength },
            },
            communicationStructure: {
              type: 'array',
              minItems: commentConfig.min,
              maxItems: commentConfig.max,
              items: { type: 'string', minLength: commentConfig.minLength, maxLength: commentConfig.maxLength },
            },
            application: {
              type: 'array',
              minItems: commentConfig.min,
              maxItems: commentConfig.max,
              items: { type: 'string', minLength: commentConfig.minLength, maxLength: commentConfig.maxLength },
            },
          },
          required: ['knowledgeUnderstanding', 'thinking', 'communicationStructure', 'application'],
        },
        structureAnalysis: {
          type: 'object',
          additionalProperties: false,
          properties: {
            hasIntroduction: { type: 'boolean' },
            bodyParagraphCount: { type: 'integer', minimum: 0 },
            hasConclusion: { type: 'boolean' },
            structureComplete: { type: 'boolean' },
            ...(hasCounterpoint && { hasCounterpoint: { type: 'boolean' } }),
          },
          required: ['hasIntroduction', 'bodyParagraphCount', 'hasConclusion', 'structureComplete', ...(hasCounterpoint ? ['hasCounterpoint'] : [])],
        },
        strengths: {
          type: 'array',
          minItems: feedbackConfig.minItems,
          maxItems: feedbackConfig.maxItems,
          items: { type: 'string', minLength: feedbackConfig.minLength, maxLength: feedbackConfig.maxLength },
        },
        nextSteps: {
          type: 'array',
          minItems: feedbackConfig.minItems,
          maxItems: feedbackConfig.maxItems,
          items: { type: 'string', minLength: feedbackConfig.minLength, maxLength: feedbackConfig.maxLength },
        },
        coachTip: { type: 'string', minLength: textConfig.coachTip.minLength, maxLength: textConfig.coachTip.maxLength },
        requiresRewrite: { type: 'boolean' },
        rubricTags: {
          type: 'object',
          additionalProperties: false,
          description: 'Short keyword tags (1-3 per category) identifying key strengths or areas to improve',
          properties: {
            knowledgeUnderstanding: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', minLength: 3, maxLength: 30 },
            },
            thinking: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', minLength: 3, maxLength: 30 },
            },
            communicationStructure: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', minLength: 3, maxLength: 30 },
            },
            application: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', minLength: 3, maxLength: 30 },
            },
          },
          required: ['knowledgeUnderstanding', 'thinking', 'communicationStructure', 'application'],
        },
      },
      required: [
        'ok',
        'score',
        'rubric',
        'rubricComments',
        'rubricTags',
        'structureAnalysis',
        'strengths',
        'nextSteps',
        'coachTip',
        'requiresRewrite',
      ],
    },
  };
}

function buildPrompt(grade: number, essayText: string, rubric: Rubric, template: EvaluationTemplate): string {
  const categoriesText = rubric.categories
    .map((cat) => `- ${cat.name} (0-${cat.weight}): ${cat.criteria.join(', ')}`)
    .join('\n');

  const structureCat = rubric.categories.find((c) => c.requiredStructure);
  const reqStruct = structureCat?.requiredStructure;
  const st = template.structureTemplates;

  let structureRules = '';
  if (reqStruct) {
    const bodyRules = reqStruct.bodyParagraphRules;
    let bodyParaDesc = '';

    if (bodyRules.minSupportingSentences) {
      bodyParaDesc = st.bodyRuleSimple.replace('{{minSupportingSentences}}', String(bodyRules.minSupportingSentences));
    } else if (bodyRules.oneMainArgument) {
      bodyParaDesc = st.bodyRuleArgument;
      if (bodyRules.requiresExplanation) bodyParaDesc += st.bodyRuleWithExplanation;
      if (bodyRules.requiresExample) bodyParaDesc += st.bodyRuleWithExample;
    }

    const introRule = reqStruct.counterpointRequired ? st.introWithPosition : st.introSimple;
    const bodyRule = st.bodyParagraphsMin.replace('{{minBodyParagraphs}}', String(reqStruct.minBodyParagraphs));
    const structureCap = st.structureIncomplete.replace('{{scoreCap}}', String(rubric.trainingRules.missingStructureScoreCap));

    structureRules = `
Structure Requirements:
- ${introRule}
- ${bodyRule}
- Each body paragraph needs ${bodyParaDesc}
- ${st.conclusion}
${reqStruct.counterpointRequired ? `- ${st.counterpointRequired}` : ''}
- ${structureCap}`;
  }

  let counterpointNote = '';
  if (rubric.trainingRules.counterpointMissingPenalty?.enabled) {
    counterpointNote = '\n- ' + st.counterpointPenalty
      .replace('{{deductPoints}}', String(rubric.trainingRules.counterpointMissingPenalty.deductPoints));
  }

  // Build language rules section
  const languageRulesText = template.languageRules.rules
    .map(rule => `- ${rule.replace(/\{\{grade\}\}/g, String(grade))}`)
    .join('\n');

  // Build rubric comment examples
  const commentExamples = template.rubricCommentGuidance.examples
    .map(ex => `- "${ex}"`)
    .join('\n');

  // Build feedback style section
  const ff = template.feedbackFields;
  const rankingRules = ff.nextSteps.rankingRules;
  let nextStepsRules = `- nextSteps (Level Up Tips): ${ff.nextSteps.count} ${ff.nextSteps.description}`;
  if (rankingRules) {
    nextStepsRules += `
    ${rankingRules.instruction}
    Scoring: impact_score (${rankingRules.scoring.impact_score}), ease_score (${rankingRules.scoring.ease_score})
    Formula: ${rankingRules.scoring.priority_score}
    ${rankingRules.requirements.map(r => `- ${r}`).join('\n    ')}`;
  }
  let coachTipRules = `- coachTip (Coach Says): ${ff.coachTip.description}`;
  if (ff.coachTip.toneGuidelines) {
    coachTipRules += `\n    ${ff.coachTip.toneGuidelines.map(g => `- ${g}`).join('\n    ')}`;
  }
  const feedbackStyle = [
    `- strengths: ${ff.strengths.count} ${ff.strengths.description}`,
    nextStepsRules,
    coachTipRules,
  ].join('\n');

  // Build training mode rules
  const trainingRules = template.trainingModeRules
    .map(rule => `- ${rule.replace('{{rewriteThreshold}}', String(rubric.trainingRules.rewriteRequiredBelow))}`)
    .join('\n');

  const counterpointFeedbackRule = reqStruct?.counterpointRequired
    ? `\n- ${st.counterpointFeedback}`
    : '';

  return `
${template.systemPrompt.role.replace(/\{\{grade\}\}/g, String(grade))}
${template.systemPrompt.mission.replace(/\{\{grade\}\}/g, String(grade))}

IMPORTANT - ${template.languageRules.title}:
${languageRulesText}

RUBRIC CATEGORIES (scores must add up to 100):
${categoriesText}
${structureRules}
${counterpointNote}

${template.rubricCommentGuidance.instruction}
${commentExamples}

FEEDBACK STYLE:
${feedbackStyle}

RUBRIC TAGS:
For each rubric category, provide 1-3 short keyword tags (3-30 chars each) that identify key characteristics of the student's writing in that area.
Tags should be lowercase with hyphens, e.g., "clear-thesis", "weak-transitions", "good-examples", "needs-evidence", "strong-vocabulary".
Tags can be positive (strengths) or negative (areas to improve).

TRAINING MODE:
${trainingRules}${counterpointFeedbackRule}

Student's essay:
"""
${essayText}
"""
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const submissionId = String(body.submissionId || '').trim();
    const grade = Number(body.grade);
    const essayText = String(body.essayText || '').trim();

    if (!submissionId) {
      return NextResponse.json(
        { ok: false, error: 'submissionId is required' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(grade) || grade < 3 || grade > 8) {
      return NextResponse.json(
        { ok: false, error: 'grade must be 3-8' },
        { status: 400 }
      );
    }

    if (essayText.length < 50) {
      return NextResponse.json(
        { ok: false, error: 'essayText too short' },
        { status: 400 }
      );
    }

    // Load configurations
    const template = await loadEvaluationTemplate();
    const rubric = await loadGradeProfile(grade);

    // Build schema dynamically based on rubric and template
    const evaluationSchema = buildEvaluationSchema(rubric, template);

    const resp = await getOpenAI().responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: buildPrompt(grade, essayText, rubric, template),
      text: {
        format: {
          type: 'json_schema',
          name: evaluationSchema.name,
          schema: evaluationSchema.schema,
        },
      },
    });

    const textOut = resp.output_text;
    if (!textOut) throw new Error('No output_text from OpenAI');

    const parsed = JSON.parse(textOut);

    // Calculate total score from rubric categories
    const r = parsed.rubric || {};
    let sum =
      (r.knowledgeUnderstanding || 0) +
      (r.thinking || 0) +
      (r.communicationStructure || 0) +
      (r.application || 0);

    // Apply structure cap if structure is incomplete
    const structureComplete = parsed.structureAnalysis?.structureComplete ?? true;
    if (!structureComplete) {
      sum = Math.min(sum, rubric.trainingRules.missingStructureScoreCap);
    }

    // Apply counterpoint penalty for G7+ if missing
    const counterpointPenalty = rubric.trainingRules.counterpointMissingPenalty;
    if (counterpointPenalty?.enabled && parsed.structureAnalysis?.hasCounterpoint === false) {
      sum = Math.max(0, sum - counterpointPenalty.deductPoints);
    }

    parsed.score = sum;
    parsed.ok = true;
    parsed.requiresRewrite = sum < rubric.trainingRules.rewriteRequiredBelow;

    // Include rubric weights in response for frontend display
    type Category = Rubric['categories'][number];
    parsed.rubricWeights = {
      knowledgeUnderstanding: rubric.categories.find((c: Category) => c.name === 'Knowledge & Understanding')?.weight ?? 20,
      thinking: rubric.categories.find((c: Category) => c.name === 'Thinking')?.weight ?? 20,
      communicationStructure: rubric.categories.find((c: Category) => c.name === 'Communication & Structure')?.weight ?? 35,
      application: rubric.categories.find((c: Category) => c.name === 'Application')?.weight ?? 25,
    };

    // Include rubric version in response
    parsed.rubricVersionId = rubric.version?.id || 'unknown';

    // Save evaluation to database if submissionId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(submissionId)) {
      try {
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            gradeLevel: grade,
            rubricVersionId: parsed.rubricVersionId,
            score: parsed.score,
            scoreKnowledge: r.knowledgeUnderstanding,
            scoreThinking: r.thinking,
            scoreCommunication: r.communicationStructure,
            scoreApplication: r.application,
            tagsKnowledge: parsed.rubricTags?.knowledgeUnderstanding || [],
            tagsThinking: parsed.rubricTags?.thinking || [],
            tagsCommunication: parsed.rubricTags?.communicationStructure || [],
            tagsApplication: parsed.rubricTags?.application || [],
            hasIntroduction: parsed.structureAnalysis?.hasIntroduction,
            bodyParagraphCount: parsed.structureAnalysis?.bodyParagraphCount,
            hasConclusion: parsed.structureAnalysis?.hasConclusion,
            structureComplete: parsed.structureAnalysis?.structureComplete,
            requiresRewrite: parsed.requiresRewrite,
            rubricComments: parsed.rubricComments,
            strengths: parsed.strengths,
            nextSteps: parsed.nextSteps,
            coachTip: parsed.coachTip,
          },
        });
      } catch (dbErr) {
        console.error('Failed to save evaluation to database:', dbErr);
        // Continue - don't fail the request if DB save fails
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('evaluateSubmission error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
