import { Link } from 'expo-router';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '../../components/ui/Button';

export function HomeScreen() {
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
            <Button label="Play" variant="primary" />
          </Link>

          <Link href="/" asChild>
            <Button label="Statistics" variant="secondary" />
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
    marginBottom: 12,
    textTransform: 'uppercase',
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
});
