import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { savePrediction } from '../../store/slices/predictionSlice';
import { apiUtils } from '../../services/api';
import { getGradeInfo } from '../../utils/gradeDescriptions';

export default function ResultsScreen({ route, navigation }) {
  const { prediction, imageUri } = route.params;
  const [notes, setNotes] = useState('');
  const [showAllProbabilities, setShowAllProbabilities] = useState(false);
  
  const dispatch = useDispatch();
  const { saving } = useSelector((state) => state.prediction);
  const { user } = useSelector((state) => state.auth);
  
  // Check if user is a patient (not doctor or admin)
  const isPatient = user?.role === 'patient' || (!user?.role || (user?.role !== 'doctor' && user?.role !== 'admin'));
  
  // Debug: Log the prediction data
  console.log('🔍 Prediction data received:', JSON.stringify(prediction, null, 2));
  
  // Get grade information
  const gradeInfo = getGradeInfo(prediction, user?.role || 'patient');
  console.log('🔍 Grade info extracted:', JSON.stringify(gradeInfo, null, 2));
  
  const timestamp = new Date();

  // Format timestamp for display
  const formatDateTime = (date) => {
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  const handleSavePrediction = async () => {
    try {
      // Convert image URI to base64 for proper storage
      let imageBase64 = null;
      if (imageUri) {
        try {
          console.log('🖼️ Converting image to base64 for storage...');
          imageBase64 = await apiUtils.imageToBase64(imageUri);
          console.log('🖼️ Image converted successfully, size:', imageBase64.length);
        } catch (imageError) {
          console.error('🖼️ Failed to convert image to base64:', imageError);
          // Continue without image rather than failing completely
          console.log('🖼️ Saving prediction without image...');
        }
      }
      
      const predictionData = {
        prediction,
        notes,
        imagePath: imageBase64, // Save as base64 for proper viewing later
      };

      await dispatch(savePrediction(predictionData)).unwrap();
      
      Alert.alert(
        'Saved Successfully',
        'The analysis result has been saved to your history.',
        [
          {
            text: 'View History',
            onPress: () => navigation.navigate('History'),
          },
          {
            text: 'New Scan',
            onPress: () => navigation.navigate('CameraMain'),
          },
        ]
      );
    } catch (error) {
      console.error('Save prediction error:', error);
      Alert.alert('Save Failed', error || 'Failed to save the prediction.');
    }
  };

  const handleRetake = () => {
    navigation.navigate('CameraMain');
  };

  const sortedProbabilities = Object.entries(prediction.all_probabilities)
    .sort(([,a], [,b]) => b - a);

  return (
    <ScrollView style={styles.container}>
      {/* Image Display */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.resultImage} />
      </View>

      {/* Date and Time */}
      <View style={styles.timestampContainer}>
        <Ionicons name="time-outline" size={16} color="#666" />
        <Text style={styles.timestampText}>
          {formatDateTime(timestamp)}
        </Text>
      </View>

      {/* Analysis Result Card */}
      <View style={styles.resultCard}>
        <View style={styles.gradeHeader}>
          <Text style={styles.gradeLabel}>Grade</Text>
          <View style={[styles.gradeBadge, { backgroundColor: gradeInfo?.color || '#666' }]}>
            <Text style={styles.gradeNumber}>{gradeInfo?.grade || '0'}</Text>
          </View>
        </View>

        {/* Patient Information */}
        <View style={styles.patientInfo}>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Name:</Text>
            <Text style={styles.patientValue}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Age:</Text>
            <Text style={styles.patientValue}>{user?.age} years</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Gender:</Text>
            <Text style={styles.patientValue}>
              {user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not specified'}
            </Text>
          </View>
        </View>

        {/* Medical Assessment */}
        <View style={styles.assessmentSection}>
          <Text style={styles.sectionTitle}>Medical Assessment</Text>
          <Text style={styles.assessmentText}>
            {gradeInfo?.description || 'Analysis completed'}
          </Text>
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <Text style={styles.recommendationText}>
            {gradeInfo?.suggestion || 'Please consult with a healthcare provider'}
          </Text>
        </View>
      </View>

      {/* Notes Section */}
      <View style={styles.notesContainer}>
        <Text style={styles.notesLabel}>Add Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add any additional notes or observations..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Disclaimer */}
      <View style={[
        styles.disclaimerContainer,
        isPatient && gradeInfo?.severity === 'critical' && styles.criticalDisclaimer
      ]}>
        <Ionicons 
          name="warning" 
          size={20} 
          color={isPatient && gradeInfo?.severity === 'critical' ? '#F44336' : '#FF9800'} 
        />
        <Text style={[
          styles.disclaimerText,
          isPatient && gradeInfo?.severity === 'critical' && styles.criticalDisclaimerText
        ]}>
          {isPatient && (gradeInfo?.severity === 'critical' || gradeInfo?.severity === 'high')
            ? 'URGENT: This result indicates a serious condition requiring immediate medical attention. Please contact your healthcare provider or emergency services right away.'
            : 'Important: This is a personal monitoring tool only. Share these results with your healthcare provider for professional medical evaluation and treatment guidance.'
          }
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSavePrediction}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="save" size={20} color="#fff" />
            )}
            <Text style={styles.buttonText}>
              {saving ? 'Saving...' : 'Save Result'}
            </Text>
          </TouchableOpacity>
  
          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={handleRetake}
          >
            <Ionicons name="camera" size={20} color="#2E86AB" />
            <Text style={[styles.buttonText, styles.retakeButtonText]}>
              New Scan
            </Text>
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
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 5,
  },
  timestampText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resultCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  gradeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  gradeBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  patientInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  patientLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  patientValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  assessmentSection: {
    marginBottom: 20,
  },
  recommendationSection: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  assessmentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2E86AB',
  },
  recommendationText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    backgroundColor: '#f0fff4',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#27ae60',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  userInfoContent: {
    flex: 1,
    marginLeft: 8,
  },
  userInfoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 20,
  },
  userInfoLabel: {
    fontWeight: '600',
    color: '#333',
  },
  imageContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  resultImage: {
    width: 280,
    height: 200,               // Rectangular to show full image
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2E86AB',
    resizeMode: 'cover',       // Maintain aspect ratio
  },
  resultContainer: {
    backgroundColor: '#fff',
    margin: 20,
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
  mainResult: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
  },
  probabilitiesContainer: {
    marginBottom: 20,
  },
  probabilitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  probabilitiesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  probabilitiesList: {
    marginTop: 10,
  },
  probabilityItem: {
    marginBottom: 15,
  },
  probabilityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  probabilityBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  probabilityBar: {
    height: '100%',
    borderRadius: 10,
  },
  probabilityValue: {
    position: 'absolute',
    right: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  disclaimerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#e65100',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  retakeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2E86AB',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  retakeButtonText: {
    color: '#2E86AB',
  },
  // Patient-specific styles
  gradeHeader: {
    borderLeftWidth: 4,
    paddingLeft: 15,
    marginBottom: 20,
  },
  gradeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 5,
  },
  severityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gradeSection: {
    gap: 20,
  },
  meaningContainer: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2E86AB',
  },
  actionContainer: {
    backgroundColor: '#f0fff4',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  confidenceContainerPatient: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  confidenceLabelSmall: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  confidenceBarBackground: {
    height: 25,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 12,
  },
  confidencePercentage: {
    position: 'absolute',
    right: 10,
    top: 3,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  criticalDisclaimer: {
    backgroundColor: '#ffebee',
    borderLeftColor: '#F44336',
  },
  criticalDisclaimerText: {
    color: '#c62828',
    fontWeight: '600',
  },
});