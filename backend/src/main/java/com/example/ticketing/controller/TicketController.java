package com.example.ticketing.controller;

import com.example.ticketing.model.Ticket;
import com.example.ticketing.repository.TicketRepository;
import com.example.ticketing.service.ManagerAiService;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
})
public class TicketController {

    private final TicketRepository ticketRepository;
    private final ManagerAiService managerAiService;

    public TicketController(TicketRepository ticketRepository, ManagerAiService managerAiService) {
        this.ticketRepository = ticketRepository;
        this.managerAiService = managerAiService;
    }

    @PostMapping
    public Ticket createTicket(@RequestBody Ticket ticket) {
        applyDerivedFields(ticket);
        return ticketRepository.save(ticket);
    }

    @GetMapping
    public List<Ticket> getAllTickets() {
        return ticketRepository.findAll();
    }

    @PostMapping("/manager-chat")
    public ManagerAiResponse managerChat(@RequestBody ManagerAiRequest request) {
        List<Ticket> tickets = ticketRepository.findAll();
        return managerAiService.answer(request.question(), tickets);
    }

    @PutMapping("/{ticketId}/status")
    public Ticket updateTicketStatus(@PathVariable Long ticketId, @RequestParam String status) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        ticket.setStatus(status);
        return ticketRepository.save(ticket);
    }

    @PostMapping("/estimate-cost")
    public CostEstimateResponse estimateCost(@RequestBody CostEstimateRequest request) {
        double aclHoursPerLab = request.aclHoursPerMonthPerLab() != null ? request.aclHoursPerMonthPerLab() : 9.0;
        double nonAclHoursPerLab = request.nonAclHoursPerMonthPerLab() != null ? request.nonAclHoursPerMonthPerLab() : 0.0;
        int labCount = request.labCount() != null ? request.labCount() : 365;

        double aclRateEur = 42.0;
        double nonAclRateEur = 28.0;

        double aclCost = labCount * aclHoursPerLab * aclRateEur;
        double nonAclCost = labCount * nonAclHoursPerLab * nonAclRateEur;
        double subtotal = aclCost + nonAclCost;
        double coordinationOverhead = subtotal * 0.08;
        double estimatedMonthlyCost = subtotal + coordinationOverhead;

        return new CostEstimateResponse(
                round(estimatedMonthlyCost),
                round(aclCost),
                round(nonAclCost),
                round(coordinationOverhead),
                "Estimate based on " + labCount + " labs, ACL " + aclHoursPerLab + "h/lab/month and non-ACL " + nonAclHoursPerLab + "h/lab/month."
        );
    }

    @GetMapping("/export/monthly")
    public ResponseEntity<ByteArrayResource> exportMonthlyTickets(
            @RequestParam int year,
            @RequestParam int month
    ) throws IOException {
        LocalDate monthStart = LocalDate.of(year, month, 1);
        LocalDateTime start = monthStart.atStartOfDay();
        LocalDateTime end = monthStart.plusMonths(1).atStartOfDay();

        List<Ticket> monthlyTickets = ticketRepository.findByCreatedAtBetween(start, end);

        byte[] fileBytes = buildWorkbook(monthlyTickets);
        String filename = "tickets-" + year + "-" + String.format("%02d", month) + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(fileBytes.length)
                .body(new ByteArrayResource(fileBytes));
    }

    private byte[] buildWorkbook(List<Ticket> tickets) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Tickets");
            Row headerRow = sheet.createRow(0);
            headerRow.createCell(0).setCellValue("ID");
            headerRow.createCell(1).setCellValue("Created At");
            headerRow.createCell(2).setCellValue("Location");
            headerRow.createCell(3).setCellValue("Ticket Raised By");
            headerRow.createCell(4).setCellValue("Ticket To Be Issued");
            headerRow.createCell(5).setCellValue("GB Code");
            headerRow.createCell(6).setCellValue("ACL Type");
            headerRow.createCell(7).setCellValue("Building");
            headerRow.createCell(8).setCellValue("Floor");
            headerRow.createCell(9).setCellValue("Lab No");
            headerRow.createCell(10).setCellValue("DH Dept Code");
            headerRow.createCell(11).setCellValue("DH Name");
            headerRow.createCell(12).setCellValue("Cost");
            headerRow.createCell(13).setCellValue("Issue Description");
            headerRow.createCell(14).setCellValue("Status");

            int rowIndex = 1;
            for (Ticket ticket : tickets) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(ticket.getId() != null ? ticket.getId() : 0L);
                row.createCell(1).setCellValue(ticket.getCreatedAt() != null ? ticket.getCreatedAt().toString() : "");
                row.createCell(2).setCellValue(safe(ticket.getLocation()));
                row.createCell(3).setCellValue(safe(ticket.getTicketRaised()));
                row.createCell(4).setCellValue(safe(ticket.getTicketToBeIssued()));
                row.createCell(5).setCellValue(safe(ticket.getGbCode()));
                row.createCell(6).setCellValue(safe(ticket.getAclType()));
                row.createCell(7).setCellValue(safe(ticket.getBuilding()));
                row.createCell(8).setCellValue(safe(ticket.getFloor()));
                row.createCell(9).setCellValue(safe(ticket.getLabNo()));
                row.createCell(10).setCellValue(safe(ticket.getDhDeptCode()));
                row.createCell(11).setCellValue(safe(ticket.getDhName()));
                row.createCell(12).setCellValue(safe(ticket.getCost()));
                row.createCell(13).setCellValue(safe(ticket.getIssueDescription()));
                row.createCell(14).setCellValue(safe(ticket.getStatus()));
            }

            for (int i = 0; i <= 14; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private void applyDerivedFields(Ticket ticket) {
        String gbCode = safe(ticket.getGbCode()).toUpperCase(Locale.ROOT).trim();
        String dept = safe(ticket.getDhDeptCode()).toUpperCase(Locale.ROOT).trim();
        boolean aclDept = List.of("IT", "CS", "EE", "EC").contains(dept);
        boolean gbZone = gbCode.startsWith("GB");
        String aclType = (aclDept && gbZone) ? "ACL" : "NON ACL";
        ticket.setAclType(aclType);

        if (!dept.isBlank()) {
            BigDecimal base = switch (dept) {
                case "IT" -> BigDecimal.valueOf(1200);
                case "CS" -> BigDecimal.valueOf(1500);
                case "EE" -> BigDecimal.valueOf(1300);
                case "ME" -> BigDecimal.valueOf(1400);
                case "EC" -> BigDecimal.valueOf(1350);
                case "ADM" -> BigDecimal.valueOf(900);
                default -> BigDecimal.ZERO;
            };
            BigDecimal multiplier = "ACL".equals(aclType) ? BigDecimal.valueOf(1.18) : BigDecimal.ONE;
            BigDecimal cost = base.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
            ticket.setCost(cost.toPlainString());
        }
    }

    public record CostEstimateRequest(Double aclHoursPerMonthPerLab, Double nonAclHoursPerMonthPerLab, Integer labCount) {}

    public record CostEstimateResponse(
            double estimatedMonthlyCostEur,
            double aclCostEur,
            double nonAclCostEur,
            double overheadEur,
            String summary
    ) {}

    public record ManagerAiRequest(String question) {}

    public record ManagerAiResponse(String answer, String chartType, String focus) {}
}
