import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginScreen from "@/components/login-screen";
import WorkspaceScreen from "@/components/workspace-screen";
import { readSession, type MobileSession } from "@/lib/session";
import { colors } from "@/theme";

export default function HomeScreen() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void readSession()
      .then((stored) => {
        if (active) setSession(stored);
      })
      .catch((error: unknown) => {
        console.error("Unable to restore the mobile session.", error);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.forest} />
          <Text style={styles.loadingText}>Rent-Sync</Text>
        </View>
      ) : session ? (
        <WorkspaceScreen
          key={`${session.role}:${session.mobileNumber}`}
          session={session}
          onSignedOut={() => setSession(null)}
        />
      ) : (
        <LoginScreen onSignedIn={setSession} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.forest, fontSize: 12, fontWeight: "700" },
});
