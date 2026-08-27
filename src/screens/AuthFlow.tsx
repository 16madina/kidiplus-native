import { StyleSheet, View } from "react-native";
import { PushScreen } from "../components/PushScreen";
import { useAuth } from "../context/auth";
import { WELCOME_BG } from "../theme";
import { WelcomeScreen } from "./WelcomeScreen";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen, ForgotPasswordScreen } from "./SignUpScreen";

export function AuthFlow({ overlay }: { overlay?: boolean }) {
  const { view, setView } = useAuth();
  return (
    <View style={[styles.root, overlay && styles.fill]}>
      <WelcomeScreen />
      <PushScreen open={view === "signin" || view === "forgot"} onClose={() => setView("welcome")} zIndex={2}>
        <SignInScreen />
      </PushScreen>
      <PushScreen open={view === "signup"} onClose={() => setView("welcome")} zIndex={2}>
        <SignUpScreen />
      </PushScreen>
      <PushScreen open={view === "forgot"} onClose={() => setView("signin")} zIndex={3}>
        <ForgotPasswordScreen />
      </PushScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WELCOME_BG },
  fill: { flex: 1 },
});
