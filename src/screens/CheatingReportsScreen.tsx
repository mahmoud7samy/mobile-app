import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { getCourseViolations } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function CheatingReportsScreen({ route }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [violations, setViolations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const { data } = await getCourseViolations(courseInstanceId);
            setViolations(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getIconForViolation = (type: string) => {
        if (type.includes('gaze') || type.includes('eye')) return 'eye-off-outline';
        if (type.includes('audio')) return 'volume-off-outline';
        return 'warning-outline';
    };

    if (loading) return <View style={[styles.centered, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.primary} /></View>;

    return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
            <Text style={[styles.title, { color: t.text }]}>Cheating Reports</Text>
            <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subjectName}</Text>

            <FlatList
                data={violations}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={[styles.empty, { color: t.success }]}>✓ No cheating flags reported for this course!</Text>}
                renderItem={({ item }) => (
                    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.danger + '33', ...t.shadow }]}>
                        <View style={styles.cardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name={getIconForViolation(item.typeOfFlag)} size={20} color={t.danger} style={{ marginRight: 6 }} />
                                <Text style={[styles.flagType, { color: t.danger }]}>{item.typeOfFlag.toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.date, { color: t.textSecondary }]}>{new Date(item.testDate).toLocaleDateString()}</Text>
                        </View>

                        <View style={styles.studentInfo}>
                            <Text style={[styles.studentName, { color: t.text }]}>{item.studentName}</Text>
                            <Text style={[styles.studentCode, { color: t.textSecondary }]}>{item.studentCode}</Text>
                        </View>

                        <View style={styles.testInfo}>
                            <Text style={[styles.infoLabel, { color: t.textMuted }]}>Test:</Text>
                            <Text style={[styles.infoValue, { color: t.text }]}>{item.testName}</Text>
                        </View>

                        {item.question && (
                            <View style={styles.testInfo}>
                                <Text style={[styles.infoLabel, { color: t.textMuted }]}>Question context:</Text>
                                <Text style={[styles.infoValue, { color: t.text }]} numberOfLines={2}>{item.question}</Text>
                            </View>
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, padding: 16 },
    title: { fontSize: 24, fontWeight: '800' },
    subtitle: { fontSize: 16, marginBottom: 20 },
    list: { paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, fontSize: 16, fontWeight: 'bold' },
    card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
    flagType: { fontSize: 14, fontWeight: 'bold' },
    date: { fontSize: 12 },
    studentInfo: { marginBottom: 12 },
    studentName: { fontSize: 16, fontWeight: 'bold' },
    studentCode: { fontSize: 12 },
    testInfo: { flexDirection: 'row', marginBottom: 4 },
    infoLabel: { fontSize: 13, width: 110, fontWeight: '500' },
    infoValue: { fontSize: 13, flex: 1, fontWeight: '600' },
});
