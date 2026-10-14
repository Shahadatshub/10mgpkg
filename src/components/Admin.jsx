import React, { useState, useEffect, useRef, useCallback } from "react";
import * as lib from "../lib/library.js";

/* ===========================================================================
   The dashboard. Same palette, same type, same restraint as the public site —
   it should feel like the back room of the gallery, not a different building.
   =========================================================================== */

const UNFILED = "__unfiled__";
const HERO = "__hero__";
const EXHIBIT = "__exhibit__";

/* ---------------------------------------------------------------------------
   Reordering works two ways on purpose. Dragging is natural with a mouse but
   HTML drag events do nothing on a phone, so every row also has explicit
   move buttons — which are what keyboard users need in any case.
   --------------------------------------------------------------------------- */
function useDragList(items, onCommit) {
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);

  const move = useCallback(
    (fromId, toId) => {
      if (!fromId || !toId || fromId === toId) return;
      const ids = items.map((i) => i.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      onCommit(ids);
    },
    [items, onCommit]
  );

  const shift = useCallback(
    (id, delta) => {
      const ids = items.map((i) => i.id);
      const at = ids.indexOf(id);
      const to = at + delta;
      if (at < 0 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ids.splice(at, 1)[0]);
      onCommit(ids);
    },
    [items, onCommit]
  );

  const handlers = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      dragId.current = id;
      e.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag without this.
      e.dataTransfer.setData("text/plain", id);
    },
    onDragOver: (e) => {
      e.preventDefault();
      if (overId !== id) setOverId(id);
    },
    onDragLeave: () => setOverId((o) => (o === id ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      move(dragId.current, id);
      dragId.current = null;
      setOverId(null);
    },
    onDragEnd: () => {
      dragId.current = null;
      setOverId(null);
    },
    "data-over": overId === id ? "true" : undefined,
  });

  return { handlers, shift };
}

/* ===========================================================================
   SIGN IN
   =========================================================================== */

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await lib.signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <div className="adm-gate">
      <form className="adm-gate__card" onSubmit={submit}>
        <p className="adm-gate__mark display">10MGPKG</p>
        <p className="label adm-gate__sub">Library</p>

        <label className="adm-field">
          <span className="label">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="adm-field">
          <span className="label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="adm-error">{error}</p>}

        <button className="adm-btn adm-btn--solid" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/* ===========================================================================
   UPLOAD TRAY
   =========================================================================== */

function UploadTray({ albumId, startPosition, onDone }) {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const add = (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setQueue((q) => [
      ...q,
      ...files.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
        caption: "",
        stage: "waiting",
        error: "",
      })),
    ]);
  };

  const setCaption = (key, caption) =>
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, caption } : i)));

  const drop = (key) =>
    setQueue((q) => {
      const hit = q.find((i) => i.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return q.filter((i) => i.key !== key);
    });

  const run = async () => {
    setBusy(true);
    let pos = startPosition;
    const added = [];
    for (const item of queue) {
      if (item.stage === "done") continue;
      try {
        const row = await lib.uploadOne(item.file, {
          albumId: albumId === UNFILED || albumId === HERO || albumId === EXHIBIT ? null : albumId,
          caption: item.caption,
          position: pos++,
          onStage: (stage) =>
            setQueue((q) =>
              q.map((i) => (i.key === item.key ? { ...i, stage } : i))
            ),
        });
        added.push(row);
      } catch (err) {
        setQueue((q) =>
          q.map((i) =>
            i.key === item.key
              ? { ...i, stage: "failed", error: err.message || "Upload failed" }
              : i
          )
        );
      }
    }
    setBusy(false);
    // Keep anything that failed on screen so it can be retried.
    setQueue((q) => q.filter((i) => i.stage === "failed"));
    if (added.length) onDone(added);
  };

  const pending = queue.filter((i) => i.stage !== "done").length;

  return (
    <div
      className="adm-tray"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {queue.length === 0 ? (
        <button className="adm-drop" onClick={() => inputRef.current?.click()}>
          <span className="display adm-drop__line">Drop photographs here</span>
          <span className="label adm-drop__hint">or choose files — ten at a time is fine</span>
        </button>
      ) : (
        <>
          <div className="adm-queue">
            {queue.map((item) => (
              <div className="adm-queue__row" key={item.key}>
                <img className="adm-queue__thumb" src={item.preview} alt="" />
                <div className="adm-queue__body">
                  <input
                    className="adm-queue__caption"
                    placeholder="Caption (optional)"
                    value={item.caption}
                    onChange={(e) => setCaption(item.key, e.target.value)}
                    disabled={busy}
                  />
                  <span className={`label adm-stage adm-stage--${item.stage}`}>
                    {item.stage === "waiting" && "Ready"}
                    {item.stage === "resizing" && "Resizing…"}
                    {item.stage === "uploading" && "Uploading…"}
                    {item.stage === "saving" && "Saving…"}
                    {item.stage === "done" && "Done"}
                    {item.stage === "failed" && (item.error || "Failed")}
                  </span>
                </div>
                {!busy && (
                  <button
                    className="adm-icon"
                    onClick={() => drop(item.key)}
                    aria-label="Remove from queue"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="adm-tray__foot">
            <button
              className="adm-btn"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Add more
            </button>
            <button className="adm-btn adm-btn--solid" onClick={run} disabled={busy}>
              {busy ? "Uploading…" : `Upload ${pending}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ===========================================================================
   DASHBOARD
   =========================================================================== */

/* ===========================================================================
   OPENING SCREEN PICKER
   Every photograph in the library, grouped by album. Click one to put it on
   the opening screen; click again to take it off.
   =========================================================================== */

function HeroPicker({ albums, photos, onToggle, onClear }) {
  const chosen = photos.filter((p) => p.in_hero).length;
  const groups = [
    ...albums.map((a) => ({
      key: a.id,
      title: a.title,
      items: photos.filter((p) => p.album_id === a.id),
    })),
    { key: UNFILED, title: "Unfiled", items: photos.filter((p) => !p.album_id) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <div className="adm-main__head">
        <div>
          <h2 className="display adm-main__title">Opening screen</h2>
          <p className="adm-main__note">
            The photographs that float around the title on the first screen.
            Click to add or remove. If none are chosen, every photograph is used.
          </p>
        </div>
        <div className="adm-hero__count">
          <span className="label adm-hint">
            {chosen} chosen{chosen > 0 && chosen < 8 ? " · 8 or more looks best" : ""}
          </span>
          {chosen > 0 && (
            <button className="adm-btn adm-btn--tiny" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="adm-empty display">
          No photographs yet. Upload some into an album first.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="adm-hero__group">
            <p className="label adm-hero__group-title">{g.title}</p>
            <ul className="adm-grid adm-grid--pick">
              {g.items.map((p) => (
                <li key={p.id}>
                  <button
                    className={`adm-pick${p.in_hero ? " is-on" : ""}`}
                    onClick={() => onToggle(p)}
                    aria-pressed={p.in_hero ? "true" : "false"}
                  >
                    <img src={lib.publicUrl(p.thumb_path)} alt="" loading="lazy" />
                    <span className="label adm-pick__tag">
                      {p.in_hero ? "On" : "Add"}
                    </span>
                    <span className="adm-pick__title">{p.title || p.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

/* ===========================================================================
   EXHIBITION PANEL
   The scroll-pinned exhibition block on the home page: switch it on or off,
   swap the poster, and edit the wording around it. Switching it off keeps
   everything here, ready for the next show.
   =========================================================================== */

const EX_FIELDS = [
  { key: "title", label: "Title", hint: "Above the poster" },
  { key: "dates", label: "Dates", hint: "Runs down the left side" },
  { key: "kind", label: "Label", hint: "Runs down the right side, in red" },
  { key: "venue", label: "Venue", hint: "Under the poster" },
  { key: "place", label: "Area", hint: "Small, in red, next to the venue" },
  { key: "link", label: "Link", hint: "Optional — adds a Details ↗ link" },
];

function ExhibitionPanel({ onStatus, note }) {
  const [ex, setEx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    lib
      .fetchSettings()
      .then((s) => setEx({ enabled: true, ...(s.exhibition || {}) }))
      .catch((e) => note(e.message));
  }, [note]);

  const save = async (next, message = "Saved") => {
    setBusy(true);
    try {
      await lib.updateSettings({ exhibition: next });
      setEx(next);
      setDirty(false);
      onStatus(next.enabled !== false && Boolean(next.poster));
      note(message);
    } catch (e) {
      note(e.message);
    } finally {
      setBusy(false);
    }
  };

  const replacePoster = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const old = ex.poster;
      const path = await lib.uploadPoster(file);
      await save({ ...ex, poster: path }, "Poster replaced");
      await lib.removeStoredFile(old);
    } catch (e) {
      note(e.message);
      setBusy(false);
    }
  };

  if (!ex) return <p className="label adm-hint">Loading…</p>;

  const on = ex.enabled !== false;

  return (
    <>
      <div className="adm-main__head">
        <div>
          <h2 className="display adm-main__title">Exhibition</h2>
          <p className="adm-main__note">
            The poster section between the opening screen and your albums.
            Switching it off hides it from the site but keeps everything here
            for next time.
          </p>
        </div>
        <button
          className={`adm-switch${on ? " is-on" : ""}`}
          onClick={() => save({ ...ex, enabled: !on }, on ? "Exhibition hidden" : "Exhibition shown")}
          disabled={busy}
          aria-pressed={on ? "true" : "false"}
        >
          <span className="adm-switch__track"><span className="adm-switch__dot" /></span>
          <span className="label">{on ? "Showing on site" : "Hidden"}</span>
        </button>
      </div>

      <div className={`adm-ex${on ? "" : " is-off"}`}>
        <div className="adm-ex__poster">
          {ex.poster ? (
            <img src={lib.posterUrl(ex.poster)} alt="" />
          ) : (
            <span className="label adm-hint">No poster yet</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              replacePoster(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            className="adm-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : ex.poster ? "Replace poster" : "Upload poster"}
          </button>
        </div>

        <div className="adm-ex__fields">
          {EX_FIELDS.map((f) => (
            <label className="adm-field" key={f.key}>
              <span className="label">
                {f.label} <span className="adm-ex__hint">· {f.hint}</span>
              </span>
              <input
                value={ex[f.key] || ""}
                onChange={(e) => {
                  setEx({ ...ex, [f.key]: e.target.value });
                  setDirty(true);
                }}
              />
            </label>
          ))}
          <div className="adm-ex__foot">
            <button
              className="adm-btn adm-btn--solid"
              onClick={() => save(ex)}
              disabled={busy || !dirty}
            >
              {dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await lib.fetchLibrary();
      setAlbums(data.albums);
      setPhotos(data.photos);
      setSelected((s) => s ?? data.albums[0]?.id ?? UNFILED);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const note = useCallback((text) => {
    setStatus(text);
    setTimeout(() => setStatus((s) => (s === text ? "" : s)), 2600);
  }, []);

  const unfiled = photos.filter((p) => !p.album_id);
  const shown =
    selected === UNFILED ? unfiled : photos.filter((p) => p.album_id === selected);
  const album = albums.find((a) => a.id === selected) || null;
  const heroCount = photos.filter((p) => p.in_hero).length;
  const [exhibitOn, setExhibitOn] = useState(null);
  useEffect(() => {
    lib
      .fetchSettings()
      .then((s) => {
        const e = s.exhibition || {};
        setExhibitOn(e.enabled !== false && Boolean(e.poster));
      })
      .catch(() => {});
  }, []);

  const toggleHero = async (p) => {
    const next = !p.in_hero;
    setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, in_hero: next } : x)));
    try {
      await lib.updatePhoto(p.id, { in_hero: next });
    } catch (e) {
      setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, in_hero: !next } : x)));
      note(e.message);
    }
  };

  const clearHero = async () => {
    const on = photos.filter((p) => p.in_hero);
    if (!on.length || !confirm(`Take all ${on.length} off the opening screen?`)) return;
    setPhotos((list) => list.map((x) => ({ ...x, in_hero: false })));
    try {
      await Promise.all(on.map((p) => lib.updatePhoto(p.id, { in_hero: false })));
      note("Opening screen cleared");
    } catch (e) {
      note(e.message);
      refresh();
    }
  };

  /* ----- album actions ----- */

  const commitAlbumOrder = async (ids) => {
    setAlbums((prev) => ids.map((id) => prev.find((a) => a.id === id)).filter(Boolean));
    try {
      await lib.reorderAlbums(ids);
      note("Album order saved");
    } catch (e) {
      note(e.message);
      refresh();
    }
  };

  const albumDrag = useDragList(albums, commitAlbumOrder);

  const addAlbum = async () => {
    const title = prompt("Album name");
    if (!title) return;
    try {
      const row = await lib.createAlbum(title, albums.length + 1);
      setAlbums((a) => [...a, row]);
      setSelected(row.id);
      note("Album created");
    } catch (e) {
      note(e.message);
    }
  };

  const renameAlbum = async (a) => {
    const title = prompt("Album name", a.title);
    if (title === null) return;
    const subtitle = prompt("Line underneath (optional)", a.subtitle || "");
    try {
      await lib.updateAlbum(a.id, { title, subtitle: subtitle || "" });
      setAlbums((list) =>
        list.map((x) => (x.id === a.id ? { ...x, title, subtitle: subtitle || "" } : x))
      );
      note("Album updated");
    } catch (e) {
      note(e.message);
    }
  };

  const removeAlbum = async (a) => {
    const n = photos.filter((p) => p.album_id === a.id).length;
    const ok = confirm(
      n
        ? `Delete “${a.title}”?\n\nIts ${n} photograph${n === 1 ? "" : "s"} will move to Unfiled, not be deleted.`
        : `Delete “${a.title}”?`
    );
    if (!ok) return;
    try {
      await lib.deleteAlbum(a.id);
      setAlbums((list) => list.filter((x) => x.id !== a.id));
      setPhotos((list) =>
        list.map((p) => (p.album_id === a.id ? { ...p, album_id: null } : p))
      );
      setSelected(UNFILED);
      note("Album deleted");
    } catch (e) {
      note(e.message);
    }
  };

  /* ----- photo actions ----- */

  const commitPhotoOrder = async (ids) => {
    setPhotos((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      const reordered = ids.map((id) => map.get(id)).filter(Boolean);
      const rest = prev.filter((p) => !ids.includes(p.id));
      return [...rest, ...reordered];
    });
    try {
      await lib.reorderPhotos(ids);
      note("Photo order saved");
    } catch (e) {
      note(e.message);
      refresh();
    }
  };

  const photoDrag = useDragList(shown, commitPhotoOrder);

  const saveEdit = async (patch) => {
    try {
      await lib.updatePhoto(editing.id, patch);
      setPhotos((list) =>
        list.map((p) => (p.id === editing.id ? { ...p, ...patch } : p))
      );
      setEditing(null);
      note("Saved");
    } catch (e) {
      note(e.message);
    }
  };

  const removePhoto = async (p) => {
    if (!confirm(`Delete “${p.title || p.slug}” for good?`)) return;
    try {
      await lib.deletePhoto(p);
      setPhotos((list) => list.filter((x) => x.id !== p.id));
      setEditing(null);
      note("Photograph deleted");
    } catch (e) {
      note(e.message);
    }
  };

  const moveToAlbum = async (p, albumId) => {
    const target = albumId === UNFILED ? null : albumId;
    const count = photos.filter((x) => x.album_id === target).length;
    try {
      await lib.movePhoto(p.id, target, count + 1);
      setPhotos((list) =>
        list.map((x) => (x.id === p.id ? { ...x, album_id: target } : x))
      );
      note("Moved");
    } catch (e) {
      note(e.message);
    }
  };

  if (loading) {
    return (
      <div className="adm-gate">
        <p className="label">Loading library…</p>
      </div>
    );
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top__brand">
          <span className="display adm-top__mark">10MGPKG</span>
          <span className="label adm-top__sub">Library</span>
        </div>
        <div className="adm-top__right">
          <span className="label adm-count">
            {photos.length} photograph{photos.length === 1 ? "" : "s"} ·{" "}
            {albums.length} album{albums.length === 1 ? "" : "s"}
          </span>
          <a className="label adm-link" href="/" target="_blank" rel="noopener">
            View site ↗
          </a>
          <button className="adm-btn" onClick={lib.signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="adm-body">
        {/* ---- albums ---- */}
        <aside className="adm-side">
          <ul className="adm-albums adm-albums--top">
            <li className={`adm-album${selected === HERO ? " is-active" : ""}`}>
              <button className="adm-album__main" onClick={() => setSelected(HERO)}>
                <span className="adm-album__pos label">★</span>
                <span className="adm-album__title">Opening screen</span>
                <span className="adm-album__n label">{heroCount || "all"}</span>
              </button>
            </li>
            <li className={`adm-album${selected === EXHIBIT ? " is-active" : ""}`}>
              <button className="adm-album__main" onClick={() => setSelected(EXHIBIT)}>
                <span className="adm-album__pos label">◆</span>
                <span className="adm-album__title">Exhibition</span>
                <span className="adm-album__n label">
                  {exhibitOn === null ? "" : exhibitOn ? "on" : "off"}
                </span>
              </button>
            </li>
          </ul>

          <div className="adm-side__head">
            <span className="label">Albums</span>
            <button className="adm-btn adm-btn--tiny" onClick={addAlbum}>
              + New
            </button>
          </div>

          <p className="adm-hint label">Drag to set the page order</p>

          <ul className="adm-albums">
            {albums.map((a, i) => (
              <li
                key={a.id}
                className={`adm-album${selected === a.id ? " is-active" : ""}`}
                {...albumDrag.handlers(a.id)}
              >
                <button className="adm-album__main" onClick={() => setSelected(a.id)}>
                  <span className="adm-album__pos label">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="adm-album__title">{a.title}</span>
                  <span className="adm-album__n label">
                    {photos.filter((p) => p.album_id === a.id).length}
                  </span>
                </button>
                <div className="adm-album__tools">
                  <button
                    className="adm-icon adm-icon--text"
                    onClick={() => albumDrag.shift(a.id, -1)}
                    disabled={i === 0}
                    aria-label="Move album up"
                  >
                    Up
                  </button>
                  <button
                    className="adm-icon adm-icon--text"
                    onClick={() => albumDrag.shift(a.id, 1)}
                    disabled={i === albums.length - 1}
                    aria-label="Move album down"
                  >
                    Down
                  </button>
                  <button
                    className="adm-icon adm-icon--text"
                    onClick={() => renameAlbum(a)}
                    aria-label="Rename album"
                  >
                    Rename
                  </button>
                  <button
                    className="adm-icon adm-icon--text adm-icon--danger"
                    onClick={() => removeAlbum(a)}
                    aria-label="Delete album"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}

            <li className={`adm-album${selected === UNFILED ? " is-active" : ""}`}>
              <button
                className="adm-album__main"
                onClick={() => setSelected(UNFILED)}
              >
                <span className="adm-album__pos label">—</span>
                <span className="adm-album__title">Unfiled</span>
                <span className="adm-album__n label">{unfiled.length}</span>
              </button>
            </li>
          </ul>
        </aside>

        {/* ---- photos ---- */}
        <main className="adm-main">
          {selected === EXHIBIT ? (
            <ExhibitionPanel onStatus={setExhibitOn} note={note} />
          ) : selected === HERO ? (
            <HeroPicker
              albums={albums}
              photos={photos}
              onToggle={toggleHero}
              onClear={clearHero}
            />
          ) : (
          <>
          <div className="adm-main__head">
            <div>
              <h2 className="display adm-main__title">
                {selected === UNFILED ? "Unfiled" : album?.title || "—"}
              </h2>
              {album?.subtitle && <p className="label adm-main__sub">{album.subtitle}</p>}
            </div>
            <span className="label adm-hint">
              {shown.length} photograph{shown.length === 1 ? "" : "s"} · drag to reorder
            </span>
          </div>

          <UploadTray
            albumId={selected}
            startPosition={shown.length + 1}
            onDone={(rows) => {
              setPhotos((list) => [...list, ...rows]);
              note(`${rows.length} uploaded`);
            }}
          />

          {shown.length === 0 ? (
            <p className="adm-empty display">
              Nothing here yet. Add photographs above.
            </p>
          ) : (
            <ul className="adm-grid">
              {shown.map((p, i) => (
                <li
                  key={p.id}
                  className="adm-card"
                  {...photoDrag.handlers(p.id)}
                >
                  <div className="adm-card__shot">
                    <img src={lib.publicUrl(p.thumb_path)} alt="" loading="lazy" />
                    <span className="adm-card__pos label">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="adm-card__title">{p.title || p.slug}</p>
                  {p.caption && <p className="adm-card__cap">{p.caption}</p>}
                  <div className="adm-card__tools">
                    <button
                      className="adm-icon adm-icon--text"
                      onClick={() => photoDrag.shift(p.id, -1)}
                      disabled={i === 0}
                      aria-label="Move earlier"
                    >
                      Earlier
                    </button>
                    <button
                      className="adm-icon adm-icon--text"
                      onClick={() => photoDrag.shift(p.id, 1)}
                      disabled={i === shown.length - 1}
                      aria-label="Move later"
                    >
                      Later
                    </button>
                    <button
                      className="adm-icon adm-icon--text"
                      onClick={() => setEditing(p)}
                      aria-label="Edit"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </>
          )}
        </main>
      </div>

      {/* ---- edit panel ---- */}
      {editing && (
        <EditPanel
          photo={editing}
          albums={albums}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onDelete={() => removePhoto(editing)}
          onMove={(albumId) => {
            moveToAlbum(editing, albumId);
            setEditing(null);
          }}
        />
      )}

      {status && <div className="adm-toast label">{status}</div>}
    </div>
  );
}

function EditPanel({ photo, albums, onClose, onSave, onDelete, onMove }) {
  const [title, setTitle] = useState(photo.title || "");
  const [caption, setCaption] = useState(photo.caption || "");
  const [inHero, setInHero] = useState(Boolean(photo.in_hero));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="adm-sheet" role="dialog" aria-modal="true">
      <div className="adm-sheet__panel">
        <div className="adm-sheet__head">
          <span className="label">Edit photograph</span>
          <button className="adm-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <img
          className="adm-sheet__shot"
          src={lib.publicUrl(photo.thumb_path)}
          alt=""
        />

        <label className="adm-field">
          <span className="label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="adm-field">
          <span className="label">Caption</span>
          <textarea
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>

        <label className="adm-field">
          <span className="label">Album</span>
          <select
            value={photo.album_id || UNFILED}
            onChange={(e) => onMove(e.target.value)}
          >
            <option value={UNFILED}>Unfiled</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>

        <label className="adm-check">
          <input
            type="checkbox"
            checked={inHero}
            onChange={(e) => setInHero(e.target.checked)}
          />
          <span>Show on the opening screen</span>
        </label>

        <div className="adm-sheet__foot">
          <button className="adm-btn adm-btn--danger" onClick={onDelete}>
            Delete
          </button>
          <button
            className="adm-btn adm-btn--solid"
            onClick={() => onSave({ title, caption, in_hero: inHero })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   ROOT
   =========================================================================== */

export default function Admin() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    lib.currentSession().then(setSession);
    return lib.onAuthChange(setSession);
  }, []);

  if (session === undefined) {
    return (
      <div className="adm-gate">
        <p className="label">Checking…</p>
      </div>
    );
  }
  return session ? <Dashboard /> : <SignIn />;
}
