import { Colors } from '../constants/theme';
import { useColorScheme } from './use-color-scheme';

type ThemeName = keyof typeof Colors;
type ThemeColorName = keyof typeof Colors.light;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ThemeColorName
) {
  const theme = useColorScheme() as ThemeName;
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
