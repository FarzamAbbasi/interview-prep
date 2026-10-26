import { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../../api/axios";
import Button from "../ui/Button";

/**
 * IPP-1704: choose what a user unlocks: all languages, only some languages, or nothing.
 * Render only while open, with key={user._id}:
 *   {user && <AccessDialog key={user._id} user={user} saving onSave={({ access, languages }) => ...} onCancel />}
 */
export default function AccessDialog({ user, saving, onSave, onCancel }) {
  const saveRef = useRef(null);
  const [languages, setLanguages] = useState({
    list: [],
    error: "",
    loaded: false,
  });
  // Start from the user's current access (a free user starts on "All languages")
  const [access, setAccess] = useState(() =>
    !user.isPaid ? "none" : user.accessScope === "some" ? "some" : "all",
  );
  const [picked, setPicked] = useState(() =>
    (user.paidLanguages || []).map((l) => String(l._id || l)),
  );
  const [error, setError] = useState("");

  // All languages, also inactive ones (admin)
  useEffect(() => {
    if (languages.loaded) return undefined;
    let cancelled = false;
    api
      .get("/languages", { params: { all: true } })
      .then(
        ({ data }) =>
          !cancelled &&
          setLanguages({ list: data.data.languages, error: "", loaded: true }),
      )
      .catch(
        (err) =>
          !cancelled &&
          setLanguages({
            list: [],
            error: getErrorMessage(err),
            loaded: false,
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [languages.loaded]);

  useEffect(() => {
    saveRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const toggle = (id) =>
    setPicked((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  const save = () => {
    if (access === "some" && !picked.length) {
      setError("Pick at least one language");
      return;
    }
    onSave({ access, languages: access === "some" ? picked : [] });
  };

  const option = (value, title, note, children) => (
    <div
      className={`rounded-lg border-2 p-3 ${access === value ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="access"
          value={value}
          checked={access === value}
          onChange={() => {
            setAccess(value);
            setError("");
          }}
          className="mt-1 accent-brand-600"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          {note && <span className="block text-xs text-slate-500">{note}</span>}
        </span>
      </label>
      {children}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="access-title" className="text-lg font-semibold text-slate-900">
          Full access for {user.name}
        </h2>
        <p className="text-sm text-slate-500">{user.email}</p>

        <div className="mt-4 space-y-2">
          {option("all", "All languages", "Includes languages added later")}
          {option(
            "some",
            "Only these languages",
            null,
            access === "some" && (
              <div className="mt-2 pl-7">
                {languages.error && (
                  <p className="text-xs text-red-600">{languages.error}</p>
                )}
                {!languages.loaded && !languages.error && (
                  <p className="text-xs text-slate-500">Loading languages...</p>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {languages.list.map((l) => (
                    <label
                      key={l._id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={picked.includes(String(l._id))}
                        onChange={() => {
                          toggle(String(l._id));
                          setError("");
                        }}
                        className="accent-brand-600"
                      />
                      {l.name}
                      {!l.isActive && (
                        <span className="text-xs text-slate-400">(hidden)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ),
          )}
          {option(
            "none",
            "No access (free)",
            "First topic of every language only",
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button ref={saveRef} onClick={save} loading={saving}>
            Save access
          </Button>
        </div>
      </div>
    </div>
  );
}
