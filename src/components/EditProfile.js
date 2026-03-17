import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./EditProfile.css";

const EditProfile = ({ onClose }) => {
  const { user, updateProfile } = useContext(AuthContext);

  const currentFirstName = user?.firstName || "";
  const currentLastName  = user?.lastName  || "";

  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName]   = useState(currentLastName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await updateProfile(firstName.trim(), lastName.trim());
      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-overlay" onClick={onClose}>
      <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-profile-header">
          <h3>Edit Profile</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="profile-error-message">{error}</div>}
        {success && <div className="success-message">Profile updated!</div>}

        <form onSubmit={handleSubmit} className="edit-profile-form">

          <div className="form-section-label">Account Info</div>

          <div className="form-group">
            <label>Email</label>
            <input type="text" value={user?.email || "—"} readOnly className="input-readonly" />
          </div>

          <div className="form-group">
            <label>Current First Name</label>
            <input type="text" value={currentFirstName || "—"} readOnly className="input-readonly" />
          </div>

          <div className="form-group">
            <label>Current Last Name</label>
            <input type="text" value={currentLastName || "—"} readOnly className="input-readonly" />
          </div>

          <div className="form-section-label">Edit Name</div>

          <div className="form-group">
            <label htmlFor="firstName">New First Name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter new first name"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">New Last Name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter new last name"
              disabled={loading}
            />
          </div>

          <div className="edit-profile-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;
