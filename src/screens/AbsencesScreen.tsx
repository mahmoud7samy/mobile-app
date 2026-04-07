import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useThemeStore } from '../lib/themeStore';
import {
  getSessionsForAbsenceReasons,
  submitAbsenceReason,
  submitAbsenceReasonRange
} from '../lib/api';
import DateTimePicker from '@react-native-community/datetimepicker';

type Tab = 'session' | 'range';

export default function AbsencesScreen({ route, navigation }: any) {
  const { courseInstanceId, subjectName, levelName } = route.params ?? {};
  const { theme: t } = useThemeStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('session');
  
  // Data
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Form State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (courseInstanceId && activeTab === 'session') {
      fetchSessions();
    }
  }, [courseInstanceId, activeTab]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data } = await getSessionsForAbsenceReasons(courseInstanceId);
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load missed sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFile(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick a file.');
    }
  };

  const handleSubmit = async () => {
    if (activeTab === 'session' && !selectedSessionId) {
      Alert.alert('Error', 'Please select a missed session.');
      return;
    }
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (note) formData.append('message', note);
      
      if (file) {
        formData.append('file', {
          uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      if (activeTab === 'session') {
        const { data } = await submitAbsenceReason(selectedSessionId!, formData);
        Alert.alert('Success', data.message || 'Absence reason submitted.');
      } else {
        formData.append('startDate', startDate.toISOString());
        formData.append('endDate', endDate.toISOString());
        const { data } = await submitAbsenceReasonRange(courseInstanceId, formData);
        Alert.alert('Success', data.message || 'Absence reason submitted.');
      }
      
      navigation.goBack();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to submit absence reason.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginLeft: -8, marginRight: 8 }}>
          <Text style={{ color: t.primary, fontSize: 16, fontWeight: '600' }}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>Submit Excuse</Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]} numberOfLines={1}>
            {subjectName} {levelName ? `· ${levelName}` : ''}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsWrap, { backgroundColor: t.surface }]}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'session' && { backgroundColor: t.primaryLight }]}
          onPress={() => { setActiveTab('session'); setFile(null); setNote(''); }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'session' ? t.primary : t.textSecondary }]}>By Session</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'range' && { backgroundColor: t.primaryLight }]}
          onPress={() => { setActiveTab('range'); setFile(null); setNote(''); }}
        >
          <Text style={[styles.tabText, { color: activeTab === 'range' ? t.primary : t.textSecondary }]}>Date Range</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'session' ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text }]}>Select Missed Session</Text>
            {loadingSessions ? (
              <ActivityIndicator color={t.primary} style={{ marginVertical: 20 }} />
            ) : sessions.length === 0 ? (
              <Text style={{ color: t.textMuted, fontStyle: 'italic', marginBottom: 16 }}>No missed sessions found.</Text>
            ) : (
              sessions.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sessionCard,
                    { backgroundColor: t.surface, borderColor: selectedSessionId === s.id ? t.primary : t.border }
                  ]}
                  onPress={() => setSelectedSessionId(s.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, { borderColor: selectedSessionId === s.id ? t.primary : t.textMuted }]}>
                    {selectedSessionId === s.id && <View style={[styles.radioFill, { backgroundColor: t.primary }]} />}
                  </View>
                  <View>
                    <Text style={[styles.sessionDate, { color: t.text }]}>
                      {new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    {s.durationHours > 0 && (
                      <Text style={[styles.sessionSub, { color: t.textSecondary }]}>{s.durationHours} hours</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text }]}>Absence Period</Text>
            
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateLabel, { color: t.textSecondary }]}>Start Date</Text>
                <TouchableOpacity 
                  style={[styles.dateBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={{ color: t.text }}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(e: any, date?: Date) => {
                      setShowStartPicker(Platform.OS === 'ios');
                      if (date) setStartDate(date);
                    }}
                  />
                )}
              </View>
              
              <View style={{ width: 16 }} />
              
              <View style={{ flex: 1 }}>
                <Text style={[styles.dateLabel, { color: t.textSecondary }]}>End Date</Text>
                <TouchableOpacity 
                  style={[styles.dateBtn, { backgroundColor: t.surface, borderColor: t.border }]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={{ color: t.text }}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    minimumDate={startDate}
                    onChange={(e: any, date?: Date) => {
                      setShowEndPicker(Platform.OS === 'ios');
                      if (date) setEndDate(date);
                    }}
                  />
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: t.text }]}>Provide a Note (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
            placeholder="E.g., I had a doctor's appointment..."
            placeholderTextColor={t.textMuted}
            multiline
            numberOfLines={4}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: t.text }]}>Attach Proof (Required for ranges over 2 days)</Text>
          <TouchableOpacity 
            style={[styles.fileBtn, { backgroundColor: t.surface, borderColor: t.primary }]}
            onPress={handlePickFile}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24, marginBottom: 8 }}>📎</Text>
            <Text style={{ color: t.primary, fontWeight: '600' }}>
              {file ? 'Change Attachment' : 'Select PDF or Image'}
            </Text>
            {file && <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 4 }}>{file.name}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: String(t.primary), opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting || (activeTab === 'session' && sessions.length === 0)}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Excuse</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 16 
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  tabsWrap: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabText: { fontWeight: '600', fontSize: 14 },
  content: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sessionCard: { 
    flexDirection: 'row', alignItems: 'center', 
    padding: 16, borderWidth: 1.5, borderRadius: 12, marginBottom: 12
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  sessionDate: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sessionSub: { fontSize: 13 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateLabel: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  dateBtn: { borderWidth: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  fileBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 24, alignItems: 'center' },
  submitBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
