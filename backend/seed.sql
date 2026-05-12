-- ============================================================
-- KINGSLEY PRIVATE BANK — SEED DATA
-- ============================================================

USE kingsley_bank;

-- Passwords are hashed using bcrypt: 'Test@1234' for customer, 'Banker@123' for banker, 'Admin@123' for admin
-- Note: Replace with actual bcrypt hashes if you want login to work out-of-the-box in the Node.js backend.
-- The hash below is for 'Test@1234'
SET @test_hash = '$2a$10$C8H6UjT.wXgX07QfL1M/u.Y9yK9rJXZ7F.8zQkVQ/hFqM/5r.7sTy'; 
-- Hash for 'Banker@123'
SET @banker_hash = '$2a$10$hhZgSHajrm99pNSQl5/fGunHSQnwajExyOe2Wvg5bjy1n5YNLYQLu';
-- Hash for 'Admin@123'
SET @admin_hash = '$2a$10$qg8eaxcIegLQfHsUIQ8vweV4kKgnTwRFM78ZNO5.Y3b9fqwB5fPf6';

INSERT INTO users (full_name, username, email, mobile, password_hash, role, gender, dob, address, occupation, annual_income, kyc_status) VALUES
('Rahul Joshi', 'rahul', 'rahul.joshi@email.com', '+91 9876543210', @test_hash, 'customer', 'Male', '1990-05-14', 'Indore, MP', 'Software Engineer', 660000.00, 'verified'),
('Sonia Sharma', 'sonia', 'sonia.sharma@email.com', '+91 9876543211', @test_hash, 'customer', 'Female', '1985-11-20', 'Bhopal, MP', 'Doctor', 1200000.00, 'verified'),
('Banker One', 'banker1', 'banker1@kingsleybank.com', '+91 8888888888', @banker_hash, 'banker', 'Male', '1980-01-01', 'Bank Branch', 'Banker', 800000.00, 'verified'),
('Admin Master', 'admin', 'admin@kingsleybank.com', '+91 9999999999', @admin_hash, 'admin', 'Other', '1975-01-01', 'HQ', 'Admin', 1500000.00, 'verified');

INSERT INTO accounts (user_id, account_number, account_type, balance, opened_date) VALUES
(1, 'XXXX-XXXX-4821', 'savings', 124500.00, '2017-01-15'),
(1, 'XXXX-XXXX-7734', 'current', 45200.00, '2020-03-10'),
(2, 'XXXX-XXXX-9912', 'savings', 850000.00, '2015-06-22');

INSERT INTO transactions (account_id, reference_number, type, amount, balance_after, description, transfer_type, txn_date) VALUES
(1, 'TXN8821049', 'debit', 3200.00, 124500.00, 'Online Shopping – Flipkart', 'UPI', '2026-04-10 10:15:00'),
(1, 'TXN8820931', 'debit', 5000.00, 127700.00, 'UPI Transfer – Ankit Mehta', 'UPI', '2026-04-08 14:30:00'),
(1, 'TXN8819840', 'credit', 320.00, 132700.00, 'Interest Credit', 'system', '2026-04-05 02:00:00'),
(1, 'TXN8818200', 'credit', 55000.00, 132380.00, 'Salary Credit – XYZ Corp', 'NEFT', '2026-04-01 09:00:00');

INSERT INTO loans (user_id, loan_id_str, loan_type, principal_amount, interest_rate, tenure_years, monthly_emi, amount_paid, amount_remaining, start_date, status) VALUES
(1, 'KPB-HL-00291', 'Home Loan', 2000000.00, 8.50, 20, 22000.00, 900000.00, 1100000.00, '2017-01-15', 'active'),
(1, 'KPB-CL-00854', 'Car Loan', 500000.00, 9.20, 5, 10500.00, 360000.00, 140000.00, '2022-03-20', 'active');
