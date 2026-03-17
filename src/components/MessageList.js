import React, { useEffect, useRef } from "react";
import "./MessageList.css";

const MessageList = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef(null);
  
  // Handle both user.id and user._id formats
  const userId = currentUserId || "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="messages-list">
      {messages.length === 0 ? (
        <div className="no-messages">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => {
          const messageId = message._id || message.id;
          // Support sender as object, plain string ID, or flat senderId field
          const senderId =
            (typeof message.sender === "string" ? message.sender : null) ||
            message.sender?.id ||
            message.sender?._id ||
            message.senderId ||
            message.userId;
          // Defensive: ensure senderId and userId are both strings for comparison
          const normalizedSenderId = String(senderId);
          const normalizedUserId = String(userId);
          const isSent = normalizedSenderId === normalizedUserId;
          return (
            <div
              key={messageId}
              className={`message ${isSent ? "sent" : "received"}`}
            >
              <div className="message-content">{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
