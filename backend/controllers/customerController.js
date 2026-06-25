const Customer = require('../models/Customer');

// ─── Create Customer ──────────────────────────────────────────────────────────
exports.createCustomer = async (req, res) => {
  try {
    const {
      customerType,
      customerName,
      phoneNumber,
      shopName,
      dealerCompanyName,
      dealerCode,
      gstNumber,
      address,
      oldBalance,
      advance,
      remarks,
    } = req.body;

    // Type-specific required fields
    if (customerType === 'B2B' && !shopName?.trim()) {
      return res.status(400).json({ success: false, message: 'Shop Name is required for B2B customers' });
    }
    if (customerType === 'B2D' && !dealerCompanyName?.trim()) {
      return res.status(400).json({ success: false, message: 'Dealer Company Name is required for B2D customers' });
    }

    const customer = new Customer({
      customerType,
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      shopName: shopName?.trim() || '',
      dealerCompanyName: dealerCompanyName?.trim() || '',
      dealerCode: dealerCode?.trim() || '',
      gstNumber: gstNumber?.trim() || '',
      address: address.trim(),
      oldBalance: parseFloat(oldBalance) || 0,
      advance: parseFloat(advance) || 0,
      remarks: remarks?.trim() || '',
      createdBy: req.user._id,
    });

    let saved = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!saved && attempts < maxAttempts) {
      try {
        attempts++;
        await customer.save();
        saved = true;
      } catch (error) {
        // If it's a code duplicate conflict, clear the code so the pre-save hook generates a fresh one
        if (error.code === 11000 && attempts < maxAttempts) {
          customer.customerCode = undefined;
          continue;
        }
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A code conflict occurred multiple times. Please try again.',
      });
    }
    console.error('createCustomer error:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating customer' });
  }
};

// ─── Get All Customers ────────────────────────────────────────────────────────
exports.getAllCustomers = async (req, res) => {
  try {
    const { search = '', type = 'All', page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    if (type && type !== 'All') {
      query.customerType = type;
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: regex },
        { phoneNumber: regex },
        { customerCode: regex },
        { shopName: regex },
        { dealerCompanyName: regex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Customer.countDocuments(query);

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getAllCustomers error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching customers' });
  }
};

// ─── Get Customer By ID ───────────────────────────────────────────────────────
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate('createdBy', 'name');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('getCustomerById error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Update Customer ──────────────────────────────────────────────────────────
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isActive: true });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const fields = [
      'customerName', 'phoneNumber', 'shopName', 'dealerCompanyName',
      'dealerCode', 'gstNumber', 'address', 'oldBalance', 'advance', 'remarks',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        customer[field] = typeof req.body[field] === 'string'
          ? req.body[field].trim()
          : req.body[field];
      }
    });

    await customer.save();

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('updateCustomer error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating customer' });
  }
};

// ─── Delete Customer (soft) ───────────────────────────────────────────────────
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isActive: true });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    customer.isActive = false;
    await customer.save();
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('deleteCustomer error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Search Customers ─────────────────────────────────────────────────────────
exports.searchCustomers = async (req, res) => {
  try {
    const { q = '', type = 'All', limit = 20 } = req.query;
    const query = { isActive: true };

    if (type !== 'All') query.customerType = type;

    if (q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { customerName: regex },
        { phoneNumber: regex },
        { customerCode: regex },
        { shopName: regex },
        { dealerCompanyName: regex },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ customerName: 1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('searchCustomers error:', error.message);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// ─── Get Customers By Type ────────────────────────────────────────────────────
exports.getByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!['B2C', 'B2B', 'B2D', 'LINE_STOCKER'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid customer type' });
    }

    const query = { customerType: type, isActive: true };
    const total = await Customer.countDocuments(query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    res.json({
      success: true,
      data: customers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('getByType error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
