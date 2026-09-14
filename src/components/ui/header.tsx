import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import { photos } from '@/lib/display';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

function Header({ title = 'Home', back }: { title?: string; back?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      ) : (
        <Image source={require('@/assets/images/accessmap_pin_logo.png')} style={styles.logo} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.flex} />
      {!back ? <Pressable style={styles.headerBell} accessibilityLabel="Notifications"><AppIcon name="bell-outline" size={24} color={C.muted} /></Pressable> : null}
      <Image source={photos.avatar} style={styles.avatar} />
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { color: C.ink, fontSize: T['headline-md'], fontWeight: '700' },
  avatar: { width: 38, height: 38, borderRadius: 20 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: T['icon-xl'], color: C.ink, lineHeight: 44 },
  headerBell: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
