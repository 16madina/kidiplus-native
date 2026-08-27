import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useAppTheme } from "../context/theme";

export function AuthInput({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: error ? "#C62828" : colors.border,
            backgroundColor: colors.card,
          },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  error: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#C0392B" },
});
