/**
 * ChatRoom.js — Unit / Integration Tests
 *
 * Coverage targets (uncovered lines):
 *   Line 36   – setupSocket: waitForSocket rejects
 *   Lines 55–58  – handleConnect fires, rejoins room, calls fetchContacts
 *   Lines 72–90  – handleMessage: message from/to selected contact, updates messages + fetchContacts
 *   Lines 117–120 – fetchContacts error path (apiClient.get rejects)
 *   Lines 134–135 – fetchMessagesForContact: senderId read from msg.userId fallback
 *   Lines 154–163 – polling interval fires and updates messages when length differs
 *   Line 197  – handleSendMessage: getSocket returns null
 *   Lines 202–221 – handleDeleteContact: window.confirm, delete call, clears selectedContact
 *   Lines 227–236 – handleContactAdded: closes search modal, selects first contact
 *   Line 245  – handleLogout error path (logout() rejects)
 *   Lines 254–309 – JSX: search modal, edit-profile modal, no-chat-selected state
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ChatRoom from "../../components/ChatRoom";

// ---------------------------------------------------------------------------
// Module-level mocks
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
  onMessage: jest.fn(() => jest.fn()), // returns an unsubscribe fn
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
import * as socketService from "../../services/socketService";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: "user-abc123",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  profileSetup: true,
};

const MOCK_CONTACT = {
  id: "contact-xyz456",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps ChatRoom with MemoryRouter + AuthContext.Provider.
 * authOverrides are merged on top of sensible defaults.
 */
const renderWithProviders = (ui, authOverrides = {}) => {
  const authValue = {
    user: MOCK_USER,
    loading: false,
    error: null,
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    signup: jest.fn(),
    updateProfile: jest.fn(),
    ...authOverrides,
  };
  return {
    ...render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
      </MemoryRouter>
    ),
    authValue,
  };
};

const renderChatRoom = (authOverrides = {}) =>
  renderWithProviders(<ChatRoom />, authOverrides);

// ---------------------------------------------------------------------------
// Per-test setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Healthy defaults — individual tests override as needed
  apiClient.get.mockResolvedValue({ data: { contacts: [] } });
  apiClient.post.mockResolvedValue({ data: { messages: [] } });
  apiClient.delete.mockResolvedValue({});

  socketService.waitForSocket.mockResolvedValue({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  });

  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: true,
  };
  socketService.getSocket.mockReturnValue(mockSocket);
  socketService.onMessage.mockReturnValue(jest.fn()); // unsubscribe fn
});

// ---------------------------------------------------------------------------
// 1. setupSocket error path — Line 36
// ---------------------------------------------------------------------------

describe("setupSocket error path (line 36)", () => {
  it("handles waitForSocket rejection gracefully without crashing the component", async () => {
    socketService.waitForSocket.mockRejectedValue(new Error("socket timeout"));

    // Component should still mount without throwing
    renderChatRoom();

    // The contacts heading should appear — the component did not crash
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 2. socket reconnect handler — Lines 55–58
// ---------------------------------------------------------------------------

describe("socket reconnect handler (lines 55–58)", () => {
  it("emits 'join' and refreshes contacts when the socket fires a connect event", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });

    let capturedHandleConnect;
    const mockEmit = jest.fn();
    const mockOn = jest.fn((event, handler) => {
      if (event === "connect") capturedHandleConnect = handler;
    });
    const mockOff = jest.fn();
    socketService.getSocket.mockReturnValue({
      emit: mockEmit,
      on: mockOn,
      off: mockOff,
      connected: true,
    });

    renderChatRoom();

    // Wait for initial mount to complete
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());

    expect(capturedHandleConnect).toBeDefined();

    // Simulate the socket reconnecting
    const callCountBefore = apiClient.get.mock.calls.length;
    act(() => {
      capturedHandleConnect();
    });

    // join should have been emitted
    expect(mockEmit).toHaveBeenCalledWith("join", { userId: MOCK_USER.id });

    // fetchContacts should have been called again
    await waitFor(() =>
      expect(apiClient.get.mock.calls.length).toBeGreaterThan(callCountBefore)
    );
  });
});

// ---------------------------------------------------------------------------
// 3. handleMessage — Lines 72–90
// ---------------------------------------------------------------------------

describe("handleMessage — real-time message receipt (lines 72–90)", () => {
  const setupWithContact = async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    apiClient.post.mockResolvedValue({ data: { messages: [] } });

    let capturedMessageHandler;
    socketService.onMessage.mockImplementation((handler) => {
      capturedMessageHandler = handler;
      return jest.fn(); // unsubscribe
    });

    const user = userEvent.setup();
    renderChatRoom();

    // Wait for contacts to load, then click Jane to select her
    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    // Ensure onMessage was registered after selecting the contact
    await waitFor(() => expect(capturedMessageHandler).toBeDefined());

    return { capturedMessageHandler, user };
  };

  it("appends a message to state when the message comes FROM the selected contact", async () => {
    const { capturedMessageHandler } = await setupWithContact();

    const inboundMessage = {
      id: "msg-001",
      content: "Hey John!",
      sender: { id: MOCK_CONTACT.id },
      recipient: { id: MOCK_USER.id },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      capturedMessageHandler(inboundMessage);
    });

    await waitFor(() =>
      expect(screen.getByText("Hey John!")).toBeInTheDocument()
    );
  });

  it("appends a message to state when the message is TO the selected contact (sent by current user)", async () => {
    const { capturedMessageHandler } = await setupWithContact();

    const outboundMessage = {
      id: "msg-002",
      content: "Hi Jane!",
      sender: { id: MOCK_USER.id },
      recipient: { id: MOCK_CONTACT.id },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      capturedMessageHandler(outboundMessage);
    });

    await waitFor(() =>
      expect(screen.getByText("Hi Jane!")).toBeInTheDocument()
    );
  });

  it("does NOT append a message that is unrelated to the selected contact", async () => {
    const { capturedMessageHandler } = await setupWithContact();

    const unrelatedMessage = {
      id: "msg-003",
      content: "This should be ignored",
      sender: { id: "some-other-user" },
      recipient: { id: "yet-another-user" },
      timestamp: new Date().toISOString(),
    };

    act(() => {
      capturedMessageHandler(unrelatedMessage);
    });

    // Message should not appear in the DOM
    expect(screen.queryByText("This should be ignored")).not.toBeInTheDocument();
  });

  it("calls fetchContacts whenever any message arrives (regardless of relevance)", async () => {
    const { capturedMessageHandler } = await setupWithContact();

    const callCountBefore = apiClient.get.mock.calls.length;

    act(() => {
      capturedMessageHandler({
        id: "msg-004",
        content: "ping",
        sender: { id: MOCK_CONTACT.id },
        recipient: { id: MOCK_USER.id },
        timestamp: new Date().toISOString(),
      });
    });

    await waitFor(() =>
      expect(apiClient.get.mock.calls.length).toBeGreaterThan(callCountBefore)
    );
  });
});

// ---------------------------------------------------------------------------
// 4. fetchContacts error path — Lines 117–120
// ---------------------------------------------------------------------------

describe("fetchContacts error path (lines 117–120)", () => {
  it("shows 'Failed to load contacts' when the contacts API rejects", async () => {
    apiClient.get.mockRejectedValue(new Error("Network Error"));

    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByText(/failed to load contacts/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 5. fetchMessagesForContact — msg.userId fallback — Lines 134–135
// ---------------------------------------------------------------------------

describe("fetchMessagesForContact — msg.userId senderId fallback (lines 134–135)", () => {
  it("normalises senderId from msg.userId when neither sender nor senderId is present", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    // Return a message that only has userId (no sender object, no senderId)
    apiClient.post.mockResolvedValue({
      data: {
        messages: [
          {
            _id: "msg-userId-001",
            content: "Message using userId",
            userId: MOCK_USER.id, // the fallback field
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    // The message text should be visible
    await waitFor(() =>
      expect(screen.getByText("Message using userId")).toBeInTheDocument()
    );

    // The post body should have been called with Jane's id
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/messages/get-messages",
      { id: MOCK_CONTACT.id }
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Polling interval — Lines 154–163
// ---------------------------------------------------------------------------

describe("polling interval (lines 154–163)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("updates messages when the poll returns a list with a different length", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    // Initial fetch returns empty messages
    apiClient.post.mockResolvedValue({ data: { messages: [] } });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    // After initial load, verify no messages shown
    await waitFor(() =>
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument()
    );

    // Now the poll will return one new message
    apiClient.post.mockResolvedValue({
      data: {
        messages: [
          {
            _id: "poll-msg-001",
            content: "Polled message",
            senderId: MOCK_CONTACT.id,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // Advance timers by 3 seconds to trigger setInterval callback
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() =>
      expect(screen.getByText("Polled message")).toBeInTheDocument()
    );
  });

  it("does NOT replace messages when the poll returns the same count", async () => {
    const existingMessage = {
      _id: "existing-001",
      content: "Already here",
      senderId: MOCK_CONTACT.id,
      timestamp: new Date().toISOString(),
    };

    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    apiClient.post.mockResolvedValue({ data: { messages: [existingMessage] } });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    await waitFor(() =>
      expect(screen.getByText("Already here")).toBeInTheDocument()
    );

    const postCallsBefore = apiClient.post.mock.calls.length;

    // Advance timers — poll runs but same length, should not cause extra renders
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    // post was called again for the poll
    expect(apiClient.post.mock.calls.length).toBeGreaterThan(postCallsBefore);
    // Original message still visible (state unchanged)
    expect(screen.getByText("Already here")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. handleSendMessage — getSocket returns null — Line 197
// ---------------------------------------------------------------------------

describe("handleSendMessage — getSocket returns null (line 197)", () => {
  it("does not crash and still calls fetchContacts when socket is unavailable", async () => {
    socketService.getSocket.mockReturnValue(null);
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    apiClient.post.mockResolvedValue({ data: { messages: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, "Hello without socket");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    // fetchContacts should still be called (socket branch skipped, but fetchContacts runs)
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalled()
    );

    // Component did not crash — sidebar heading still present
    expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. handleDeleteContact — Lines 202–221
// ---------------------------------------------------------------------------

describe("handleDeleteContact (lines 202–221)", () => {
  it("does nothing when the user cancels the confirmation dialog", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });

    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));

    // Click the delete button (✕) for Jane
    const deleteBtn = screen.getByTitle(/delete conversation/i);
    fireEvent.click(deleteBtn);

    expect(apiClient.delete).not.toHaveBeenCalled();
    // Jane still appears
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("calls the delete endpoint and removes the contact from the list when confirmed", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });

    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));

    fireEvent.click(screen.getByTitle(/delete conversation/i));

    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith(
        `/api/contacts/delete-dm/${MOCK_CONTACT.id}`
      )
    );

    // Jane should be removed from the contacts list
    await waitFor(() =>
      expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument()
    );
  });

  it("clears selectedContact and messages when the selected contact is deleted", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    apiClient.post.mockResolvedValue({ data: { messages: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));

    // Select Jane so the chat panel opens
    await user.click(screen.getByText("Jane Smith"));

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    );

    // Delete her
    fireEvent.click(screen.getByTitle(/delete conversation/i));

    // The "no chat selected" state should appear
    await waitFor(() =>
      expect(
        screen.getByText(/select a contact to start chatting/i)
      ).toBeInTheDocument()
    );
  });

  it("shows an error message when the delete API call fails", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    apiClient.delete.mockRejectedValue(new Error("Delete failed"));

    renderChatRoom();

    await waitFor(() => screen.getByText("Jane Smith"));
    fireEvent.click(screen.getByTitle(/delete conversation/i));

    await waitFor(() =>
      expect(
        screen.getByText(/failed to delete conversation/i)
      ).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 9. handleContactAdded — Lines 227–236
// ---------------------------------------------------------------------------

describe("handleContactAdded (lines 227–236)", () => {
  it("closes the search modal and selects the first returned contact", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });
    // Search returns Jane
    apiClient.post.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );

    // Open the search modal
    await user.click(screen.getByRole("button", { name: /\+/i }));
    expect(screen.getByText(/add new contacts/i)).toBeInTheDocument();

    // Search for Jane
    await user.type(
      screen.getByPlaceholderText(/search by name or email/i),
      "Jane"
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => screen.getByText("Jane Smith"));

    // Select Jane then confirm
    await user.click(screen.getByText("Jane Smith"));
    await user.click(
      screen.getByRole("button", { name: /message 1 user/i })
    );

    // Search modal should be gone
    await waitFor(() =>
      expect(screen.queryByText(/add new contacts/i)).not.toBeInTheDocument()
    );

    // Chat panel for Jane should now be visible (her name appears as the chat header)
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: "Jane Smith" })).toBeInTheDocument()
    );
  });

  it("closes the modal and refreshes contacts even when no contacts are selected", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );

    // Open modal then immediately close via the ✕ button
    await user.click(screen.getByRole("button", { name: /\+/i }));
    expect(screen.getByText(/add new contacts/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /✕/i }));

    await waitFor(() =>
      expect(screen.queryByText(/add new contacts/i)).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 10. handleLogout error path — Line 245
// ---------------------------------------------------------------------------

describe("handleLogout error path (line 245)", () => {
  it("does not crash when logout() rejects", async () => {
    const logout = jest.fn().mockRejectedValue(new Error("logout failed"));
    delete window.location;
    window.location = { href: "" };

    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom({ logout });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());

    // Component should still be in the DOM — error was caught silently
    expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 11. JSX — no-chat-selected state, search modal, edit-profile modal
//     Lines 254–309
// ---------------------------------------------------------------------------

describe("JSX rendering (lines 254–309)", () => {
  it("shows the 'Select a contact to start chatting' message when no contact is selected", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    renderChatRoom();

    await waitFor(() =>
      expect(
        screen.getByText(/select a contact to start chatting/i)
      ).toBeInTheDocument()
    );
  });

  it("renders the search modal when the + button is clicked", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /\+/i }));

    expect(screen.getByText(/add new contacts/i)).toBeInTheDocument();
  });

  it("closes the search modal when its onClose handler is called", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /chats/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /\+/i }));
    expect(screen.getByText(/add new contacts/i)).toBeInTheDocument();

    // The ✕ close button inside SearchContacts calls onClose → setShowSearchModal(false)
    await user.click(screen.getByRole("button", { name: /✕/i }));

    await waitFor(() =>
      expect(screen.queryByText(/add new contacts/i)).not.toBeInTheDocument()
    );
  });

  it("renders the edit-profile modal when the user-info section is clicked", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    await user.click(screen.getByText("Edit profile"));

    expect(screen.getByRole("heading", { name: /edit profile/i })).toBeInTheDocument();
  });

  it("closes the edit-profile modal when its onClose callback is invoked", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    const user = userEvent.setup();
    renderChatRoom();

    await waitFor(() => screen.getByText("Edit profile"));
    await user.click(screen.getByText("Edit profile"));

    expect(screen.getByRole("heading", { name: /edit profile/i })).toBeInTheDocument();

    // Click the ✕ button inside the EditProfile modal
    // There may be multiple ✕ buttons; the one inside the modal header is what we want.
    const closeButtons = screen.getAllByRole("button", { name: /✕/i });
    await user.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /edit profile/i })
      ).not.toBeInTheDocument()
    );
  });

  it("renders user first/last name and email in the sidebar", async () => {
    apiClient.get.mockResolvedValue({ data: { contacts: [] } });

    renderChatRoom();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText(MOCK_USER.email)).toBeInTheDocument();
    });
  });
});
