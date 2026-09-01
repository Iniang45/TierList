import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  contrastTextColor,
  createDefaultTiers,
  saveTierlistRecord,
  uid,
} from "../utils/tierlists";

export default function RankTierList({ template, initialData, onBack }) {
  const [ranking, setRanking] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
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

  function saveRanking() {
    saveTierlistRecord(ranking);
  }

  if (!ranking) return <div>Chargement...</div>;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2>{ranking.name}</h2>
          {ranking.description && (
            <p className="small" style={{ margin: "8px 0 0 0" }}>
              {ranking.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn" onClick={onBack}>
            Retour
          </button>
          <button className="btn secondary" onClick={downloadAsImage}>
            Télécharger en PNG
          </button>
          <button className="btn primary" onClick={saveRanking}>
            Sauvegarder
          </button>
        </div>
      </div>

      <div className="layout">
        <div className="editor">
          <div
            ref={containerRef}
            style={{
              background: "var(--card)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {ranking.tiers.map((tier) => (
              <div
                key={tier.id}
                className="tier"
                onDragOver={onDragOver}
                onDrop={(ev) => onDropToTier(ev, tier.id)}
                style={{ marginBottom: 16 }}
              >
                <div
                  className="tier-label"
                  style={{
                    background: tier.color,
                    color: contrastTextColor(tier.color),
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
                        draggable
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
                className="tier"
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
                style={{ marginTop: 16, opacity: 0.6, borderStyle: "dashed" }}
              >
                <div
                  className="tier-label"
                  style={{ background: "#e5e7eb", color: "#111827" }}
                >
                  À ranger
                </div>
                <div className="cards">
                  {ranking.items
                    .filter((it) => !it.tierId)
                    .map((item) => (
                      <div
                        key={item.id}
                        draggable
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
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Détails</div>

            {expandedItem ? (
              <>
                {(() => {
                  const item = ranking.items.find((i) => i.id === expandedItem);
                  return item ? (
                    <div>
                      <img
                        src={item.src}
                        alt={item.text}
                        style={{
                          width: "100%",
                          height: 150,
                          objectFit: "cover",
                          borderRadius: 10,
                          marginBottom: 12,
                        }}
                      />
                      {item.text && (
                        <div style={{ marginBottom: 12 }}>
                          <div className="small" style={{ marginBottom: 4 }}>
                            Titre
                          </div>
                          <div style={{ fontWeight: 500 }}>{item.text}</div>
                        </div>
                      )}
                      <div className="input-group">
                        <label>Pourquoi ce placement ?</label>
                        <textarea
                          value={item.explanation}
                          onChange={(e) =>
                            updateItemExplanation(item.id, e.target.value)
                          }
                          placeholder="Ajoutez votre justification..."
                          style={{
                            width: "100%",
                            padding: 10,
                            border: "2px solid var(--border)",
                            borderRadius: 10,
                            fontSize: 13,
                            minHeight: 100,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <button
                        className="btn"
                        onClick={() => setExpandedItem(null)}
                        style={{ width: "100%" }}
                      >
                        Fermer
                      </button>
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
