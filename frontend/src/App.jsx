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
const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
const ITL_LOGIN_USERS = [
  { username: "kiran_rao", password: "itl123", name: "Kiran Rao" },
  { username: "rahul_nair", password: "itl123", name: "Rahul Nair" },
  { username: "pooja_sharma", password: "itl123", name: "Pooja Sharma" },
  { username: "vikram_das", password: "itl123", name: "Vikram Das" },
  { username: "meena_joseph", password: "itl123", name: "Meena Joseph" }
];
const LOGIN_USERS = {
  requester: [{ username: "user", password: "user123", name: "Requester User" }],
  itl: ITL_LOGIN_USERS,
  manager: [{ username: "manager", password: "manager123", name: "Manager" }]
};
const ROLE_TO_MODES = {
  requester: ["requester"],
  itl: ["requester", "assignee"],
  manager: ["manager"]
};
const MODE_LABELS = { requester: "Ticket Raising User", assignee: "Assigned To", manager: "Manager" };
const MODE_LABELS_ITL = { requester: "Raise Ticket (On Behalf)", assignee: "Assigned To" };

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

  const [mode, setMode] = useState("requester");
  const [authUser, setAuthUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ role: "requester", username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [formData, setFormData] = useState(initialForm);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastCreatedTicket, setLastCreatedTicket] = useState(null);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const [managerAccessKey, setManagerAccessKey] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState(assigneeUsers[0]?.name ?? "Kiran Rao");
  const [selectedManager, setSelectedManager] = useState(managerUsers[0]?.name ?? "Arun Prakash");
  const [managerChatInput, setManagerChatInput] = useState("");
  const [managerChatMessages, setManagerChatMessages] = useState([{ role: "bot", text: "Manager AI Assistant: ask anything about tickets. I will answer and show a chart." }]);
  const availableModes = authUser ? (ROLE_TO_MODES[authUser.role] || []) : [];

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
  const managerVisibleTickets = useMemo(
    () => tickets.filter((t) => (t.ticketToBeIssued || "").trim() !== ""),
    [tickets]
  );
  const authHeaders = authUser
    ? { "X-User-Role": authUser.role, "X-User-Name": authUser.name }
    : {};

  const loadTickets = async () => {
    if (!authUser) return;
    try {
      setError("");
      const res = await fetch(API_URL, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load tickets");
      setTickets(await res.json());
      setUsingDemoData(false);
    } catch (err) {
      setTickets(DEMO_TICKETS);
      setUsingDemoData(true);
      setError("Backend unavailable. Showing demo data.");
    }
  };

  useEffect(() => { loadTickets(); }, [authUser]);
  useEffect(() => {
    const stored = sessionStorage.getItem("ticketing_auth_user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.role && ROLE_TO_MODES[parsed.role]?.length) {
        setAuthUser(parsed);
        const nextMode = ROLE_TO_MODES[parsed.role][0];
        setMode(nextMode);
      }
    } catch (_) {
      sessionStorage.removeItem("ticketing_auth_user");
    }
  }, []);
  useEffect(() => {
    if (!authUser) {
      setMode("requester");
      return;
    }
    const allowedModes = ROLE_TO_MODES[authUser.role] || [];
    if (!allowedModes.includes(mode)) {
      setMode(allowedModes[0] || "requester");
    }
  }, [authUser, mode]);
  useEffect(() => {
    if (!authUser) return;
    if (authUser.role === "itl") {
      setSelectedAssignee(authUser.name);
    }
  }, [authUser]);

  const switchMode = (nextMode) => {
    if (!authUser) return;
    if (!availableModes.includes(nextMode)) return;
    setMode(nextMode);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");
    const users = LOGIN_USERS[loginForm.role] || [];
    const matched = users.find(
      (u) => u.username.toLowerCase() === loginForm.username.trim().toLowerCase() && u.password === loginForm.password
    );
    if (!matched) {
      setLoginError("Invalid credentials for selected role.");
      return;
    }
    const user = { name: matched.name, role: loginForm.role };
    setAuthUser(user);
    sessionStorage.setItem("ticketing_auth_user", JSON.stringify(user));
    const nextMode = (ROLE_TO_MODES[user.role] || ["requester"])[0];
    setError("");
    setNotice("");
    setMode(nextMode);
    setLoginForm((prev) => ({ ...prev, username: "", password: "" }));
  };

  const handleLogout = () => {
    setAuthUser(null);
    sessionStorage.removeItem("ticketing_auth_user");
    setLoginError("");
    setError("");
    setNotice("");
    setLastCreatedTicket(null);
    setFormData(initialForm);
    setLoginForm({ role: "requester", username: "", password: "" });
    setMode("requester");
  };

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
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      const created = await res.json();
      setNotice(`Ticket ${created.id} created successfully.`);
      setLastCreatedTicket(created);
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
        headers: { "X-Manager-Key": managerAccessKey.trim(), ...authHeaders }
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
      const res = await fetch(`${API_URL}/${ticketId}/status?status=${encodeURIComponent(status)}`, {
        method: "PUT",
        headers: authHeaders
      });
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
        headers: { "Content-Type": "application/json", ...authHeaders },
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

  if (!authUser) {
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

        <section className="login-card">
          <h2>Sign In</h2>
          <p className="login-hint">Use your role-based credentials to continue.</p>
          {loginError ? <p className="error">{loginError}</p> : null}
          <form className="login-form" onSubmit={handleLogin}>
            <select
              value={loginForm.role}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              <option value="requester">User</option>
              <option value="itl">ITL Team</option>
              <option value="manager">Manager</option>
            </select>
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <button type="submit">Login</button>
          </form>
          <p className="login-help">
            Demo users: `user/user123`, `manager/manager123`.
            ITL IDs (password `itl123`): `kiran_rao`, `rahul_nair`, `pooja_sharma`, `vikram_das`, `meena_joseph`.
          </p>
        </section>
      </div>
    );
  }

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
        <div className="auth-row">
          <p className="brand-subtitle">Signed in: {authUser.name} ({authUser.role.toUpperCase()})</p>
          <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="mode-switch">
        {availableModes.map((key) => (
          <button key={key} type="button" className={mode === key ? "active-tab" : ""} onClick={() => switchMode(key)}>
            {authUser?.role === "itl" ? (MODE_LABELS_ITL[key] || MODE_LABELS[key]) : MODE_LABELS[key]}
          </button>
        ))}
      </div>

      {usingDemoData && <p className="demo-note">Demo mode enabled</p>}
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {mode === "requester" ? (
        <>
          {authUser?.role === "itl" ? (
            <p className="demo-note">You are raising this ticket on behalf of the user.</p>
          ) : null}
          {lastCreatedTicket ? (
            <section className="ticket-receipt">
              <h3>Ticket Created</h3>
              <p><strong>Ticket No:</strong> {lastCreatedTicket.id}</p>
              <p><strong>Raised By:</strong> {lastCreatedTicket.ticketRaised}</p>
              <p><strong>Assigned To:</strong> {lastCreatedTicket.ticketToBeIssued}</p>
              <p><strong>Status:</strong> {lastCreatedTicket.status || "OPEN"}</p>
              <p><strong>Current Cost:</strong> {formatEuro(lastCreatedTicket.cost || 0)}</p>
            </section>
          ) : null}
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
            <p className="form-note">`Ticket To Be Issued`, `ACL Type`, and `Cost` are auto-generated based on location/department rules.</p>
            <button type="button" onClick={handleCreateTicketClick} disabled={loading}>{loading ? "Submitting..." : "Create Ticket"}</button>
          </form>
        </>
      ) : null}

      {mode === "assignee" ? (
        <section>
          <h2>Assigned Tickets</h2>
          <div className="assignee-bar">
            <label htmlFor="assignee-select">Assignee:</label>
            {authUser?.role === "itl" ? (
              <input id="assignee-select" value={`${selectedAssignee} (ITL Team)`} readOnly />
            ) : (
              <select id="assignee-select" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)}>
                {assigneeUsers.map((member) => <option key={member.name} value={member.name}>{member.name} ({member.role})</option>)}
              </select>
            )}
          </div>
          <div className="ticket-list">
            {assignedTickets.length === 0 ? <p>No assigned tickets for {selectedAssignee}.</p> : assignedTickets.map((ticket) => (
              <div className="ticket-card" key={ticket.id}>
                <p><strong>Ticket ID:</strong> {ticket.id}</p>
                <p><strong>Raised By:</strong> {ticket.ticketRaised}</p>
                <p><strong>Location:</strong> {ticket.location}</p>
                <p><strong>Issue:</strong> {ticket.issueDescription}</p>
                <p><strong>Current Status:</strong> {ticket.status}</p>
                <p><strong>In Progress At:</strong> {formatDateTime(ticket.inProgressAt)}</p>
                <p><strong>Completed At:</strong> {formatDateTime(ticket.completedAt)}</p>
                <p><strong>Effort Hours:</strong> {ticket.effortHours ?? "-"}</p>
                <p><strong>Effort Cost:</strong> {formatEuro(ticket.cost || 0)}</p>
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

          <section>
            <h2>All Assigned Tickets (Manager View)</h2>
            <div className="ticket-list">
              {managerVisibleTickets.length === 0 ? (
                <p>No assigned tickets available.</p>
              ) : managerVisibleTickets.map((ticket) => (
                <div className="ticket-card" key={`mgr-${ticket.id}`}>
                  <p><strong>Ticket ID:</strong> {ticket.id}</p>
                  <p><strong>Assigned To:</strong> {ticket.ticketToBeIssued}</p>
                  <p><strong>Assigned Time:</strong> {formatDateTime(ticket.createdAt)}</p>
                  <p><strong>Raised By:</strong> {ticket.ticketRaised}</p>
                  <p><strong>Status:</strong> {ticket.status}</p>
                  <p><strong>Issue:</strong> {ticket.issueDescription}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}
