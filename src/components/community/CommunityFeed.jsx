import React, { useEffect, useState } from "react";
import TierlistCard from "../gallery/TierlistCard";
import { communityApi } from "../../services/communityApi";
import "./CommunityFeed.css";

export default function CommunityFeed({
  token,
  onRank,
  onView,
  onOpenProfile,
}) {
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
    <div className="community-page">
      <div className="gallery-section community-header">
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
            onView={onView}
            onOpenProfile={onOpenProfile}
            showActions
            showRank={tierlist.type === "template"}
            showView={tierlist.type === "ranking"}
            showEdit={false}
            showDelete={false}
          />
        ))}
      </div>
    </div>
  );
}
