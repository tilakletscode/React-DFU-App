import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../services/api';

export default function AddUserScreen({ navigation }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: 'male',
    role: 'patient',
    // Doctor-specific fields
    specialization: '',
    licenseNumber: '',
    hospital: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const { firstName, lastName, username, email, phone, password, confirmPassword, age, role, specialization, licenseNumber } = formData;
    
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !phone.trim() || !password || !age) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return false;
    }

    if (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 150) {
      Alert.alert('Error', 'Please enter a valid age (1-150)');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return false;
    }

    // Validate doctor-specific fields
    if (role === 'doctor') {
      if (!specialization.trim()) {
        Alert.alert('Error', 'Specialization is required for doctors');
        return false;
      }
      if (!licenseNumber.trim()) {
        Alert.alert('Error', 'License number is required for doctors');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { confirmPassword, firstName, lastName, ...rest } = formData;
      
      // Combine firstName and lastName into name for backend
      const name = `${firstName.trim()} ${lastName.trim()}`;
      
      // Prepare data for backend
      const submitData = {
        name,
        email: rest.email,
        phone: rest.phone,
        username: rest.username,
        password: rest.password,
        age: parseInt(rest.age),
        gender: rest.gender,
        role: rest.role,
      };

      // Add doctor-specific fields if role is doctor
      if (rest.role === 'doctor') {
        if (rest.specialization) submitData.specialization = rest.specialization;
        if (rest.licenseNumber) submitData.licenseNumber = rest.licenseNumber;
        if (rest.hospital) submitData.hospital = rest.hospital;
      }
      
      await authAPI.createUser(submitData);

      Alert.alert(
        'Success',
        `${rest.role.charAt(0).toUpperCase() + rest.role.slice(1)} user created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Create user error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create user';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#e74c3c';
      case 'doctor': return '#3498db';
      case 'patient': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  const getRoleDescription = (role) => {
    switch (role) {
      case 'admin': return 'Full access to all features and user management';
      case 'doctor': return 'Can view patient data and send messages';
      case 'patient': return 'Can use app features for medical scanning';
      default: return '';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New User</Text>
        <Text style={styles.subtitle}>Create a new user account</Text>
      </View>

      <View style={styles.form}>
        {/* Role Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Type</Text>
          <View style={styles.roleContainer}>
            {['patient', 'doctor', 'admin'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  formData.role === role && { backgroundColor: getRoleColor(role) }
                ]}
                onPress={() => handleInputChange('role', role)}
              >
                <Ionicons 
                  name={role === 'admin' ? 'shield' : role === 'doctor' ? 'medical' : 'person'} 
                  size={20} 
                  color={formData.role === role ? 'white' : getRoleColor(role)} 
                />
                <Text style={[
                  styles.roleButtonText,
                  formData.role === role && { color: 'white' }
                ]}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.roleDescription}>
            {getRoleDescription(formData.role)}
          </Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="Enter first name"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Enter last name"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Age *</Text>
              <TextInput
                style={styles.input}
                value={formData.age}
                onChangeText={(value) => handleInputChange('age', value)}
                placeholder="Enter age"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Gender *</Text>
              <View style={styles.genderContainer}>
                {['male', 'female', 'other'].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderButton,
                      formData.gender === gender && styles.genderButtonSelected
                    ]}
                    onPress={() => handleInputChange('gender', gender)}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      formData.gender === gender && styles.genderButtonTextSelected
                    ]}>
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            value={formData.username}
            onChangeText={(value) => handleInputChange('username', value)}
            placeholder="Enter username"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => handleInputChange('phone', value)}
            placeholder="Enter 10-digit phone number"
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Text style={styles.label}>Password *</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              placeholder="Enter password"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? 'eye-off' : 'eye'} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            placeholder="Confirm password"
            secureTextEntry={!showPassword}
          />
        </View>

        {/* Doctor-Specific Fields */}
        {formData.role === 'doctor' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Doctor Information</Text>
            
            <Text style={styles.label}>Specialization *</Text>
            <TextInput
              style={styles.input}
              value={formData.specialization}
              onChangeText={(value) => handleInputChange('specialization', value)}
              placeholder="Enter specialization (e.g., Endocrinologist)"
            />

            <Text style={styles.label}>License Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.licenseNumber}
              onChangeText={(value) => handleInputChange('licenseNumber', value)}
              placeholder="Enter medical license number"
            />

            <Text style={styles.label}>Hospital/Clinic</Text>
            <TextInput
              style={styles.input}
              value={formData.hospital}
              onChangeText={(value) => handleInputChange('hospital', value)}
              placeholder="Enter hospital or clinic name"
            />
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: getRoleColor(formData.role) }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="person-add" size={20} color="white" />
              <Text style={styles.submitButtonText}>
                Create {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} User
              </Text>
            </>
          )}
        </TouchableOpacity>
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
    backgroundColor: '#e74c3c',
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
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  roleButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  roleDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  genderContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    marginHorizontal: 2,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#2E86AB',
    borderColor: '#2E86AB',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#666',
  },
  genderButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeButton: {
    padding: 15,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 10,
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
