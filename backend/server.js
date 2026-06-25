const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/mongodb');
const authRoutes = require('./routes/authRoutes');
const otpRoutes = require('./routes/otpRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const stockRoutes = require('./routes/stockRoutes');
const customerRoutes = require('./routes/customerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const cashLedgerRoutes = require('./routes/cashLedgerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const chitRoutes = require('./routes/chitRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const lineStockRoutes = require('./routes/lineStockRoutes');
const settingRoutes = require('./routes/settingRoutes');
const { loadUsers } = require('./services/authStore');

dotenv.config();

// Initialize ENV users
loadUsers();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/cash-ledger', cashLedgerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/chits', chitRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/linestock', lineStockRoutes);
app.use('/api/settings', settingRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Sri Vaishnavi Jewellers API is running' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedDatabase();
});

const seedDatabase = async () => {
  try {
    const Settings = require('./models/Settings');
    const User = require('./models/User');
    const GoldRate = require('./models/GoldRate');
    const IssuedRecord = require('./models/IssuedRecord');

    const settingsExist = await Settings.findOne();
    if (!settingsExist) {
      await Settings.create({ appName: 'Sri Vaishnavi Jewellers', maxUsers: 6 });
      console.log('Settings seeded');
    }

    const superAdminExists = await User.findOne({ email: 'ragusuresh291@gmail.com' });
    if (!superAdminExists) {
      await User.create({
        name: 'Ragunath S',
        email: 'ragusuresh291@gmail.com',
        password: '123456',
        role: 'SuperAdmin',
      });
      console.log('Super Admin seeded: ragusuresh291@gmail.com');
    }

    const goldRateExists = await GoldRate.findOne();
    if (!goldRateExists) {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      await GoldRate.create({
        rate: 0,
        effectiveDate: `${day}-${month}-${year}`,
        updatedBy: 'System',
        updatedAt: now,
      });
      console.log('Gold Rate initialized');
    }
  } catch (error) {
    console.error('Seed Error:', error.message);
  }
};

