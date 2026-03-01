// Grade descriptions and suggestions for ulcer classification
export const gradeDescriptions = {
  "0": {
    grade: "0",
    description: "No open ulcer. Foot at risk due to deformity, callus, or redness.",
    suggestion: "No ulcer present. Begin preventive care: daily foot inspection, proper footwear, and blood sugar control.",
    patientSuggestion: "No ulcer detected. Continue preventive care with daily foot inspection, proper footwear, and blood sugar control.",
    professionalSuggestion: "No ulcer present. Recommend preventive care: daily foot inspection, proper footwear, and blood sugar control."
  },
  "1": {
    grade: "1", 
    description: "Superficial ulcer involving only skin layers.",
    suggestion: "Superficial wound detected. Clean the area, apply sterile dressing, and consult a healthcare provider.",
    patientSuggestion: "Superficial wound detected. Clean the area, apply sterile dressing, and consult a healthcare provider immediately.",
    professionalSuggestion: "Superficial ulcer identified. Recommend wound cleaning, sterile dressing, and medical consultation."
  },
  "2": {
    grade: "2",
    description: "Ulcer penetrates deeper into tendon, ligament, or joint capsule.", 
    suggestion: "Deep tissue involvement. Offload pressure from the foot and seek medical wound care immediately.",
    patientSuggestion: "Deep tissue involvement detected. Offload pressure from the foot and seek medical wound care immediately.",
    professionalSuggestion: "Deep ulcer with tissue involvement. Immediate pressure offloading and specialized wound care required."
  },
  "3": {
    grade: "3",
    description: "Ulcer with infection: abscess, osteomyelitis, or joint sepsis.",
    suggestion: "Infection present. Requires urgent medical evaluation, possible antibiotics, and imaging.",
    patientSuggestion: "Infection detected. Requires urgent medical evaluation, possible antibiotics, and imaging studies.",
    professionalSuggestion: "Infected ulcer identified. Urgent medical evaluation, antibiotic therapy, and diagnostic imaging recommended."
  },
  "4": {
    grade: "4", 
    description: "Partial gangrene of toes or forefoot.",
    suggestion: "Gangrene detected. Immediate hospital referral required for vascular assessment and surgical planning.",
    patientSuggestion: "Gangrene detected. Immediate hospital referral required for vascular assessment and surgical planning.",
    professionalSuggestion: "Partial gangrene identified. Immediate hospital referral for vascular assessment and surgical intervention planning."
  },
  "5": {
    grade: "5",
    description: "Extensive gangrene involving the entire foot.",
    suggestion: "Severe tissue damage. Emergency care needed. Surgical intervention likely.",
    patientSuggestion: "Severe tissue damage detected. Emergency care needed immediately. Surgical intervention likely required.",
    professionalSuggestion: "Extensive gangrene involving entire foot. Emergency intervention required with surgical planning."
  }
};

// Helper function to get grade info based on prediction
export const getGradeInfo = (prediction, userRole = 'patient') => {
  console.log('🔍 getGradeInfo called with:', JSON.stringify(prediction, null, 2));
  console.log('🔍 Prediction type:', typeof prediction);
  console.log('🔍 Prediction keys:', prediction ? Object.keys(prediction) : 'null');
  
  let grade = null;
  
  // Extract grade from different possible formats
  if (typeof prediction === 'string') {
    console.log('🔍 Processing string prediction:', prediction);
    // Check if it's a direct grade
    if (gradeDescriptions[prediction]) {
      grade = prediction;
      console.log('🔍 Found direct grade match:', grade);
    } else {
      // Try to extract grade from class name like "class_0", "grade_1", "Grade 4", etc.
      const gradeMatch = prediction.match(/(?:class_|grade_|Grade\s+)(\d)/i);
      if (gradeMatch) {
        grade = gradeMatch[1];
        console.log('🔍 Extracted grade from string:', grade);
      }
    }
  } else if (prediction && typeof prediction === 'object') {
    console.log('🔍 Processing object prediction');
    
    // Check if this is a nested prediction object (database format)
    if (prediction.prediction && typeof prediction.prediction === 'object') {
      console.log('🔍 Found nested prediction object, processing inner prediction');
      const innerPrediction = prediction.prediction;
      
      // Try predicted_class first (for direct ML responses)
      if (innerPrediction.predicted_class) {
        console.log('🔍 Found predicted_class:', innerPrediction.predicted_class);
        const gradeMatch = innerPrediction.predicted_class.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from predicted_class:', grade);
        } else if (gradeDescriptions[innerPrediction.predicted_class]) {
          grade = innerPrediction.predicted_class;
          console.log('🔍 Found direct grade match in predicted_class:', grade);
        }
      }
      
      // Try class field (for database format) if no grade found yet
      if (!grade && innerPrediction.class) {
        console.log('🔍 Found class:', innerPrediction.class);
        const gradeMatch = innerPrediction.class.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from class:', grade);
        } else if (gradeDescriptions[innerPrediction.class]) {
          grade = innerPrediction.class;
          console.log('🔍 Found direct grade match in class:', grade);
        } else {
          console.log('🔍 No match found for class:', innerPrediction.class);
        }
      }
      
      // Try grade field (for database format) if no grade found yet
      if (!grade && innerPrediction.grade) {
        console.log('🔍 Found grade:', innerPrediction.grade);
        const gradeMatch = innerPrediction.grade.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from grade field:', grade);
        } else if (gradeDescriptions[innerPrediction.grade]) {
          grade = innerPrediction.grade;
          console.log('🔍 Found direct grade match in grade field:', grade);
        } else {
          console.log('🔍 No match found for grade:', innerPrediction.grade);
        }
      }
    } else {
      // Direct prediction object (not nested)
      console.log('🔍 Processing direct prediction object');
      
      // Try predicted_class first (for direct ML responses)
      if (prediction.predicted_class) {
        console.log('🔍 Found predicted_class:', prediction.predicted_class);
        const gradeMatch = prediction.predicted_class.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from predicted_class:', grade);
        } else if (gradeDescriptions[prediction.predicted_class]) {
          grade = prediction.predicted_class;
          console.log('🔍 Found direct grade match in predicted_class:', grade);
        }
      }
      
      // Try class field (for database format) if no grade found yet
      if (!grade && prediction.class) {
        console.log('🔍 Found class:', prediction.class);
        const gradeMatch = prediction.class.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from class:', grade);
        } else if (gradeDescriptions[prediction.class]) {
          grade = prediction.class;
          console.log('🔍 Found direct grade match in class:', grade);
        } else {
          console.log('🔍 No match found for class:', prediction.class);
        }
      }
      
      // Try grade field (for database format) if no grade found yet
      if (!grade && prediction.grade) {
        console.log('🔍 Found grade:', prediction.grade);
        const gradeMatch = prediction.grade.match(/(?:class_|grade_|Grade\s+)(\d)/i);
        if (gradeMatch) {
          grade = gradeMatch[1];
          console.log('🔍 Extracted grade from grade field:', grade);
        } else if (gradeDescriptions[prediction.grade]) {
          grade = prediction.grade;
          console.log('🔍 Found direct grade match in grade field:', grade);
        } else {
          console.log('🔍 No match found for grade:', prediction.grade);
        }
      }
    }
  }

  // Default to grade 0 if no grade found
  if (!grade || !gradeDescriptions[grade]) {
    console.log('🔍 No grade found, defaulting to 0');
    console.log('🔍 Available grade descriptions keys:', Object.keys(gradeDescriptions));
    console.log('🔍 Current grade value:', grade);
    grade = "0";
  }
  
  console.log('🔍 Final grade selected:', grade);

  const gradeInfo = gradeDescriptions[grade];
  
  // Return appropriate suggestion based on user role
  const suggestion = userRole === 'patient' 
    ? gradeInfo.patientSuggestion 
    : gradeInfo.professionalSuggestion;

  return {
    grade: gradeInfo.grade,
    description: gradeInfo.description,
    suggestion: suggestion,
    severity: getSeverityLevel(grade),
    color: getSeverityColor(grade)
  };
};

// Helper function to get severity level
const getSeverityLevel = (grade) => {
  switch(grade) {
    case "0": return "Low Risk";
    case "1": return "Mild";
    case "2": return "Moderate"; 
    case "3": return "Severe";
    case "4": return "Critical";
    case "5": return "Emergency";
    default: return "Unknown";
  }
};

// Helper function to get severity color
const getSeverityColor = (grade) => {
  switch(grade) {
    case "0": return "#27ae60"; // Green
    case "1": return "#f39c12"; // Orange
    case "2": return "#e67e22"; // Dark Orange
    case "3": return "#e74c3c"; // Red
    case "4": return "#8e44ad"; // Purple
    case "5": return "#2c3e50"; // Dark Blue
    default: return "#95a5a6"; // Gray
  }
};

// Legacy function for backward compatibility
export const getGradeDescription = (prediction) => {
  return getGradeInfo(prediction);
};