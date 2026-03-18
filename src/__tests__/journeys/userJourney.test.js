/*
 * Journeys covered:
 *   1. New user registers an account
 *   2. Returning user logs in
 *   3. User updates their profile (first/last name)
 *   4. User searches for and adds a contact
 *   5. User sends a message in a chat
 *   6. User logs out
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import Login from "../../components/Login";
import Signup from "../../components/Signup";
import EditProfile from "../../components/EditProfile";
import SearchContacts from "../../components/SearchContacts";
import ChatRoom from "../../components/ChatRoom";

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

// Shared helpers

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

//A realistic logged-in user matching the backend model.
const MOCK_USER = {
  id: "user-abc123",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  profileSetup: true,
  color: "#667eea",
};

//A realistic contact returned by the contacts endpoint.
const MOCK_CONTACT = {
  id: "contact-xyz456",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default API responses so every test doesn't have to set them up
  apiClient.get.mockResolvedValue({ data: { contacts: [] } });
  apiClient.post.mockResolvedValue({ data: { messages: [] } });
});


// New User Registration

describe("Journey 1: New user registers an account", () => {
  it("renders all signup fields and submits correct data to the API", async () => {
    const signup = jest.fn().mockResolvedValue({});
    const { authValue } = renderWithProviders(<Signup />, { signup });
    const user = userEvent.setup();

    // User fills in every field
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "SecurePass1!");

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith(
        "john@example.com",
        "SecurePass1!",
        "John",
        "Doe"
      );
    });
  });

  it("shows an error when the email is already registered", async () => {
    const signup = jest
      .fn()
      .mockRejectedValue({ response: { data: { message: "Email already in use" } } });
    renderWithProviders(<Signup />, { signup });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/password/i), "pass");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() =>
      expect(screen.getByText("Email already in use")).toBeInTheDocument()
    );
  });

  it("disables the submit button while the request is in-flight", async () => {
    let resolveSignup;
    const signup = jest.fn(() => new Promise((r) => { resolveSignup = r; }));
    renderWithProviders(<Signup />, { signup });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "pass");

    act(() => {
      screen.getByRole("button", { name: /sign up/i }).click();
    });

    expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();

    act(() => resolveSignup({}));
  });
});

// Journey 2 – Returning User Login

describe("Journey 2: Returning user logs in", () => {
  it("submits email and password to the login function", async () => {
    const login = jest.fn().mockResolvedValue({});
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("john@example.com", "SecurePass1!")
    );
  });

  it("displays an error on wrong credentials", async () => {
    const login = jest.fn().mockRejectedValue({
      response: { data: { message: "Invalid credentials" } },
    });
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "WrongPass");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    );
  });

  it("disables the button while logging in", async () => {
    let resolveLogin;
    const login = jest.fn(() => new Promise((r) => { resolveLogin = r; }));
    renderWithProviders(<Login />, { login });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/password/i), "pass");

    act(() => {
      screen.getByRole("button", { name: /^login$/i }).click();
    });

    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    act(() => resolveLogin({}));
  });
});

// Journey 3 – User Updates Their Profile

describe("Journey 3: User updates their first and last name", () => {
  it("pre-fills the edit fields with the current name", () => {
    const updateProfile = jest.fn().mockResolvedValue({});
    renderWithProviders(<EditProfile onClose={jest.fn()} />, {
      user: MOCK_USER,
      updateProfile,
    });

    // Both the read-only display row AND the editable input show the same value
    expect(screen.getAllByDisplayValue("John")).toHaveLength(2);
    expect(screen.getAllByDisplayValue("Doe")).toHaveLength(2);
  });

  it("shows email as a read-only field", () => {
    renderWithProviders(<EditProfile onClose={jest.fn()} />, {
      user: MOCK_USER,
      updateProfile: jest.fn(),
    });

    const emailInput = screen.getByDisplayValue("john@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("calls updateProfile with the new name when saved", async () => {
    const updateProfile = jest.fn().mockResolvedValue({});
    const onClose = jest.fn();
    renderWithProviders(<EditProfile onClose={onClose} />, {
      user: MOCK_USER,
      updateProfile,
    });
    const user = userEvent.setup();

    // Clear and retype the first name field
    const firstNameInput = screen.getByLabelText(/new first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jonathan");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith("Jonathan", "Doe")
    );
  });

  it("shows a success message and closes the modal after saving", async () => {
    jest.useFakeTimers();
    const updateProfile = jest.fn().mockResolvedValue({});
    const onClose = jest.fn();
    renderWithProviders(<EditProfile onClose={onClose} />, {
      user: MOCK_USER,
      updateProfile,
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument()
    );

    act(() => jest.runAllTimers());
    expect(onClose).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("shows an error if first name is left blank", async () => {
    const updateProfile = jest.fn();
    renderWithProviders(<EditProfile onClose={jest.fn()} />, {
      user: MOCK_USER,
      updateProfile,
    });
    const user = userEvent.setup();

    // Clear the editable first name input
    await user.clear(screen.getByLabelText(/new first name/i));

    // Use fireEvent.submit to bypass jsdom's native HTML5 required validation
    // so the React handler runs and sets the error state
    act(() => {
      fireEvent.submit(document.querySelector("form"));
    });

    await waitFor(() =>
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument()
    );
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

// Journey 4 – User Searches for and Adds a Contact

describe("Journey 4: User searches for and selects a contact", () => {
  it("calls the search API with the typed search term", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    const onContactAdded = jest.fn();
    renderWithProviders(
      <SearchContacts onContactAdded={onContactAdded} onClose={jest.fn()} />,
      { user: MOCK_USER }
    );
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/search by name or email/i), "Jane");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/contacts/search",
        { searchTerm: "Jane" }
      )
    );
  });

  it("displays search results and allows selecting a contact", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    const onContactAdded = jest.fn();
    renderWithProviders(
      <SearchContacts onContactAdded={onContactAdded} onClose={jest.fn()} />,
      { user: MOCK_USER }
    );
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/search by name or email/i), "Jane");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() =>
      expect(screen.getByText("Jane Smith")).toBeInTheDocument()
    );

    // Select the contact
    await user.click(screen.getByText("Jane Smith"));
    expect(screen.getByText(/1 contact\(s\) selected/i)).toBeInTheDocument();
  });

  it("calls onContactAdded with the selected contact when confirmed", async () => {
    apiClient.post.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    const onContactAdded = jest.fn();
    renderWithProviders(
      <SearchContacts onContactAdded={onContactAdded} onClose={jest.fn()} />,
      { user: MOCK_USER }
    );
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/search by name or email/i), "Jane");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => screen.getByText("Jane Smith"));

    await user.click(screen.getByText("Jane Smith"));
    await user.click(screen.getByRole("button", { name: /message 1 user/i }));

    expect(onContactAdded).toHaveBeenCalledWith([MOCK_CONTACT]);
  });
});

// Journey 5 – User Sends a Message

describe("Journey 5: User sends a message in a chat", () => {
  const renderChatRoom = (authOverrides = {}) => {
    apiClient.get.mockResolvedValue({
      data: { contacts: [MOCK_CONTACT] },
    });
    apiClient.post.mockResolvedValue({ data: { messages: [] } });

    return renderWithProviders(<ChatRoom />, {
      user: MOCK_USER,
      logout: jest.fn(),
      ...authOverrides,
    });
  };

  it("loads and displays the contacts list on mount", async () => {
    apiClient.get.mockResolvedValue({
      data: { contacts: [MOCK_CONTACT] },
    });
    renderChatRoom();

    await waitFor(() =>
      expect(screen.getByText("Jane Smith")).toBeInTheDocument()
    );
  });

  it("shows the message input after a contact is selected", async () => {
    apiClient.get.mockResolvedValue({
      data: { contacts: [MOCK_CONTACT] },
    });
    renderChatRoom();
    const user = userEvent.setup();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    expect(
      screen.getByPlaceholderText(/type a message/i)
    ).toBeInTheDocument();
  });

  it("emits a sendMessage socket event with correct payload when the user sends a message", async () => {
    const { getSocket } = require("../../services/socketService");
    const mockEmit = jest.fn();
    getSocket.mockReturnValue({ emit: mockEmit, on: jest.fn(), off: jest.fn(), connected: true });

    apiClient.get.mockResolvedValue({ data: { contacts: [MOCK_CONTACT] } });
    renderChatRoom();
    const user = userEvent.setup();

    await waitFor(() => screen.getByText("Jane Smith"));
    await user.click(screen.getByText("Jane Smith"));

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, "Hello Jane!");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() =>
      expect(mockEmit).toHaveBeenCalledWith(
        "sendMessage",
        expect.objectContaining({
          sender: MOCK_USER.id,
          content: "Hello Jane!",
        })
      )
    );
  });
});

// Journey 6 – User Logs Out

describe("Journey 6: User logs out", () => {
  it("calls the logout function when the logout button is clicked", async () => {
    const logout = jest.fn().mockResolvedValue({});
    // Replace window.location.href since jsdom doesn't navigate
    delete window.location;
    window.location = { href: "" };

    apiClient.get.mockResolvedValue({ data: { contacts: [] } });
    renderWithProviders(<ChatRoom />, { user: MOCK_USER, logout });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
