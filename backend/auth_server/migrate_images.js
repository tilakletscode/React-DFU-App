const mongoose = require('mongoose');
const Prediction = require('./models/Prediction');

// Connect to MongoDB
mongoose.connect('mongodb+srv://Tester:Tester_2025@cluster0.cjqggjq.mongodb.net/healthcare-ml-app?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Find predictions that don't have imageUrl or have local://no-image
    const predictions = await Prediction.find({
      $or: [
        { imageUrl: { $exists: false } },
        { imageUrl: 'local://no-image' },
        { imageUrl: null }
      ]
    });
    
    console.log(`Found ${predictions.length} predictions without proper imageUrl`);
    
    // Update each prediction
    for (const prediction of predictions) {
      // Check if there's imagePath in the scanContext or notes
      let imageData = null;
      
      // Look for base64 data in scanContext notes
      if (prediction.scanContext?.notes) {
        const notes = prediction.scanContext.notes;
        if (notes.length > 100 && notes.includes('data:image')) {
          imageData = notes;
        }
      }
      
      // If no image data found, set to local://no-image
      if (!imageData) {
        imageData = 'local://no-image';
      }
      
      // Update the prediction
      prediction.imageUrl = imageData;
      await prediction.save();
      
      console.log(`Updated prediction ${prediction._id} with imageUrl: ${imageData.substring(0, 50)}...`);
    }
    
    console.log('Migration completed');
    process.exit(0);
  })
  .catch(console.error);
