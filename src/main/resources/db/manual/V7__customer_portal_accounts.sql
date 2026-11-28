ALTER TABLE clinic_users
    MODIFY COLUMN role TINYINT DEFAULT NULL CHECK (role BETWEEN 0 AND 2),
    ADD COLUMN owner_id BIGINT NULL,
    ADD CONSTRAINT fk_clinic_users_owner
        FOREIGN KEY (owner_id) REFERENCES pet_owners (id);
