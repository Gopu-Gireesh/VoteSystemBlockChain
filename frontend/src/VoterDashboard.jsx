import { useEffect, useState } from "react";
import { api } from "./api";
import { BrowserProvider } from "ethers";
import "./Dashboard.css";

export default function VoterDashboard({ username, onLogout }) {
  const [elections, setElections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [votingId, setVotingId] = useState(null);
  const [wallet, setWallet] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) throw new Error("Install a wallet extension to vote");
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const challenge = await api("/api/auth/wallet/challenge", { method: "POST" });
    const signature = await signer.signMessage(challenge.message);
    await api("/api/auth/wallet", {
      method: "POST",
      body: JSON.stringify({ address, signature }),
    });
    setWallet({ provider, signer, address });
    return { provider, signer, address };
  };

  const loadList = async () => {
    setElections(await api("/api/voter/elections"));
  };

  const openElection = async (id) => {
    setError("");
    setSelected(await api(`/api/voter/elections/${id}`));
  };

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, []);

  const vote = async (candidateId) => {
    if (!selected) return;
    setVotingId(candidateId);
    setError("");
    setStatus("Connecting wallet and preparing ballot...");
    try {
      const connection = wallet || await connectWallet();
      const prepared = await api(`/api/voter/elections/${selected.id}/vote/prepare`, {
        method: "POST",
        body: JSON.stringify({ candidateId }),
      });
      setStatus("Sign the ballot in your wallet...");
      const transaction = await connection.signer.sendTransaction({ to: prepared.to, data: prepared.data });
      setStatus("Waiting for blockchain confirmation...");
      await transaction.wait();
      const result = await api(`/api/voter/elections/${selected.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ candidateId, txHash: transaction.hash }),
      });
      setStatus(`Vote confirmed. Tx: ${result.txHash}`);
      await openElection(selected.id);
      await loadList();
    } catch (err) {
      setStatus("");
      setError(err.message);
    } finally {
      setVotingId(null);
    }
  };

  const maxVotes =
    selected?.candidates?.reduce((max, c) => Math.max(max, c.voteCount || 0), 0) || 1;

  return (
    <div className="dashboard-layout center-theme">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Voter Portal</h2>
          <p>{username}</p>
        </div>
        <ul className="nav-links">
          <li className={!selected ? "active" : ""} onClick={() => setSelected(null)}>
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

          {!selected && (
            <div className="tab-pane">
              <h3>Available elections</h3>
              <p className="description">Your identity is checked off-chain. The ballot itself is recorded on-chain.</p>
              <div className="elections-grid">
                {elections.map((election) => (
                  <div className="election-card" key={election.id}>
                    <div>
                      <h4>{election.name}</h4>
                      <p className="muted">{election.hasVoted ? "Ballot submitted" : "You have not voted"}</p>
                    </div>
                    <div className="card-actions">
                      <span className={`badge ${election.status}`}>{election.status}</span>
                      <button className="action-btn" onClick={() => openElection(election.id)}>Open</button>
                    </div>
                  </div>
                ))}
                {elections.length === 0 && <p className="muted">No elections yet.</p>}
              </div>
            </div>
          )}

          {selected && (
            <div className="tab-pane">
              <button className="action-btn secondary" onClick={() => setSelected(null)}>Back</button>
              <h3 style={{ marginTop: 20 }}>{selected.name}</h3>
              <p className="description">{selected.description || "Select one candidate. You can vote only once."}</p>
              <span className={`badge ${selected.status}`}>{selected.status}</span>

              <div className="candidates-grid" style={{ marginTop: 24 }}>
                {(selected.candidates || []).map((candidate) => (
                  <div className="candidate-card" key={candidate.id}>
                    <div style={{ flex: 1 }}>
                      <h4>{candidate.name}</h4>
                      {candidate.voteCount != null && (
                        <>
                          <p className="muted">{candidate.voteCount} votes</p>
                          <div className="bar">
                            <span style={{ width: `${((candidate.voteCount || 0) / maxVotes) * 100}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                    {selected.status === "open" && !selected.hasVoted && (
                      <button
                        className="vote-btn"
                        disabled={votingId === candidate.id}
                        onClick={() => vote(candidate.id)}
                      >
                        {votingId === candidate.id ? "Voting..." : "Vote"}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {selected.hasVoted && (
                <p className="hash-text" style={{ marginTop: 20 }}>
                  Receipt: {selected.receiptTxHash}
                </p>
              )}
              {status && <div className="status-notification">{status}</div>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
