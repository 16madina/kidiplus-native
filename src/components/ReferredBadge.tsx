import { View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";

const GOLD = "#D4A62A";

/** Gold "+" on profiles that signed up with a partner code. */
export function ReferredBadge({ referred, size = 13 }: { referred?: boolean | null; size?: number }) {
  const { t } = useTranslation();
  if (!referred) return null;
  return (
    <View accessibilityLabel={t("referral.badgeTitle")}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill={GOLD} />
        <Path d="M12 6.5v11 M6.5 12h11" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
