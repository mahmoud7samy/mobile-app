import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { getAuthToken } from './store';

export function getMimeType(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
  const map: Record<string, string> = {
    // Documents
    '.pdf': 'application/pdf',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    // Images
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.opus': 'audio/ogg',
    '.wma': 'audio/x-ms-wma',
    // Video
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

export function useFileHandler() {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const getLocalPath = useCallback((id: string, fileName: string) => {
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cacheDir = `${(FileSystem as any).cacheDirectory}app_files/`;
    return `${cacheDir}${id}${ext}`;
  }, []);

  const isFileCached = useCallback(async (id: string, fileName: string) => {
    const path = getLocalPath(id, fileName);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : null;
  }, [getLocalPath]);

  const openFile = useCallback(async (uri: string, mimeType: string, fileName: string) => {
    if (Platform.OS === 'android') {
      try {
        const IntentLauncher = await import('expo-intent-launcher');
        const cUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: cUri,
          flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
      } catch (err: any) {
        console.warn('[useFileHandler] IntentLauncher failed, falling back to Sharing:', err);
        await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
      }
    } else {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
      } else {
        Alert.alert('File Cached', `Path: ${uri}`);
      }
    }
  }, []);

  const downloadAndOpen = useCallback(async (url: string, id: string, fileName: string) => {
    const mimeType = getMimeType(fileName);
    try {
      const cachedPath = await isFileCached(id, fileName);
      if (cachedPath) {
        await openFile(cachedPath, mimeType, fileName);
        return;
      }

      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');

      setDownloadingIds(prev => new Set(prev).add(id));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cacheDir = `${(FileSystem as any).cacheDirectory}app_files/`;
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      const path = getLocalPath(id, fileName);
      const downloadResumable = FileSystem.createDownloadResumable(
        url, path, { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200) {
         throw new Error(`Server returned ${result?.status}`);
      }

      await openFile(result.uri, mimeType, fileName);
    } catch (err: any) {
      Alert.alert('Download failed', err.message ?? 'Try again');
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [isFileCached, getLocalPath, openFile]);

  const saveToDevice = useCallback(async (url: string, id: string, fileName: string) => {
    const mimeType = getMimeType(fileName);
    try {
      let uriToSave = await isFileCached(id, fileName);
      if (!uriToSave) {
        const token = getAuthToken();
        if (!token) return;
        setDownloadingIds(prev => new Set(prev).add(id + '_save'));
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cacheDir = `${(FileSystem as any).cacheDirectory}app_files/`;
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        
        const path = getLocalPath(id, fileName);
        const downloadResumable = FileSystem.createDownloadResumable(url, path, { headers: { Authorization: `Bearer ${token}` } });
        const result = await downloadResumable.downloadAsync();
        if (!result || result.status !== 200) throw new Error('Download failed');
        uriToSave = result.uri;
        setDownloadingIds(prev => { const n = new Set(prev); n.delete(id + '_save'); return n; });
      }

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64 = await FileSystem.readAsStringAsync(uriToSave, { encoding: FileSystem.EncodingType.Base64 });
          const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mimeType);
          await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success', `File permanently saved to device.`);
        }
      } else {
        await Sharing.shareAsync(uriToSave, { mimeType, dialogTitle: `Save ${fileName}` });
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
      setDownloadingIds(prev => { const n = new Set(prev); n.delete(id + '_save'); return n; });
    }
  }, [isFileCached, getLocalPath]);

  return { downloadingIds, downloadAndOpen, saveToDevice };
}
