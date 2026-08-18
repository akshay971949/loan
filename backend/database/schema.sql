-- Loan Management System - MySQL Schema (multi-company hierarchy)
-- SUPER_ADMIN (you) -> manages Companies -> each Company has its own Admin + Staff

CREATE DATABASE IF NOT EXISTS loan_management CHARACTER SET utf8mb4;
USE loan_management;

-- Companies (tenants) - created by the Super Admin
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users: super_admin (no company), admin (owns a company), staff (belongs to a company), customer (borrower)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin','staff','customer') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Customers: profile / KYC details. Belongs to a company; linked to a user login (nullable)
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  user_id INT UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(255),
  id_proof_type VARCHAR(50),
  id_proof_number VARCHAR(100),
  occupation VARCHAR(100),
  monthly_income DECIMAL(12,2),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Loans
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  customer_id INT NOT NULL,
  loan_type VARCHAR(50) DEFAULT 'Personal',
  principal_amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL COMMENT 'Monthly interest rate, percent',
  tenure_months INT NOT NULL,
  emi_amount DECIMAL(14,2) NOT NULL,
  start_date DATE NOT NULL,
  status ENUM('active','closed','defaulted') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- EMI schedule / tracking
CREATE TABLE IF NOT EXISTS emis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  emi_number INT NOT NULL,
  due_date DATE NOT NULL,
  emi_amount DECIMAL(14,2) NOT NULL,
  principal_component DECIMAL(14,2) NOT NULL,
  interest_component DECIMAL(14,2) NOT NULL,
  paid_amount DECIMAL(14,2) DEFAULT 0,
  paid_date DATE NULL,
  status ENUM('pending','paid','overdue','partial') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

CREATE INDEX idx_emis_due_date ON emis(due_date);
CREATE INDEX idx_emis_status ON emis(status);
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_company ON loans(company_id);
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_users_company ON users(company_id);
