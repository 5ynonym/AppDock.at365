import type { App } from 'electron';

export function configureWindowRendering(
  app: Pick<App, 'commandLine'>,
  platform = process.platform,
) {
  if (platform !== 'win32') return;
  // Native occlusion can stop a transparent/offscreen compositor even when its
  // WebContents have backgroundThrottling=false. Preserve other feature switches.
  const disabled = new Set(
    app.commandLine.getSwitchValue('disable-features').split(',').filter(Boolean),
  );
  disabled.add('CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-features', [...disabled].join(','));
}
