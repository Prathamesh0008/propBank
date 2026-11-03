export function emulatorAddress(value: string | undefined, label: string): {host: string; port: number};
export function firebaseEnvironment(env: Record<string, string | undefined>): {
  mode: 'firebase' | 'emulator' | 'live'; authProjectId: string; dataProjectId: string;
  firestore?: {host: string; port: number}; auth?: {host: string; port: number};
};
