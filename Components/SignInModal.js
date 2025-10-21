import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import InputField from './InputField';
import ButtonPrimary from './ButtonPrimary';

export default function SignInModal({ visible, onClose, onSignUpPress, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSignIn = () => {
    console.log('Signed in with:', { email, password, rememberMe });
    onSuccess();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Shelvy</Text>
          <Text style={styles.welcome}>Welcome back!</Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
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

            {/* Remember Me */}
            <Pressable
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, rememberMe && styles.checked]} />
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </Pressable>

            <ButtonPrimary label="Sign In" onPress={handleSignIn} />

            {/* New to Shelvy */}
            <Pressable style={styles.createAccount} onPress={onSignUpPress}>
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
