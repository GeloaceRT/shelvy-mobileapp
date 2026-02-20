import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

export default function ButtonPrimary({ label, onPress, disabled = false }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#E67E22',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    fontFamily: 'System',
  },
  textDisabled: {
    color: '#F2E9E4',
  },
});
