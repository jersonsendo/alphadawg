package com.cit.vetclinic.api;

import com.cit.vetclinic.model.AuditEvent;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.repository.AuditEventRepository;
import com.cit.vetclinic.repository.PaymentRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class OperationsApiController {
    private final AuditEventRepository auditEvents;
    private final PaymentRepository payments;

    public OperationsApiController(AuditEventRepository auditEvents, PaymentRepository payments) {
        this.auditEvents = auditEvents;
        this.payments = payments;
    }

    @GetMapping("/audit")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<AuditEventResponse> auditEvents() {
        return auditEvents.findTop100ByOrderByOccurredAtDesc().stream()
                .map(AuditEventResponse::from)
                .toList();
    }

    @GetMapping(value = "/reports/payments.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public ResponseEntity<String> paidPaymentsReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (from.isAfter(to) || to.equals(LocalDate.MAX) || ChronoUnit.DAYS.between(from, to) > 366) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a valid date range of no more than 366 days.");
        }

        List<Payment> results = payments.findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
                from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        StringBuilder csv = new StringBuilder(
                "Receipt,Pet,Invoice items,Amount (PHP),Payment method,Paid at\r\n");
        for (Payment payment : results) {
            String invoiceItems = payment.getItems().stream()
                    .map(item -> item.getDescription() + " x" + item.getQuantity())
                    .collect(Collectors.joining("; "));
            csv.append(row(payment.getReceiptNo(), payment.getPet().getLabel(), invoiceItems,
                    payment.getAmount(), payment.getPaymentMethod(), payment.getPaidAt()));
        }
        String filename = "clinic-payments-" + from + "-to-" + to + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(csv.toString());
    }

    private static String row(Object... values) {
        return java.util.Arrays.stream(values)
                .map(OperationsApiController::cell)
                .collect(Collectors.joining(",")) + "\r\n";
    }

    private static String cell(Object value) {
        String text = Objects.toString(value, "");
        int firstNonWhitespace = 0;
        while (firstNonWhitespace < text.length() && Character.isWhitespace(text.charAt(firstNonWhitespace))) {
            firstNonWhitespace++;
        }
        if (firstNonWhitespace < text.length()
                && "=+-@\t\r".indexOf(text.charAt(firstNonWhitespace)) >= 0) {
            text = "'" + text;
        }
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    public record AuditEventResponse(Long id, String actor, String method, String requestPath,
                                     int responseStatus, java.time.LocalDateTime occurredAt) {
        static AuditEventResponse from(AuditEvent event) {
            return new AuditEventResponse(event.getId(), event.getActor(), event.getMethod(),
                    event.getRequestPath(), event.getResponseStatus(), event.getOccurredAt());
        }
    }
}
