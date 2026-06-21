import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, ScrollView, Platform, Dimensions, SafeAreaView,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../lib/api';

type GameState = 'waiting' | 'countdown' | 'question' | 'results' | 'complete';

interface Player {
  rank?: number;
  studentId?: string;
  studentName: string;
  score: number;
  streak: number;
}

const SHAPES = ['circle', 'diamond', 'square', 'triangle'] as const;
const SHAPE_COLORS = ['red', 'blue', 'yellow', 'green'] as const;

export default function LiveQuizScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName } = route.params;
  const { user, token } = useAuthStore();
  const { theme: t } = useThemeStore();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState>('waiting');
  
  const [question, setQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(20);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [joinErrorMessage, setJoinErrorMessage] = useState('');

  const studentId = user?.userId || '';
  const studentName = user?.username || 'Student';
  const attemptedJoinRef = useRef(false);

  // Fallback scale animation for buttons
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Determine the WS URL (strip trailing slash from API_BASE_URL)
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const socketUrl = `${baseUrl}/live-quiz`;
    
    const newSocket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      auth: { token },
    });
    setSocket(newSocket);

    newSocket.on('joinedSuccessfully', ({ sessionId }) => {
      if (sessionId) setSessionCode(sessionId);
      setJoined(true);
    });

    newSocket.on('joinError', (payload: { message?: string } | string) => {
      const message = typeof payload === 'string' ? payload : payload?.message;
      setJoinErrorMessage(message || 'No live quiz is active for this subject. Ask your teacher to start one.');
    });

    newSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        navigation.goBack();
      }
    });

    newSocket.on('quizStarted', ({ totalQuestions: total }) => {
      setTotalQuestions(total);
      setGameState('countdown');
    });

    newSocket.on('newQuestion', ({ questionIndex: idx, question: q, options, timeLimit }) => {
      setQuestionIndex(idx);
      setQuestion({ text: q, options });
      setTimeLeft(timeLimit);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setGameState('question');
    });

    newSocket.on('answerResult', (result) => {
      setAnswerResult(result);
    });

    newSocket.on('questionResults', ({ leaderboard: lb }) => {
      if (lb) setLeaderboard(lb);
      setGameState('results');
    });

    newSocket.on('quizComplete', ({ leaderboard: lb }) => {
      setLeaderboard(lb);
      setGameState('complete');
    });

    newSocket.on('leaderboard', ({ leaderboard: lb }) => {
      setLeaderboard(lb || []);
    });

    newSocket.on('quizEnded', ({ leaderboard: lb }) => {
      setLeaderboard(lb || []);
      setGameState('complete');
    });

    return () => {
      newSocket.close();
    };
  }, [token, navigation]);

  // Join the live quiz room automatically once the socket is ready
  useEffect(() => {
    if (attemptedJoinRef.current || joined || !socket || !courseInstanceId || !studentId) return;
    attemptedJoinRef.current = true;
    socket.emit('joinByCourse', {
      courseInstanceId,
      studentId,
      studentName,
    });
  }, [socket, joined, courseInstanceId, studentId, studentName]);

  // Handle Countdown Timer
  useEffect(() => {
    if (gameState !== 'question' || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
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

  // --- RENDERING HELPERS ---

  const renderShapeIcon = (shape: string, color: string) => {
    const size = 50;
    const c = '#fff'; // White icons for contrast against colorful buttons
    
    switch (shape) {
      case 'circle':
        return <View style={{ width: size, height: size, borderRadius: size/2, borderWidth: 4, borderColor: c }} />;
      case 'diamond':
        return <View style={{ width: size*0.7, height: size*0.7, borderWidth: 4, borderColor: c, transform: [{ rotate: '45deg' }] }} />;
      case 'square':
        return <View style={{ width: size, height: size, borderRadius: 8, borderWidth: 4, borderColor: c }} />;
      case 'triangle':
        return <View style={{ width: 0, height: 0, borderLeftWidth: size/2, borderRightWidth: size/2, borderBottomWidth: size, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: c }} />;
      default:
        return null;
    }
  };

  const renderShapeButton = (shape: string, color: string, index: number, optionId: string) => {
    const colorMap: any = { red: '#EF4444', blue: '#3B82F6', yellow: '#EAB308', green: '#10B981' };
    const bgColor = colorMap[color] || '#6B7280';
    
    const isSelected = selectedAnswer === optionId;
    const isDisabled = selectedAnswer !== null;
    
    let btnStyle: any = { backgroundColor: bgColor };
    
    // Once an answer is selected, dim unselected options
    if (isDisabled && !isSelected) {
      btnStyle.opacity = 0.5;
    }

    // When the results come in, heavily highlight correct/wrong
    if (answerResult) {
      if (answerResult.isCorrect && isSelected) {
        btnStyle = { backgroundColor: '#10B981', borderWidth: 4, borderColor: '#fff' }; // Success Green
      } else if (!answerResult.isCorrect && isSelected) {
        btnStyle = { backgroundColor: '#4B5563', opacity: 0.8 }; // Grayed out if wrong
      }
    }

    return (
      <TouchableOpacity
        key={optionId}
        activeOpacity={0.8}
        disabled={isDisabled}
        onPress={() => handleAnswer(optionId)}
        style={[styles.shapeButton, btnStyle]}
      >
        {renderShapeIcon(shape, color)}
      </TouchableOpacity>
    );
  };

  // --- SCREENS ---

  if (joinErrorMessage) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Ionicons name="warning" size={48} color={t.danger} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: t.text, textAlign: 'center', marginBottom: 16 }]}>{joinErrorMessage}</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: t.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!joined) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} style={{ marginBottom: 16 }} />
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Connecting to Live Quiz...</Text>
      </View>
    );
  }

  if (gameState === 'waiting') {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <Ionicons name="people" size={64} color={t.primary} style={{ marginBottom: 20 }} />
        <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>You're in!</Text>
        <Text style={{ color: t.textMuted, fontSize: 18, marginTop: 12, textAlign: 'center' }}>
          See your nickname on screen?{'\n'}Waiting for the teacher to start...
        </Text>
        <TouchableOpacity style={[styles.btnOutline, { borderColor: t.border, marginTop: 40 }]} onPress={() => navigation.goBack()}>
          <Text style={{ color: t.text, fontWeight: '600' }}>Leave Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gameState === 'countdown') {
    return (
      <View style={[styles.centered, { backgroundColor: t.primary }]}>
        <Text style={{ fontSize: 48, fontWeight: '900', color: '#fff', marginBottom: 20 }}>Get Ready!</Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (gameState === 'question') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={[styles.header, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.text }}>
            Question {questionIndex + 1} of {totalQuestions}
          </Text>
          <View style={[styles.timerBadge, { backgroundColor: timeLeft <= 5 ? t.danger : t.primary }]}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{timeLeft}s</Text>
          </View>
        </View>

        {answerResult ? (
          <View style={[styles.resultBanner, { backgroundColor: answerResult.isCorrect ? t.success : t.danger }]}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
              {answerResult.isCorrect ? 'Correct! 🎉' : 'Incorrect 😢'}
            </Text>
            {answerResult.pointsEarned > 0 && (
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                +{answerResult.pointsEarned} points
              </Text>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.grid}>
          {question?.options.map((opt: any, i: number) => {
            const shape = SHAPES[i % SHAPES.length];
            const color = SHAPE_COLORS[i % SHAPE_COLORS.length];
            return renderShapeButton(shape, color, i, opt.id);
          })}
        </View>
      </SafeAreaView>
    );
  }

  if (gameState === 'results' || gameState === 'complete') {
    const isComplete = gameState === 'complete';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.resultsHeader}>
          <Text style={[styles.title, { color: t.text }]}>
            {isComplete ? 'Final Podium' : 'Leaderboard'}
          </Text>
          {isComplete && <Text style={{ color: t.textMuted, marginTop: 8 }}>The quiz has ended!</Text>}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {leaderboard.map((p, i) => (
            <View key={i} style={[styles.playerRow, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#FBBF24' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : t.primaryLight }]}>
                <Text style={{ color: i < 3 ? '#fff' : t.primary, fontWeight: 'bold', fontSize: 16 }}>{i + 1}</Text>
              </View>
              <Text style={[styles.playerName, { color: t.text }]}>
                {p.studentName} {p.studentId === studentId ? '(You)' : ''}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>{p.score}</Text>
                {p.streak > 2 && <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: 'bold' }}>🔥 {p.streak} Streak</Text>}
              </View>
            </View>
          ))}
        </ScrollView>

        {isComplete && (
          <View style={{ padding: 20 }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: t.primary }]} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  timerBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, flex: 1, alignContent: 'flex-end' },
  shapeButton: { width: '48%', aspectRatio: 1, margin: '1%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  resultBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, margin: 16, borderRadius: 16 },
  resultsHeader: { padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  playerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  playerName: { flex: 1, fontSize: 16, fontWeight: '700' },
  btn: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
});
