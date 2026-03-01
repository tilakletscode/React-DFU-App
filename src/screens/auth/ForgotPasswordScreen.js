
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput } from 'react-native';
import { authAPI } from '../../services/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const startCountdown = () => {
    setResendDisabled(true);
    setCountdown(60);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestResetOTP = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      const response = await authAPI.post('/auth/request-reset-otp', {
        email: email.toLowerCase().trim()
      });

      setMaskedEmail(response.data.email);
      setStep(2);
      startCountdown();
      
      Alert.alert(
        'Reset OTP Sent! 📧',
        'A 6-digit verification code has been sent to your email',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send reset OTP';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    
    try {
      await authAPI.post('/auth/verify-reset-otp', {
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
        newPassword: newPassword
      });

      Alert.alert(
        'Password Updated!',
        'Your password has been successfully updated. You can now login with your new password.',
        [
          { 
            text: 'Login Now', 
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password reset failed';
      Alert.alert('Error', errorMessage);
      
      // Clear OTP on error
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendDisabled) return;
    
    setLoading(true);
    setOtp(''); // Clear current OTP
    
    try {
      await authAPI.post('/auth/request-reset-otp', {
        email: email.toLowerCase().trim()
      });
      
      startCountdown();
      Alert.alert('OTP Resent! 📧', 'A new verification code has been sent');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const renderEmailStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed-outline" size={48} color="#2E86AB" />
      </View>
      
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter your email address to receive a password reset code
      </Text>

      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.textInput}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleRequestResetOTP}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Code'}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.linkText}>← Back to Login</Text>
      </TouchableOpacity>
    </View>
  );

  const renderResetStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color="#2E86AB" />
      </View>
      
      <Text style={styles.title}>Enter Reset Code</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to{'\n'}<Text style={styles.emailText}>{maskedEmail}</Text>
        {'\n'}and create a new password
      </Text>

      <Input
        placeholder="Enter 6-digit OTP"
        value={otp}
        onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="numeric"
        maxLength={6}
        leftIcon={<Icon name="security" size={20} color="#666" />}
        containerStyle={styles.inputContainer}
        inputStyle={[styles.inputText, styles.otpInput]}
        disabled={loading}
      />

      <Input
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry={!showPassword}
        leftIcon={<Icon name="lock" size={20} color="#666" />}
        rightIcon={
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Icon 
              name={showPassword ? "visibility-off" : "visibility"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
        }
        containerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
        disabled={loading}
      />

      <Input
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showConfirmPassword}
        leftIcon={<Icon name="lock" size={20} color="#666" />}
        rightIcon={
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Icon 
              name={showConfirmPassword ? "visibility-off" : "visibility"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
        }
        containerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
        disabled={loading}
        errorMessage={
          confirmPassword && newPassword !== confirmPassword 
            ? 'Passwords do not match' 
            : null
        }
      />

      <Button
        title={loading ? 'Updating...' : 'Update Password'}
        onPress={handleResetPassword}
        loading={loading}
        disabled={
          loading || 
          otp.length !== 6 || 
          !newPassword || 
          newPassword !== confirmPassword ||
          newPassword.length < 6
        }
        buttonStyle={[
          styles.primaryButton,
          (otp.length !== 6 || !newPassword || newPassword !== confirmPassword || newPassword.length < 6) && styles.disabledButton
        ]}
        titleStyle={styles.buttonText}
      />

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity 
          onPress={handleResendOTP}
          disabled={resendDisabled || loading}
          style={[
            styles.resendButton,
            (resendDisabled || loading) && styles.disabledLink
          ]}
        >
          <Text style={[
            styles.linkText,
            (resendDisabled || loading) && styles.disabledLinkText
          ]}>
            {resendDisabled ? `Resend in ${countdown}s` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => {
          setStep(1);
          setOtp('');
          setNewPassword('');
          setConfirmPassword('');
          setMaskedEmail('');
        }}
      >
        <Text style={styles.linkText}>← Change Email</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? renderEmailStep() : renderResetStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 50,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  emailText: {
    color: '#007bff',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 15,
    width: '100%',
  },
  inputText: {
    fontSize: 16,
    paddingLeft: 10,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginBottom: 20,
    marginTop: 10,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    color: '#666',
    fontSize: 14,
  },
  resendButton: {
    paddingVertical: 5,
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  linkText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledLink: {
    opacity: 0.5,
  },
  disabledLinkText: {
    color: '#ccc',
  },
});

export default ForgotPasswordScreen;