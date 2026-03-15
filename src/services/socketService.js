import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

let socket = null;
let messageListeners = [];
let connectionPromise = null;

export const initSocket = () => {
  if (socket) {
    console.log("Socket already initialized, returning existing socket. Connected:", socket.connected);
    return Promise.resolve(socket);
  }

  console.log("Creating new Socket.IO connection...");
  connectionPromise = new Promise((resolve) => {
    console.log("Initializing Socket.IO with SERVER_URL:", SERVER_URL);
    socket = io(SERVER_URL, {
      withCredentials: true,
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("✅ Socket CONNECTED:", socket.id);
      resolve(socket);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket DISCONNECTED");
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // Centralized message listener that broadcasts to all registered listeners
    socket.on("receiveMessage", (data) => {
      console.log("🔔 Socket.IO receiveMessage event fired with data:", data);
      console.log("📢 Number of listeners registered:", messageListeners.length);
      messageListeners.forEach((listener, index) => {
        console.log(`  → Calling listener ${index}`);
        listener(data);
      });
    });
  });

  return connectionPromise;
};

export const getSocket = () => {
  if (!socket) initSocket();
  return socket;
};

// Wait for socket to be connected
export const waitForSocket = async () => {
  if (!socket) {
    return initSocket();
  }
  if (socket.connected) {
    return Promise.resolve(socket);
  }
  return connectionPromise;
};

// Register a listener to be called when a message is received
export const onMessage = (callback) => {
  messageListeners.push(callback);
  return () => {
    messageListeners = messageListeners.filter((l) => l !== callback);
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionPromise = null;
  }
};
