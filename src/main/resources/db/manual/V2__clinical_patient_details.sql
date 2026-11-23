ALTER TABLE pet
    ADD COLUMN birth_date DATE NULL,
    ADD COLUMN sex VARCHAR(16) NULL,
    ADD COLUMN color VARCHAR(80) NULL,
    ADD COLUMN microchip_number VARCHAR(80) NULL,
    ADD COLUMN weight_kg DECIMAL(6, 2) NULL,
    ADD COLUMN allergies VARCHAR(1000) NULL,
    ADD COLUMN medical_alerts VARCHAR(1000) NULL;

ALTER TABLE medical_record
    ADD COLUMN weight_kg DECIMAL(6, 2) NULL,
    ADD COLUMN temperature_c DECIMAL(4, 1) NULL,
    ADD COLUMN heart_rate_bpm INT NULL,
    ADD COLUMN respiratory_rate_bpm INT NULL,
    ADD COLUMN medications VARCHAR(2000) NULL,
    ADD COLUMN follow_up_date DATE NULL;
