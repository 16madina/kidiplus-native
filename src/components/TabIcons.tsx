import Svg, { Circle, Path } from "react-native-svg";

type IconProps = { active?: boolean; color: string; fillBg?: string; size?: number };

const STROKE = 1.6;

export function HomeIcon({ active = false, color, fillBg = "#fff", size = 24 }: IconProps) {
  const outerArch = "M5 20 V11 A7 7 0 0 1 19 11 V20 Z";
  const innerArch = "M8 20 V11.5 A4 4 0 0 1 16 11.5 V20";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <Path d={outerArch} fill={active ? color : "none"} stroke={color} />
      <Path d={innerArch} fill={active ? fillBg : "none"} stroke={color} />
      <Circle cx="14" cy="15.5" r="0.7" fill={color} stroke="none" />
    </Svg>
  );
}

export function ExploreIcon({ active = false, color, fillBg = "#10162B", size = 24 }: IconProps) {
  const star = "M12 5.5 L13.6 12 L12 18.5 L10.4 12 Z M5.5 12 L12 10.4 L18.5 12 L12 13.6 Z";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="7.5" fill={active ? color : "none"} stroke={color} />
      <Path d="M12 3.5 V5 M12 19 V20.5 M3.5 12 H5 M19 12 H20.5" stroke={color} />
      <Path d={star} fill={active ? fillBg : "none"} stroke={active ? fillBg : color} strokeWidth={active ? 0.8 : STROKE} />
      <Circle cx="12" cy="12" r="0.9" fill={color} stroke="none" />
    </Svg>
  );
}

export function VitrineIcon({ active = false, color, fillBg = "#10162B", size = 24 }: IconProps) {
  const frame = "M5 4.5 H19 Q20.5 4.5 20.5 6 V18 Q20.5 19.5 19 19.5 H5 Q3.5 19.5 3.5 18 V6 Q3.5 4.5 5 4.5 Z";
  const play = "M10 8.2 L16.2 12 L10 15.8 Z";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <Path d={frame} fill={active ? color : "none"} stroke={color} />
      <Path d={play} fill={active ? fillBg : "none"} stroke={active ? fillBg : color} strokeWidth={active ? 0.8 : STROKE} />
    </Svg>
  );
}

export function PersonIcon({ color, fillBg = "#10162B", size = 24 }: IconProps) {
  const head = "M12 10.2 m -2.4 0 a 2.4 2.4 0 1 0 4.8 0 a 2.4 2.4 0 1 0 -4.8 0";
  const bust = "M6.6 18.4 Q7.6 13.8 12 13.8 Q16.4 13.8 17.4 18.4 Z";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" fill={color} stroke={color} />
      <Path d={head} fill={fillBg} stroke={fillBg} strokeWidth={0.6} />
      <Path d={bust} fill={fillBg} stroke={fillBg} strokeWidth={0.6} />
    </Svg>
  );
}
