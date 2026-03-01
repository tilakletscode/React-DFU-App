import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { TextInput } from 'react-native';
import { authAPI } from '../../services/api';
import { loginSuccess } from '../../store/slices/authSlice';

const OTPLoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

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

  const handleRequestOTP = async () => {
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
      const response = await authAPI.post('/auth/request-login-otp', {
        email: email.toLowerCase().trim()
      });

      setMaskedEmail(response.data.email);
      setStep(2);
      startCountdown();
      
      Alert.alert(
        'OTP Sent! 📧',
        `A 6-digit verification code has been sent to ${response.data.email}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send OTP';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    
    try {
      const response = await authAPI.post('/auth/verify-login-otp', {
        email: email.toLowerCase().trim(),
        otp: otp.trim()
      });

      // Store auth data
      dispatch(loginSuccess({
        token: response.data.token,
        user: response.data.user
      }));

      Alert.alert(
        'Login Successful! 🎉',
        `Welcome back, ${response.data.user.firstName}!`,
        [{ text: 'Continue', onPress: () => navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        })}]
      );
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Invalid OTP';
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
      await authAPI.post('/auth/request-login-otp', {
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
        <Text style={styles.iconText}>📧</Text>
      </View>
      
      <Text style={styles.title}>Login with OTP</Text>
      <Text style={styles.subtitle}>
        Enter your email address to receive a verification code
      </Text>

      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        style={styles.textInput}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleRequestOTP}
        disabled={loading}
      >
        {loading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />}
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.linkText}>Use Password Instead</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>🔐</Text>
      </View>
      
      <Text style={styles.title}>Enter Verification Code</Text>
      <Text style={styles.subtitle}>
        We've sent a 6-digit code to{'\n'}<Text style={styles.emailText}>{maskedEmail}</Text>
      </Text>

      <TextInput
        placeholder="Enter 6-digit OTP"
        value={otp}
        onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="numeric"
        maxLength={6}
        style={[styles.textInput, styles.otpInput]}
        editable={!loading}
      />

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (loading || otp.length !== 6) && styles.disabledButton
        ]}
        onPress={handleVerifyOTP}
        disabled={loading || otp.length !== 6}
      >
        {loading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />}
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Login'}</Text>
      </TouchableOpacity>

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
            {resendDisabled ? `Resend in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => {
          setStep(1);
          setOtp('');
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
          {step === 1 ? renderEmailStep() : renderOTPStep()}
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.footerText}>
                Don't have an account? <Text style={styles.linkText}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 50,
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
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    width: '100%',
    backgroundColor: '#fff',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007bff',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginBottom: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
});

export default OTPLoginScreen;