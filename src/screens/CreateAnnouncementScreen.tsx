import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createCourseAnnouncement } from '../lib/api';

export default function CreateAnnouncementScreen({ route, navigation }: any) {
    const { courseInstanceId, subjectName } = route.params;
    const { theme: t } = useThemeStore();

    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
    const [loading, setLoading] = useState(false);

    const handleAttach = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                type: '*/*',
            });
            if (!result.canceled && result.assets) {
                setAttachments((prev) => [...prev, ...result.assets]);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!content.trim() && attachments.length === 0) {
            Alert.alert('Error', 'Please enter some content or attach a file.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('courseInstanceId', courseInstanceId);
            if (content.trim()) {
                formData.append('content', content.trim());
            }

            attachments.forEach((file) => {
                formData.append('attachments', {
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType ?? 'application/octet-stream',
                } as any);
            });

            await createCourseAnnouncement(formData);
            Alert.alert('Success', 'Announcement created!');
            navigation.goBack();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to create announcement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: t.text }]}>New Announcement</Text>
            <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subjectName}</Text>

            <View style={[styles.inputContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
                <TextInput
                    style={[styles.input, { color: t.text }]}
                    placeholder="Type your announcement here..."
                    placeholderTextColor={t.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={content}
                    onChangeText={setContent}
                />
            </View>

            <View style={styles.attachmentsHeader}>
                <Text style={[styles.attachmentsTitle, { color: t.text }]}>Attachments</Text>
                <TouchableOpacity style={[styles.attachBtn, { backgroundColor: t.surface2 }]} onPress={handleAttach}>
                    <Ionicons name="attach" size={20} color={t.text} />
                    <Text style={[styles.attachText, { color: t.text }]}>Add File</Text>
                </TouchableOpacity>
            </View>

            {attachments.length > 0 ? (
                <View style={styles.attachmentsList}>
                    {attachments.map((file, index) => (
                        <View key={index} style={[styles.attachmentItem, { backgroundColor: t.surface, borderColor: t.border }]}>
                            <Ionicons name="document-text-outline" size={20} color={t.primary} />
                            <Text style={[styles.attachmentName, { color: t.text }]} numberOfLines={1}>{file.name}</Text>
                            <TouchableOpacity onPress={() => removeAttachment(index)}>
                                <Ionicons name="close-circle" size={20} color={t.danger} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={[styles.emptyAttach, { color: t.textMuted }]}>No files attached</Text>
            )}

            <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: t.primary }, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitBtnText}>Post Announcement</Text>
                    </>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
    subtitle: { fontSize: 16, fontWeight: '500', marginBottom: 20 },
    inputContainer: {
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 150,
        marginBottom: 20,
        padding: 12,
    },
    input: {
        fontSize: 16,
        flex: 1,
        minHeight: 120,
    },
    attachmentsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    attachmentsTitle: { fontSize: 16, fontWeight: '700' },
    attachBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    attachText: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
    attachmentsList: { gap: 8, marginBottom: 20 },
    attachmentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderRadius: 8,
    },
    attachmentName: {
        flex: 1,
        fontSize: 14,
        marginLeft: 8,
        marginRight: 8,
    },
    emptyAttach: {
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 20,
    },
    submitBtn: {
        flexDirection: 'row',
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
