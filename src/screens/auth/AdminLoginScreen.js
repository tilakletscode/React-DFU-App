import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { loginUser } from '../../store/slices/authSlice';

export default function AdminLoginScreen({ navigation }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const dispatch = useDispatch();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      Alert.alert('Validation Error', 'Email is required');
      return false;
    }

    if (!formData.password) {
      Alert.alert('Validation Error', 'Password is required');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await dispatch(loginUser(formData)).unwrap();
      
      // Check if user is admin or doctor
      if (result.user.role === 'admin' || result.user.role === 'doctor') {
        Alert.alert(
          'Login Successful', 
          `Welcome ${result.user.role === 'admin' ? 'Administrator' : 'Doctor'}!`,
          [{ text: 'OK', onPress: () => {
            // Navigate to appropriate screen based on role
            // The navigation will be handled by the root navigator
          }}]
        );
      } else {
        Alert.alert('Access Denied', 'This login is for Admin and Doctor accounts only.');
        // Logout the user since they don't have admin/doctor privileges
        // dispatch(logoutUser());
      }
    } catch (error) {
      Alert.alert('Login Failed', error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPatientLogin = () => {
    navigation.navigate('Login');
  };

  const quickFillAdmin = () => {
    setFormData({
      email: 'admin@mlauth.com',
      password: 'admin123'
    });
  };

  const quickFillDoctor = () => {
    setFormData({
      email: 'doctor@mlauth.com',
      password: 'doctor123'
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2E86AB" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin & Doctor Login</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <Text style={styles.subtitle}>Sign in to access administrative features</Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.loginButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Quick Fill Buttons for Testing */}
          <View style={styles.quickFillContainer}>
            <Text style={styles.quickFillTitle}>Quick Login (For Testing):</Text>
            <View style={styles.quickFillButtons}>
              <TouchableOpacity 
                style={styles.quickFillButton}
                onPress={quickFillAdmin}
              >
                <Text style={styles.quickFillText}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickFillButton}
                onPress={quickFillDoctor}
              >
                <Text style={styles.quickFillText}>Doctor</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Patient Login Link */}
          <TouchableOpacity 
            style={styles.patientLoginLink}
            onPress={navigateToPatientLogin}
          >
            <Text style={styles.patientLoginText}>
              Patient? <Text style={styles.patientLoginLinkText}>Login here</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonIcon: {
    marginRight: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickFillContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickFillTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  quickFillButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickFillButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickFillText: {
    color: '#2E86AB',
    fontWeight: '600',
  },
  patientLoginLink: {
    marginTop: 30,
    alignItems: 'center',
  },
  patientLoginText: {
    fontSize: 16,
    color: '#666',
  },
  patientLoginLinkText: {
    color: '#2E86AB',
    fontWeight: 'bold',
  },
});
