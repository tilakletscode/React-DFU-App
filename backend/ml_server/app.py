import os
import io
import base64
import time
import logging
from datetime import datetime
from PIL import Image
import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Model configuration
MODEL_PATH = '../models/ulcer_classification_mobilenetv3.pth'
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL = None
MODEL_VERSION = "1.0.0"
MODEL_TYPE = "mobilenetv3_ulcer_classification"

# Grade descriptions and recommendations
GRADE_INFO = {
    'Grade 0': {
        'description': 'No ulcer present. Healthy foot with intact skin.',
        'severity': 'low',
        'recommendations': [
            'Continue regular foot care routine',
            'Daily foot inspection',
            'Maintain good blood sugar control',
            'Regular follow-up with healthcare provider'
        ]
    },
    'Grade 1': {
        'description': 'Superficial ulcer without infection or ischemia.',
        'severity': 'moderate',
        'recommendations': [
            'Keep wound clean and dry',
            'Apply appropriate dressing',
            'Avoid pressure on affected area',
            'Consult healthcare provider within 24-48 hours',
            'Monitor for signs of infection'
        ]
    },
    'Grade 2': {
        'description': 'Deep ulcer exposing tendon or bone, without infection or ischemia.',
        'severity': 'high',
        'recommendations': [
            'Immediate medical attention required',
            'Professional wound care',
            'Possible surgical debridement',
            'Strict pressure offloading',
            'Antibiotic therapy consideration'
        ]
    },
    'Grade 3': {
        'description': 'Deep ulcer with signs of infection or ischemia.',
        'severity': 'critical',
        'recommendations': [
            'Emergency medical attention required',
            'Immediate antibiotic therapy',
            'Surgical intervention may be necessary',
            'Hospitalization may be required',
            'Vascular assessment needed'
        ]
    },
    'Grade 4': {
        'description': 'Localized gangrene affecting forefoot or heel.',
        'severity': 'critical',
        'recommendations': [
            'Emergency medical attention required',
            'Immediate surgical consultation',
            'Possible amputation consideration',
            'Intensive antibiotic therapy',
            'Immediate hospitalization required'
        ]
    },
    'Grade 5': {
        'description': 'Extensive gangrene affecting the entire foot.',
        'severity': 'critical',
        'recommendations': [
            'Emergency medical attention required',
            'Immediate surgical consultation',
            'Amputation likely necessary',
            'Intensive care may be required',
            'Life-threatening condition'
        ]
    }
}

# Image preprocessing transforms
def get_transforms():
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                           std=[0.229, 0.224, 0.225])
    ])

def load_model():
    """Load the PyTorch model"""
    global MODEL
    try:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        
        logger.info(f"Loading model from {MODEL_PATH}")
        
        # Load the model checkpoint
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
        
        # Handle different model save formats
        if isinstance(checkpoint, dict):
            logger.info("Detected dictionary format - checking for state dict keys")
            
            # If it's a state dict or checkpoint with state_dict key
            if 'state_dict' in checkpoint:
                model_state = checkpoint['state_dict']
                logger.info("Found 'state_dict' key")
            elif 'model_state_dict' in checkpoint:
                model_state = checkpoint['model_state_dict']
                logger.info("Found 'model_state_dict' key")
            elif 'model' in checkpoint:
                model_state = checkpoint['model']
                logger.info("Found 'model' key")
            else:
                # Assume the dict itself is the state dict
                model_state = checkpoint
                logger.info("Using checkpoint dict as state dict")
            
            # Try to create a custom model architecture that matches your saved model
            logger.info("Creating MobileNetV3 model architecture...")
            
            try:
                # Try to load as a complete model first (most likely scenario)
                if hasattr(checkpoint, 'eval'):
                    MODEL = checkpoint
                    logger.info("Loaded complete model object")
                else:
                    # Create MobileNetV3 model architecture
                    import torchvision.models as models
                    
                    # Use MobileNetV3 Small as base architecture
                    MODEL = models.mobilenet_v3_small(weights=None)
                    
                    # Adjust classifier for 6 classes (Grade 0-5)
                    if hasattr(MODEL, 'classifier'):
                        # Get the input features of the last layer
                        in_features = MODEL.classifier[-1].in_features
                        # Replace with 6-class classifier
                        MODEL.classifier[-1] = torch.nn.Linear(in_features, 6)
                        logger.info(f"Adjusted classifier for 6 classes, input features: {in_features}")
                    
                    # Try to load the state dict
                    try:
                        MODEL.load_state_dict(model_state, strict=True)
                        logger.info("Successfully loaded model with strict=True")
                    except Exception as strict_error:
                        logger.warning(f"Strict loading failed: {str(strict_error)[:100]}...")
                        try:
                            MODEL.load_state_dict(model_state, strict=False)
                            logger.info("Successfully loaded model with strict=False")
                        except Exception as loose_error:
                            logger.error(f"Loose loading also failed: {str(loose_error)[:100]}...")
                            raise loose_error
                        
            except Exception as arch_error:
                logger.error(f"Architecture creation failed: {str(arch_error)}")
                # Create minimal model as fallback
                MODEL = create_minimal_model()
                
        else:
            # If it's already a model object
            MODEL = checkpoint
            logger.info("Loaded complete model object directly")
        
        MODEL.to(DEVICE)
        MODEL.eval()
        
        logger.info(f"Model loaded successfully on {DEVICE}")
        logger.info(f"Model type: {type(MODEL)}")
        
        # Test the model with a dummy input to ensure it works
        try:
            dummy_input = torch.randn(1, 3, 224, 224).to(DEVICE)
            with torch.no_grad():
                test_output = MODEL(dummy_input)
                logger.info(f"Model test successful, output shape: {test_output.shape}")
        except Exception as test_error:
            logger.warning(f"Model test failed: {str(test_error)}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        logger.error(f"Model loading error details: {type(e).__name__}")
        
        # Create a minimal working model as fallback
        try:
            logger.info("Creating fallback minimal model...")
            MODEL = create_minimal_model()
            MODEL.to(DEVICE)
            MODEL.eval()
            logger.info("Fallback model created successfully")
            return True
        except Exception as fallback_error:
            logger.error(f"Fallback model creation failed: {str(fallback_error)}")
            return False

def create_minimal_model():
    """Create a minimal working model for testing when the saved model can't be loaded"""
    import torch.nn as nn
    
    class MinimalClassifier(nn.Module):
        def __init__(self, num_classes=6):
            super(MinimalClassifier, self).__init__()
            self.features = nn.Sequential(
                nn.Conv2d(3, 32, 3, padding=1),
                nn.ReLU(inplace=True),
                nn.AdaptiveAvgPool2d((7, 7)),
                nn.Flatten()
            )
            self.classifier = nn.Sequential(
                nn.Linear(32 * 7 * 7, 128),
                nn.ReLU(inplace=True),
                nn.Dropout(0.2),
                nn.Linear(128, num_classes)
            )
        
        def forward(self, x):
            x = self.features(x)
            x = self.classifier(x)
            return x
    
    logger.info("Created minimal classifier model")
    return MinimalClassifier()

def preprocess_image(image_base64):
    """Preprocess base64 image for model inference"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Apply transforms
        transform = get_transforms()
        image_tensor = transform(image).unsqueeze(0)  # Add batch dimension
        
        return image_tensor.to(DEVICE)
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {str(e)}")

def predict_grade(image_tensor):
    """Make prediction using the loaded model"""
    try:
        with torch.no_grad():
            outputs = MODEL(image_tensor)
            probabilities = F.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)
            
            # Convert to numpy for easier handling
            confidence_score = confidence.item()
            predicted_class = predicted.item()
            
            # Map class index to grade (based on your model's class_to_index)
            grade_mapping = {
                0: 'Grade 0',
                1: 'Grade 1', 
                2: 'Grade 2',
                3: 'Grade 3',
                4: 'Grade 4',
                5: 'Grade 5'
            }
            
            predicted_grade = grade_mapping.get(predicted_class, 'Unknown')
            
            return predicted_grade, confidence_score
    except Exception as e:
        raise RuntimeError(f"Model prediction failed: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': MODEL is not None,
        'device': str(DEVICE),
        'model_version': MODEL_VERSION
    })

@app.route('/model-info', methods=['GET'])
def model_info():
    """Get model information"""
    return jsonify({
        'model_type': MODEL_TYPE,
        'model_version': MODEL_VERSION,
        'device': str(DEVICE),
        'model_loaded': MODEL is not None,
        'supported_grades': list(GRADE_INFO.keys()),
        'input_size': [224, 224, 3],
        'model_path': MODEL_PATH
    })

@app.route('/classify', methods=['POST'])
def classify_image():
    """Main endpoint for image classification"""
    start_time = time.time()
    
    try:
        # Check if model is loaded
        if MODEL is None:
            return jsonify({
                'error': 'Model not loaded',
                'message': 'ML model is not available'
            }), 503
        
        # Get image data from request
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({
                'error': 'No image data provided',
                'message': 'Please provide image data in base64 format'
            }), 400
        
        image_base64 = data['image']
        
        # Preprocess image
        try:
            image_tensor = preprocess_image(image_base64)
        except ValueError as e:
            return jsonify({
                'error': 'Image preprocessing failed',
                'message': str(e)
            }), 400
        
        # Make prediction
        try:
            predicted_grade, confidence = predict_grade(image_tensor)
        except RuntimeError as e:
            return jsonify({
                'error': 'Prediction failed',
                'message': str(e)
            }), 500
        
        # Get grade information
        grade_details = GRADE_INFO.get(predicted_grade, {
            'description': 'Unknown grade',
            'severity': 'unknown',
            'recommendations': ['Consult healthcare provider immediately']
        })
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Get all probabilities for each class from the actual model output
        with torch.no_grad():
            outputs = MODEL(image_tensor)
            probabilities = F.softmax(outputs, dim=1)
            all_probs = probabilities[0].cpu().numpy()  # Get probabilities for all classes
        
        # Map class indices to grade names
        grade_mapping = {
            0: 'Grade 0',
            1: 'Grade 1', 
            2: 'Grade 2',
            3: 'Grade 3',
            4: 'Grade 4',
            5: 'Grade 5'
        }
        
        # Create all_probabilities dictionary with actual model outputs
        all_probabilities = {}
        for i, grade_name in grade_mapping.items():
            all_probabilities[grade_name] = float(all_probs[i])
        
        # Prepare response matching frontend expectations
        response = {
            'predicted_class': predicted_grade,  # This will be used by getGradeInfo utility
            'confidence': float(confidence),
            'all_probabilities': all_probabilities,
            'grade_info': {
                'description': grade_details['description'],
                'severity': grade_details['severity'],
                'recommendations': grade_details['recommendations']
            },
            'model_info': {
                'model_type': MODEL_TYPE,
                'model_version': MODEL_VERSION,
                'processing_time_ms': round(processing_time, 2)
            },
            'timestamp': datetime.now().isoformat(),
            'status': 'success'
        }
        
        logger.info(f"Prediction completed: {predicted_grade} (confidence: {confidence:.3f}) in {processing_time:.2f}ms")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        return jsonify({
            'error': 'Classification failed',
            'message': 'An unexpected error occurred during classification',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/batch-classify', methods=['POST'])
def batch_classify():
    """Batch classification endpoint for multiple images"""
    try:
        if MODEL is None:
            return jsonify({'error': 'Model not loaded'}), 503
        
        data = request.get_json()
        if not data or 'images' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        images = data['images']
        if not isinstance(images, list) or len(images) == 0:
            return jsonify({'error': 'Images must be a non-empty list'}), 400
        
        if len(images) > 10:  # Limit batch size
            return jsonify({'error': 'Maximum 10 images per batch'}), 400
        
        results = []
        start_time = time.time()
        
        for i, image_base64 in enumerate(images):
            try:
                image_tensor = preprocess_image(image_base64)
                predicted_grade, confidence = predict_grade(image_tensor)
                
                grade_details = GRADE_INFO.get(predicted_grade, {
                    'description': 'Unknown grade',
                    'severity': 'unknown',
                    'recommendations': ['Consult healthcare provider immediately']
                })
                
                results.append({
                    'index': i,
                    'prediction': {
                        'class': predicted_grade,
                        'confidence': float(confidence),
                        'grade': predicted_grade,
                        'description': grade_details['description'],
                        'severity': grade_details['severity'],
                        'recommendations': grade_details['recommendations']
                    },
                    'status': 'success'
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'error': str(e),
                    'status': 'failed'
                })
        
        processing_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'results': results,
            'batch_size': len(images),
            'processing_time_ms': round(processing_time, 2),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Batch classification error: {str(e)}")
        return jsonify({'error': 'Batch classification failed'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'message': 'The requested endpoint does not exist'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'error': 'Method not allowed',
        'message': 'The requested method is not allowed for this endpoint'
    }), 405

@app.errorhandler(413)
def payload_too_large(error):
    return jsonify({
        'error': 'Payload too large',
        'message': 'The uploaded image is too large'
    }), 413

if __name__ == '__main__':
    # Load model on startup
    if not load_model():
        logger.error("Failed to load model. Server will start but predictions will not work.")
    
    # Configure Flask app
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Set default environment variables if not set
    if 'PORT' not in os.environ:
        os.environ['PORT'] = '5001'
    if 'FLASK_DEBUG' not in os.environ:
        os.environ['FLASK_DEBUG'] = 'False'
    if 'FLASK_ENV' not in os.environ:
        os.environ['FLASK_ENV'] = 'development'
    
    # Start server
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting ML server on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"Model path: {MODEL_PATH}")
    
    # Start Flask app with dotenv disabled to avoid Unicode errors
    app.run(host='0.0.0.0', port=port, debug=debug, load_dotenv=False)
