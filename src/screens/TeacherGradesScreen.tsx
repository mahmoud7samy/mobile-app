import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getCourseGrades } from '../lib/api';

export default function TeacherGradesScreen({ route }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const res = await getCourseGrades(courseInstanceId);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>;
    if (!data) return <View style={[styles.centered, { backgroundColor: t.bg }]}><Text style={{ color: t.text }}>Failed to load grades.</Text></View>;

    const { tests, students } = data;

    const renderItem = ({ item: student }: any) => {
        return (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, ...t.shadow }]}>
                <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: t.text }]}>{student.studentName}</Text>
                        <Text style={[styles.studentCode, { color: t.textSecondary }]}>{student.studentCode}</Text>
                    </View>
                    <View style={[styles.totalBadge, { backgroundColor: t.primaryLight }]}>
                        <Text style={[styles.totalText, { color: t.primary }]}>{student.total} pts</Text>
                    </View>
                </View>

                {tests.length > 0 && (
                    <View style={styles.gradesList}>
                        {tests.map((test: any) => {
                            const studentGrade = student.grades.find((g: any) => g.testId === test.testId)?.grade;
                            return (
                                <View key={test.testId} style={styles.gradeRow}>
                                    <Text style={[styles.testName, { color: t.textSecondary }]} numberOfLines={1}>{test.testName}</Text>
                                    <Text style={[styles.testScore, { color: studentGrade != null ? t.success : t.textMuted }]}>
                                        {studentGrade != null ? studentGrade : '-'} / {test.fullMark}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
            <Text style={[styles.title, { color: t.text }]}>{subjectName} - Grades</Text>

            <View style={[styles.overview, { backgroundColor: t.surface2, borderColor: t.border }]}>
                <Text style={[styles.overviewText, { color: t.text }]}>Students Enrolled: {students.length}</Text>
                <Text style={[styles.overviewText, { color: t.text }]}>Total Tests: {tests.length}</Text>
            </View>

            <FlatList
                data={students}
                keyExtractor={(item) => item.studentId}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, padding: 16 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
    overview: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
    overviewText: { fontSize: 14, fontWeight: '600' },
    list: { paddingBottom: 40 },
    card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    studentName: { fontSize: 16, fontWeight: 'bold' },
    studentCode: { fontSize: 12, marginTop: 2 },
    totalBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    totalText: { fontSize: 14, fontWeight: 'bold' },
    gradesList: { marginTop: 8, gap: 6 },
    gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    testName: { flex: 1, fontSize: 14, marginRight: 10 },
    testScore: { fontSize: 14, fontWeight: '600' },
});
