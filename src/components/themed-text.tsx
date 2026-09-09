import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DesignColors as C, DesignType as T } from '@/constants/design-tokens';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: T['label-md'],
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: T['label-md'],
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: T['body-md'],
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: T['display-lg'],
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: T['headline-lg'],
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: T['label-md'],
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: T['label-md'],
    color: C.blue,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: T['label-sm'],
  },
});
