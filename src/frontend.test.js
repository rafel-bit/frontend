// @jest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// ─── Mock modules with correct relative paths (./services not ../services) ─ 

jest.mock("./services/apiClient");
jest.mock("./services/socketService");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}));

// ─── Imports with correct relative paths ──────────────────────────────────────

import apiClient from "./services/apiClient";
import MessageList from "./components/MessageList";
import ContactsList from "./components/ContactsList";
import SendMessage from "./components/SendMessage";
import Login from "./components/Login";
import Signup from "./components/Signup";
import SearchContacts from "./components/SearchContacts";
import { AuthProvider, AuthContext } from "./context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// 1. MessageList
// ─────────────────────────────────────────────────────────────────────────────

describe("MessageList", () => {
  const ME = "user-123";

  const sent = {
    _id: "m1",
    content: "Hello!",
    senderId: "user-123",
    timestamp: "2024-01-01T10:00:00.000Z",
  };

  const received = {
    _id: "m2",
    content: "Hi back!",
    senderId: "user-456",
    timestamp: "2024-01-01T10:01:00.000Z",
  };

  test("shows empty-state prompt when there are no messages", () => {
    render(<MessageList messages={[]} currentUserId={ME} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  test("renders message content", () => {
    render(<MessageList messages={[sent, received]} currentUserId={ME} />);
    expect(screen.getByText("Hello!")).toBeInTheDocument();
    expect(screen.getByText("Hi back!")).toBeInTheDocument();
  });

  test("gives own messages the 'sent' CSS class", () => {
    const { container } = render(<MessageList messages={[sent]} currentUserId={ME} />);
    expect(container.querySelector(".message.sent")).toBeInTheDocument();
  });

  test("gives other people's messages the 'received' CSS class", () => {
    const { container } = render(<MessageList messages={[received]} currentUserId={ME} />);
    expect(container.querySelector(".message.received")).toBeInTheDocument();
  });

  test("correctly splits sent vs received in a mixed list", () => {
    const { container } = render(
      <MessageList messages={[sent, received]} currentUserId={ME} />
    );
    expect(container.querySelectorAll(".message.sent")).toHaveLength(1);
    expect(container.querySelectorAll(".message.received")).toHaveLength(1);
  });

  test("reads senderId from sender._id (MongoDB populate format)", () => {
    const msg = { _id: "m3", content: "Populated", sender: { _id: ME }, timestamp: new Date().toISOString() };
    const { container } = render(<MessageList messages={[msg]} currentUserId={ME} />);
    expect(container.querySelector(".message.sent")).toBeInTheDocument();
  });

  test("reads senderId from sender.id", () => {
    const msg = { _id: "m4", content: "Alt id", sender: { id: ME }, timestamp: new Date().toISOString() };
    const { container } = render(<MessageList messages={[msg]} currentUserId={ME} />);
    expect(container.querySelector(".message.sent")).toBeInTheDocument();
  });

  test("renders a timestamp element for each message", () => {
    render(<MessageList messages={[sent]} currentUserId={ME} />);
    const timeEl = document.querySelector(".message-time");
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).not.toBe("");
  });

  test("handles a missing timestamp without crashing", () => {
    const msg = { _id: "m5", content: "No time", senderId: ME };
    expect(() =>
      render(<MessageList messages={[msg]} currentUserId={ME} />)
    ).not.toThrow();
  });

  test("coerces numeric senderId to string for comparison", () => {
    const msg = { _id: "m6", content: "Num id", senderId: 123 };
    const { container } = render(<MessageList messages={[msg]} currentUserId={"123"} />);
    expect(container.querySelector(".message.sent")).toBeInTheDocument();
  });

  test("renders messages in the order they are provided", () => {
    const msgs = [
      { _id: "a", content: "First", senderId: ME },
      { _id: "b", content: "Second", senderId: "other" },
      { _id: "c", content: "Third", senderId: ME },
    ];
    render(<MessageList messages={msgs} currentUserId={ME} />);
    const items = screen.getAllByText(/First|Second|Third/);
    expect(items[0]).toHaveTextContent("First");
    expect(items[1]).toHaveTextContent("Second");
    expect(items[2]).toHaveTextContent("Third");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ContactsList
// ─────────────────────────────────────────────────────────────────────────────

describe("ContactsList", () => {
  const contacts = [
    { _id: "c1", firstName: "Alice", lastName: "Smith", email: "alice@example.com" },
    { _id: "c2", firstName: "Bob", lastName: "Jones", email: "bob@example.com" },
  ];
  const noop = jest.fn();

  test("shows 'No contacts yet' for an empty list", () => {
    render(
      <ContactsList contacts={[]} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument();
  });

  test("renders one row per contact", () => {
    render(
      <ContactsList contacts={contacts} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  test("displays the contact's email", () => {
    render(
      <ContactsList contacts={contacts} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  test("renders avatar initials from first + last name", () => {
    render(
      <ContactsList contacts={[contacts[0]]} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  test("calls onSelectContact with the correct contact object on click", () => {
    const onSelect = jest.fn();
    render(
      <ContactsList contacts={contacts} selectedContact={null} onSelectContact={onSelect} onDeleteContact={noop} />
    );
    fireEvent.click(screen.getByText("Alice Smith"));
    expect(onSelect).toHaveBeenCalledWith(contacts[0]);
  });

  test("calls onDeleteContact with the correct id when delete button clicked", () => {
    const onDelete = jest.fn();
    render(
      <ContactsList contacts={contacts} selectedContact={null} onSelectContact={noop} onDeleteContact={onDelete} />
    );
    const deleteButtons = screen.getAllByTitle("Delete conversation");
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  test("marks the selected contact with the 'active' class", () => {
    const { container } = render(
      <ContactsList contacts={contacts} selectedContact={contacts[0]} onSelectContact={noop} onDeleteContact={noop} />
    );
    const items = container.querySelectorAll(".contact-item");
    expect(items[0]).toHaveClass("active");
    expect(items[1]).not.toHaveClass("active");
  });

  test("works when contact uses id instead of _id", () => {
    const altContact = { id: "c3", firstName: "Carol", lastName: "White", email: "carol@example.com" };
    const onDelete = jest.fn();
    render(
      <ContactsList contacts={[altContact]} selectedContact={null} onSelectContact={noop} onDeleteContact={onDelete} />
    );
    fireEvent.click(screen.getByTitle("Delete conversation"));
    expect(onDelete).toHaveBeenCalledWith("c3");
  });

  test("shows error text when contacts prop is not an array", () => {
    render(
      <ContactsList contacts={null} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText(/not an array/i)).toBeInTheDocument();
  });

  test("falls back to otherUser fields for name and email", () => {
    const contact = {
      _id: "c4",
      otherUser: { firstName: "Dave", lastName: "Brown", email: "dave@example.com" },
    };
    render(
      <ContactsList contacts={[contact]} selectedContact={null} onSelectContact={noop} onDeleteContact={noop} />
    );
    expect(screen.getByText("Dave Brown")).toBeInTheDocument();
    expect(screen.getByText("dave@example.com")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SendMessage
// ─────────────────────────────────────────────────────────────────────────────

describe("SendMessage", () => {
  test("renders the text input and send button", () => {
    render(<SendMessage onSendMessage={jest.fn()} />);
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  test("does not call onSendMessage when input is empty", () => {
    const onSend = jest.fn();
    render(<SendMessage onSendMessage={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).not.toHaveBeenCalled();
  });

  test("does not call onSendMessage for whitespace-only input", async () => {
    const onSend = jest.fn();
    render(<SendMessage onSendMessage={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/type a message/i), "   ");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).not.toHaveBeenCalled();
  });

  test("calls onSendMessage with the typed text", async () => {
    const onSend = jest.fn().mockResolvedValue();
    render(<SendMessage onSendMessage={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/type a message/i), "Hello world");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  test("clears the input after a successful send", async () => {
    const onSend = jest.fn().mockResolvedValue();
    render(<SendMessage onSendMessage={onSend} />);
    const input = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(input, "Clear me");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(input).toHaveValue(""));
  });

  test("disables input and button while the send is in flight", async () => {
    let resolve;
    const onSend = jest.fn(() => new Promise((r) => { resolve = r; }));
    render(<SendMessage onSendMessage={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/type a message/i), "Test");

    act(() => { fireEvent.click(screen.getByRole("button", { name: /send/i })); });

    expect(screen.getByPlaceholderText(/type a message/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    act(() => resolve());
    await waitFor(() => expect(screen.getByPlaceholderText(/type a message/i)).not.toBeDisabled());
  });

  test("re-enables inputs if onSendMessage rejects", async () => {
    const onSend = jest.fn().mockRejectedValue(new Error("Network error"));
    render(<SendMessage onSendMessage={onSend} />);
    await userEvent.type(screen.getByPlaceholderText(/type a message/i), "Will fail");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/type a message/i)).not.toBeDisabled());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Login
// ─────────────────────────────────────────────────────────────────────────────

describe("Login", () => {
  const mockLogin = jest.fn();

  const renderLogin = () =>
    render(
      <AuthContext.Provider value={{ login: mockLogin, isAuthenticated: false, loading: false }}>
        <Login />
      </AuthContext.Provider>
    );

  beforeEach(() => mockLogin.mockReset());

  test("renders email field, password field, and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  test("shows a link to the signup page", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /sign up here/i })).toBeInTheDocument();
  });

  test("calls login() with the entered email and password", async () => {
    mockLogin.mockResolvedValue({});
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "user@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith("user@test.com", "password123")
    );
  });

  test("shows an error message when login fails", async () => {
    mockLogin.mockRejectedValue({ response: { data: { message: "Invalid credentials" } } });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "bad@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    );
  });

  test("disables the button and shows loading text while submitting", async () => {
    let resolve;
    mockLogin.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "user@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    act(() => { fireEvent.click(screen.getByRole("button", { name: /login/i })); });
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
    act(() => resolve({}));
  });

  test("shows no error on initial render", () => {
    renderLogin();
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Signup
// ─────────────────────────────────────────────────────────────────────────────

describe("Signup", () => {
  const mockSignup = jest.fn();

  const renderSignup = () =>
    render(
      <AuthContext.Provider value={{ signup: mockSignup, isAuthenticated: false, loading: false }}>
        <Signup />
      </AuthContext.Provider>
    );

  beforeEach(() => mockSignup.mockReset());

  test("renders all four fields and the submit button", () => {
    renderSignup();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  test("calls signup() with email, password, firstName, lastName in the correct order", async () => {
    mockSignup.mockResolvedValue({});
    renderSignup();
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() =>
      expect(mockSignup).toHaveBeenCalledWith("jane@test.com", "secret", "Jane", "Doe")
    );
  });

  test("displays a server error message on failure", async () => {
    mockSignup.mockRejectedValue({ response: { data: { message: "Email already in use" } } });
    renderSignup();
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() =>
      expect(screen.getByText("Email already in use")).toBeInTheDocument()
    );
  });

  test("shows a link back to the login page", () => {
    renderSignup();
    expect(screen.getByRole("link", { name: /login here/i })).toBeInTheDocument();
  });

  test("disables the button while submitting", async () => {
    let resolve;
    mockSignup.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderSignup();
    await userEvent.type(screen.getByLabelText(/first name/i), "Jane");
    await userEvent.type(screen.getByLabelText(/last name/i), "Doe");
    await userEvent.type(screen.getByLabelText(/email/i), "jane@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    act(() => { fireEvent.click(screen.getByRole("button", { name: /sign up/i })); });
    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
    act(() => resolve({}));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SearchContacts
// ─────────────────────────────────────────────────────────────────────────────

describe("SearchContacts", () => {
  const onContactAdded = jest.fn();

  const results = [
    { _id: "u1", firstName: "Dave", lastName: "Brown", email: "dave@example.com" },
    { _id: "u2", firstName: "Eve", lastName: "Clark", email: "eve@example.com" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the search input and search button", () => {
    render(<SearchContacts onContactAdded={onContactAdded} />);
    expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  test("does not call the API when the query is empty", () => {
    render(<SearchContacts onContactAdded={onContactAdded} />);
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test("calls the search API with the entered query", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: results } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "Dave");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", { searchTerm: "Dave" })
    );
  });

  test("renders the returned search results", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: results } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "Dave");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => expect(screen.getByText("Dave Brown")).toBeInTheDocument());
    expect(screen.getByText("Eve Clark")).toBeInTheDocument();
  });

  test("shows 'No contacts found' when results are empty", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [] } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "XYZ");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => expect(screen.getByText(/no contacts found/i)).toBeInTheDocument());
  });

  test("clicking a result selects it; clicking again deselects it", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: results } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "Dave");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => screen.getByText("Dave Brown"));

    const row = screen.getByText("Dave Brown").closest(".search-result-item");
    fireEvent.click(row);
    expect(row).toHaveClass("selected");
    fireEvent.click(row);
    expect(row).not.toHaveClass("selected");
  });

  test("shows selected count when one or more contacts are chosen", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: results } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "a");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => screen.getByText("Dave Brown"));
    fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
    expect(screen.getByText(/1 contact\(s\) selected/i)).toBeInTheDocument();
  });

  test("calls onContactAdded with the selected contacts when message button clicked", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: results } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "a");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => screen.getByText("Dave Brown"));
    fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
    fireEvent.click(screen.getByRole("button", { name: /message 1 user/i }));
    expect(onContactAdded).toHaveBeenCalledWith([results[0]]);
  });

  test("shows an error message when the API call fails", async () => {
    apiClient.post.mockRejectedValue({ response: { data: { message: "Unauthorized" } } });
    render(<SearchContacts onContactAdded={onContactAdded} />);
    await userEvent.type(screen.getByPlaceholderText(/search by name or email/i), "test");
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => expect(screen.getByText("Unauthorized")).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AuthContext
// ─────────────────────────────────────────────────────────────────────────────

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // Helper: renders a consumer that captures context value
  const renderConsumer = () => {
    let ctx;
    const Consumer = () => { ctx = React.useContext(AuthContext); return null; };
    render(<AuthProvider><Consumer /></AuthProvider>);
    return () => ctx;
  };

  test("starts with loading=true and no user", () => {
    apiClient.get.mockReturnValue(new Promise(() => {})); // never resolves
    const getCtx = renderConsumer();
    expect(getCtx().loading).toBe(true);
    expect(getCtx().user).toBeNull();
    expect(getCtx().isAuthenticated).toBe(false);
  });

  test("restores user when a valid token exists in localStorage", async () => {
    localStorage.setItem("authToken", "valid-token");
    const fakeUser = { id: "u1", email: "me@test.com" };
    apiClient.get.mockResolvedValue({ data: fakeUser });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    expect(getCtx().user).toEqual(fakeUser);
    expect(getCtx().isAuthenticated).toBe(true);
  });

  test("stays unauthenticated when API call fails", async () => {
    // New behavior: always call API even without localStorage token
    // HTTPOnly cookie handles auth, so if no session, API will fail
    apiClient.get.mockRejectedValue(new Error("Not authenticated"));
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    expect(getCtx().user).toBeNull();
    expect(apiClient.get).toHaveBeenCalled();
  });

  test("removes bad token from localStorage when /userinfo fails", async () => {
    localStorage.setItem("authToken", "expired-token");
    apiClient.get.mockRejectedValue(new Error("401"));
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(getCtx().user).toBeNull();
  });

  test("login() sets the user on success", async () => {
    const fakeUser = { id: "u2", email: "a@b.com" };
    apiClient.get.mockRejectedValue(new Error("no token")); // checkAuth path
    apiClient.post.mockResolvedValue({ data: { user: fakeUser } });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    await act(() => getCtx().login("a@b.com", "pw"));
    expect(getCtx().user).toEqual(fakeUser);
    expect(getCtx().isAuthenticated).toBe(true);
  });

  test("login() accepts flat response (no .user wrapper)", async () => {
    const fakeUser = { id: "u3", email: "flat@b.com" };
    apiClient.get.mockRejectedValue(new Error("no token"));
    apiClient.post.mockResolvedValue({ data: fakeUser });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    await act(() => getCtx().login("flat@b.com", "pw"));
    expect(getCtx().user).toEqual(fakeUser);
  });

  test("login() exposes an error string and rethrows on failure", async () => {
    apiClient.get.mockRejectedValue(new Error("no token"));
    apiClient.post.mockRejectedValue({ response: { data: { message: "Bad creds" } } });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    await expect(act(() => getCtx().login("x", "y"))).rejects.toBeTruthy();
    await waitFor(() => expect(getCtx().error).toBe("Bad creds"));
  });

  test("logout() clears the user and removes the token", async () => {
    localStorage.setItem("authToken", "tok");
    const fakeUser = { id: "u4" };
    apiClient.get.mockResolvedValue({ data: fakeUser });
    apiClient.post.mockResolvedValue({});
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().isAuthenticated).toBe(true));
    await act(() => getCtx().logout());
    expect(getCtx().user).toBeNull();
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  test("logout() clears user even when the API call throws", async () => {
    localStorage.setItem("authToken", "tok");
    apiClient.get.mockResolvedValue({ data: { id: "u5" } });
    apiClient.post.mockRejectedValue(new Error("network"));
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().isAuthenticated).toBe(true));
    await act(() => getCtx().logout());
    expect(getCtx().user).toBeNull();
  });

  test("signup() sets the user on success", async () => {
    const newUser = { id: "u6", email: "new@test.com" };
    apiClient.get.mockRejectedValue(new Error("no token"));
    apiClient.post.mockResolvedValue({ data: { user: newUser } });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    await act(() => getCtx().signup("new@test.com", "pw", "New", "User"));
    expect(getCtx().user).toEqual(newUser);
  });

  test("signup() exposes an error and rethrows on failure", async () => {
    apiClient.get.mockRejectedValue(new Error("no token"));
    apiClient.post.mockRejectedValue({ response: { data: { message: "Email taken" } } });
    const getCtx = renderConsumer();
    await waitFor(() => expect(getCtx().loading).toBe(false));
    await expect(act(() => getCtx().signup("x", "y", "A", "B"))).rejects.toBeTruthy();
    await waitFor(() => expect(getCtx().error).toBe("Email taken"));
  });
});