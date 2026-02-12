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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;

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
                        .header("X-User-Role", "itl")
                        .header("X-User-Name", "Rahul Nair")
                        .param("status", "IN_PROGRESS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saved.getId()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.inProgressAt").exists());
    }

    @Test
    void resolveStatusCalculatesEffortAndCost() throws Exception {
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
        ticket.setIssueDescription("Resolve test");
        ticket.setStatus("IN_PROGRESS");
        ticket.setInProgressAt(LocalDateTime.now().minusHours(2));
        Ticket saved = ticketRepository.save(ticket);

        mockMvc.perform(put("/api/tickets/" + saved.getId() + "/status")
                        .header("X-User-Role", "itl")
                        .header("X-User-Name", "Rahul Nair")
                        .param("status", "RESOLVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.completedAt").exists())
                .andExpect(jsonPath("$.effortHours").exists())
                .andExpect(jsonPath("$.cost").exists());
    }

    @Test
    void itlUserSeesOnlySelfAssignedTickets() throws Exception {
        ticketRepository.deleteAll();

        Ticket first = new Ticket();
        first.setLocation("COB");
        first.setTicketRaised("Requester");
        first.setTicketToBeIssued("Rahul Nair (Team Member)");
        first.setGbCode("GB1");
        first.setAclType("ACL");
        first.setBuilding("B1");
        first.setFloor("1");
        first.setLabNo("L1");
        first.setDhDeptCode("IT");
        first.setDhName("John");
        first.setCost("1200");
        first.setIssueDescription("Mine");
        first.setStatus("OPEN");
        ticketRepository.save(first);

        Ticket second = new Ticket();
        second.setLocation("COB");
        second.setTicketRaised("Requester");
        second.setTicketToBeIssued("Vikram Das (Team Member)");
        second.setGbCode("GB1");
        second.setAclType("ACL");
        second.setBuilding("B1");
        second.setFloor("1");
        second.setLabNo("L1");
        second.setDhDeptCode("IT");
        second.setDhName("John");
        second.setCost("1200");
        second.setIssueDescription("Not mine");
        second.setStatus("OPEN");
        ticketRepository.save(second);

        mockMvc.perform(get("/api/tickets")
                        .header("X-User-Role", "itl")
                        .header("X-User-Name", "Rahul Nair"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].ticketToBeIssued").value("Rahul Nair (Team Member)"));
    }

    @Test
    void managerSeesAllTickets() throws Exception {
        ticketRepository.deleteAll();

        Ticket ticket = new Ticket();
        ticket.setLocation("COB");
        ticket.setTicketRaised("Requester");
        ticket.setTicketToBeIssued("Rahul Nair (Team Member)");
        ticket.setGbCode("GB1");
        ticket.setAclType("ACL");
        ticket.setBuilding("B1");
        ticket.setFloor("1");
        ticket.setLabNo("L1");
        ticket.setDhDeptCode("IT");
        ticket.setDhName("John");
        ticket.setCost("1200");
        ticket.setIssueDescription("Manager view");
        ticket.setStatus("OPEN");
        ticketRepository.save(ticket);

        mockMvc.perform(get("/api/tickets")
                        .header("X-User-Role", "manager")
                        .header("X-User-Name", "Neha Verma"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
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
