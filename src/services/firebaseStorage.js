import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import app from '../config/firebase';
import * as ImageManipulator from 'expo-image-manipulator';

// Initialize Firebase Storage
const storage = getStorage(app);

// Storage paths
const STORAGE_PATHS = {
  SCAN_IMAGES: 'scan-images',
  PROFILE_IMAGES: 'profile-images',
  THUMBNAILS: 'thumbnails'
};

/**
 * Upload image to Firebase Storage with optimization
 * @param {string} imageUri - Local image URI
 * @param {string} userId - User ID for folder organization
 * @param {string} type - Image type (scan, profile, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Upload result with URL and metadata
 */
export const uploadImage = async (imageUri, userId, type = 'scan', metadata = {}) => {
  try {
    console.log('🔄 Starting image upload to Firebase Storage...');
    
    // Optimize image before upload
    const optimizedImage = await optimizeImage(imageUri);
    
    // Create unique filename
    const timestamp = new Date().getTime();
    const filename = `${userId}_${timestamp}_${type}.jpg`;
    const storagePath = `${STORAGE_PATHS.SCAN_IMAGES}/${userId}/${filename}`;
    
    // Create storage reference
    const storageRef = ref(storage, storagePath);
    
    // Convert optimized image to blob
    const response = await fetch(optimizedImage.uri);
    const blob = await response.blob();
    
    // Prepare metadata
    const uploadMetadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        userId: userId,
        type: type,
        originalWidth: optimizedImage.width.toString(),
        originalHeight: optimizedImage.height.toString(),
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    };
    
    // Upload image
    console.log('📤 Uploading to Firebase Storage...');
    const uploadResult = await uploadBytes(storageRef, blob, uploadMetadata);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    // Create thumbnail if it's a scan image
    let thumbnailURL = null;
    if (type === 'scan') {
      thumbnailURL = await createAndUploadThumbnail(imageUri, userId, timestamp);
    }
    
    console.log('✅ Image uploaded successfully to Firebase Storage');
    
    return {
      success: true,
      downloadURL,
      thumbnailURL,
      storagePath,
      filename,
      metadata: {
        size: blob.size,
        width: optimizedImage.width,
        height: optimizedImage.height,
        contentType: 'image/jpeg',
        uploadedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Firebase Storage upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Optimize image for upload (compress and resize)
 * @param {string} imageUri - Original image URI
 * @returns {Promise<Object>} Optimized image result
 */
const optimizeImage = async (imageUri) => {
  try {
    console.log('🔄 Optimizing image...');
    
    // Get image info first
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const manipulateOptions = [];
    
    // Resize if image is too large (max 1024px on longest side)
    if (imageInfo.width > 1024 || imageInfo.height > 1024) {
      const maxDimension = 1024;
      const aspectRatio = imageInfo.width / imageInfo.height;
      
      if (imageInfo.width > imageInfo.height) {
        manipulateOptions.push({
          resize: {
            width: maxDimension,
            height: Math.round(maxDimension / aspectRatio)
          }
        });
      } else {
        manipulateOptions.push({
          resize: {
            width: Math.round(maxDimension * aspectRatio),
            height: maxDimension
          }
        });
      }
    }
    
    // Apply optimizations
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      manipulateOptions,
      {
        compress: 0.8, // 80% quality
        format: ImageManipulator.SaveFormat.JPEG
      }
    );
    
    console.log('✅ Image optimized successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Image optimization error:', error);
    // Return original if optimization fails
    return { uri: imageUri };
  }
};

/**
 * Create and upload thumbnail
 * @param {string} imageUri - Original image URI
 * @param {string} userId - User ID
 * @param {number} timestamp - Upload timestamp
 * @returns {Promise<string>} Thumbnail download URL
 */
const createAndUploadThumbnail = async (imageUri, userId, timestamp) => {
  try {
    console.log('🔄 Creating thumbnail...');
    
    // Create thumbnail (200x200)
    const thumbnail = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 200, height: 200 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );
    
    // Upload thumbnail
    const thumbnailPath = `${STORAGE_PATHS.THUMBNAILS}/${userId}/thumb_${timestamp}.jpg`;
    const thumbnailRef = ref(storage, thumbnailPath);
    
    const response = await fetch(thumbnail.uri);
    const blob = await response.blob();
    
    const uploadResult = await uploadBytes(thumbnailRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        userId: userId,
        type: 'thumbnail',
        uploadedAt: new Date().toISOString()
      }
    });
    
    const thumbnailURL = await getDownloadURL(uploadResult.ref);
    console.log('✅ Thumbnail created and uploaded');
    
    return thumbnailURL;
    
  } catch (error) {
    console.warn('⚠️ Thumbnail creation failed:', error);
    return null; // Non-critical, continue without thumbnail
  }
};

/**
 * Delete image from Firebase Storage
 * @param {string} storagePath - Storage path of the image
 * @returns {Promise<boolean>} Success status
 */
export const deleteImage = async (storagePath) => {
  try {
    console.log('🗑️ Deleting image from Firebase Storage...');
    
    const imageRef = ref(storage, storagePath);
    await deleteObject(imageRef);
    
    console.log('✅ Image deleted successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Firebase Storage delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Get storage usage statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Storage statistics
 */
export const getStorageStats = async (userId) => {
  try {
    // Note: Firebase Storage doesn't provide direct API for storage stats
    // This would need to be implemented via Firebase Admin SDK on the backend
    // For now, return placeholder data
    return {
      totalImages: 0,
      totalSize: 0,
      lastUpload: null
    };
  } catch (error) {
    console.error('❌ Storage stats error:', error);
    return null;
  }
};

/**
 * Batch upload multiple images
 * @param {Array} imageUris - Array of image URIs
 * @param {string} userId - User ID
 * @param {string} type - Image type
 * @returns {Promise<Array>} Array of upload results
 */
export const batchUploadImages = async (imageUris, userId, type = 'scan') => {
  try {
    console.log(`🔄 Starting batch upload of ${imageUris.length} images...`);
    
    const uploadPromises = imageUris.map((uri, index) => 
      uploadImage(uri, userId, type, { batchIndex: index })
    );
    
    const results = await Promise.allSettled(uploadPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
    
    console.log(`✅ Batch upload completed: ${successful.length} successful, ${failed.length} failed`);
    
    return {
      successful,
      failed,
      totalCount: imageUris.length,
      successCount: successful.length,
      failureCount: failed.length
    };
    
  } catch (error) {
    console.error('❌ Batch upload error:', error);
    throw new Error(`Batch upload failed: ${error.message}`);
  }
};

export default {
  uploadImage,
  deleteImage,
  getStorageStats,
  batchUploadImages,
  STORAGE_PATHS
};
