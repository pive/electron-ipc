
export const IPC_API_NAME = 'backend';

export function backendInterface() {
  return window[IPC_API_NAME as keyof Window];
}
