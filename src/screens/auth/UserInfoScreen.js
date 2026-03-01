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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { authAPI } from '../../services/api';
import { fetchUserProfile, completeRegistration } from '../../store/slices/authSlice';

export default function UserInfoScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    // Physical Information
    height: '',
    weight: '',
    
    // Medical History
    bloodSugarLevel: '',
    hba1c: '',
    diabetesDuration: '',
    hypertensionDuration: '',
    isSmoker: null,
    
    // Health Conditions
    hasCardiovascularDisease: null,
    hasChronicKidneyDisease: null,
    
    // Additional Notes
    additionalNotes: '',
  });

  const [loading, setLoading] = useState(false);
  const [calculatedBMI, setCalculatedBMI] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const dispatch = useDispatch();
  const { user, registrationCompleted } = useSelector((state) => state.auth);

  // Check if we're updating from profile (not during registration)
  const isProfileUpdate = registrationCompleted;

  // Pre-populate form data with existing user medical info when updating profile
  React.useEffect(() => {
    if (isProfileUpdate && user?.medicalInfo) {
      const medicalInfo = user.medicalInfo;
      setFormData({
        height: medicalInfo.height ? medicalInfo.height.toString() : '',
        weight: medicalInfo.weight ? medicalInfo.weight.toString() : '',
        bloodSugarLevel: medicalInfo.bloodSugarLevel ? medicalInfo.bloodSugarLevel.toString() : '',
        hba1c: medicalInfo.hba1c ? medicalInfo.hba1c.toString() : '',
        diabetesDuration: medicalInfo.diabetesDuration ? medicalInfo.diabetesDuration.toString() : '',
        hypertensionDuration: medicalInfo.hypertensionDuration ? medicalInfo.hypertensionDuration.toString() : '',
        isSmoker: medicalInfo.isSmoker,
        hasCardiovascularDisease: medicalInfo.hasCardiovascularDisease,
        hasChronicKidneyDisease: medicalInfo.hasChronicKidneyDisease,
        additionalNotes: medicalInfo.additionalNotes || '',
      });

      // Calculate BMI if height and weight exist
      if (medicalInfo.height && medicalInfo.weight) {
        const heightInMeters = medicalInfo.height / 100;
        const bmi = (medicalInfo.weight / (heightInMeters * heightInMeters)).toFixed(1);
        setCalculatedBMI(parseFloat(bmi));
      }
    }
  }, [isProfileUpdate, user?.medicalInfo]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate BMI when height or weight changes
    if (field === 'height' || field === 'weight') {
      const height = field === 'height' ? parseFloat(value) : parseFloat(formData.height);
      const weight = field === 'weight' ? parseFloat(value) : parseFloat(formData.weight);
      
      if (height && weight && height > 0) {
        const heightInMeters = height / 100;
        const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
        setCalculatedBMI(parseFloat(bmi));
      } else {
        setCalculatedBMI(null);
      }
    }
  };

  const getBMICategory = (bmi) => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const validateForm = () => {
    // Check required fields (only for new registrations, not profile updates)
    if (!isProfileUpdate && (!formData.height || !formData.weight)) {
      Alert.alert('Error', 'Height and weight are required for new registrations');
      return false;
    }

    const height = parseFloat(formData.height);
    const weight = parseFloat(formData.weight);

    if (formData.height && (height < 50 || height > 300)) {
      Alert.alert('Error', 'Please enter a valid height (50-300 cm)');
      return false;
    }

    if (formData.weight && (weight < 20 || weight > 500)) {
      Alert.alert('Error', 'Please enter a valid weight (20-500 kg)');
      return false;
    }

    if (formData.bloodSugarLevel && (parseFloat(formData.bloodSugarLevel) < 50 || parseFloat(formData.bloodSugarLevel) > 1000)) {
      Alert.alert('Error', 'Please enter a valid blood sugar level (50-1000 mg/dL)');
      return false;
    }

    if (formData.diabetesDuration && (parseFloat(formData.diabetesDuration) < 0 || parseFloat(formData.diabetesDuration) > 100)) {
      Alert.alert('Error', 'Please enter a valid diabetes duration (0-100 years)');
      return false;
    }

    if (formData.hypertensionDuration && (parseFloat(formData.hypertensionDuration) < 0 || parseFloat(formData.hypertensionDuration) > 100)) {
      Alert.alert('Error', 'Please enter a valid hypertension duration (0-100 years)');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare data for API
      const medicalData = {
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        bloodSugarLevel: formData.bloodSugarLevel ? parseFloat(formData.bloodSugarLevel) : null,
        hba1c: formData.hba1c ? parseFloat(formData.hba1c) : null,
        diabetesDuration: formData.diabetesDuration ? parseFloat(formData.diabetesDuration) : null,
        hypertensionDuration: formData.hypertensionDuration ? parseFloat(formData.hypertensionDuration) : null,
        isSmoker: formData.isSmoker,
        hasCardiovascularDisease: formData.hasCardiovascularDisease,
        hasChronicKidneyDisease: formData.hasChronicKidneyDisease,
        additionalNotes: formData.additionalNotes || '',
      };

      // Call API to save medical information
      const response = await authAPI.saveMedicalInfo(medicalData);
      
      // Update user profile to reflect medical info completion
      await dispatch(fetchUserProfile()).unwrap();
      
      // Different behavior for profile updates vs new registrations
      if (isProfileUpdate) {
        Alert.alert(
          'Success!',
          'Your medical information has been updated successfully.',
          [
            {
              text: 'Done',
              onPress: () => {
                navigation.goBack(); // Return to profile screen
              }
            }
          ]
        );
      } else {
        // Mark registration as completed for new registrations
        dispatch(completeRegistration());
        
        Alert.alert(
          'Success!',
          'Your medical information has been saved successfully.',
          [
            {
              text: 'Continue to App',
              onPress: () => {
                // Mark registration as completed and let AppNavigator handle navigation
                // The AppNavigator will automatically switch to MainTabNavigator
                console.log('✅ Medical info saved, registration completed');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Medical info save error:', error);
      Alert.alert('Error', 'Failed to save medical information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const skipForNow = () => {
    if (isProfileUpdate) {
      // For profile updates, just go back without saving
      Alert.alert(
        'Cancel Changes',
        'Are you sure you want to cancel your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Cancel',
            onPress: () => {
              navigation.goBack(); // Return to profile without saving
            }
          }
        ]
      );
    } else {
      // For new registrations, allow skipping
      Alert.alert(
        'Skip Medical Information',
        'You can add this information later in your profile. Are you sure you want to skip?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Skip',
            onPress: async () => {
              try {
                // Mark medical info as completed (skipped) by sending minimal data
                const minimalData = {
                  height: 0, // Use 0 instead of null to avoid validation issues
                  weight: 0, // Use 0 instead of null to avoid validation issues
                  bloodSugarLevel: null,
                  hba1c: null,
                  diabetesDuration: null,
                  hypertensionDuration: null,
                  isSmoker: null,
                  hasCardiovascularDisease: null,
                  hasChronicKidneyDisease: null,
                  additionalNotes: 'Skipped during registration',
                };
                
                await authAPI.saveMedicalInfo(minimalData);
                await dispatch(fetchUserProfile()).unwrap();
                
                // Mark registration as completed and navigate to main app
                dispatch(completeRegistration());
                
                // Mark registration as completed and let AppNavigator handle navigation
                // The AppNavigator will automatically switch to MainTabNavigator
                console.log('✅ Medical info skipped, registration completed');
              } catch (error) {
                console.error('Skip medical info error:', error);
                Alert.alert('Error', 'Failed to skip medical information. Please try again.');
              }
            }
          }
        ]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Ionicons name="medical" size={60} color="#2E86AB" />
          <Text style={styles.title}>Medical Information</Text>
          <Text style={styles.subtitle}>
            Help us provide better health insights
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Physical Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📏 Physical Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.fieldLabel}>Height (cm) *</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="resize-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 170"
                    placeholderTextColor="#999"
                    value={formData.height}
                    onChangeText={(value) => handleInputChange('height', value)}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>
              
              <View style={[styles.inputContainer, styles.halfWidth, styles.rightMargin]}>
                <Text style={styles.fieldLabel}>Weight (kg) *</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="fitness-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 70"
                    placeholderTextColor="#999"
                    value={formData.weight}
                    onChangeText={(value) => handleInputChange('weight', value)}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>
            </View>

            {calculatedBMI && (
              <View style={styles.bmiContainer}>
                <Text style={styles.bmiText}>
                  BMI: {calculatedBMI} ({getBMICategory(calculatedBMI)})
                </Text>
              </View>
            )}
          </View>

          {/* Medical History Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩺 Medical History</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Blood Sugar Level (mg/dL)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="water-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 120 (fasting level)"
                  placeholderTextColor="#999"
                  value={formData.bloodSugarLevel}
                  onChangeText={(value) => handleInputChange('bloodSugarLevel', value)}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>HbA1C (%)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="analytics-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 6.5 (3-month average)"
                  placeholderTextColor="#999"
                  value={formData.hba1c}
                  onChangeText={(value) => handleInputChange('hba1c', value)}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.fieldLabel}>Diabetes Duration (Years)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="time-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 5 (0 if none)"
                    placeholderTextColor="#999"
                    value={formData.diabetesDuration}
                    onChangeText={(value) => handleInputChange('diabetesDuration', value)}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
              
              <View style={[styles.inputContainer, styles.halfWidth, styles.rightMargin]}>
                <Text style={styles.fieldLabel}>Hypertension Duration (Years)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="pulse-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 3 (0 if none)"
                    placeholderTextColor="#999"
                    value={formData.hypertensionDuration}
                    onChangeText={(value) => handleInputChange('hypertensionDuration', value)}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Smoking Status *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="warning-outline" size={20} color="#666" style={styles.inputIcon} />
                <Picker
                  selectedValue={formData.isSmoker}
                  style={styles.picker}
                  onValueChange={(value) => handleInputChange('isSmoker', value)}
                >
                  <Picker.Item label="Select smoking status" value={null} />
                  <Picker.Item label="Yes - I smoke" value={true} />
                  <Picker.Item label="No - I don't smoke" value={false} />
                </Picker>
              </View>
            </View>
          </View>

          {/* Health Conditions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>❤️ Health Conditions</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Cardiovascular Disease (CVD) History *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="heart-outline" size={20} color="#666" style={styles.inputIcon} />
                <Picker
                  selectedValue={formData.hasCardiovascularDisease}
                  style={styles.picker}
                  onValueChange={(value) => handleInputChange('hasCardiovascularDisease', value)}
                >
                  <Picker.Item label="Select CVD history" value={null} />
                  <Picker.Item label="Yes - I have CVD" value="yes" />
                  <Picker.Item label="No - No CVD history" value="no" />
                  <Picker.Item label="Not Sure" value="not_sure" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Chronic Kidney Disease (CKD) History *</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="medical-outline" size={20} color="#666" style={styles.inputIcon} />
                <Picker
                  selectedValue={formData.hasChronicKidneyDisease}
                  style={styles.picker}
                  onValueChange={(value) => handleInputChange('hasChronicKidneyDisease', value)}
                >
                  <Picker.Item label="Select CKD history" value={null} />
                  <Picker.Item label="Yes - I have CKD" value="yes" />
                  <Picker.Item label="No - No CKD history" value="no" />
                  <Picker.Item label="Not Sure" value="not_sure" />
                </Picker>
              </View>
            </View>
          </View>

          {/* Additional Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Additional Notes</Text>
            
            <View style={[styles.inputContainer, styles.notesContainer]}>
              <Text style={styles.fieldLabel}>Additional Medical Information (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="document-text-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Any other medical conditions, medications, allergies, or relevant information..."
                  placeholderTextColor="#999"
                  value={formData.additionalNotes}
                  onChangeText={(value) => handleInputChange('additionalNotes', value)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.skipButton} onPress={skipForNow}>
              <Text style={styles.skipButtonText}>
                {isProfileUpdate ? 'Cancel' : 'Skip for Now'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isProfileUpdate ? 'Update Information' : 'Save & Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E86AB',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notesContainer: {
    marginBottom: 20,
  },
  halfWidth: {
    flex: 0.48,
  },
  rightMargin: {
    marginLeft: '4%',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 15,
    paddingHorizontal: 10,
    minHeight: 50,
  },
  notesInput: {
    height: 80,
    paddingTop: 10,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  bmiContainer: {
    backgroundColor: '#E8F5E8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  bmiText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  skipButton: {
    backgroundColor: '#666',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0.48,
  },
  submitButton: {
    backgroundColor: '#2E86AB',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0.48,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});