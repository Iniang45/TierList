import React, { useEffect, useState } from "react";
import TierlistCard from "../gallery/TierlistCard";
import { communityApi } from "../../services/communityApi";
import "./CommunityFeed.css";

export default function CommunityFeed({
  token,
  onRank,
  onView,
  onCopy,
  onOpenProfile,
}) {
  const [createdTierlists, setCreatedTierlists] = useState([]);
  const [rankedTierlists, setRankedTierlists] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");

  async function loadFeed() {
    setError("");
    try {
      const payload = await communityApi.publicFeed(token);
      setCreatedTierlists(payload.createdTierlists || []);
      setRankedTierlists(payload.rankedTierlists || []);
    } catch (err) {
      setError(err.message || "Impossible de charger le flux public");
    }
  }

  useEffect(() => {
    loadFeed();
  }, [token]);

  return (
    <div className="community-page">
      <div className="community-toolbar">
        <span className="small">Découvrez les tierlists publiques</span>
        <button
          className="community-refresh-button"
          onClick={loadFeed}
          title="Rafraîchir la communauté"
          aria-label="Rafraîchir la communauté"
        >
          ↻
        </button>
        {error && <div className="auth-error">{error}</div>}
      </div>

      <section className="community-section">
        <div className="gallery-section-header">
          <div>
            <h3>Tierlists créées</h3>
            <span className="small">
              Tierlists publiques des autres utilisateurs
            </span>
          </div>
        </div>
        <div className="gallery-grid">
          {createdTierlists.map((tierlist) => (
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
              onCopy={onCopy}
              onOpenProfile={onOpenProfile}
              showActions
              showRank={tierlist.type === "template"}
              showView={false}
              showCopy
              showEdit={false}
              showDelete={false}
            />
          ))}
        </div>
      </section>

      <section className="community-section">
        <div className="gallery-section-header">
          <div>
            <h3>Tierlists rangées par mes amis</h3>
            <span className="small">
              Les rankings publics de votre réseau uniquement
            </span>
          </div>
        </div>
        <div className="gallery-grid">
          {rankedTierlists.map((tierlist) => (
            <TierlistCard
              key={tierlist.id}
              tierlist={tierlist}
              expanded={expandedId === tierlist.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === tierlist.id ? null : tierlist.id,
                )
              }
              onView={onView}
              onOpenProfile={onOpenProfile}
              showActions
              showView
              showRank={false}
              showEdit={false}
              showDelete={false}
            />
          ))}
        </div>
        {rankedTierlists.length === 0 && (
          <p className="small community-empty">
            Aucun ranking public de vos amis.
          </p>
        )}
      </section>
    </div>
  );
}
