const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const pool    = require('../db');

// ─── GET USER PROFILE ─────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, full_name, username, email, mobile, role, gender, dob, address, occupation, annual_income, pan_number, kyc_status, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, profile: users[0] });
    } catch (err) { res.status(500).send('Server Error'); }
});

// ─── UPDATE PROFILE ───────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
    const { full_name, mobile, address, occupation, annual_income, gender, dob, pan_number } = req.body;
    try {
        await pool.query(
            'UPDATE users SET full_name=?, mobile=?, address=?, occupation=?, annual_income=?, gender=?, dob=?, pan_number=? WHERE id=?',
            [full_name, mobile, address, occupation, annual_income || 0, gender || null, dob || null, pan_number || null, req.user.id]
        );
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both fields required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    try {
        const [users] = await pool.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
        if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
        const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id]);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────
router.get('/notifications', auth, async (req, res) => {
    try {
        const [notifs] = await pool.query(
            'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        const [[{ unread }]] = await pool.query('SELECT COUNT(*) as unread FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]);
        res.json({ success: true, notifications: notifs, unread });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/notifications/read-all', auth, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
