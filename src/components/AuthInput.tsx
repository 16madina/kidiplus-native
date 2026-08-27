import { type TextInputProps } from "react-native";
import { FormField } from "./FormField";

export function AuthInput({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  return <FormField label={label} error={error} {...props} />;
}
