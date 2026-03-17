import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Login from "../../components/Login";
import { AuthContext } from "../../context/AuthContext";
import { factories } from "../testUtils";

/**
 * Unit tests for Login component
 * 
 * Tests focus on:
 * - Field rendering (email, password, button)
 * - Navigation link to signup
 * - Form submission with correct arguments
 * - Error message display
 * - Loading state during submission
 * - Initial state (no error visible)
 */
describe("Login", () => {
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
        <MemoryRouter>
          <AuthContext.Provider value={mockAuth}>
            <Login />
          </AuthContext.Provider>
        </MemoryRouter>
      ),
      mockAuth,
    };
  };

  describe("rendering", () => {
    it("renders email input field", () => {
      renderLogin();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it("renders password input field", () => {
      renderLogin();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders login button", () => {
      renderLogin();
      expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
    });

    it("displays link to signup page", () => {
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

    it("calls login only once per submission", async () => {
      const { mockAuth } = renderLogin({ login: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), "test@test.com");
      await user.type(screen.getByLabelText(/password/i), "pass");
      fireEvent.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(mockAuth.login).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("error handling", () => {
    it("displays error message on login failure", async () => {
      const { mockAuth } = renderLogin({
        login: jest.fn().mockRejectedValue({
          response: { data: { message: "Invalid credentials" } },
        }),
      });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), "bad@test.com");
      await user.type(screen.getByLabelText(/password/i), "wrong");
      fireEvent.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });

    it("shows no error message on initial render", () => {
      renderLogin();
      expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("disables button and shows loading text while submitting", async () => {
      let resolve;
      const { mockAuth } = renderLogin({
        login: jest.fn(() => new Promise((r) => { resolve = r; })),
      });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email/i), "user@test.com");
      await user.type(screen.getByLabelText(/password/i), "password123");

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /login/i }));
      });

      expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

      act(() => resolve({}));
    });

    it("clears form after successful login", async () => {
      const { mockAuth } = renderLogin({ login: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, "user@test.com");
      await user.type(passwordInput, "password123");
      fireEvent.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(emailInput).toHaveValue("");
        expect(passwordInput).toHaveValue("");
      });
    });
  });
});
