const Stock = require('../models/Stock');

// ─── Create Stock ────────────────────────────────────────────────────────────
exports.createStock = async (req, res) => {
  try {
    const {
      designName,
      itemName,
      supplierName,
      category,
      purity,
      grossWeight,
      netWeight,
      buyingTouch,
      quantity,
      notes,
    } = req.body;

    const stock = new Stock({
      designName,
      itemName: itemName?.trim() || '',
      supplierName,
      category,
      purity,
      grossWeight: parseFloat(grossWeight) || 0,
      netWeight: parseFloat(netWeight) || 0,
      buyingTouch: parseFloat(buyingTouch) || 0,
      quantity: parseInt(quantity) || 1,
      notes,
      createdBy: req.user._id,
    });

    await stock.save();

    res.status(201).json({
      success: true,
      message: 'Stock item created successfully',
      data: stock,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('createStock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating stock' });
  }
};

// ─── Get All Stock (paginated, search, filter) ───────────────────────────────
exports.getAllStock = async (req, res) => {
  try {
    const {
      search = '',
      category = 'All',
      page = 1,
      limit = 50,
    } = req.query;

    const query = { isActive: true, isAvailable: { $ne: false } };

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Search filter
    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { designName: regex },
        { itemNumber: regex },
        { category: regex },
        { itemName: regex },
        { barcode: regex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Stock.countDocuments(query);

    const stocks = await Stock.find(query)
      .sort({ designName: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    // Group by designName
    const grouped = {};
    stocks.forEach((item) => {
      const key = item.designName.toUpperCase();
      if (!grouped[key]) {
        grouped[key] = {
          designName: item.designName,
          records: [],
          totalQty: 0,
          totalNetWeight: 0,
        };
      }
      grouped[key].records.push(item);
      grouped[key].totalQty += item.quantity;
      grouped[key].totalNetWeight += item.netWeight * item.quantity;
    });

    const groupedArray = Object.values(grouped).map((g) => ({
      ...g,
      totalNetWeight: parseFloat(g.totalNetWeight.toFixed(3)),
    }));

    res.json({
      success: true,
      data: groupedArray,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getAllStock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching stock' });
  }
};

// ─── Get Stock Summary ────────────────────────────────────────────────────────
exports.getStockSummary = async (req, res) => {
  try {
    const result = await Stock.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalNetWeight: { $sum: { $multiply: ['$netWeight', '$quantity'] } },
        },
      },
    ]);

    // Count distinct design names
    const designCount = await Stock.distinct('designName', { isActive: true });

    const summary =
      result.length > 0
        ? {
            totalDesigns: designCount.length,
            totalQuantity: result[0].totalQuantity,
            totalNetWeight: parseFloat(result[0].totalNetWeight.toFixed(3)),
          }
        : { totalDesigns: 0, totalQuantity: 0, totalNetWeight: 0 };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('getStockSummary error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching summary' });
  }
};

// ─── Get Single Stock ─────────────────────────────────────────────────────────
exports.getStockById = async (req, res) => {
  try {
    const stock = await Stock.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate('createdBy', 'name');

    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock item not found' });
    }

    res.json({ success: true, data: stock });
  } catch (error) {
    console.error('getStockById error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching stock item' });
  }
};

// Get stock by barcode
exports.getStockByBarcode = async (req, res) => {
  try {
    const stock = await Stock.findOne({ barcode: req.params.barcode });
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Item not found for this barcode' });
    }
    res.json({ success: true, data: stock });
  } catch (error) {
    console.error('Get Stock by Barcode Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Update Stock ─────────────────────────────────────────────────────────────
exports.updateStock = async (req, res) => {
  try {
    const {
      designName,
      itemName,
      supplierName,
      category,
      purity,
      grossWeight,
      netWeight,
      buyingTouch,
      quantity,
      notes,
    } = req.body;

    const stock = await Stock.findOne({ _id: req.params.id, isActive: true });
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock item not found' });
    }

    if (designName !== undefined) stock.designName = designName;
    if (itemName !== undefined) stock.itemName = itemName;
    if (supplierName !== undefined) stock.supplierName = supplierName;
    if (category !== undefined) stock.category = category;
    if (purity !== undefined) stock.purity = purity;
    if (grossWeight !== undefined) stock.grossWeight = parseFloat(grossWeight);
    if (netWeight !== undefined) stock.netWeight = parseFloat(netWeight);
    if (buyingTouch !== undefined) stock.buyingTouch = parseFloat(buyingTouch);
    if (quantity !== undefined) stock.quantity = parseInt(quantity);
    if (notes !== undefined) stock.notes = notes;

    await stock.save();

    res.json({
      success: true,
      message: 'Stock item updated successfully',
      data: stock,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('updateStock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating stock' });
  }
};

// ─── Delete Stock (soft delete) ───────────────────────────────────────────────
exports.deleteStock = async (req, res) => {
  try {
    const stock = await Stock.findOne({ _id: req.params.id, isActive: true });
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock item not found' });
    }

    stock.isActive = false;
    await stock.save();

    res.json({ success: true, message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('deleteStock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error deleting stock' });
  }
};
