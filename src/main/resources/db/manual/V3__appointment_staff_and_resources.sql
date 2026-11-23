ALTER TABLE appointment
    ADD COLUMN assigned_staff_id BIGINT NULL,
    ADD COLUMN duration_minutes INT NOT NULL DEFAULT 30,
    ADD COLUMN resource VARCHAR(80) NULL,
    ADD CONSTRAINT fk_appointment_assigned_staff
        FOREIGN KEY (assigned_staff_id) REFERENCES clinic_users (id);
