import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react-native";
import { Field, ActionButton, Notice, Panel } from "@/components/ui";
import { colors } from "@/theme";
import { registerOwner, signIn } from "@/lib/api";
import { readApiBaseUrl, saveApiBaseUrl, writeSession, type AccountRole, type MobileSession } from "@/lib/session";

const roles: Array<{ id: AccountRole; label: string; Icon: typeof Building2 }> = [
  { id: "OWNER", label: "Owner", Icon: Building2 },
  { id: "TENANT", label: "Tenant", Icon: UserRound },
  { id: "SUPER_ADMIN", label: "Platform", Icon: ShieldCheck },
];

function canonicalIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function LoginScreen({
  onSignedIn,
}: {
  onSignedIn: (session: MobileSession) => void;
}) {
  const [role, setRole] = useState<AccountRole>("OWNER");
  const [registering, setRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void readApiBaseUrl().then(setServerUrl).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to read app settings.");
    });
  }, []);

  async function saveServer() {
    try {
      const saved = await saveApiBaseUrl(serverUrl);
      setServerUrl(saved);
      setError("");
      setShowServerSettings(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the server address.");
    }
  }

  async function submit() {
    setError("");
    if (!mobileNumber.trim() || !password) {
      setError("Enter your mobile number and password.");
      return;
    }
    if (registering && fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    setBusy(true);
    try {
      const mobile = canonicalIndianMobile(mobileNumber);
      const session = registering
        ? await registerOwner(fullName.trim(), mobile, password)
        : await signIn(role, mobile, password);
      await writeSession(session);
      onSignedIn(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Building2 size={21} color={colors.white} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandName}>Rent-Sync</Text>
          </View>
          <Text style={styles.heroTitle}>
            Property,{"\n"}in better sync.
          </Text>
          <Text style={styles.heroCopy}>
            Your homes, people and agreements — together in one clear view.
          </Text>
          <View style={styles.heroAccent} />
        </View>

        <Panel style={styles.loginPanel}>
          <View style={styles.panelHeading}>
            <View>
              <Text style={styles.panelTitle}>
                {registering ? "Create owner account" : "Welcome back"}
              </Text>
              <Text style={styles.panelSubtitle}>
                {registering ? "Start with your mobile number." : "Sign in to your workspace."}
              </Text>
            </View>
            <View style={styles.lockMark}>
              <LockKeyhole size={17} color={colors.forest} />
            </View>
          </View>

          {!registering ? (
            <View style={styles.roleRow}>
              {roles.map(({ id, label, Icon }) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === id }}
                  onPress={() => setRole(id)}
                  style={[styles.roleOption, role === id && styles.roleOptionActive]}
                >
                  <Icon size={15} color={role === id ? colors.white : colors.muted} />
                  <Text style={[styles.roleText, role === id && styles.roleTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {registering ? (
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              autoCapitalize="words"
              maxLength={120}
              returnKeyType="next"
            />
          ) : null}
          <Field
            label="Mobile number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={15}
          />
          <View style={styles.passwordWrap}>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={registering ? "new-password" : "current-password"}
              maxLength={128}
              onSubmitEditing={() => void submit()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((value) => !value)}
              style={styles.passwordToggle}
            >
              {showPassword ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
            </Pressable>
          </View>

          {error ? <Notice message={error} /> : null}

          <ActionButton
            label={registering ? "Create account" : "Sign in"}
            onPress={() => void submit()}
            busy={busy}
            icon={!busy ? <ArrowRight size={17} color={colors.white} /> : undefined}
          />

          {role === "OWNER" && !registering ? (
            <Pressable onPress={() => setRegistering(true)} style={styles.switchLink}>
              <Text style={styles.switchText}>New to Rent-Sync? </Text>
              <Text style={styles.switchAction}>Create an owner account</Text>
            </Pressable>
          ) : registering ? (
            <Pressable onPress={() => setRegistering(false)} style={styles.switchLink}>
              <Text style={styles.switchText}>Already registered? </Text>
              <Text style={styles.switchAction}>Sign in</Text>
            </Pressable>
          ) : null}

          {role === "TENANT" && !registering ? (
            <View style={styles.helpRow}>
              <UsersRound size={15} color={colors.muted} />
              <Text style={styles.helpText}>Ask your property owner if you need an account or password reset.</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setError("");
              setShowServerSettings((value) => !value);
            }}
            style={styles.settingsToggle}
          >
            <Settings2 size={14} color={colors.muted} />
            <Text style={styles.settingsText}>Server settings</Text>
          </Pressable>

          {showServerSettings ? (
            <View style={styles.serverSettings}>
              <Field
                label="Rent-Sync server"
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="https://your-rent-sync-domain.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <ActionButton label="Save server" onPress={() => void saveServer()} variant="secondary" compact />
            </View>
          ) : null}
        </Panel>

        <Text style={styles.footer}>Secure access to your property workspace</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 34, paddingBottom: 28, gap: 18 },
  hero: {
    minHeight: 236,
    borderRadius: 26,
    backgroundColor: colors.forestDark,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 25,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#2C5F4B",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { color: colors.white, fontWeight: "700", fontSize: 15, letterSpacing: 0.1 },
  heroTitle: { color: colors.white, fontSize: 34, lineHeight: 38, fontWeight: "700", letterSpacing: -1 },
  heroCopy: { color: "#D2E0D6", fontSize: 12, maxWidth: 280, lineHeight: 18 },
  heroAccent: {
    width: 122,
    height: 122,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    position: "absolute",
    right: -30,
    top: 52,
  },
  loginPanel: { padding: 19, gap: 17 },
  panelHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontSize: 20, fontWeight: "700", color: colors.ink },
  panelSubtitle: { marginTop: 4, fontSize: 12, color: colors.muted },
  lockMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  roleRow: { flexDirection: "row", gap: 8 },
  roleOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#F6F8F5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  roleOptionActive: { backgroundColor: colors.forest },
  roleText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  roleTextActive: { color: colors.white },
  passwordWrap: { position: "relative" },
  passwordToggle: { position: "absolute", right: 14, bottom: 14, padding: 3 },
  switchLink: { alignSelf: "center", flexDirection: "row", paddingVertical: 3 },
  switchText: { color: colors.muted, fontSize: 11 },
  switchAction: { color: colors.forest, fontSize: 11, fontWeight: "700" },
  helpRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  helpText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  settingsToggle: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  settingsText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  serverSettings: { gap: 12, borderTopWidth: 1, borderColor: colors.line, paddingTop: 15 },
  footer: { textAlign: "center", color: colors.muted, fontSize: 10, paddingVertical: 4 },
});
