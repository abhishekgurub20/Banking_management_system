const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    const { fullName, username, email, mobile, password, accountType, gender, dob, address } = req.body;

    try {
        // Check user
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
        if (users.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Create user
            const [userResult] = await connection.query(
                `INSERT INTO users (full_name, username, email, mobile, password_hash, gender, dob, address) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [fullName, username, email, mobile, passwordHash, gender || null, dob || null, address || null]
            );

            const userId = userResult.insertId;
            const accSavings = `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`;
            const accCurrent = `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`;

            const savingsBal = 0;
            const currentBal = 0;

            // Create both accounts automatically to match the UI expectations
            await connection.query(
                `INSERT INTO accounts (user_id, account_number, account_type, balance, opened_date) VALUES (?, ?, 'savings', ?, CURDATE())`,
                [userId, accSavings, savingsBal]
            );
            await connection.query(
                `INSERT INTO accounts (user_id, account_number, account_type, balance, opened_date) VALUES (?, ?, 'current', ?, CURDATE())`,
                [userId, accCurrent, currentBal]
            );

            await connection.commit();
            connection.release();

            // Return JWT
            const payload = { user: { id: userId, role: 'customer' } };
            jwt.sign(payload, process.env.JWT_SECRET || 'KingsleyPrivateBank_SuperSecret_JWT_Key_2026', { expiresIn: '7d' }, (err, token) => {
                if (err) throw err;
                res.json({ success: true, token, role: 'customer' });
            });

        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
        if (users.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid Credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid Credentials' });
        }

        const payload = { user: { id: user.id, role: user.role } };

        jwt.sign(payload, process.env.JWT_SECRET || 'KingsleyPrivateBank_SuperSecret_JWT_Key_2026', { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ success: true, token, role: user.role, name: user.full_name });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
