const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const pool = require('../db');

// ─── DASHBOARD ────────────────────────────────────────────────
// GET /api/admin/dashboard
router.get('/dashboard', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const [[{ total_customers }]] = await pool.query('SELECT COUNT(*) as total_customers FROM users WHERE role="customer"');
        const [[{ total_bankers }]]   = await pool.query('SELECT COUNT(*) as total_bankers FROM users WHERE role="banker"');
        const [[{ total_loans }]]     = await pool.query('SELECT COUNT(*) as total_loans FROM loans');
        const [[{ pending_loans }]]   = await pool.query('SELECT COUNT(*) as pending_loans FROM loans WHERE status="pending"');
        const [[{ total_txns }]]      = await pool.query('SELECT COUNT(*) as total_txns FROM transactions');
        const [[{ total_deposits }]]  = await pool.query('SELECT COALESCE(SUM(balance),0) as total_deposits FROM accounts');
        const [[{ pending_kyc }]]     = await pool.query('SELECT COUNT(*) as pending_kyc FROM users WHERE kyc_status="pending" AND role="customer"');

        // Recent registrations
        const [recent_users] = await pool.query(
            'SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
        );
        // Recent transactions
        const [recent_txns] = await pool.query(
            `SELECT t.*, u.full_name FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             JOIN users u ON a.user_id = u.id
             ORDER BY t.txn_date DESC LIMIT 5`
        );

        res.json({
            success: true,
            stats: { total_customers, total_bankers, total_loans, pending_loans, total_txns, total_deposits, pending_kyc },
            recent_users,
            recent_txns
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── USERS ────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const { role, status, search } = req.query;
        let query = 'SELECT id, full_name, username, email, mobile, role, status, kyc_status, created_at FROM users WHERE 1=1';
        const params = [];
        if (role)   { query += ' AND role = ?';   params.push(role); }
        if (status) { query += ' AND status = ?'; params.push(status); }
        if (search) {
            query += ' AND (full_name LIKE ? OR email LIKE ? OR username LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC';
        const [users] = await pool.query(query, params);
        res.json({ success: true, users });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET /api/admin/users/:id
router.get('/users/:id', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, full_name, username, email, mobile, role, gender, dob, address, occupation, annual_income, kyc_status, status, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// PUT /api/admin/users/:id  — edit user
router.put('/users/:id', [auth, roleCheck('admin')], async (req, res) => {
    const { full_name, email, mobile, role, kyc_status, status } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name=?, email=?, mobile=?, role=?, kyc_status=?, status=? WHERE id=?',
            [full_name, email, mobile, role, kyc_status, status, req.params.id]
        );
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// PUT /api/admin/users/:id/status  — block/unblock/activate
router.put('/users/:id/status', [auth, roleCheck('admin')], async (req, res) => {
    const { status } = req.body;
    if (!['active', 'inactive', 'blocked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    try {
        await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', [auth, roleCheck('admin')], async (req, res) => {
    try {
        // Prevent deleting yourself
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }
        await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── BANKERS ──────────────────────────────────────────────────
// GET /api/admin/bankers
router.get('/bankers', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const [bankers] = await pool.query(
            `SELECT u.id, u.full_name, u.username, u.email, u.mobile, u.status, u.created_at,
                    COUNT(l.id) as reviewed_loans
             FROM users u
             LEFT JOIN loans l ON l.banker_id = u.id
             WHERE u.role='banker'
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, bankers });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// POST /api/admin/add-banker — Create new banker
router.post('/add-banker', [auth, roleCheck('admin')], async (req, res) => {
    const { fullName, username, email, mobile, password } = req.body;
    if (!fullName || !username || !email || !mobile || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    try {
        // Check duplicate
        const [existing] = await pool.query('SELECT id FROM users WHERE email=? OR username=?', [email, username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or Email already exists' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        await pool.query(
            `INSERT INTO users (full_name, username, email, mobile, password_hash, role, kyc_status, status)
             VALUES (?, ?, ?, ?, ?, 'banker', 'verified', 'active')`,
            [fullName, username, email, mobile, passwordHash]
        );
        res.json({ success: true, message: 'Banker account created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── LOANS ────────────────────────────────────────────────────
// GET /api/admin/loans
router.get('/loans', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT l.*, u.full_name, u.email FROM loans l JOIN users u ON l.user_id = u.id`;
        const params = [];
        if (status) { query += ' WHERE l.status = ?'; params.push(status); }
        query += ' ORDER BY l.applied_at DESC';
        const [loans] = await pool.query(query, params);
        res.json({ success: true, loans });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// PUT /api/admin/loans/:id/status — approve / reject loan
router.put('/loans/:id/status', [auth, roleCheck('admin')], async (req, res) => {
    const { status, banker_notes } = req.body;
    const validStatuses = ['pending', 'under_review', 'approved', 'rejected', 'active', 'closed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    try {
        // If approving, set start_date
        let extra = '';
        const params = [status, banker_notes || null, req.user.id];
        if (status === 'approved' || status === 'active') {
            extra = ', start_date = CURDATE(), reviewed_at = NOW()';
        } else {
            extra = ', reviewed_at = NOW()';
        }
        params.push(req.params.id);
        await pool.query(
            `UPDATE loans SET status=?, banker_notes=?, banker_id=? ${extra} WHERE id=?`,
            params
        );
        res.json({ success: true, message: `Loan ${status} successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ─── TRANSACTIONS ─────────────────────────────────────────────
// GET /api/admin/transactions
router.get('/transactions', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const { type, search, limit = 100 } = req.query;
        let query = `SELECT t.*, a.account_number, u.full_name FROM transactions t
                     JOIN accounts a ON t.account_id = a.id
                     JOIN users u ON a.user_id = u.id WHERE 1=1`;
        const params = [];
        if (type)   { query += ' AND t.type = ?'; params.push(type); }
        if (search) {
            query += ' AND (u.full_name LIKE ? OR t.reference_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY t.txn_date DESC LIMIT ?';
        params.push(parseInt(limit));
        const [txns] = await pool.query(query, params);
        res.json({ success: true, txns });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// ─── DEPOSIT REQUESTS ─────────────────────────────────────────
// GET /api/admin/deposit-requests
router.get('/deposit-requests', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT dr.*, u.full_name as customer_name, u.email as customer_email,
                            a.account_number, a.account_type, a.balance as current_balance,
                            b.full_name as banker_name
                     FROM deposit_requests dr
                     JOIN users u ON dr.user_id = u.id
                     JOIN accounts a ON dr.account_id = a.id
                     JOIN users b ON dr.banker_id = b.id`;
        const params = [];
        if (status) { query += ' WHERE dr.status=?'; params.push(status); }
        query += ' ORDER BY dr.created_at DESC';
        const [requests] = await pool.query(query, params);
        res.json({ success: true, requests });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// PUT /api/admin/deposit-requests/:id/approve
router.put('/deposit-requests/:id/approve', [auth, roleCheck('admin')], async (req, res) => {
    const { admin_notes } = req.body;
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const [requests] = await connection.query(
            'SELECT * FROM deposit_requests WHERE id=? AND status="pending" FOR UPDATE', [req.params.id]
        );
        if (!requests.length) throw new Error('Request not found or already processed');
        const req_data = requests[0];

        // Credit amount to account
        const [accounts] = await connection.query('SELECT * FROM accounts WHERE id=? FOR UPDATE', [req_data.account_id]);
        if (!accounts.length) throw new Error('Account not found');
        const acc = accounts[0];
        const newBal = Number(acc.balance) + Number(req_data.amount);
        await connection.query('UPDATE accounts SET balance=? WHERE id=?', [newBal, acc.id]);

        // Transaction record
        const refNum = 'DEP' + Date.now().toString().slice(-10);
        await connection.query(
            `INSERT INTO transactions (account_id, reference_number, type, amount, balance_after, description, transfer_type)
             VALUES (?,?,?,?,?,?,?)`,
            [acc.id, refNum, 'credit', req_data.amount, newBal,
             `Admin Approved Deposit - ${req_data.reason}`, 'system']
        );

        // Update deposit request
        await connection.query(
            'UPDATE deposit_requests SET status="approved", admin_notes=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
            [admin_notes || null, req.user.id, req.params.id]
        );

        // Notify customer
        await connection.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
            [req_data.user_id, '💰 Amount Credited!',
             `₹${Number(req_data.amount).toLocaleString('en-IN')} has been deposited to your ${acc.account_type} account (${acc.account_number}). Ref: ${refNum}`,
             'success']
        );

        await connection.commit();
        connection.release();
        res.json({ success: true, message: 'Deposit approved and amount credited successfully', referenceNumber: refNum });
    } catch (err) {
        await connection.rollback();
        connection.release();
        res.status(400).json({ success: false, message: err.message });
    }
});

// PUT /api/admin/deposit-requests/:id/reject
router.put('/deposit-requests/:id/reject', [auth, roleCheck('admin')], async (req, res) => {
    const { admin_notes } = req.body;
    try {
        const [requests] = await pool.query('SELECT * FROM deposit_requests WHERE id=? AND status="pending"', [req.params.id]);
        if (!requests.length) return res.status(400).json({ success: false, message: 'Request not found or already processed' });
        await pool.query(
            'UPDATE deposit_requests SET status="rejected", admin_notes=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
            [admin_notes || null, req.user.id, req.params.id]
        );
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
            [requests[0].user_id, '❌ Deposit Request Rejected',
             `A deposit request of ₹${Number(requests[0].amount).toLocaleString('en-IN')} was rejected by admin.${admin_notes ? ' Reason: '+admin_notes : ''}`,
             'error']
        );
        res.json({ success: true, message: 'Deposit request rejected' });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── ADMIN STATS ENHANCED ─────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', [auth, roleCheck('admin')], async (req, res) => {
    try {
        const [[{ pending_deposits }]] = await pool.query('SELECT COUNT(*) as pending_deposits FROM deposit_requests WHERE status="pending"');
        res.json({ success: true, pending_deposits });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;

