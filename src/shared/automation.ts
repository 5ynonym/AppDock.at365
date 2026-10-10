export interface AutomationState {
  enabled: boolean;
  allowWrite: boolean;
  allowExecute: boolean;
  allowManageApplets: boolean;
  port: number;
  running: boolean;
  endpoint: string;
  serverId: string;
  error?: string;
  lastClientAt?: string;
  configFile: string;
  registration: 'absent' | 'registered' | 'conflict';
  registrationError?: string;
}

export type AutomationAction =
  | { kind: 'status' }
  | { kind: 'configure'; enabled: boolean; allowWrite: boolean; port: number }
  | { kind: 'register' | 'unregister' | 'test' | 'rotateToken' }
  | { kind: 'selectConfig'; file: string }
  | { kind: 'selectName'; name: string }
  | { kind: 'setExecution'; allowed: boolean }
  | { kind: 'setAppletManagement'; allowed: boolean };

export interface AutomationReply {
  state: AutomationState;
  message?: string;
}
