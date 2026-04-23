// Test script for server-side database functionality
import { DatabaseManager } from './src/lib/database/DatabaseManager.ts';

async function testServerDatabase() {
  try {
    console.log('🧪 Starting server database test...');
    
    // Get database manager instance
    const dbManager = DatabaseManager.getInstance();
    
    // Initialize database
    console.log('📦 Initializing database...');
    await dbManager.initialize();
    console.log('✅ Database initialized');
    
    // Test creating a person
    console.log('👤 Testing person creation...');
    const person = await dbManager.createPerson('Test Person');
    console.log('Created person:', person);
    
    // Test getting all people
    console.log('📋 Testing people retrieval...');
    const people = await dbManager.getAllPeople();
    console.log('Retrieved people:', people);
    
    // Test creating a photo (with dummy base64 data)
    console.log('📸 Testing photo creation...');
    const dummyPhotoData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
    const photo = await dbManager.createFacePhoto(person.id, dummyPhotoData);
    console.log('Created photo:', { id: photo.id, person_id: photo.person_id, size: photo.photo_data.length });
    
    // Test getting all photos
    console.log('🖼️ Testing photo retrieval...');
    const photos = await dbManager.getAllFacePhotos();
    console.log('Retrieved photos:', photos.map(p => ({ id: p.id, person_id: p.person_id, person_name: p.person_name })));
    
    // Test database stats
    console.log('📊 Testing database stats...');
    const stats = await dbManager.getStats();
    console.log('Database stats:', stats);
    
    // Close database
    await dbManager.close();
    
    console.log('🎉 All server tests passed!');
    console.log('Server database is working correctly');
    
  } catch (error) {
    console.error('❌ Server test failed:', error);
    process.exit(1);
  }
}

// Run the test
testServerDatabase();