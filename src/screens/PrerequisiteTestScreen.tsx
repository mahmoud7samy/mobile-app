import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { generatePrerequisiteQuiz, analyzeWeakTopics } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';

type FlowState = 'select' | 'loading' | 'quiz' | 'analyzing' | 'results';

/** Matches EXACTLY what backend returns */
type Option = {
  id: string;   // "a", "b", "c", "d"
  text: string;
  isCorrect: boolean;
};

type Question = {
  questionText: string;
  correctAnswer: string;
  options: Option[];
  explanation?: string;
};

type IncorrectAnswer = {
  question: string;
  studentAnswer: string;
  correctAnswer: string;
};

export default function PrerequisiteTestScreen({ route, navigation }: any) {
  const { materials = [], subjectName = '' } = route.params ?? {};
  const { theme: t } = useThemeStore();

  const [flow, setFlow] = useState<FlowState>('select');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Store selected option ID (e.g. "a", "b"), matching web frontend behavior
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<{ materialId: string; fileName: string } | null>(null);
  const [results, setResults] = useState<{ score: number; total: number; weakTopics: string[]; studyPlan: string } | null>(null);

  const handleSelectMaterial = async (material: { materialId: string; fileName: string }) => {
    setSelectedMaterial(material);
    setFlow('loading');
    try {
      const { data } = await generatePrerequisiteQuiz(material.materialId, 5);
      const rawQuestions = data.questions ?? data ?? [];
      if (!rawQuestions || rawQuestions.length === 0) {
        Alert.alert('Not Ready', 'Could not generate questions for this material. Please try another.');
        setFlow('select');
        return;
      }
      // Map backend response to our Question type, preserving full option objects
      const mapped: Question[] = rawQuestions.map((q: any) => {
        const questionText = q.questionText || q.question || '';
        const correctAnswer = q.correctAnswer || '';
        const explanation = q.explanation || '';

        let options: Option[] = [];
        if (Array.isArray(q.options)) {
          options = q.options.map((o: any, idx: number) => {
            if (typeof o === 'string') {
              // Legacy format: plain string options – compare with correctAnswer
              return { id: String.fromCharCode(97 + idx), text: o, isCorrect: o === correctAnswer };
            }
            // Standard backend format: { id, text, isCorrect }
            return { id: o.id || String.fromCharCode(97 + idx), text: o.text || '', isCorrect: !!o.isCorrect };
          });
        }
        // Fallback: if no options array provided, build from correctAnswer + wrongOptions
        if (options.length === 0 && q.wrongOptions) {
          const allOpts = [correctAnswer, ...q.wrongOptions].sort(() => Math.random() - 0.5);
          options = allOpts.map((text: string, idx: number) => ({
            id: String.fromCharCode(97 + idx),
            text,
            isCorrect: text === correctAnswer,
          }));
        }
        return { questionText, correctAnswer, options, explanation };
      });
      setQuestions(mapped);
      setAnswers(new Array(mapped.length).fill(null));
      setCurrentIndex(0);
      setFlow('quiz');
    } catch (err: any) {
      console.error('[PreTest] Error:', JSON.stringify(err?.response?.data ?? err?.message));
      const serverMsg = err.response?.data?.message;
      const statusCode = err.response?.status;
      let msg = 'Failed to generate quiz.';
      if (serverMsg) {
        msg = typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg);
      } else if (statusCode === 500) {
        msg = 'The AI service encountered an error. The material may not be indexed yet, or the AI service is temporarily unavailable.';
      } else if (err.message) {
        msg = err.message;
      }
      Alert.alert('Error', msg);
      setFlow('select');
    }
  };

  const handleAnswer = async (optionId: string) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionId;
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All questions answered – calculate score using isCorrect flag
      setFlow('analyzing');
      const incorrectAnswers: IncorrectAnswer[] = [];
      let correctCount = 0;

      questions.forEach((q, i) => {
        const selectedOpt = q.options.find(opt => opt.id === newAnswers[i]);
        if (selectedOpt?.isCorrect) {
          correctCount++;
        } else {
          incorrectAnswers.push({
            question: q.questionText,
            studentAnswer: selectedOpt?.text || '',
            correctAnswer: q.correctAnswer,
          });
        }
      });

      let weakTopics: string[] = [];
      let studyPlan = '';
      if (incorrectAnswers.length > 0) {
        try {
          const { data } = await analyzeWeakTopics(incorrectAnswers);
          weakTopics = data.topics ?? [];
          studyPlan = data.studyPlan ?? '';
        } catch {
          studyPlan = 'Review the topics you answered incorrectly before proceeding.';
        }
      }
      setResults({ score: correctCount, total: questions.length, weakTopics, studyPlan });
      setFlow('results');
    }
  };

  // ── Material Selection ──────────────────────────────────────────────
  if (flow === 'select') {
    return (
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
        <Text style={[styles.title, { color: t.text }]}>Prerequisite Test</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          Select a course material to test your foundational knowledge before studying.
        </Text>
        {materials.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              No materials are available for this course yet.
            </Text>
          </View>
        ) : (
          materials.map((m: any) => (
            <TouchableOpacity
              key={m.materialId}
              style={[styles.materialCard, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}
              onPress={() => handleSelectMaterial(m)}
              activeOpacity={0.7}
            >
              <View style={[styles.fileTag, { backgroundColor: t.primary + '15' }]}>
                <Text style={[styles.fileTagText, { color: t.primary }]}>DOC</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.materialName, { color: t.text }]} numberOfLines={2}>{m.fileName}</Text>
                <Text style={[styles.materialHint, { color: t.textMuted }]}>Tap to start test</Text>
              </View>
              <Text style={{ color: t.textMuted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (flow === 'loading' || flow === 'analyzing') {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={[styles.loadingText, { color: t.textMuted }]}>
          {flow === 'loading' ? 'AI is generating your test…' : 'Analyzing your results…'}
        </Text>
      </View>
    );
  }

  // ── Quiz ─────────────────────────────────────────────────────────────
  if (flow === 'quiz') {
    const q = questions[currentIndex];
    const progress = (currentIndex + 1) / questions.length;
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />

        {/* Progress bar */}
        <View style={[styles.progressBg, { backgroundColor: t.border }]}>
          <View style={[styles.progressFill, { backgroundColor: t.primary, width: `${progress * 100}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.qCounter, { color: t.textMuted }]}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <View style={[styles.questionBox, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.questionText, { color: t.text }]}>{q.questionText}</Text>
          </View>

          <View style={styles.optionsContainer}>
            {q.options.map((opt: Option) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.optionBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                onPress={() => handleAnswer(opt.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.optionLabel, { backgroundColor: t.primary + '20' }]}>
                  <Text style={[styles.optionLabelText, { color: t.primary }]}>{opt.id.toUpperCase()}</Text>
                </View>
                <Text style={[styles.optionText, { color: t.text }]}>{opt.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────
  if (flow === 'results' && results) {
    const pct = Math.round((results.score / results.total) * 100);
    const passed = pct >= 60;
    const statusColor = passed ? t.success : t.danger;
    return (
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />

        <View style={[styles.scoreCard, { backgroundColor: statusColor + '15', borderColor: statusColor }]}>
          <Text style={[styles.scoreLabel, { color: t.textMuted }]}>Your Score</Text>
          <Text style={[styles.scorePct, { color: statusColor }]}>{pct}%</Text>
          <Text style={[styles.scoreRaw, { color: t.textSecondary }]}>
            {results.score} / {results.total} correct
          </Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {passed ? 'Well prepared!' : 'Review recommended'}
          </Text>
        </View>

        {results.weakTopics.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Topics to Review</Text>
            {results.weakTopics.map((topic, i) => (
              <View key={i} style={[styles.topicChip, { backgroundColor: t.danger + '15', borderColor: t.danger + '40' }]}>
                <Text style={[styles.topicText, { color: t.danger }]}>{topic}</Text>
              </View>
            ))}
          </View>
        )}

        {results.studyPlan.length > 0 && (
          <View style={[styles.section, styles.studyPlanBox, { backgroundColor: t.primary + '08', borderColor: t.primary + '25' }]}>
            <Text style={[styles.sectionTitle, { color: t.primary }]}>Personalized Study Plan</Text>
            <Text style={[styles.studyPlanText, { color: t.text }]}>{results.studyPlan}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: t.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.retryBtn, { borderColor: t.border }]}
          onPress={() => { setFlow('select'); setQuestions([]); setAnswers([]); setResults(null); }}
        >
          <Text style={[styles.retryBtnText, { color: t.textSecondary }]}>Try Another Material</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  materialCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  fileTag: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  materialName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  materialHint: { fontSize: 12 },
  loadingText: { fontSize: 14, marginTop: 12 },
  progressBg: { height: 4 },
  progressFill: { height: 4 },
  qCounter: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 },
  questionBox: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  optionsContainer: { gap: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  optionLabel: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 13, fontWeight: '800' },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  scoreCard: {
    alignItems: 'center', borderRadius: 20, borderWidth: 1,
    padding: 28, marginBottom: 28,
  },
  scoreLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  scorePct: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  scoreRaw: { fontSize: 15, marginTop: 4 },
  statusText: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  topicChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 },
  topicText: { fontSize: 14, fontWeight: '600' },
  studyPlanBox: { borderRadius: 16, borderWidth: 1, padding: 16 },
  studyPlanText: { fontSize: 14, lineHeight: 22 },
  doneBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retryBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  retryBtnText: { fontSize: 15, fontWeight: '600' },
});
