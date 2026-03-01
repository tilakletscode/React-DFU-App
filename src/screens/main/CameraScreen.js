import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { classifyImage } from '../../store/slices/predictionSlice';
import { apiUtils } from '../../services/api';
// import { uploadImage } from '../../services/firebaseStorage'; // Temporarily disabled

export default function CameraScreen({ navigation }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  
  const dispatch = useDispatch();
  const { classifying, error } = useSelector((state) => state.prediction);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // Request camera permissions when component mounts
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Sorry, we need camera and media library permissions to make this work!',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  const processImage = async (imageUri) => {
    try {
      setSelectedImage(imageUri);
      
      // Convert image to base64
      const base64Data = await apiUtils.imageToBase64(imageUri);
      setImageBase64(base64Data);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process the selected image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,        // ❌ REMOVED: No more cropping
        quality: 0.8,               // Keep high quality for ML analysis
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,        // ❌ REMOVED: No more cropping
        quality: 0.8,               // Keep high quality for ML analysis
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const analyzeImage = async () => {
    if (!imageBase64) {
      Alert.alert('Error', 'No image selected for analysis.');
      return;
    }

    try {
      // Skip Firebase Storage for now - use local image
      console.log('🔄 Starting ML analysis...');
      
      // Perform ML analysis - Redux handles the loading state
      const result = await dispatch(classifyImage(imageBase64)).unwrap();
      
      // Navigate to results screen with prediction
      navigation.navigate('Results', {
        prediction: result,
        imageUri: selectedImage,
        // firebaseImageUrl: null, // Temporarily disabled
        // thumbnailUrl: null,
        // imageMetadata: null
      });
      
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert(
        'Analysis Failed',
        error.message || 'Failed to analyze the image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImageBase64(null);
  };

  const showImageOptions = () => {
    Alert.alert(
      'Select Image',
      'Choose how you want to select an image',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.instructionContainer}>
        <Ionicons name="information-circle" size={24} color="#2E86AB" />
        <Text style={styles.instructionText}>
          Take a clear, full photo of the affected area for comprehensive analysis
        </Text>
      </View>

      <View style={styles.imageContainer}>
        {selectedImage ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
              <Ionicons name="close-circle" size={30} color="#F44336" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePlaceholder} onPress={showImageOptions}>
            <Ionicons name="camera" size={60} color="#ccc" />
            <Text style={styles.placeholderText}>Tap to select image</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {!selectedImage ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#2E86AB" />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionButton} onPress={showImageOptions}>
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.buttonText}>Change Image</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.analyzeButton, classifying && styles.disabledButton]} 
              onPress={analyzeImage}
              disabled={classifying}
            >
              {classifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="analytics" size={24} color="#fff" />
              )}
              <Text style={styles.buttonText}>
                {classifying ? 'Analyzing...' : 'Analyze'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {classifying && (
        <View style={styles.analysisContainer}>
          <ActivityIndicator size="large" color="#2E86AB" />
          <Text style={styles.analysisText}>Analyzing image...</Text>
          <Text style={styles.analysisSubtext}>This may take a few moments</Text>
        </View>
      )}

      <View style={styles.disclaimerContainer}>
        <Ionicons name="warning" size={20} color="#FF9800" />
        <Text style={styles.disclaimerText}>
          For personal monitoring only. Share results with your doctor for professional medical advice and diagnosis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  instructionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1976d2',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    position: 'relative',
  },
  selectedImage: {
    width: 300,
    height: 200,               // Changed to rectangular for full images
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2E86AB',
    resizeMode: 'cover',       // Maintain aspect ratio without cropping
  },
  clearButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  imagePlaceholder: {
    width: 300,
    height: 200,               // Changed to match selectedImage
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2E86AB',
    borderRadius: 8,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2E86AB',
  },
  analyzeButton: {
    backgroundColor: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#2E86AB',
  },
  analysisContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 20,
  },
  analysisText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  analysisSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
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
    lineHeight: 20,
  },
});