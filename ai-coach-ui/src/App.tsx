import { useState } from 'react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Progress } from './components/ui/progress';
import { Sparkles, BookOpen, Lightbulb, CheckCircle2, AlertCircle, ArrowRight, Star } from 'lucide-react';

// Backend API base URL (keep backend untouched; frontend adapts)
// If you're using Vite, you can set VITE_API_BASE in .env; otherwise it falls back to your deployed API.
const API_BASE: string = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE)
  ? (import.meta as any).env.VITE_API_BASE
  : 'https://fs3znp8pfa.execute-api.us-east-1.amazonaws.com/Prod';

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

type EvaluationResponse = {
  ok: true;
  score: number;
  rubric: { ideas: number; organization: number; voice: number; conventions: number };
  strengths: string[];
  issues: string[];
  nextSteps: string[];
  revisionSuggestion: string;
  teacherComment: string;
};

async function postJson<T>(path: string, payload: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok) {
    const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
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
            star <= stars
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
};

export default function App() {
  const [selectedGrade, setSelectedGrade] = useState<string>('5');
  const [currentTopic, setCurrentTopic] = useState<UiTopic>({
    title: "Click 'Generate Topic' to start",
    description: "Choose your grade, then generate a topic. You'll get a clear prompt and a suggested structure.",
    tags: ["essay", "practice"],
  });
  const [essay, setEssay] = useState('School uniforms should be required because they help students focus. When everyone wears the same clothes, students do not worry about brands or fashion. This can reduce bullying and make school feel fair. First, uniforms save time in the morning. Students do not spend too long choosing outfits. If they are ready faster, they arrive at school less stressed and can start learning right away. Second, uniforms can make students feel like they belong. When a class looks similar, it feels like a team. Students may take school rules more seriously and behave better. In conclusion, school uniforms are helpful because they reduce distractions, save time, and build a sense of community. Schools should consider using uniforms to improve learning.');
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const targetWordCount = parseInt(selectedGrade) <= 4 ? 150 : parseInt(selectedGrade) <= 8 ? 300 : 500;

  const handleGenerateTopic = async () => {
    try {
      setIsGenerating(true);
      setEvaluation(null);

      const grade = parseInt(selectedGrade, 10);
      const out = await postJson<TopicResponse>('/topic/generate', { grade });

      setCurrentTopic({
        title: out.title,
        description: out.prompt,
        tags: out.tags,
        wordCount: out.wordCount,
        paragraphStructure: out.paragraphStructure,
      });

      // For demo: clear the essay box so the student starts fresh.
      setEssay('');
    } catch (err: any) {
      console.error('Generate topic failed:', err);
      alert(`Generate topic failed: ${err?.message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!essay.trim()) return;
    try {
      setIsEvaluating(true);

      const grade = parseInt(selectedGrade, 10);
      const out = await postJson<EvaluationResponse>('/submission/evaluate', {
        grade,
        essayText: essay,
        submissionId: 'ui-test',
      });

      setEvaluation(out);
    } catch (err: any) {
      console.error('Evaluate failed:', err);
      alert(`Evaluate failed: ${err?.message ?? err}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl">My Writing Coach</h1>
          </div>
          <p className="text-lg text-muted-foreground">Let's write together</p>
        </div>

        {/* Section 1: Topic Generation */}
        <Card className="mb-8 p-6 bg-white/80 backdrop-blur shadow-lg border-2">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2>Get Your Writing Topic</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end mb-4">
            <div className="flex-1 w-full sm:max-w-xs">
              <label className="block mb-2">Select Your Grade</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose grade" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
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
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isGenerating ? 'Generating...' : 'Generate Topic'}
            </Button>
          </div>

          {currentTopic && (
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
              <h3 className="mb-3 text-black font-bold">{currentTopic.title}</h3>
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
        </Card>

        {/* Section 2: Essay Writing */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Left: Essay Writing */}
          <Card className="lg:col-span-2 p-6 bg-white/80 backdrop-blur shadow-lg border-2">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h2>Write Your Essay</h2>
            </div>
            
            <Textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Start writing your essay here...&#10;&#10;Introduction: Introduce your main idea...&#10;&#10;Body Paragraph 1: Present your first point with details...&#10;&#10;Body Paragraph 2: Present your second point with details...&#10;&#10;Conclusion: Summarize your main points..."
              className="min-h-[400px] mb-4 bg-white resize-none"
            />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Word count: <span className={wordCount >= targetWordCount ? 'text-green-600' : 'text-foreground'}>{wordCount}</span>
              </span>
              <Button 
                onClick={handleEvaluate}
                disabled={!essay.trim() || isEvaluating}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isEvaluating ? 'Evaluating...' : 'Evaluate Essay'}
              </Button>
            </div>
          </Card>

          {/* Right: Writing Tips */}
          <Card className="p-6 bg-white/80 backdrop-blur shadow-lg border-2">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3>Writing Tips</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="mb-2">Target Word Count</h4>
                <div className="text-2xl text-blue-600 mb-2">{targetWordCount} words</div>
                <Progress 
                  value={Math.min(100, (wordCount / targetWordCount) * 100)} 
                  className="h-2"
                />
              </div>

              <div>
                <h4 className="mb-3">Essay Structure</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <div className="text-sm">Introduction</div>
                      <div className="text-xs text-muted-foreground">Hook + thesis</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <div className="text-sm">Body 1</div>
                      <div className="text-xs text-muted-foreground">First main point</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <div className="text-sm">Body 2</div>
                      <div className="text-xs text-muted-foreground">Second main point</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                    <div>
                      <div className="text-sm">Conclusion</div>
                      <div className="text-xs text-muted-foreground">Wrap up + final thought</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Section 3: Evaluation Results */}
        {evaluation && (
          <Card className="p-8 bg-white/80 backdrop-blur shadow-lg border-2">
            <h2 className="mb-6">Your Essay Evaluation</h2>
            
            {/* Overall Score */}
            <div className="flex justify-center mb-8">
              <div className="text-center">
                <div className="text-6xl mb-2">
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

            {/* Rubric Breakdown */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Ideas</span>
                  <div className="flex items-center gap-2">
                    <StarRating score={evaluation.rubric.ideas} maxScore={25} />
                    <span>{evaluation.rubric.ideas}/25</span>
                  </div>
                </div>
                <Progress value={(evaluation.rubric.ideas / 25) * 100} className="h-3 mb-4" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Organization</span>
                  <div className="flex items-center gap-2">
                    <StarRating score={evaluation.rubric.organization} maxScore={25} />
                    <span>{evaluation.rubric.organization}/25</span>
                  </div>
                </div>
                <Progress value={(evaluation.rubric.organization / 25) * 100} className="h-3 mb-4" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Voice</span>
                  <div className="flex items-center gap-2">
                    <StarRating score={evaluation.rubric.voice} maxScore={25} />
                    <span>{evaluation.rubric.voice}/25</span>
                  </div>
                </div>
                <Progress value={(evaluation.rubric.voice / 25) * 100} className="h-3 mb-4" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Conventions</span>
                  <div className="flex items-center gap-2">
                    <StarRating score={evaluation.rubric.conventions} maxScore={25} />
                    <span>{evaluation.rubric.conventions}/25</span>
                  </div>
                </div>
                <Progress value={(evaluation.rubric.conventions / 25) * 100} className="h-3 mb-4" />
              </div>
            </div>

            {/* Feedback Columns */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="p-5 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <h3>Strengths</h3>
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

              <Card className="p-5 bg-orange-50 border-orange-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <h3>Areas to Improve</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.issues.map((improvement, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-orange-600 mt-1">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-5 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                  <h3>Next Steps</h3>
                </div>
                <ul className="space-y-2">
                  {evaluation.nextSteps.map((step, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Detailed Feedback */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-5 bg-purple-50 border-purple-200">
                <h3 className="mb-3">Revision Suggestion</h3>
                <p className="text-sm text-foreground/80">{evaluation.revisionSuggestion}</p>
              </Card>

              <Card className="p-5 bg-indigo-50 border-indigo-200">
                <h3 className="mb-3">Coach Comment</h3>
                <p className="text-sm text-foreground/80">{evaluation.teacherComment}</p>
              </Card>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}