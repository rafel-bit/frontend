import React, { useState, useContext } from "react";
import apiClient from "../services/apiClient";
import { AuthContext } from "../context/AuthContext";
import "./SearchContacts.css";

const SearchContacts = ({ onContactAdded, onClose }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const currentUserId = user?.id || user?._id;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedResults, setSelectedResults] = useState([]);

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResults([]);
    setError("");
    if (onClose) onClose();
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("Searching for:", searchQuery);
      const response = await apiClient.post("/api/contacts/search", {
        searchTerm: searchQuery,
      });
      console.log("Search response:", response.data);
      
      // Backend returns 'contacts' array
      const results = response.data.contacts || [];
      
      // Filter out the current user to prevent adding yourself as a contact
      const filtered = Array.isArray(results) 
        ? results.filter(contact => {
            const contactId = contact._id || contact.id;
            return currentUserId ? String(contactId) !== String(currentUserId) : true;
          })
        : [];
      
      setSearchResults(filtered);
    } catch (err) {
      console.error("Search error - Status:", err.response?.status);
      console.error("Search error - Data:", err.response?.data);
      console.error("Search error - Message:", err.message);
      setError(err.response?.data?.message || err.message || "Search failed");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact) => {
    const contactId = contact._id || contact.id;
    const isSelected = selectedResults.some((c) => (c._id || c.id) === contactId);
    if (isSelected) {
      setSelectedResults((prev) =>
        prev.filter((c) => (c._id || c.id) !== contactId)
      );
    } else {
      setSelectedResults((prev) => [...prev, contact]);
    }
  };

  const handleAddContacts = async () => {
    if (selectedResults.length === 0) {
      setError("Please select at least one contact");
      return;
    }

    console.log("Adding contacts to chat list");
    
    // Trigger the callback with selected contacts
    onContactAdded(selectedResults);
    
    // Close the modal
    handleClose();
  };

  return (
    <div className="search-contacts-modal">
      <div className="search-contacts-content">
        <div className="search-contacts-header">
          <h3>Add New Contacts</h3>
          <button
            className="close-btn"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="search-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading} className="btn-search">
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {searchResults.length > 0 && (
          <p className="info-message">
            Select users to message. Conversations auto-create when you send your first message.
          </p>
        )}

        <div className="search-results">
          {searchResults.length === 0 && searchQuery && !loading && (
            <p className="no-results">No contacts found</p>
          )}

          {searchResults.map((contact) => {
            const contactId = contact._id || contact.id;
            const isSelected = selectedResults.some(
              (c) => (c._id || c.id) === contactId
            );
            return (
              <div
                key={contactId}
                className={`search-result-item ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectContact(contact)}
              >
                <div className="result-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                  />
                </div>
                <div className="result-info">
                  <p className="result-name">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="result-email">{contact.email}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedResults.length > 0 && (
          <div className="selected-count">
            {selectedResults.length} contact(s) selected
          </div>
        )}

        <div className="search-actions">
          <button
            className="btn-add-contacts"
            onClick={handleAddContacts}
            disabled={selectedResults.length === 0 || loading}
          >
            {loading ? "Starting..." : `Message ${selectedResults.length} User(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchContacts;
