import React from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext } from "../context/AuthContext";

/**
 * Factory functions for creating test data
 */
export const factories = {
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

  authContextValue: (overrides = {}) => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
    updateProfile: jest.fn(),
    ...overrides,
  }),
};

/**
 * Renders a component with AuthContext
 */
export const renderWithAuth = (component, authValue = {}) => {
  const defaultAuthValue = factories.authContextValue(authValue);
  return render(
    <AuthContext.Provider value={defaultAuthValue}>
      {component}
    </AuthContext.Provider>
  );
};

/**
 * Sets up common mocks for tests
 */
export const setupMocks = () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });
};

/**
 * Creates a mock user event instance for consistent usage
 */
export const createUserEvent = () => userEvent.setup();
