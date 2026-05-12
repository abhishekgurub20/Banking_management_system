-- ============================================================
-- KINGSLEY PRIVATE BANK — FULL DATABASE SCHEMA
-- Run this in MySQL to create the entire database structure
-- ============================================================

CREATE DATABASE IF NOT EXISTS kingsley_bank CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kingsley_bank;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  mobile        VARCHAR(15)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer','banker','admin') NOT NULL DEFAULT 'customer',
  gender        ENUM('Male','Female','Other') DEFAULT NULL,
  dob           DATE DEFAULT NULL,
  address       TEXT DEFAULT NULL,
  occupation    VARCHAR(100) DEFAULT NULL,
  annual_income DECIMAL(15,2) DEFAULT 0,
  pan_number    VARCHAR(20) DEFAULT NULL,
  aadhaar_last4 VARCHAR(4)  DEFAULT NULL,
  kyc_status    ENUM('pending','verified','rejected') DEFAULT 'pending',
  status        ENUM('active','inactive','blocked') DEFAULT 'active',
  is_premium    BOOLEAN DEFAULT FALSE,
  tfa_enabled   BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- ACCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  account_type ENUM('savings','current') NOT NULL DEFAULT 'savings',
  balance      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ifsc_code    VARCHAR(15) DEFAULT 'KPB0001234',
  branch       VARCHAR(100) DEFAULT 'Indore Main Branch',
  status       ENUM('active','frozen','closed') DEFAULT 'active',
  opened_date  DATE DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  account_id       INT NOT NULL,
  reference_number VARCHAR(20) NOT NULL UNIQUE,
  type             ENUM('credit','debit') NOT NULL,
  amount           DECIMAL(15,2) NOT NULL,
  balance_after    DECIMAL(15,2) NOT NULL,
  description      VARCHAR(255) NOT NULL,
  transfer_type    ENUM('NEFT','RTGS','IMPS','UPI','internal','system') DEFAULT 'system',
  beneficiary_acc  VARCHAR(20) DEFAULT NULL,
  beneficiary_name VARCHAR(120) DEFAULT NULL,
  ifsc_code        VARCHAR(15) DEFAULT NULL,
  remarks          TEXT DEFAULT NULL,
  status           ENUM('completed','pending','failed') DEFAULT 'completed',
  txn_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- ============================================================
-- LOANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS loans (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  loan_id_str      VARCHAR(20) NOT NULL UNIQUE,
  loan_type        VARCHAR(50) NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_rate    DECIMAL(5,2) NOT NULL,
  tenure_years     INT NOT NULL,
  monthly_emi      DECIMAL(12,2) DEFAULT NULL,
  amount_paid      DECIMAL(15,2) DEFAULT 0.00,
  amount_remaining DECIMAL(15,2) DEFAULT NULL,
  annual_income    DECIMAL(15,2) DEFAULT NULL,
  purpose          TEXT DEFAULT NULL,
  next_due_date    DATE DEFAULT NULL,
  start_date       DATE DEFAULT NULL,
  end_date         DATE DEFAULT NULL,
  status           ENUM('pending','under_review','approved','rejected','active','closed') DEFAULT 'pending',
  banker_id        INT DEFAULT NULL,
  banker_notes     TEXT DEFAULT NULL,
  applied_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banker_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- OTP TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(120) NOT NULL,
  otp_hash   VARCHAR(255) NOT NULL,
  purpose    ENUM('password_reset','email_verify','tfa') DEFAULT 'password_reset',
  expires_at DATETIME NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (identifier, purpose)
);

-- ============================================================
-- LOGIN SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS login_sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- DEPOSIT REQUESTS TABLE (Banker creates, Admin approves)
-- ============================================================
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
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    TEXT NOT NULL,
  type       ENUM('info','success','warning','error') DEFAULT 'info',
  is_read    BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

