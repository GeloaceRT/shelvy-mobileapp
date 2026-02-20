import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Navigation from './Components/Navigation';
import SignInModal from './Components/SignInModal';
import SignUpModal from './Components/SignUpModal';
import { TelemetryProvider } from './context/TelemetryContext';
import { login, logout, fetchProfile, signup } from './services/api';
import { signInWithCustomTokenAndGetIdToken } from './services/firebase';

export default function App() {
  const [session, setSession] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const handleSignIn = async (email, password, remember) => {
    const payload = await login(email, password);
    if (!payload || !payload.user || !payload.token) {
      throw new Error('Invalid response from server');
    }

    const { user, token: customToken } = payload;
    // Exchange backend Firebase custom token for a client ID token
    let idToken = customToken;
    try {
      idToken = await signInWithCustomTokenAndGetIdToken(customToken);
    } catch (e) {
      console.warn('[App] Firebase token exchange failed, proceeding with custom token', e);
    }

    // Try to fetch canonical profile from backend using the ID token
    let profile;
    try {
      const res = await fetchProfile(idToken);
      profile = res?.profile ?? res;
    } catch (e) {
      console.warn('[App] Failed to fetch profile from backend', e);
    }

    setSession({
      id: user.id,
      // Prefer profile name, then profile first/last, then explicit name/displayName from server user, then username, then email
      name:
        profile?.name ??
        profile?.displayName ??
        (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : undefined) ??
        user.name ??
        user.displayName ??
        user.username ??
        email,
      email,
      token: idToken,
      remember,
    });
    setShowSignIn(false);
  };

  const handleSignUp = async (firstName, lastName, email, password, agreeTerms) => {
    if (!agreeTerms) {
      Alert.alert('Hold on', 'Please agree to the terms before creating an account.');
      return;
    }

    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Almost there', 'Kindly complete all fields to continue.');
      return;
    }

    try {
      const payload = await signup(firstName, lastName, email, password);
      if (!payload || !payload.user || !payload.token) {
        throw new Error('Invalid response from server');
      }

      const { user, token: customToken } = payload;
      let idToken = customToken;
      try {
        idToken = await signInWithCustomTokenAndGetIdToken(customToken);
      } catch (e) {
        console.warn('[App] Firebase token exchange failed after signup, proceeding with custom token', e);
      }

      let profile;
      try {
        const res = await fetchProfile(idToken);
        profile = res?.profile ?? res;
      } catch (e) {
        console.warn('[App] Failed to fetch profile after signup', e);
      }

      setSession({
        id: user.id,
        // Prefer profile name, profile first/last, then provided signup name, then username, then email
        name:
          profile?.name ??
          profile?.displayName ??
          (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : undefined) ??
          `${firstName} ${lastName}` ??
          user.username ??
          email,
        email,
        token: idToken,
        remember: true,
      });

      setShowSignUp(false);
    } catch (e) {
      console.error('[App] signup failed', e);
      Alert.alert('Sign Up Failed', e instanceof Error ? e.message : 'Unable to create account');
    }
  };

  const handleLogout = () => {
    const token = session?.token;
    if (token) {
      logout(token).catch((err) => {
        console.warn('[App] logout failed', err);
      });
    }
    setSession(null);
    setShowSignIn(false);
    setShowSignUp(false);
  };

  return (
    <TelemetryProvider token={session?.token}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        {session ? (
          <Navigation user={session} onLogout={handleLogout} />
        ) : (
          <View style={styles.container}>
            <Text style={styles.title}>Shelvy</Text>
            <Text style={styles.subtitle}>Monitor your bread's freshness</Text>
            <Text style={styles.subtitle}>🍞</Text>

            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.signInButton, pressed && styles.pressed]}
                onPress={() => setShowSignIn(true)}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.button, styles.signUpButton, pressed && styles.pressed]}
                onPress={() => setShowSignUp(true)}
              >
                <Text style={styles.signUpText}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        )}

        <SignInModal
          open={showSignIn}
          onClose={() => setShowSignIn(false)}
          onSwitch={() => {
            setShowSignIn(false);
            setShowSignUp(true);
          }}
          onSubmit={handleSignIn}
        />

        <SignUpModal
          open={showSignUp}
          onClose={() => setShowSignUp(false)}
          onSwitch={() => {
            setShowSignUp(false);
            setShowSignIn(true);
          }}
          onSubmit={handleSignUp}
        />
      </SafeAreaView>
    </TelemetryProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f0e6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f0e6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#b35c00',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b3e00',
    fontFamily: 'monospace',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '70%',
    marginTop: 24,
  },
  button: {
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#c46a00',
  },
  signUpButton: {
    backgroundColor: '#e0d9d0',
    borderWidth: 1,
    borderColor: '#c46a00',
  },
  pressed: {
    opacity: 0.8,
  },
  signInText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  signUpText: {
    color: '#c46a00',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
