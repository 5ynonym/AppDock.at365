import { randomUUID, createHash } from 'node:crypto';
import { orderRibbon, visibleRibbonItems } from '../../shared/applet-pages';
import type { ExtensionSnapshot, Settings } from '../../shared/contracts';
import type { NavigationState, RibbonView, UiActionRequest } from '../../shared/shell';

export class NavigationCoordinator {
  private requestSequence = 0;
  state: NavigationState = { route: 'home', request: 0 };
  constructor(
    private changed: () => void,
    private beforeNavigate?: () => Promise<void>,
    private failed?: (error: unknown) => void,
  ) {}
  navigate(route: string, section?: NavigationState['section'], appletId?: string) {
    if (
      !['home', 'extensions', 'settings', 'logs', 'notifications'].includes(route) &&
      !/^page:[a-z0-9.-]+:[a-z0-9.-]+$/.test(route)
    )
      throw Error('Unknown route');
    const sequence = ++this.requestSequence;
    if (route === this.state.route && !section && !appletId) return;
    const apply = () => {
      if (sequence !== this.requestSequence) return;
      this.state = { route, section, appletId, request: this.state.request + 1 };
      this.changed();
    };
    if (this.beforeNavigate)
      return this.beforeNavigate()
        .then(apply)
        .catch((error) => {
          this.failed?.(error);
        });
    apply();
  }
}
type Action = {
  route?: string;
  section?: NavigationState['section'];
  command?: string;
  theme?: true;
};
export class UiPresentation {
  readonly epoch = randomUUID();
  private revision = 0;
  private signature = '';
  private assets = new Map<string, string>();
  private actions = new Map<string, Action>();
  private requests = new Map<
    string,
    { action: string; promise: Promise<unknown>; completed: boolean; expires: number }
  >();
  constructor(
    private options: {
      settings(): Settings;
      applets(): ExtensionSnapshot[];
      dark(): boolean;
      avatar(): string | undefined;
      navigation: NavigationCoordinator;
      execute(command: string): Promise<unknown>;
      theme(): Promise<unknown>;
    },
  ) {}
  private asset(data: string | undefined) {
    if (
      !data ||
      data.length > 1024 * 1024 ||
      !/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)
    )
      return;
    const id = createHash('sha256').update(data).digest('hex');
    this.assets.set(id, data);
    return id;
  }
  get(allowed: (action: Action) => boolean = () => true): RibbonView {
    const settings = this.options.settings();
    const applets = this.options.applets();
    const dark = this.options.dark();
    const route = this.options.navigation.state.route;
    this.assets.clear();
    this.actions.clear();
    this.actions.set('ribbon.configure', { route: 'settings', section: 'ribbon' });
    const items = orderRibbon(
      visibleRibbonItems(applets, settings.ribbon.separators),
      settings.ribbon.order,
    )
      .filter((item) => !settings.ribbon.hidden.includes(item.id))
      .map((item) => {
        const actionId = `ribbon.${item.id}`;
        const provider = applets.find((e) => e.id === item.extensionId);
        const page = provider?.pages?.find((p) => p.id === item.pageId);
        const action: Action = item.extensionId
          ? { command: page?.openCommand }
          : item.id === 'theme'
            ? { theme: true }
            : item.id === 'profile'
              ? { route: 'settings', section: 'profile' }
              : { route: item.id };
        if (item.kind !== 'separator') this.actions.set(actionId, action);
        const available =
          !action.command ||
          provider?.commands?.some((c) => c.id === action.command && c.available) === true;
        const enabled =
          item.kind === 'separator' ||
          (!!(action.route || action.theme || action.command) && available && allowed(action));
        return {
          id: item.id,
          kind: item.kind === 'separator' ? ('separator' as const) : ('button' as const),
          title: item.title,
          tooltip: item.id === 'profile' ? settings.profile.name : item.title,
          placement: settings.ribbon.bottom.includes(item.id)
            ? ('bottom' as const)
            : ('top' as const),
          selected: route === item.id,
          enabled,
          ...(!enabled
            ? {
                disabledReason:
                  provider?.commands?.find((c) => c.id === action.command)?.disabledReason ??
                  'この接続からは実行できません。',
              }
            : {}),
          ...(item.kind === 'separator' ? {} : { actionId }),
          icon:
            item.id === 'profile'
              ? {
                  assetId: this.asset(this.options.avatar()),
                  text: Array.from(settings.profile.name || 'A')[0],
                }
              : {
                  assetId: this.asset(item.iconImage),
                  name: item.id === 'theme' ? (dark ? 'sun' : 'moon') : item.icon,
                },
        };
      });
    const body = {
      schemaVersion: 1 as const,
      epoch: this.epoch,
      contextId: 'primary' as const,
      dark,
      route,
      contextActionId: 'ribbon.configure',
      items,
    };
    // Projection permissions may differ between callers; revision describes host state only.
    const signature = JSON.stringify({
      settings,
      route,
      dark,
      applets: applets.map((e) => [e.id, e.state, e.enabled, e.pages, e.commands]),
      assets: [...this.assets.keys()],
    });
    if (signature !== this.signature) {
      this.signature = signature;
      this.revision++;
    }
    return { ...body, revision: this.revision };
  }
  getAsset(id: unknown) {
    this.get();
    if (typeof id !== 'string' || !this.assets.has(id)) throw Error('Unknown presentation asset');
    return { dataUrl: this.assets.get(id)! };
  }
  invoke(request: UiActionRequest, scope: string, execute?: (action: Action) => Promise<unknown>) {
    if (
      !request ||
      (request.contextId !== undefined && request.contextId !== 'primary') ||
      request.epoch !== this.epoch ||
      typeof request.requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(request.requestId)
    )
      throw Error('Stale epoch or invalid request ID');
    this.get();
    const action = this.actions.get(request.actionId);
    if (!action) throw Error('Unknown or hidden action');
    const key = `${scope}:${request.requestId}`;
    for (const [id, entry] of this.requests)
      if (entry.completed && entry.expires < Date.now()) this.requests.delete(id);
    const previous = this.requests.get(key);
    if (previous) {
      if (previous.action !== request.actionId)
        throw Error('Request ID reused with another action');
      return previous.promise;
    }
    if (this.requests.size >= 512) {
      const oldest = [...this.requests].find(([, entry]) => entry.completed);
      if (oldest) this.requests.delete(oldest[0]);
      else throw Error('Too many pending UI actions');
    }
    const promise = Promise.resolve().then(async () => {
      const current = this.get();
      if (
        request.actionId !== current.contextActionId &&
        !current.items.some((i) => i.actionId === request.actionId && i.enabled)
      )
        throw Error('Action is no longer available');
      if (execute) return execute(action);
      if (action.command) return this.options.execute(action.command);
      if (action.theme) return this.options.theme();
      await this.options.navigation.navigate(action.route!, action.section);
      return { accepted: true };
    });
    const entry = { action: request.actionId, promise, completed: false, expires: Infinity };
    this.requests.set(key, entry);
    const completed = () => {
      entry.completed = true;
      entry.expires = Date.now() + 120000;
    };
    void promise.then(completed, completed);
    return promise;
  }
  disconnect(scope: string) {
    for (const key of this.requests.keys())
      if (key.startsWith(scope + ':')) this.requests.delete(key);
  }
}
