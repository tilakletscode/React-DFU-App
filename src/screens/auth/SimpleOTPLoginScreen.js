import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { authAPI } from '../../services/api';
import { loginSuccess } from '../../store/slices/authSlice';

const SimpleOTPLoginScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.post('/auth/request-login-otp', {
        email: email.toLowerCase().trim()
      });

      setMaskedEmail(response.data.email);
      setStep(2);
      Alert.alert('OTP Sent!', `A 6-digit code has been sent to ${response.data.email}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send OTP');
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

      dispatch(loginSuccess({
        token: response.data.token,
        user: response.data.user
      }));

      Alert.alert('Success!', `Welcome back, ${response.data.user.firstName}!`, [
        { text: 'Continue', onPress: () => navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        })}
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Invalid OTP');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Login with OTP</Text>
          <Text style={styles.subtitle}>
            Enter your registered email address to receive a verification code.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestOTP}
            disabled={loading}
          >
            {loading && <ActivityIndicator size="small" color="#fff" />}
            <Text style={styles.buttonText}>
              {loading ? 'Sending...' : 'Send OTP'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Use Password Instead</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>

          <Text style={styles.title}>Enter Verification Code</Text>

          <Text style={styles.subtitle}>
            A 6-digit code has been sent to {maskedEmail}
          </Text>

          <TextInput
            style={[styles.input, styles.otpInput]}
            placeholder="Enter 6-digit code"
            value={otp}
            onChangeText={(text) =>
              setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))
            }
            keyboardType="numeric"
            maxLength={6}
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.button,
              (loading || otp.length !== 6) && styles.buttonDisabled
            ]}
            onPress={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
          >
            {loading && <ActivityIndicator size="small" color="#fff" />}
            <Text style={styles.buttonText}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep(1)}>
            <Text style={styles.link}>← Change Email</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#2E86AB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  link: {
    color: '#007bff',
    textAlign: 'center',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default SimpleOTPLoginScreen;