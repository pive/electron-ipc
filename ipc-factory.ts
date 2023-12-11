import {
  contextBridge,
  ipcRenderer,
  ipcMain,
} from 'electron';

import {IPC_API_NAME} from './ipc';

export interface BackendIPCHandler {
  methodName: string
  handle: (arg: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
}

type ExposedIPCHandler = {
  [key: string]: (arg: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export class IPCMethodsFactory {

  readonly handlers: BackendIPCHandler[] = [];

  declareHandler(handler: BackendIPCHandler): IPCMethodsFactory {
    this.handlers.push(handler);
    return this;
  }

  // exposeInMainWorld() adds a property of name apiName to the window element,
  // containing all declared methods - when called, each method actually sends
  // an IPC message with the name of the method and an object argument.
  // The IPC message is handled on the backend, which will respond with another
  // message with a specific name (here the convention is to append :done and :error)
  // to the method name. the response / error events are wrapped into a promise
  // for convenience.
  // Example:
  // --------
  // We are declaring an API with the name "backend", implementing a "getBackendValue"
  // method.
  // In the browser, one could call window.backend.getBackendValue({ key: 'my_key_value' })
  // The ipcRenderer will then send an IPC message with name 'getBackendValue' and argument
  // { key: 'my_key_value' }.
  // In the electron main process, we are listening to this event, and will trigger the
  // appropriate, declared handler. When handler returns (or errors), we'll reply back
  // the return value or the error in a message, either 'getBackendValue:done' or
  // 'getBackendValue:error' which will be resoved in the original promise
  // window.backend.getBackendValue.
  exposeInMainWorld(): void {
    const exposedHandlers: ExposedIPCHandler = {};
    this.handlers.forEach((handler) => {
      exposedHandlers[handler.methodName] = async (arg) => new Promise((resolve, reject) => {
          ipcRenderer.send(handler.methodName, arg);
          ipcRenderer.on(`${handler.methodName}:done`, (_, response) => {
            resolve(response);
          });
          ipcRenderer.on(`${handler.methodName}:error`, (_, error) => {
            reject(error);
          });
      });
    });
    contextBridge.exposeInMainWorld(IPC_API_NAME, exposedHandlers);
  }

  // connectToBackend() maps the event methods to the real handler
  // and sends back the handler result or error as an IPC reply
  // message.
  connectToBackend(): void {
    this.handlers.forEach((handler) => {
      ipcMain.on(handler.methodName, async (ipcEvent, arg) => {
        // handler can be async or not async
        // wrap into a promise to make sure
        // it is async
        try {
          const response = await Promise.resolve(handler.handle(arg));
          ipcEvent.reply(`${handler.methodName}:done`, response);
        } catch (err) {
          ipcEvent.reply(`${handler.methodName}:error`, err);
        }
      });
    });
  }
}
