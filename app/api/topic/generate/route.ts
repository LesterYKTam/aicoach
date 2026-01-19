import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { promises as fs } from 'fs';
import path from 'path';

// Load general prompt template
async function loadPromptTemplate() {
  const promptPath = path.join(process.cwd(), 'prompts', 'topic_generation.json');
  const content = await fs.readFile(promptPath, 'utf-8');
  return JSON.parse(content);
}

// Load grade-specific profile (includes rubric and optional topicProfile)
async function loadGradeProfile(grade: number) {
  // Map grades to profile files
  let profileGrade: number;
  if (grade <= 6) {
    profileGrade = 5;
  } else {
    profileGrade = 7;
  }

  const profilePath = path.join(process.cwd(), 'grade_profile', `profile_g${profileGrade}_canada_ontrio_2026.json`);
  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

interface PromptTemplate {
  systemPrompt: {
    role: string;
    coreRules: string[];
  };
  defaultSettings: {
    temperature: number;
    promptTone: string;
    researchRequired: boolean;
  };
  defaultAvoidTopics: string[];
  defaultSubjectAreas: string[];
  taskTypeDescriptions: Record<string, string>;
  wordCountByGrade: Record<string, number>;
  paragraphStructureByGrade: {
    default: { count: number; structure: string[] };
    '7-12': { count: number; structure: string[] };
  };
  outputSchema: object;
}

interface TopicProfile {
  researchRequired?: boolean;
  promptTone?: string;
  readingLevel?: string;
  supportedTaskTypes?: string[];
  mixRules?: {
    nTopics: number;
    targetDistribution: Record<string, number>;
    avoidNearDuplicates: boolean;
  };
  softGuidelines?: string[];
  avoidTopics?: string[];
  outputFormat?: {
    eachTopicIncludes: string[];
  };
}

interface GradeProfile {
  grade: number;
  topicProfile?: TopicProfile;
}

function buildPrompt(
  grade: number,
  template: PromptTemplate,
  gradeProfile: GradeProfile | null
): { systemContent: string; userContent: string; taskType: string } {
  const topicProfile = gradeProfile?.topicProfile;

  // Get word count for this grade
  const wordCount = template.wordCountByGrade[grade.toString()] ?? 250;

  // Get paragraph structure based on grade
  const paragraphConfig = grade >= 7
    ? template.paragraphStructureByGrade['7-12']
    : template.paragraphStructureByGrade.default;

  // Get avoid topics (use grade-specific if available, else default)
  const avoidTopics = topicProfile?.avoidTopics ?? template.defaultAvoidTopics;

  // Get subject areas
  const subjectAreas = template.defaultSubjectAreas;

  // Get supported task types (use grade-specific if available)
  const supportedTaskTypes = topicProfile?.supportedTaskTypes ?? ['opinion_debatable'];

  // Pick a random task type from supported types
  const taskType = supportedTaskTypes[Math.floor(Math.random() * supportedTaskTypes.length)];
  const taskTypeDesc = template.taskTypeDescriptions[taskType] ?? 'An essay topic';

  // Build system prompt
  const systemParts = [
    template.systemPrompt.role,
    '',
    'CORE RULES:',
    ...template.systemPrompt.coreRules.map(r => `- ${r}`),
  ];

  // Add grade-specific guidelines if available
  if (topicProfile?.softGuidelines && topicProfile.softGuidelines.length > 0) {
    systemParts.push('', 'GRADE-SPECIFIC GUIDELINES:');
    topicProfile.softGuidelines.forEach(g => systemParts.push(`- ${g}`));
  }

  // Add avoid topics
  if (avoidTopics.length > 0) {
    systemParts.push('', 'TOPICS TO AVOID:');
    avoidTopics.forEach(t => systemParts.push(`- ${t}`));
  }

  // Add reading level if available
  if (topicProfile?.readingLevel) {
    systemParts.push('', `READING LEVEL: ${topicProfile.readingLevel}`);
  }

  systemParts.push('', 'Return JSON that matches the schema exactly.');

  const systemContent = systemParts.join('\n');

  // Build user prompt
  const userParts = [
    `Grade: ${grade}`,
    `Task Type: ${taskType}`,
    `Task Description: ${taskTypeDesc}`,
    '',
    'Generate ONE fresh, unique essay topic.',
    'Be creative! Pick an unexpected but age-appropriate subject.',
    '',
    `Draw from these subject areas: ${subjectAreas.join(', ')}`,
    '',
    'Include in your response:',
    `- taskType: "${taskType}"`,
    '- title: short, catchy title',
    '- prompt: clear instructions for the essay',
    '- tags: theme tags (2-8 tags)',
    `- wordCount: ${wordCount}`,
    `- paragraphStructure: exactly ${paragraphConfig.count} paragraphs (${paragraphConfig.structure.join(', ')})`,
  ];

  const userContent = userParts.join('\n');

  return { systemContent, userContent, taskType };
}

function buildSchema(grade: number, template: PromptTemplate) {
  const paragraphConfig = grade >= 7
    ? template.paragraphStructureByGrade['7-12']
    : template.paragraphStructureByGrade.default;

  return {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      taskType: { type: 'string' },
      title: { type: 'string' },
      prompt: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8 },
      wordCount: { type: 'integer', minimum: 50, maximum: 800 },
      paragraphStructure: {
        type: 'array',
        minItems: paragraphConfig.count,
        maxItems: paragraphConfig.count,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            paragraph: { type: 'string' },
            guidance: { type: 'string' },
          },
          required: ['paragraph', 'guidance'],
        },
      },
    },
    required: ['taskType', 'title', 'prompt', 'tags', 'wordCount', 'paragraphStructure'],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const grade = Number(body.grade ?? 7);

    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return NextResponse.json(
        { ok: false, error: 'grade must be a number between 1 and 12' },
        { status: 400 }
      );
    }

    // Load configurations
    const template = await loadPromptTemplate();
    const gradeProfile = await loadGradeProfile(grade);

    // Build prompt
    const { systemContent, userContent } = buildPrompt(grade, template, gradeProfile);

    // Build schema
    const schema = buildSchema(grade, template);

    // Get word count and paragraph structure for this grade
    const targetWordCount = template.wordCountByGrade[grade.toString()] ?? 250;
    const paragraphConfig = grade >= 7
      ? template.paragraphStructureByGrade['7-12']
      : template.paragraphStructureByGrade.default;

    const resp = await getOpenAI().responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: template.defaultSettings.temperature,
      input: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'essay_topic',
          schema,
        },
      },
    });

    const data = JSON.parse(resp.output_text);

    // Force exact paragraph labels
    data.paragraphStructure = data.paragraphStructure.map((p: { guidance: string }, i: number) => ({
      paragraph: paragraphConfig.structure[i] ?? `Paragraph ${i + 1}`,
      guidance: p.guidance,
    }));
    data.wordCount = targetWordCount;

    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error('generateTopic error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
