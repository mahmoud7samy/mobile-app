import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { Ionicons } from '@expo/vector-icons';
import {
    getAbsenceReasonSubmissions,
    approveAbsenceReason,
    approveAbsenceReasonRange,
    rejectAbsenceReason,
    rejectAbsenceReasonRange,
    API_BASE_URL
} from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useFileHandler } from '../lib/useFileHandler';

export default function ReviewAbsencesScreen({ route }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { downloadingIds, downloadAndOpen, saveToDevice } = useFileHandler();

    const loadSubmissions = async () => {
        try {
            setLoading(true);
            const { data } = await getAbsenceReasonSubmissions(courseInstanceId);
            setSubmissions(data);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to load submissions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();
    }, [courseInstanceId]);

    const handleAction = async (item: any, action: 'approve' | 'reject') => {
        try {
            if (action === 'approve') {
                if (item.type === 'range') {
                    await approveAbsenceReasonRange(item.id);
                } else {
                    await approveAbsenceReason(item.id);
                }
            } else {
                if (item.type === 'range') {
                    await rejectAbsenceReasonRange(item.id);
                } else {
                    await rejectAbsenceReason(item.id);
                }
            }
            Alert.alert('Success', `Submission ${action}d successfully.`);
            loadSubmissions();
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || `Failed to ${action} submission.`;
            Alert.alert('Error', msg);
        }
    };


    const handleDownloadAttachment = async (sub: any) => {
        const fileName = sub.attachmentOriginalName || `absence_${sub.studentCode}.bin`;
        const endpoint = sub.type === 'range'
            ? `/api/attendance/absence-reason/range/${sub.id}/download`
            : `/api/attendance/absence-reason/${sub.id}/download`;
        const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
        await downloadAndOpen(url, sub.id, fileName);
    };

    const handleLongPressAttachment = async (sub: any) => {
        const fileName = sub.attachmentOriginalName || `absence_${sub.studentCode}.bin`;
        const endpoint = sub.type === 'range'
            ? `/api/attendance/absence-reason/range/${sub.id}/download`
            : `/api/attendance/absence-reason/${sub.id}/download`;
        const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
        await saveToDevice(url, sub.id, fileName);
    };

    const renderItem = ({ item }: { item: any }) => {
        const isPending = item.status === 'pending';
        let dateText = '';
        if (item.type === 'session') {
            dateText = new Date(item.sessionDate).toLocaleDateString();
        } else {
            dateText = `${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}`;
        }

        return (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: t.text }]}>{item.studentName}</Text>
                        <Text style={[styles.studentCode, { color: t.textSecondary }]}>{item.studentCode}</Text>
                    </View>
                    <View style={[styles.statusBadge, {
                        backgroundColor: item.status === 'approved' ? t.success + '22' : item.status === 'rejected' ? t.danger + '22' : t.surface2
                    }]}>
                        <Text style={[styles.statusText, {
                            color: item.status === 'approved' ? t.success : item.status === 'rejected' ? t.danger : t.textMuted
                        }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={t.textSecondary} />
                    <Text style={[styles.detailText, { color: t.text }]}> {item.type === 'range' ? 'Range: ' : 'Session: '}{dateText}</Text>
                </View>

                {item.note ? (
                    <View style={[styles.noteBox, { backgroundColor: t.surface2 }]}>
                        <Ionicons name="document-text-outline" size={16} color={t.textSecondary} style={{ marginTop: 2, marginRight: 6 }} />
                        <Text style={[styles.noteText, { color: t.textSecondary }]}>{item.note}</Text>
                    </View>
                ) : null}

                {item.hasAttachment && (
                    <TouchableOpacity
                        style={[styles.attachmentNotice, { borderColor: t.primary, borderWidth: 1, padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }]}
                        onPress={() => handleDownloadAttachment(item)}
                        onLongPress={() => handleLongPressAttachment(item)}
                        disabled={downloadingIds.has(item.id)}
                    >
                        <Ionicons name="attach" size={16} color={t.primary} />
                        <Text style={{ color: t.primary, fontWeight: '600', marginLeft: 6 }}>
                            {downloadingIds.has(item.id) ? 'Opening...' : 'View Attachment'}
                        </Text>
                    </TouchableOpacity>
                )}

                {isPending && (
                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: t.danger }]} onPress={() => handleAction(item, 'reject')}>
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: t.success }]} onPress={() => handleAction(item, 'approve')}>
                            <Text style={styles.btnText}>Approve</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
            <Text style={[styles.title, { color: t.text }]}>{subjectName} - Excuses</Text>

            {loading ? (
                <ActivityIndicator size="large" color={t.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={submissions}
                    keyExtractor={(i) => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={[styles.empty, { color: t.textMuted }]}>No absence submissions found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    list: { paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    studentName: { fontSize: 16, fontWeight: 'bold' },
    studentCode: { fontSize: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, height: 26, justifyContent: 'center' },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    detailText: { fontSize: 14, marginLeft: 4 },
    noteBox: { flexDirection: 'row', padding: 10, borderRadius: 8, marginBottom: 12 },
    noteText: { flex: 1, fontSize: 14 },
    attachmentNotice: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
