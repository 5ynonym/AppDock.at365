import { hostSettingItem } from '../../../src/shared/settings-catalog';
import { settingAnchor } from '../../../src/shared/settings-ui/setting-anchor';
import React from 'react';
import type { Settings, ExtensionSnapshot, HostSnapshot } from '../../../src/shared/contracts';
import type { SettingsPageModel } from '../../../src/shared/settings-page';
import { defaultShellId } from '../../../src/shared/shell';
import { settingsControls } from '../../../src/shared/settings-ui/api';
import { Toggle } from '../../../src/shared/settings-ui/Toggle';
import { VersionCheck } from '../../../src/shared/settings-ui/VersionCheck';
import { WebAppletSettings } from '../../../src/shared/settings-ui/WebAppletSettings';
import { ShortcutsEditor } from './ShortcutsEditor';
import { GesturesEditor } from './GesturesEditor';
import { RibbonSettings } from './RibbonSettings';
import { TraySettings } from './TraySettings';
import { UpdateSettings, AppletUpdateSource } from './UpdateSettings';
import { ProfileEditor } from './ProfileEditor';
import { WebAccountSettings } from './WebAccountSettings';
import { ApiPermissionsSettings } from './ApiPermissionsSettings';
import { CodexSettings } from './CodexSettings';
import { AppletSettings } from './AppletSettings';
export interface FormEditor {
  draft: Settings;
  edit(value: Settings): void;
  setAvatar(bytes: Uint8Array | null, name?: string): void;
  setAvatarLoading(value: boolean): void;
}
export function SettingsForm({
  model,
  editor,
  select,
  invoke,
}: {
  model: SettingsPageModel;
  editor: FormEditor;
  select(id: string): void;
  invoke(name: string, args?: unknown[]): Promise<any>;
}) {
  const { page, auxiliary: aux, editing } = model.content;
  const category = page.id,
    draft = editor.draft,
    edit = editor.edit,
    dirty = editing.dirty,
    busy = editing.pending;
  const extensions = aux.applets ?? [],
    commands = aux.commands ?? [],
    globalHotKeys = aux.statuses ?? [];
  const launch = aux.launch!,
    runtime = aux.runtime!,
    version = aux.version ?? '';
  const avatarUrl = aux.avatarUrl ?? null,
    avatarPreview = undefined;
  const setAvatar = editor.setAvatar,
    setAvatarLoading = editor.setAvatarLoading,
    setCategory = select;
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {
      /* The page controller publishes the operation error. */
    }
  };
  if (page.kind === 'applet')
    return (
      <AppletSettings
        applet={extensions.find((a) => a.id === page.owner)!}
        draft={draft}
        onChange={edit}
      />
    );
  if (page.kind === 'web')
    return (
      <WebAppletSettings
        editor={editor}
        itemId={page.owner}
        accounts={aux.accounts ?? []}
        onDefaults={() => invoke('importWebDefaults')}
        onAccounts={() => void invoke('openWebAccounts')}
        onDelete={() => void invoke('deleteWebApplet')}
      />
    );
  if (category === 'codex')
    return <CodexSettings onOpenPermissions={() => select('permissions')} />;
  if (category === 'permissions')
    return (
      <ApiPermissionsSettings
        grants={aux.permissions?.permissions ?? {}}
        error={aux.permissions?.error}
        busy={busy}
        onOpenCodex={() => select('codex')}
      />
    );
  if (category === 'web-accounts')
    return (
      <WebAccountSettings
        accounts={aux.accounts ?? []}
        savedItems={(aux.accountReferences?.saved as Settings['webApplets']['items']) ?? []}
        draftItems={(aux.accountReferences?.draft as Settings['webApplets']['items']) ?? []}
      />
    );
  return (
    <div className="settings-layout">
      <div className="settings-form">
        {' '}
        {category === 'gestures' && (
          <GesturesEditor
            settings={draft}
            onChange={edit}
            commands={commands}
            applets={extensions}
          />
        )}
        {category === 'ribbon' && (
          <RibbonSettings draft={draft} extensions={extensions} onChange={edit} />
        )}
        {category === 'about' && (
          <section className="about-page" aria-label="バージョン情報・更新">
            <div className="about-host" {...settingAnchor('about', 'versions')}>
              <span className="section-label">APPDOCK</span>
              <h2>
                AppDock.at365 <span>v{version}</span>
              </h2>
              <p>現在使用しているバージョンと、公開されている正式版を確認できます。</p>
              <VersionCheck details disabled={dirty} />
              <UpdateSettings
                draft={draft}
                edit={edit}
                appletCount={extensions.length}
                dirty={dirty}
              />
              <details className="update-disclosure">
                <summary>実行環境の詳細</summary>
                <dl className="runtime-versions">
                  <div>
                    <dt>Electron</dt>
                    <dd>{runtime.electron}</dd>
                  </div>
                  <div>
                    <dt>Chromium</dt>
                    <dd>{runtime.chrome}</dd>
                  </div>
                  <div>
                    <dt>Node.js</dt>
                    <dd>{runtime.node}</dd>
                  </div>
                  <div>
                    <dt>実行環境</dt>
                    <dd>
                      {runtime.platform} / {runtime.arch}
                    </dd>
                  </div>
                </dl>
              </details>
            </div>
            <h3 {...settingAnchor('about', 'updateSource')}>インストール済みのApplet</h3>
            <p className="muted">
              Appletごとに更新できます。更新元を変えるときは各欄の設定を開いてください。
            </p>
            {extensions.length === 0 && <p>Appletはインストールされていません。</p>}
            <div className="about-applets">
              {extensions
                .filter((e) => e.runtime !== 'web')
                .map((e) => (
                  <article key={e.id}>
                    <div>
                      <strong>{e.displayName}</strong>
                      <span className="muted">v{e.version}</span>
                    </div>
                    <VersionCheck id={e.id} details disabled={dirty} />
                    <AppletUpdateSource extension={e} draft={draft} edit={edit} />
                  </article>
                ))}
            </div>
          </section>
        )}
        {category === 'shortcuts' && (
          <ShortcutsEditor
            key={category}
            commands={commands}
            settings={draft}
            onChange={edit}
            applets={extensions.map((e) => ({ id: e.id, title: e.displayName }))}
            statuses={globalHotKeys}
          />
        )}
        {category === 'profile' && (
          <ProfileEditor
            name={draft.profile.name}
            avatarUrl={avatarPreview === undefined ? avatarUrl : avatarPreview}
            busy={busy}
            onLoading={setAvatarLoading}
            onName={(name) => edit({ ...draft, profile: { ...draft.profile, name } })}
            onAvatar={(bytes, preview, name) => {
              setAvatar(bytes, name);
              edit({
                ...draft,
                profile: { ...draft.profile, avatar: bytes ? 'avatar.png' : null },
              });
            }}
          />
        )}
        {category === 'appearance' && (
          <>
            <h3>表示</h3>
            <SettingRow pageId={category} itemKey="shellProvider">
              <select
                aria-label="Shell"
                value={draft.host.shellProvider || defaultShellId}
                onChange={(e) =>
                  edit({ ...draft, host: { ...draft.host, shellProvider: e.target.value } })
                }
              >
                <option value={defaultShellId}>Default Shell</option>
                {draft.host.shellProvider &&
                  draft.host.shellProvider !== defaultShellId &&
                  !extensions.some((e) => e.shell && e.id === draft.host.shellProvider) && (
                    <option value={draft.host.shellProvider} disabled>
                      未導入のShell ({draft.host.shellProvider})
                    </option>
                  )}
                {extensions
                  .filter((e) => e.shell && e.id !== defaultShellId)
                  .map((e) => (
                    <option key={e.id} value={e.id} disabled={!e.enabled}>
                      {e.displayName}
                    </option>
                  ))}
              </select>
            </SettingRow>
            <SettingRow pageId={category} itemKey="theme">
              <select
                aria-label="テーマ"
                value={draft.host.theme}
                onChange={(e) =>
                  edit({
                    ...draft,
                    host: {
                      ...draft.host,
                      theme: e.target.value as Settings['host']['theme'],
                    },
                  })
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </SettingRow>
          </>
        )}
        {category === 'tray' && (
          <TraySettings draft={draft} extensions={extensions} commands={commands} onChange={edit} />
        )}
        {category === 'general' && (
          <>
            <h3>一般</h3>
            <SettingRow pageId={category} itemKey="permissions">
              <button onClick={() => setCategory('permissions')}>操作の許可を開く</button>
            </SettingRow>
            <SettingRow pageId={category} itemKey="startAtLogon">
              <Toggle
                label="スタートアップに登録"
                checked={draft.host.startAtLogon}
                disabled={!launch.supported}
                onChange={(v) => edit({ ...draft, host: { ...draft.host, startAtLogon: v } })}
              />
            </SettingRow>
            <SettingRow pageId={category} itemKey="runAsAdministrator">
              <Toggle
                label="常に管理者として起動"
                checked={draft.host.runAsAdministrator}
                disabled={!launch.supported}
                onChange={(v) => edit({ ...draft, host: { ...draft.host, runAsAdministrator: v } })}
              />
            </SettingRow>
            <SettingRow
              pageId={category}
              itemKey="launch"
              description={
                launch.supported
                  ? `${launch.elevated ? '管理者権限で動作中' : '通常権限で動作中'}。スタートアップ: ${launch.registered ? (launch.taskElevated ? '登録済み（管理者）' : '登録済み（通常権限）') : '未登録'}。`
                  : '起動設定はWindowsの発行版AppDockで使用できます。'
              }
            >
              <div className="button-row">
                <button
                  disabled={!launch.supported || busy}
                  onClick={() => void run(() => invoke('refreshLaunchState'))}
                >
                  状態を確認
                </button>
                <button
                  disabled={!launch.supported || launch.elevated || dirty || busy}
                  onClick={() => void run(() => invoke('restartAsAdministrator'))}
                >
                  管理者として再起動
                </button>
              </div>
            </SettingRow>
            {launch.error && <p role="alert">{launch.error}</p>}
            {launch.supported && (
              <p className="muted">
                起動設定はこのEXEの配置先ごとに登録します。移動する前に登録を解除してください。管理者設定をOFFにした場合は、AppDockを完全終了し、通常の方法で起動し直してください。再起動する前に、編集中の設定を保存してください。
              </p>
            )}
            {(
              ['closeToTray', 'notifications', 'hardwareAcceleration', 'startMinimized'] as const
            ).map((key) => (
              <SettingRow key={key} pageId={category} itemKey={key}>
                <Toggle
                  label={hostSettingItem(category, key).title}
                  checked={draft.host[key]}
                  onChange={(v) => edit({ ...draft, host: { ...draft.host, [key]: v } })}
                />
              </SettingRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
function SettingRow({
  pageId,
  itemKey,
  description,
  children,
}: {
  pageId: string;
  itemKey: string;
  description?: string;
  children: React.ReactNode;
}) {
  const item = hostSettingItem(pageId, itemKey);
  return (
    <div className="setting-row" {...settingAnchor(pageId, itemKey)}>
      <div>
        <strong>{item.title}</strong>
        <p>{description ?? item.description}</p>
      </div>
      {children}
    </div>
  );
}
