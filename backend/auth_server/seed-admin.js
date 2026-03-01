const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mahesh:mahesh@cluster0.cjqggjq.mongodb.net/ml_healthcare?retryWrites=true&w=majority');
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@mlauth.com' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('📧 Email: admin@mlauth.com');
      console.log('🔑 Password: admin123');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@mlauth.com',
      phone: '+1234567890',
      name: 'System Administrator',
      firstName: 'System',
      lastName: 'Administrator',
      age: 30,
      gender: 'other',
      role: 'admin',
      password: hashedPassword,
      firebaseUid: 'admin-' + Date.now(),
      emailVerified: true,
      phoneVerified: true,
      isActive: true
    });

    await adminUser.save();
    console.log('🎉 Admin user created successfully!');
    console.log('📧 Email: admin@mlauth.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Username: admin');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
};

const createDoctorUser = async () => {
  try {
    // Check if doctor already exists
    const existingDoctor = await User.findOne({ email: 'doctor@mlauth.com' });
    if (existingDoctor) {
      console.log('✅ Doctor user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('doctor123', 12);

    // Create doctor user
    const doctorUser = new User({
      username: 'doctor',
      email: 'doctor@mlauth.com',
      phone: '+1234567891',
      name: 'Dr. Medical Expert',
      firstName: 'Medical',
      lastName: 'Expert',
      age: 35,
      gender: 'other',
      role: 'doctor',
      password: hashedPassword,
      firebaseUid: 'doctor-' + Date.now(),
      emailVerified: true,
      phoneVerified: true,
      isActive: true
    });

    await doctorUser.save();
    console.log('🎉 Doctor user created successfully!');
    console.log('📧 Email: doctor@mlauth.com');
    console.log('🔑 Password: doctor123');
    console.log('👤 Username: doctor');

  } catch (error) {
    console.error('❌ Error creating doctor user:', error);
  }
};

const seedUsers = async () => {
  await connectDB();
  await createAdminUser();
  await createDoctorUser();
  console.log('✅ Seeding completed');
  process.exit(0);
};

// Run seeding
seedUsers();
