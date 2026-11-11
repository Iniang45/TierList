import React, { useEffect, useMemo, useState } from "react";
import CreateTierList from "./components/create/CreateTierList";
import RankTierList from "./components/rank/RankTierList";
import AuthScreen from "./components/auth/AuthScreen";
import MyTierlistsView from "./components/gallery/MyTierlistsView";
import CommunityFeed from "./components/community/CommunityFeed";
import UserProfileView from "./components/profile/UserProfileView";
import AdminDashboard from "./components/admin/AdminDashboard";
import { communityApi } from "./services/communityApi";
import brandIcon from "../assets/favicon.svg";
import {
  deleteTemporaryTierlist,
  loadTemporaryTierlists,
} from "./utils/tierlists";
import "./App.css";

const TOKEN_KEY = "tierlist-studio-token";

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );
  const [me, setMe] = useState(null);
  const [page, setPage] = useState("home");
  const [templateToRank, setTemplateToRank] = useState(null);
  const [rankReadOnly, setRankReadOnly] = useState(false);
  const [tierlistToEdit, setTierlistToEdit] = useState(null);
  const [myTierlists, setMyTierlists] = useState(() =>
    localStorage.getItem(TOKEN_KEY) ? [] : loadTemporaryTierlists(),
  );
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmation: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState(null);

  const activeSection = page === "rank" ? "gallery" : page;
  const isAuthed = Boolean(token);
  const friendIds = useMemo(
    () => new Set((me?.friends || []).map((friend) => friend.id || friend)),
    [me],
  );
  const sentRequestIds = useMemo(
    () =>
      new Set(
        (me?.sentFriendRequests || []).map((request) => request.toUser?.id),
      ),
    [me],
  );
  const receivedRequestIds = useMemo(
    () =>
      new Set((me?.friendRequests || []).map((request) => request.from?.id)),
    [me],
  );
  useEffect(() => {
    if (window.location.hash !== `#${page}`) {
      window.history.pushState({ page }, "", `#${page}`);
    }
  }, [page]);

  // 2. Gère le bouton Retour / Avant du navigateur
  useEffect(() => {
    const handlePopState = (event) => {
      const targetPage =
        event.state?.page || window.location.hash.replace("#", "") || "home";
      setPage(targetPage);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    function handleAuthExpired() {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setMe(null);
      setMyTierlists(loadTemporaryTierlists());
      setPage("auth");
    }

    window.addEventListener("tierlist-auth-expired", handleAuthExpired);
    return () =>
      window.removeEventListener("tierlist-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setMyTierlists(loadTemporaryTierlists());
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const payload = await communityApi.me(token);
        if (!cancelled) {
          setMe(payload.user);
          setMyTierlists(payload.tierlists || []);
          if (payload.user.role === "admin") {
            setPage("admin");
          }
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
    setPage(payload.user.role === "admin" ? "admin" : "home");
  }

  async function handleRegister(credentials) {
    const payload = await communityApi.register(credentials);
    localStorage.setItem(TOKEN_KEY, payload.token);
    setToken(payload.token);
    setMe(payload.user);
    setPage("home");
  }

  async function logout() {
    if (token) {
      try {
        await communityApi.logout(token);
      } catch (error) {
        console.error("La session serveur n'a pas pu être révoquée.", error);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMe(null);
    setMyTierlists(loadTemporaryTierlists());
    setPublicProfileId(null);
    setPage("home");
  }

  async function loadMyTierlists() {
    if (!token) {
      setMyTierlists(loadTemporaryTierlists());
      return;
    }
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

  async function updatePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmation) {
      setPasswordError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setPasswordLoading(true);
    try {
      await communityApi.updatePassword(token, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmation: "",
      });
      setPasswordMessage("Mot de passe modifié.");
    } catch (error) {
      setPasswordError(
        error.message || "Impossible de modifier le mot de passe",
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  async function addFriend(friendId) {
    try {
      await communityApi.addFriend(token, friendId);
      const payload = await communityApi.me(token);
      setMe(payload.user);
      setFriendFeedback({ type: "success", text: "Demande d'ami envoyée." });
    } catch (error) {
      setFriendFeedback({
        type: "error",
        text: error.message || "Impossible d'envoyer la demande.",
      });
    }
  }

  async function acceptFriendRequest(requestId) {
    try {
      const payload = await communityApi.acceptFriendRequest(token, requestId);
      setMe(payload.user);
      setFriendFeedback({ type: "success", text: "Demande acceptée." });
    } catch (error) {
      setFriendFeedback({
        type: "error",
        text: error.message || "Impossible d'accepter la demande.",
      });
    }
  }

  async function rejectFriendRequest(requestId) {
    try {
      await communityApi.rejectFriendRequest(token, requestId);
      const payload = await communityApi.me(token);
      setMe(payload.user);
      setFriendFeedback({ type: "success", text: "Demande refusée." });
    } catch (error) {
      setFriendFeedback({
        type: "error",
        text: error.message || "Impossible de refuser la demande.",
      });
    }
  }

  async function removeFriend(friendId) {
    try {
      await communityApi.removeFriend(token, friendId);
      const payload = await communityApi.me(token);
      setMe(payload.user);
      setFriendFeedback({
        type: "success",
        text: "Ami retiré de votre réseau.",
      });
    } catch (error) {
      setFriendFeedback({
        type: "error",
        text: error.message || "Impossible de retirer cet ami.",
      });
    }
  }

  function openRankWith(template) {
    setRankReadOnly(false);
    setTierlistToEdit(null);
    setTemplateToRank(template);
    setPage("rank");
  }

  function openViewWith(tierlist) {
    setTierlistToEdit(null);
    setTemplateToRank(tierlist);
    setRankReadOnly(true);
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

  function copyTierlist(template) {
    const copy = {
      ...template,
      id: undefined,
      owner: undefined,
      ownerId: undefined,
      ownerType: undefined,
      type: "template",
      name: `Copie de ${template.name || "Sans titre"}`,
      visibility: "private",
      created: Date.now(),
      updated: Date.now(),
    };
    setTemplateToRank(null);
    setTierlistToEdit(copy);
    setPage("create");
  }

  function openPublicProfile(userId) {
    setPublicProfileId(userId);
    setPage("profile");
  }

  function goToPage(nextPage) {
    setMobileMenuOpen(false);
    setPage(nextPage);
  }

  function startCreate() {
    setTierlistToEdit(null);
    setTemplateToRank(null);
    setRankReadOnly(false);
    goToPage("create");
  }

  const mobileNavigation = [
    { page: "home", label: "Accueil", icon: "⌂" },
    { page: "create", label: "Créer", icon: "+" },
    { page: "gallery", label: "Mes tierlists", icon: "▦" },
    { page: "community", label: "Communauté", icon: "◎" },
    ...(me?.role === "admin"
      ? [{ page: "admin", label: "Administration", icon: "◆" }]
      : []),
    ...(isAuthed ? [{ page: "profile", label: "Profil", icon: "◉" }] : []),
  ];

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <img className="brand-icon" src={brandIcon} alt="" />
          <div>
            <h1>RapidTier</h1>

            <div className="small">Mon carburant est ma hate pour tierMaker</div>
          </div>
        </div>

        {isAuthed ? (
          <div className="nav">
            <button
              className={`btn ${activeSection === "home" ? "active" : ""}`}
              onClick={() => goToPage("home")}
            >
              Accueil
            </button>
            <button
              className={`btn ${activeSection === "create" ? "active" : ""}`}
              onClick={() => {
                setTierlistToEdit(null);
                setTemplateToRank(null);
                goToPage("create");
              }}
            >
              Créer
            </button>
            <button
              className={`btn ${activeSection === "gallery" ? "active" : ""}`}
              onClick={() => goToPage("gallery")}
            >
              Mes tierlists
            </button>
            <button
              className={`btn ${activeSection === "community" ? "active" : ""}`}
              onClick={() => goToPage("community")}
            >
              Communauté
            </button>
            {me?.role === "admin" && (
              <button
                className={`btn ${activeSection === "admin" ? "active" : ""}`}
                onClick={() => goToPage("admin")}
              >
                Admin
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setPublicProfileId(me?.id || null);
                goToPage("profile");
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
              onClick={() => goToPage("home")}
            >
              Accueil
            </button>
            <button
              className={`btn ${activeSection === "auth" ? "active" : ""}`}
              onClick={() => goToPage("auth")}
            >
              Se connecter
            </button>
            <button
              className={`btn ${activeSection === "gallery" ? "active" : ""}`}
              onClick={() => goToPage("gallery")}
            >
              Mes tierlists
            </button>
            <button
              className={`btn ${activeSection === "community" ? "active" : ""}`}
              onClick={() => goToPage("community")}
            >
              Communauté
            </button>
          </div>
        )}
        <button
          className="mobile-menu-trigger"
          type="button"
          aria-label="Ouvrir le menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="mobile-menu-layer"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="mobile-menu-drawer"
            aria-label="Navigation mobile"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <div>
                <span className="mobile-menu-kicker">Navigation</span>
                <strong>TierList Studio</strong>
              </div>
              <button
                className="mobile-menu-close"
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <nav className="mobile-menu-links">
              {mobileNavigation.map((item) => (
                <button
                  key={item.page}
                  className={`mobile-menu-link ${activeSection === item.page ? "active" : ""}`}
                  onClick={() => {
                    if (item.page === "create") startCreate();
                    else goToPage(item.page);
                  }}
                >
                  <span className="mobile-menu-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  <span className="mobile-menu-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
              {isAuthed && (
                <button
                  className="mobile-menu-link mobile-menu-logout"
                  onClick={logout}
                >
                  <span className="mobile-menu-icon" aria-hidden="true">
                    ↪
                  </span>
                  <span>Déconnexion</span>
                </button>
              )}
            </nav>
          </aside>
        </div>
      )}

      {page === "auth" && !isAuthed && (
        <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />
      )}

      {page === "home" && !isAuthed && (
        <div className="home-page home-guest-page">
          <div className="hero-panel home-hero-panel">
            <div className="home-actions">
              <button
                className="home-action-card home-action-create"
                onClick={() => {
                  setTierlistToEdit(null);
                  setTemplateToRank(null);
                  setRankReadOnly(false);
                  startCreate();
                }}
              >
                <span className="home-action-content">
                  <strong>Créer une tierlist</strong>
                  <span>Construisez votre classement à partir de zéro.</span>
                </span>
              </button>
              <button
                className="home-action-card home-action-gallery"
                onClick={() => setPage("gallery")}
              >
                <span className="home-action-content">
                  <strong>Voir mes tierlists</strong>
                  <span>Retrouvez les listes enregistrées dans ce navigateur.</span>
                </span>
              </button>
              <button
                className="home-action-card home-action-community"
                onClick={() => setPage("auth")}
              >
                <span className="home-action-content">
                  <strong>Rejoindre la communauté</strong>
                  <span>Partagez vos tierlists et retrouvez-les partout.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {page === "home" && isAuthed && (
        <div className="home-page home-dashboard">
          <div className="hero-panel home-panel-auth home-auth-hero">
            <h2>
              Bienvenue {me?.displayName || me?.userId || "sur RapidTier"}
            </h2>
            <p className="small hero-copy">
              Créez, publiez et explorez des tierlists. Votre compte donne accès
              au profil, aux amis et au flux public.
            </p>
            <div className="home-cards">
              <div
                className="hero-card home-card home-card-create"
                role="button"
                tabIndex={0}
                onClick={() => setPage("create")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setPage("create");
                }}
              >
                <div className="home-card-title">Créer une TierList</div>
                <span className="home-card-description">Lancez un nouveau classement</span>
              </div>
              <div
                className="hero-card home-card home-card-gallery"
                role="button"
                tabIndex={0}
                onClick={() => setPage("gallery")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setPage("gallery");
                }}
              >
                <div className="home-card-title">Voir mes Tierlists</div>
                <span className="home-card-description">Gérez vos listes enregistrées</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {page === "create" && (
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

      {page === "rank" && (
        <RankTierList
          token={token}
          template={templateToRank}
          readOnly={rankReadOnly}
          canModerateComments={Boolean(
            me?.role === "admin" ||
            (templateToRank?.ownerId && templateToRank.ownerId === me?.id),
          )}
          initialData={
            templateToRank?.type === "ranking" ? templateToRank : null
          }
          onBack={() => setPage("gallery")}
          onSave={handleSaveTierlist}
        />
      )}

      {page === "gallery" && (
        <MyTierlistsView
          tierlists={myTierlists}
          onRank={openRankWith}
          onView={openViewWith}
          onEdit={openEditWith}
          onDelete={async (id) => {
            if (token) {
              await communityApi.deleteTierlist(token, id);
            }
            deleteTemporaryTierlist(id);
            setMyTierlists((prev) =>
              prev.filter((t) => (t.id || t._id) !== id),
            );
          }}
          onOpenProfile={openPublicProfile}
        />
      )}

      {page === "community" && (
        <CommunityFeed
          token={token}
          onRank={openRankWith}
          onView={openViewWith}
          onCopy={copyTierlist}
          onOpenProfile={openPublicProfile}
        />
      )}

      {page === "admin" && me?.role === "admin" && (
        <AdminDashboard
          token={token}
          onViewTierlist={openViewWith}
          onEditTierlist={openEditWith}
          onOpenProfile={openPublicProfile}
        />
      )}

      {page === "profile" && (
        <div className="profile-page">
          {publicProfileId && publicProfileId !== me?.id ? (
            <UserProfileView
              token={token}
              userId={publicProfileId}
              onOpenProfile={openPublicProfile}
              onBack={() => setPublicProfileId(me?.id)}
              onRank={openRankWith}
              onView={openViewWith}
              onCopy={copyTierlist}
            />
          ) : (
            <div className="profile-dashboard">
              <section className="profile-identity-card">
                <label
                  className="profile-avatar-picker"
                  title="Changer la photo de profil"
                >
                  <img
                    src={me?.avatar || "https://placehold.co/160x160"}
                    alt={me?.displayName || me?.userId}
                    className="profile-avatar-large"
                  />
                  <span className="profile-camera-button" aria-hidden="true">
                    📷
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      updateAvatarFromFile(event.target.files?.[0])
                    }
                    className="profile-avatar-input"
                  />
                </label>
                <div className="profile-identity-copy">
                  <span className="profile-kicker">Mon profil</span>
                  <input
                    className="profile-name-input"
                    value={me?.displayName || ""}
                    onChange={(event) =>
                      updateProfile({ displayName: event.target.value })
                    }
                    disabled={profileLoading}
                    aria-label="Nom affiché"
                  />
                  <span className="profile-handle">@{me?.userId}</span>
                  <span className="profile-hint">
                    Cliquez sur votre photo pour la modifier.
                  </span>
                </div>
                {profileError && (
                  <div className="auth-error profile-error">{profileError}</div>
                )}
              </section>

              <section className="profile-network-card">
                {friendFeedback && (
                  <div className={`friend-feedback ${friendFeedback.type}`}>
                    <span>{friendFeedback.type === "success" ? "✓" : "!"}</span>
                    {friendFeedback.text}
                    <button
                      type="button"
                      aria-label="Fermer"
                      onClick={() => setFriendFeedback(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-kicker">Réseau</span>
                    <h2>Amis</h2>
                  </div>
                  <span className="profile-count">
                    {(me?.friends || []).length}
                  </span>
                </div>

                <div className="profile-search profile-search-compact">
                  <span className="profile-search-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher un utilisateur"
                    aria-label="Rechercher un utilisateur"
                  />
                </div>
                <div className="profile-search-results">
                  {searchResults.map((user) => (
                    <div className="profile-search-item" key={user.id}>
                      <button
                        className="profile-user-link"
                        onClick={() => openPublicProfile(user.id)}
                      >
                        <img
                          src={user.avatar || "https://placehold.co/40x40"}
                          alt=""
                          className="profile-result-avatar"
                        />
                        <span>
                          <strong>{user.displayName || user.userId}</strong>
                          <small>@{user.userId}</small>
                        </span>
                      </button>
                      {friendIds.has(user.id) ? (
                        <button
                          className="btn"
                          onClick={() => removeFriend(user.id)}
                        >
                          Retirer
                        </button>
                      ) : sentRequestIds.has(user.id) ? (
                        <span className="profile-request-status">
                          Demande envoyée
                        </span>
                      ) : receivedRequestIds.has(user.id) ? (
                        <span className="profile-request-status">
                          Répondez à sa demande
                        </span>
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

                {(me?.friendRequests || []).length > 0 && (
                  <div className="profile-requests">
                    <div className="profile-subheading">Demandes reçues</div>
                    {me.friendRequests.map((request) => (
                      <div className="profile-request-item" key={request.id}>
                        <img
                          src={
                            request.from?.avatar || "https://placehold.co/40x40"
                          }
                          alt=""
                          className="profile-result-avatar"
                        />
                        <span>
                          <strong>
                            {request.from?.displayName || request.from?.userId}
                          </strong>
                          <small>veut rejoindre votre réseau</small>
                        </span>
                        <div className="profile-request-actions">
                          <button
                            className="btn secondary"
                            onClick={() => acceptFriendRequest(request.id)}
                          >
                            Accepter
                          </button>
                          <button
                            className="btn"
                            onClick={() => rejectFriendRequest(request.id)}
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="profile-friends">
                  {(me?.friends || []).length === 0 ? (
                    <div className="profile-empty-state">
                      Votre réseau est encore vide.
                    </div>
                  ) : (
                    (me?.friends || []).map((friend) => (
                      <div key={friend.id} className="profile-friend-chip">
                        <button
                          type="button"
                          className="profile-friend-main"
                          onClick={() => openPublicProfile(friend.id)}
                        >
                          <img
                            src={friend.avatar || "https://placehold.co/40x40"}
                            alt=""
                            className="profile-friend-avatar"
                          />
                          <span>
                            <strong>
                              {friend.displayName || friend.userId}
                            </strong>
                            <small>@{friend.userId}</small>
                          </span>
                        </button>
                        {friend.role !== "admin" &&
                          friend.userId !== "ibra" && (
                            <button
                              type="button"
                              className="profile-friend-remove"
                              onClick={() => removeFriend(friend.id)}
                              aria-label={`Retirer ${friend.displayName || friend.userId}`}
                            >
                              ×
                            </button>
                          )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="profile-password-card">
                <div className="profile-section-heading">
                  <div>
                    <span className="profile-kicker">Sécurité</span>
                    <h2>Mot de passe</h2>
                  </div>
                </div>
                <form
                  className="profile-password-form"
                  onSubmit={updatePassword}
                >
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                    placeholder="Mot de passe actuel"
                    autoComplete="current-password"
                    required
                  />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    placeholder="Nouveau mot de passe"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <input
                    type="password"
                    value={passwordForm.confirmation}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmation: event.target.value,
                      }))
                    }
                    placeholder="Confirmer le nouveau mot de passe"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={passwordLoading}
                  >
                    {passwordLoading
                      ? "Modification..."
                      : "Modifier le mot de passe"}
                  </button>
                </form>
                {passwordError && (
                  <div className="auth-error profile-password-message">
                    {passwordError}
                  </div>
                )}
                {passwordMessage && (
                  <div className="profile-success profile-password-message">
                    {passwordMessage}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
