import axios from 'axios';
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth().catch(() => {});
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
    averageScore?: number;
    overallAttendance?: number;
    rank?: number | null;
    totalInLevel?: number;
    completedQuizzes?: number;
    totalQuizzes?: number;
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

/** Submit task (student). Pass FormData with one file under key 'file'. */
export const submitTask = (taskId: string, formData: FormData) =>
  api.post<TaskSubmission>(`/tasks/${taskId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

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
  api.post<{ message: string; points: number }>('/attendance/check-in', { code, courseInstanceId });

export const submitQrScan = (token: string, scannedAt: string, courseInstanceId: string) =>
  api.post<{ attemptId?: string; needWebAuthn?: boolean; options?: any; verified?: boolean; points?: number }>('/attendance/qr/scan', { token, scannedAt, courseInstanceId });

export const completeQrAttendance = (attemptId: string, courseInstanceId: string, assertionResponse: any) =>
  api.post<{ message: string; points: number }>('/attendance/qr/complete', { attemptId, courseInstanceId, assertionResponse });

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

// ——— Notifications & Announcements ———
export const getStudentNotifications = () =>
  api.get<any[]>('/dashboard/student/notifications');

export const getStudentAnnouncements = () =>
  api.get<any[]>('/announcements/student');

export const getStaffAnnouncements = () =>
  api.get<any[]>('/announcements/staff');

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

// ——— Prerequisite Test ———
export const generatePrerequisiteQuiz = (materialId: string, numberOfQuestions = 5) =>
  api.post<{ questions: any[] }>('/ai/prerequisite-quiz', { materialId, numberOfQuestions });

export const analyzeWeakTopics = (incorrectAnswers: { question: string; studentAnswer: string; correctAnswer: string }[]) =>
  api.post<{ topics: string[]; studyPlan: string }>('/ai/analyze-weak-topics', { incorrectAnswers });

export const getAiStatus = () =>
  api.get<{ openai: boolean; qdrant: boolean; timestamp: string; qdrantError?: string }>('/ai/status');

export default api;
