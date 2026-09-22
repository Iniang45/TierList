import React, { useEffect, useState } from "react";
import {
  createDefaultTiers,
  optimizeImageDataUrl,
  saveTemporaryTierlist,
  uid,
} from "../../utils/tierlists";
import { communityApi } from "../../services/communityApi";
import "./CreateTierList.css";

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

export default function CreateTierList({
  token,
  initialData,
  onSave,
  onCancel,
}) {
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

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
    setError(null);
    setIsSaving(true);
    console.log("🔄 Démarrage sauvegarde...", {
      token: !!token,
      isEditing,
      name,
    });

    try {
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

      const templateData = {
        type: "template",
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
      };

      console.log("📦 Données préparées:", templateData);

      // Save to server if authenticated
      if (token) {
        console.log("🌐 Envoi au serveur avec token...");
        if (isEditing && initialData?.id) {
          // Update existing tierlist
          console.log("✏️ Mise à jour tierlist:", initialData.id);
          const response = await communityApi.updateTierlist(
            token,
            initialData.id,
            templateData,
          );
          const template = {
            ...response.tierlist,
            created: initialData.created,
          };
          setIsSaving(false);
          console.log("✅ Tierlist mise à jour avec succès");
          if (onSave) {
            onSave(template);
          }
        } else {
          // Create new tierlist
          console.log("➕ Création nouvelle tierlist...");
          const response = await communityApi.createTierlist(
            token,
            templateData,
          );
          console.log("✅ Tierlist créée avec succès:", response.tierlist);
          const template = response.tierlist;
          setIsSaving(false);
          if (onSave) {
            onSave(template);
          }
        }
      } else {
        console.log("⚠️ Invité : sauvegarde temporaire dans l'onglet");
        const template = {
          id: initialData?.id || uid(),
          ...templateData,
          created: initialData?.created || Date.now(),
        };
        saveTemporaryTierlist(template);
        setIsSaving(false);
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
    } catch (err) {
      console.error("❌ Erreur sauvegarde:", err);
      setError(err.message || "Erreur lors de la sauvegarde");
      setIsSaving(false);
    }
  }

  return (
    <div className="layout create-page">
      <div className="editor">
        <div className="editor-heading">
          <h2>{isEditing ? "Modifier une TierList" : "Créer une TierList"}</h2>
        </div>

        <div className="create-layout">
          <div className="create-main">
            <div className="editor-card">
              <div className="form-section form-section-spaced">
                <div className="small">Image de la TierList</div>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleCoverDrop}
                  className="cover-dropzone"
                >
                  {coverImage?.src ? (
                    <img
                      src={coverImage.src}
                      alt={coverImage.alt || name || "TierList"}
                      className="cover-preview"
                    />
                  ) : (
                    <div className="small">
                      Glissez-déposez une image ici ou utilisez le bouton
                      ci-dessous.
                    </div>
                  )}
                  <label className="btn file-button">
                    Choisir l'image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFile}
                      className="visually-hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="form-section form-section-spaced">
                <div className="small">Nom</div>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ex: Animes 2024"
                  className="editor-input"
                />
              </div>

              <div>
                <div className="small">Description (optionnel)</div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contexte, règles, etc."
                  className="editor-textarea"
                />
              </div>

              <div className="form-section form-section-top">
                <div className="small">Visibilité</div>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="editor-input"
                >
                  <option value="public">Public</option>
                  <option value="private">Privé</option>
                </select>
              </div>

              <div className="tiers-section">
                <div className="small section-label">Tiers configurés</div>
                <div className="tier-editor-list">
                  {tiers.map((tier) => (
                    <div className="tier-editor-row" key={tier.id}>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(event) =>
                          updateTierName(tier.id, event.target.value)
                        }
                        className="tier-editor-input"
                      />
                      <input
                        type="color"
                        value={tier.color}
                        onChange={(event) =>
                          updateTierColor(tier.id, event.target.value)
                        }
                        className="tier-color-input"
                      />
                      {tiers.length > 1 ? (
                        <button
                          className="btn tier-delete-button"
                          onClick={() => removeTier(tier.id)}
                        >
                          Supprimer
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
                <button className="btn tier-add-button" onClick={addTier}>
                  Ajouter un rang
                </button>
              </div>

              <div className="create-actions save-actions">
                {error && <div className="editor-error">{error}</div>}
                <div className="save-buttons">
                  {onCancel && (
                    <button
                      className="btn save-cancel"
                      onClick={onCancel}
                      disabled={isSaving}
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    className="btn primary save-submit"
                    onClick={saveTemplate}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Sauvegarde..."
                      : isEditing
                        ? "Enregistrer"
                        : "Créer et Sauvegarder"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="create-side">
            <div className="side-panel">
              <div className="small image-list-title">
                Images ({images.length})
              </div>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleImageDrop}
                className="image-dropzone create-image-dropzone"
              >
                <div className="small dropzone-copy">
                  Glissez-déposez des images ici ou utilisez le bouton.
                </div>
                <label className="btn file-button">
                  Ajouter des images
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageFiles}
                    className="visually-hidden"
                  />
                </label>
              </div>

              <div className="image-list">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="image-list-item"
                    onClick={() => setEditingImage(img.id)}
                  >
                    <img
                      src={img.src}
                      alt={img.text}
                      className="image-list-preview"
                    />
                    <div className="image-list-caption">
                      {img.text ? `"${img.text}"` : "Sans description"}
                    </div>
                    <div className="image-list-actions">
                      <button
                        className="btn image-edit-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingImage(img.id);
                        }}
                      >
                        Éditer
                      </button>
                      <button
                        className="btn image-delete-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeImage(img.id);
                        }}
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
                className="image-modal-backdrop"
                onClick={() => setEditingImage(null)}
              >
                <div
                  className="image-modal"
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
                    onClick={() => setEditingImage(null)}
                    className="btn primary image-modal-close"
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
