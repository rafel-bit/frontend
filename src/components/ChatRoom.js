import React, { useState, useEffect, useContext, useRef } from "react";
import apiClient from "../services/apiClient";
import { getSocket, onMessage, waitForSocket } from "../services/socketService";
import { AuthContext } from "../context/AuthContext";
import ContactsList from "./ContactsList";
import MessageList from "./MessageList";
import SendMessage from "./SendMessage";
import SearchContacts from "./SearchContacts";
import "./ChatRoom.css";

const ChatRoom = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const messageUnsubscribeRef = useRef(null);

  // Initialize socket and set up real-time listeners
  useEffect(() => {
    if (!user) return;

    const setupSocket = async () => {
      try {
        console.log("📡 Waiting for socket to be ready...");
        const socket = await waitForSocket();
        const userId = user.id || user._id;
        console.log("📡 Socket ready, emitting join with userId:", userId);
        socket.emit("join", { userId });
        console.log("✅ Joined socket room:", userId);
      } catch (err) {
        console.error("❌ Failed to setup socket:", err);
      }
    };

    setupSocket();
  }, [user]);

  // Fetch contacts
  useEffect(() => {
    fetchContacts();
  }, []);

  // Listen for socket connection and re-join room on reconnect
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      console.log("Socket connected/reconnected, rejoining room");
      const userId = user.id || user._id;
      socket.emit("join", { userId });
      fetchContacts();
    };

    socket.on("connect", handleConnect);
    return () => socket.off("connect", handleConnect);
  }, [user]);

  // Listen for real-time messages from any user (using centralized service pattern)
  useEffect(() => {
    if (!selectedContact || !user) return;

    const selectedContactId = selectedContact?._id || selectedContact?.id;

    console.log("Setting up message listener for contact:", selectedContactId);

    const handleMessage = (data) => {
      console.log("Live message received:", data);

      // Normalize senderId from various possible formats
      const senderId = data.sender?._id || data.sender?.id || data.senderId;
      const recipientId = data.recipient?._id || data.recipient?.id || data.recipientId;

      console.log("Message comparison - senderId:", senderId, "selectedId:", selectedContactId, "recipientId:", recipientId);

      // Check if message is from/to the selected contact
      const isFromSelected = String(senderId) === String(selectedContactId);
      const isToSelected = String(recipientId) === String(selectedContactId);

      if (isFromSelected || isToSelected) {
        const newMessage = {
          id: data._id || data.id,
          content: data.content,
          senderId: String(senderId),
          recipientId: String(recipientId),
          timestamp: data.timestamp,
        };
        console.log("Adding message to UI:", newMessage);
        setMessages((prev) => [...prev, newMessage]);
      }

      // Refresh contacts to show latest message
      fetchContacts();
    };

    // Use centralized onMessage service (registered once at socket initialization)
    const unsubscribe = onMessage(handleMessage);
    messageUnsubscribeRef.current = unsubscribe;

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
      }
    };
  }, [selectedContact, user]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError("");
      console.log("Fetching contacts...");
      const response = await apiClient.get("/api/contacts/get-contacts-for-list");
      console.log("Contacts response:", response.data);
      
      // Handle both possible response structures
      const contactsData = response.data.contacts || response.data.data || response.data || [];
      setContacts(Array.isArray(contactsData) ? contactsData : []);
      console.log("Contacts loaded:", contactsData);
    } catch (err) {
      console.error("Failed to load contacts - Status:", err.response?.status);
      console.error("Failed to load contacts - Response:", err.response?.data);
      console.error("Failed to load contacts - Message:", err.message);
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForContact = async (contact) => {
    if (!contact) return;
    try {
      const contactId = contact._id || contact.id;
      const response = await apiClient.post("/api/messages/get-messages", {
        id: contactId,
      });
      const normalizedMessages = (response.data.messages || []).map((msg) => {
        const senderId = msg.sender?._id || msg.sender?.id || msg.senderId || msg.userId;
        return { ...msg, senderId: senderId ? String(senderId) : "" };
      });
      setMessages(normalizedMessages);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // Fetch messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessagesForContact(selectedContact);
    }
  }, [selectedContact, user]);

  // Polling fallback: fetch messages every 3s in case socket events are missed
  useEffect(() => {
    if (!selectedContact) return;
    const intervalId = setInterval(async () => {
      try {
        const contactId = selectedContact._id || selectedContact.id;
        const response = await apiClient.post("/api/messages/get-messages", { id: contactId });
        const normalizedMessages = (response.data.messages || []).map((msg) => {
          const senderId = msg.sender?._id || msg.sender?.id || msg.senderId || msg.userId;
          return { ...msg, senderId: senderId ? String(senderId) : "" };
        });
        setMessages((prev) => {
          if (normalizedMessages.length !== prev.length) return normalizedMessages;
          return prev;
        });
      } catch (err) {
        // Silently fail — polling is just a fallback
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [selectedContact]);

  const handleSendMessage = async (messageContent) => {
    if (!selectedContact) return;

    try {
      // Emit message via socket with correct payload structure
      const socket = getSocket();
      if (socket) {
        const senderId = user.id || user._id;
        const recipientId = selectedContact._id || selectedContact.id;
        
        socket.emit("sendMessage", {
          sender: senderId,
          recipient: recipientId,
          content: messageContent,
          messageType: "text",
        });
        console.log("Message sent via socket");
      }

      // Don't add message locally - let receiveMessage event handle it for all parties
      // This prevents duplicate messages (Bug 1 fix)
      
      // After sending, force refresh contacts for both parties
      fetchContacts();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this conversation?"
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/api/contacts/delete-dm/${contactId}`);
      setContacts((prev) =>
        prev.filter((c) => (c._id || c.id) !== contactId)
      );
      const currentContactId = selectedContact?._id || selectedContact?.id;
      if (currentContactId === contactId) {
        setSelectedContact(null);
        setMessages([]);
      }
    } catch (err) {
      setError("Failed to delete conversation");
      console.error(err);
    }
  };

  const handleContactAdded = (selectedContacts) => {
    // Refresh contacts list after adding new contacts
    setShowSearchModal(false);
    
    if (selectedContacts && selectedContacts.length > 0) {
      // Select the first contact so user can message them immediately
      // This allows the conversation to be created when the first message is sent
      setSelectedContact(selectedContacts[0]);
      setMessages([]);
      fetchContacts();
    } else {
      fetchContacts();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>Chats</h2>
          <button className="btn-add-chat" onClick={() => setShowSearchModal(true)}>
            +
          </button>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
        {user && (
          <div className="user-info">
            <p>{user.firstName} {user.lastName}</p>
            <small>{user.email}</small>
          </div>
        )}
        {loading ? (
          <p>Loading contacts...</p>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <ContactsList
            contacts={contacts}
            selectedContact={selectedContact}
            onSelectContact={setSelectedContact}
            onDeleteContact={handleDeleteContact}
          />
        )}
      </div>

      <div className="chat-main">
        {selectedContact ? (
          <>
            <div className="chat-header">
              <h3>{selectedContact.firstName} {selectedContact.lastName}</h3>
            </div>
            <MessageList 
              messages={messages} 
              currentUserId={user?.id || user?._id} 
            />
            <SendMessage onSendMessage={handleSendMessage} />
          </>
        ) : (
          <div className="no-chat-selected">
            <p>Select a contact to start chatting</p>
          </div>
        )}
      </div>

      {showSearchModal && (
        <SearchContacts 
          onContactAdded={handleContactAdded}
          onClose={() => setShowSearchModal(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;
