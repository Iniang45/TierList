import React, { useEffect, useState } from "react";
import TierlistCard from "./TierlistCard";
import { communityApi } from "../services/communityApi";

export default function UserProfileView({
  token,
  userId,
  onOpenProfile,
  onRank,
}) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const payload = await communityApi.userProfile(userId, token);
        setProfile(payload);
      } catch (err) {
        setError(err.message || "Impossible de charger ce profil");
      }
    }

    if (userId) {
      load();
    }
  }, [token, userId]);

  if (error) {
    return <div className="auth-error">{error}</div>;
  }

  if (!profile) {
    return <div>Chargement...</div>;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="gallery-section" style={{ marginBottom: 20 }}>
        <div className="profile-header">
          <img
            src={profile.user?.avatar || "https://placehold.co/96x96"}
            alt={profile.user?.displayName || profile.user?.userId}
            className="profile-avatar"
          />
          <div>
            <h2>{profile.user?.displayName || profile.user?.userId}</h2>
            <p className="small">@{profile.user?.userId}</p>
          </div>
        </div>
      </div>

      <div className="gallery-sections">
        <div className="gallery-section">
          <div className="gallery-section-header">
            <h3>Tierlists créées en public</h3>
          </div>
          <div className="gallery-grid">
            {(profile.createdTierlists || []).map((tierlist) => (
              <TierlistCard
                key={tierlist.id}
                tierlist={tierlist}
                expanded={expandedId === tierlist.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === tierlist.id ? null : tierlist.id,
                  )
                }
                onRank={onRank}
                onOpenProfile={onOpenProfile}
                showActions
                showRank
                showEdit={false}
                showDelete={false}
              />
            ))}
          </div>
        </div>

        <div className="gallery-section">
          <div className="gallery-section-header">
            <h3>Tierlists rangées en public</h3>
          </div>
          <div className="gallery-grid">
            {(profile.rankedTierlists || []).map((tierlist) => (
              <TierlistCard
                key={tierlist.id}
                tierlist={tierlist}
                expanded={expandedId === tierlist.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === tierlist.id ? null : tierlist.id,
                  )
                }
                onRank={onRank}
                onOpenProfile={onOpenProfile}
                showActions
                showRank={false}
                showEdit={false}
                showDelete={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
