import type { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, radii } from "@/theme";

export function Page({
  children,
  contentContainerStyle,
  refreshControl,
}: {
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
  refreshControl?: ReactElement;
}) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Heading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingText}>
        <Text style={styles.heading}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: ViewStyle }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.leaf}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  icon,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "quiet" && styles.buttonQuiet,
        variant === "danger" && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.forest} size="small" />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonText,
          (variant === "secondary" || variant === "quiet") && styles.buttonTextDark,
          variant === "danger" && styles.buttonTextDanger,
          compact && styles.buttonTextCompact,
        ]}
      >
        {busy ? "Please wait" : label}
      </Text>
    </Pressable>
  );
}

export function Choice({
  value,
  label,
  selected,
  onPress,
}: {
  value: string;
  label: string;
  selected: boolean;
  onPress: (value: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success";
}) {
  return (
    <View style={[styles.notice, tone === "error" ? styles.noticeError : styles.noticeSuccess]}>
      <Text style={[styles.noticeText, tone === "error" ? styles.noticeErrorText : styles.noticeSuccessText]}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}>
        <Text style={styles.emptyGlyph}>R</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  pageContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 16 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 17,
    gap: 12,
  },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headingText: { flex: 1, gap: 4 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FBFCFA",
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 14,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12 },
  buttonPrimary: { backgroundColor: colors.forest },
  buttonSecondary: { backgroundColor: colors.mint },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonDanger: { backgroundColor: colors.dangerWash },
  buttonDisabled: { opacity: 0.58 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  buttonTextDark: { color: colors.forest },
  buttonTextDanger: { color: colors.danger },
  buttonTextCompact: { fontSize: 12 },
  choice: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: colors.white },
  notice: { padding: 12, borderRadius: 12 },
  noticeError: { backgroundColor: colors.dangerWash },
  noticeSuccess: { backgroundColor: colors.mint },
  noticeText: { fontSize: 12, lineHeight: 18 },
  noticeErrorText: { color: colors.danger },
  noticeSuccessText: { color: colors.forest },
  empty: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 22, gap: 8 },
  emptyMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyGlyph: { color: colors.forest, fontSize: 21, fontWeight: "800" },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  divider: { height: 1, backgroundColor: colors.line },
});
