import { StyleSheet, View } from "react-native";
import { useAuth } from "../context/auth";
import { WELCOME_BG } from "../theme";
import { WelcomeScreen } from "./WelcomeScreen";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen, ForgotPasswordScreen } from "./SignUpScreen";

export function AuthFlow({ overlay }: { overlay?: boolean }) {
  const { view, closeAuth } = useAuth();
  return (
    <View style={[styles.root, overlay && styles.overlay]}>
      {view === "welcome" ? <WelcomeScreen /> : null}
      {view === "signin" ? <SignInScreen /> : null}
      {view === "signup" ? <SignUpScreen /> : null}
      {view === "forgot" ? <ForgotPasswordScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WELCOME_BG },
  overlay: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, zIndex: 90 },
});
