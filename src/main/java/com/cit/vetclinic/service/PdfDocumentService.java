package com.cit.vetclinic.service;

import com.cit.vetclinic.model.MedicalRecord;
import com.cit.vetclinic.model.Owner;
import com.cit.vetclinic.model.Payment;
import com.cit.vetclinic.model.PaymentLine;
import com.cit.vetclinic.model.Pet;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class PdfDocumentService {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public byte[] medicalRecord(Pet pet, MedicalRecord record) throws IOException {
        return createDocument("Medical record", writer -> {
            writePetDetails(writer, pet);
            writer.paragraph("Record date", format(record.getRecordDate()));
            writeClinicalDetails(writer, record);
            writer.paragraph("Diagnosis", record.getDiagnosis());
            writer.paragraph("Treatment", record.getTreatment());
            writer.paragraph("Notes", record.getNotes());
        });
    }

    public byte[] medicalHistory(Pet pet, List<MedicalRecord> records) throws IOException {
        return createDocument("Medical history", writer -> {
            writePetDetails(writer, pet);
            writer.section("Medical records (" + records.size() + ")");
            if (records.isEmpty()) {
                writer.paragraph("History", "No medical records are recorded for this pet.");
                return;
            }
            for (int index = 0; index < records.size(); index++) {
                MedicalRecord record = records.get(index);
                writer.section("Record " + (index + 1) + " - " + format(record.getRecordDate()));
                writeClinicalDetails(writer, record);
                writer.paragraph("Diagnosis", record.getDiagnosis());
                writer.paragraph("Treatment", record.getTreatment());
                if (record.getNotes() != null && !record.getNotes().isBlank()) {
                    writer.paragraph("Notes", record.getNotes());
                }
            }
        });
    }

    public byte[] paymentDocument(Payment payment) throws IOException {
        boolean paid = payment.getStatus() == Payment.Status.PAID;
        return createDocument(paid ? "Payment receipt" : "Bill / invoice", writer -> {
            writePetDetails(writer, payment.getPet());
            writer.paragraph(paid ? "Receipt number" : "Invoice number", paid
                    ? valueOr(payment.getReceiptNo(), "Not available")
                    : "INV-" + String.format("%06d", payment.getId()));
            if (payment.getItems().isEmpty()) {
                writer.paragraph("Description", payment.getDescription());
            } else {
                writer.section("Invoice items");
                for (PaymentLine item : payment.getItems()) {
                    writer.paragraph("Item", item.getDescription());
                    writer.paragraph("Quantity", String.valueOf(item.getQuantity()));
                    writer.paragraph("Unit price", "PHP " + item.getUnitPrice().toPlainString());
                    writer.paragraph("Line total", "PHP " + item.getLineTotal().toPlainString());
                }
            }
            writer.paragraph("Status", paid ? "PAID" : "UNPAID");
            if (paid) {
                writer.paragraph("Payment method", payment.getPaymentMethod());
                writer.paragraph("Paid on", format(payment.getPaidAt()));
            } else {
                writer.paragraph("Issued on", format(LocalDate.now()));
            }
            writer.total("Total", "PHP " + (payment.getAmount() == null ? "0.00" : payment.getAmount().toPlainString()));
        });
    }

    private static void writePetDetails(PdfWriter writer, Pet pet) throws IOException {
        writer.section("Pet and owner");
        writer.paragraph("Pet", pet.getName());
        writer.paragraph("Species", pet.getSpecies());
        writer.paragraph("Breed", pet.getBreed());
        writer.paragraph("Date of birth", format(pet.getBirthDate()));
        writer.paragraph("Sex", pet.getSex());
        writer.paragraph("Color", pet.getColor());
        writer.paragraph("Microchip", pet.getMicrochipNumber());
        writer.paragraph("Current weight (kg)", pet.getWeightKg() == null ? null : pet.getWeightKg().toPlainString());
        writer.paragraph("Allergies", pet.getAllergies());
        writer.paragraph("Medical alerts", pet.getMedicalAlerts());
        writer.paragraph("Owner", pet.getOwnerName());
        Owner owner = pet.getOwner();
        if (owner != null) {
            writer.paragraph("Owner email", owner.getEmail());
            writer.paragraph("Owner phone", owner.getPhone());
            writer.paragraph("Owner address", owner.getAddress());
        }
    }

    private static void writeClinicalDetails(PdfWriter writer, MedicalRecord record) throws IOException {
        writer.paragraph("Weight (kg)", record.getWeightKg() == null ? null : record.getWeightKg().toPlainString());
        writer.paragraph("Temperature (C)",
                record.getTemperatureC() == null ? null : record.getTemperatureC().toPlainString());
        writer.paragraph("Heart rate (bpm)",
                record.getHeartRateBpm() == null ? null : record.getHeartRateBpm().toString());
        writer.paragraph("Respiratory rate (breaths/min)",
                record.getRespiratoryRateBpm() == null ? null : record.getRespiratoryRateBpm().toString());
        writer.paragraph("Medications", record.getMedications());
        writer.paragraph("Follow-up date", format(record.getFollowUpDate()));
    }

    private static String format(LocalDate value) {
        return value == null ? "Not provided" : DATE.format(value);
    }

    private static String format(LocalDateTime value) {
        return value == null ? "Not provided" : DATE_TIME.format(value);
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static byte[] createDocument(String title, DocumentWriter content) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.getDocumentInformation().setTitle(title);
            document.getDocumentInformation().setAuthor("Alpha Dawgs Veterinary Clinic");
            PdfWriter writer = new PdfWriter(document, title);
            content.write(writer);
            writer.finish();
            document.save(output);
            return output.toByteArray();
        }
    }

    @FunctionalInterface
    private interface DocumentWriter {
        void write(PdfWriter writer) throws IOException;
    }

    private static final class PdfWriter {
        private static final float MARGIN = 52;
        private static final float CONTENT_WIDTH = PDRectangle.LETTER.getWidth() - MARGIN * 2;
        private static final float FOOTER_LIMIT = 58;
        private static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        private static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

        private final PDDocument document;
        private final String title;
        private final List<PDPage> pages = new ArrayList<>();
        private PDPage currentPage;
        private PDPageContentStream stream;
        private float y;

        private PdfWriter(PDDocument document, String title) throws IOException {
            this.document = document;
            this.title = title;
            newPage();
        }

        private void section(String text) throws IOException {
            ensureSpace(28);
            y -= 4;
            writeLine(text, BOLD, 12, 0);
            y -= 5;
        }

        private void paragraph(String label, String value) throws IOException {
            ensureSpace(32);
            writeLine(label, BOLD, 9, 0);
            y -= 13;
            List<String> lines = wrap(valueOr(value, "Not provided"), REGULAR, 10, CONTENT_WIDTH - 10);
            for (String line : lines) {
                ensureSpace(14);
                writeLine(line, REGULAR, 10, 10);
                y -= 14;
            }
            y -= 4;
        }

        private void total(String label, String value) throws IOException {
            ensureSpace(36);
            y -= 6;
            stream.setStrokingColor(0.35f, 0.43f, 0.38f);
            stream.moveTo(MARGIN, y);
            stream.lineTo(PDRectangle.LETTER.getWidth() - MARGIN, y);
            stream.stroke();
            y -= 22;
            writeLine(label + ": " + value, BOLD, 14, 0);
        }

        private void writeLine(String value, PDFont font, float size, float indent) throws IOException {
            String safeValue = supportedText(value, font);
            stream.beginText();
            stream.setFont(font, size);
            stream.newLineAtOffset(MARGIN + indent, y);
            stream.showText(safeValue);
            stream.endText();
            y -= size + 3;
        }

        private void ensureSpace(float height) throws IOException {
            if (y - height < FOOTER_LIMIT) newPage();
        }

        private void newPage() throws IOException {
            if (stream != null) stream.close();
            currentPage = new PDPage(PDRectangle.LETTER);
            document.addPage(currentPage);
            pages.add(currentPage);
            stream = new PDPageContentStream(document, currentPage);
            y = PDRectangle.LETTER.getHeight() - 54;
            writeLine("ALPHA DAWGS VETERINARY CLINIC", BOLD, 14, 0);
            y -= 4;
            writeLine(title, BOLD, 20, 0);
            y -= 5;
            writeLine("Generated " + DATE_TIME.format(LocalDateTime.now()), REGULAR, 9, 0);
            stream.setStrokingColor(0.35f, 0.43f, 0.38f);
            stream.moveTo(MARGIN, y - 2);
            stream.lineTo(PDRectangle.LETTER.getWidth() - MARGIN, y - 2);
            stream.stroke();
            y -= 20;
        }

        private void finish() throws IOException {
            if (stream != null) stream.close();
            for (int index = 0; index < pages.size(); index++) {
                try (PDPageContentStream footer = new PDPageContentStream(document, pages.get(index),
                        PDPageContentStream.AppendMode.APPEND, true, true)) {
                    footer.beginText();
                    footer.setFont(REGULAR, 8);
                    footer.setNonStrokingColor(0.43f, 0.47f, 0.44f);
                    footer.newLineAtOffset(MARGIN, 34);
                    footer.showText(supportedText("Alpha Dawgs Veterinary Clinic | " + title, REGULAR));
                    footer.endText();
                    footer.beginText();
                    footer.setFont(REGULAR, 8);
                    footer.setNonStrokingColor(0.43f, 0.47f, 0.44f);
                    footer.newLineAtOffset(PDRectangle.LETTER.getWidth() - MARGIN - 40, 34);
                    footer.showText("Page " + (index + 1) + " of " + pages.size());
                    footer.endText();
                }
            }
        }

        private static List<String> wrap(String value, PDFont font, float size, float maxWidth) throws IOException {
            List<String> lines = new ArrayList<>();
            for (String paragraph : value.replace("\r", "").split("\n", -1)) {
                StringBuilder line = new StringBuilder();
                for (String word : paragraph.split("\\s+")) {
                    if (word.isEmpty()) continue;
                    String candidate = line.isEmpty() ? word : line + " " + word;
                    if (font.getStringWidth(supportedText(candidate, font)) * size / 1000 <= maxWidth) {
                        line.setLength(0);
                        line.append(candidate);
                    } else {
                        if (!line.isEmpty()) lines.add(line.toString());
                        line.setLength(0);
                        StringBuilder chunk = new StringBuilder();
                        for (int offset = 0; offset < word.length();) {
                            int codePoint = word.codePointAt(offset);
                            String character = new String(Character.toChars(codePoint));
                            String nextChunk = chunk + character;
                            if (!chunk.isEmpty()
                                    && font.getStringWidth(supportedText(nextChunk, font)) * size / 1000 > maxWidth) {
                                lines.add(chunk.toString());
                                chunk.setLength(0);
                            }
                            chunk.append(character);
                            offset += Character.charCount(codePoint);
                        }
                        line.append(chunk);
                    }
                }
                lines.add(line.toString());
            }
            return lines;
        }

        private static String supportedText(String value, PDFont font) throws IOException {
            StringBuilder supported = new StringBuilder();
            for (int offset = 0; offset < value.length();) {
                int codePoint = value.codePointAt(offset);
                String character = new String(Character.toChars(codePoint));
                try {
                    font.encode(character);
                    supported.append(character);
                } catch (IllegalArgumentException exception) {
                    supported.append('?');
                }
                offset += Character.charCount(codePoint);
            }
            return supported.toString();
        }
    }
}
