import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useThemeStore } from '../lib/themeStore';
import { submitCourseFeedback } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function SubmitFeedbackScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter your feedback message.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCourseFeedback(courseInstanceId, message.trim());
      Alert.alert('Success', 'Your anonymous feedback has been submitted successfully.');
      navigation.goBack();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit feedback. Ensure feedback is enabled for this course.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.header}>
            <Ionicons name="chatbubbles-outline" size={32} color={t.primary} />
            <Text style={[styles.title, { color: t.text }]}>Anonymous Feedback</Text>
            <Text style={[styles.subtitle, { color: t.textMuted }]}>
              {subjectName} {levelName ? `(${levelName})` : ''}
            </Text>
          </View>

          <Text style={[styles.infoText, { color: t.textSecondary }]}>
            Your feedback is completely anonymous. It helps instructors improve the course and teaching methods.
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
            placeholder="Share your thoughts, suggestions, or concerns..."
            placeholderTextColor={t.textMuted}
            multiline
            numberOfLines={8}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: String(t.primary), opacity: submitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    marginBottom: 24,
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
