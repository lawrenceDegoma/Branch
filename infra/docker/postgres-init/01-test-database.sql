-- Separate database for integration and end-to-end tests, so test runs never touch dev data.
CREATE DATABASE branch_test OWNER branch;
