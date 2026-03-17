/**
 * Security System Tests
 *
 * These tests verify that the frontend protects against or does not amplify
 * common web application attacks:
 *
 *   1. Brute Force – repeated login attempts are handled gracefully; the UI
 *      never allows parallel in-flight requests.
 *
 *   2. Injection Attacks (NoSQL / SQL) – user-supplied input is forwarded to
 *      the API as plain strings, never executed or mutated by the frontend.
 *
 *   3. Cross-Site Scripting (XSS) – content from the server (messages, names)
 *      is rendered as text, never as raw HTML.
 *
 * NOTE: jsdom does not execute injected <script> tags the way a real browser
 * does, so these tests focus on what the frontend layer is responsible for:
 * ensuring React renders user content as escaped text, and that the API is
 * called with the raw string value — not a modified or evaluated version.
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import Login from "../../components/Login";
import Signup from "../../components/Signup";
import MessageList from "../../components/MessageList";
import SearchContacts from "../../components/SearchContacts";
import ChatRoom from "../../components/ChatRoom";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("../../services/socketService", () => ({
  initSocket: jest.fn(),
  getSocket: jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: true,
  })),
  waitForSocket: jest.fn(() =>
    Promise.resolve({ emit: jest.fn(), on: jest.fn(), off: jest.fn() })
  ),
  onMessage: jest.fn(() => jest.fn()),
  disconnectSocket: jest.fn(),
}));

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import apiClient from "../../services/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderWithProviders = (ui, authOverrides = {}) => {
  const authValue = {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
    updateProfile: jest.fn(),
    ...authOverrides,
  };
  return {
    ...render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          {ui}
        </AuthContext.Provider>
      </MemoryRouter>
    ),
    authValue,
  };
};

const MOCK_USER = {
  id: "user-abc123",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  profileSetup: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockResolvedValue({ data: { contacts: [] } });
  apiClient.post.mockResolvedValue({ data: { messages: [] } });
});

// ===========================================================================
// 1. BRUTE FORCE PROTECTION
// ===========================================================================

describe("Brute Force Protection", () => {
  /**
   * The frontend must not submit simultaneous requests.
   * While a login is in-flight, the submit button must be disabled.
   */
  it("disables the login button while a request is in-flight, preventing parallel submissions", async () => {
    let resolveFirst;
    const login = jest.fn(() => new Promise((r) => { resolveFirst = r; }));
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "attacker@evil.com");
    await user.type(screen.getByLabelText(/password/i), "guess1");

    act(() => {
      screen.getByRole("button", { name: /^login$/i }).click();
    });

    // Button must be disabled — a second click cannot fire a parallel request
    const btn = screen.getByRole("button", { name: /logging in/i });
    expect(btn).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);

    act(() => resolveFirst({}));
  });

  it("disables the signup button while a request is in-flight", async () => {
    let resolveSignup;
    const signup = jest.fn(() => new Promise((r) => { resolveSignup = r; }));
    renderWithProviders(<Signup />, { signup });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/first name/i), "A");
    await user.type(screen.getByLabelText(/last name/i), "B");
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "pw");

    act(() => {
      screen.getByRole("button", { name: /sign up/i }).click();
    });

    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
    expect(signup).toHaveBeenCalledTimes(1);

    act(() => resolveSignup({}));
  });

  it("survives 5 consecutive failed login attempts without crashing", async () => {
    const login = jest.fn().mockRejectedValue({
      response: { data: { message: "Invalid credentials" } },
    });
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    for (let attempt = 1; attempt <= 5; attempt++) {
      await user.clear(screen.getByLabelText(/email/i));
      await user.clear(screen.getByLabelText(/password/i));
      await user.type(screen.getByLabelText(/email/i), `guess${attempt}@evil.com`);
      await user.type(screen.getByLabelText(/password/i), `wrong${attempt}`);
      await user.click(screen.getByRole("button", { name: /^login$/i }));

      await waitFor(() =>
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
      );
    }

    // After 5 failures, the form must still be functional
    expect(screen.getByLabelText(/email/i)).toBeEnabled();
    expect(screen.getByLabelText(/password/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(5);
  });

  it("clears the previous error before each new login attempt", async () => {
    let callCount = 0;
    const login = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject({ response: { data: { message: "Bad attempt 1" } } });
      }
      return Promise.reject({ response: { data: { message: "Bad attempt 2" } } });
    });

    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    // First attempt
    await user.type(screen.getByLabelText(/email/i), "a@a.com");
    await user.type(screen.getByLabelText(/password/i), "wrong1");
    await user.click(screen.getByRole("button", { name: /^login$/i }));
    await waitFor(() => expect(screen.getByText("Bad attempt 1")).toBeInTheDocument());

    // Second attempt — old error must be replaced
    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), "wrong2");
    await user.click(screen.getByRole("button", { name: /^login$/i }));
    await waitFor(() => expect(screen.getByText("Bad attempt 2")).toBeInTheDocument());
    expect(screen.queryByText("Bad attempt 1")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. INJECTION ATTACK PREVENTION
// ===========================================================================

describe("Injection Attack Prevention", () => {
  /**
   * The frontend must pass user input to the API as plain strings.
   * It must never evaluate, parse as JSON, or mutate the input.
   */

  it("passes a NoSQL injection payload in email to the API as a plain string", async () => {
    const login = jest.fn().mockResolvedValue({});
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    const injectionEmail = '{"$gt":""}';
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: injectionEmail } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "anything" } });
    // Use fireEvent.submit to bypass jsdom's email-format validation
    act(() => { fireEvent.submit(document.querySelector("form")); });

    await waitFor(() =>
      // The API must receive the raw string — not a parsed object
      expect(login).toHaveBeenCalledWith(injectionEmail, "anything")
    );
  });

  it("passes a SQL injection payload in email to the API as a plain string", async () => {
    const login = jest.fn().mockResolvedValue({});
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    const sqlPayload = "admin@example.com' OR '1'='1";
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: sqlPayload } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "' OR '1'='1" } });
    // Use fireEvent.submit to bypass jsdom's email-format validation
    act(() => { fireEvent.submit(document.querySelector("form")); });

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(sqlPayload, "' OR '1'='1")
    );
  });

  it("passes a NoSQL injection payload in signup fields as plain strings", async () => {
    const signup = jest.fn().mockResolvedValue({});
    renderWithProviders(<Signup />, { signup });
    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '{"$ne":null}' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: '{"$gt":""}' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "inject@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '{"$where":"1==1"}' } });
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith(
        "inject@test.com",
        '{"$where":"1==1"}',
        '{"$ne":null}',
        '{"$gt":""}'
      )
    );
  });

  it("passes a NoSQL injection payload in the contact search field as a plain string", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [] } });
    renderWithProviders(
      <SearchContacts onContactAdded={jest.fn()} onClose={jest.fn()} />,
      { user: MOCK_USER }
    );
    const user = userEvent.setup();

    const injectionQuery = '{"$where":"sleep(1000)"}';
    fireEvent.change(
      screen.getByPlaceholderText(/search by name or email/i),
      { target: { value: injectionQuery } }
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/contacts/search",
        { searchTerm: injectionQuery } // sent as-is — the backend is responsible for sanitisation
      )
    );
  });

  it("passes a SQL injection payload in the contact search field as a plain string", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [] } });
    renderWithProviders(
      <SearchContacts onContactAdded={jest.fn()} onClose={jest.fn()} />,
      { user: MOCK_USER }
    );
    const user = userEvent.setup();

    const sqlPayload = "'; DROP TABLE users; --";
    fireEvent.change(
      screen.getByPlaceholderText(/search by name or email/i),
      { target: { value: sqlPayload } }
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", {
        searchTerm: sqlPayload,
      })
    );
  });
});

// ===========================================================================
// 3. CROSS-SITE SCRIPTING (XSS) PREVENTION
// ===========================================================================

describe("XSS Prevention", () => {
  /**
   * React escapes all string content rendered with {}. These tests confirm
   * that user-supplied content containing HTML or script tags is rendered as
   * visible text — not injected into the DOM as live HTML.
   */

  const renderMessages = (messages, currentUserId = "user-1") =>
    render(<MessageList messages={messages} currentUserId={currentUserId} />);

  it("renders a <script> tag in message content as visible text, not as a DOM script element", () => {
    const xssContent = "<script>alert('xss')</script>";
    renderMessages([
      { id: "m1", content: xssContent, senderId: "other-user", timestamp: null },
    ]);

    // The text must appear literally in the DOM
    expect(screen.getByText(xssContent)).toBeInTheDocument();
    // No real <script> element must have been injected
    expect(document.querySelector("script[src]")).toBeNull();
  });

  it("renders an <img onerror> XSS payload as text, not as an image element", () => {
    const xssContent = "<img src=x onerror=alert(1)>";
    renderMessages([
      { id: "m2", content: xssContent, senderId: "other-user", timestamp: null },
    ]);

    expect(screen.getByText(xssContent)).toBeInTheDocument();
    // Must not have created a real <img> with an onerror
    const imgs = document.querySelectorAll("img");
    imgs.forEach((img) => {
      expect(img.getAttribute("onerror")).toBeNull();
    });
  });

  it("renders an <a href=javascript:> payload as plain text", () => {
    const xssContent = '<a href="javascript:alert(1)">click</a>';
    renderMessages([
      { id: "m3", content: xssContent, senderId: "other-user", timestamp: null },
    ]);

    expect(screen.getByText(xssContent)).toBeInTheDocument();
    // The anchor must not have been created as a real DOM link
    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.getAttribute("href")).not.toMatch(/javascript:/i);
    });
  });

  it("renders HTML entities in message content as literal characters", () => {
    const xssContent = '&lt;script&gt;alert("xss")&lt;/script&gt;';
    renderMessages([
      { id: "m4", content: xssContent, senderId: "other-user", timestamp: null },
    ]);

    expect(screen.getByText(xssContent)).toBeInTheDocument();
  });

  it("renders a <script> tag in a contact name as plain text in the contacts list", async () => {
    const xssContact = {
      id: "c1",
      firstName: "<script>alert('xss')</script>",
      lastName: "Smith",
      email: "xss@example.com",
    };

    apiClient.get.mockResolvedValue({ data: { contacts: [xssContact] } });

    renderWithProviders(<ChatRoom />, { user: MOCK_USER, logout: jest.fn() });

    await waitFor(() => {
      // Text appears as a visible string — not a script element
      expect(
        screen.getByText("<script>alert('xss')</script> Smith")
      ).toBeInTheDocument();
    });

    expect(document.querySelector("script[src]")).toBeNull();
  });

  it("does not use dangerouslySetInnerHTML with user-controlled content in MessageList", () => {
    // Verify by checking that the rendered message-content div contains only
    // a text node, not child HTML elements injected via innerHTML
    const xssContent = "<b>bold</b><i>italic</i>";
    renderMessages([
      { id: "m5", content: xssContent, senderId: "other-user", timestamp: null },
    ]);

    const contentEl = document.querySelector(".message-content");
    expect(contentEl).not.toBeNull();
    // If React escaped properly, there should be no <b> or <i> children
    expect(contentEl.querySelector("b")).toBeNull();
    expect(contentEl.querySelector("i")).toBeNull();
    // The raw string should be visible as text
    expect(contentEl.textContent).toContain("<b>bold</b>");
  });
});
