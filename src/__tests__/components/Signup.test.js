import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Signup from "../../components/Signup";
import { AuthContext } from "../../context/AuthContext";

/**
 * Unit tests for Signup component
 * 
 * Tests focus on:
 * - Field rendering (first name, last name, email, password, button)
 * - Navigation link to login
 * - Form submission with correct argument order
 * - Error message display
 * - Loading state during submission
 */
describe("Signup", () => {
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
    it("renders first name input field", () => {
      renderSignup();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    it("renders last name input field", () => {
      renderSignup();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });

    it("renders email input field", () => {
      renderSignup();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it("renders password input field", () => {
      renderSignup();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders signup button", () => {
      renderSignup();
      expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    });

    it("displays link back to login page", () => {
      renderSignup();
      expect(screen.getByRole("link", { name: /login here/i })).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("calls signup with correct argument order: email, password, firstName, lastName", async () => {
      const { mockAuth } = renderSignup({ signup: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "jane@test.com");
      await user.type(screen.getByLabelText(/password/i), "secret123");
      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(mockAuth.signup).toHaveBeenCalledWith(
          "jane@test.com",
          "secret123",
          "Jane",
          "Doe"
        );
      });
    });

    it("calls signup only once per submission", async () => {
      const { mockAuth } = renderSignup({ signup: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Smith");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.type(screen.getByLabelText(/password/i), "pass");
      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(mockAuth.signup).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("error handling", () => {
    it("displays server error message on signup failure", async () => {
      const { mockAuth } = renderSignup({
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

    it("shows no error message on initial render", () => {
      renderSignup();
      expect(screen.queryByText(/already|error/i)).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("disables button and shows loading text while submitting", async () => {
      let resolve;
      const { mockAuth } = renderSignup({
        signup: jest.fn(() => new Promise((r) => { resolve = r; })),
      });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "Jane");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "jane@test.com");
      await user.type(screen.getByLabelText(/password/i), "secret");

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
      });

      expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();

      act(() => resolve({}));
    });

    it("clears form after successful signup", async () => {
      const { mockAuth } = renderSignup({ signup: jest.fn().mockResolvedValue({}) });
      const user = userEvent.setup();

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Doe");
      await user.type(emailInput, "jane@test.com");
      await user.type(passwordInput, "secret");
      fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(firstNameInput).toHaveValue("");
        expect(lastNameInput).toHaveValue("");
        expect(emailInput).toHaveValue("");
        expect(passwordInput).toHaveValue("");
      });
    });
  });
});
