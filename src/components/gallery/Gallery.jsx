import React, { useEffect, useMemo, useState } from "react";
import {
  deleteTierlistRecord,
  loadSavedTierlists,
} from "../../utils/tierlists";
import "./Gallery.css";

function getCoverSrc(template) {
  if (template?.coverImage?.src) {
    return template.coverImage.src;
  }

  const firstImage = (template?.images || template?.items || [])[0];
  return firstImage?.src || "";
}

function getCardLabel(template) {
  return template?.name || "Sans titre";
}

function TierCard({ template, expanded, onToggle, onEdit, onRank, onRemove }) {
  const isRanking = template.type === "ranking";
  const coverSrc = getCoverSrc(template);

  return (
    <div className="gallery-card">
      <div
        className="gallery-card-shell"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="gallery-card-cover">
          {coverSrc ? (
            <img src={coverSrc} alt={getCardLabel(template)} />
          ) : (
            <div className="gallery-card-fallback">Aucune image</div>
          )}
        </div>
        <div className="gallery-card-title">{getCardLabel(template)}</div>
      </div>

      {expanded && (
        <div className="gallery-card-details">
          {template.description && <p>{template.description}</p>}
          <div className="gallery-card-actions">
            <button className="btn" onClick={() => onEdit(template)}>
              Modifier
            </button>
            {!isRanking && (
              <button
                className="btn secondary"
                onClick={() => onRank(template)}
              >
                Ranger
              </button>
            )}
            <button className="btn" onClick={() => onRemove(template.id)}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Gallery({ onRank, onEdit }) {
  const [templates, setTemplates] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setTemplates(loadSavedTierlists());
  }, []);

  function refreshTemplates() {
    setTemplates(loadSavedTierlists());
  }

  function remove(id) {
    deleteTierlistRecord(id);
    setExpandedId((current) => (current === id ? null : current));
    refreshTemplates();
  }

  const createdTemplates = useMemo(
    () => templates.filter((template) => template.type !== "ranking"),
    [templates],
  );
  const rankedTemplates = useMemo(
    () => templates.filter((template) => template.type === "ranking"),
    [templates],
  );

  return (
    <div className="gallery-page">
      <h2>Mes TierLists</h2>

      {templates.length === 0 ? (
        <div className="empty-gallery">
          <p className="small">Aucune tierlist créée pour l'instant.</p>
        </div>
      ) : (
        <div className="gallery-sections">
          <div className="gallery-section">
            <div className="gallery-section-header">
              <h3>Tierlists créées</h3>
              <span className="small">
                Celles que vous pouvez encore ranger
              </span>
            </div>
            <div className="gallery-grid">
              {createdTemplates.length === 0 ? (
                <div className="small">Aucune tierlist créée.</div>
              ) : (
                createdTemplates.map((template) => (
                  <TierCard
                    key={template.id}
                    template={template}
                    expanded={expandedId === template.id}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === template.id ? null : template.id,
                      )
                    }
                    onEdit={onEdit}
                    onRank={onRank}
                    onRemove={remove}
                  />
                ))
              )}
            </div>
          </div>

          <div className="gallery-section">
            <div className="gallery-section-header">
              <h3>Tierlists rangées et sauvegardées</h3>
              <span className="small">Le classement final</span>
            </div>
            <div className="gallery-grid">
              {rankedTemplates.length === 0 ? (
                <div className="small">Aucune tierlist rangée.</div>
              ) : (
                rankedTemplates.map((template) => (
                  <TierCard
                    key={template.id}
                    template={template}
                    expanded={expandedId === template.id}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === template.id ? null : template.id,
                      )
                    }
                    onEdit={onEdit}
                    onRank={onRank}
                    onRemove={remove}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
