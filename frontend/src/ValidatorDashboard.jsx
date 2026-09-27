import { useEffect, useState } from "react";
import { BrowserProvider } from "ethers";
import { api } from "./api";
import "./Dashboard.css";

export default function ValidatorDashboard({ username, onLogout }) {
  const [elections, setElections] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => setElections(await api("/api/validator/elections"));

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const connectWallet = async () => {
    if (!window.ethereum) throw new Error("Install a wallet extension to approve elections");
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const challenge = await api("/api/auth/wallet/challenge", { method: "POST" });
    const signature = await signer.signMessage(challenge.message);
    await api("/api/auth/wallet", { method: "POST", body: JSON.stringify({ address, signature }) });
    const connected = { provider, signer, address };
    setWallet(connected);
    return connected;
  };

  const act = async (election, action) => {
    setError("");
    try {
      const connection = wallet || await connectWallet();
      const prepared = await api(`/api/validator/elections/${election.id}/${action}/prepare`, { method: "POST" });
      setStatus(`Sign ${action} transaction in your wallet...`);
      const transaction = await connection.signer.sendTransaction({ to: prepared.to, data: prepared.data });
      setStatus("Waiting for validator transaction confirmation...");
      await transaction.wait();
      await api(`/api/validator/elections/${election.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ txHash: transaction.hash, action }),
      });
      setStatus(`${action} recorded on-chain: ${transaction.hash}`);
      await load();
    } catch (err) {
      setStatus("");
      setError(err.message);
    }
  };

  return (
    <div className="dashboard-layout">
      <nav className="sidebar">
        <div className="sidebar-header"><h2>Validator Portal</h2><p>{username}</p></div>
        <div className="sidebar-footer"><button className="logout-btn" onClick={onLogout}>Logout</button></div>
      </nav>
      <main className="main-content">
        <div className="content-card">
          {error && <div className="status-notification error">{error}</div>}
          <div className="tab-pane">
            <h3>Election approvals</h3>
            <p className="description">Each approval is signed by this validator wallet and counted by the contract.</p>
            <div className="elections-grid">
              {elections.map((election) => (
                <div className="election-card" key={election.id}>
                  <div><h4>{election.name}</h4><p className="muted">{election.approvalCount}/2 approvals</p></div>
                  <div className="card-actions">
                    <span className={`badge ${election.approved ? "open" : election.rejected ? "closed" : "upcoming"}`}>{election.rejected ? "rejected" : election.approved ? "approved" : "pending"}</span>
                    {!election.approved && !election.rejected && <><button className="action-btn" onClick={() => act(election, "approve")}>Approve</button><button className="action-btn danger" onClick={() => act(election, "reject")}>Reject</button></>}
                  </div>
                </div>
              ))}
            </div>
            {status && <div className="status-notification">{status}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
