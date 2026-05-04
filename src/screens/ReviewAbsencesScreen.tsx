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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function ReviewAbsencesScreen({ route }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const { data } = await getAbsenceReasonSubmissions(courseInstanceId);
            setSubmissions(data);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to load absence submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (sub: any, action: 'approve' | 'reject') => {
        try {
            if (action === 'approve') {
                if (sub.type === 'range') await approveAbsenceReasonRange(sub.id);
                else await approveAbsenceReason(sub.id);
            } else {
                if (sub.type === 'range') await rejectAbsenceReasonRange(sub.id);
                else await rejectAbsenceReason(sub.id);
            }

            Alert.alert('Success', `Submission ${action}d`);
            load();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || `Failed to ${action}`);
        }
    };

    const downloadAttachment = async (sub: any) => {
        const token = useAuthStore.getState().token;
        if (!token) return;
        setDownloadingId(sub.id);
        try {
            const docDir = `${(FileSystem as any).documentDirectory}downloads/`;
            const dirInfo = await FileSystem.getInfoAsync(docDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(docDir + 'downloads/', { intermediates: true });
            }

            const fileName = `absence_${sub.studentCode}.bin`;
            const path = `${docDir}${fileName}`;
            const endpoint = sub.type === 'range'
                ? `/api/attendance/absence-reason/range/${sub.id}/download`
                : `/api/attendance/absence-reason/${sub.id}/download`;
            const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;

            const downloadResumable = FileSystem.createDownloadResumable(
                url,
                path,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const result = await downloadResumable.downloadAsync();

            if (!result || result.status !== 200) {
                throw new Error(`Server returned ${result?.status}`);
            }

            if (Platform.OS === 'android') {
                try {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
                        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'application/octet-stream');
                        await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                        Alert.alert('Success', `Attachment saved.`);
                    } else {
                        await Sharing.shareAsync(result.uri, { dialogTitle: fileName });
                    }
                } catch (e) {
                    await Sharing.shareAsync(result.uri, { dialogTitle: fileName });
                }
            } else {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(result.uri, { dialogTitle: fileName });
                } else {
                    Alert.alert('Downloaded', `Saved to App Data: ${result.uri}`);
                }
            }
        } catch (err: any) {
            console.error('Absence Download Error:', err);
            Alert.alert('Download failed', err.message ?? String(err));
        } finally {
            setDownloadingId(null);
        }
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
                        onPress={() => downloadAttachment(item)}
                        disabled={downloadingId === item.id}
                    >
                        <Ionicons name="attach" size={16} color={t.primary} />
                        <Text style={{ color: t.primary, fontWeight: '600', marginLeft: 6 }}>
                            {downloadingId === item.id ? 'Downloading...' : 'View Attachment'}
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
