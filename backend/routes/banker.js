const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const pool = require('../db');

// ─── DASHBOARD ────────────────────────────────────────────────
router.get('/dashboard', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const [[{ pending_loans }]]      = await pool.query('SELECT COUNT(*) as pending_loans FROM loans WHERE status="pending"');
        const [[{ under_review }]]       = await pool.query('SELECT COUNT(*) as under_review FROM loans WHERE status="under_review"');
        const [[{ pending_kyc }]]        = await pool.query('SELECT COUNT(*) as pending_kyc FROM users WHERE kyc_status="pending" AND role="customer"');
        const [[{ my_reviewed }]]        = await pool.query('SELECT COUNT(*) as my_reviewed FROM loans WHERE banker_id=? AND reviewed_at >= CURDATE()', [req.user.id]);
        const [[{ total_customers }]]    = await pool.query('SELECT COUNT(*) as total_customers FROM users WHERE role="customer"');
        const [[{ pending_deposits }]]   = await pool.query('SELECT COUNT(*) as pending_deposits FROM deposit_requests WHERE status="pending"');
        const [[{ my_deposits }]]        = await pool.query('SELECT COUNT(*) as my_deposits FROM deposit_requests WHERE banker_id=?', [req.user.id]);

        const [recent_loans] = await pool.query(
            `SELECT l.id, l.loan_id_str, l.loan_type, l.principal_amount, l.status, l.applied_at, u.full_name
             FROM loans l JOIN users u ON l.user_id = u.id
             WHERE l.status IN ('pending','under_review') ORDER BY l.applied_at ASC LIMIT 5`
        );
        res.json({ success: true, stats: { pending_loans, under_review, pending_kyc, my_reviewed, total_customers, pending_deposits, my_deposits }, recent_loans });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── CUSTOMERS ────────────────────────────────────────────────
router.get('/customers', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const { search } = req.query;
        let query = `SELECT u.id, u.full_name, u.email, u.mobile, u.kyc_status, u.status, u.created_at,
                            COUNT(a.id) as account_count
                     FROM users u LEFT JOIN accounts a ON a.user_id = u.id
                     WHERE u.role='customer'`;
        const params = [];
        if (search) { query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        query += ' GROUP BY u.id ORDER BY u.created_at DESC';
        const [customers] = await pool.query(query, params);
        res.json({ success: true, customers });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/customers/:id', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, full_name, username, email, mobile, gender, dob, address, occupation, annual_income, kyc_status, status, created_at FROM users WHERE id=? AND role='customer'`,
            [req.params.id]
        );
        if (!users.length) return res.status(404).json({ success: false, message: 'Customer not found' });
        const [accounts] = await pool.query('SELECT id, account_number, account_type, balance, status, opened_date FROM accounts WHERE user_id=?', [req.params.id]);
        const [loans] = await pool.query('SELECT loan_id_str, loan_type, principal_amount, status, applied_at FROM loans WHERE user_id=? ORDER BY applied_at DESC', [req.params.id]);
        res.json({ success: true, customer: users[0], accounts, loans });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ─── LOANS ────────────────────────────────────────────────────
router.get('/loans', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT l.*, u.full_name, u.email, u.mobile FROM loans l JOIN users u ON l.user_id = u.id`;
        const params = [];
        if (status) { query += ' WHERE l.status = ?'; params.push(status); }
        else { query += ' WHERE l.status IN ("pending","under_review")'; }
        query += ' ORDER BY l.applied_at ASC';
        const [loans] = await pool.query(query, params);
        res.json({ success: true, loans });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/loans/:id/review', [auth, roleCheck('banker')], async (req, res) => {
    const { status, banker_notes } = req.body;
    const validStatuses = ['approved', 'rejected', 'under_review', 'active'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    try {
        const extra = (status === 'approved' || status === 'active') ? ', start_date = CURDATE(), reviewed_at = NOW()' : ', reviewed_at = NOW()';
        await pool.query(`UPDATE loans SET status=?, banker_notes=?, banker_id=? ${extra} WHERE id=?`, [status, banker_notes || null, req.user.id, req.params.id]);
        // Notify user
        const [loans] = await pool.query('SELECT user_id, loan_id_str, loan_type FROM loans WHERE id=?', [req.params.id]);
        if (loans.length) {
            const l = loans[0];
            const icons = { approved: '✅', rejected: '❌', under_review: '🔍', active: '✅' };
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
                [l.user_id, `Loan ${status.replace('_',' ')}`,
                 `Your ${l.loan_type} loan (${l.loan_id_str}) has been marked as ${status.replace('_',' ')}.${banker_notes ? ' Notes: '+banker_notes : ''}`,
                 status === 'approved' || status === 'active' ? 'success' : status === 'rejected' ? 'error' : 'info']
            );
        }
        res.json({ success: true, message: `Loan marked as ${status}` });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── KYC ──────────────────────────────────────────────────────
router.get('/kyc', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const [kyc] = await pool.query(
            `SELECT id, full_name, email, mobile, gender, dob, address, occupation, annual_income, kyc_status, created_at
             FROM users WHERE kyc_status='pending' AND role='customer' ORDER BY created_at ASC`
        );
        res.json({ success: true, kyc });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/kyc/:id/approve', [auth, roleCheck('banker')], async (req, res) => {
    try {
        await pool.query("UPDATE users SET kyc_status='verified' WHERE id=? AND role='customer'", [req.params.id]);
        await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
            [req.params.id, 'KYC Verified ✅', 'Your KYC verification has been approved. You now have full access to all banking services.', 'success']);
        res.json({ success: true, message: 'KYC approved successfully' });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/kyc/:id/reject', [auth, roleCheck('banker')], async (req, res) => {
    try {
        await pool.query("UPDATE users SET kyc_status='rejected' WHERE id=? AND role='customer'", [req.params.id]);
        await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)',
            [req.params.id, 'KYC Rejected ❌', 'Your KYC verification was rejected. Please contact your branch for assistance.', 'error']);
        res.json({ success: true, message: 'KYC rejected' });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ─── DEPOSIT REQUESTS ─────────────────────────────────────────
// GET /api/banker/deposit-requests — my requests
router.get('/deposit-requests', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT dr.*, u.full_name as customer_name, u.email as customer_email,
                    a.account_number, a.account_type
             FROM deposit_requests dr
             JOIN users u ON dr.user_id = u.id
             JOIN accounts a ON dr.account_id = a.id
             WHERE dr.banker_id = ?
             ORDER BY dr.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, requests });
    } catch (err) { res.status(500).send('Server Error'); }
});

// POST /api/banker/deposit-requests — create new deposit request
router.post('/deposit-requests', [auth, roleCheck('banker')], async (req, res) => {
    const { userId, accountId, amount, reason } = req.body;
    if (!userId || !accountId || !amount || !reason) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });
    try {
        // Verify account belongs to user
        const [accounts] = await pool.query('SELECT id FROM accounts WHERE id=? AND user_id=?', [accountId, userId]);
        if (!accounts.length) return res.status(400).json({ success: false, message: 'Account does not belong to this user' });

        await pool.query(
            'INSERT INTO deposit_requests (user_id, account_id, banker_id, amount, reason) VALUES (?,?,?,?,?)',
            [userId, accountId, req.user.id, amount, reason]
        );
        res.json({ success: true, message: 'Deposit request submitted for admin approval' });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// GET /api/banker/user-accounts/:userId — get accounts for a user (for deposit form)
router.get('/user-accounts/:userId', [auth, roleCheck('banker')], async (req, res) => {
    try {
        const [accounts] = await pool.query(
            'SELECT id, account_number, account_type, balance FROM accounts WHERE user_id=? AND status="active"',
            [req.params.userId]
        );
        res.json({ success: true, accounts });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
