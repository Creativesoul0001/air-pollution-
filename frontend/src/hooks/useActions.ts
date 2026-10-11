import { useCallback, useEffect, useState } from "react";
import {
  assignAction,
  createAction,
  fetchAction,
  fetchActions,
  transitionAction,
  verifyAction,
  type MutResult,
} from "@/lib/api";
import type { ActionRecord, ActionRecord as Action, VerificationRecord } from "@/lib/types";

export function useActions() {
  const [items, setItems] = useState<Action[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; allowed?: string[] } | null>(null);
  const [detail, setDetail] = useState<Action | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const r = await fetchActions(undefined, signal);
    if (signal?.aborted) return;
    if (r.ok) {
      setItems(r.data.results);
      setTotal(r.data.total);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  const showError = (r: Extract<MutResult<unknown>, { ok: false }>) => {
    const allowed = (r.detail as { allowed_transitions?: string[] } | undefined)?.allowed_transitions;
    setActionError({ message: r.error, allowed });
  };

  const create = useCallback(async (body: Record<string, unknown>, actor: string) => {
    setBusy(true);
    setActionError(null);
    const r = await createAction(body, actor);
    setBusy(false);
    if (!r.ok) {
      showError(r);
      return null;
    }
    await load();
    setDetail(r.data);
    return r.data;
  }, [load]);

  const transition = useCallback(async (id: number, toStatus: string, actor: string) => {
    setBusy(true);
    setActionError(null);
    const r = await transitionAction(id, toStatus, actor);
    setBusy(false);
    if (!r.ok) {
      showError(r);
      return null;
    }
    await load();
    setDetail(r.data);
    return r.data;
  }, [load]);

  const assign = useCallback(async (id: number, assignee: string, actor: string) => {
    setBusy(true);
    setActionError(null);
    const r = await assignAction(id, assignee, actor);
    setBusy(false);
    if (!r.ok) {
      showError(r);
      return null;
    }
    await load();
    setDetail(r.data);
    return r.data;
  }, [load]);

  const verify = useCallback(
    async (id: number, body: Record<string, unknown>, actor: string): Promise<VerificationRecord | null> => {
      setBusy(true);
      setActionError(null);
      const r = await verifyAction(id, body, actor);
      setBusy(false);
      if (!r.ok) {
        showError(r);
        return null;
      }
      const fresh = await fetchAction(id);
      if (fresh.ok) setDetail(fresh.data);
      return r.data;
    },
    []
  );

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    const r = await fetchAction(id);
    setDetailLoading(false);
    if (r.ok) setDetail(r.data);
  }, []);

  return {
    items,
    total,
    loading,
    error,
    busy,
    actionError,
    detail,
    detailLoading,
    create,
    transition,
    assign,
    verify,
    loadDetail,
    reload: load,
    clearError: () => setActionError(null),
  };
}
