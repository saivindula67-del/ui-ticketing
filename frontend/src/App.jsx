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

// ---------------------------
// Team Directory (Updated)
// ---------------------------
const TEAM_DIRECTORY = [
  { name: "Shamji", role: "Group Manager" },
  { name: "Raj Kumar Dahal", role: "Manager" },
  { name: "Manikandan Kumar", role: "Team Lead" },
  { name: "Tamilarasan P", role: "Team Member" },
  { name: "Arunkumar M", role: "Team Member" },
  { name: "Jagadish Sai V", role: "Team Member" },
  { name: "K G Karthi", role: "Team Member" }
];

// ---------------------------
// Location → Fixed ITL Team
// ---------------------------
const STATIC_LOCATION_TEAM = {
  COB: ["Tamilarasan P", "Arunkumar M"],
  ADU: ["Jagadish Sai V"],
  KOR: ["K G Karthi"]
};

// ---------------------------
// Priority Support Team
// ---------------------------
const PRIORITY_SUPPORT_TEAM = [
  "Tamilarasan P",
  "Arunkumar M",
  "Jagadish Sai V",
  "K G Karthi"
];

// ---------------------------
// Cost map (restored)
// ---------------------------
const DH_DEPT_COST_MAP = {
  IT: 1200,
  CS: 1500,
  EE: 1300,
  ME: 1400,
  EC: 1350,
  ADM: 900
};

// ---------------------------
const TEAM_ROLE_BY_NAME = TEAM_DIRECTORY.reduce(
  (acc, m) => ({ ...acc, [m.name]: m.role }),
  {}
);

// Helper: format name + role
const formatAssignee = (name) => `${name} (${TEAM_ROLE_BY_NAME[name] || "Team Member"})`;

// Helper: location-based team selection
const getVisibleTeamByLocation = (locationCode, assigneeLoad) => {
  if (!locationCode) return [];
  const fixed = STATIC_LOCATION_TEAM[locationCode];
  if (fixed) return fixed;

  return [...PRIORITY_SUPPORT_TEAM].sort((a, b) => {
    const diff = (assigneeLoad[a] || 0) - (assigneeLoad[b] || 0);
    return diff !== 0 ? diff : PRIORITY_SUPPORT_TEAM.indexOf(a) - PRIORITY_SUPPORT_TEAM.indexOf(b);
  });
};

// Helper: fallback assignee updated
const getAssigneeForLocation = (locationCode, assigneeLoad) => {
  const visible = getVisibleTeamByLocation(locationCode, assigneeLoad);
  const selected = visible[0] || "Manikandan Kumar";
  return formatAssignee(selected);
};

// ---------------------------
// Demo Tickets (Updated)
// ---------------------------
const DEMO_TICKETS = [
  {
    id: "demo-1",
    location: "COB",
    ticketRaised: "Anita Sharma",
    ticketToBeIssued: "Tamilarasan P (Team Member)",
    gbCode: "NE-XC",
    aclType: "ACL",
    building: "Engineering Block A",
    floor: "2",
    labNo: "LAB-203",
    dhDeptCode: "EE",
    dhName: "Dr. Patel",
    cost: "1534.00",
    issueDescription: "Projector is flickering during lectures.",
    status: "OPEN"
  },
  {
    id: "demo-2",
    location: "HYD",
    ticketRaised: "Rohan Gupta",
    ticketToBeIssued: "Arunkumar M (Team Member)",
    gbCode: "NE-PG",
    aclType: "ACL",
    building: "Computer Science Wing",
    floor: "1",
    labNo: "LAB-107",
    dhDeptCode: "CS",
    dhName: "Ms. Johnson",
    cost: "1770.00",
    issueDescription: "12 systems need OS reinstallation and patching.",
    status: "IN_PROGRESS"
  },
  {
    id: "demo-3",
    location: "ADU",
    ticketRaised: "Meera Iyer",
    ticketToBeIssued: "Jagadish Sai V (Team Member)",
    gbCode: "2WP",
    aclType: "NON ACL",
    building: "Innovation Center",
    floor: "Ground",
    labNo: "LAB-011",
    dhDeptCode: "EC",
    dhName: "Mr. Lee",
    cost: "1350.00",
    issueDescription: "Biometric access device not syncing with server.",
    status: "RESOLVED"
  }
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
  if (isNaN(amount)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(amount);
};

const getAclType = (gbCode, deptCode) => {
  const gb = (gbCode || "").toUpperCase().trim();
  const dep = (deptCode || "").toUpperCase().trim();

  const aclDept = ["IT", "CS", "EE", "EC"].includes(dep);
  const gbZone = gb.startsWith("GB");

  return aclDept && gbZone ? "ACL" : "NON ACL";
};

const getCostFromDhDeptCode = (code, aclType) => {
  const base = DH_DEPT_COST_MAP[(code || "").toUpperCase().trim()];
  if (!base) return "";
  const multiplier = aclType === "ACL" ? 1.18 : 1;
  return (base * multiplier).toFixed(2);
};

const LOGIN_USERS = {
  requester: [{ username: "user", password: "user123", name: "Requester User" }],
  itl: [{ username: "itlteam", password: "itl123", name: "ITL Team" }],
  manager: [{ username: "manager", password: "manager123", name: "Manager" }]
};

const ROLE_TO_MODES = {
  requester: ["requester"],
  itl: ["requester", "assignee"],
  manager: ["manager"]
};

const MODE_LABELS = {
  requester: "Ticket Raising User",
  assignee: "Assigned To",
  manager: "Manager"
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

// ------------------------------------------------------------
// Main App Component
// ------------------------------------------------------------
export default function App() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const assigneeUsers = TEAM_DIRECTORY.filter(m => m.role === "Team Lead" || m.role === "Team Member");
  const managerUsers = TEAM_DIRECTORY.filter(m => m.role === "Manager" || m.role === "Group Manager");

  const [mode, setMode] = useState("requester");
  const [authUser, setAuthUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ role: "requester", username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [formData, setFormData] = useState(initialForm);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const [managerAccessKey, setManagerAccessKey] = useState("");

  // UPDATED DEFAULTS
  const [selectedAssignee, setSelectedAssignee] =
    useState(assigneeUsers[0]?.name ?? "Manikandan Kumar");

  const [selectedManager, setSelectedManager] =
    useState(managerUsers[0]?.name ?? "Shamji");

  const [managerChatInput, setManagerChatInput] = useState("");
  const [managerChatMessages, setManagerChatMessages] = useState([
    { role: "bot", text: "Manager AI Assistant: ask anything about tickets. I will answer and show a chart." }
  ]);

  const availableModes = authUser ? (ROLE_TO_MODES[authUser.role] || []) : [];

  const stats = useMemo(() => getTicketStats(tickets), [tickets]);

  const assigneeLoad = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const name = (t.ticketToBeIssued || "").split(" (")[0];
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return map;
  }, [tickets]);

  const visibleTeamForSelectedLocation = useMemo(
    () => getVisibleTeamByLocation(formData.location, assigneeLoad).map(formatAssignee),
    [formData.location, assigneeLoad]
  );

  const assignedTickets = useMemo(
    () => tickets.filter(t => (t.ticketToBeIssued || "").includes(selectedAssignee)),
    [tickets, selectedAssignee]
  );

  // ------------------------------------------------------------
  // Load Tickets
  // ------------------------------------------------------------
  const loadTickets = async () => {
    try {
      setError("");
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data);
      setUsingDemoData(false);
    } catch {
      setTickets(DEMO_TICKETS);
      setUsingDemoData(true);
      setError("Backend unavailable. Showing demo data.");
    }
  };

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("ticketing_auth_user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.role && ROLE_TO_MODES[parsed.role]) {
        setAuthUser(parsed);
        setMode(ROLE_TO_MODES[parsed.role][0]);
      }
    } catch {
      sessionStorage.removeItem("ticketing_auth_user");
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      setMode("requester");
      return;
    }
    if (!ROLE_TO_MODES[authUser.role].includes(mode)) {
      setMode(ROLE_TO_MODES[authUser.role][0]);
    }
  }, [authUser, mode]);

  // ------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const users = LOGIN_USERS[loginForm.role];
    const match = users?.find(
      u => u.username.toLowerCase() === loginForm.username.trim().toLowerCase() &&
           u.password === loginForm.password
    );

    if (!match) {
      setLoginError("Invalid credentials for selected role.");
      return;
    }

    const user = { name: match.name, role: loginForm.role };
    setAuthUser(user);
    sessionStorage.setItem("ticketing_auth_user", JSON.stringify(user));

    setMode(ROLE_TO_MODES[user.role][0]);
    setLoginForm({ role: "requester", username: "", password: "" });
  };

  const handleLogout = () => {
    setAuthUser(null);
    sessionStorage.removeItem("ticketing_auth_user");
    setError("");
    setNotice("");
    setFormData(initialForm);
  };

  // ------------------------------------------------------------
  // Ticket Form Logic
  // ------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "location") {
      const loc = value.toUpperCase();
      setFormData(prev => ({
        ...prev,
        location: loc,
        ticketToBeIssued: getAssigneeForLocation(loc, assigneeLoad)
      }));
      return;
    }

    if (name === "dhDeptCode") {
      const dept = value.toUpperCase();
      setFormData(prev => {
        const acl = getAclType(prev.gbCode, dept);
        return {
          ...prev,
          dhDeptCode: dept,
          aclType: acl,
          cost: getCostFromDhDeptCode(dept, acl)
        };
      });
      return;
    }

    if (name === "gbCode") {
      const gb = value.toUpperCase();
      setFormData(prev => {
        const acl = getAclType(gb, prev.dhDeptCode);
        return {
          ...prev,
          gbCode: gb,
          aclType: acl,
          cost: getCostFromDhDeptCode(prev.dhDeptCode, acl)
        };
      });
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const createTicket = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error("Failed to create ticket");

      const created = await res.json();
      setNotice(`Ticket raised by ${created.ticketRaised} and assigned to ${created.ticketToBeIssued}.`);
      setFormData(initialForm);
      loadTickets();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // ------------------------------------------------------------
  // Manager Chatbot
  // ------------------------------------------------------------
  const handleManagerChatSend = async () => {
    const msg = managerChatInput.trim();
    if (!msg) return;

    if (usingDemoData) {
      setManagerChatMessages(prev => [
        ...prev,
        { role: "user", text: msg },
        { role: "bot", text: "AI not available in demo mode." }
      ]);
      setManagerChatInput("");
      return;
    }

    setManagerChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setManagerChatInput("");

    try {
      const res = await fetch(`${API_URL}/manager-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: msg })
      });

      if (!res.ok) throw new Error("AI failed");

      const ai = await res.json();
      const chart = buildChartForFocus(ai.focus, tickets, ai.chartType);

      setManagerChatMessages(prev => [
        ...prev,
        { role: "bot", text: `${ai.answer} Showing ${chart.title}.`, chart }
      ]);

    } catch (err) {
      setManagerChatMessages(prev => [
        ...prev,
        { role: "bot", text: "Manager AI failed: " + err.message }
      ]);
    }
  };

  // ------------------------------------------------------------
  // UI RENDERING
  // ------------------------------------------------------------
  if (!authUser) {
    return (
      <div className="container">
        <header className="app-header">
          <div className="brand-row">
            <img src="/bosch-logo.svg" className="bosch-logo" />
            <div>
              <h1 className="brand">ITL</h1>
              <p className="brand-subtitle">Bosch Service Desk</p>
            </div>
          </div>
        </header>

        <section className="login-card">
          <h2>Sign In</h2>
          {loginError && <p className="error">{loginError}</p>}

          <form className="login-form" onSubmit={handleLogin}>
            <select
              value={loginForm.role}
              onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}
            >
              <option value="requester">User</option>
              <option value="itl">ITL Team</option>
              <option value="manager">Manager</option>
            </select>

            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />

            <button type="submit">Login</button>
          </form>

          <p className="login-help">
            Demo users: user/user123, itlteam/itl123, manager/manager123
          </p>
        </section>
      </div>
    );
  }

  // Authenticated layout --------------------------
  return (
    <div className="container">
      <header className="app-header">
        <div className="brand-row">
          <img src="/bosch-logo.svg" className="bosch-logo" />
          <div>
            <h1 className="brand">ITL</h1>
            <p className="brand-subtitle">Bosch Service Desk</p>
          </div>
        </div>

        <div className="auth-row">
          <p className="brand-subtitle">
            Signed in: {authUser.name} ({authUser.role.toUpperCase()})
          </p>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Mode Switch */}
      <div className="mode-switch">
        {availableModes.map((key) => (
          <button
            key={key}
            className={mode === key ? "active-tab" : ""}
            onClick={() => setMode(key)}
          >
            {MODE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* errors */}
      {usingDemoData && <p className="demo-note">Demo mode enabled</p>}
      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {/* --------------------------------------------------------
            REQUESTER MODE
         -------------------------------------------------------- */}
      {mode === "requester" && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); createTicket(); }} className="ticket-form">
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select Location</option>
              <option value="COB">COB</option>
              <option value="HYD">HYD</option>
              <option value="ADU">ADU</option>
              <option value="KOR">KOR</option>
              <option value="NHP">NHP</option>
              <option value="EC360">EC360</option>
            </select>

            <input name="ticketRaised" placeholder="Ticket Raised By"
              value={formData.ticketRaised} onChange={handleChange} required />

            <input name="ticketToBeIssued" placeholder="Ticket To Be Issued"
              value={formData.ticketToBeIssued} readOnly required />

            <input name="visibleTeam" placeholder="ITL Team For Location"
              value={visibleTeamForSelectedLocation.join(", ")} readOnly />

            <input name="gbCode" placeholder="GB Code"
              value={formData.gbCode} onChange={handleChange} required />

            <input name="aclType" placeholder="ACL Type"
              value={formData.aclType} readOnly required />

            <input name="building" placeholder="Building"
              value={formData.building} onChange={handleChange} required />

            <input name="floor" placeholder="Floor"
              value={formData.floor} onChange={handleChange} required />

            <input name="labNo" placeholder="Lab No"
              value={formData.labNo} onChange={handleChange} required />

            <input name="dhName" placeholder="DH Name"
              value={formData.dhName} onChange={handleChange} required />

            <input name="dhDeptCode" placeholder="DH Dept Code"
              value={formData.dhDeptCode} onChange={handleChange} required />

            <input name="cost" placeholder="Cost" value={formData.cost} readOnly />

            <textarea name="issueDescription" placeholder="Issue Description"
              value={formData.issueDescription} onChange={handleChange} rows={4} required />

            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Create Ticket"}
            </button>
          </form>
        </>
      )}

      {/* --------------------------------------------------------
            ASSIGNEE MODE
         -------------------------------------------------------- */}
      {mode === "assignee" && (
        <section>
          <h2>Assigned Tickets</h2>

          <div className="assignee-bar">
            <label htmlFor="assignee-select">Assignee:</label>
            <select
              id="assignee-select"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              {assigneeUsers.map(m => (
                <option key={m.name} value={m.name}>
