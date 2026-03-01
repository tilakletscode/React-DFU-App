import React, { useState } from 'react';
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function FullScreenImageViewer({ 
  visible, 
  imageSource, 
  onClose, 
  patientName = 'Patient',
  predictionClass = ''
}) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  const handlePinchGestureEvent = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const newScale = Math.max(0.5, Math.min(3, event.nativeEvent.scale));
      setScale(newScale);
    }
  };

  const handlePanGestureEvent = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const maxTranslateX = (scale - 1) * screenWidth / 2;
      const maxTranslateY = (scale - 1) * screenHeight / 2;
      
      const newTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, event.nativeEvent.translationX));
      const newTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, event.nativeEvent.translationY));
      
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      resetImage();
    }
    setLastTap(now);
  };

  const resetImage = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setLastTap(0);
  };

  const closeModal = () => {
    resetImage();
    onClose();
  };

  if (!visible || !imageSource) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeModal}
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.patientName}>{patientName}</Text>
            {predictionClass && (
              <Text style={styles.predictionClass}>{predictionClass}</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {(scale !== 1 || translateX !== 0 || translateY !== 0) && (
              <TouchableOpacity style={styles.headerButton} onPress={resetImage}>
                <Ionicons name="refresh" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerButton} onPress={closeModal}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Container */}
        <View style={styles.imageContainer}>
          <PinchGestureHandler onGestureEvent={handlePinchGestureEvent}>
            <View>
              <PanGestureHandler 
                onGestureEvent={handlePanGestureEvent}
                simultaneousHandlers={PinchGestureHandler}
              >
                <View>
                  <TouchableOpacity
                    onPress={handleDoubleTap}
                    activeOpacity={1}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Image
                      source={{ 
                        uri: imageSource.startsWith('data:') 
                          ? imageSource 
                          : `data:image/jpeg;base64,${imageSource}` 
                      }}
                      style={[
                        styles.image,
                        {
                          transform: [
                            { scale },
                            { translateX },
                            { translateY },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              </PanGestureHandler>
            </View>
          </PinchGestureHandler>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            Pinch to zoom • Drag to pan • Double tap to reset
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerInfo: {
    flex: 1,
  },
  patientName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  predictionClass: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 10,
    marginLeft: 10,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  instructions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
