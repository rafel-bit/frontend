import React, { useState } from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import AuthInitializer from "../../components/AuthInitializer";
import { AuthContext } from "../../context/AuthContext";

jest.mock("../../services/socketService", () => ({
  initSocket: jest.fn(),
  getSocket: jest.fn(),
  disconnectSocket: jest.fn(),
  waitForSocket: jest.fn(),
  onMessage: jest.fn(() => jest.fn()),
}));

import { initSocket } from "../../services/socketService";

/**
 * Unit tests for AuthInitializer component
 *
 * Tests focus on:
 * - Calling initSocket when the user is authenticated
 * - Not calling initSocket when the user is not authenticated
 * - Rendering children transparently
 * - Re-calling initSocket when isAuthenticated transitions from false to true
 */
describe("AuthInitializer", () => {
  const createAuthContext = (overrides = {}) => ({
    isAuthenticated: false,
    loading: false,
    user: null,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
    updateProfile: jest.fn(),
    ...overrides,
  });

  const renderAuthInitializer = (authValue = {}, children = <div>Child Content</div>) => {
    const mockAuth = createAuthContext(authValue);
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuth}>
          <AuthInitializer>{children}</AuthInitializer>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("socket initialization", () => {
    it("calls initSocket when isAuthenticated is true", () => {
      renderAuthInitializer({ isAuthenticated: true });

      expect(initSocket).toHaveBeenCalledTimes(1);
    });

    it("does not call initSocket when isAuthenticated is false", () => {
      renderAuthInitializer({ isAuthenticated: false });

      expect(initSocket).not.toHaveBeenCalled();
    });

    it("calls initSocket again when isAuthenticated changes from false to true", () => {
      // Wrapper component that holds auth state so we can update it
      const AuthWrapper = () => {
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const mockAuth = createAuthContext({ isAuthenticated });

        return (
          <MemoryRouter>
            <AuthContext.Provider value={mockAuth}>
              <AuthInitializer>
                <button onClick={() => setIsAuthenticated(true)}>
                  Authenticate
                </button>
              </AuthInitializer>
            </AuthContext.Provider>
          </MemoryRouter>
        );
      };

      const { getByRole } = render(<AuthWrapper />);

      expect(initSocket).not.toHaveBeenCalled();

      act(() => {
        getByRole("button", { name: /authenticate/i }).click();
      });

      expect(initSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe("rendering", () => {
    it("renders children when isAuthenticated is true", () => {
      renderAuthInitializer({ isAuthenticated: true });

      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders children when isAuthenticated is false", () => {
      renderAuthInitializer({ isAuthenticated: false });

      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders custom children directly without a wrapper element", () => {
      renderAuthInitializer(
        { isAuthenticated: false },
        <span data-testid="custom-child">Hello</span>
      );

      expect(screen.getByTestId("custom-child")).toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });
});
