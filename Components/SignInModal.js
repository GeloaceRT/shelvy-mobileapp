import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import InputField from './InputField';
import ButtonPrimary from './ButtonPrimary';

export default function SignInModal({ open, onClose, onSwitch, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setRememberMe(false);
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleSignIn = async () => {
    const identifier = email.trim();
    console.log('[SignInModal] attempting login', identifier);

    if (!identifier || !password) {
      setError('Email and password are required.');
      return;
    }

    if (!onSubmit) {
      setError('Sign-in is currently unavailable.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSubmit(identifier, password, rememberMe);
      onClose?.();
    } catch (err) {
      console.log('[SignInModal] login failed', err);
      const message =
        err instanceof Error ? err.message : 'Unable to sign in. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Shelvy</Text>
          <Text style={styles.welcome}>Welcome back!</Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
            <InputField
              placeholder="📧 Email Address"
              value={email}
              onChangeText={setEmail}
            />
            <InputField
              placeholder="🔒 Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable onPress={() => setRememberMe(!rememberMe)} style={styles.checkboxRow}>
              <View style={[styles.checkbox, rememberMe && styles.checked]} />
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </Pressable>

            <ButtonPrimary
              label={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleSignIn}
              disabled={loading}
            />

            <Pressable style={styles.createAccount} onPress={onSwitch}>
              <Text style={styles.createText}>
                New to Shelvy?{' '}
                <Text style={styles.createLink}>Create an account</Text>
              </Text>
            </Pressable>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(245, 245, 245, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 24,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#A0522D',
    textAlign: 'center',
    fontFamily: 'System',
  },
  welcome: {
    fontSize: 18,
    color: '#A0522D',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'System',
  },
  errorText: {
    color: '#E74C3C',
    marginBottom: 12,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#E67E22',
    borderRadius: 4,
    marginRight: 8,
  },
  checked: {
    backgroundColor: '#E67E22',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#A0522D',
    fontFamily: 'System',
  },
  createAccount: {
    alignItems: 'center',
    marginTop: 12,
  },
  createText: {
    color: '#A0522D',
    fontSize: 14,
    fontFamily: 'System',
  },
  createLink: {
    color: '#E67E22',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  closeButton: {
    alignSelf: 'center',
    marginTop: 12,
  },
  closeText: {
    color: '#E67E22',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'System',
  },
});