import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getQuiz, startQuiz, upsertQuizAnswer, submitQuiz } from '../lib/api';
import { useThemeStore } from '../lib/themeStore';

export default function ExamScreen({ route, navigation }: any) {
  const { quizId, subjectName, timeLimit } = route.params;
  const { theme: t } = useThemeStore();
  const [quiz, setQuiz] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit ? timeLimit * 60 : 0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initExam();
  }, [quizId]);

  useEffect(() => {
    if (timeLeft <= 0 || submitting || !attemptId) return;
    const iv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(iv);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timeLeft, submitting, attemptId]);

  const initExam = async () => {
    try {
      const { data: qData } = await getQuiz(quizId);
      setQuiz(qData);
      
      const { data: aData } = await startQuiz(quizId);
      setAttemptId(aData.attemptId);
      setQuestions(qData.questions || []);
      
      if (aData.startedAt && qData.durationMinutes) {
        const elapsed = Math.floor((Date.now() - new Date(aData.startedAt).getTime()) / 1000);
        const rem = qData.durationMinutes * 60 - elapsed;
        setTimeLeft(Math.max(0, rem));
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load exam.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { selectedOption: optionId } }));
    if (attemptId) {
      try {
        await upsertQuizAnswer(attemptId, { questionId, selectedOption: optionId });
      } catch (err) {
        console.error('Failed to save answer', err);
      }
    }
  };

  const handleAutoSubmit = async () => {
    Alert.alert('Time Up', 'Your exam time has expired. Submitting your answers automatically.', [
      { text: 'OK', onPress: () => doSubmit() }
    ]);
  };

  const confirmSubmit = () => {
    Alert.alert('Submit Exam', 'Are you sure you want to submit your exam?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', style: 'destructive', onPress: () => doSubmit() }
    ]);
  };

  const doSubmit = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const payload = Object.keys(answers).map(qId => ({
        questionId: qId,
        ...answers[qId]
      }));
      await submitQuiz(attemptId, payload);
      Alert.alert('Success', 'Exam submitted successfully.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit exam.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.headerTitle, { color: t.text }]}>{quiz?.title || 'Exam'}</Text>
        <Text style={[styles.timer, { color: timeLeft < 60 ? '#EF4444' : t.primary }]}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </Text>
      </View>

      <View style={[styles.progressContainer, { borderBottomColor: t.border }]}>
        <Text style={[styles.progressText, { color: t.textSecondary }]}>
          Question {currentIdx + 1} of {questions.length}
        </Text>
        <Text style={[styles.progressText, { color: t.textSecondary }]}>
          {answeredCount} answered
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {q && (
          <View style={[styles.questionCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.questionText, { color: t.text }]}>{q.questionText}</Text>
            
            <View style={styles.options}>
              {q.options?.map((opt: any) => {
                const isSelected = answers[q.questionId]?.selectedOption === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => handleSelectOption(q.questionId, opt.id)}
                    style={[
                      styles.optionBtn,
                      { 
                        backgroundColor: isSelected ? t.primary + '20' : t.surface,
                        borderColor: isSelected ? t.primary : t.border 
                      }
                    ]}
                  >
                    <View style={[styles.radio, { borderColor: isSelected ? t.primary : t.border }]}>
                      {isSelected && <View style={[styles.radioDot, { backgroundColor: t.primary }]} />}
                    </View>
                    <Text style={[styles.optionText, { color: t.text }]}>{opt.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        <TouchableOpacity
          disabled={currentIdx === 0}
          onPress={() => setCurrentIdx(prev => prev - 1)}
          style={[styles.navBtn, { backgroundColor: currentIdx === 0 ? t.surface2 : t.primaryLight }]}
        >
          <Text style={{ color: currentIdx === 0 ? t.textMuted : t.primary, fontWeight: '600' }}>Previous</Text>
        </TouchableOpacity>
        
        {currentIdx < questions.length - 1 ? (
          <TouchableOpacity
            onPress={() => setCurrentIdx(prev => prev + 1)}
            style={[styles.navBtn, { backgroundColor: t.primaryLight }]}
          >
            <Text style={{ color: t.primary, fontWeight: '600' }}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={confirmSubmit}
            style={[styles.navBtn, { backgroundColor: t.primary }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Submit Exam</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  timer: { fontSize: 16, fontWeight: '800' },
  progressContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  progressText: { fontSize: 14, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  questionCard: { borderRadius: 12, borderWidth: 1, padding: 20, marginBottom: 20 },
  questionText: { fontSize: 18, fontWeight: '600', marginBottom: 24, lineHeight: 26 },
  options: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, borderWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 16, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1 },
  navBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
});
