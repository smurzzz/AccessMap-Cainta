import { Pressable, StyleSheet, Text } from 'react-native';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

function Button({
  children,
  onPress,
  secondary = false,
  white = false,
  accessibility = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  secondary?: boolean;
  white?: boolean;
  accessibility?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        white && styles.whiteButton,
        accessibility && styles.accessibilityButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
          white && styles.whiteButtonText,
          accessibility && styles.accessibilityButtonText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export default Button;

const styles = StyleSheet.create({
  button: { minHeight: 56, backgroundColor: C.navy, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flex: 1, borderWidth: 0, borderColor: C.navy, shadowColor: C.navy, shadowOpacity: 0.16, shadowRadius: 10, elevation: 2 },
  buttonText: { color: C.white, fontSize: T['body-md'], fontWeight: '800' },
  secondaryButton: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1 },
  secondaryButtonText: { color: C.ink },
  whiteButton: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1, shadowOpacity: 0 },
  whiteButtonText: { color: C.ink },
  accessibilityButton: { backgroundColor: C.green, borderColor: C.green },
  accessibilityButtonText: { color: C.white },
});
