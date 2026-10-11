import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExtensionSnapshot, Settings, SettingsSnapshot } from '../shared/contracts';
import type { SettingsEdit, SettingsEditingState } from '../shared/settings-editing';
import { createDefaultSettings } from '../shared/settings-schema';

/** Input queue and optimistic rendering only; the accepted session belongs to main. */
export function useSettingsEditor(
  current: SettingsSnapshot | undefined,
  _extensions: ExtensionSnapshot[],
  run: (work: () => Promise<unknown>, message?: string) => Promise<void>,
) {
  const [state, setState] = useState<SettingsEditingState>(() => ({
    sessionId: '',
    editRevision: -1,
    revision: current?.revision ?? -1,
    draft: current?.value ?? createDefaultSettings(),
    text: '',
    mode: 'form',
    dirty: false,
    parseError: '',
    saveError: '',
    pending: false,
    avatarLoading: false,
    avatarChanged: false,
    pageId: 'appearance',
    buffers: {},
  }));
  const local = useRef(state);
  local.current = state;
  const accepted = useRef<SettingsEditingState | undefined>(undefined);
  const queue = useRef(Promise.resolve());
  const queued = useRef(0);
  const live = useRef(true);
  const runRef = useRef(run);
  runRef.current = run;
  const receive = (next: SettingsEditingState) => {
    if (accepted.current && next.editRevision < accepted.current.editRevision) return;
    accepted.current = next;
    if (live.current && queued.current === 0) {
      local.current = next;
      setState(next);
    }
  };
  useEffect(() => {
    live.current = true;
    const refresh = () => {
      void window.dock.settingsEditing().then(receive);
    };
    const unsubscribe = window.dock.onSettingsEditingChanged(refresh);
    refresh();
    return () => {
      live.current = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    void window.dock.settingsEditing().then(receive);
  }, [current?.revision]);
  const api = useMemo(() => {
    const optimistic = (patch: Partial<SettingsEditingState>) => {
      local.current = { ...local.current, ...patch };
      setState(local.current);
    };
    const send = (action: SettingsEdit, patch?: Partial<SettingsEditingState>) => {
      if (patch) optimistic(patch);
      queued.current++;
      const work = queue.current.then(async () => {
        const base =
          action.type === 'mode' || !accepted.current
            ? await window.dock.settingsEditing()
            : accepted.current;
        const next = await window.dock.editSettings({
          sessionId: base.sessionId,
          editRevision: base.editRevision,
          operationId: crypto.randomUUID(),
          action,
        });
        receive(next);
      });
      queue.current = work
        .catch(async (error) => {
          accepted.current = await window.dock.settingsEditing();
          optimistic({ saveError: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          queued.current--;
          if (!queued.current && accepted.current && !local.current.saveError)
            receive(accepted.current);
        });
      return work;
    };
    const ignore = (work: Promise<unknown>) => {
      void work.catch(() => {});
    };
    const setMode = (value: 'form' | 'json') =>
      ignore(send({ type: 'mode', value }, { mode: value }));
    const discard = () => runRef.current(() => send({ type: 'discard' }, { saveError: '' }));
    return {
      edit: (value: Settings) =>
        ignore(
          send(
            { type: 'draft', value },
            {
              draft: value,
              text: JSON.stringify(value, null, 2),
              dirty: true,
              parseError: '',
              saveError: '',
            },
          ),
        ),
      setMode,
      selectPage: (pageId: string) => ignore(send({ type: 'select-page', pageId })),
      switchToForm: () => {
        if (local.current.mode === 'json' && local.current.parseError) return false;
        if (local.current.mode !== 'form') setMode('form');
        return true;
      },
      setAvatar: (bytes: Uint8Array | null, name?: string) =>
        ignore(send({ type: 'avatar', bytes, name })),
      setAvatarLoading: (value: boolean) =>
        ignore(send({ type: 'avatar-loading', value }, { avatarLoading: value })),
      save: () =>
        runRef.current(() => send({ type: 'save' }, { saveError: '' }), '設定を保存しました。'),
      discard,
      reset: () => ignore(send({ type: 'reload' }, { saveError: '' })),
      flush: () => queue.current,
    };
  }, []);
  return { ...state, ...api, avatarDraft: state.avatarChanged ? true : undefined };
}
export type SettingsEditor = ReturnType<typeof useSettingsEditor>;
