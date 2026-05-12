const pool = require('./db');
async function backfill() {
    try {
        const [users] = await pool.query('SELECT u.id FROM users u WHERE u.role="customer"');
        for (const user of users) {
             const [accs] = await pool.query('SELECT * FROM accounts WHERE user_id = ? AND account_type = "savings"', [user.id]);
             if (accs.length === 0) {
                  const accNo = `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`;
                  await pool.query('INSERT INTO accounts (user_id, account_number, account_type, opened_date, balance) VALUES (?, ?, "savings", CURDATE(), 0)', [user.id, accNo]);
                  console.log(`Added Savings Account to User ${user.id}`);
             }
        }
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}
backfill();
