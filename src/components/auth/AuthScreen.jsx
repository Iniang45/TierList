import React, { useState } from "react";
import "./AuthScreen.css";

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        await onLogin({ userId, password });
      } else {
        await onRegister({ userId, password, displayName });
      }
    } catch (err) {
      setError(err.message || "Connexion impossible");
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <h2>TierList Studio</h2>
          <p className="small">
            Connectez-vous pour accéder aux listes communautaires.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`btn ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Se connecter
          </button>
          <button
            className={`btn ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Id utilisateur
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              required
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {mode === "register" && (
            <label>
              Nom affiché
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ex: Alex"
              />
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="btn primary" type="submit">
            {mode === "login" ? "Entrer" : "Créer le compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
