import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

let socket = null;
let messageListeners = [];
let connectionPromise = null;

export const initSocket = () => {
  if (socket) {
    return Promise.resolve(socket);
  }

  connectionPromise = new Promise((resolve) => {
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
      resolve(socket);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("receiveMessage", (data) => {
      messageListeners.forEach((listener) => listener(data));
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
