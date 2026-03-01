import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGradeInfo } from '../utils/gradeDescriptions';
import FullScreenImageViewer from './FullScreenImageViewer';

const ScanResultDisplay = ({ 
  prediction, 
  patient, 
  scanDate, 
  userRole = 'patient',
  showPatientInfo = true,
  onSave = null,
  style = {} 
}) => {
  const [fullScreenImage, setFullScreenImage] = useState({
    visible: false,
    imageSource: null,
    patientName: '',
    predictionClass: ''
  });

  // Debug: Log the prediction data
  console.log('🔍 ScanResultDisplay received prediction:', JSON.stringify(prediction, null, 2));
  
  // Get grade information
  const gradeInfo = getGradeInfo(prediction, userRole);
  console.log('🔍 ScanResultDisplay grade info:', JSON.stringify(gradeInfo, null, 2));
  
  // Format scan date
  const formatScanDate = (date) => {
    if (!date) return 'Unknown date';
    const scanDate = new Date(date);
    return `${scanDate.toLocaleDateString()} at ${scanDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  };

  // Get image source
  const getImageSource = () => {
    console.log('🔍 Looking for image in prediction:', JSON.stringify(prediction, null, 2));
    
    // Check for imageUrl first (for database predictions and admin interface)
    if (prediction?.imageUrl) {
      console.log('🔍 Found imageUrl:', prediction.imageUrl.substring(0, 50));
      if (prediction.imageUrl.startsWith('data:')) {
        return prediction.imageUrl;
      } else if (prediction.imageUrl.startsWith('local://')) {
        return null; // Skip local placeholder URLs
      } else if (prediction.imageUrl.length > 100) {
        return `data:image/jpeg;base64,${prediction.imageUrl}`;
      }
    }
    
    // Check for imagePath (for new predictions)
    if (prediction?.imagePath) {
      console.log('🔍 Found imagePath:', prediction.imagePath.substring(0, 50));
      if (prediction.imagePath.startsWith('data:')) {
        return prediction.imagePath;
      } else if (prediction.imagePath.startsWith('local://')) {
        return null; // Skip local placeholder URLs
      } else if (prediction.imagePath.length > 100) {
        return `data:image/jpeg;base64,${prediction.imagePath}`;
      }
    }
    
    // Check for imageUrl in the parent object (when passed from HistoryScreen)
    if (prediction?.parent?.imageUrl) {
      console.log('🔍 Found parent imageUrl:', prediction.parent.imageUrl.substring(0, 50));
      const imageUrl = prediction.parent.imageUrl;
      if (imageUrl.startsWith('data:')) {
        return imageUrl;
      } else if (imageUrl.startsWith('local://')) {
        return null;
      } else if (imageUrl.length > 100) {
        return `data:image/jpeg;base64,${imageUrl}`;
      }
    }
    
    // Check for image in nested prediction object
    if (prediction?.prediction?.imageUrl) {
      console.log('🔍 Found nested imageUrl:', prediction.prediction.imageUrl.substring(0, 50));
      const imageUrl = prediction.prediction.imageUrl;
      if (imageUrl.startsWith('data:')) {
        return imageUrl;
      } else if (imageUrl.startsWith('local://')) {
        return null;
      } else if (imageUrl.length > 100) {
        return `data:image/jpeg;base64,${imageUrl}`;
      }
    }
    
    if (prediction?.prediction?.imagePath) {
      console.log('🔍 Found nested imagePath:', prediction.prediction.imagePath.substring(0, 50));
      const imagePath = prediction.prediction.imagePath;
      if (imagePath.startsWith('data:')) {
        return imagePath;
      } else if (imagePath.startsWith('local://')) {
        return null;
      } else if (imagePath.length > 100) {
        return `data:image/jpeg;base64,${imagePath}`;
      }
    }
    
    console.log('🔍 No image found in prediction data');
    return null;
  };

  const imageSource = getImageSource();

  const openFullScreenImage = () => {
    if (imageSource) {
      setFullScreenImage({
        visible: true,
        imageSource,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient',
        predictionClass: `Grade ${gradeInfo.grade} - ${gradeInfo.severity}`
      });
    }
  };

  const closeFullScreenImage = () => {
    setFullScreenImage({
      visible: false,
      imageSource: null,
      patientName: '',
      predictionClass: ''
    });
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header with Grade */}
      <View style={styles.header}>
        <View style={[styles.gradeContainer, { backgroundColor: gradeInfo.color }]}>
          <Text style={styles.gradeText}>Grade {gradeInfo.grade}</Text>
          <Text style={styles.severityText}>{gradeInfo.severity}</Text>
        </View>
        {scanDate && (
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.dateText}>{formatScanDate(scanDate)}</Text>
          </View>
        )}
      </View>

      {/* Patient Information */}
      {showPatientInfo && patient && (
        <View style={styles.patientInfo}>
          <View style={styles.patientHeader}>
            <Ionicons name="person-circle-outline" size={20} color="#2E86AB" />
            <Text style={styles.patientName}>
              {patient.firstName} {patient.lastName}
            </Text>
          </View>
          <View style={styles.patientDetails}>
            <Text style={styles.patientDetail}>
              Age: {patient.age} • Gender: {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Not specified'}
            </Text>
          </View>
        </View>
      )}

      {/* Scan Image */}
      {imageSource && (
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Scan Image</Text>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={openFullScreenImage}
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: imageSource }}
              style={styles.scanImage}
              resizeMode="contain"
            />
            <View style={styles.imageOverlay}>
              <Ionicons name="expand" size={20} color="#fff" />
              <Text style={styles.imageOverlayText}>Tap to enlarge</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Analysis Results */}
      <View style={styles.resultsSection}>
        <Text style={styles.sectionTitle}>Analysis Results</Text>
        
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Medical Assessment:</Text>
          <Text style={styles.descriptionText}>{gradeInfo.description}</Text>
        </View>

        <View style={styles.suggestionContainer}>
          <Text style={styles.suggestionTitle}>
            {userRole === 'patient' ? 'Recommendations:' : 'Clinical Recommendations:'}
          </Text>
          <Text style={styles.suggestionText}>{gradeInfo.suggestion}</Text>
        </View>
      </View>

      {/* Notes */}
      {prediction?.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <Text style={styles.notesText}>{prediction.notes}</Text>
        </View>
      )}

      {/* Action Buttons */}
      {onSave && (
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={() => onSave(prediction)}
          >
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Result</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        visible={fullScreenImage.visible}
        imageSource={fullScreenImage.imageSource}
        patientName={fullScreenImage.patientName}
        predictionClass={fullScreenImage.predictionClass}
        onClose={closeFullScreenImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gradeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  gradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  severityText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  patientInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E86AB',
    marginLeft: 8,
  },
  patientDetails: {
    marginLeft: 28,
  },
  patientDetail: {
    fontSize: 14,
    color: '#666',
  },
  imageSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  scanImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  resultsSection: {
    marginBottom: 16,
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  suggestionContainer: {
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E86AB',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: '#2E86AB',
    lineHeight: 20,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  actionSection: {
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ScanResultDisplay;
