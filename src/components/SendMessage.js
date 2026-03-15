import React, { useState } from "react";
import "./SendMessage.css";

const SendMessage = ({ onSendMessage }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      await onSendMessage(message);
      setMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="send-message-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        disabled={loading}
        className="message-input"
      />
      <button type="submit" disabled={loading} className="btn-send">
        {loading ? "Sending..." : "Send"}
      </button>
    </form>
  );
};

export default SendMessage;
