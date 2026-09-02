import React, { useEffect, useMemo, useState } from "react";
import CreateTierList from "./components/CreateTierList";
import RankTierList from "./components/RankTierList";
import Gallery from "./components/Gallery";
import AuthScreen from "./components/AuthScreen";
import MyTierlistsView from "./components/MyTierlistsView";
import CommunityFeed from "./components/CommunityFeed";
import UserProfileView from "./components/UserProfileView";
import { communityApi } from "./services/communityApi";

const TOKEN_KEY = "tierlist-studio-token";

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );
  const [me, setMe] = useState(null);
  const [page, setPage] = useState("home");
  const [templateToRank, setTemplateToRank] = useState(null);
  const [tierlistToEdit, setTierlistToEdit] = useState(null);
  const [myTierlists, setMyTierlists] = useState([]);
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const activeSection = page === "rank" ? "gallery" : page;
  const isAuthed = Boolean(token);
  const friendIds = useMemo(() => new Set(me?.friends || []), [me]);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setMyTierlists([]);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const payload = await communityApi.me(token);
        if (!cancelled) {
          setMe(payload.user);
          setMyTierlists(payload.tierlists || []);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setMe(null);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!isAuthed) {
      return;
    }

    loadMyTierlists();
  }, [isAuthed, token]);

  useEffect(() => {
    if (!isAuthed || page !== "profile" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;

    async function searchUsers() {
      try {
        const payload = await communityApi.searchUsers(
          searchQuery.trim(),
          token,
        );
        if (!cancelled) {
          setSearchResults(payload.users || []);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      }
    }

    searchUsers();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, page, searchQuery, token]);

  async function handleLogin(credentials) {
    const payload = await communityApi.login(credentials);
    localStorage.setItem(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setMe(payload.user);
    setPage("home");
  }

  async function handleRegister(credentials) {
    const payload = await communityApi.register(credentials);
    localStorage.setItem(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setMe(payload.user);
    setPage("home");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMe(null);
    setMyTierlists([]);
    setPublicProfileId(null);
    setPage("home");
  }

  async function loadMyTierlists() {
    if (!token) return;
    try {
      const payload = await communityApi.myTierlists(token);
      setMyTierlists(payload.tierlists || []);
    } catch {
      setMyTierlists([]);
    }
  }

  async function handleSaveTierlist() {
    setTierlistToEdit(null);
    await loadMyTierlists();
    setPage("gallery");
  }

  async function updateProfile(patch) {
    if (!token) return;

    setProfileLoading(true);
    setProfileError("");
    try {
      const payload = await communityApi.updateMe(token, patch);
      setMe(payload.user);
    } catch (error) {
      setProfileError(error.message || "Impossible de mettre à jour le profil");
    } finally {
      setProfileLoading(false);
    }
  }

  async function updateAvatarFromFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      await updateProfile({ avatar: event.target.result });
    };
    reader.readAsDataURL(file);
  }

  async function addFriend(friendId) {
    await communityApi.addFriend(token, friendId);
    const payload = await communityApi.me(token);
    setMe(payload.user);
  }

  async function removeFriend(friendId) {
    await communityApi.removeFriend(token, friendId);
    const payload = await communityApi.me(token);
    setMe(payload.user);
  }

  function openRankWith(template) {
    setTierlistToEdit(null);
    setTemplateToRank(template);
    setPage("rank");
  }

  function openEditWith(template) {
    if (template.type === "ranking") {
      setTierlistToEdit(null);
      setTemplateToRank(template);
      setPage("rank");
      return;
    }

    setTemplateToRank(null);
    setTierlistToEdit(template);
    setPage("create");
  }

  function openPublicProfile(userId) {
    setPublicProfileId(userId);
    setPage("profile");
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>TierList Studio</h1>
          <div className="small">Création locale et communauté connectée</div>
        </div>

        {isAuthed ? (
          <div className="nav">
            <button
              className={`btn ${activeSection === "home" ? "active" : ""}`}
              onClick={() => setPage("home")}
            >
              Accueil
            </button>
            <button
              className={`btn ${activeSection === "create" ? "active" : ""}`}
              onClick={() => {
                setTierlistToEdit(null);
                setTemplateToRank(null);
                setPage("create");
              }}
            >
              Créer
            </button>
            <button
              className={`btn ${activeSection === "gallery" ? "active" : ""}`}
              onClick={() => setPage("gallery")}
            >
              Mes tierlists
            </button>
            <button
              className={`btn ${activeSection === "community" ? "active" : ""}`}
              onClick={() => setPage("community")}
            >
              Communauté
            </button>
            <button
              className={`btn ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => {
                setPublicProfileId(null);
                setPage("profile");
              }}
            >
              Profil
            </button>
            <button
              className="btn"
              onClick={() => {
                setPublicProfileId(me?.id || null);
                setPage("profile");
              }}
            >
              <span className="account-chip">
                <img
                  src={me?.avatar || "https://placehold.co/40x40"}
                  alt="Profil"
                />
                {me?.displayName || me?.userId || "Compte"}
              </span>
            </button>
            <button className="btn" onClick={logout}>
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="nav">
            <button
              className={`btn ${activeSection === "home" ? "active" : ""}`}
              onClick={() => setPage("home")}
            >
              Accueil
            </button>
            <button className="btn" onClick={() => setPage("auth")}>
              Se connecter
            </button>
          </div>
        )}
      </div>

      {page === "auth" && !isAuthed && (
        <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />
      )}

      {page === "home" && !isAuthed && (
        <div style={{ marginTop: 32 }}>
          <div className="hero-panel">
            <h2>Publiez vos tierlists et explorez celles de la communauté</h2>
            <p className="small" style={{ fontSize: 15, lineHeight: 1.6 }}>
              Connectez-vous avec un id et un mot de passe pour gérer votre
              profil, vos amis et vos tierlists publiques.
            </p>
            <div className="create-actions" style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={() => setPage("auth")}>
                Se connecter
              </button>
              <button className="btn" onClick={() => setPage("auth")}>
                Créer un compte
              </button>
            </div>
          </div>
        </div>
      )}

      {page === "home" && isAuthed && (
        <div style={{ marginTop: 32 }}>
          <div className="hero-panel" style={{ maxWidth: 760 }}>
            <h2>
              Bienvenue {me?.displayName || me?.userId || "sur TierList Studio"}
            </h2>
            <p className="small" style={{ fontSize: 15, lineHeight: 1.6 }}>
              Créez, publiez et explorez des tierlists. Votre compte donne accès
              au profil, aux amis et au flux public.
            </p>
            <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
              <div className="hero-card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  1. Créer une TierList
                </div>
                <div className="small">
                  Définissez les tiers, ajoutez des images et préparez une base
                  publiable.
                </div>
                <button
                  className="btn primary"
                  onClick={() => setPage("create")}
                  style={{ marginTop: 12 }}
                >
                  Créer maintenant
                </button>
              </div>
              <div className="hero-card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  2. Ranger / Compléter
                </div>
                <div className="small">
                  Chargez une tierlist créée et rangez les éléments. Ajoutez des
                  explications à chaque placement.
                </div>
                <button
                  className="btn secondary"
                  onClick={() => setPage("gallery")}
                  style={{ marginTop: 12 }}
                >
                  Voir mes tierlists
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {page === "create" && isAuthed && (
        <CreateTierList
          token={token}
          initialData={tierlistToEdit}
          onSave={handleSaveTierlist}
          onCancel={() => {
            setTierlistToEdit(null);
            setPage("gallery");
          }}
        />
      )}

      {page === "rank" && isAuthed && (
        <RankTierList
          template={templateToRank}
          initialData={
            templateToRank?.type === "ranking" ? templateToRank : null
          }
          onBack={() => setPage("gallery")}
        />
      )}

      {page === "gallery" && isAuthed && (
        <MyTierlistsView
          tierlists={myTierlists}
          onRank={openRankWith}
          onEdit={openEditWith}
          onDelete={async (id) => {
            await communityApi.deleteTierlist(token, id);
            const payload = await communityApi.myTierlists(token);
            setMyTierlists(payload.tierlists || []);
          }}
          onOpenProfile={openPublicProfile}
        />
      )}

      {page === "community" && isAuthed && (
        <CommunityFeed
          token={token}
          onRank={openRankWith}
          onOpenProfile={openPublicProfile}
        />
      )}

      {page === "profile" && isAuthed && (
        <div style={{ marginTop: 24 }}>
          {publicProfileId && publicProfileId !== me?.id ? (
            <UserProfileView
              token={token}
              userId={publicProfileId}
              onOpenProfile={openPublicProfile}
              onRank={openRankWith}
            />
          ) : (
            <div className="profile-shell">
              <div className="gallery-section">
                <div className="profile-header">
                  <img
                    src={me?.avatar || "https://placehold.co/96x96"}
                    alt={me?.displayName || me?.userId}
                    className="profile-avatar"
                  />
                  <div>
                    <h2>{me?.displayName || me?.userId}</h2>
                    <p className="small">@{me?.userId}</p>
                  </div>
                </div>

                <div className="profile-form">
                  <label className="input-group">
                    <span>Nom affiché</span>
                    <input
                      value={me?.displayName || ""}
                      onChange={(event) =>
                        updateProfile({ displayName: event.target.value })
                      }
                      disabled={profileLoading}
                    />
                  </label>
                  <label className="input-group">
                    <span>Avatar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        updateAvatarFromFile(event.target.files?.[0])
                      }
                    />
                  </label>
                  <label className="input-group">
                    <span>Visibilité par défaut</span>
                    <select
                      value={me?.defaultVisibility || "public"}
                      onChange={(event) =>
                        updateProfile({ defaultVisibility: event.target.value })
                      }
                      disabled={profileLoading}
                    >
                      <option value="public">Public</option>
                      <option value="private">Privé</option>
                    </select>
                  </label>
                  {profileError && (
                    <div className="auth-error">{profileError}</div>
                  )}
                </div>
              </div>

              <div className="gallery-section" style={{ marginTop: 20 }}>
                <div className="gallery-section-header">
                  <div>
                    <h3>Amis</h3>
                    <span className="small">
                      Cherchez des utilisateurs et ajoutez-les à votre réseau.
                    </span>
                  </div>
                </div>

                <div className="profile-search">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher un utilisateur"
                  />
                  <div className="profile-search-results">
                    {searchResults.map((user) => (
                      <div className="profile-search-item" key={user.id}>
                        <button
                          className="profile-user-link"
                          onClick={() => openPublicProfile(user.id)}
                        >
                          {user.displayName || user.userId}
                        </button>
                        <span className="small">@{user.userId}</span>
                        {friendIds.has(user.id) ? (
                          <button
                            className="btn"
                            onClick={() => removeFriend(user.id)}
                          >
                            Retirer
                          </button>
                        ) : (
                          <button
                            className="btn secondary"
                            onClick={() => addFriend(user.id)}
                          >
                            Ajouter
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="profile-friends">
                  {(me?.friends || []).length === 0 ? (
                    <div className="small">Aucun ami pour le moment.</div>
                  ) : (
                    (me?.friends || []).map((friend) => (
                      <button
                        key={friend.id}
                        className="profile-friend-chip"
                        onClick={() => openPublicProfile(friend.id)}
                      >
                        {friend.displayName || friend.userId}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {page === "gallery" && !isAuthed && (
        <Gallery onRank={openRankWith} onEdit={openEditWith} />
      )}
    </div>
  );
}
