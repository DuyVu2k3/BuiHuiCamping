import * as signalR from '@microsoft/signalr';
import { getApiUrl } from '../apiConfig';

class SignalRService {
  constructor() {
    this.connection = null;
    this.listeners = new Map();
  }

  async startConnection() {
    if (this.connection && (this.connection.state === signalR.HubConnectionState.Connected || this.connection.state === signalR.HubConnectionState.Connecting)) {
      return this.connection;
    }

    const hubUrl = getApiUrl('/orderHub');

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Re-attach all registered listeners when SignalR reconnects
    this.connection.onreconnected((connectionId) => {
      console.log("⚡ SignalR reconnected. Restoring listeners for connectionId:", connectionId);
      this.listeners.forEach((callbacks, eventName) => {
        callbacks.forEach(cb => {
          this.connection.off(eventName, cb);
          this.connection.on(eventName, cb);
          // Trigger callbacks on reconnect to ensure state sync
          try { cb(); } catch (e) {}
        });
      });
    });

    this.connection.onreconnecting((error) => {
      console.warn("⚡ SignalR reconnecting due to:", error);
    });

    try {
      await this.connection.start();
      console.log("⚡ SignalR Connected successfully to:", hubUrl);
      // Ensure listeners attached if registered before connection start
      this.listeners.forEach((callbacks, eventName) => {
        callbacks.forEach(cb => {
          this.connection.off(eventName, cb);
          this.connection.on(eventName, cb);
        });
      });
    } catch (err) {
      console.error("⚡ SignalR Connection error (will retry):", err);
      setTimeout(() => this.startConnection(), 2000);
    }

    return this.connection;
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);

    if (this.connection) {
      this.connection.off(eventName, callback);
      this.connection.on(eventName, callback);
    }
    
    this.startConnection();
  }

  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
    if (this.connection) {
      this.connection.off(eventName, callback);
    }
  }

  async send(methodName, ...args) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return await this.connection.invoke(methodName, ...args);
    }
  }
}

const signalRService = new SignalRService();
export default signalRService;
