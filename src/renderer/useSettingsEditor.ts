import { useEffect, useState } from 'react';
import type { ExtensionSnapshot, Settings, SettingsSnapshot } from '../shared/contracts';
import { createDefaultSettings, parseSettings } from '../shared/settings-schema';
import { validateAppletSettings } from '../shared/setting-definitions';

const initialSnapshot: SettingsSnapshot = {
  value: createDefaultSettings(),
  revision: -1,
  path: '',
};
/** One editing session survives navigation between both settings surfaces. */
export function useSettingsEditor(
  current: SettingsSnapshot | undefined,
  extensions: ExtensionSnapshot[],
  run: (work: () => Promise<unknown>, message?: string) => Promise<void>,
) {
  const snapshot = current ?? initialSnapshot;
  const [draft, setDraft] = useState<Settings>(snapshot.value);
  const [text, setText] = useState(JSON.stringify(snapshot.value, null, 2));
  const [revision, setRevision] = useState(snapshot.revision);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [parseError, setParseError] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<Uint8Array | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(undefined);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const switchToForm = () => {
    if (mode === 'json') {
      try {
        setDraft(parseSettings(JSON.parse(text)));
        setParseError('');
      } catch (error) {
        setParseError('JSONの内容を修正してからフォームを開いてください。' + String(error));
        return false;
      }
    }
    setMode('form');
    return true;
  };
  useEffect(() => {
    if (!dirty) {
      setDraft(snapshot.value);
      setText(JSON.stringify(snapshot.value, null, 2));
      setRevision(snapshot.revision);
    }
  }, [snapshot.revision, dirty]);
  const edit = (value: Settings) => {
    setDraft(value);
    setText(JSON.stringify(value, null, 2));
    setDirty(true);
  };
  const reset = () => {
    setDirty(false);
    setDraft(snapshot.value);
    setText(JSON.stringify(snapshot.value, null, 2));
    setRevision(snapshot.revision);
    setParseError('');
    setAvatarDraft(undefined);
    setAvatarPreview(undefined);
  };
  const save = async () => {
    let value: Settings;
    try {
      value = parseSettings(mode === 'json' ? JSON.parse(text) : draft);
      validateAppletSettings(value, extensions);
      setParseError('');
    } catch (e) {
      setParseError(
        `${mode === 'json' ? 'JSONの形式' : '設定の内容'}を確認してください。${e instanceof Error ? e.message : e}`,
      );
      return;
    }
    await run(async () => {
      const result = await window.dock.saveSettings(value, revision, avatarDraft);
      setRevision(result.revision);
      setDirty(false);
      setAvatarDraft(undefined);
      setAvatarPreview(undefined);
    }, '設定を保存しました。');
  };
  return {
    draft,
    text,
    setText,
    revision,
    dirty,
    setDirty,
    mode,
    setMode,
    parseError,
    setParseError,
    avatarDraft,
    avatarPreview,
    setAvatarDraft,
    setAvatarPreview,
    avatarLoading,
    setAvatarLoading,
    edit,
    reset,
    save,
    switchToForm,
  };
}
export type SettingsEditor = ReturnType<typeof useSettingsEditor>;
