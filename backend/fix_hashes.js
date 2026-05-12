const pool = require('./db');
const bcrypt = require('bcryptjs');

async function fixHashes() {
    try {
        const bankerHash = bcrypt.hashSync('Banker@123', 10);
        const adminHash = bcrypt.hashSync('Admin@123', 10);

        await pool.query("UPDATE users SET password_hash = ? WHERE username = 'banker1'", [bankerHash]);
        console.log("Updated Banker1 hash successfully.");

        await pool.query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [adminHash]);
        console.log("Updated Admin hash successfully.");
        
        process.exit(0);
    } catch (e) {
        console.error("Error updating hashes", e);
        process.exit(1);
    }
}

fixHashes();
