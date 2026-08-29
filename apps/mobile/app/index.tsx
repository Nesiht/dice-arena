import { Link } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[styles.safeArea, isDark ? styles.darkSafeArea : styles.lightSafeArea]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={[styles.eyebrow, isDark ? styles.darkEyebrow : styles.lightEyebrow]}>
            Early development build
          </Text>
          <Text style={[styles.title, isDark ? styles.darkText : styles.lightText]}>
            Dice Arena
          </Text>
          <Text style={[styles.subtitle, isDark ? styles.darkSubtitle : styles.lightSubtitle]}>
            Competitive five-dice gaming
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/" asChild>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Play</Text>
            </Pressable>
          </Link>

          <Link href="/" asChild>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            >
              <Text
                style={[styles.secondaryButtonText, isDark ? styles.darkText : styles.lightText]}
              >
                Statistics
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  lightSafeArea: {
    backgroundColor: '#f8fafc',
  },
  darkSafeArea: {
    backgroundColor: '#020817',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerBlock: {
    marginBottom: 32,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  lightEyebrow: {
    color: '#475569',
  },
  darkEyebrow: {
    color: '#cbd5e1',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.4,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  lightText: {
    color: '#0f172a',
  },
  darkText: {
    color: '#f8fafc',
  },
  lightSubtitle: {
    color: '#475569',
  },
  darkSubtitle: {
    color: '#cbd5e1',
  },
  actions: {
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
