import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { HiOutlineSearch } from "react-icons/hi";
import api, { getErrorMessage } from "../../api/axios";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import UserDetailsPanel from "../../components/admin/UserDetailsPanel";
import AccessDialog from "../../components/admin/AccessDialog";
import usePageTitle from "../../hooks/usePageTitle";

const FILTERS = [
  { value: "", label: "All users" },
  { value: "paid", label: "Full access" },
  { value: "free", label: "Free" },
  { value: "unverified", label: "Not verified" },
  { value: "blocked", label: "Blocked" },
  { value: "admin", label: "Admins" },
];
const SEARCH_DELAY_MS = 400;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

// IPP-1704: "All languages" or "React, Node.js"
const accessLabel = (u) =>
  u.accessScope === "some"
    ? (u.paidLanguages || []).map((l) => l.name).join(", ") || "No languages"
    : "All languages";

function Badge({ tone, children }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    grey: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-brand-50 text-brand-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * /admin/users — search users, turn full access on/off, block/unblock.
 */
export default function AdminUsersPage() {
  usePageTitle("Admin · Users");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", filter: "", page: 1 });
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = JSON.stringify([query, reloadCount]);
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const [changes, setChanges] = useState({}); // id -> updated user (after a button click)
  const [busy, setBusy] = useState(null); // `${id}:access` | `${id}:block`
  const [confirmBlock, setConfirmBlock] = useState(null); // user to block
  const [detailsId, setDetailsId] = useState(null); // IPP-1703: user shown in the side panel
  const closeDetails = useCallback(() => setDetailsId(null), []);
  const [accessUser, setAccessUser] = useState(null); // IPP-1704: user in the access popup
  const closeAccess = useCallback(() => setAccessUser(null), []);

  // Debounced search
  useEffect(() => {
    if (searchInput.trim() === query.search) return undefined;
    const timer = setTimeout(
      () => setQuery((q) => ({ ...q, search: searchInput.trim(), page: 1 })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [searchInput, query.search]);

  useEffect(() => {
    let cancelled = false;
    const [{ search, filter, page }] = JSON.parse(requestKey);
    api
      .get("/admin/users", {
        params: {
          search: search || undefined,
          filter: filter || undefined,
          page,
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ key: requestKey, data: data.data, error: "" });
        setChanges({});
      })
      .catch(
        (err) =>
          !cancelled &&
          setResult({
            key: requestKey,
            data: null,
            error: getErrorMessage(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = result.key !== requestKey;

  // kind 'access': value = { access: 'all' | 'some' | 'none', languages } (IPP-1704); kind 'block': value = true / false
  const update = async (user, kind, value) => {
    setBusy(`${user._id}:${kind}`);
    try {
      const url = `/admin/users/${user._id}/${kind}`;
      const body = kind === "access" ? value : { isBlocked: value };
      const { data } = await api.put(url, body);
      setChanges((c) => ({ ...c, [user._id]: { ...user, ...data.data.user } }));
      toast.success(data.message);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const users = (result.data?.users || []).map((u) => changes[u._id] || u);
  const pagination = result.data?.pagination;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Turn full access on after payment, block an account, or open Details
          for study progress and quizzes.
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="relative block">
          <span className="sr-only">Search users</span>
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            maxLength={100}
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label>
          <span className="sr-only">Filter</span>
          <select
            value={query.filter}
            onChange={(e) =>
              setQuery((q) => ({ ...q, filter: e.target.value, page: 1 }))
            }
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {result.error && !loading && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
        >
          <p className="text-sm text-red-700">{result.error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => setReloadCount((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      )}

      {!result.error && (
        <div
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${loading ? "opacity-60" : ""}`}
        >
          {loading && !result.data && (
            <p className="p-6 text-center text-sm text-slate-500">
              Loading users...
            </p>
          )}
          {!loading && !users.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              No users match.
            </p>
          )}
          <ul className="divide-y divide-slate-200">
            {users.map((u) => {
              const isAdmin = u.role === "admin";
              return (
                <li
                  key={u._id}
                  className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailsId(u._id)}
                        className="mr-1 text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {u.name}
                      </button>
                      {isAdmin ? (
                        <Badge tone="blue">Admin</Badge>
                      ) : u.isPaid ? (
                        <Badge tone="green">{accessLabel(u)}</Badge>
                      ) : (
                        <Badge tone="grey">Free</Badge>
                      )}
                      {!u.isVerified && (
                        <Badge tone="amber">Not verified</Badge>
                      )}
                      {u.isBlocked && <Badge tone="red">Blocked</Badge>}
                    </div>
                    <p className="truncate text-sm text-slate-500">{u.email}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Joined {formatDate(u.createdAt)}
                      {u.isPaid && u.paidAt
                        ? ` · paid ${formatDate(u.paidAt)}`
                        : ""}{" "}
                      · {u.quizCount} {u.quizCount === 1 ? "quiz" : "quizzes"}
                      {u.lastQuizAt
                        ? ` · last ${formatDate(u.lastQuizAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={() => setDetailsId(u._id)}
                    >
                      Details
                    </Button>
                    {!isAdmin && (
                      <>
                        <Button
                          variant="secondary"
                          className="px-3 py-2 text-xs"
                          loading={busy === `${u._id}:access`}
                          disabled={Boolean(busy)}
                          onClick={() => setAccessUser(u)}
                        >
                          Edit access
                        </Button>
                        <Button
                          variant="secondary"
                          className={`px-3 py-2 text-xs ${u.isBlocked ? "" : "text-red-600"}`}
                          loading={busy === `${u._id}:block`}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            u.isBlocked
                              ? update(u, "block", false)
                              : setConfirmBlock(u)
                          }
                        >
                          {u.isBlocked ? "Unblock" : "Block"}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pagination && (
        <>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={(page) => setQuery((q) => ({ ...q, page }))}
          />
          <p className="mt-3 text-center text-xs text-slate-500">
            {pagination.total} users
          </p>
        </>
      )}

      <UserDetailsPanel userId={detailsId} onClose={closeDetails} />

      {accessUser && (
        <AccessDialog
          key={accessUser._id}
          user={accessUser}
          saving={busy === `${accessUser._id}:access`}
          onCancel={closeAccess}
          onSave={async (value) => {
            if (await update(accessUser, "access", value)) setAccessUser(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmBlock)}
        title={`Block ${confirmBlock?.name}?`}
        text="They will be logged out and cannot log in until you unblock them."
        confirmText="Block"
        onCancel={() => setConfirmBlock(null)}
        onConfirm={() => {
          const u = confirmBlock;
          setConfirmBlock(null);
          update(u, "block", true);
        }}
      />
    </div>
  );
}
