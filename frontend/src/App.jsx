import { useEffect, useState } from "react";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import VoterDashboard from "./VoterDashboard";
import ValidatorDashboard from "./ValidatorDashboard";

function readSession() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return { role: payload.role, username: payload.username || "" };
  } catch {
    localStorage.removeItem("token");
    return null;
  }
}

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(readSession());
  }, []);

  const handleLogin = (role, username) => {
    setSession({ role, username });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setSession(null);
  };

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  if (session.role === "Admin") {
    return <AdminDashboard username={session.username} onLogout={handleLogout} />;
  }

  if (session.role === "Validator") {
    return <ValidatorDashboard username={session.username} onLogout={handleLogout} />;
  }

  return <VoterDashboard username={session.username} onLogout={handleLogout} />;
}

export default App;
