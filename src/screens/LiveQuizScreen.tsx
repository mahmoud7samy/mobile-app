import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../lib/api';
import { useAuthStore } from '../lib/store';

type GameState = 'joining' | 'joinError' | 'waiting' | 'countdown' | 'question' | 'results' | 'complete';

interface Player {
  rank?: number;
  studentId?: string;
  studentName: string;
  score: number;
  streak: number;
}

interface Option {
  id: string;
  text?: string;
}

const SHAPE_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];

export default function LiveQuizScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName } = route.params ?? {};
  const user = useAuthStore((s) => s.user);
  const studentId = user?.profileId ?? user?.userId ?? '';
  const studentName = user?.profileName ?? user?.username ?? 'Student';

  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [gameState, setGameState] = useState<GameState>('joining');
  const [joinError, setJoinError] = useState('');
  const [question, setQuestion] = useState<{ text?: string; options: Option[] } | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number; streak: number; totalScore: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(20);
  const attemptedJoin = useRef(false);

  useEffect(() => {
    const base = API_BASE_URL.replace(/\/$/, '');
    const socketUrl = `${base}/live-quiz`;
    const s = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
    });
    setSocket(s);

    s.on('joinedSuccessfully', ({ sessionId }: { sessionId: string }) => {
      if (sessionId) setSessionCode(sessionId);
      setGameState('waiting');
    });

    s.on('joinError', ({ message }: { message?: string }) => {
      setJoinError(message ?? 'No live quiz is active for this course. Ask your teacher to start one.');
      setGameState('joinError');
    });

    s.on('quizStarted', () => {
      setGameState('countdown');
    });

    s.on('newQuestion', ({ questionIndex: idx, question: q, options, timeLimit }: any) => {
      setQuestionIndex(idx);
      setQuestion({ text: q, options: options ?? [] });
      setTimeLeft(timeLimit ?? 20);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setGameState('question');
    });

    s.on('answerResult', (result: any) => {
      setAnswerResult(result);
    });

    s.on('questionResults', ({ leaderboard: lb }: { leaderboard?: Player[] }) => {
      if (lb) setLeaderboard(lb);
      setGameState('results');
    });

    s.on('quizComplete', ({ leaderboard: lb }: { leaderboard?: Player[] }) => {
      if (lb) setLeaderboard(lb);
      setGameState('complete');
    });

    s.on('leaderboard', ({ leaderboard: lb }: { leaderboard?: Player[] }) => {
      if (lb) setLeaderboard(lb);
    });

    s.on('quizEnded', ({ leaderboard: lb }: { leaderboard?: Player[] }) => {
      if (lb) setLeaderboard(lb);
      setGameState('complete');
    });

    return () => {
      s.removeAllListeners();
      s.close();
    };
  }, []);

  useEffect(() => {
    if (attemptedJoin.current || !socket || !courseInstanceId?.trim() || !studentId || gameState !== 'joining') return;
    attemptedJoin.current = true;
    socket.emit('joinByCourse', {
      courseInstanceId: courseInstanceId.trim(),
      studentId,
      studentName,
    });
  }, [socket, courseInstanceId, studentId, studentName, gameState]);

  useEffect(() => {
    if (gameState !== 'question' || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [gameState, timeLeft]);

  const handleAnswer = (answerId: string) => {
    if (!socket || selectedAnswer || !sessionCode) return;
    setSelectedAnswer(answerId);
    socket.emit('submitAnswer', {
      code: sessionCode,
      studentId,
      questionIndex,
      answerId,
      timeRemaining: timeLeft,
    });
  };

  if (!courseInstanceId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing course. Open Live Quiz from a course on the dashboard.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gameState === 'joining') {
    return (
      <View style={[styles.centered, styles.bgPurple]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.waitingText}>Joining live quiz...</Text>
      </View>
    );
  }

  if (gameState === 'joinError') {
    return (
      <View style={[styles.centered, styles.bgPurple]}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No quiz right now</Text>
          <Text style={styles.cardMessage}>{joinError}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>← Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (gameState === 'waiting') {
    return (
      <View style={[styles.centered, styles.bgPurple]}>
        <Text style={styles.emoji}>🎮</Text>
        <Text style={styles.waitingTitle}>Waiting for host</Text>
        <Text style={styles.waitingText}>{studentName}</Text>
      </View>
    );
  }

  if (gameState === 'countdown') {
    return (
      <View style={[styles.centered, styles.bgPurple]}>
        <Text style={styles.countdownText}>Get Ready!</Text>
      </View>
    );
  }

  if (gameState === 'results') {
    const myEntry = leaderboard.find((p) => p.studentId === studentId || p.studentName === studentName);
    const myScore = myEntry?.score ?? answerResult?.totalScore ?? 0;
    const myRank = myEntry ? leaderboard.filter((p) => p.score > myEntry.score).length + 1 : null;
    return (
      <View style={[styles.centered, styles.bgPurple]}>
        <Text style={styles.resultsTitle}>Nice job!</Text>
        <Text style={styles.resultsScore}>{myScore} pts</Text>
        {myRank != null && (
          <Text style={styles.resultsRank}>
            {myRank === 1 ? '🥇 1st!' : myRank === 2 ? '🥈 2nd!' : myRank === 3 ? '🥉 3rd!' : `#${myRank}`}
          </Text>
        )}
        <Text style={styles.nextHint}>Next question in a few seconds...</Text>
      </View>
    );
  }

  if (gameState === 'question' && question) {
    const options = question.options?.slice(0, 4) ?? [];
    return (
      <View style={styles.questionScreen}>
        <View style={styles.timerWrap}>
          <Text style={[styles.timer, timeLeft <= 5 && styles.timerDanger]}>{timeLeft}</Text>
        </View>
        <View style={styles.optionsGrid}>
          {options.map((opt, idx) => {
            const isSelected = selectedAnswer === opt.id;
            const isCorrect = answerResult?.correct && isSelected;
            const isWrong = answerResult && !answerResult.correct && isSelected;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionBtn,
                  { backgroundColor: SHAPE_COLORS[idx % 4] },
                  (isCorrect && styles.optionCorrect) || (isWrong && styles.optionWrong),
                ]}
                onPress={() => handleAnswer(opt.id)}
                disabled={!!selectedAnswer}
                activeOpacity={0.9}
              >
                <Text style={styles.optionLabel}>{opt.text || ['○', '◇', '□', '△'][idx % 4]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {answerResult && (
          <View style={styles.answerFeedback}>
            <Text style={[styles.feedbackText, answerResult.correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
              {answerResult.correct ? `+${answerResult.points} pts!` : 'Wrong!'}
            </Text>
            <Text style={styles.streakText}>Streak: {answerResult.streak} 🔥 Total: {answerResult.totalScore}</Text>
          </View>
        )}
      </View>
    );
  }

  if (gameState === 'complete') {
    const myEntry = leaderboard.find((p) => p.studentId === studentId || p.studentName === studentName);
    const myRank = myEntry ? leaderboard.filter((p) => p.score > myEntry.score).length + 1 : null;
    return (
      <View style={[styles.centered, styles.bgPurple, styles.padded]}>
        <Text style={styles.finalTitle}>🏆 Final Results</Text>
        <View style={styles.finalCard}>
          {myEntry != null && myRank != null ? (
            <>
              <Text style={styles.finalEmoji}>{myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏅'}</Text>
              <Text style={styles.finalRank}>You placed #{myRank}</Text>
              <Text style={styles.finalScore}>{myEntry.score} pts</Text>
            </>
          ) : (
            <Text style={styles.noResult}>No result</Text>
          )}
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Dashboard')}>
          <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  padded: { padding: 24 },
  bgPurple: { backgroundColor: '#7c3aed' },
  error: { color: '#fef2f2', textAlign: 'center', marginBottom: 16 },
  backBtn: { padding: 12, marginTop: 8 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 8 },
  cardMessage: { fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 20 },
  primaryBtn: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', maxWidth: 340, alignItems: 'center' },
  primaryBtnText: { color: '#7c3aed', fontWeight: '700', fontSize: 16 },
  emoji: { fontSize: 56, marginBottom: 16 },
  waitingTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  waitingText: { fontSize: 18, color: 'rgba(255,255,255,0.9)' },
  countdownText: { fontSize: 42, fontWeight: '800', color: '#fff' },
  resultsTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  resultsScore: { fontSize: 48, fontWeight: '800', color: '#fcd34d', marginBottom: 4 },
  resultsRank: { fontSize: 20, color: '#fff', marginBottom: 16 },
  nextHint: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  questionScreen: { flex: 1, backgroundColor: '#111', padding: 16, justifyContent: 'center' },
  timerWrap: { position: 'absolute', top: 48, left: 16 },
  timer: { fontSize: 48, fontWeight: '800', color: '#fff' },
  timerDanger: { color: '#ef4444' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 24 },
  optionBtn: {
    width: '47%',
    minHeight: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCorrect: { borderWidth: 4, borderColor: '#fff', opacity: 1 },
  optionWrong: { backgroundColor: '#4b5563', opacity: 0.9 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', padding: 8 },
  answerFeedback: { alignItems: 'center', marginTop: 8 },
  feedbackText: { fontSize: 28, fontWeight: '800' },
  feedbackCorrect: { color: '#4ade80' },
  feedbackWrong: { color: '#f87171' },
  streakText: { fontSize: 18, color: '#fff', marginTop: 4 },
  finalTitle: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 24 },
  finalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 320, alignItems: 'center', marginBottom: 24 },
  finalEmoji: { fontSize: 56, marginBottom: 8 },
  finalRank: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  finalScore: { fontSize: 20, fontWeight: '600', color: '#7c3aed' },
  noResult: { color: '#6b7280', fontSize: 16 },
});
