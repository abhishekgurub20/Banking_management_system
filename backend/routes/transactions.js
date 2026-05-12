const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const pool    = require('../db');

// ─── GET USER TRANSACTIONS ────────────────────────────────────
router.get('/', auth, async (req, res) => {
    try {
        const [accounts] = await pool.query('SELECT id FROM accounts WHERE user_id = ?', [req.user.id]);
        if (!accounts.length) return res.json({ success: true, transactions: [] });
        const accountIds = accounts.map(a => a.id);
        const [transactions] = await pool.query(
            `SELECT t.*, a.account_number FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             WHERE t.account_id IN (?) ORDER BY t.txn_date DESC LIMIT 100`,
            [accountIds]
        );
        res.json({ success: true, transactions });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── FUND TRANSFER ────────────────────────────────────────────
router.post('/transfer', auth, async (req, res) => {
    const { fromAccountId, toAccountNumber, amount, remarks, transferType } = req.body;
    if (!fromAccountId || !toAccountNumber || !amount) {
        return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });

    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        // Verify sender account
        const [fromAccounts] = await connection.query('SELECT * FROM accounts WHERE id=? AND user_id=? AND status="active" FOR UPDATE', [fromAccountId, req.user.id]);
        if (!fromAccounts.length) throw new Error('Source account not found or inactive');
        const fromAcc = fromAccounts[0];
        if (Number(fromAcc.balance) < Number(amount)) throw new Error('Insufficient funds in your account');

        // Find receiver account — try exact match first, then partial match (last 4 digits)
        let [toAccounts] = await connection.query('SELECT * FROM accounts WHERE account_number=? AND status="active" FOR UPDATE', [toAccountNumber]);
        if (!toAccounts.length) {
            // Try partial match: user might enter just last 4 digits like "4821" or with prefix like "XXXX-XXXX-4821"
            const trimmed = toAccountNumber.replace(/[^0-9]/g, '');
            if (trimmed.length >= 4) {
                const partial = `%${trimmed.slice(-4)}`;
                [toAccounts] = await connection.query('SELECT * FROM accounts WHERE account_number LIKE ? AND status="active" FOR UPDATE', [partial]);
            }
        }
        if (!toAccounts.length) throw new Error('Destination account not found. Please check the account number and try again. Available format: XXXX-XXXX-1234');
        const toAcc = toAccounts[0];
        if (toAcc.id === fromAcc.id) throw new Error('Cannot transfer to the same account');

        // Deduct from sender
        const newFromBal = Number(fromAcc.balance) - Number(amount);
        await connection.query('UPDATE accounts SET balance=? WHERE id=?', [newFromBal, fromAcc.id]);

        // Credit to receiver
        const newToBal = Number(toAcc.balance) + Number(amount);
        await connection.query('UPDATE accounts SET balance=? WHERE id=?', [newToBal, toAcc.id]);

        const refNumber = 'TXN' + Date.now().toString().slice(-10);

        // Debit record for sender
        await connection.query(
            `INSERT INTO transactions (account_id, reference_number, type, amount, balance_after, description, transfer_type, beneficiary_acc, remarks)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [fromAcc.id, refNumber, 'debit', amount, newFromBal, `Fund Transfer to ${toAccountNumber}`, transferType || 'NEFT', toAccountNumber, remarks || '']
        );

        // Credit record for receiver
        const refCredit = 'TXN' + (Date.now()+1).toString().slice(-10);
        await connection.query(
            `INSERT INTO transactions (account_id, reference_number, type, amount, balance_after, description, transfer_type, beneficiary_acc, remarks)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [toAcc.id, refCredit, 'credit', amount, newToBal, `Fund Received from ${fromAcc.account_number}`, transferType || 'NEFT', fromAcc.account_number, remarks || '']
        );

        // Notify receiver
        await connection.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
            [toAcc.user_id, '💰 Money Received',
             `₹${Number(amount).toLocaleString('en-IN')} credited to your account ${toAccountNumber} via ${transferType||'NEFT'}. Ref: ${refNumber}`,
             'success']
        );

        await connection.commit();
        connection.release();
        res.json({ success: true, message: 'Transfer successful!', referenceNumber: refNumber, newBalance: newFromBal });

    } catch (err) {
        await connection.rollback();
        connection.release();
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;
