import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Tooltip
} from "chart.js";
import { Bar, Doughnut, Line, PolarArea, Radar } from "react-chartjs-2";

const API_URL = "http://localhost:8081/api/tickets";
const TEAM_DIRECTORY = [
  { name: "Arun Prakash", role: "Group Manager" },
  { name: "Neha Verma", role: "Manager" },
  { name: "Kiran Rao", role: "Team Lead" },
  { name: "Rahul Nair", role: "Team Member" },
  { name: "Pooja Sharma", role: "Team Member" },
  { name: "Vikram Das", role: "Team Member" },
  { name: "Meena Joseph", role: "Team Member" }
];
const DH_DEPT_COST_MAP = { IT: 1200, CS: 1500, EE: 1300, ME: 1400, EC: 1350, ADM: 900 };
const STATIC_LOCATION_TEAM = {
  COB: ["Rahul Nair", "Pooja Sharma"],
  ADU: ["Vikram Das"],
  KOR: ["Meena Joseph"]
};
const PRIORITY_SUPPORT_TEAM = ["Rahul Nair", "Pooja Sharma", "Vikram Das", "Meena Joseph"];

const TEAM_ROLE_BY_NAME = TEAM_DIRECTORY.reduce((acc, member) => ({ ...acc, [member.name]: member.role }), {});
const formatAssignee = (name) => {
  const role = TEAM_ROLE_BY_NAME[name] || "Team Member";
  return `${name} (${role})`;
};
const getVisibleTeamByLocation = (locationCode, assigneeLoad) => {
  if (!locationCode) return [];
  const fixed = STATIC_LOCATION_TEAM[locationCode];
  if (fixed) return fixed;
  return [...PRIORITY_SUPPORT_TEAM].sort((a, b) => {
    const diff = (assigneeLoad[a] || 0) - (assigneeLoad[b] || 0);
    return diff !== 0 ? diff : PRIORITY_SUPPORT_TEAM.indexOf(a) - PRIORITY_SUPPORT_TEAM.indexOf(b);
  });
};
const getAssigneeForLocation = (locationCode, assigneeLoad) => {
  const visible = getVisibleTeamByLocation(locationCode, assigneeLoad);
  const selected = visible[0] || "Kiran Rao";
  return formatAssignee(selected);
};

const DEMO_TICKETS = [
  { id: "demo-1", location: "COB", ticketRaised: "Anita Sharma", ticketToBeIssued: "Rahul Nair (Team Member)", gbCode: "GB1", aclType: "ACL", building: "Engineering Block A", floor: "2", labNo: "LAB-203", dhDeptCode: "EE", dhName: "Dr. Patel", cost: "1534.00", issueDescription: "Projector is flickering during lectures.", status: "OPEN" },
  { id: "demo-2", location: "HYD", ticketRaised: "Rohan Gupta", ticketToBeIssued: "Pooja Sharma (Team Member)", gbCode: "GB2", aclType: "ACL", building: "Computer Science Wing", floor: "1", labNo: "LAB-107", dhDeptCode: "CS", dhName: "Ms. Johnson", cost: "1770.00", issueDescription: "12 systems need OS reinstallation and patching.", status: "IN_PROGRESS" },
  { id: "demo-3", location: "ADU", ticketRaised: "Meera Iyer", ticketToBeIssued: "Vikram Das (Team Member)", gbCode: "NGB1", aclType: "NON ACL", building: "Innovation Center", floor: "Ground", labNo: "LAB-011", dhDeptCode: "EC", dhName: "Mr. Lee", cost: "1350.00", issueDescription: "Biometric access device not syncing with server.", status: "RESOLVED" }
];

const initialForm = {
  location: "",
  ticketRaised: "",
  ticketToBeIssued: "",
  gbCode: "",
  aclType: "",
  building: "",
  floor: "",
  labNo: "",
  dhDeptCode: "",
  dhName: "",
  cost: "",
  issueDescription: ""
};

const formatEuro = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(amount);
};
const getAclType = (gbCode, deptCode) => {
  const normalizedGb = (gbCode || "").toUpperCase().trim();
  const normalizedDept = (deptCode || "").toUpperCase().trim();
  const aclDept = ["IT", "CS", "EE", "EC"].includes(normalizedDept);
  const gbZone = normalizedGb.startsWith("GB");
  return aclDept && gbZone ? "ACL" : "NON ACL";
};

const getCostFromDhDeptCode = (code, aclType) => {
  const base = DH_DEPT_COST_MAP[(code || "").toUpperCase().trim()];
  if (!base) return "";
  const multiplier = aclType === "ACL" ? 1.18 : 1;
  return (base * multiplier).toFixed(2);
};
const getModeFromHash = () => {
  const raw = (window.location.hash || "").replace("#", "").toLowerCase();
  return raw === "requester" || raw === "assignee" || raw === "manager" ? raw : "requester";
};

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const getTicketStats = (tickets) => {
  const totalTickets = tickets.length;
  const open = tickets.filter((t) => t.status === "OPEN").length;
  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
  const totalCost = tickets.reduce((sum, t) => sum + (Number.isNaN(Number(t.cost)) ? 0 : Number(t.cost)), 0);
  const avgCost = totalTickets > 0 ? totalCost / totalTickets : 0;
  const roughMonthlyEstimate = (totalTickets + open * 0.5 + inProgress * 0.25) * avgCost;
  return { totalTickets, open, inProgress, resolved, totalCost, avgCost, roughMonthlyEstimate };
};

const buildChartForFocus = (focus, tickets, chartType) => {
  const colors = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#eab308", "#ef4444"];
  if (focus === "status") {
    const data = [tickets.filter((t) => t.status === "OPEN").length, tickets.filter((t) => t.status === "IN_PROGRESS").length, tickets.filter((t) => t.status === "RESOLVED").length];
    return { title: "Ticket Status Split", type: chartType || "doughnut", data: { labels: ["OPEN", "IN_PROGRESS", "RESOLVED"], datasets: [{ data, backgroundColor: ["#ef4444", "#f59e0b", "#22c55e"] }] } };
  }
  if (focus === "location") {
    const map = {};
    tickets.forEach((t) => { map[t.location || "UNKNOWN"] = (map[t.location || "UNKNOWN"] || 0) + 1; });
    const labels = Object.keys(map);
    return { title: "Tickets by Location", type: chartType || "bar", data: { labels, datasets: [{ label: "Tickets", data: labels.map((k) => map[k]), backgroundColor: labels.map((_, i) => colors[i % colors.length]) }] } };
  }
  if (focus === "assignee") {
    const map = {};
    tickets.forEach((t) => { const key = t.ticketToBeIssued || "Unassigned"; map[key] = (map[key] || 0) + 1; });
    const labels = Object.keys(map);
    return { title: "Tickets by Assignee", type: chartType || "bar", data: { labels, datasets: [{ label: "Assigned", data: labels.map((k) => map[k]), backgroundColor: "#0ea5e9" }] } };
  }
  if (focus === "trend" || focus === "cost") {
    const map = {};
    tickets.forEach((t) => {
      const key = t.createdAt ? t.createdAt.slice(0, 7) : "unknown";
      const amount = Number(t.cost);
      map[key] = (map[key] || 0) + (Number.isNaN(amount) ? 0 : amount);
    });
    const labels = Object.keys(map).sort();
    return {
      title: focus === "trend" ? "Monthly Cost Trend" : "Cost Distribution",
      type: chartType || (focus === "trend" ? "line" : "polarArea"),
      data: {
        labels,
        datasets: [{
          label: "EUR",
          data: labels.map((k) => Number(map[k].toFixed(2))),
          borderColor: "#1d4ed8",
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          tension: 0.25
        }]
      }
    };
  }
  return {
    title: "Ticket Overview",
    type: chartType || "bar",
    data: {
      labels: ["Total", "Open", "In Progress", "Resolved"],
      datasets: [{ label: "Tickets", data: [tickets.length, tickets.filter((t) => t.status === "OPEN").length, tickets.filter((t) => t.status === "IN_PROGRESS").length, tickets.filter((t) => t.status === "RESOLVED").length], backgroundColor: ["#334155", "#ef4444", "#f59e0b", "#22c55e"] }]
    }
  };
};

export default function App() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const assigneeUsers = TEAM_DIRECTORY.filter((m) => m.role === "Team Lead" || m.role === "Team Member");
  const managerUsers = TEAM_DIRECTORY.filter((m) => m.role === "Manager" || m.role === "Group Manager");

  const [mode, setMode] = useState(getModeFromHash());
  const [formData, setFormData] = useState(initialForm);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const [managerAccessKey, setManagerAccessKey] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState(assigneeUsers[0]?.name ?? "Kiran Rao");
  const [selectedManager, setSelectedManager] = useState(managerUsers[0]?.name ?? "Arun Prakash");
  const [managerChatInput, setManagerChatInput] = useState("");
  const [managerChatMessages, setManagerChatMessages] = useState([{ role: "bot", text: "Manager AI Assistant: ask anything about tickets. I will answer and show a chart." }]);

  const stats = useMemo(() => getTicketStats(tickets), [tickets]);
  const assigneeLoad = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const assignee = (t.ticketToBeIssued || "").split(" (")[0];
      if (!assignee) return;
      map[assignee] = (map[assignee] || 0) + 1;
    });
    return map;
  }, [tickets]);
  const visibleTeamForSelectedLocation = useMemo(
    () => getVisibleTeamByLocation(formData.location, assigneeLoad).map(formatAssignee),
    [formData.location, assigneeLoad]
  );
  const assignedTickets = useMemo(() => tickets.filter((t) => (t.ticketToBeIssued || "").includes(selectedAssignee)), [tickets, selectedAssignee]);

  const loadTickets = async () => {
    try {
      setError("");
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to load tickets");
      setTickets(await res.json());
      setUsingDemoData(false);
    } catch (err) {
      setTickets(DEMO_TICKETS);
      setUsingDemoData(true);
      setError("Backend unavailable. Showing demo data.");
    }
  };

  useEffect(() => { loadTickets(); }, []);
  useEffect(() => {
    const onHashChange = () => setMode(getModeFromHash());
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) window.location.hash = "requester";
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const switchMode = (nextMode) => { window.location.hash = nextMode; };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "location") {
      const locationCode = value.toUpperCase();
      setFormData((prev) => ({ ...prev, location: locationCode, ticketToBeIssued: getAssigneeForLocation(locationCode, assigneeLoad) }));
      return;
    }
    if (name === "dhDeptCode") {
      const deptCode = value.toUpperCase().trim();
      setFormData((prev) => {
        const aclType = getAclType(prev.gbCode, deptCode);
        return { ...prev, dhDeptCode: deptCode, aclType, cost: getCostFromDhDeptCode(deptCode, aclType) };
      });
      return;
    }
    if (name === "gbCode") {
      const gbCode = value.toUpperCase().trim();
      setFormData((prev) => {
        const aclType = getAclType(gbCode, prev.dhDeptCode);
        return { ...prev, gbCode, aclType, cost: getCostFromDhDeptCode(prev.dhDeptCode, aclType) };
      });
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const createTicket = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      if (!res.ok) throw new Error("Failed to create ticket");
      const created = await res.json();
      setNotice(`Ticket raised by ${created.ticketRaised} and assigned to ${created.ticketToBeIssued}.`);
      setFormData(initialForm);
      await loadTickets();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createTicket();
  };

  const handleCreateTicketClick = async () => {
    await createTicket();
  };

  const handleMonthlyExport = async () => {
    try {
      setError("");
      if (!managerAccessKey.trim()) {
        throw new Error("Manager access key is required for monthly export.");
      }
      const [year, month] = exportMonth.split("-");
      const res = await fetch(`${API_URL}/export/monthly?year=${year}&month=${month}`, {
        headers: { "X-Manager-Key": managerAccessKey.trim() }
      });
      if (!res.ok) throw new Error("Failed to download monthly excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tickets-${year}-${month}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusUpdate = async (ticketId, status) => {
    try {
      if (usingDemoData) {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
        return;
      }
      const res = await fetch(`${API_URL}/${ticketId}/status?status=${encodeURIComponent(status)}`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManagerChatSend = async () => {
    const msg = managerChatInput.trim();
    if (!msg) return;
    if (usingDemoData) {
      setManagerChatMessages((prev) => [...prev, { role: "user", text: msg }, { role: "bot", text: "Live backend data is unavailable. Manager AI bot is disabled until backend data is connected." }]);
      setManagerChatInput("");
      return;
    }

    setManagerChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setManagerChatInput("");

    try {
      const res = await fetch(`${API_URL}/manager-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: msg })
      });
      if (!res.ok) throw new Error("Failed to get AI response");
      const ai = await res.json();
      const chart = buildChartForFocus(ai.focus, tickets, ai.chartType);
      setManagerChatMessages((prev) => [...prev, { role: "bot", text: `${ai.answer} Showing ${chart.title}.`, chart }]);
    } catch (err) {
      setManagerChatMessages((prev) => [...prev, { role: "bot", text: `Manager AI bot failed: ${err.message}` }]);
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand-row">
          <img src="/bosch-logo.svg" alt="Bosch logo" className="bosch-logo" />
          <div>
            <h1 className="brand">ITL</h1>
            <p className="brand-subtitle">Bosch Service Desk</p>
          </div>
        </div>
      </header>

      <div className="mode-switch">
        <button type="button" className={mode === "requester" ? "active-tab" : ""} onClick={() => switchMode("requester")}>Ticket Raising User</button>
        <button type="button" className={mode === "assignee" ? "active-tab" : ""} onClick={() => switchMode("assignee")}>Assigned To</button>
        <button type="button" className={mode === "manager" ? "active-tab" : ""} onClick={() => switchMode("manager")}>Manager</button>
      </div>

      {usingDemoData && <p className="demo-note">Demo mode enabled</p>}
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {mode === "requester" ? (
        <>
          <form onSubmit={handleSubmit} className="ticket-form">
            <select name="location" value={formData.location} onChange={handleChange} required>
              <option value="" disabled>Select Location</option>
              <option value="COB">COB</option><option value="HYD">HYD</option><option value="ADU">ADU</option>
              <option value="KOR">KOR</option><option value="NHP">NHP</option><option value="EC360">EC360</option>
            </select>
            <input name="ticketRaised" placeholder="Ticket Raised By" value={formData.ticketRaised} onChange={handleChange} required />
            <input name="ticketToBeIssued" placeholder="Ticket To Be Issued" value={formData.ticketToBeIssued} readOnly required />
            <input name="visibleTeam" placeholder="ITL Team For Selected Location" value={visibleTeamForSelectedLocation.join(", ")} readOnly />
            <input name="gbCode" placeholder="GB Code (e.g. GB1, GB2, NGB1)" value={formData.gbCode} onChange={handleChange} required />
            <input name="aclType" placeholder="ACL Type" value={formData.aclType} readOnly required />
            <input name="building" placeholder="Building" value={formData.building} onChange={handleChange} required />
            <input name="floor" placeholder="Floor" value={formData.floor} onChange={handleChange} required />
            <input name="labNo" placeholder="Lab No" value={formData.labNo} onChange={handleChange} required />
            <input name="dhName" placeholder="DH Name" value={formData.dhName} onChange={handleChange} required />
            <input name="dhDeptCode" placeholder="DH Dept Code (IT/CS/EE/ME/EC/ADM)" value={formData.dhDeptCode} onChange={handleChange} required />
            <input name="cost" type="number" min="0" step="0.01" placeholder="Cost (EUR)" value={formData.cost} readOnly required />
            <textarea name="issueDescription" placeholder="Issue Description" value={formData.issueDescription} onChange={handleChange} rows={4} required />
            <button type="button" onClick={handleCreateTicketClick} disabled={loading}>{loading ? "Submitting..." : "Create Ticket"}</button>
          </form>
        </>
      ) : null}

      {mode === "assignee" ? (
        <section>
          <h2>Assigned Tickets</h2>
          <div className="assignee-bar">
            <label htmlFor="assignee-select">Assignee:</label>
            <select id="assignee-select" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)}>
              {assigneeUsers.map((member) => <option key={member.name} value={member.name}>{member.name} ({member.role})</option>)}
            </select>
          </div>
          <div className="ticket-list">
            {assignedTickets.length === 0 ? <p>No assigned tickets for {selectedAssignee}.</p> : assignedTickets.map((ticket) => (
              <div className="ticket-card" key={ticket.id}>
                <p><strong>Ticket ID:</strong> {ticket.id}</p>
                <p><strong>Raised By:</strong> {ticket.ticketRaised}</p>
                <p><strong>Location:</strong> {ticket.location}</p>
                <p><strong>Issue:</strong> {ticket.issueDescription}</p>
                <p><strong>Current Status:</strong> {ticket.status}</p>
                <label htmlFor={`status-${ticket.id}`}>Update Status</label>
                <select id={`status-${ticket.id}`} value={ticket.status || "OPEN"} onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}>
                  <option value="OPEN">OPEN</option><option value="IN_PROGRESS">IN_PROGRESS</option><option value="RESOLVED">RESOLVED</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "manager" ? (
        <section>
          <h2>Manager Dashboard</h2>
          {usingDemoData ? <p className="error">Manager AI bot requires live backend data and does not use demo data.</p> : null}
          <div className="assignee-bar">
            <label htmlFor="manager-select">Manager:</label>
            <select id="manager-select" value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
              {managerUsers.map((member) => <option key={member.name} value={member.name}>{member.name} ({member.role})</option>)}
            </select>
          </div>

          <div className="manager-grid">
            <div className="metric-card"><p className="metric-title">Tickets Raised</p><p className="metric-value">{stats.totalTickets}</p></div>
            <div className="metric-card"><p className="metric-title">OPEN</p><p className="metric-value">{stats.open}</p></div>
            <div className="metric-card"><p className="metric-title">IN_PROGRESS</p><p className="metric-value">{stats.inProgress}</p></div>
            <div className="metric-card"><p className="metric-title">RESOLVED</p><p className="metric-value">{stats.resolved}</p></div>
            <div className="metric-card"><p className="metric-title">Avg Cost / Ticket</p><p className="metric-value">{formatEuro(stats.avgCost)}</p></div>
            <div className="metric-card"><p className="metric-title">Rough Monthly Estimate</p><p className="metric-value">{formatEuro(stats.roughMonthlyEstimate)}</p></div>
          </div>

          <div className="export-row">
            <input
              type="password"
              placeholder="Manager Access Key"
              value={managerAccessKey}
              onChange={(e) => setManagerAccessKey(e.target.value)}
            />
            <input type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} />
            <button type="button" onClick={handleMonthlyExport}>Download Monthly Excel</button>
          </div>

          <section className="ai-chatbot">
            <h2>Manager AI Assistant</h2>
            <div className="chat-window">
              {managerChatMessages.map((msg, idx) => (
                <div key={`${msg.role}-${idx}`} className={`chat-bubble ${msg.role}`}>
                  {msg.text}
                  {msg.chart ? (
                    <div className="chart-box">
                      {msg.chart.type === "bar" ? <Bar data={msg.chart.data} /> : null}
                      {msg.chart.type === "line" ? <Line data={msg.chart.data} /> : null}
                      {msg.chart.type === "doughnut" ? <Doughnut data={msg.chart.data} /> : null}
                      {msg.chart.type === "polarArea" ? <PolarArea data={msg.chart.data} /> : null}
                      {msg.chart.type === "radar" ? <Radar data={msg.chart.data} /> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input value={managerChatInput} onChange={(e) => setManagerChatInput(e.target.value)} placeholder="Ask manager analytics question..." />
              <button type="button" onClick={handleManagerChatSend}>Send</button>
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
