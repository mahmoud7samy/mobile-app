import axios from 'axios';
import { getAuthToken, useAuthStore } from './store';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3000';

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
    totalQuizzes?: number;
    completedQuizzes?: number;
    averageScore?: number;
    overallAttendance?: number;
    rank?: number | null;
    totalInLevel?: number;
  };
  scoreBySubject?: { subjectName: string; averageScore: number; attemptCount: number }[];
  recentScores?: { date: string; score: number; quizTitle: string }[];
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
  availableQuizzes?: unknown[];
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

// ——— Attendance (same backend as web) ———
export const checkInAttendance = (code: string, courseInstanceId?: string) =>
  api.post<{ message?: string }>('/attendance/checkin', { code, ...(courseInstanceId && { courseInstanceId }) });

export const checkActiveSession = (courseInstanceId: string) =>
  api.get<{ hasActiveSession?: boolean; code?: string }>(`/attendance/check/${courseInstanceId}`);

export const submitQrScan = (qrToken: string, scannedAt: string, courseInstanceId: string) =>
  api.post<{ needWebAuthn?: boolean; attemptId?: string; options?: unknown }>('/attendance/qr/scan', {
    qrToken,
    scannedAt,
    courseInstanceId,
  });

export const completeQrAttendance = (attemptId: string, courseInstanceId: string, assertionResponse: unknown) =>
  api.post('/attendance/qr/complete', { attemptId, courseInstanceId, assertionResponse });

export default api;
