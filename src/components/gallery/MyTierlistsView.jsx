import React, { useEffect, useState } from "react";
import TierlistCard from "./TierlistCard";
import "./MyTierlistsView.css";

export default function MyTierlistsView({
  tierlists,
  onEdit,
  onRank,
  onView,
  onDelete,
  onOpenProfile,
}) {
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setExpandedId(null);
  }, [tierlists]);

  const createdTierlists = tierlists.filter(
    (tierlist) => tierlist.type === "template",
  );
  const rankedTierlists = tierlists.filter(
    (tierlist) => tierlist.type === "ranking",
  );

  return (
    <div className="gallery-sections">
      <div className="gallery-section">
        <div className="gallery-section-header">
          <h3>Tierlists créées</h3>
          <span className="small">Vos tierlists de base</span>
        </div>
        <div className="gallery-grid">
          {createdTierlists.length === 0 ? (
            <div className="small">Aucune tierlist créée.</div>
          ) : (
            createdTierlists.map((tierlist) => (
              <TierlistCard
                key={tierlist.id}
                tierlist={tierlist}
                expanded={expandedId === tierlist.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === tierlist.id ? null : tierlist.id,
                  )
                }
                onEdit={onEdit}
                onRank={onRank}
                onView={onView}
                onDelete={onDelete}
                onOpenProfile={onOpenProfile}
                showActions
                showEdit
                showRank={
                  tierlist.visibility === "public" ||
                  tierlist.visibility === "private"
                }
                showDelete
              />
            ))
          )}
        </div>
      </div>

      <div className="gallery-section">
        <div className="gallery-section-header">
          <h3>Tierlists rangées</h3>
          <span className="small">Vos classements sauvegardés</span>
        </div>
        <div className="gallery-grid">
          {rankedTierlists.length === 0 ? (
            <div className="small">Aucune tierlist rangée.</div>
          ) : (
            rankedTierlists.map((tierlist) => (
              <TierlistCard
                key={tierlist.id}
                tierlist={tierlist}
                expanded={expandedId === tierlist.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === tierlist.id ? null : tierlist.id,
                  )
                }
                onEdit={onEdit}
                onRank={onRank}
                onView={onView}
                onDelete={onDelete}
                onOpenProfile={onOpenProfile}
                showActions
                showEdit
                showView
                showDelete
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
