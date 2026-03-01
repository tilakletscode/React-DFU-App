import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { authAPI } from '../../services/api';
import FullScreenImageViewer from '../../components/FullScreenImageViewer';
import ScanResultDisplay from '../../components/ScanResultDisplay';

// Helper function to get proper image URI
const getImageUri = (imagePath) => {
  if (!imagePath) return null;
  
  console.log('📸 Processing image path:', imagePath.substring(0, 50));
  
  // If it already starts with data: URI, use it directly
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // If it looks like base64 (long string without slashes), format as data URI
  if (imagePath.length > 100 && !imagePath.includes('/') && !imagePath.includes('http')) {
    return `data:image/jpeg;base64,${imagePath}`;
  }
  
  // If it's a URL or file path, use it directly
  if (imagePath.startsWith('http') || imagePath.startsWith('file://')) {
    return imagePath;
  }
  
  // Default: treat as base64
  return `data:image/jpeg;base64,${imagePath}`;
};

// Component to handle image display with fallback
const ImageWithFallback = ({ imagePath, style }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (imageError) {
    return (
      <View style={[style, styles.imageFallback]}>
        <Ionicons name="image-outline" size={50} color="#ccc" />
        <Text style={styles.fallbackText}>Image not available</Text>
      </View>
    );
  }

  return (
    <View>
      {imageLoading && (
        <View style={[style, styles.imageLoading]}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading image...</Text>
        </View>
      )}
      <Image 
        source={{ uri: getImageUri(imagePath) }}
        style={[style, imageLoading && { opacity: 0 }]}
        resizeMode="contain"
        onError={(error) => {
          console.error('📸 Image load error:', error.nativeEvent.error);
          console.log('📸 Failed image URI:', getImageUri(imagePath));
          console.log('📸 Original image path:', imagePath);
          setImageError(true);
          setImageLoading(false);
        }}
        onLoad={() => {
          console.log('📸 Image loaded successfully');
          setImageLoading(false);
        }}
        onLoadStart={() => {
          console.log('📸 Image loading started');
          setImageLoading(true);
        }}
      />
    </View>
  );
};

// Helper function to format duration with time indication
const formatDuration = (duration) => {
  if (!duration && duration !== 0) return 'Not specified';
  
  // Convert to string if it's a number
  const durationStr = String(duration);
  
  // If the duration already contains time units, return as is
  if (durationStr.toLowerCase().includes('year') || 
      durationStr.toLowerCase().includes('month') || 
      durationStr.toLowerCase().includes('day') ||
      durationStr.toLowerCase().includes('week')) {
    return durationStr;
  }
  
  // If it's just a number, try to format it intelligently
  const numericValue = parseFloat(durationStr);
  if (!isNaN(numericValue)) {
    if (numericValue < 1) {
      return `${numericValue} months`;
    } else if (numericValue >= 1 && numericValue < 24) {
      return `${numericValue} ${numericValue === 1 ? 'year' : 'years'}`;
    } else {
      return `${numericValue} months`;
    }
  }
  
  // If it contains numbers, try to extract and format
  const numberMatch = durationStr.match(/(\d+\.?\d*)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
    const remainingText = durationStr.replace(numberMatch[1], '').trim();
    
    if (remainingText) {
      return `${num} ${remainingText}`;
    } else {
      // Default assumption: if just a number, it's probably years
      return `${num} ${num === 1 ? 'year' : 'years'}`;
    }
  }
  
  // Return as is if can't parse
  return durationStr;
};

// Helper function to format diabetic foot ulcer duration
const formatUlcerDuration = (value) => {
  if (!value) return 'Not specified';
  
  // Map the stored values back to readable text
  switch (value) {
    case '0': return 'No ulcer';
    case '0.5': return 'Less than 1 month';
    case '1.5': return '1-2 months';
    case '4.5': return '3-6 months';
    case '9': return '6-12 months';
    case '15': return 'More than a year';
    default: 
      // If it's a number, format with time unit
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (numericValue < 1) {
          return `${value} months`;
        } else if (numericValue === 1) {
          return `${value} month`;
        } else {
          return `${value} months`;
        }
      }
      return value; // fallback for any other values
  }
};

export default function PatientDetailsScreen({ route, navigation }) {
  const { userId, patientName } = route.params;
  const { user } = useSelector((state) => state.auth);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState({
    visible: false,
    imageSource: null,
    patientName: '',
    predictionClass: ''
  });

  useEffect(() => {
    fetchPatientDetails();
  }, [userId]);

  const fetchPatientDetails = async () => {
    try {
      setLoading(true);
      // Use doctor-specific endpoint for patient details
      const response = user.role === 'doctor' 
        ? await authAPI.getPatientDetails(userId)
        : await authAPI.getUserDetails(userId);
      setPatientDetails(response);
    } catch (error) {
      console.error('Failed to fetch patient details:', error);
      Alert.alert('Error', 'Failed to fetch patient details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPatientDetails();
    setRefreshing(false);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      setSendingMessage(true);
      await authAPI.sendMessage({
        recipientId: userId,
        subject: `Message from Dr. ${user.firstName} ${user.lastName}`,
        content: message.trim(),
        messageType: 'medical_advice',
        priority: 'normal'
      });

      Alert.alert('Success', 'Message sent successfully!');
      setMessage('');
      setMessageModalVisible(false);
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const openFullScreenImage = (imageSource, patientName, predictionClass) => {
    setFullScreenImage({
      visible: true,
      imageSource,
      patientName,
      predictionClass
    });
  };

  const closeFullScreenImage = () => {
    setFullScreenImage({
      visible: false,
      imageSource: null,
      patientName: '',
      predictionClass: ''
    });
  };

  const getHealthStatus = (medicalInfo) => {
    if (!medicalInfo) return { status: 'Unknown', color: '#95a5a6' };
    
    let riskFactors = 0;
    if (medicalInfo.bmi && medicalInfo.bmi > 30) riskFactors++;
    if (medicalInfo.isSmoker) riskFactors++;
    if (medicalInfo.hasCardiovascularDisease === 'yes') riskFactors++;
    if (medicalInfo.hasChronicKidneyDisease === 'yes') riskFactors++;
    
    if (riskFactors >= 3) return { status: 'High Risk', color: '#e74c3c' };
    if (riskFactors >= 2) return { status: 'Medium Risk', color: '#f39c12' };
    if (riskFactors >= 1) return { status: 'Low Risk', color: '#f1c40f' };
    return { status: 'Low Risk', color: '#27ae60' };
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading patient details...</Text>
      </View>
    );
  }

  if (!patientDetails) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#3498db" />
        <Text style={styles.errorText}>Failed to load patient details</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchPatientDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { patient, predictions = [], messages = [], statistics = {} } = patientDetails;
  const healthStatus = getHealthStatus(patient?.medicalInfo);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Patient Header */}
      <View style={styles.header}>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
          <Text style={styles.patientEmail}>{patient.email}</Text>
          <View style={styles.patientMeta}>
            <View style={[styles.healthBadge, { backgroundColor: healthStatus.color }]}>
              <Ionicons name="fitness" size={16} color="white" />
              <Text style={styles.healthText}>{healthStatus.status}</Text>
            </View>
            <View style={styles.ageBadge}>
              <Text style={styles.ageText}>{patient.age} years old</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => setMessageModalVisible(true)}
        >
          <Ionicons name="chatbubble" size={20} color="white" />
          <Text style={styles.messageButtonText}>Send Message</Text>
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.totalPredictions || 0}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.criticalPredictions || 0}</Text>
          <Text style={styles.statLabel}>Critical Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {patient.medicalInfoCompleted ? 'Complete' : 'Incomplete'}
          </Text>
          <Text style={styles.statLabel}>Medical Info</Text>
        </View>
      </View>

      {/* Personal Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Full Name" value={`${patient.firstName || patient.name || 'N/A'} ${patient.lastName || ''}`.trim()} />
          <DetailRow label="Username" value={patient.username || 'N/A'} />
          <DetailRow label="Email" value={patient.email || 'N/A'} />
          <DetailRow label="Phone Number" value={patient.phone || 'Not provided'} />
          <DetailRow label="Age" value={patient.age ? `${patient.age} years` : 'N/A'} />
          <DetailRow label="Gender" value={patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'N/A'} />
          <DetailRow label="Role" value={patient.role ? patient.role.charAt(0).toUpperCase() + patient.role.slice(1) : 'N/A'} />
          <DetailRow label="Account Status" value={patient.isActive !== false ? 'Active' : 'Inactive'} />
          <DetailRow label="Email Verified" value={patient.emailVerified ? 'Yes' : 'No'} />
          <DetailRow label="Phone Verified" value={patient.phoneVerified ? 'Yes' : 'No'} />
          <DetailRow label="Joined Date" value={patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'N/A'} />
          {patient.lastLogin && (
            <DetailRow label="Last Login" value={new Date(patient.lastLogin).toLocaleDateString()} />
          )}
          {patient.updatedAt && (
            <DetailRow label="Last Updated" value={new Date(patient.updatedAt).toLocaleDateString()} />
          )}
        </View>
      </View>

      {/* Medical Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <View style={styles.detailCard}>
          {patient.medicalInfo ? (
            <>
              {console.log('🔍 Patient Medical Info Debug:', {
                diabetesDuration: patient.medicalInfo.diabetesDuration,
                hypertensionDuration: patient.medicalInfo.hypertensionDuration,
                type: typeof patient.medicalInfo.diabetesDuration
              })}
              {patient.medicalInfo.height && (
                <DetailRow label="Height" value={`${patient.medicalInfo.height} cm`} />
              )}
              {patient.medicalInfo.weight && (
                <DetailRow label="Weight" value={`${patient.medicalInfo.weight} kg`} />
              )}
              {patient.medicalInfo.bmi && (
                <DetailRow label="BMI" value={patient.medicalInfo.bmi.toString()} />
              )}
              {patient.medicalInfo.bloodSugarLevel && (
                <DetailRow label="Blood Sugar Level" value={`${patient.medicalInfo.bloodSugarLevel} mg/dL`} />
              )}
              {patient.medicalInfo.hba1c && (
                <DetailRow label="HbA1c" value={`${patient.medicalInfo.hba1c}%`} />
              )}
              <DetailRow label="Diabetes Duration" value={formatDuration(patient.medicalInfo.diabetesDuration)} />
              <DetailRow label="Hypertension Duration" value={formatDuration(patient.medicalInfo.hypertensionDuration)} />
              {patient.medicalInfo.isSmoker !== null && patient.medicalInfo.isSmoker !== undefined && (
                <DetailRow label="Smoker" value={patient.medicalInfo.isSmoker ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasDiabetes !== null && patient.medicalInfo.hasDiabetes !== undefined && (
                <DetailRow label="Has Diabetes" value={patient.medicalInfo.hasDiabetes ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasHighBloodPressure !== null && patient.medicalInfo.hasHighBloodPressure !== undefined && (
                <DetailRow label="Has High Blood Pressure" value={patient.medicalInfo.hasHighBloodPressure ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasHighCholesterol !== null && patient.medicalInfo.hasHighCholesterol !== undefined && (
                <DetailRow label="Has High Cholesterol" value={patient.medicalInfo.hasHighCholesterol ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasHeartDisease !== null && patient.medicalInfo.hasHeartDisease !== undefined && (
                <DetailRow label="Has Heart Disease" value={patient.medicalInfo.hasHeartDisease ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasKidneyDisease !== null && patient.medicalInfo.hasKidneyDisease !== undefined && (
                <DetailRow label="Has Kidney Disease" value={patient.medicalInfo.hasKidneyDisease ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasChronicKidneyDisease !== null && patient.medicalInfo.hasChronicKidneyDisease !== undefined && (
                <DetailRow label="Has Chronic Kidney Disease" value={patient.medicalInfo.hasChronicKidneyDisease ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasNerveDamage !== null && patient.medicalInfo.hasNerveDamage !== undefined && (
                <DetailRow label="Has Nerve Damage" value={patient.medicalInfo.hasNerveDamage ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasPoorCirculation !== null && patient.medicalInfo.hasPoorCirculation !== undefined && (
                <DetailRow label="Has Poor Circulation" value={patient.medicalInfo.hasPoorCirculation ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasFootUlcers !== null && patient.medicalInfo.hasFootUlcers !== undefined && (
                <DetailRow label="Has Foot Ulcers" value={patient.medicalInfo.hasFootUlcers ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasAmputations !== null && patient.medicalInfo.hasAmputations !== undefined && (
                <DetailRow label="Has Amputations" value={patient.medicalInfo.hasAmputations ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasFootDeformities !== null && patient.medicalInfo.hasFootDeformities !== undefined && (
                <DetailRow label="Has Foot Deformities" value={patient.medicalInfo.hasFootDeformities ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasCalluses !== null && patient.medicalInfo.hasCalluses !== undefined && (
                <DetailRow label="Has Calluses" value={patient.medicalInfo.hasCalluses ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasCorns !== null && patient.medicalInfo.hasCorns !== undefined && (
                <DetailRow label="Has Corns" value={patient.medicalInfo.hasCorns ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasBlisters !== null && patient.medicalInfo.hasBlisters !== undefined && (
                <DetailRow label="Has Blisters" value={patient.medicalInfo.hasBlisters ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasCuts !== null && patient.medicalInfo.hasCuts !== undefined && (
                <DetailRow label="Has Cuts" value={patient.medicalInfo.hasCuts ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasSores !== null && patient.medicalInfo.hasSores !== undefined && (
                <DetailRow label="Has Sores" value={patient.medicalInfo.hasSores ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasIngrownToenails !== null && patient.medicalInfo.hasIngrownToenails !== undefined && (
                <DetailRow label="Has Ingrown Toenails" value={patient.medicalInfo.hasIngrownToenails ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasFungalInfections !== null && patient.medicalInfo.hasFungalInfections !== undefined && (
                <DetailRow label="Has Fungal Infections" value={patient.medicalInfo.hasFungalInfections ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasDrySkin !== null && patient.medicalInfo.hasDrySkin !== undefined && (
                <DetailRow label="Has Dry Skin" value={patient.medicalInfo.hasDrySkin ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasCrackedHeels !== null && patient.medicalInfo.hasCrackedHeels !== undefined && (
                <DetailRow label="Has Cracked Heels" value={patient.medicalInfo.hasCrackedHeels ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasFootPain !== null && patient.medicalInfo.hasFootPain !== undefined && (
                <DetailRow label="Has Foot Pain" value={patient.medicalInfo.hasFootPain ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasNumbness !== null && patient.medicalInfo.hasNumbness !== undefined && (
                <DetailRow label="Has Numbness" value={patient.medicalInfo.hasNumbness ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasTingling !== null && patient.medicalInfo.hasTingling !== undefined && (
                <DetailRow label="Has Tingling" value={patient.medicalInfo.hasTingling ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasBurning !== null && patient.medicalInfo.hasBurning !== undefined && (
                <DetailRow label="Has Burning" value={patient.medicalInfo.hasBurning ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasWeakness !== null && patient.medicalInfo.hasWeakness !== undefined && (
                <DetailRow label="Has Weakness" value={patient.medicalInfo.hasWeakness ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasBalanceProblems !== null && patient.medicalInfo.hasBalanceProblems !== undefined && (
                <DetailRow label="Has Balance Problems" value={patient.medicalInfo.hasBalanceProblems ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasWalkingDifficulties !== null && patient.medicalInfo.hasWalkingDifficulties !== undefined && (
                <DetailRow label="Has Walking Difficulties" value={patient.medicalInfo.hasWalkingDifficulties ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.hasCardiovascularDisease !== null && patient.medicalInfo.hasCardiovascularDisease !== undefined && (
                <DetailRow label="Has Cardiovascular Disease" value={patient.medicalInfo.hasCardiovascularDisease ? 'Yes' : 'No'} />
              )}
              {patient.medicalInfo.additionalNotes && (
                <DetailRow label="Additional Notes" value={patient.medicalInfo.additionalNotes} />
              )}
              {patient.medicalInfo.lastUpdated && (
                <DetailRow 
                  label="Last Updated" 
                  value={new Date(patient.medicalInfo.lastUpdated).toLocaleDateString()} 
                />
              )}
            </>
          ) : (
            <Text style={styles.noDataText}>No medical information available</Text>
          )}
        </View>
      </View>

      {/* Diabetic Foot History */}
      {patient.diabeticFootHistory && patient.diabeticFootHistory.completed && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diabetic Foot History</Text>
          <View style={styles.detailCard}>
            <DetailRow 
              label="Right Foot Ulcer Duration" 
              value={formatUlcerDuration(patient.diabeticFootHistory.ulcerDuration?.right)} 
            />
            <DetailRow 
              label="Left Foot Ulcer Duration" 
              value={formatUlcerDuration(patient.diabeticFootHistory.ulcerDuration?.left)} 
            />
            <DetailRow 
              label="Right Foot Past Ulcer" 
              value={patient.diabeticFootHistory.pastUlcerHistory?.right !== null ? (patient.diabeticFootHistory.pastUlcerHistory.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Past Ulcer" 
              value={patient.diabeticFootHistory.pastUlcerHistory?.left !== null ? (patient.diabeticFootHistory.pastUlcerHistory.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Amputation History" 
              value={patient.diabeticFootHistory.amputationHistory?.right !== null ? (patient.diabeticFootHistory.amputationHistory.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Amputation History" 
              value={patient.diabeticFootHistory.amputationHistory?.left !== null ? (patient.diabeticFootHistory.amputationHistory.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Joint Pain" 
              value={patient.diabeticFootHistory.jointPain?.right !== null ? (patient.diabeticFootHistory.jointPain.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Joint Pain" 
              value={patient.diabeticFootHistory.jointPain?.left !== null ? (patient.diabeticFootHistory.jointPain.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Numbness" 
              value={patient.diabeticFootHistory.numbness?.right !== null ? (patient.diabeticFootHistory.numbness.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Numbness" 
              value={patient.diabeticFootHistory.numbness?.left !== null ? (patient.diabeticFootHistory.numbness.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Tingling" 
              value={patient.diabeticFootHistory.tingling?.right !== null ? (patient.diabeticFootHistory.tingling.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Tingling" 
              value={patient.diabeticFootHistory.tingling?.left !== null ? (patient.diabeticFootHistory.tingling.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Claudication" 
              value={patient.diabeticFootHistory.claudication?.right !== null ? (patient.diabeticFootHistory.claudication.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Claudication" 
              value={patient.diabeticFootHistory.claudication?.left !== null ? (patient.diabeticFootHistory.claudication.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Cramping" 
              value={patient.diabeticFootHistory.cramping?.right !== null ? (patient.diabeticFootHistory.cramping.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Cramping" 
              value={patient.diabeticFootHistory.cramping?.left !== null ? (patient.diabeticFootHistory.cramping.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Temperature" 
              value={patient.diabeticFootHistory.temperature?.right || 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Temperature" 
              value={patient.diabeticFootHistory.temperature?.left || 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Nail Lesion" 
              value={patient.diabeticFootHistory.nailLesion?.right !== null ? (patient.diabeticFootHistory.nailLesion.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Nail Lesion" 
              value={patient.diabeticFootHistory.nailLesion?.left !== null ? (patient.diabeticFootHistory.nailLesion.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Loss of Hair" 
              value={patient.diabeticFootHistory.lossOfHair !== null ? (patient.diabeticFootHistory.lossOfHair ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Last Updated" 
              value={patient.diabeticFootHistory.lastUpdated ? new Date(patient.diabeticFootHistory.lastUpdated).toLocaleDateString() : 'Not available'} 
            />
          </View>
        </View>
      )}

      {/* Recent Scan Results */}
      {predictions && predictions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Scan Results ({predictions.length})</Text>
          {predictions.map((prediction) => prediction && prediction._id ? (
            <View key={prediction._id} style={styles.predictionCard}>
              <ScanResultDisplay
                prediction={prediction}
                patientName={`${patient?.firstName || 'Patient'} ${patient?.lastName || ''}`.trim() || 'Patient'}
                patientAge={patient?.age}
                patientGender={patient?.gender}
                showFullDetails={true}
              />
            </View>
          ) : null)}
          {predictions.length === 0 && (
            <Text style={styles.noDataText}>No scan results available</Text>
          )}
        </View>
      )}

      {/* Message History */}
      {messages && messages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message History</Text>
          {messages.map((message) => message && message._id ? (
            <View key={message._id} style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageSender}>
                  {message.fromUserId 
                    ? `Dr. ${message.fromUserId.firstName} ${message.fromUserId.lastName}` 
                    : 'System Message'
                  }
                </Text>
                <Text style={styles.messageDate}>
                  {new Date(message.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageText}>{message.message}</Text>
              <Text style={styles.messageStatus}>
                {message.isRead ? 'Read' : 'Unread'} • {new Date(message.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          ) : null)}
        </View>
      )}

      {/* Send Message Modal */}
      <Modal
        visible={messageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMessageModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send Message</Text>
            <TouchableOpacity onPress={handleSendMessage} disabled={sendingMessage}>
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#3498db" />
              ) : (
                <Text style={styles.sendButton}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.recipientInfo}>
              To: {patient?.firstName} {patient?.lastName}
            </Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message here..."
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        visible={fullScreenImage.visible}
        imageSource={fullScreenImage.imageSource}
        patientName={fullScreenImage.patientName}
        predictionClass={fullScreenImage.predictionClass}
        onClose={closeFullScreenImage}
      />
    </ScrollView>
  );
}

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#3498db',
    padding: 20,
    paddingTop: 40,
  },
  patientInfo: {
    alignItems: 'center',
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  patientEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 10,
  },
  patientMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 5,
  },
  healthText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ageBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  ageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionContainer: {
    padding: 15,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  messageButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    paddingTop: 0,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    margin: 15,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  predictionCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  predictionDate: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  predictionResultContainer: {
    alignItems: 'flex-end',
  },
  predictionResult: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  predictionNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  imageContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  predictionImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  fallbackText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  imageLoading: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    zIndex: 1,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  messageDate: {
    fontSize: 12,
    color: '#666',
  },
  messageText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 5,
  },
  messageStatus: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sendButton: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  recipientInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  messageInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 200,
    textAlignVertical: 'top',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  userInfoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
});
