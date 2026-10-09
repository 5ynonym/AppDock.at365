import { app, Notification } from 'electron';
import { notificationProtocol, notificationXml, NotificationRoutes } from './notification-routing';

let routes: NotificationRoutes | undefined;
let registered = false;
let registration: { executable: string; args: string[] } | undefined;

export function configureNotifications(executable: string, profile: string, args: string[]) {
  if (process.platform !== 'win32') return;
  routes = new NotificationRoutes(notificationProtocol(executable, profile, app.isPackaged));
  // Windows launches the outer single EXE, which restores the portable
  // environment and forwards this URI to the existing instance/profile.
  registration = { executable, args };
}

export function activateNotification(argv: string[], fallback: () => void) {
  return routes?.activate(argv, fallback) ?? false;
}

export function showNotification(
  title: string,
  body: string,
  silent: boolean,
  clicked: () => void,
) {
  if (!Notification.isSupported()) return;
  if (routes && registration && !registered)
    registered = app.setAsDefaultProtocolClient(
      routes.protocol,
      registration.executable,
      registration.args,
    );
  if (routes && !registered) throw Error('Windows通知の起動先を登録できませんでした。');
  const notification = new Notification(
    routes
      ? { toastXml: notificationXml(title, body, silent, routes.add(clicked)) }
      : { title, body, silent },
  );
  // Windows protocol activation is handled by second-instance. Adding a native
  // click handler as well could execute the same command twice.
  if (!routes) notification.on('click', clicked);
  notification.show();
}
