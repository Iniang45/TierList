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
  canModerateComments = false,
}) {
  const [ranking, setRanking] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setSelectedTierId("");
  }, [expandedItem]);

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

  useEffect(() => {
    if (!readOnly || !ranking?.id) {
      setComments([]);
      return;
    }
    let cancelled = false;
    communityApi
      .getComments(ranking.id, token)
      .then((payload) => {
        if (!cancelled) setComments(payload.comments || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setComments([]);
          setCommentError(
            err.message || "Impossible de charger les commentaires",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ranking?.id, readOnly, token]);

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

  function placeItem(itemId) {
    if (!selectedTierId) return;
    setRanking((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, tierId: selectedTierId } : item,
      ),
    }));
    setExpandedItem(null);
  }

  async function addComment(event) {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || !token) {
      setCommentError(
        token
          ? "Le commentaire ne peut pas être vide."
          : "Connectez-vous pour commenter.",
      );
      return;
    }
    setCommentLoading(true);
    setCommentError("");
    try {
      const payload = await communityApi.addComment(ranking.id, token, text);
      setComments((current) => [...current, payload.comment]);
      setCommentText("");
    } catch (err) {
      setCommentError(err.message || "Impossible d'ajouter le commentaire");
    } finally {
      setCommentLoading(false);
    }
  }

  async function removeComment(commentId) {
    try {
      await communityApi.deleteComment(ranking.id, commentId, token);
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );
    } catch (err) {
      setCommentError(err.message || "Impossible de supprimer le commentaire");
    }
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
    <div className="rank-page ranking-page">
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
          </div>
        </div>

        <div className="side">
          {!readOnly && (
            <div
              className="side-panel unranked-panel"
              onDragOver={onDragOver}
              onDrop={(event) => {
                event.preventDefault();
                const itemId = event.dataTransfer.getData("text/plain");
                setRanking((prev) => ({
                  ...prev,
                  items: prev.items.map((item) =>
                    item.id === itemId ? { ...item, tierId: null } : item,
                  ),
                }));
              }}
            >
              <div className="unranked-panel-heading">
                <div>
                  <div className="details-title">Éléments à ranger</div>
                  <div className="small">Glissez-les vers un tier</div>
                </div>
                <span className="unranked-count">
                  {ranking.items.filter((item) => !item.tierId).length}
                </span>
              </div>
              <div className="unranked-items">
                {ranking.items
                  .filter((item) => !item.tierId)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="unranked-item"
                      draggable={!readOnly}
                      onDragStart={(event) => onDragStart(event, item.id)}
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
                {ranking.items.every((item) => item.tierId) && (
                  <div className="unranked-empty">
                    Tous les éléments sont classés.
                  </div>
                )}
              </div>
            </div>
          )}
          {readOnly && (
            <div className="side-panel comments-panel">
              <div className="comments-heading">
                <div>
                  <div className="details-title">Commentaires</div>
                  <div className="small">Les réactions sur ce classement</div>
                </div>
                <span className="comments-count">{comments.length}</span>
              </div>
              <div className="comments-list">
                {comments.length === 0 ? (
                  <div className="comments-empty">
                    Aucun commentaire pour le moment.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div className="comment-item" key={comment.id}>
                      <img
                        src={
                          comment.author?.avatar || "https://placehold.co/32x32"
                        }
                        alt=""
                      />
                      <div className="comment-content">
                        <strong>
                          {comment.author?.displayName ||
                            comment.author?.userId ||
                            "Utilisateur"}
                        </strong>
                        <p>{comment.text}</p>
                      </div>
                      {canModerateComments && (
                        <button
                          className="comment-delete"
                          onClick={() => removeComment(comment.id)}
                          aria-label="Supprimer le commentaire"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <form className="comment-form" onSubmit={addComment}>
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={
                    token
                      ? "Écrire un commentaire..."
                      : "Connectez-vous pour commenter"
                  }
                  disabled={!token || commentLoading}
                  maxLength={1000}
                />
                <button
                  className="btn primary"
                  type="submit"
                  disabled={!token || commentLoading}
                >
                  {commentLoading ? "Envoi..." : "Commenter"}
                </button>
              </form>
              {commentError && (
                <div className="auth-error comment-error">{commentError}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {expandedItem &&
        (() => {
          const item = ranking.items.find((entry) => entry.id === expandedItem);
          if (!item) return null;
          return (
            <div
              className="explanation-modal-backdrop"
              onClick={() => setExpandedItem(null)}
            >
              <div
                className="explanation-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="explanation-modal-close"
                  onClick={() => setExpandedItem(null)}
                  aria-label="Fermer"
                >
                  ×
                </button>
                <img
                  src={item.src}
                  alt={item.text}
                  className="explanation-modal-image"
                />
                {item.text && <h3>{item.text}</h3>}
                {!readOnly && (
                  <div className="explanation-placement">
                    <label htmlFor="tier-placement">Placer dans le tier</label>
                    <div className="explanation-placement-controls">
                      <select
                        id="tier-placement"
                        value={selectedTierId || item.tierId || ""}
                        onChange={(event) =>
                          setSelectedTierId(event.target.value)
                        }
                      >
                        <option value="" disabled>
                          Choisir un tier
                        </option>
                        {ranking.tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn secondary"
                        onClick={() => placeItem(item.id)}
                        disabled={!selectedTierId && !item.tierId}
                      >
                        Placer
                      </button>
                    </div>
                  </div>
                )}
                {readOnly ? (
                  <p className="explanation-modal-text">
                    {item.explanation ||
                      "Aucune explication pour ce placement."}
                  </p>
                ) : (
                  <label className="explanation-modal-field">
                    <span>Explication du placement</span>
                    <textarea
                      value={item.explanation}
                      onChange={(event) =>
                        updateItemExplanation(item.id, event.target.value)
                      }
                      placeholder="Pourquoi cette image est-elle dans ce tier ?"
                      autoFocus
                    />
                  </label>
                )}
                <button
                  className="btn primary explanation-modal-submit"
                  onClick={() => setExpandedItem(null)}
                >
                  {readOnly ? "Fermer" : "Enregistrer"}
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
