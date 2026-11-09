import { useEffect } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { readApiBaseUrl } from "@/lib/session";
import { colors } from "@/theme";

export default function SharedTenantPage() {
  const { token } = useLocalSearchParams<{ token: string }>();

  useEffect(() => {
    let active = true;
    void readApiBaseUrl().then(async (baseUrl) => {
      if (!active || !token) return;
      const publicUrl = new URL(baseUrl);
      if (["localhost", "127.0.0.1"].includes(publicUrl.hostname) && publicUrl.port === "3001") {
        publicUrl.port = "3000";
      }
      publicUrl.pathname = `/share/tenant/${encodeURIComponent(token)}`;
      if (Platform.OS === "web") {
        window.location.replace(publicUrl.toString());
      } else {
        await Linking.openURL(publicUrl.toString());
      }
    }).catch((error: unknown) => {
      console.error("Unable to open the shared tenant page.", error);
    });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.forest} />
      <Text style={styles.text}>Opening tenant profile…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background,
  },
  text: { color: colors.forest, fontSize: 16, fontWeight: "600" },
});
