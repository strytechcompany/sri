/**
 * One-time script to clear all IssuedRecord documents from MongoDB.
 * Run: node scripts/clearRecords.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.collection('issuedrecords').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} issued record(s)`);

    const goldResult = await mongoose.connection.collection('goldrates').deleteMany({});
    console.log(`✅ Deleted ${goldResult.deletedCount} gold rate(s) — will be re-seeded fresh on next server start`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
