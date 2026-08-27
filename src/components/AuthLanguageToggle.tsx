import { StyleSheet, Text, View } from "react-native";
import { Press } from "./Press";
import { Glass } from "./Glass";
import { NAVY } from "../theme";
import { useLanguage } from "../context/language";

export function AuthLanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { lang, setLang } = useLanguage();
  const dark = variant === "dark";

  const btn = (code: "fr" | "en") => {
    const active = lang === code;
    return (
      <Press
        key={code}
        onPress={() => setLang(code)}
        style={[
          styles.btn,
          active
            ? dark
              ? styles.btnActiveDark
              : styles.btnActiveLight
            : null,
        ]}
      >
        <Text
          style={[
            styles.label,
            active
              ? dark
                ? { color: NAVY }
                : { color: "#fff" }
              : dark
                ? { color: "rgba(255,255,255,0.8)" }
                : { color: "#6B7289" },
          ]}
        >
          {code.toUpperCase()}
        </Text>
      </Press>
    );
  };

  return (
    <Glass tone={dark ? "dark" : "light"} intensity={40} radius={999} elevated={false}>
      <View style={styles.wrap}>
        {btn("fr")}
        {btn("en")}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderRadius: 999, padding: 2 },
  btn: { minHeight: 0, minWidth: 0, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  btnActiveDark: { backgroundColor: "rgba(255,255,255,0.92)" },
  btnActiveLight: { backgroundColor: NAVY },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
});
