import Svg, { Path } from "react-native-svg";

/** Official four-colour Google G proportions, rendered locally at native resolution. */
export function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.45a5.52 5.52 0 0 1-2.39 3.52v2.93h3.87c2.27-2.09 3.56-5.17 3.56-8.69Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3a7.14 7.14 0 0 1-10.64-3.76H1.45v3.09A12 12 0 0 0 12 24Z"
      />
      <Path
        fill="#FBBC05"
        d="M5.44 14.33A7.2 7.2 0 0 1 5.06 12c0-.81.14-1.6.38-2.33V6.58H1.45A12 12 0 0 0 0 12c0 1.93.46 3.76 1.45 5.42l3.99-3.09Z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.96 1.17 15.24 0 12 0A12 12 0 0 0 1.45 6.58l3.99 3.09A7.14 7.14 0 0 1 12 4.77Z"
      />
    </Svg>
  );
}
