import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { authAPI } from '../../services/api';
import { fetchUserProfile } from '../../store/slices/authSlice';

export default function DiabeticFootHistoryScreen({ navigation }) {
  const [formData, setFormData] = useState({
    // Duration of Ulcer (in months)
    ulcerDuration: {
      right: '',
      left: ''
    },
    
    // Past History of Ulcer (Yes/No)
    pastUlcerHistory: {
      right: null,
      left: null
    },
    
    // History of Amputation (Yes/No)
    amputationHistory: {
      right: null,
      left: null
    },
    
    // Joint Pain (Yes/No)
    jointPain: {
      right: null,
      left: null
    },
    
    // Numbness (Yes/No)
    numbness: {
      right: null,
      left: null
    },
    
    // Tingling/Pricking feeling (Yes/No)
    tingling: {
      right: null,
      left: null
    },
    
    // Claudication (Yes/No)
    claudication: {
      right: null,
      left: null
    },
    
    // Cramping (Yes/No)
    cramping: {
      right: null,
      left: null
    },
    
    // Temperature (Hot/Cold/Normal)
    temperature: {
      right: null,
      left: null
    },
    
    // Nail Lesion (Yes/No)
    nailLesion: {
      right: null,
      left: null
    },
    
    // Loss of Hair (Yes/No) - General question
    lossOfHair: null
  });

  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  // Check if this is an update (user coming from profile) or first-time collection
  useEffect(() => {
    console.log('👤 User state updated:', {
      hasHistory: !!user?.diabeticFootHistory,
      historyKeys: user?.diabeticFootHistory ? Object.keys(user.diabeticFootHistory) : [],
      completed: user?.diabeticFootHistory?.completed,
      isUpdating
    });
    
    if (user?.diabeticFootHistory && Object.keys(user.diabeticFootHistory).length > 0) {
      setIsUpdating(true);
      populateFormData(user.diabeticFootHistory);
    }
  }, [user]);

  // Add navigation focus listener to handle route updates
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // If user has completed diabetic foot history and this is first time, redirect to camera
      if (user?.diabeticFootHistory?.completed && !isUpdating) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          navigation.navigate('Camera');
        }, 100);
      }
    });

    return unsubscribe;
  }, [navigation, user?.diabeticFootHistory?.completed, isUpdating]);

  // Additional effect to handle immediate navigation after form submission
  useEffect(() => {
    // If user has completed diabetic foot history and this is first time, redirect to camera
    if (user?.diabeticFootHistory?.completed && !isUpdating && !loading) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        console.log('🔄 Auto-navigating to camera after history completion...');
        navigation.navigate('Camera');
      }, 500);
    }
  }, [user?.diabeticFootHistory?.completed, isUpdating, loading, navigation]);

  const populateFormData = (historyData) => {
    setFormData({
      ulcerDuration: historyData.ulcerDuration || { right: '', left: '' },
      pastUlcerHistory: historyData.pastUlcerHistory || { right: null, left: null },
      amputationHistory: historyData.amputationHistory || { right: null, left: null },
      jointPain: historyData.jointPain || { right: null, left: null },
      numbness: historyData.numbness || { right: null, left: null },
      tingling: historyData.tingling || { right: null, left: null },
      claudication: historyData.claudication || { right: null, left: null },
      cramping: historyData.cramping || { right: null, left: null },
      temperature: historyData.temperature || { right: null, left: null },
      nailLesion: historyData.nailLesion || { right: null, left: null },
      lossOfHair: historyData.lossOfHair !== undefined ? historyData.lossOfHair : null
    });
  };

  const handleInputChange = (category, side, value) => {
    if (category === 'lossOfHair') {
      // Hair loss is a general question, not leg-specific
      setFormData(prev => ({
        ...prev,
        [category]: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [side]: value
        }
      }));
    }
  };

  const validateForm = () => {
    // Check if critical fields are filled
    const requiredFields = [
      'pastUlcerHistory', 'amputationHistory', 'jointPain', 
      'numbness', 'tingling', 'claudication', 'cramping', 
      'temperature', 'nailLesion', 'lossOfHair'
    ];

    for (const field of requiredFields) {
      if (field === 'lossOfHair') {
        // Hair loss is a general question
        if (formData[field] === null) {
          Alert.alert('Incomplete Information', `Please answer the hair loss question.`);
          return false;
        }
      } else {
        if (formData[field].right === null || formData[field].left === null) {
          Alert.alert('Incomplete Information', `Please answer all questions for both legs.`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Save diabetic foot history
      const response = await authAPI.saveDiabeticFootHistory(formData);
      
      // Update user profile
      await dispatch(fetchUserProfile()).unwrap();
      
      console.log('✅ Diabetic foot history saved, user profile updated');
      console.log('👤 Updated user state:', {
        hasHistory: !!user?.diabeticFootHistory,
        completed: user?.diabeticFootHistory?.completed,
        isUpdating
      });
      
      Alert.alert(
        'Success!',
        'Your diabetic foot history has been saved successfully.',
        [
          {
            text: 'Continue to Scan',
            onPress: () => {
              if (isUpdating) {
                // If updating from profile, go back to profile
                navigation.goBack();
              } else {
                // If first time (from new scan), navigate to Camera tab
                // This will trigger the CameraNavigator to show CameraMain since history is now completed
                console.log('🔄 Navigating to camera...');
                navigation.navigate('Camera');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Diabetic foot history save error:', error);
      Alert.alert('Error', 'Failed to save diabetic foot history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isUpdating) {
      navigation.goBack();
    } else {
      Alert.alert(
        'Cancel Assessment',
        'You need to complete the diabetic foot history before scanning. Are you sure you want to go back?',
        [
          { text: 'Continue Filling', style: 'cancel' },
          { text: 'Go Back', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const renderYesNoQuestion = (title, category, icon, iconColor) => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        <Ionicons name={icon} size={24} color={iconColor} />
        <Text style={styles.questionTitle}>{title}</Text>
      </View>
      
      <View style={styles.legContainer}>
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Right Leg</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData[category].right}
              style={styles.picker}
              onValueChange={(value) => handleInputChange(category, 'right', value)}
            >
              <Picker.Item label="Select answer" value={null} />
              <Picker.Item label="Yes" value={true} />
              <Picker.Item label="No" value={false} />
            </Picker>
          </View>
        </View>
        
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Left Leg</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData[category].left}
              style={styles.picker}
              onValueChange={(value) => handleInputChange(category, 'left', value)}
            >
              <Picker.Item label="Select answer" value={null} />
              <Picker.Item label="Yes" value={true} />
              <Picker.Item label="No" value={false} />
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTemperatureQuestion = () => (
    <View style={styles.questionContainer}>
      <View style={styles.questionHeader}>
        <Ionicons name="thermometer-outline" size={24} color="#FF5722" />
        <Text style={styles.questionTitle}>Temperature</Text>
      </View>
      
      <View style={styles.legContainer}>
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Right Leg</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.temperature.right}
              style={styles.picker}
              onValueChange={(value) => handleInputChange('temperature', 'right', value)}
            >
              <Picker.Item label="Select temperature" value={null} />
              <Picker.Item label="Hot" value="hot" />
              <Picker.Item label="Cold" value="cold" />
              <Picker.Item label="Normal" value="normal" />
            </Picker>
          </View>
        </View>
        
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Left Leg</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.temperature.left}
              style={styles.picker}
              onValueChange={(value) => handleInputChange('temperature', 'left', value)}
            >
              <Picker.Item label="Select temperature" value={null} />
              <Picker.Item label="Hot" value="hot" />
              <Picker.Item label="Cold" value="cold" />
              <Picker.Item label="Normal" value="normal" />
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="medical" size={60} color="#2E86AB" />
          <Text style={styles.title}>
            {isUpdating ? 'Update Diabetic Foot History' : 'Diabetic Foot History'}
          </Text>
          <Text style={styles.subtitle}>
            {isUpdating 
              ? 'Update your diabetic foot assessment information'
              : 'Please complete this assessment before scanning'
            }
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Duration of Ulcer */}
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              <Ionicons name="time-outline" size={24} color="#9C27B0" />
              <Text style={styles.questionTitle}>Duration of Ulcer (months)</Text>
            </View>
            
            <View style={styles.legContainer}>
              <View style={styles.legSection}>
                <Text style={styles.legLabel}>Right Leg</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.ulcerDuration.right}
                    style={styles.picker}
                    onValueChange={(value) => handleInputChange('ulcerDuration', 'right', value)}
                  >
                    <Picker.Item label="Select duration" value="" />
                    <Picker.Item label="No ulcer" value="0" />
                    <Picker.Item label="Less than 1 month" value="0.5" />
                    <Picker.Item label="1-2 months" value="1.5" />
                    <Picker.Item label="3-6 months" value="4.5" />
                    <Picker.Item label="6-12 months" value="9" />
                    <Picker.Item label="More than 1 year" value="15" />
                  </Picker>
                </View>
              </View>
              
              <View style={styles.legSection}>
                <Text style={styles.legLabel}>Left Leg</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.ulcerDuration.left}
                    style={styles.picker}
                    onValueChange={(value) => handleInputChange('ulcerDuration', 'left', value)}
                  >
                    <Picker.Item label="Select duration" value="" />
                    <Picker.Item label="No ulcer" value="0" />
                    <Picker.Item label="Less than 1 month" value="0.5" />
                    <Picker.Item label="1-2 months" value="1.5" />
                    <Picker.Item label="3-6 months" value="4.5" />
                    <Picker.Item label="6-12 months" value="9" />
                    <Picker.Item label="More than 1 year" value="15" />
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Past History of Ulcer */}
          {renderYesNoQuestion('Past History of Ulcer', 'pastUlcerHistory', 'bandage-outline', '#FF9800')}

          {/* History of Amputation */}
          {renderYesNoQuestion('History of Amputation', 'amputationHistory', 'cut-outline', '#F44336')}

          {/* Joint Pain */}
          {renderYesNoQuestion('Joint Pain', 'jointPain', 'bonfire-outline', '#E91E63')}

          {/* Numbness */}
          {renderYesNoQuestion('Numbness', 'numbness', 'hand-left-outline', '#673AB7')}

          {/* Tingling/Pricking Feeling */}
          {renderYesNoQuestion('Tingling/Pricking Feeling', 'tingling', 'flash-outline', '#3F51B5')}

          {/* Claudication */}
          {renderYesNoQuestion('Claudication', 'claudication', 'walk-outline', '#2196F3')}

          {/* Cramping */}
          {renderYesNoQuestion('Cramping', 'cramping', 'fitness-outline', '#009688')}

          {/* Temperature */}
          {renderTemperatureQuestion()}

          {/* Nail Lesion */}
          {renderYesNoQuestion('Nail Lesion', 'nailLesion', 'warning-outline', '#FF5722')}

          {/* Loss of Hair - General Question */}
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              <Ionicons name="leaf-outline" size={24} color="#795548" />
              <Text style={styles.questionTitle}>Loss of Hair</Text>
            </View>
            
            <View style={styles.legContainer}>
              <View style={[styles.legSection, { flex: 1 }]}>
                <Text style={styles.legLabel}>General</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.lossOfHair}
                    style={styles.picker}
                    onValueChange={(value) => handleInputChange('lossOfHair', null, value)}
                  >
                    <Picker.Item label="Select answer" value={null} />
                    <Picker.Item label="Yes" value={true} />
                    <Picker.Item label="No" value={false} />
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>
                {isUpdating ? 'Cancel' : 'Go Back'}
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
                  {isUpdating ? 'Update History' : 'Continue to Scan'}
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
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionContainer: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  legContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legSection: {
    flex: 0.48,
  },
  generalQuestionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  legLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textAlign: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    height: 50,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2E86AB',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#2E86AB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
