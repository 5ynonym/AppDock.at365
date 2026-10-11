import type { ShellPageAction, ShellPageModel, ShellPageRequest } from '../../shared/shell-pages';

/** Content is independent of its WebContents, provider and native bounds. */
export interface ShellPageController {
  readonly id: string;
  readonly route: string;
  readonly kind: ShellPageModel['kind'];
  snapshot(): ShellPageModel;
  act(action: ShellPageAction): Promise<void>;
  update?(request: ShellPageRequest): void;
  dispose?(): void;
}
