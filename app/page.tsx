'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Sparkles, BookOpen, Lightbulb, CheckCircle2, AlertCircle, ArrowRight, Star, PenLine, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthHeader } from '@/components/ui/auth-header';
import { Tooltip } from '@/components/ui/tooltip';
import { useWritingSession } from '@/lib/hooks/use-writing-session';

type TopicResponse = {
  ok: true;
  title: string;
  prompt: string;
  tags: string[];
  wordCount: number;
  paragraphStructure: Array<{ paragraph: string; guidance: string }>;
};

type UiTopic = {
  title: string;
  description: string;
  tags: string[];
  wordCount?: number;
  paragraphStructure?: Array<{ paragraph: string; guidance: string }>;
};

type WritingRequirements = {
  wordCount: { min: number; target: number };
  structure: {
    paragraphs: Array<{ name: string; required: boolean; description: string }>;
    minBodyParagraphs: number;
    counterpointRequired: boolean;
  };
};

type TipsResponse = {
  ok: boolean;
  requirements: WritingRequirements;
};

type CoachHelpResponse = {
  ok: boolean;
  status: 'not_started' | 'in_progress' | 'almost_done' | 'complete';
  encouragement: string;
  nextStep: string;
  question: string;
};

type EvaluationResponse = {
  ok: true;
  score: number;
  rubric: {
    knowledgeUnderstanding: number;
    thinking: number;
    communicationStructure: number;
    application: number;
  };
  rubricWeights: {
    knowledgeUnderstanding: number;
    thinking: number;
    communicationStructure: number;
    application: number;
  };
  rubricComments: {
    knowledgeUnderstanding: string[];
    thinking: string[];
    communicationStructure: string[];
    application: string[];
  };
  structureAnalysis: {
    hasIntroduction: boolean;
    bodyParagraphCount: number;
    hasConclusion: boolean;
    structureComplete: boolean;
    hasCounterpoint?: boolean;
  };
  strengths: string[];
  nextSteps: string[];
  coachTip: string;
  requiresRewrite: boolean;
};

async function postJson<T>(path: string, payload: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = (data as { error?: string; message?: string })?.error ||
                (data as { error?: string; message?: string })?.message ||
                text ||
                `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (data ?? text) as T;
}

// Helper component for star rating display
const StarRating = ({ score, maxScore }: { score: number; maxScore: number }) => {
  const percentage = (score / maxScore) * 100;
  const stars = Math.round((percentage / 100) * 5);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= stars ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
};

export default function Home() {
  // Writing session hook for profile/session/submission management
  const { submitAndEvaluate, isLoading: isSessionLoading } = useWritingSession();

  const [selectedGrade, setSelectedGrade] = useState<string>('5');
  const [topicMode, setTopicMode] = useState<'generate' | 'custom'>('generate');
  const [customTopic, setCustomTopic] = useState('');
  const [currentTopic, setCurrentTopic] = useState<UiTopic | null>(null);
  const [requirements, setRequirements] = useState<WritingRequirements | null>(null);
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [coachHelp, setCoachHelp] = useState<CoachHelpResponse | null>(null);
  const [isLoadingCoachHelp, setIsLoadingCoachHelp] = useState(false);
  const [essay, setEssay] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showMoreTips, setShowMoreTips] = useState(false);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  // Get word count target from requirements or use defaults
  const targetWordCount = requirements?.wordCount.target ?? (parseInt(selectedGrade) <= 4 ? 150 : parseInt(selectedGrade) <= 8 ? 300 : 500);
  const minWordCount = requirements?.wordCount.min ?? Math.floor(targetWordCount * 0.8);

  // Fetch tips when grade changes (for custom topics) or on initial load
  const fetchTips = useCallback(async (grade: number) => {
    setIsLoadingTips(true);
    try {
      const params = new URLSearchParams({ grade: grade.toString() });
      const res = await fetch(`/api/tips?${params}`);
      const data: TipsResponse = await res.json();
      if (data.ok) {
        setRequirements(data.requirements);
      }
    } catch (err) {
      console.error('Failed to fetch tips:', err);
    } finally {
      setIsLoadingTips(false);
    }
  }, []);

  // Get personalized coach help based on current writing
  const handleCoachHelp = async () => {
    setIsLoadingCoachHelp(true);
    try {
      const grade = parseInt(selectedGrade, 10);
      const topic = currentTopic?.title || customTopic || undefined;
      const res = await fetch('/api/coach-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, topic, essayText: essay }),
      });
      const data: CoachHelpResponse = await res.json();
      if (data.ok) {
        setCoachHelp(data);
      }
    } catch (err) {
      console.error('Failed to get coach help:', err);
    } finally {
      setIsLoadingCoachHelp(false);
    }
  };

  // Fetch tips on grade change
  useEffect(() => {
    const grade = parseInt(selectedGrade, 10);
    fetchTips(grade);
    // Clear coach help when grade changes
    setCoachHelp(null);
  }, [selectedGrade, fetchTips]);

  const handleGenerateTopic = async () => {
    try {
      setIsGenerating(true);
      setEvaluation(null);
      setCoachHelp(null);

      const grade = parseInt(selectedGrade, 10);
      const out = await postJson<TopicResponse>('/api/topic/generate', { grade });

      setCurrentTopic({
        title: out.title,
        description: out.prompt,
        tags: out.tags,
        wordCount: out.wordCount,
        paragraphStructure: out.paragraphStructure,
      });

      // Clear the essay box so the student starts fresh
      setEssay('');
    } catch (err) {
      console.error('Generate topic failed:', err);
      alert(`Generate topic failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!essay.trim()) return;
    try {
      setIsEvaluating(true);

      const grade = parseInt(selectedGrade, 10);
      const topic = currentTopic?.title || customTopic || undefined;

      // Use the writing session hook to create submission and evaluate
      const { evaluation: evalResult } = await submitAndEvaluate(essay, grade, topic);

      if (evalResult && (evalResult as EvaluationResponse).ok) {
        setEvaluation(evalResult as EvaluationResponse);
        setShowMoreTips(false);
      } else {
        throw new Error('Evaluation failed');
      }
    } catch (err) {
      console.error('Evaluate failed:', err);
      alert(`Evaluate failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <div className="flex justify-end mb-4">
            <AuthHeader />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold">My Writing Coach</h1>
            </div>
            <p className="text-lg text-muted-foreground">Let&apos;s write together</p>
          </div>
        </div>

        {/* Section 1: Topic Selection */}
        <Card className="mb-8 p-6 bg-white/80 backdrop-blur shadow-lg border-2">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold">Choose Your Writing Topic</h2>
          </div>

          {/* Topic Mode Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">How would you like to start?</label>
            <div className="inline-flex rounded-lg border-2 border-gray-200 p-1 bg-gray-100">
              <button
                onClick={() => setTopicMode('generate')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  topicMode === 'generate'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Generate a Topic for Me
              </button>
              <button
                onClick={() => setTopicMode('custom')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  topicMode === 'custom'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PenLine className="w-4 h-4" />
                I Have My Own Topic
              </button>
            </div>
          </div>

          {topicMode === 'generate' ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-end mb-4">
                <div className="flex-1 w-full sm:max-w-xs">
                  <label className="block mb-2 font-medium">Select Your Grade</label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 6 }, (_, i) => i + 3).map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGenerateTopic}
                  disabled={isGenerating}
                  size="lg"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {isGenerating ? 'Generating...' : 'Generate Topic'}
                </Button>
              </div>

              {currentTopic && (
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                  <h3 className="mb-3 text-black font-bold text-lg">{currentTopic.title}</h3>
                  <p className="text-gray-700 mb-4">{currentTopic.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {currentTopic.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-purple-100 text-purple-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full sm:max-w-xs">
                  <label className="block mb-2 font-medium">Select Your Grade</label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 6 }, (_, i) => i + 3).map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium">Your Topic</label>
                <Textarea
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Enter your essay topic here... (e.g., 'Why is reading important?' or 'My favorite hobby')"
                  className="min-h-[100px] bg-white"
                />
              </div>
              {customTopic.trim() && (
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                  <h3 className="mb-3 text-black font-bold text-lg">Your Topic</h3>
                  <p className="text-gray-700">{customTopic}</p>
                </Card>
              )}
            </div>
          )}
        </Card>

        {/* Section 2: Essay Writing - only show when topic is ready */}
        {((topicMode === 'generate' && currentTopic) || (topicMode === 'custom' && customTopic.trim())) && (
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left: Essay Writing */}
          <Card className="lg:col-span-2 p-6 bg-white/80 backdrop-blur shadow-lg border-2">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Write Your Essay</h2>
            </div>

            <Textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder={
                'Start writing your essay here...\n\nIntroduction: Introduce your main idea...\n\nBody Paragraph 1: Present your first point with details...\n\nBody Paragraph 2: Present your second point with details...\n\nConclusion: Summarize your main points...'
              }
              className="min-h-[400px] mb-4 bg-white resize-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Word count:{' '}
                <span className={wordCount >= targetWordCount ? 'text-green-600 font-medium' : ''}>
                  {wordCount}
                </span>
              </span>
              <Button
                onClick={handleEvaluate}
                disabled={!essay.trim() || isEvaluating || isSessionLoading}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isSessionLoading ? 'Loading...' : isEvaluating ? 'Checking...' : "I'm Done!"}
              </Button>
            </div>
          </Card>

          {/* Right: Writing Requirements & Tips */}
          <Card className="p-6 bg-white/80 backdrop-blur shadow-lg border-2">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold">Requirements</h3>
              {isLoadingTips && <span className="text-xs text-muted-foreground">(loading...)</span>}
            </div>

            <div className="space-y-6">
              {/* Word Count Requirement */}
              <div>
                <h4 className="font-medium mb-2">Word Count</h4>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-2xl font-bold ${wordCount >= targetWordCount ? 'text-green-600' : 'text-blue-600'}`}>{wordCount}</span>
                  <span className="text-sm text-muted-foreground">/ {targetWordCount} target</span>
                </div>
                <Progress value={Math.min(100, (wordCount / targetWordCount) * 100)} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  {wordCount < minWordCount
                    ? `${minWordCount - wordCount} more words needed (min: ${minWordCount})`
                    : wordCount < targetWordCount
                    ? `${targetWordCount - wordCount} more to reach target`
                    : 'Great job reaching your goal!'}
                </div>
              </div>

              {/* Structure Requirements */}
              <div>
                <h4 className="font-medium mb-3">Essay Structure</h4>
                <div className="space-y-2">
                  {requirements?.structure.paragraphs ? (
                    requirements.structure.paragraphs.map((para, idx) => {
                      const colors = [
                        { bg: 'bg-blue-100', text: 'text-blue-700' },
                        { bg: 'bg-purple-100', text: 'text-purple-700' },
                        { bg: 'bg-purple-100', text: 'text-purple-700' },
                        { bg: 'bg-purple-100', text: 'text-purple-700' },
                        { bg: 'bg-green-100', text: 'text-green-700' },
                      ];
                      const color = colors[Math.min(idx, colors.length - 1)];
                      return (
                        <div key={idx} className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-full ${color.bg} ${color.text} flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{para.name}</div>
                            <div className="text-xs text-muted-foreground">{para.description}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-muted-foreground">Loading structure...</div>
                  )}
                </div>
                {requirements?.structure.counterpointRequired && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Counterpoint required: Address an opposing view
                  </div>
                )}
              </div>

              {/* Coach Help Button */}
              <div className="border-t pt-4">
                <Button
                  onClick={handleCoachHelp}
                  disabled={isLoadingCoachHelp}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                >
                  <MessageCircle className="w-4 h-4" />
                  {isLoadingCoachHelp ? 'Thinking...' : 'Ask Coach for Help'}
                </Button>
              </div>

              {/* Coach Help Response */}
              {coachHelp && (
                <div className="space-y-3 pt-4 border-t">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        coachHelp.status === 'complete'
                          ? 'bg-green-100 text-green-700'
                          : coachHelp.status === 'almost_done'
                          ? 'bg-blue-100 text-blue-700'
                          : coachHelp.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }
                    >
                      {coachHelp.status === 'complete'
                        ? 'Looking good!'
                        : coachHelp.status === 'almost_done'
                        ? 'Almost there!'
                        : coachHelp.status === 'in_progress'
                        ? 'Keep going!'
                        : 'Just starting'}
                    </Badge>
                  </div>

                  {/* Encouragement */}
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-green-700">{coachHelp.encouragement}</p>
                    </div>
                  </div>

                  {/* Next Step */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-700">{coachHelp.nextStep}</p>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-purple-700 italic">{coachHelp.question}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        )}

        {/* Section 3: Evaluation Results */}
        {evaluation && (
          <Card className="p-8 bg-white/80 backdrop-blur shadow-lg border-2">
            <h2 className="text-2xl font-bold mb-6">Your Essay Evaluation</h2>

            {/* Overall Score */}
            <div className="flex justify-center mb-8">
              <div className="text-center">
                <div className="text-6xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {evaluation.score}
                  </span>
                </div>
                <div className="flex justify-center mb-2">
                  <StarRating score={evaluation.score} maxScore={100} />
                </div>
                <div className="text-muted-foreground">Overall Score</div>
              </div>
            </div>

            {/* Rewrite Encouragement */}
            {evaluation.requiresRewrite && (
              <Card className="p-4 mb-6 bg-amber-50 border-amber-300">
                <div className="flex items-center gap-2 text-amber-700">
                  <PenLine className="w-5 h-5" />
                  <span className="font-semibold">Let&apos;s Try Again!</span>
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  Good effort! Your essay needs a bit more work. Read the feedback below and give it another try - you can do it!
                </p>
              </Card>
            )}

            {/* Structure Analysis */}
            <Card className="p-4 mb-6 bg-gray-50 border-gray-200">
              <h3 className="font-semibold mb-3">Structure Check</h3>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className={`flex items-center gap-1 ${evaluation.structureAnalysis.hasIntroduction ? 'text-green-600' : 'text-red-500'}`}>
                  {evaluation.structureAnalysis.hasIntroduction ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  Introduction
                </div>
                <div className={`flex items-center gap-1 ${evaluation.structureAnalysis.bodyParagraphCount >= (parseInt(selectedGrade) >= 7 ? 3 : 2) ? 'text-green-600' : 'text-red-500'}`}>
                  {evaluation.structureAnalysis.bodyParagraphCount >= (parseInt(selectedGrade) >= 7 ? 3 : 2) ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  Body ({evaluation.structureAnalysis.bodyParagraphCount} paragraphs)
                </div>
                <div className={`flex items-center gap-1 ${evaluation.structureAnalysis.hasConclusion ? 'text-green-600' : 'text-red-500'}`}>
                  {evaluation.structureAnalysis.hasConclusion ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  Conclusion
                </div>
                {evaluation.structureAnalysis.hasCounterpoint !== undefined && (
                  <div className={`flex items-center gap-1 ${evaluation.structureAnalysis.hasCounterpoint ? 'text-green-600' : 'text-red-500'}`}>
                    {evaluation.structureAnalysis.hasCounterpoint ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    Counterpoint
                  </div>
                )}
              </div>
            </Card>

            {/* Rubric Breakdown */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Tooltip
                content={
                  <ul className="space-y-1">
                    {evaluation.rubricComments.knowledgeUnderstanding.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-yellow-400">•</span> {c}
                      </li>
                    ))}
                  </ul>
                }
              >
                <div className="cursor-help">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium flex items-center gap-1">
                      Knowledge & Understanding
                      <MessageCircle className="w-3 h-3 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-2">
                      <StarRating score={evaluation.rubric.knowledgeUnderstanding} maxScore={evaluation.rubricWeights.knowledgeUnderstanding} />
                      <span className="text-sm">{evaluation.rubric.knowledgeUnderstanding}/{evaluation.rubricWeights.knowledgeUnderstanding}</span>
                    </div>
                  </div>
                  <Progress value={(evaluation.rubric.knowledgeUnderstanding / evaluation.rubricWeights.knowledgeUnderstanding) * 100} className="h-3 mb-4" />
                </div>
              </Tooltip>

              <Tooltip
                content={
                  <ul className="space-y-1">
                    {evaluation.rubricComments.thinking.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-yellow-400">•</span> {c}
                      </li>
                    ))}
                  </ul>
                }
              >
                <div className="cursor-help">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium flex items-center gap-1">
                      Thinking
                      <MessageCircle className="w-3 h-3 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-2">
                      <StarRating score={evaluation.rubric.thinking} maxScore={evaluation.rubricWeights.thinking} />
                      <span className="text-sm">{evaluation.rubric.thinking}/{evaluation.rubricWeights.thinking}</span>
                    </div>
                  </div>
                  <Progress value={(evaluation.rubric.thinking / evaluation.rubricWeights.thinking) * 100} className="h-3 mb-4" />
                </div>
              </Tooltip>

              <Tooltip
                content={
                  <ul className="space-y-1">
                    {evaluation.rubricComments.communicationStructure.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-yellow-400">•</span> {c}
                      </li>
                    ))}
                  </ul>
                }
              >
                <div className="cursor-help">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium flex items-center gap-1">
                      Communication & Structure
                      <MessageCircle className="w-3 h-3 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-2">
                      <StarRating score={evaluation.rubric.communicationStructure} maxScore={evaluation.rubricWeights.communicationStructure} />
                      <span className="text-sm">{evaluation.rubric.communicationStructure}/{evaluation.rubricWeights.communicationStructure}</span>
                    </div>
                  </div>
                  <Progress value={(evaluation.rubric.communicationStructure / evaluation.rubricWeights.communicationStructure) * 100} className="h-3 mb-4" />
                </div>
              </Tooltip>

              <Tooltip
                content={
                  <ul className="space-y-1">
                    {evaluation.rubricComments.application.map((c, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-yellow-400">•</span> {c}
                      </li>
                    ))}
                  </ul>
                }
              >
                <div className="cursor-help">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium flex items-center gap-1">
                      Application
                      <MessageCircle className="w-3 h-3 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-2">
                      <StarRating score={evaluation.rubric.application} maxScore={evaluation.rubricWeights.application} />
                      <span className="text-sm">{evaluation.rubric.application}/{evaluation.rubricWeights.application}</span>
                    </div>
                  </div>
                  <Progress value={(evaluation.rubric.application / evaluation.rubricWeights.application) * 100} className="h-3 mb-4" />
                </div>
              </Tooltip>
            </div>

            {/* Feedback Columns */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="p-5 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold">What You Did Well</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-5 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold">Level Up Tip</h3>
                </div>
                <ul className="space-y-2">
                  <li className="text-sm flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{evaluation.nextSteps[0]}</span>
                  </li>
                  {showMoreTips && evaluation.nextSteps.slice(1).map((step, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                {evaluation.nextSteps.length > 1 && (
                  <button
                    onClick={() => setShowMoreTips(!showMoreTips)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {showMoreTips ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide tips
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        More tips
                      </>
                    )}
                  </button>
                )}
              </Card>
            </div>

            {/* Coach Says */}
            <Card className="p-5 bg-indigo-50 border-indigo-200">
              <h3 className="font-semibold mb-3">Coach Says</h3>
              <p className="text-sm text-foreground/80">{evaluation.coachTip}</p>
            </Card>
          </Card>
        )}
      </div>
    </div>
  );
}
