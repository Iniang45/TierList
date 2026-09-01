import React, { useEffect, useState } from "react";
import {
  createDefaultTiers,
  optimizeImageDataUrl,
  saveTierlistRecord,
  uid,
} from "../utils/tierlists";

function normalizeImages(initialData) {
  const source =
    Array.isArray(initialData?.images) && initialData.images.length > 0
      ? initialData.images
      : Array.isArray(initialData?.items)
        ? initialData.items
        : [];

  return source.map((image) => ({
    id: image.id || uid(),
    src: image.src,
    text: image.text || "",
    explanation: image.explanation || "",
    tierId: Object.prototype.hasOwnProperty.call(image, "tierId")
      ? image.tierId
      : null,
  }));
}

function readImageFile(file, onLoad) {
  const reader = new FileReader();
  reader.onload = (event) => onLoad(event.target.result);
  reader.readAsDataURL(file);
}

export default function CreateTierList({ initialData, onSave, onCancel }) {
  const isEditing = Boolean(initialData);
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [coverImage, setCoverImage] = useState(initialData?.coverImage || null);
  const [visibility, setVisibility] = useState(
    initialData?.visibility || "public",
  );
  const [tiers, setTiers] = useState(
    initialData?.tiers?.length ? initialData.tiers : createDefaultTiers(),
  );
  const [images, setImages] = useState(normalizeImages(initialData));
  const [editingImage, setEditingImage] = useState(null);

  useEffect(() => {
    setName(initialData?.name || "");
    setDescription(initialData?.description || "");
    setCoverImage(initialData?.coverImage || null);
    setVisibility(initialData?.visibility || "public");
    setTiers(
      initialData?.tiers?.length ? initialData.tiers : createDefaultTiers(),
    );
    setImages(normalizeImages(initialData));
    setEditingImage(null);
  }, [initialData]);

  function addImageFiles(files) {
    files.forEach((file) => {
      readImageFile(file, (src) => {
        setImages((prev) => [
          ...prev,
          { id: uid(), src, text: "", explanation: "", tierId: null },
        ]);
      });
    });
  }

  function handleImageFiles(event) {
    addImageFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function handleImageDrop(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length > 0) {
      addImageFiles(files);
    }
  }

  function handleCoverFile(event) {
    const file = Array.from(event.target.files || [])[0];
    if (file) {
      readImageFile(file, (src) => {
        setCoverImage({ id: uid(), src, alt: name || "TierList" });
      });
    }
    event.target.value = "";
  }

  function handleCoverDrop(event) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files || []).find((item) =>
      item.type.startsWith("image/"),
    );
    if (file) {
      readImageFile(file, (src) => {
        setCoverImage({ id: uid(), src, alt: name || "TierList" });
      });
    }
  }

  function updateImage(id, patch) {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    );
  }

  function removeImage(id) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      { id: uid(), name: "Nouveau", color: "#64748b" },
    ]);
  }

  function removeTier(id) {
    if (tiers.length === 1) return;
    setTiers((prev) => prev.filter((tier) => tier.id !== id));
  }

  function updateTierName(id, newName) {
    setTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, name: newName } : tier)),
    );
  }

  function updateTierColor(id, color) {
    setTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, color } : tier)),
    );
  }

  async function saveTemplate() {
    const optimizedImages = await Promise.all(
      images.map(async (image) => ({
        ...image,
        src: await optimizeImageDataUrl(image.src),
      })),
    );

    const optimizedCoverImage = coverImage
      ? {
          ...coverImage,
          src: await optimizeImageDataUrl(coverImage.src, {
            maxWidth: 1600,
            maxHeight: 900,
            quality: 0.8,
          }),
        }
      : null;

    const template = {
      id: initialData?.id || uid(),
      type: "template",
      templateId: initialData?.templateId || null,
      name,
      description,
      coverImage: optimizedCoverImage,
      visibility,
      tiers,
      images: optimizedImages,
      items: optimizedImages.map((image) => ({
        ...image,
        explanation: image.explanation || "",
        tierId: null,
      })),
      created: initialData?.created || Date.now(),
    };

    saveTierlistRecord(template);

    if (onSave) {
      onSave(template);
      return;
    }

    setName("");
    setDescription("");
    setCoverImage(null);
    setTiers(createDefaultTiers());
    setImages([]);
  }

  return (
    <div className="layout">
      <div className="editor">
        <div style={{ marginBottom: 24 }}>
          <h2>{isEditing ? "Modifier une TierList" : "Créer une TierList"}</h2>
        </div>

        <div className="create-layout">
          <div className="create-main">
            <div
              style={{
                background: "var(--card)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div className="small">Image de la TierList</div>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleCoverDrop}
                  style={{
                    marginTop: 6,
                    padding: 12,
                    border: "2px dashed var(--border)",
                    borderRadius: 12,
                    background: "#f8fafc",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {coverImage?.src ? (
                    <img
                      src={coverImage.src}
                      alt={coverImage.alt || name || "TierList"}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "cover",
                        borderRadius: 10,
                      }}
                    />
                  ) : (
                    <div className="small">
                      Glissez-déposez une image ici ou utilisez le bouton
                      ci-dessous.
                    </div>
                  )}
                  <label
                    className="btn"
                    style={{ display: "inline-block", width: "fit-content" }}
                  >
                    Choisir l'image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFile}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="small">Nom</div>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ex: Animes 2024"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "2px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 14,
                    marginTop: 6,
                  }}
                />
              </div>

              <div>
                <div className="small">Description (optionnel)</div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contexte, règles, etc."
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "2px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 14,
                    marginTop: 6,
                    minHeight: 80,
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="small">Visibilité</div>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "2px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 14,
                    marginTop: 6,
                    background: "var(--card)",
                  }}
                >
                  <option value="public">Public</option>
                  <option value="private">Privé</option>
                </select>
              </div>

              <div style={{ marginTop: 20 }}>
                <div className="small" style={{ marginBottom: 12 }}>
                  Tiers configurés
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {tiers.map((tier) => (
                    <div
                      className="tier-row"
                      key={tier.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 96px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(event) =>
                          updateTierName(tier.id, event.target.value)
                        }
                        style={{
                          flex: 1,
                          padding: 8,
                          border: "2px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 14,
                        }}
                      />
                      <input
                        type="color"
                        value={tier.color}
                        onChange={(event) =>
                          updateTierColor(tier.id, event.target.value)
                        }
                        style={{
                          width: "100%",
                          height: 40,
                          border: "2px solid var(--border)",
                          borderRadius: 8,
                          padding: 4,
                          background: "var(--card)",
                        }}
                      />
                      {tiers.length > 1 ? (
                        <button
                          className="btn"
                          onClick={() => removeTier(tier.id)}
                          style={{ padding: 8 }}
                        >
                          Supprimer
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  className="btn"
                  onClick={addTier}
                  style={{ marginTop: 12, width: "100%" }}
                >
                  Ajouter un rang
                </button>
              </div>

              <div
                className="create-actions"
                style={{ display: "flex", gap: 12, marginTop: 20 }}
              >
                {onCancel && (
                  <button
                    className="btn"
                    onClick={onCancel}
                    style={{ flex: 1, padding: 12 }}
                  >
                    Annuler
                  </button>
                )}
                <button
                  className="btn primary"
                  onClick={saveTemplate}
                  style={{ flex: 2, padding: 12, fontWeight: 600 }}
                >
                  {isEditing ? "Enregistrer" : "Créer et Sauvegarder"}
                </button>
              </div>
            </div>
          </div>

          <div className="create-side">
            <div className="side-panel">
              <div
                className="small"
                style={{ marginBottom: 12, fontWeight: 600 }}
              >
                Images ({images.length})
              </div>

              <div
                className="image-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleImageDrop}
                style={{
                  padding: 12,
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  background: "#f8fafc",
                  marginBottom: 12,
                }}
              >
                <div className="small" style={{ marginBottom: 10 }}>
                  Glissez-déposez des images ici ou utilisez le bouton.
                </div>
                <label className="btn" style={{ display: "inline-block" }}>
                  Ajouter des images
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageFiles}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <div
                className="image-list"
                style={{
                  maxHeight: 600,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {images.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      padding: 10,
                      background: "#f8fafc",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onClick={() => setEditingImage(img.id)}
                  >
                    <img
                      src={img.src}
                      alt={img.text}
                      style={{
                        width: "100%",
                        height: 60,
                        objectFit: "cover",
                        borderRadius: 6,
                        marginBottom: 6,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {img.text ? `"${img.text}"` : "Sans description"}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingImage(img.id);
                        }}
                        style={{ flex: 1, padding: 6, fontSize: 12 }}
                      >
                        Éditer
                      </button>
                      <button
                        className="btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeImage(img.id);
                        }}
                        style={{ padding: 6, fontSize: 12 }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {editingImage && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setEditingImage(null)}
              >
                <div
                  style={{
                    background: "var(--card)",
                    borderRadius: 16,
                    padding: 20,
                    maxWidth: 400,
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <h3>Éditer image</h3>
                  <div className="input-group">
                    <label>Texte sur l'image</label>
                    <input
                      type="text"
                      value={
                        images.find((image) => image.id === editingImage)
                          ?.text || ""
                      }
                      onChange={(event) =>
                        updateImage(editingImage, { text: event.target.value })
                      }
                      placeholder="ex: Dragon Ball Z"
                    />
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => setEditingImage(null)}
                    style={{ width: "100%" }}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
