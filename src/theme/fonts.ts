import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';

/** Font family names as registered at runtime; identical on iOS and Android. */
export const fontFamily = {
  regular: 'Inter_400Regular',
  semiBold: 'Inter_600SemiBold',
  extraBold: 'Inter_800ExtraBold',
} as const;

/** Passed to `useFonts` in the root layout. Only the weights listed here are bundled. */
export const fontAssets = {
  [fontFamily.regular]: Inter_400Regular,
  [fontFamily.semiBold]: Inter_600SemiBold,
  [fontFamily.extraBold]: Inter_800ExtraBold,
};
