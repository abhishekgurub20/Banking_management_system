const pool = require('./db');
require('dotenv').config();

async function createTables() {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS deposit_requests (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                user_id      INT NOT NULL,
                account_id   INT NOT NULL,
                banker_id    INT NOT NULL,
                amount       DECIMAL(15,2) NOT NULL,
                reason       TEXT NOT NULL,
                status       ENUM('pending','approved','rejected') DEFAULT 'pending',
                admin_notes  TEXT DEFAULT NULL,
                reviewed_by  INT DEFAULT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                reviewed_at  DATETIME DEFAULT NULL,
                FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id)  REFERENCES accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (banker_id)   REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ deposit_requests table created/verified');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                user_id    INT NOT NULL,
                title      VARCHAR(150) NOT NULL,
                message    TEXT NOT NULL,
                type       ENUM('info','success','warning','error') DEFAULT 'info',
                is_read    BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ notifications table created/verified');
        conn.release();
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        conn.release();
        process.exit(1);
    }
}

createTables();
