const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const ReceivedInventory = require('../models/ReceivedInventory');
const cashLedgerController = require('./cashLedgerController');

exports.createTransaction = async (req, res) => {
  try {
    const {
      transactionType,
      transactionSubtype,
      customerId,
      issueItems,
      receiptItems,
      paymentDetails,
      gstDetails,
      issueTotalWeight,
      issueTotalPurity,
      issueTotalAmount,
      receiptTotalWeight,
      receiptTotalPurity,
      receiptTotalAmount,
      finalAmount,
      balanceAmount,
      goldRate,
      description,
      paymentMode,
      goldPaymentWeight,
      goldPaymentPurity,
      goldConvertedAmount,
      oldBalanceBefore,
      oldBalanceAfter,
      advanceBalanceBefore,
      advanceBalanceAfter,
      convertedGram,
      collectedAmount,
      outstandingAmount,
      outstandingGram,
      status,
    } = req.body;

    // 1. Create the transaction
    const newTransaction = await Transaction.create({
      transactionType,
      transactionSubtype,
      customerId,
      issueItems,
      receiptItems,
      paymentDetails,
      gstDetails,
      issueTotalWeight,
      issueTotalPurity,
      issueTotalAmount,
      receiptTotalWeight,
      receiptTotalPurity,
      receiptTotalAmount,
      finalAmount,
      balanceAmount,
      goldRate,
      description,
      paymentMode,
      goldPaymentWeight,
      goldPaymentPurity,
      goldConvertedAmount,
      oldBalanceBefore,
      oldBalanceAfter,
      advanceBalanceBefore,
      advanceBalanceAfter,
      convertedGram,
      collectedAmount,
      outstandingAmount,
      outstandingGram,
      status,
    });

    // 2. Update Stock quantities for issued items and Log Movements
    if (issueItems && issueItems.length > 0) {
      for (const item of issueItems) {
        if (item.stockId) {
          const countToDeduct = Math.abs(item.count || 1);
          
          // Decrement stock quantity
          const updatedStock = await Stock.findByIdAndUpdate(
            item.stockId, 
            { $inc: { quantity: -countToDeduct } },
            { new: true }
          );

          // If stock hits 0, mark as unavailable
          if (updatedStock && updatedStock.quantity <= 0) {
            updatedStock.isAvailable = false;
            // Prevent negative quantities
            if (updatedStock.quantity < 0) updatedStock.quantity = 0;
            await updatedStock.save();
          }

          // Create Movement Log
          await StockMovement.create({
            stockId: item.stockId,
            transactionId: newTransaction._id,
            movementType: 'ISSUE',
            quantity: countToDeduct,
            weight: item.weight,
            customerId: customerId,
            customerType: transactionType,
            transactionType: transactionType,
          });
        }
      }
    }

    // 2.5 Log Received Items separately into ReceivedInventory
    if (receiptItems && receiptItems.length > 0) {
      const receivedDocs = receiptItems.map(item => ({
        receiptNumber: item.billNo,
        customerId: customerId,
        transactionId: newTransaction._id,
        receiptType: item.receiptType,
        weight: item.weight,
        lessWeight: item.less,
        actualTouch: item.actualTouch,
        takenTouch: item.takenTouch,
        purity: item.purity,
        amount: item.amount,
        status: 'AVAILABLE'
      }));
      await ReceivedInventory.insertMany(receivedDocs);
    }

    // 2.6 Log Cash Payment to Cash Ledger
    if (paymentDetails && paymentDetails.mode === 'Cash' && paymentDetails.amount > 0) {
      await cashLedgerController.addLedgerEntry({
        type: 'IN',
        amount: paymentDetails.amount,
        source: `${transactionType} Cash Payment`,
        referenceId: newTransaction._id,
        referenceModel: 'Transaction',
        description: `Cash received during ${transactionType} transaction`,
        createdBy: req.user ? req.user._id : undefined
      });
    }

    // 3. Update Customer Balance and Date securely
    // We update the customer with the exact calculated values passed from the frontend engine
    // ensuring the before/after match what the user saw on the summary screen.
    const customerUpdate = { 
      lastTransactionDate: new Date() 
    };

    if (typeof oldBalanceAfter === 'number' && typeof advanceBalanceAfter === 'number') {
      customerUpdate.oldBalance = oldBalanceAfter;
      customerUpdate.advance = advanceBalanceAfter;
    }

    // Add incrementing fields for tracking
    const customerInc = {
      transactionCount: 1,
      totalPurchaseAmount: issueTotalAmount || 0,
      totalReceiptAmount: receiptTotalAmount || 0,
    };

    await Customer.findByIdAndUpdate(customerId, {
      $set: customerUpdate,
      $inc: customerInc
    });

    res.status(201).json({
      success: true,
      data: newTransaction,
    });
  } catch (error) {
    console.error('Create Transaction Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('customerId', 'customerName phoneNumber address customerType');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Get Transaction Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getTransactionsByCustomer = async (req, res) => {
  try {
    const transactions = await Transaction.find({ customerId: req.params.customerId })
      .populate('customerId', 'customerName phoneNumber')
      .lean();
      
    const Settlement = require('../models/Settlement');
    const settlements = await Settlement.find({ customerId: req.params.customerId })
      .populate('originalTransactionId', '_id')
      .lean();

    const history = [
      ...transactions.map(t => ({ ...t, historyType: 'BILL' })),
      ...settlements.map(s => ({ ...s, historyType: 'SETTLEMENT' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Customer Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('customerId', 'customerName phoneNumber customerType')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('getAllTransactions Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getRecentTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('customerId', 'customerName phoneNumber customerType')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('getRecentTransactions Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.markPrinted = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $inc: { printedCount: 1 }, $set: { lastPrintedAt: new Date() } },
      { new: true }
    );
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('markPrinted Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
