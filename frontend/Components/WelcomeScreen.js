import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function WelcomeScreen({ onSignInPress, onSignUpPress }) {
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.overlay} />
        <View style={styles.heroContent}>
          <Text style={styles.brandTitle}>Shelvy</Text>
          <Text style={styles.brandSubtitle}>Monitor your bakery freshness in real time</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Bake smarter</Text>
          <Text style={styles.cardCopy}>
            Shelvy keeps track of temperature, humidity, and device uptime so every loaf stays perfectly fresh.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>1</Text>
              </View>
              <Text style={styles.featureText}>Real-time freshness tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>2</Text>
              </View>
              <Text style={styles.featureText}>Waste reduction insights</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>3</Text>
              </View>
              <Text style={styles.featureText}>Device analytics dashboard</Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Ready to bake with confidence?</Text>
          <Text style={styles.ctaSubtitle}>Sign in or create an account to start monitoring your devices.</Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={onSignInPress}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={onSignUpPress}
          >
            <Text style={styles.secondaryButtonText}>Create an account</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f0e6',
  },
  hero: {
    height: 240,
    backgroundColor: '#3D2914',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(230, 126, 34, 0.25)',
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 16,
    color: '#FCECDD',
    marginTop: 8,
    maxWidth: 280,
    lineHeight: 22,
  },
  body: {
    padding: 24,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3D2914',
    marginBottom: 8,
  },
  cardCopy: {
    fontSize: 15,
    color: '#6B4B2B',
    lineHeight: 22,
    marginBottom: 20,
  },
  featureList: {
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDE8C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C26000',
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: '#4F3620',
  },
  ctaCard: {
    backgroundColor: '#3D2914',
    borderRadius: 16,
    padding: 24,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ctaSubtitle: {
    fontSize: 15,
    color: '#F4E2CA',
    lineHeight: 21,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#E67E22',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderColor: '#F4E2CA',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: '#F4E2CA',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
