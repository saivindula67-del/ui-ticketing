package com.example.ticketing.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String location;
    private String ticketRaised;
    private String ticketToBeIssued;
    private String gbCode;
    private String aclType;
    private String building;
    private String floor;
    private String labNo;
    private String dhDeptCode;
    private String dhName;
    private String cost;

    @Column(length = 2000)
    private String issueDescription;

    private String status;
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null || status.isBlank()) {
            status = "OPEN";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getBuilding() {
        return building;
    }

    public void setBuilding(String building) {
        this.building = building;
    }

    public String getGbCode() {
        return gbCode;
    }

    public void setGbCode(String gbCode) {
        this.gbCode = gbCode;
    }

    public String getAclType() {
        return aclType;
    }

    public void setAclType(String aclType) {
        this.aclType = aclType;
    }

    public String getTicketRaised() {
        return ticketRaised;
    }

    public void setTicketRaised(String ticketRaised) {
        this.ticketRaised = ticketRaised;
    }

    public String getTicketToBeIssued() {
        return ticketToBeIssued;
    }

    public void setTicketToBeIssued(String ticketToBeIssued) {
        this.ticketToBeIssued = ticketToBeIssued;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public String getLabNo() {
        return labNo;
    }

    public void setLabNo(String labNo) {
        this.labNo = labNo;
    }

    public String getDhName() {
        return dhName;
    }

    public void setDhName(String dhName) {
        this.dhName = dhName;
    }

    public String getDhDeptCode() {
        return dhDeptCode;
    }

    public void setDhDeptCode(String dhDeptCode) {
        this.dhDeptCode = dhDeptCode;
    }

    public String getCost() {
        return cost;
    }

    public void setCost(String cost) {
        this.cost = cost;
    }

    public String getIssueDescription() {
        return issueDescription;
    }

    public void setIssueDescription(String issueDescription) {
        this.issueDescription = issueDescription;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
