import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  contrastTextColor,
  createDefaultTiers,
  saveTemporaryTierlist,
  uid,
} from "../../utils/tierlists";
import { communityApi } from "../../services/communityApi";
import "./RankTierList.css";

export default function RankTierList({
  token,
  template,
  initialData,
  onBack,
  onSave,
  readOnly = false,
}) {
  const [ranking, setRanking] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const sourceRecord =
      initialData?.type === "ranking" ? initialData : template;

    if (sourceRecord) {
      const sourceItems =
        Array.isArray(sourceRecord.items) && sourceRecord.items.length > 0
          ? sourceRecord.items
          : Array.isArray(sourceRecord.images)
            ? sourceRecord.images
            : Array.isArray(sourceRecord.assets)
              ? sourceRecord.assets
              : [];

      const ranked =
        sourceRecord.type === "ranking"
          ? {
              ...sourceRecord,
              tiers: sourceRecord.tiers?.length
                ? sourceRecord.tiers
                : createDefaultTiers(),
              items: sourceItems.map((img) => ({
                id: img.id,
                src: img.src,
                text: img.text || "",
                explanation: img.explanation || "",
                tierId:
                  Object.prototype.hasOwnProperty.call(img, "tierId") &&
                  img.tierId !== undefined
                    ? img.tierId
                    : null,
              })),
              images: sourceItems.map((img) => ({
                id: img.id,
                src: img.src,
                text: img.text || "",
              })),
            }
          : {
              id: uid(),
              type: "ranking",
              templateId: sourceRecord.id,
              name: sourceRecord.name,
              description: sourceRecord.description,
              visibility: sourceRecord.visibility || "private",
              originalTierlistId: sourceRecord.id,
              tiers: sourceRecord.tiers?.length
                ? sourceRecord.tiers
                : createDefaultTiers(),
              items: sourceItems.map((img) => ({
                id: img.id,
                src: img.src,
                text: img.text || "",
                explanation: "",
                tierId: null,
              })),
              images: sourceItems.map((img) => ({
                id: img.id,
                src: img.src,
                text: img.text || "",
              })),
              created: Date.now(),
            };
      setRanking(ranked);
    }
  }, [template, initialData]);

  function onDragStart(ev, itemId) {
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", itemId);
  }

  function onDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  }

  function onDropToTier(ev, tierId) {
    ev.preventDefault();
    const itemId = ev.dataTransfer.getData("text/plain");
    setRanking((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, tierId } : it,
      ),
    }));
  }

  function updateItemExplanation(itemId, explanation) {
    setRanking((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId ? { ...it, explanation } : it,
      ),
    }));
  }

  async function downloadAsImage() {
    if (!containerRef.current) return;

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        onclone: (documentClone) => {
          const unranked = documentClone.querySelector(
            '[data-unranked="true"]',
          );
          if (unranked) {
            unranked.remove();
          }
        },
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${ranking.name.replace(/\s+/g, "_")}.png`;
      link.click();
    } catch (err) {
      console.error("Erreur lors du téléchargement:", err);
    }
  }

  async function saveRanking() {
    setSaving(true);
    setError("");
    try {
      let savedRanking = ranking;
      if (token) {
        const payload = await communityApi.createTierlist(token, {
          ...ranking,
          originalTierlistId: ranking.templateId,
        });
        savedRanking = payload.tierlist;
      }
      if (!token) {
        saveTemporaryTierlist(savedRanking);
      }
      setSaving(false);
      onSave?.(savedRanking);
    } catch (err) {
      setError(err.message || "Impossible de sauvegarder ce classement");
      setSaving(false);
    }
  }

  if (!ranking) return <div>Chargement...</div>;

  return (
    <div className="rank-page">
      <div className="rank-header">
        <div>
          <h2>{ranking.name}</h2>
          {ranking.description && (
            <p className="small rank-description">{ranking.description}</p>
          )}
        </div>
        <div className="rank-actions">
          <button className="btn" onClick={onBack}>
            Retour
          </button>
          <button className="btn secondary" onClick={downloadAsImage}>
            Télécharger en PNG
          </button>
          {!readOnly && (
            <button
              className="btn primary"
              onClick={saveRanking}
              disabled={saving}
            >
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          )}
        </div>
      </div>
      {error && <div className="auth-error rank-error">{error}</div>}

      <div className="layout">
        <div className="editor">
          <div ref={containerRef} className="rank-board">
            {ranking.tiers.map((tier) => (
              <div
                key={tier.id}
                className="tier tier-spacing"
                onDragOver={onDragOver}
                onDrop={(ev) => onDropToTier(ev, tier.id)}
              >
                <div
                  className="tier-label"
                  style={{
                    "--tier-color": tier.color,
                    "--tier-text-color": contrastTextColor(tier.color),
                  }}
                >
                  {tier.name}
                </div>
                <div className="cards">
                  {ranking.items
                    .filter((it) => it.tierId === tier.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        draggable={!readOnly}
                        onDragStart={(ev) => onDragStart(ev, item.id)}
                        onClick={() => setExpandedItem(item.id)}
                      >
                        <div className="card">
                          <img src={item.src} alt={item.text} />
                          {item.text && (
                            <div className="overlay">{item.text}</div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* Unranked items */}
            {ranking.items.some((it) => !it.tierId) && (
              <div
                className="tier unranked-tier"
                data-unranked="true"
                onDragOver={onDragOver}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const itemId = ev.dataTransfer.getData("text/plain");
                  setRanking((prev) => ({
                    ...prev,
                    items: prev.items.map((it) =>
                      it.id === itemId ? { ...it, tierId: null } : it,
                    ),
                  }));
                }}
              >
                <div className="tier-label unranked-label">À ranger</div>
                <div className="cards">
                  {ranking.items
                    .filter((it) => !it.tierId)
                    .map((item) => (
                      <div
                        key={item.id}
                        draggable={!readOnly}
                        onDragStart={(ev) => onDragStart(ev, item.id)}
                        onClick={() => setExpandedItem(item.id)}
                      >
                        <div className="card">
                          <img src={item.src} alt={item.text} />
                          {item.text && (
                            <div className="overlay">{item.text}</div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="side">
          <div className="side-panel">
            <div className="details-title">Détails</div>

            {expandedItem ? (
              <>
                {(() => {
                  const item = ranking.items.find((i) => i.id === expandedItem);
                  return item ? (
                    <div>
                      <img
                        src={item.src}
                        alt={item.text}
                        className="details-image"
                      />
                      {item.text && (
                        <div className="details-block">
                          <div className="small details-label">Titre</div>
                          <div className="details-value">{item.text}</div>
                        </div>
                      )}
                      {!readOnly && (
                        <div className="input-group">
                          <label>Pourquoi ce placement ?</label>
                          <textarea
                            value={item.explanation}
                            onChange={(e) =>
                              updateItemExplanation(item.id, e.target.value)
                            }
                            placeholder="Ajoutez votre justification..."
                            className="details-textarea"
                          />
                        </div>
                      )}
                      {!readOnly && (
                        <button
                          className="btn details-close"
                          onClick={() => setExpandedItem(null)}
                        >
                          Fermer
                        </button>
                      )}
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <div className="small">
                Cliquez sur une image pour ajouter une explication de son
                placement.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
