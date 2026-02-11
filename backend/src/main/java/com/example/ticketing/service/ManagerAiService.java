package com.example.ticketing.service;

import com.example.ticketing.controller.TicketController.ManagerAiResponse;
import com.example.ticketing.model.Ticket;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ManagerAiService {

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${openai.api.key:}")
    private String openAiApiKey;

    @Value("${openai.model:gpt-4o-mini}")
    private String openAiModel;

    public ManagerAiResponse answer(String question, List<Ticket> tickets) {
        if (question == null || question.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question is required");
        }

        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            return localFallback(question, tickets);
        }

        try {
            String ticketSummary = summarizeTickets(tickets);
            String responseText = askOpenAi(question, ticketSummary);
            return parseResponse(responseText);
        } catch (Exception ex) {
            return localFallback(question, tickets);
        }
    }

    private String askOpenAi(String question, String ticketSummary) throws IOException, InterruptedException {
        String systemPrompt = "You are a manager analytics assistant for ticketing. " +
                "Answer based only on provided ticket summary. " +
                "Return strict JSON with keys: answer, chartType, focus. " +
                "chartType must be one of: bar, line, doughnut, polarArea, radar. " +
                "focus must be one of: status, location, assignee, cost, trend, overview.";

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", openAiModel);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", "Question: " + question + "\nTicket summary: " + ticketSummary)
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_URL))
                .header("Authorization", "Bearer " + openAiApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("OpenAI API returned status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
            throw new IOException("Empty OpenAI response content");
        }
        return contentNode.asText();
    }

    private ManagerAiResponse parseResponse(String content) throws IOException {
        JsonNode node = objectMapper.readTree(content);
        String answer = node.path("answer").asText("");
        String chartType = node.path("chartType").asText("bar");
        String focus = node.path("focus").asText("overview");

        if (answer.isBlank()) {
            answer = "Unable to generate AI summary from current data.";
        }
        if (!List.of("bar", "line", "doughnut", "polarArea", "radar").contains(chartType)) {
            chartType = "bar";
        }
        if (!List.of("status", "location", "assignee", "cost", "trend", "overview").contains(focus)) {
            focus = "overview";
        }
        return new ManagerAiResponse(answer, chartType, focus);
    }

    private ManagerAiResponse localFallback(String question, List<Ticket> tickets) {
        int total = tickets.size();
        long open = tickets.stream().filter(t -> "OPEN".equals(t.getStatus())).count();
        long inProgress = tickets.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count();
        long resolved = tickets.stream().filter(t -> "RESOLVED".equals(t.getStatus())).count();
        double totalCost = tickets.stream().mapToDouble(t -> {
            try {
                return Double.parseDouble(t.getCost());
            } catch (Exception ignored) {
                return 0.0;
            }
        }).sum();

        String text = "Fallback analytics: " + total + " tickets, " + open + " open, " + inProgress +
                " in progress, " + resolved + " resolved, total cost " + String.format("%.2f", totalCost) + " EUR.";

        String q = question.toLowerCase();
        if (q.contains("status")) {
            return new ManagerAiResponse(text, "doughnut", "status");
        }
        if (q.contains("location")) {
            return new ManagerAiResponse(text, "bar", "location");
        }
        if (q.contains("assignee") || q.contains("assigned")) {
            return new ManagerAiResponse(text, "bar", "assignee");
        }
        if (q.contains("trend") || q.contains("month")) {
            return new ManagerAiResponse(text, "line", "trend");
        }
        if (q.contains("cost")) {
            return new ManagerAiResponse(text, "polarArea", "cost");
        }
        return new ManagerAiResponse(text, "bar", "overview");
    }

    private String summarizeTickets(List<Ticket> tickets) {
        int total = tickets.size();
        Map<String, Integer> status = countBy(tickets, Ticket::getStatus);
        Map<String, Integer> location = countBy(tickets, Ticket::getLocation);
        Map<String, Integer> assignee = countBy(tickets, Ticket::getTicketToBeIssued);
        double totalCost = tickets.stream().mapToDouble(t -> {
            try {
                return Double.parseDouble(t.getCost());
            } catch (Exception ignored) {
                return 0.0;
            }
        }).sum();
        double avgCost = total > 0 ? totalCost / total : 0.0;

        try {
            return objectMapper.writeValueAsString(Map.of(
                    "totalTickets", total,
                    "statusCounts", status,
                    "locationCounts", location,
                    "assigneeCounts", assignee,
                    "totalCostEur", totalCost,
                    "avgCostEur", avgCost
            ));
        } catch (IOException e) {
            return "{\"totalTickets\":" + total + "}";
        }
    }

    private Map<String, Integer> countBy(List<Ticket> tickets, java.util.function.Function<Ticket, String> selector) {
        Map<String, Integer> map = new HashMap<>();
        for (Ticket ticket : tickets) {
            String key = selector.apply(ticket);
            if (key == null || key.isBlank()) {
                key = "UNKNOWN";
            }
            map.put(key, map.getOrDefault(key, 0) + 1);
        }
        return map;
    }
}
