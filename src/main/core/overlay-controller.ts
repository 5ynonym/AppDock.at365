import type { OverlayAction, OverlayModel } from '../../shared/overlays';

/** Content owns the operation; OverlayHost owns presentation, lifetime and focus. */
export interface OverlayController {
  readonly id: string;
  readonly kind: OverlayModel['kind'];
  readonly sourceId?: string;
  snapshot(): OverlayModel;
  act(action: OverlayAction): Promise<void>;
  cancel(reason: string): void;
  onClosed(callback: () => void): void;
}
