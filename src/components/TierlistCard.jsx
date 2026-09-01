import React from "react";

function getCoverSrc(tierlist) {
  if (tierlist?.coverImage?.src) {
    return tierlist.coverImage.src;
  }

  const firstImage = (tierlist?.images || tierlist?.items || [])[0];
  return firstImage?.src || "";
}

function getOwnerLabel(tierlist) {
  return tierlist?.owner?.displayName || tierlist?.owner?.userId || "";
}

export default function TierlistCard({
  tierlist,
  expanded,
  onToggle,
  onEdit,
  onRank,
  onDelete,
  onOpenProfile,
  showActions = true,
  showRank = false,
  showEdit = false,
  showDelete = false,
  showOwner = true,
  showVisibility = true,
}) {
  const coverSrc = getCoverSrc(tierlist);
  const ownerLabel = getOwnerLabel(tierlist);

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
            onToggle?.();
          }
        }}
      >
        <div className="gallery-card-cover">
          {coverSrc ? (
            <img src={coverSrc} alt={tierlist?.name || "TierList"} />
          ) : (
            <div className="gallery-card-fallback">Aucune image</div>
          )}
        </div>
        <div className="gallery-card-title">
          <div>{tierlist?.name || "Sans titre"}</div>
          <div className="gallery-card-meta">
            {showVisibility && tierlist?.visibility && (
              <span className={`visibility-badge ${tierlist.visibility}`}>
                {tierlist.visibility}
              </span>
            )}
            {showOwner && ownerLabel && (
              <button
                type="button"
                className="gallery-owner-link"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenProfile?.(tierlist?.owner?.id || tierlist?.ownerId);
                }}
              >
                {ownerLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="gallery-card-details">
          {tierlist?.description && <p>{tierlist.description}</p>}
          {showActions && (
            <div className="gallery-card-actions">
              {showEdit && onEdit && (
                <button className="btn" onClick={() => onEdit(tierlist)}>
                  Modifier
                </button>
              )}
              {showRank && onRank && (
                <button
                  className="btn secondary"
                  onClick={() => onRank(tierlist)}
                >
                  Ranger
                </button>
              )}
              {showDelete && onDelete && (
                <button className="btn" onClick={() => onDelete(tierlist.id)}>
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
