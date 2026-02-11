package com.example.ticketing.controller;

import com.example.ticketing.model.Ticket;
import com.example.ticketing.repository.TicketRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TicketControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TicketRepository ticketRepository;

    @Test
    void estimateCostReturnsExpectedPayload() throws Exception {
        String body = """
                {
                  "aclHoursPerMonthPerLab": 9,
                  "nonAclHoursPerMonthPerLab": 1,
                  "labCount": 365
                }
                """;

        mockMvc.perform(post("/api/tickets/estimate-cost")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estimatedMonthlyCostEur").exists())
                .andExpect(jsonPath("$.aclCostEur").exists())
                .andExpect(jsonPath("$.nonAclCostEur").exists())
                .andExpect(jsonPath("$.overheadEur").exists())
                .andExpect(jsonPath("$.summary").exists());
    }

    @Test
    void updateStatusUpdatesTicket() throws Exception {
        Ticket ticket = new Ticket();
        ticket.setLocation("COB");
        ticket.setTicketRaised("Test User");
        ticket.setTicketToBeIssued("Rahul Nair (Team Member)");
        ticket.setGbCode("GB1");
        ticket.setAclType("ACL");
        ticket.setBuilding("B1");
        ticket.setFloor("1");
        ticket.setLabNo("L1");
        ticket.setDhDeptCode("IT");
        ticket.setDhName("John");
        ticket.setCost("1200");
        ticket.setIssueDescription("Status update test");
        ticket.setStatus("OPEN");
        Ticket saved = ticketRepository.save(ticket);

        mockMvc.perform(put("/api/tickets/" + saved.getId() + "/status")
                        .param("status", "IN_PROGRESS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saved.getId()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void managerChatReturnsContract() throws Exception {
        String body = """
                {
                  "question": "show status distribution"
                }
                """;

        mockMvc.perform(post("/api/tickets/manager-chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").exists())
                .andExpect(jsonPath("$.chartType").exists())
                .andExpect(jsonPath("$.focus").exists());
    }
}
