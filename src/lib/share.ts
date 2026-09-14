import { Alert, Platform, Share } from 'react-native';

// Opens the native share sheet with a message; on web it falls back to the
// Web Share API, then to copying the message to the clipboard.
export async function shareAppMessage(title: string, message: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof navigator.share === 'function') {
      await navigator.share({ title, text: message, url: window.location.href });
      return;
    }
    await Share.share({ title, message });
  } catch (shareError: unknown) {
    if (shareError instanceof Error && shareError.name === 'AbortError') return;
    // Last resort on web: copy the details to the clipboard.
    if (Platform.OS === 'web' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        Alert.alert('Link copied', 'Details were copied to your clipboard.');
        return;
      } catch {
        // fall through to the generic failure alert
      }
    }
    Alert.alert('Share failed', 'Could not share this. Please try again.');
  }
}
