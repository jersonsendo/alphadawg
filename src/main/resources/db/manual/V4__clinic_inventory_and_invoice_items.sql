CREATE TABLE clinic_products (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(80) NULL,
    quantity_on_hand INT NOT NULL,
    reorder_level INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL
);

CREATE TABLE payment_lines (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL,
    product_id BIGINT NULL,
    description VARCHAR(300) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_payment_lines_payment FOREIGN KEY (payment_id) REFERENCES payment (id),
    CONSTRAINT fk_payment_lines_product FOREIGN KEY (product_id) REFERENCES clinic_products (id)
);
