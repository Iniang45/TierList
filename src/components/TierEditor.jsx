import React, { useEffect, useRef, useState } from "react";
import ImageCard from "./ImageCard";
import html2canvas from "html2canvas";
import {
  contrastTextColor,
  createDefaultTiers,
  saveTierlistRecord,
  uid,
} from "../utils/tierlists";

function buildItems(sourceItems = [], sourceImages = []) {
  const base = sourceItems.length > 0 ? sourceItems : sourceImages;

  return base.map((item) => ({
    id: item.id || uid(),
    src: item.src,
    text: item.text || "",
    explanation: item.explanation || "",
    tierId: Object.prototype.hasOwnProperty.call(item, "tierId")
      ? item.tierId
      : null,
  }));
}

export default function TierEditor({ initialData, onSave, onCancel }) {
  const [name, setName] = useState(initialData?.name || "Ma TierList");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [tiers, setTiers] = useState(
    initialData?.tiers?.length ? initialData.tiers : createDefaultTiers(),
  );

  const [items, setItems] = useState(
    buildItems(initialData?.items || [], initialData?.images || []),
  );
  const containerRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "Ma TierList");
      setDescription(initialData.description || "");
      setTiers(
        initialData.tiers?.length ? initialData.tiers : createDefaultTiers(),
      );
      setItems(buildItems(initialData.items || [], initialData.images || []));
    }
  }, [initialData]);

  function handleFiles(ev) {
    const files = Array.from(ev.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        const it = {
          id: uid(),
          src: data,
          text: "",
          explanation: "",
          tierId: null,
        };
        setItems((prev) => [...prev, it]);
      };
      reader.readAsDataURL(file);
    });
    ev.target.value = "";
  }

  function onDragStart(ev, id) {
    ev.dataTransfer.setData("text/plain", id);
  }

  function onDropToTier(ev, tierId) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, tierId } : it)),
    );
  }

  function onDropToUnranked(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, tierId: null } : it)),
    );
  }

  function saveLocal() {
    const data = {
      id: initialData?.id || uid(),
      type: items.some(
        (item) => item.tierId !== null && item.tierId !== undefined,
      )
        ? "ranking"
        : "template",
      templateId: initialData?.templateId || null,
      name,
      description,
      tiers,
      items,
      images: items.map(({ tierId, explanation, ...image }) => image),
      created: initialData?.created || Date.now(),
    };

    saveTierlistRecord(data);

    if (onSave) {
      onSave(data);
      return;
    }
  }

  function exportJSON() {
    const data = { name, tiers, items };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        setName(d.name || "Imported");
        setTiers(d.tiers || []);
        setItems(d.items || []);
      } catch (err) {
        console.error("Fichier invalide", err);
      }
    };
    r.readAsText(f);
    ev.target.value = "";
  }

  async function downloadImage() {
    if (!containerRef.current) {
      return;
    }
    const canvas = await html2canvas(containerRef.current, {
      backgroundColor: null,
      scale: 2,
    });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.png`;
    a.click();
  }

  function updateItem(id, patch) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      { id: uid(), name: "Nouveau", color: "#64748b" },
    ]);
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

  return (
    <div className="layout">
      <div className="editor">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 8, borderRadius: 8, minWidth: 240 }}
          />
          {onCancel && (
            <button className="btn" onClick={onCancel}>
              Retour
            </button>
          )}
          <button className="btn primary" onClick={saveLocal}>
            Sauvegarder
          </button>
          <button className="btn" onClick={exportJSON}>
            Exporter JSON
          </button>
          <label className="btn" style={{ display: "inline-block" }}>
            Importer JSON
            <input
              type="file"
              accept="application/json"
              onChange={importJSON}
              style={{ display: "none" }}
            />
          </label>
          <button className="btn" onClick={downloadImage}>
            Télécharger en image
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div
              ref={containerRef}
              style={{ padding: 12, background: "transparent" }}
            >
              {items.some(
                (item) => item.tierId === null || item.tierId === undefined,
              ) && (
                <div
                  className="tier"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropToUnranked}
                  style={{
                    marginBottom: 10,
                    opacity: 0.7,
                    borderStyle: "dashed",
                  }}
                >
                  <div
                    className="tier-label"
                    style={{ background: "#cbd5e1", color: "#0f172a" }}
                  >
                    À classer
                  </div>
                  <div className="cards">
                    {items
                      .filter(
                        (item) =>
                          item.tierId === null || item.tierId === undefined,
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, item.id)}
                        >
                          <ImageCard
                            item={item}
                            onChange={(patch) => updateItem(item.id, patch)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {tiers.map((t) => (
                <div
                  key={t.id}
                  className="tier"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropToTier(e, t.id)}
                  style={{ marginBottom: 10 }}
                >
                  <div
                    className="title"
                    style={{
                      background: t.color,
                      color: contrastTextColor(t.color),
                    }}
                  >
                    {t.name}
                  </div>
                  <div className="cards">
                    {items
                      .filter((it) => it.tierId === t.id)
                      .map((it) => (
                        <div
                          key={it.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, it.id)}
                        >
                          <ImageCard
                            item={it}
                            onChange={(patch) => updateItem(it.id, patch)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="side">
            <div className="controls">
              <div>
                <div className="small">Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 90,
                    padding: 10,
                    borderRadius: 8,
                  }}
                />
              </div>

              <div>
                <div className="small">Ajouter des images</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFiles}
                />
              </div>

              <div>
                <div className="small">Tiers</div>
                <div className="tiers">
                  {tiers.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        value={t.name}
                        onChange={(e) => updateTierName(t.id, e.target.value)}
                      />
                      <input
                        type="color"
                        value={t.color || "#64748b"}
                        onChange={(e) => updateTierColor(t.id, e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          border: "2px solid var(--border)",
                          borderRadius: 8,
                          padding: 4,
                          background: "var(--card)",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn" onClick={addTier}>
                  Ajouter un rang
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
