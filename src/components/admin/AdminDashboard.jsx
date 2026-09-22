import React, { useEffect, useState } from "react";
import { communityApi } from "../../services/communityApi";
import "./AdminDashboard.css";

export default function AdminDashboard({
  token,
  onViewTierlist,
  onEditTierlist,
  onOpenProfile,
}) {
  const [users, setUsers] = useState([]);
  const [tierlists, setTierlists] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const [usersPayload, tierlistsPayload] = await Promise.all([
        communityApi.adminUsers(token),
        communityApi.adminTierlists(token),
      ]);
      setUsers(usersPayload.users || []);
      setTierlists(tierlistsPayload.tierlists || []);
    } catch (err) {
      setError(err.message || "Impossible de charger les données admin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [token]);

  async function deleteTierlist(id) {
    if (!window.confirm("Supprimer définitivement cette tierlist ?")) return;
    await communityApi.adminDeleteTierlist(token, id);
    setTierlists((current) => current.filter((tierlist) => tierlist.id !== id));
  }

  async function deleteUser(id) {
    if (!window.confirm("Supprimer cet utilisateur et ses tierlists ?")) return;
    await communityApi.adminDeleteUser(token, id);
    setUsers((current) => current.filter((user) => user.id !== id));
    setTierlists((current) =>
      current.filter((tierlist) => tierlist.ownerId !== id),
    );
  }

  if (loading)
    return <div className="admin-page">Chargement de l'administration...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <p className="admin-eyebrow">Accès total</p>
          <h2>Administration</h2>
          <p className="small">
            Tous les profils et toutes les tierlists, publiques ou privées.
          </p>
        </div>
        <button className="btn" onClick={loadAdminData}>
          Rafraîchir
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <section className="admin-section">
        <div className="admin-section-header">
          <h3>Profils ({users.length})</h3>
        </div>
        <div className="admin-user-list">
          {users.map((user) => (
            <div className="admin-user-row" key={user.id}>
              <button
                className="admin-user-main"
                onClick={() => onOpenProfile(user.id)}
              >
                <img src={user.avatar || "https://placehold.co/40x40"} alt="" />
                <span>
                  <strong>{user.displayName || user.userId}</strong>
                  <small>
                    @{user.userId} {user.role === "admin" ? "· admin" : ""}
                  </small>
                </span>
              </button>
              {user.role !== "admin" && (
                <button className="btn" onClick={() => deleteUser(user.id)}>
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <h3>Tierlists ({tierlists.length})</h3>
        </div>
        <div className="admin-tierlist-list">
          {tierlists.map((tierlist) => (
            <div className="admin-tierlist-row" key={tierlist.id}>
              <div>
                <strong>{tierlist.name}</strong>
                <small>
                  {tierlist.type === "ranking" ? "Ranking" : "Modèle"} ·{" "}
                  {tierlist.visibility} ·{" "}
                  {tierlist.owner?.userId || "propriétaire inconnu"}
                </small>
              </div>
              <div className="admin-row-actions">
                <button
                  className="btn secondary"
                  onClick={() => onViewTierlist(tierlist)}
                >
                  Voir
                </button>
                <button
                  className="btn"
                  onClick={() => onEditTierlist(tierlist)}
                >
                  Modifier
                </button>
                <button
                  className="btn"
                  onClick={() => deleteTierlist(tierlist.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
