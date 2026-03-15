// @jest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// ─── Mocks (must be at top level) ─────────────────────────────────────────────
jest.mock("./services/apiClient");
jest.mock("./services/socketService");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import apiClient from "./services/apiClient";
import MessageList from "./components/MessageList";
import ContactsList from "./components/ContactsList";
import SendMessage from "./components/SendMessage";
import Login from "./components/Login";
import Signup from "./components/Signup";
import SearchContacts from "./components/SearchContacts";
import { AuthProvider, AuthContext } from "./context/AuthContext";

// ─── Test utilities ───────────────────────────────────────────────────────────
const factories = {
  message: (overrides = {}) => ({
    _id: "msg-1",
    content: "Test message",
    senderId: "user-123",
    timestamp: new Date().toISOString(),
    ...overrides,
  }),

  contact: (overrides = {}) => ({
    _id: "contact-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: "user-1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    ...overrides,
  }),
};

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGELIST COMPONENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("MessageList - Unit Tests", () => {
  describe("rendering", () => {
    it("displays empty-state message when no messages", () => {
      render(<MessageList messages={[]} currentUserId="user-123" />);
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });

    it("renders all message content", () => {
      const messages = [
        factories.message({ content: "Hello!" }),
        factories.message({ _id: "msg-2", content: "Hi back!", senderId: "user-456" }),
      ];
      render(<MessageList messages={messages} currentUserId="user-123" />);
      expect(screen.getByText("Hello!")).toBeInTheDocument();
      expect(screen.getByText("Hi back!")).toBeInTheDocument();
    });

    it("renders messages in the correct order", () => {
      const messages = [
        factories.message({ _id: "msg-1", content: "First" }),
        factories.message({ _id: "msg-2", content: "Second" }),
        factories.message({ _id: "msg-3", content: "Third" }),
      ];
      render(<MessageList messages={messages} currentUserId="user-123" />);
      const items = screen.getAllByText(/First|Second|Third/);
      expect(items[0]).toHaveTextContent("First");
      expect(items[1]).toHaveTextContent("Second");
      expect(items[2]).toHaveTextContent("Third");
    });
  });

  describe("CSS classification", () => {
    it("applies 'sent' class to user's own messages", () => {
      const { container } = render(
        <MessageList messages={[factories.message({ senderId: "user-123" })]} currentUserId="user-123" />
      );
      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("applies 'received' class to other users' messages", () => {
      const { container } = render(
        <MessageList messages={[factories.message({ senderId: "user-456" })]} currentUserId="user-123" />
      );
      expect(container.querySelector(".message.received")).toBeInTheDocument();
    });

    it("correctly classifies mixed sender list", () => {
      const { container } = render(
        <MessageList
          messages={[
            factories.message({ senderId: "user-123" }),
            factories.message({ _id: "msg-2", senderId: "user-456" }),
          ]}
          currentUserId="user-123"
        />
      );
      expect(container.querySelectorAll(".message.sent")).toHaveLength(1);
      expect(container.querySelectorAll(".message.received")).toHaveLength(1);
    });
  });

  describe("senderId format handling", () => {
    it("reads senderId from sender._id (MongoDB format)", () => {
      const { container } = render(
        <MessageList messages={[factories.message({ sender: { _id: "user-123" } })]} currentUserId="user-123" />
      );
      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("reads senderId from sender.id", () => {
      const { container } = render(
        <MessageList messages={[factories.message({ sender: { id: "user-123" } })]} currentUserId="user-123" />
      );
      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("coerces numeric senderId to string", () => {
      const { container } = render(
        <MessageList messages={[factories.message({ senderId: 123 })]} currentUserId="123" />
      );
      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });
  });

  describe("timestamp handling", () => {
    it("renders timestamp element", () => {
      render(<MessageList messages={[factories.message()]} currentUserId="user-123" />);
      const timeEl = document.querySelector(".message-time");
      expect(timeEl).toBeInTheDocument();
      expect(timeEl.textContent).not.toBe("");
    });

    it("handles missing timestamp without crashing", () => {
      expect(() => {
        render(<MessageList messages={[factories.message({ timestamp: undefined })]} currentUserId="user-123" />);
      }).not.toThrow();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONTACTSLIST COMPONENT TESTS  
// ═════════════════════════════════════════════════════════════════════════════

describe("ContactsList - Unit Tests", () => {
  const noop = jest.fn();

  describe("rendering", () => {
    it("displays empty-state when no contacts", () => {
      render(
        <ContactsList
          contacts={[]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );
      expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument();
    });

    it("renders one contact per item", () => {
      const contacts = [
        factories.contact({ firstName: "Alice", lastName: "Smith" }),
        factories.contact({ _id: "contact-2", firstName: "Bob", lastName: "Jones" }),
      ];
      render(
        <ContactsList contacts={contacts} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
      );
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    it("displays email for each contact", () => {
      const contacts = [
        factories.contact({ email: "alice@example.com" }),
        factories.contact({ _id: "contact-2", email: "bob@example.com" }),
      ];
      render(
        <ContactsList contacts={contacts} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
      );
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    it("renders avatar initials", () => {
      render(
        <ContactsList
          contacts={[factories.contact({ firstName: "Alice", lastName: "Smith" })]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );
      expect(screen.getByText("AS")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onSelectContact with contact on click", () => {
      const onSelect = jest.fn();
      const contact = factories.contact({ firstName: "Alice", lastName: "Smith" });
      render(
        <ContactsList contacts={[contact]} selectedContact={null} onSelectContact={onSelect} onDeleteContact={noop} />
      );
      fireEvent.click(screen.getByText("Alice Smith"));
      expect(onSelect).toHaveBeenCalledWith(contact);
    });

    it("calls onDeleteContact with id on delete button click", () => {
      const onDelete = jest.fn();
      const contact = factories.contact({ _id: "contact-123" });
      render(
        <ContactsList contacts={[contact]} selectedContact={null} onSelectContact={noop} onDeleteContact={onDelete} />
      );
      fireEvent.click(screen.getByTitle("Delete conversation"));
      expect(onDelete).toHaveBeenCalledWith("contact-123");
    });

    it("uses id field when _id absent", () => {
      const onDelete = jest.fn();
      const contact = { id: "alt-id", firstName: "Carol", lastName: "White", email: "carol@example.com" };
      render(
        <ContactsList contacts={[contact]} selectedContact={null} onSelectContact={noop} onDeleteContact={onDelete} />
      );
      fireEvent.click(screen.getByTitle("Delete conversation"));
      expect(onDelete).toHaveBeenCalledWith("alt-id");
    });
  });

  describe("selection styling", () => {
    it("marks selected contact with 'active' class", () => {
      const contact = factories.contact();
      const { container } = render(
        <ContactsList
          contacts={[contact]}
          selectedContact={contact}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );
      expect(container.querySelector(".contact-item")).toHaveClass("active");
    });

    it("removes 'active' from non-selected contacts", () => {
      const contacts = [
        factories.contact({ _id: "contact-1" }),
        factories.contact({ _id: "contact-2" }),
      ];
      const { container } = render(
        <ContactsList
          contacts={contacts}
          selectedContact={contacts[0]}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );
      const items = container.querySelectorAll(".contact-item");
      expect(items[0]).toHaveClass("active");
      expect(items[1]).not.toHaveClass("active");
    });
  });

  describe("field fallback handling", () => {
    it("falls back to otherUser fields", () => {
      const contact = {
        _id: "contact-1",
        otherUser: { firstName: "Dave", lastName: "Brown", email: "dave@example.com" },
      };
      render(
        <ContactsList contacts={[contact]} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
      );
      expect(screen.getByText("Dave Brown")).toBeInTheDocument();
      expect(screen.getByText("dave@example.com")).toBeInTheDocument();
    });

    it("displays error when contacts not an array", () => {
      render(
        <ContactsList contacts={null} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
      );
      expect(screen.getByText(/not an array/i)).toBeInTheDocument();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SENDMESSAGE COMPONENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("SendMessage - Unit Tests", () => {
  describe("rendering", () => {
    it("renders input and button", () => {
      render(<SendMessage onSendMessage={jest.fn()} />);
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });
  });

  describe("input validation", () => {
    it("does not call onSendMessage when empty", () => {
      const onSend = jest.fn();
      render(<SendMessage onSendMessage={onSend} />);
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not call onSendMessage for whitespace-only", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      await user.type(screen.getByPlaceholderText(/type a message/i), "   ");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("message sending", () => {
    it("calls onSendMessage with text on send", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      await user.type(screen.getByPlaceholderText(/type a message/i), "Hello world");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      expect(onSend).toHaveBeenCalledWith("Hello world");
    });

    it("clears input after successful send", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Test message");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      await waitFor(() => expect(input).toHaveValue(""));
    });

    it("sends message with whitespace preserved", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      await user.type(screen.getByPlaceholderText(/type a message/i), "  Message  ");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      expect(onSend).toHaveBeenCalledWith("  Message  ");
    });
  });

  describe("loading state", () => {
    it("disables input while sending", async () => {
      let resolve;
      const onSend = jest.fn(() => new Promise((r) => { resolve = r; }));
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      await user.type(screen.getByPlaceholderText(/type a message/i), "Test");
      act(() => fireEvent.click(screen.getByRole("button", { name: /send/i })));
      expect(screen.getByPlaceholderText(/type a message/i)).toBeDisabled();
      act(() => resolve());
    });
  });

  describe("error handling", () => {
    it("re-enables input after failure", async () => {
      const onSend = jest.fn().mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      await user.type(screen.getByPlaceholderText(/type a message/i), "Will fail");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).not.toBeDisabled();
      });
    });

    it("keeps input value on failure", async () => {
      const onSend = jest.fn().mockRejectedValue(new Error("Failed"));
      const user = userEvent.setup();
      render(<SendMessage onSendMessage={onSend} />);
      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Unsent message");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
      await waitFor(() => expect(input).toHaveValue("Unsent message"));
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("Login - Unit Tests", () => {
  const createAuthContext = (overrides = {}) => ({
    login: jest.fn(),
    isAuthenticated: false,
    loading: false,
    ...overrides,
  });

  const renderLogin = (authValue = {}) => {
    const mockAuth = createAuthContext(authValue);
    return {
      ...render(
        <AuthContext.Provider value={mockAuth}>
          <Login />
        </AuthContext.Provider>
      ),
      mockAuth,
    };
  };

  describe("rendering", () => {
    it("renders all fields", () => {
      renderLogin();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
    });

    it("displays signup link", () => {
      renderLogin();
      expect(screen.getByRole("link", { name: /sign up here/i })).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("calls login with email and password", async () => {
      const { mockAuth } = renderLogin({ login: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), "user@test.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      fireEvent.click(screen.getByRole("button", { name: /login/i }));
      await waitFor(() => {
        expect(mockAuth.login).toHaveBeenCalledWith("user@test.com", "password123");
      });
    });
  });

  describe("error handling", () => {
    it("displays error on login failure", async () => {
      renderLogin({
        login: jest.fn().mockRejectedValue({
          response: { data: { message: "Invalid credentials" } },
        }),
      });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), "bad@test.com");
      await user.type(screen.getByLabelText(/password/i), "wrongpass");
      fireEvent.click(screen.getByRole("button", { name: /login/i }));
      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("shows no error initially", () => {
      renderLogin();
      expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("disables button while submitting", async () => {
      let resolve;
      renderLogin({
        login: jest.fn(() => new Promise((r) => { resolve = r; })),
      });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/email/i), "user@test.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      act(() => fireEvent.click(screen.getByRole("button", { name: /login/i })));
      expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
      act(() => resolve({}));
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SIGNUP COMPONENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("Signup - Unit Tests", () => {
  const createAuthContext = (overrides = {}) => ({
    signup: jest.fn(),
    isAuthenticated: false,
    loading: false,
    ...overrides,
  });

  const renderSignup = (authValue = {}) => {
    const mockAuth = createAuthContext(authValue);
    return {
      ...render(
        <AuthContext.Provider value={mockAuth}>
          <Signup />
        </AuthContext.Provider>
      ),
      mockAuth,
    };
  };

  describe("rendering", () => {
    it("renders all fields", () => {
      renderSignup();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    });

    it("displays login link", () => {
      renderSignup();
      expect(screen.getByRole("link", { name: /login here/i })).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("calls signup with correct order", async () => {
      const { mockAuth } = renderSignup({ signup: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "jane@test.com");
      await user.type(screen.getByLabelText(/password/i), "secret123");
      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
      await waitFor(() => {
        expect(mockAuth.signup).toHaveBeenCalledWith("jane@test.com", "secret123", "Jane", "Doe");
      });
    });
  });

  describe("error handling", () => {
    it("displays server error", async () => {
      renderSignup({
        signup: jest.fn().mockRejectedValue({
          response: { data: { message: "Email already in use" } },
        }),
      });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "jane@test.com");
      await user.type(screen.getByLabelText(/password/i), "secret");
      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
      await waitFor(() => {
        expect(screen.getByText("Email already in use")).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("disables button while submitting", async () => {
      let resolve;
      renderSignup({
        signup: jest.fn(() => new Promise((r) => { resolve = r; })),
      });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "jane@test.com");
      await user.type(screen.getByLabelText(/password/i), "secret");
      act(() => fireEvent.click(screen.getByRole("button", { name: /sign up/i })));
      expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
      act(() => resolve({}));
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SEARCHCONTACTS COMPONENT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("SearchContacts - Unit Tests", () => {
  const results = [
    factories.contact({ _id: "user-1", firstName: "Dave", lastName: "Brown" }),
    factories.contact({ _id: "user-2", firstName: "Eve", lastName: "Clark" }),
  ];

  beforeEach(() => jest.clearAllMocks());

  describe("rendering", () => {
    it("renders search input and button", () => {
      render(<SearchContacts onContactAdded={jest.fn()} />);
      expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    });
  });

  describe("search validation", () => {
    it("does not call API when empty", () => {
      render(<SearchContacts onContactAdded={jest.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("does not call API for whitespace", async () => {
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "   ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("API interaction", () => {
    it("calls search API with query", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "Dave");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", { searchTerm: "Dave" });
      });
    });

    it("preserves whitespace in search query", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "  Dave  ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", { searchTerm: "  Dave  " });
      });
    });
  });

  describe("result rendering", () => {
    it("displays search results", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => {
        expect(screen.getByText("Dave Brown")).toBeInTheDocument();
        expect(screen.getByText("Eve Clark")).toBeInTheDocument();
      });
    });

    it("displays 'No contacts found' when empty", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: [] } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "XYZ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => {
        expect(screen.getByText(/no contacts found/i)).toBeInTheDocument();
      });
    });
  });

  describe("contact selection", () => {
    it("toggles selection on click", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => screen.getByText("Dave Brown"));
      const row = screen.getByText("Dave Brown").closest(".search-result-item");
      fireEvent.click(row);
      expect(row).toHaveClass("selected");
      fireEvent.click(row);
      expect(row).not.toHaveClass("selected");
    });

    it("displays selection count", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => screen.getByText("Dave Brown"));
      fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
      expect(screen.getByText(/1 contact\(s\) selected/i)).toBeInTheDocument();
    });
  });

  describe("message button", () => {
    it("calls onContactAdded with selected contacts", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const onContactAdded = jest.fn();
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={onContactAdded} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => screen.getByText("Dave Brown"));
      fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
      fireEvent.click(screen.getByRole("button", { name: /message 1 user/i }));
      expect(onContactAdded).toHaveBeenCalledWith([results[0]]);
    });
  });

  describe("error handling", () => {
    it("displays error message on API failure", async () => {
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Unauthorized" } },
      });
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={jest.fn()} />);
      await user.type(screen.getByPlaceholderText(/search by name or email/i), "test");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      await waitFor(() => {
        expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTHCONTEXT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe("AuthContext - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderAuthConsumer = () => {
    let contextValue;
    const Consumer = () => {
      contextValue = React.useContext(AuthContext);
      return null;
    };
    render(<AuthProvider><Consumer /></AuthProvider>);
    return () => contextValue;
  };

  describe("initialization", () => {
    it("starts with loading=true and no user", () => {
      apiClient.get.mockReturnValue(new Promise(() => {}));
      const getCtx = renderAuthConsumer();
      expect(getCtx().loading).toBe(true);
      expect(getCtx().user).toBeNull();
      expect(getCtx().isAuthenticated).toBe(false);
    });

    it("loads user when API call succeeds", async () => {
      // New behavior: always call API, HTTPOnly cookie handles auth
      const fakeUser = factories.user({ id: "u1" });
      apiClient.get.mockResolvedValue({ data: fakeUser });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      expect(getCtx().user).toEqual(fakeUser);
      expect(getCtx().isAuthenticated).toBe(true);
    });

    it("stays unauthenticated without token", async () => {
      // New behavior: always call API, mock it to reject when no session
      apiClient.get.mockRejectedValue(new Error("Not authenticated"));
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      expect(getCtx().user).toBeNull();
    });

    it("handles API errors gracefully", async () => {
      // Even with localStorage token, if API fails we stay logged out
      localStorage.setItem("authToken", "expired-token");
      apiClient.get.mockRejectedValue(new Error("401"));
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      expect(localStorage.getItem("authToken")).toBeNull();
      expect(getCtx().user).toBeNull();
    });
  });

  describe("login()", () => {
    it("sets user on success", async () => {
      const fakeUser = factories.user({ id: "u2" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      await act(() => getCtx().login("a@b.com", "pw"));
      expect(getCtx().user).toEqual(fakeUser);
      expect(getCtx().isAuthenticated).toBe(true);
    });

    it("accepts flat response", async () => {
      const fakeUser = factories.user({ id: "u3" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: fakeUser });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      await act(() => getCtx().login("flat@b.com", "pw"));
      expect(getCtx().user).toEqual(fakeUser);
    });

    it("exposes error on failure", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Bad creds" } },
      });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      try {
        await act(() => getCtx().login("x", "y"));
      } catch (err) {}
      await waitFor(() => expect(getCtx().error).toBe("Bad creds"));
    });

    it("rethrows error", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      const error = { response: { data: { message: "Bad creds" } } };
      apiClient.post.mockRejectedValue(error);
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      await expect(act(() => getCtx().login("x", "y"))).rejects.toEqual(error);
    });
  });

  describe("logout()", () => {
    it("clears user and removes token", async () => {
      const fakeUser = factories.user({ id: "u4" });
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: fakeUser });
      apiClient.post.mockResolvedValue({});
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().isAuthenticated).toBe(true));
      await act(() => getCtx().logout());
      expect(getCtx().user).toBeNull();
      expect(localStorage.getItem("authToken")).toBeNull();
    });

    it("clears user even on API failure", async () => {
      const fakeUser = factories.user({ id: "u5" });
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: fakeUser });
      apiClient.post.mockRejectedValue(new Error("network"));
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().isAuthenticated).toBe(true));
      await act(() => getCtx().logout());
      expect(getCtx().user).toBeNull();
    });
  });

  describe("signup()", () => {
    it("sets user on success", async () => {
      const newUser = factories.user({ id: "u6" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: newUser } });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      await act(() => getCtx().signup("new@test.com", "pw", "New", "User"));
      expect(getCtx().user).toEqual(newUser);
    });

    it("exposes error on failure", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Email taken" } },
      });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      try {
        await act(() => getCtx().signup("x", "y", "A", "B"));
      } catch (err) {}
      await waitFor(() => expect(getCtx().error).toBe("Email taken"));
    });

    it("rethrows error", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      const error = { response: { data: { message: "Email taken" } } };
      apiClient.post.mockRejectedValue(error);
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      await expect(act(() => getCtx().signup("x", "y", "A", "B"))).rejects.toEqual(error);
    });
  });

  describe("context API", () => {
    it("provides all required methods", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      const ctx = getCtx();
      expect(typeof ctx.login).toBe("function");
      expect(typeof ctx.logout).toBe("function");
      expect(typeof ctx.signup).toBe("function");
      expect(typeof ctx.updateProfile).toBe("function");
    });

    it("provides isAuthenticated boolean", async () => {
      const fakeUser = factories.user();
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });
      const getCtx = renderAuthConsumer();
      await waitFor(() => expect(getCtx().loading).toBe(false));
      expect(getCtx().isAuthenticated).toBe(false);
      await act(() => getCtx().login("user@test.com", "pw"));
      expect(getCtx().isAuthenticated).toBe(true);
    });
  });
});
