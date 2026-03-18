import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";
import { AuthContext } from "../../context/AuthContext";

//Unit tests for ProtectedRoute component

describe("ProtectedRoute", () => {
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

  const renderProtectedRoute = (authValue = {}, children = <div>Test Content</div>) => {
    const mockAuth = createAuthContext(authValue);
    return render(
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthContext.Provider value={mockAuth}>
          <Routes>
            <Route
              path="/protected"
              element={<ProtectedRoute>{children}</ProtectedRoute>}
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  describe("loading state", () => {
    it("shows loading indicator when loading is true", () => {
      renderProtectedRoute({ loading: true, isAuthenticated: false });

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("does not render children while loading", () => {
      renderProtectedRoute({ loading: true, isAuthenticated: false });

      expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
    });
  });

  describe("unauthenticated", () => {
    it("redirects to /login when not authenticated", () => {
      renderProtectedRoute({ loading: false, isAuthenticated: false });

      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });

    it("does not render children when not authenticated", () => {
      renderProtectedRoute({ loading: false, isAuthenticated: false });

      expect(screen.queryByText("Test Content")).not.toBeInTheDocument();
    });
  });

  describe("authenticated", () => {
    it("renders children when authenticated", () => {
      renderProtectedRoute({ loading: false, isAuthenticated: true });

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("does not redirect to login when authenticated", () => {
      renderProtectedRoute({ loading: false, isAuthenticated: true });

      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    it("renders custom children when authenticated", () => {
      const customChildren = <span>Custom Protected Content</span>;
      renderProtectedRoute({ loading: false, isAuthenticated: true }, customChildren);

      expect(screen.getByText("Custom Protected Content")).toBeInTheDocument();
    });
  });
});
