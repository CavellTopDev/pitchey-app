/**
 * Mobile Authentication Form Component for React Native
 * Handles login/signup with device registration and biometric support
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { LoginRequest, DeviceInfo, LoginResponse } from '../types';

interface MobileAuthFormProps {
  onLogin: (credentials: LoginRequest) => Promise<LoginResponse>;
  onSignUp?: (credentials: any) => Promise<void>;
  loading?: boolean;
  error?: string;
  biometricEnabled?: boolean;
  onBiometricLogin?: () => Promise<void>;
}

export const MobileAuthForm: React.FC<MobileAuthFormProps> = ({
  onLogin,
  onSignUp,
  loading = false,
  error,
  biometricEnabled = false,
  onBiometricLogin
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState<'creator' | 'investor' | 'production'>('creator');
  const [rememberDevice, setRememberDevice] = useState(true);
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    // Clear errors when switching modes
    setEmailError('');
    setPasswordError('');
  }, [isLogin]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    setEmailError(isValid ? '' : 'Please enter a valid email address');
    return isValid;
  };

  const validatePassword = (password: string): boolean => {
    const isValid = password.length >= 8;
    setPasswordError(isValid ? '' : 'Password must be at least 8 characters');
    return isValid;
  };

  const getDeviceInfo = (): DeviceInfo => {
    // This would be implemented using react-native-device-info
    return {
      id: 'device-' + Math.random().toString(36).substr(2, 9),
      name: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
      platform: Platform.OS as 'ios' | 'android',
      version: Platform.Version.toString(),
      model: Platform.OS === 'ios' ? 'iPhone' : 'Android'
    };
  };

  const handleSubmit = async () => {
    if (!validateEmail(email) || !validatePassword(password)) {
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      if (isLogin) {
        const credentials: LoginRequest = {
          email,
          password,
          deviceInfo: getDeviceInfo(),
          rememberDevice
        };
        
        await onLogin(credentials);
      } else if (onSignUp) {
        await onSignUp({
          email,
          password,
          display_name: displayName,
          user_type: userType,
          deviceInfo: getDeviceInfo()
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  const handleBiometricLogin = async () => {
    if (onBiometricLogin) {
      try {
        await onBiometricLogin();
      } catch (error) {
        Alert.alert('Biometric Error', 'Failed to authenticate with biometrics');
      }
    }
  };

  const renderUserTypeSelector = () => {
    if (isLogin) return null;

    const userTypes = [
      { key: 'creator', label: 'Creator', emoji: '🎬' },
      { key: 'investor', label: 'Investor', emoji: '💰' },
      { key: 'production', label: 'Production', emoji: '🎭' }
    ];

    return (
      <View style={styles.userTypeContainer}>
        <Text style={styles.userTypeLabel}>I am a:</Text>
        <View style={styles.userTypeButtons}>
          {userTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.userTypeButton,
                userType === type.key && styles.userTypeButtonActive
              ]}
              onPress={() => setUserType(type.key as any)}
            >
              <Text style={styles.userTypeEmoji}>{type.emoji}</Text>
              <Text style={[
                styles.userTypeText,
                userType === type.key && styles.userTypeTextActive
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back' : 'Join Pitchey'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in to your account'
                : 'Create your account to start pitching'
              }
            </Text>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* User Type Selector (Sign Up Only) */}
          {renderUserTypeSelector()}

          {/* Display Name (Sign Up Only) */}
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                autoCorrect={false}
                accessible={true}
                accessibilityLabel="Display name input"
              />
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.textInput, emailError && styles.textInputError]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) validateEmail(text);
              }}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              accessible={true}
              accessibilityLabel="Email input"
            />
            {emailError && <Text style={styles.errorMessage}>{emailError}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={[styles.textInput, passwordError && styles.textInputError]}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) validatePassword(text);
              }}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              textContentType="password"
              accessible={true}
              accessibilityLabel="Password input"
            />
            {passwordError && <Text style={styles.errorMessage}>{passwordError}</Text>}
          </View>

          {/* Confirm Password (Sign Up Only) */}
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                textContentType="newPassword"
                accessible={true}
                accessibilityLabel="Confirm password input"
              />
            </View>
          )}

          {/* Remember Device Toggle (Login Only) */}
          {isLogin && (
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setRememberDevice(!rememberDevice)}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberDevice }}
              >
                <Text style={styles.checkboxIcon}>
                  {rememberDevice ? '☑️' : '☐'}
                </Text>
                <Text style={styles.checkboxText}>Remember this device</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isLogin ? 'Sign in' : 'Sign up'}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login Button (Login Only) */}
          {isLogin && biometricEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Sign in with biometrics"
            >
              <Text style={styles.biometricIcon}>
                {Platform.OS === 'ios' ? '👆' : '🔐'}
              </Text>
              <Text style={styles.biometricText}>
                {Platform.OS === 'ios' ? 'Touch ID / Face ID' : 'Fingerprint'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Mode Switch */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity
              onPress={() => setIsLogin(!isLogin)}
              accessible={true}
              accessibilityRole="button"
            >
              <Text style={styles.switchButton}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  userTypeContainer: {
    marginBottom: 24,
  },
  userTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  userTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userTypeButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  userTypeButtonActive: {
    backgroundColor: '#EBF4FF',
    borderColor: '#3B82F6',
  },
  userTypeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  userTypeTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    color: '#1F2937',
  },
  textInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorMessage: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  checkboxContainer: {
    marginBottom: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  checkboxText: {
    fontSize: 14,
    color: '#6B7280',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  biometricIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  biometricText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#6B7280',
  },
  switchButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default MobileAuthForm;