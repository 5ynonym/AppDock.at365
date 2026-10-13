import type {
  NotificationActionRequest,
  NotificationBannerModel,
} from '../../shared/notifications';
import type { NotificationService } from './notification-service';

/** Shared presentation projection; native Window/View lifetime stays in the surface host. */
export class NotificationSurfaceController {
  constructor(
    private service: NotificationService,
    private dark: () => boolean,
    readonly target: 'banner' | 'desktop' = 'banner',
  ) {}
  subscribe(callback: () => void) {
    return this.service.subscribe(callback);
  }
  items() {
    return this.service.targetItems(this.target);
  }
  snapshot(
    sessionId: string,
    viewport: NotificationBannerModel['viewport'],
  ): NotificationBannerModel {
    return {
      schemaVersion: 1,
      surface: this.target,
      contextId: 'primary',
      sessionId,
      revision: this.service.revision,
      dark: this.dark(),
      items: this.items(),
      viewport,
    };
  }
  async act(request: NotificationActionRequest) {
    if (!this.items().some((i) => i.id === request?.notificationId))
      throw Error('Notification is not presented');
    await this.service.invoke(request);
  }
  delivery(ids: string[], state: 'showing' | 'hidden' | 'failed') {
    this.service.setDelivery(this.target, ids, state, 'hidden');
  }
}
