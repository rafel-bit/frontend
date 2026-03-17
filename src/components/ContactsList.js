import React from "react";
import "./ContactsList.css";

const ContactsList = ({
  contacts,
  selectedContact,
  onSelectContact,
  onDeleteContact,
}) => {
  return (
    <div className="contacts-list">
      {Array.isArray(contacts) && contacts.length === 0 ? (
        <p className="no-contacts">No contacts yet</p>
      ) : Array.isArray(contacts) ? (
        contacts.map((contact) => {
          const contactId = contact.id || contact._id;
          const firstName = contact.firstName || contact.otherUser?.firstName || "User";
          const lastName = contact.lastName || contact.otherUser?.lastName || "";
          const email = contact.email || contact.otherUser?.email || "unknown";
          
          return (
            <div
              key={contactId}
              className={`contact-item ${
                (selectedContact?.id || selectedContact?._id) === contactId
                  ? "active"
                  : ""
              }`}
            >
              <div
                className="contact-info"
                onClick={() => onSelectContact(contact)}
              >
                <div className="contact-avatar">
                  {firstName[0]}{lastName[0]}
                </div>
                <div className="contact-details">
                  <p className="contact-name">
                    {firstName} {lastName}
                  </p>
                  <p className="contact-email">{email}</p>
                </div>
              </div>
              <button
                className="btn-delete"
                onClick={() => onDeleteContact(contactId)}
                title="Delete conversation"
              >
                ✕
              </button>
            </div>
          );
        })
      ) : (
        <p className="no-contacts">Contacts data is not an array</p>
      )}
    </div>
  );
};

export default ContactsList;
