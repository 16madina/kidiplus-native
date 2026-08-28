import { StyleSheet, View } from "react-native";
import { BadgeCheck } from "lucide-react-native";

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <View style={styles.badge}>
      <BadgeCheck size={size} color="#3b82f6" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { marginLeft: 2 },
});
