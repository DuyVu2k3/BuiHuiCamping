import * as signalR from '@microsoft/signalr';
import { getApiUrl } from '../apiConfig';

class SignalRService {
  constructor() {
    this.connection = null;
    this.listeners = new Map();
    this.startingPromise = null;
  }

  async startConnection() {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    this.startingPromise = (async () => {
      try {
        const hubUrl = getApiUrl('/orderHub');

        if (!this.connection) {
          this.connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
              withCredentials: true
            })
            .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

          // Re-attach listeners on reconnect
          this.connection.onreconnected((connectionId) => {
            console.log("⚡ SignalR reconnected. Restoring listeners for connectionId:", connectionId);
            this.listeners.forEach((callbacks, eventName) => {
              callbacks.forEach(cb => {
                try {
                  this.connection.off(eventName, cb);
                  this.connection.on(eventName, cb);
                  cb();
                } catch (e) {}
              });
            });
          });

          this.connection.onreconnecting((error) => {
            console.warn("⚡ SignalR reconnecting due to:", error);
          });
        }

        if (this.connection.state === signalR.HubConnectionState.Disconnected) {
          await this.connection.start();
          console.log("⚡ SignalR Connected successfully to:", hubUrl);

          // Attach all registered listeners
          this.listeners.forEach((callbacks, eventName) => {
            callbacks.forEach(cb => {
              try {
                this.connection.off(eventName, cb);
                this.connection.on(eventName, cb);
              } catch (e) {}
            });
          });
        }

        return this.connection;
      } catch (err) {
        console.error("⚡ SignalR Connection error (will retry):", err);
        // Reset startingPromise so next call can retry
        this.startingPromise = null;
        setTimeout(() => this.startConnection(), 3000);
        throw err;
      } finally {
        this.startingPromise = null;
      }
    })();

    return this.startingPromise;
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        this.connection.off(eventName, callback);
        this.connection.on(eventName, callback);
      } catch (e) {}
    }

    this.startConnection().catch(() => {});
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
    if (this.connection) {
      try {
        this.connection.off(eventName, callback);
      } catch (e) {}
    }
  }

  async send(methodName, ...args) {
    await this.startConnection();
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return await this.connection.invoke(methodName, ...args);
    }
  }

  async invoke(methodName, ...args) {
    return await this.send(methodName, ...args);
  }
}

const signalRService = new SignalRService();
export default signalRService;
