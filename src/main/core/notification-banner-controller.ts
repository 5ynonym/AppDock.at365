import type {
  NotificationActionRequest,
  NotificationBannerModel,
} from '../../shared/notifications';
import type { NotificationService } from './notification-service';

/** Public presentation projection and operations; native lifetime stays in BannerHost. */
export class NotificationBannerController {
  constructor(
    private service: NotificationService,
    private dark: () => boolean,
  ) {}
  subscribe(callback: () => void) {
    return this.service.subscribe(callback);
  }
  items() {
    return this.service.bannerItems();
  }
  snapshot(
    sessionId: string,
    viewport: NotificationBannerModel['viewport'],
  ): NotificationBannerModel {
    return {
      schemaVersion: 1,
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
    this.service.setBannerDelivery(ids, state);
  }
}
