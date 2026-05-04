import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getAttendanceReport } from '../lib/api';

export default function TeacherAttendanceScreen({ route }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const { data } = await getAttendanceReport(courseInstanceId);
            setReport(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Text style={[styles.loading, { color: t.text }]}>Loading report...</Text>;
    }

    if (!report) {
        return <Text style={[styles.loading, { color: t.textMuted }]}>Failed to load report.</Text>;
    }

    const totalSessions = report.sessions?.length || 0;
    const totalStudents = report.students?.length || 0;
    const avgAttend = totalStudents > 0
        ? (report.students.reduce((acc: any, s: any) => acc + (s.percentage || 0), 0) / totalStudents).toFixed(1)
        : 0;

    return (
        <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: t.text }]}>{subjectName} - Attendance Report</Text>

            <View style={[styles.overviewCard, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.overviewCol}>
                    <Text style={[styles.overviewNum, { color: t.primary }]}>{totalSessions}</Text>
                    <Text style={[styles.overviewLabel, { color: t.textSecondary }]}>Sessions</Text>
                </View>
                <View style={styles.overviewCol}>
                    <Text style={[styles.overviewNum, { color: t.success }]}>{avgAttend}%</Text>
                    <Text style={[styles.overviewLabel, { color: t.textSecondary }]}>Avg Attend</Text>
                </View>
                <View style={styles.overviewCol}>
                    <Text style={[styles.overviewNum, { color: t.text }]}>{totalStudents}</Text>
                    <Text style={[styles.overviewLabel, { color: t.textSecondary }]}>Students</Text>
                </View>
            </View>

            <Text style={[styles.sectionTitle, { color: t.text }]}>Student Roster</Text>

            <View style={[styles.table, { backgroundColor: t.surface, borderColor: t.border }]}>
                {report.students.map((student: any, idx: number) => {
                    const color =
                        student.percentage >= 75
                            ? t.success
                            : student.percentage >= 50
                                ? '#F59E0B'
                                : t.danger;

                    return (
                        <View key={idx} style={[styles.row, { borderBottomColor: t.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: t.text, fontWeight: '600' }}>{student.studentName}</Text>
                                <Text style={{ color: t.textSecondary, fontSize: 12 }}>{student.studentCode}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: color, fontWeight: 'bold' }}>{student.percentage.toFixed(0)}%</Text>
                                <Text style={{ color: t.textMuted, fontSize: 11 }}>{student.attended} / {totalSessions}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    loading: { textAlign: 'center', marginTop: 40, fontSize: 16 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    overviewCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
    overviewCol: { alignItems: 'center' },
    overviewNum: { fontSize: 24, fontWeight: '800' },
    overviewLabel: { fontSize: 13, marginTop: 4 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    table: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});
