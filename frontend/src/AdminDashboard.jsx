import { useEffect, useState } from "react";
import { api } from "./api";
import "./Dashboard.css";

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminDashboard({ username, onLogout }) {
  const [tab, setTab] = useState("elections");
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    startTime: toLocalInput(Date.now()),
    endTime: toLocalInput(Date.now() + 24 * 60 * 60 * 1000),
  });
  const [candidateName, setCandidateName] = useState("");
  const [eligibleWallet, setEligibleWallet] = useState("");

  const loadElections = async () => {
    const data = await api("/api/admin/elections");
    setElections(data);
  };

  const openElection = async (id) => {
    const data = await api(`/api/admin/elections/${id}`);
    setSelected(data);
    setTab("manage");
  };

  useEffect(() => {
    loadElections().catch((err) => setError(err.message));
  }, []);

  const createElection = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("Writing election to blockchain...");
    try {
      await api("/api/admin/elections", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setStatus("Election created on-chain.");
      setForm({ ...form, name: "", description: "" });
      await loadElections();
      setTab("elections");
    } catch (err) {
      setStatus("");
      setError(err.message);
    }
  };

  const addCandidate = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      await api(`/api/admin/elections/${selected.id}/candidates`, {
        method: "POST",
        body: JSON.stringify({ name: candidateName }),
      });
      setCandidateName("");
      await openElection(selected.id);
      await loadElections();
    } catch (err) {
      setError(err.message);
    }
  };

  const closeElection = async () => {
    if (!selected) return;
    try {
      await api(`/api/admin/elections/${selected.id}/close`, { method: "POST" });
      await openElection(selected.id);
      await loadElections();
    } catch (err) {
      setError(err.message);
    }
  };

  const setEligibility = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      await api(`/api/admin/elections/${selected.id}/eligibility`, {
        method: "POST",
        body: JSON.stringify({ walletAddress: eligibleWallet, eligible: true }),
      });
      setEligibleWallet("");
      setStatus("Wallet eligibility recorded on blockchain.");
    } catch (err) {
      setError(err.message);
    }
  };

  const maxVotes = selected?.candidates?.reduce((max, c) => Math.max(max, c.voteCount || 0), 0) || 1;

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Admin Portal</h2>
          <p>{username}</p>
        </div>
        <ul className="nav-links">
          <li className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
            Create election
          </li>
          <li className={tab === "elections" || tab === "manage" ? "active" : ""} onClick={() => setTab("elections")}>
            Elections
          </li>
        </ul>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <main className="main-content">
        <div className="content-card">
          {error && <div className="status-notification error">{error}</div>}

          {tab === "create" && (
            <div className="tab-pane">
              <h3>Create election</h3>
              <p className="description">The election window and name are stored on the blockchain.</p>
              <form className="dashboard-form" onSubmit={createElection}>
                <div className="form-group">
                  <label>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Starts</label>
                    <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Ends</label>
                    <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                  </div>
                </div>
                <button className="action-btn" type="submit">Create on blockchain</button>
              </form>
              {status && <div className="status-notification">{status}</div>}
            </div>
          )}

          {tab === "elections" && (
            <div className="tab-pane">
              <h3>Elections</h3>
              <p className="description">Open an election to add candidates, close voting, and see live tallies.</p>
              <div className="elections-grid">
                {elections.length === 0 && <p className="muted">No elections yet.</p>}
                {elections.map((election) => (
                  <div className="election-card" key={election.id}>
                    <div>
                      <h4>{election.name}</h4>
                      <p className="muted">{election.candidateCount} candidates</p>
                    </div>
                    <div className="card-actions">
                      <span className={`badge ${election.status}`}>{election.status}</span>
                      <button className="action-btn secondary" onClick={() => openElection(election.id)}>Manage</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "manage" && selected && (
            <div className="tab-pane">
              <h3>{selected.name}</h3>
              <p className="description">{selected.description || "On-chain election with MongoDB metadata."}</p>
              <p className="muted">Chain ID #{selected.chainElectionId} · <span className={`badge ${selected.status}`}>{selected.status}</span></p>

              {selected.status !== "closed" && (
                <>
                  <form className="dashboard-form" onSubmit={addCandidate} style={{ marginTop: 24 }}>
                    <div className="form-group">
                      <label>Add candidate</label>
                      <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} required />
                    </div>
                    <button className="action-btn" type="submit">Add on blockchain</button>
                  </form>
                  <form className="dashboard-form" onSubmit={setEligibility} style={{ marginTop: 16 }}>
                    <div className="form-group">
                      <label>Eligible voter wallet</label>
                      <input value={eligibleWallet} onChange={(e) => setEligibleWallet(e.target.value)} placeholder="0x..." required />
                    </div>
                    <button className="action-btn" type="submit">Add eligible wallet</button>
                  </form>
                  <button className="action-btn danger" style={{ marginTop: 16 }} onClick={closeElection}>
                    Close election
                  </button>
                </>
              )}

              <div className="candidates-grid" style={{ marginTop: 28 }}>
                {(selected.candidates || []).map((candidate) => (
                  <div className="candidate-card" key={candidate.id}>
                    <div style={{ flex: 1 }}>
                      <h4>{candidate.name}</h4>
                      <p className="muted">{candidate.voteCount} votes</p>
                      <div className="bar">
                        <span style={{ width: `${((candidate.voteCount || 0) / maxVotes) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selected.createTxHash && (
                <p className="hash-text" style={{ marginTop: 20 }}>Create tx: {selected.createTxHash}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
