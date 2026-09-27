import { useState } from "react";
import { api } from "./api";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("token", data.token);
      onLogin(data.role, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1>ChainVote</h1>
          <p>Sign in to create elections or cast a blockchain ballot.</p>
          {error && (
            <div className="error-message" style={{ color: "#fca5a5", marginTop: "10px" }}>
              {error}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin or voter1"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className={`login-button ${isLoading ? "loading" : ""}`} disabled={isLoading}>
            {isLoading ? <span className="loader"></span> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
