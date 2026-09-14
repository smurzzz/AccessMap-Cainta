import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export default Screen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 24 },
  screenContent: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 16 },
});
