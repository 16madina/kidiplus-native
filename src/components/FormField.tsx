import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useAppTheme } from "../context/theme";

/** Native form field matching kidiplus.com (`rounded-xl border`, 12px label). */
export function FormField({
  label,
  required,
  error,
  multiline,
  style,
  ...props
}: TextInputProps & { label: string; required?: boolean; error?: string | null }) {
  const { colors } = useAppTheme();
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: error ? "#C62828" : colors.border,
            backgroundColor: colors.background,
            minHeight: multiline ? 88 : 46,
            textAlignVertical: multiline ? "top" : "center",
            paddingTop: multiline ? 12 : undefined,
          },
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Text style={[styles.label, { color: colors.mutedForeground }]}>
      {label}
      {required ? " *" : ""}
    </Text>
  );
}

export function FieldBox({
  children,
  error,
  style,
}: {
  children: ReactNode;
  error?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.box,
        { borderColor: error ? "#C62828" : colors.border, backgroundColor: colors.background },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  box: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  error: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#C0392B" },
});
