const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../db');

// @route   GET /api/accounts
router.get('/', auth, async (req, res) => {
    try {
        const [accounts] = await pool.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.id]);
        res.json({ success: true, accounts });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
