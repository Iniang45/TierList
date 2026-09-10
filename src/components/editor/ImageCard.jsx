import React from "react";
import "./ImageCard.css";

export default function ImageCard({ item, onChange }) {
  function edit() {
    const txt = prompt("Texte affiché sur l'image", item.text || "");
    if (txt !== null) onChange({ text: txt });
  }
  function editExp() {
    const e = prompt("Explication (visible au clic)", item.explanation || "");
    if (e !== null) onChange({ explanation: e });
  }

  return (
    <div
      className="card"
      onDoubleClick={editExp}
      onClick={edit}
      title={item.explanation || "Double-clic pour éditer l'explication"}
    >
      <img src={item.src} alt={item.text || ""} />
      {item.text ? <div className="overlay">{item.text}</div> : null}
    </div>
  );
}
