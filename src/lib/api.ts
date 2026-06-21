import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken, useAuthStore } from './store';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'https://ai-powered-college-platform-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE_URL.replace(/\/$/, '') + '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  async (response) => {
    if (response.config.method?.toLowerCase() === 'get' && response.config.url) {
      try {
        const cacheKey = `api_cache_${response.config.url}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
      } catch (e) {
        // Ignore cache save errors
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth().catch(() => { });
    } else if (!error.response && error.config && error.config.method?.toLowerCase() === 'get' && error.config.url) {
      // Likely a network error, attempt to load from cache
      try {
        const cacheKey = `api_cache_${error.config.url}`;
        const cachedDataStr = await AsyncStorage.getItem(cacheKey);
        if (cachedDataStr) {
          return Promise.resolve({
            data: JSON.parse(cachedDataStr),
            status: 200,
            statusText: 'OK from Cache',
            headers: {},
            config: error.config,
            isCached: true
          });
        }
      } catch (e) {
        // Ignore cache read errors
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiUser {
  userId: string;
  username: string;
  role: 'admin' | 'teacher' | 'ta' | 'student' | 'credentials_distributor';
  profileId?: string;
  profileName?: string;
}

export const login = (username: string, password: string) =>
  api.post<{ accessToken: string; user: ApiUser }>('/auth/login', { username, password });

/** Dashboard (role-based: student / teacher / ta / admin) */
export const getDashboard = () => api.get<DashboardResponse>('/dashboard');

export interface DashboardResponse {
  student?: { studentId: string; studentName: string; studentCode: string; levelName: string; levelId: string };
  courses?: DashboardCourse[];
  stats?: {
    // Student stats
    averageScore?: number;
    overallAttendance?: number;
    rank?: number | null;
    totalInLevel?: number;
    completedQuizzes?: number;
    totalQuizzes?: number;

    // Teacher / TA stats
    totalCourses?: number;
    totalStudents?: number;
    totalMaterials?: number;
    averageClassScore?: number;
  };
  scoreBySubject?: { subjectName: string; averageScore: number; attemptCount: number }[];
  leaderboard?: { rank: number; studentCode: string; studentName: string; averageScore: number; isCurrentUser?: boolean }[];
  currentYear?: unknown;
  prerequisiteTestEnabled?: boolean;
  [key: string]: unknown;
}

export interface DashboardCourse {
  courseInstanceId: string;
  subjectId: string;
  subjectName: string;
  levelName: string;
  courseType?: 'theory' | 'practical';
  hasPractical?: boolean;
  teacher?: { teacherId: string; teacherName: string };
  ta?: { taId: string; taName: string } | null;
  materials?: { materialId: string; fileName: string; materialType: string; uploadedAt: string }[];
  hasActiveAttendance?: boolean;
  attendance?: { courseInstanceId: string; totalSessions: number; attended: number; percentage: number };
}

// ——— Group Chat (same backend as web; messages sync across both) ———
export const getChatRoom = (courseInstanceId: string) =>
  api.get<ChatRoomResponse>(`/chat/rooms/${courseInstanceId}`);

export const getChatMessages = (courseInstanceId: string, limit?: number, before?: string) =>
  api.get<{ messages: ChatMessage[] }>(`/chat/rooms/${courseInstanceId}/messages`, {
    params: { limit: limit ?? 50, before },
  });

export const sendChatText = (courseInstanceId: string, content: string) =>
  api.post<ChatMessage>(`/chat/rooms/${courseInstanceId}/messages/text`, { content });

export const sendChatAttachments = (courseInstanceId: string, formData: FormData) =>
  api.post<ChatMessage>(`/chat/rooms/${courseInstanceId}/messages/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

export const sendChatPoll = (courseInstanceId: string, question: string, options: string[]) =>
  api.post<ChatMessage>(`/chat/rooms/${courseInstanceId}/messages/poll`, { question, options });

export const voteChatPoll = (messageId: string, optionIndex: number) =>
  api.post(`/chat/polls/vote`, { messageId, optionIndex });

export const getChatActivity = (limit?: number) =>
  api.get<ChatActivityItem[]>(`/chat/activity`, { params: { limit: limit ?? 50 } });

export const getChatUnread = () =>
  api.get<ChatUnreadItem[]>(`/chat/unread`);

export const markChatAsRead = (courseInstanceId: string) =>
  api.post(`/chat/rooms/${courseInstanceId}/mark-read`);

export interface ChatRoomResponse {
  chatRoomId: string;
  courseInstanceId: string;
  subjectName: string;
  levelName: string;
  teacherName?: string;
  taName?: string | null;
}

export interface ChatMessage {
  messageId: string;
  chatRoomId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  messageType: 'text' | 'attachment' | 'poll';
  content: string;
  createdAt: string;
  attachments?: { attachmentId: string; fileName: string; fileSize: number }[];
  pollData?: { question: string; options: string[]; votes?: Record<string, number> };
}

export interface ChatActivityItem {
  id: string;
  type: string;
  courseInstanceId: string;
  subjectName: string;
  levelName: string;
  courseType?: string;
  teacherName: string;
  taName: string | null;
  senderName: string;
  senderRole: string;
  preview: string;
  messageType: string;
  timestamp: string;
}

export interface ChatUnreadItem {
  courseInstanceId: string;
  subjectName: string;
  levelName: string;
  teacherName: string;
  taName: string | null;
  unreadCount: number;
}

// ——— Tasks (same backend as web) ———
export const getTasksByCourse = (courseInstanceId: string) =>
  api.get<TaskListItem[]>(`/tasks/course/${courseInstanceId}`);

export const getTask = (taskId: string) =>
  api.get<TaskDetail>(`/tasks/${taskId}`);

/** Presigned PUT URL for direct object upload */
export const requestTaskUploadUrl = (body: {
  taskId: string;
  originalName: string;
  contentType: string;
  size: number;
}) => api.post<{ url: string; fileKey: string }>('/tasks/upload-url', body);

/** Finalize task submission metadata */
export const submitTaskRecord = (body: {
  taskId: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}) => api.post('/tasks/submit', body);

export interface TaskAttachment {
  attachmentId: string;
  fileName: string;
  fileSize: number;
}

export interface TaskListItem {
  taskId: string;
  taskName: string;
  description: string;
  deadline: string;
  totalPoints: number;
  createdAt: string;
  attachments: TaskAttachment[];
  submitted: boolean;
  submissionId?: string;
  submittedAt?: string;
  grade?: number | null;
}

export interface TaskDetail {
  taskId: string;
  taskName: string;
  description: string;
  deadline: string;
  totalPoints: number;
  createdAt: string;
  courseInstanceId: string;
  attachments: TaskAttachment[];
  courseInstance?: { subject: { subjectName: string }; level: { levelName: string } };
}

export interface TaskSubmission {
  submissionId: string;
  taskId: string;
  studentId: string;
  submittedAt: string;
  grade?: number | null;
  totalPoints?: number;
}

export const getSubmissionsForGrading = (courseInstanceId: string) =>
  api.get<any[]>(`/tasks/course/${courseInstanceId}/grading`);

export const setTaskGrade = (submissionId: string, grade: number) =>
  api.put<{ message: string }>(`/tasks/submissions/${submissionId}/grade`, { grade });

// ——— Materials (same backend as web) ———
export const getMaterials = (courseInstanceId: string) =>
  api.get<MaterialsByCourseResponse>(`/materials/course/${courseInstanceId}`);

export interface MaterialItem {
  materialId: string;
  fileName: string;
  materialType: string;
  fileSize: number;
  uploadedAt: string;
  isEmbedded?: boolean;
}

export interface MaterialsByCourseResponse {
  courseInstanceId: string;
  teacherMaterials: MaterialItem[];
  taMaterials: MaterialItem[];
}

// ——— Attendance & Absence Excuses ———
export const checkInAttendance = (code: string, courseInstanceId: string) =>
  api.post<{ message: string; points: number }>('/attendance/checkin', { code, courseInstanceId });

export const submitQrScan = (token: string, scannedAt: string, courseInstanceId: string) =>
  api.post<{ attemptId?: string; needWebAuthn?: boolean; options?: any; verified?: boolean; points?: number }>('/attendance/qr/scan', { qrToken: token, scannedAt, courseInstanceId });

export const completeQrAttendance = (attemptId: string, courseInstanceId: string, assertionResponse: any) =>
  api.post<{ message: string; points: number }>('/attendance/qr/complete', { attemptId, courseInstanceId, assertionResponse });

// Teacher Attendance
export const startAttendanceSession = (courseInstanceId: string, durationMinutes: number) =>
  api.post<{ sessionId: string; sessionCode: string }>('/attendance/start', { courseInstanceId, durationMinutes });

export const getActiveAttendanceSession = (courseInstanceId: string) =>
  api.get<any>(`/attendance/session/${courseInstanceId}`);

export const confirmAttendanceRecord = (sessionId: string, studentId: string, status: 'present' | 'absent') =>
  api.post<{ message: string }>(`/attendance/session/${sessionId}/confirm-record`, { studentId, status });

export const confirmAllAttendance = (sessionId: string) =>
  api.post<{ message: string }>(`/attendance/session/${sessionId}/confirm-all`);

export const startQrAttendanceSession = (courseInstanceId: string) =>
  api.post<{ qrSessionId: string }>('/attendance/qr/start', { courseInstanceId });

export const getQrToken = (qrSessionId: string) =>
  api.get<{ token: string; validTo: string }>(`/attendance/qr/token/${qrSessionId}`);

export const getActiveQrSession = (qrSessionId: string) =>
  api.get<any>(`/attendance/qr/session/${qrSessionId}`);

export const confirmAllQrAttendance = (qrSessionId: string) =>
  api.post<{ message: string }>(`/attendance/qr/session/${qrSessionId}/confirm-all`);

// Absence Reasons
export const getSessionsForAbsenceReasons = (courseInstanceId: string) =>
  api.get<any[]>(`/attendance/sessions/${courseInstanceId}/absence-reasons`);

export const submitAbsenceReason = (sessionId: string, formData: FormData) =>
  api.post<{ message: string }>(`/attendance/absence-reason/submit/${sessionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const submitAbsenceReasonRange = (courseInstanceId: string, formData: FormData) =>
  api.post<{ message: string }>(`/attendance/absence-reason/range/submit/${courseInstanceId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getAttendanceReport = (courseInstanceId: string) =>
  api.get<any>(`/attendance/report/${courseInstanceId}`);

export const getAbsenceReasonSubmissions = (courseInstanceId: string) =>
  api.get<any[]>(`/attendance/absence-reasons/course/${courseInstanceId}`);

export const approveAbsenceReason = (submissionId: string) =>
  api.post<{ message: string }>(`/attendance/absence-reason/${submissionId}/approve`);

export const rejectAbsenceReason = (submissionId: string) =>
  api.post<{ message: string }>(`/attendance/absence-reason/${submissionId}/reject`);

export const approveAbsenceReasonRange = (submissionId: string) =>
  api.post<{ message: string }>(`/attendance/absence-reason/range/${submissionId}/approve`);

export const rejectAbsenceReasonRange = (submissionId: string) =>
  api.post<{ message: string }>(`/attendance/absence-reason/range/${submissionId}/reject`);

// ——— Notifications & Announcements ———
export const getStudentNotifications = () =>
  api.get<any[]>('/dashboard/student/notifications');

export const getStudentAnnouncements = () =>
  api.get<any[]>('/announcements/student');

export const getStaffAnnouncements = () =>
  api.get<any[]>('/announcements/staff');

export const getAdminAnnouncements = () => api.get<any[]>('/announcements/admin');
export const downloadAnnouncementAttachment = (attachmentId: string) =>
  api.get(`/announcements/attachments/${attachmentId}/download`, { responseType: 'blob' });

export const createCourseAnnouncement = (formData: FormData) =>
  api.post<{ message: string }>('/announcements/course', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ——— WebAuthn / Passkey Registration ———
export const getWebAuthnRegisterStatus = (courseInstanceId: string) =>
  api.get<{ canRegister: boolean; cooldownEnd?: string }>(`/attendance/webauthn/register-status/${courseInstanceId}`);

export const getWebAuthnRegisterOptions = (courseInstanceId: string) =>
  api.get<any>(`/attendance/webauthn/register-options/${courseInstanceId}`);

export const verifyWebAuthnRegister = (courseInstanceId: string, response: any, expectedChallenge: string) =>
  api.post<{ verified: boolean }>('/attendance/webauthn/register-verify', {
    courseInstanceId,
    response,
    expectedChallenge,
  });

// ——— Transcripts ———
export const getCourseTranscripts = (courseInstanceId: string) =>
  api.get<any[]>(`/transcripts/course/${courseInstanceId}`);

export const getTranscriptDetail = (transcriptId: string) =>
  api.get<any>(`/transcripts/${transcriptId}`);

// ——— Requirements ———
export const getCourseRequirementsMeta = (courseInstanceId: string) =>
  api.get<any>(`/course-requirements/staff/${courseInstanceId}/meta`);

export const downloadCourseRequirements = (courseInstanceId: string) =>
  api.get(`/course-requirements/staff/${courseInstanceId}/download`, { responseType: 'blob' });

// ——— Quiz / Grades ———
export const getCourseViolations = (courseInstanceId: string) =>
  api.get<any[]>(`/quiz/course/${courseInstanceId}/violations`);

export const getCourseGrades = (courseInstanceId: string) =>
  api.get<any[]>(`/quiz/course/${courseInstanceId}/grades`);

export const getStudentMyGrades = (courseInstanceId: string) =>
  api.get<any[]>(`/quiz/student/course/${courseInstanceId}/my-grades`);

export const getScheduledQuizzesForStudent = (courseInstanceId: string) =>
  api.get<any[]>(`/quiz/student/course/${courseInstanceId}/scheduled`);

export const getQuiz = (quizId: string) => api.get<any>(`/quiz/${quizId}`);

export const startQuiz = (quizId: string) => api.post<any>(`/quiz/${quizId}/start`);

export const getExamAttempt = (attemptId: string) => api.get<any>(`/exam/attempt/${attemptId}`);

export const upsertQuizAnswer = (
  attemptId: string,
  body: { questionId: string; selectedOption?: string; answerText?: string },
) => api.put<any>(`/exam/attempt/${attemptId}/answers`, body);

export const submitQuiz = (attemptId: string, answers: any[]) =>
  api.post<any>(`/quiz/attempts/${attemptId}/submit`, { answers });

// ——— Prerequisite Test ———
export const generatePrerequisiteQuiz = (materialId: string, numberOfQuestions = 5) =>
  api.post<{ questions: any[] }>(
    '/ai/prerequisite-quiz',
    { materialId, numberOfQuestions },
    // AI generation can exceed 30s, especially if indexing runs first.
    { timeout: 120000 }
  );

export const analyzeWeakTopics = (incorrectAnswers: { question: string; studentAnswer: string; correctAnswer: string }[]) =>
  api.post<{ topics: string[]; studyPlan: string }>(
    '/ai/analyze-weak-topics',
    { incorrectAnswers },
    { timeout: 120000 }
  );

export const getAiStatus = () =>
  api.get<{ openai: boolean; qdrant: boolean; timestamp: string; qdrantError?: string }>('/ai/status');

// ——— Course Feedback ———
export const submitCourseFeedback = (courseInstanceId: string, message: string) =>
  api.post<{ message: string }>(`/course-feedback/submit/${courseInstanceId}`, { message });

export const getCourseFeedback = (courseInstanceId: string) =>
  api.get<any[]>(`/course-feedback/course/${courseInstanceId}`);

export default api;
