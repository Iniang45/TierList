import React, { useEffect, useState } from "react";
import TierlistCard from "./TierlistCard";
import { communityApi } from "../services/communityApi";

export default function CommunityFeed({ token, onRank, onOpenProfile }) {
  const [tierlists, setTierlists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");

  async function loadFeed() {
    setError("");
    try {
      const payload = await communityApi.publicFeed(token);
      setTierlists(payload.tierlists || []);
    } catch (err) {
      setError(err.message || "Impossible de charger le flux public");
    }
  }

  useEffect(() => {
    loadFeed();
  }, [token]);

  return (
    <div style={{ marginTop: 20 }}>
      <div className="gallery-section" style={{ marginBottom: 20 }}>
        <div className="gallery-section-header">
          <div>
            <h3>Communauté</h3>
            <span className="small">
              Tierlists publiques créées par d'autres personnes
            </span>
          </div>
          <button className="btn" onClick={loadFeed}>
            Rafraîchir
          </button>
        </div>
        {error && <div className="auth-error">{error}</div>}
      </div>

      <div className="gallery-grid">
        {tierlists.map((tierlist) => (
          <TierlistCard
            key={tierlist.id}
            tierlist={tierlist}
            expanded={expandedId === tierlist.id}
            onToggle={() =>
              setExpandedId((current) =>
                current === tierlist.id ? null : tierlist.id,
              )
            }
            onRank={onRank}
            onOpenProfile={onOpenProfile}
            showActions
            showRank
            showEdit={false}
            showDelete={false}
          />
        ))}
      </div>
    </div>
  );
}
