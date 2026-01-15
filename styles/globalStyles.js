import { StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.medium,
  },
  button: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    primary: {
      fontSize: 16,
      color: theme.colors.text.primary,
      fontWeight: '400',
    },
    secondary: {
      fontSize: 14,
      color: theme.colors.text.secondary,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text.primary,
    },
  },
});

