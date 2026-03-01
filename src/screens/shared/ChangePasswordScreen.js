import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { authAPI } from '../../services/api';

export default function ChangePasswordScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setPasswords(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateForm = () => {
    if (!passwords.currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return false;
    }

    if (!passwords.newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return false;
    }

    if (passwords.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return false;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return false;
    }

    if (passwords.currentPassword === passwords.newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await authAPI.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });

      Alert.alert(
        'Success',
        'Password changed successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case 'admin': return '#e74c3c';
      case 'doctor': return '#3498db';
      case 'patient': return '#2E86AB';
      default: return '#2E86AB';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: getRoleColor() }]}>
        <Text style={styles.title}>Change Password</Text>
        <Text style={styles.subtitle}>Update your account password</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3498db" />
          <Text style={styles.infoText}>
            Choose a strong password with at least 6 characters for better security.
          </Text>
        </View>

        {/* Current Password */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Current Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={passwords.currentPassword}
              onChangeText={(value) => handleInputChange('currentPassword', value)}
              placeholder="Enter current password"
              secureTextEntry={!showPasswords.current}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => togglePasswordVisibility('current')}
            >
              <Ionicons 
                name={showPasswords.current ? 'eye-off' : 'eye'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Password */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>New Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={passwords.newPassword}
              onChangeText={(value) => handleInputChange('newPassword', value)}
              placeholder="Enter new password"
              secureTextEntry={!showPasswords.new}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => togglePasswordVisibility('new')}
            >
              <Ionicons 
                name={showPasswords.new ? 'eye-off' : 'eye'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
          {passwords.newPassword.length > 0 && (
            <View style={styles.passwordStrength}>
              <Text style={[
                styles.strengthText,
                { color: passwords.newPassword.length >= 6 ? '#27ae60' : '#e74c3c' }
              ]}>
                {passwords.newPassword.length >= 6 ? '✓ Strong enough' : '✗ Too short (minimum 6 characters)'}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm Password */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Confirm New Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={passwords.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              placeholder="Confirm new password"
              secureTextEntry={!showPasswords.confirm}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => togglePasswordVisibility('confirm')}
            >
              <Ionicons 
                name={showPasswords.confirm ? 'eye-off' : 'eye'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
          {passwords.confirmPassword.length > 0 && (
            <View style={styles.passwordMatch}>
              <Text style={[
                styles.matchText,
                { color: passwords.newPassword === passwords.confirmPassword ? '#27ae60' : '#e74c3c' }
              ]}>
                {passwords.newPassword === passwords.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Text>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: getRoleColor() }]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color="white" />
              <Text style={styles.submitButtonText}>Change Password</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Security Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Password Security Tips:</Text>
          <Text style={styles.tipText}>• Use at least 6 characters</Text>
          <Text style={styles.tipText}>• Include numbers and special characters</Text>
          <Text style={styles.tipText}>• Avoid using personal information</Text>
          <Text style={styles.tipText}>• Don't share your password with others</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  form: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1976d2',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeButton: {
    padding: 15,
  },
  passwordStrength: {
    marginTop: 5,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  passwordMatch: {
    marginTop: 5,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tipsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});
