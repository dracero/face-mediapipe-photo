// Simple test script to verify database functionality
import { supabase } from './public/lib/database.js';

async function testDatabase() {
  try {
    console.log('🧪 Starting database test...');
    
    // Initialize database
    console.log('📦 Initializing database...');
    await window.initializeDatabase();
    console.log('✅ Database initialized');
    
    // Test creating a person
    console.log('👤 Testing person creation...');
    const personResult = await supabase.from('people').insert({ name: 'Test Person' });
    console.log('Person creation result:', personResult);
    
    if (personResult.error) {
      throw new Error('Failed to create person: ' + personResult.error.message);
    }
    
    // Test getting all people
    console.log('📋 Testing people retrieval...');
    const peopleResult = await supabase.from('people').select('*');
    console.log('People retrieval result:', peopleResult);
    
    if (peopleResult.error) {
      throw new Error('Failed to get people: ' + peopleResult.error.message);
    }
    
    console.log('🎉 All tests passed!');
    console.log('Database is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test if this is the main module
if (typeof window !== 'undefined') {
  window.testDatabase = testDatabase;
}

export { testDatabase };