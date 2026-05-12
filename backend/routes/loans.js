const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../db');

// @route   GET /api/loans
router.get('/', auth, async (req, res) => {
    try {
        const [loans] = await pool.query('SELECT * FROM loans WHERE user_id = ? ORDER BY applied_at DESC', [req.user.id]);
        res.json({ success: true, loans });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/loans/apply
router.post('/apply', auth, async (req, res) => {
    const { loanType, loanAmount, tenureYears, annualIncome, purpose } = req.body;

    try {
        const loanIdStr = 'KPB-APP-' + Math.floor(Math.random()*90000+10000);
        // default rate
        let interestRate = 8.5;
        if(loanType.includes('Car')) interestRate = 9.2;
        if(loanType.includes('Education')) interestRate = 7.8;
        if(loanType.includes('Personal')) interestRate = 11.5;

        await pool.query(
            `INSERT INTO loans (user_id, loan_id_str, loan_type, principal_amount, interest_rate, tenure_years, annual_income, purpose, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, loanIdStr, loanType, loanAmount, interestRate, tenureYears, annualIncome, purpose, 'pending']
        );

        res.json({ success: true, message: 'Loan application submitted successfully', loanId: loanIdStr });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
