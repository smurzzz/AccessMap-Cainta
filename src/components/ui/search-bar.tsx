import { StyleSheet, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <View style={styles.search}>
      <AppIcon name="magnify" size={28} color={C.muted} />
      <TextInput placeholder={placeholder} placeholderTextColor={C.muted} style={styles.searchInput} />
      <AppIcon name="close-circle-outline" size={23} color={C.muted} />
    </View>
  );
}

export default SearchBar;

const styles = StyleSheet.create({
  search: { minHeight: 60, borderRadius: 16, backgroundColor: C.card, borderWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, marginTop: -46, shadowColor: '#101B35', shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, color: C.ink, fontSize: T['headline-sm'] },
});
