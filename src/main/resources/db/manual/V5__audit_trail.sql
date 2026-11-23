CREATE TABLE audit_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor VARCHAR(254) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_path VARCHAR(300) NOT NULL,
    response_status INT NOT NULL,
    occurred_at DATETIME(6) NOT NULL
);

CREATE INDEX idx_audit_events_occurred_at ON audit_events (occurred_at);
