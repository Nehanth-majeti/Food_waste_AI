CREATE DATABASE IF NOT EXISTS food_waste_v4;
USE food_waste_v4;

CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('Admin','Hotel','NGO') NOT NULL,
    lat DECIMAL(10,8) DEFAULT NULL,
    lon DECIMAL(11,8) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    qty INT NOT NULL,
    expiry DATETIME NOT NULL,
    image VARCHAR(255),
    status ENUM('Available','Pending','Assigned','Delivered') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES Users(id)
);

CREATE TABLE Requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_id INT NOT NULL,
    item_id INT NOT NULL,
    status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ngo_id) REFERENCES Users(id),
    FOREIGN KEY (item_id) REFERENCES Items(id)
);

CREATE TABLE Delivery (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    ngo_id INT NOT NULL,
    status ENUM('Pending','InTransit','Delivered') DEFAULT 'Pending',
    route_path TEXT DEFAULT NULL,
    distance DECIMAL(8,2) DEFAULT NULL,
    estimated_time DECIMAL(8,2) DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES Items(id),
    FOREIGN KEY (ngo_id) REFERENCES Users(id)
);

CREATE TABLE Analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(20),
    food_saved INT DEFAULT 0,
    food_wasted INT DEFAULT 0,
    total_requests INT DEFAULT 0,
    total_deliveries INT DEFAULT 0
);

CREATE TABLE Prediction (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT,
    predicted_waste DECIMAL(8,2),
    prediction_date DATE,
    FOREIGN KEY (hotel_id) REFERENCES Users(id)
);
