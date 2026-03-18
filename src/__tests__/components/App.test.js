//Unit tests

import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

//Jest mock setup

jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

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

import App from "../../App";
import apiClient from "../../services/apiClient";


//Must be called before render() so the router reads the correct location.
const setPath = (path) => {
  window.history.pushState({}, "", path);
};

// Tests

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset to root so each test starts from a known location
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
  });

  // Loading state

  describe("loading screen", () => {
    it("renders loading screen while auth check is in progress", () => {
      // Provide a token so checkAuth fires the API call
      localStorage.setItem("authToken", "pending-token");
      // Never-resolving promise keeps loading=true indefinitely
      apiClient.get.mockReturnValue(new Promise(() => {}));

      render(<App />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("loading screen has the correct CSS class", () => {
      localStorage.setItem("authToken", "pending-token");
      apiClient.get.mockReturnValue(new Promise(() => {}));

      const { container } = render(<App />);

      expect(container.querySelector(".loading-screen")).toBeInTheDocument();
    });
  });

  // Unauthenticated routes

  describe("unauthenticated routing", () => {
    it("shows Login page at /login when not authenticated", async () => {
      // No token → checkAuth resolves immediately without API call
      setPath("/login");
      apiClient.get.mockRejectedValue(new Error("no session"));

      render(<App />);

      // Wait for loading to finish
      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      // Login page renders an email input
      expect(
        screen.getByRole("textbox", { name: /email/i })
      ).toBeInTheDocument();
    });

    it("shows Signup page at /signup when not authenticated", async () => {
      setPath("/signup");
      apiClient.get.mockRejectedValue(new Error("no session"));

      render(<App />);

      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      // Signup has a first name field that Login does not
      expect(
        screen.getByRole("textbox", { name: /first name/i })
      ).toBeInTheDocument();
    });

    it("redirects / to /chat which then redirects to /login when unauthenticated", async () => {
      setPath("/");
      // No token, no API call needed
      apiClient.get.mockRejectedValue(new Error("no session"));

      render(<App />);

      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      // ProtectedRoute redirects unauthenticated users to /login
      expect(
        screen.getByRole("textbox", { name: /email/i })
      ).toBeInTheDocument();
    });

    it("redirects unknown paths to /chat which then redirects to /login when unauthenticated", async () => {
      setPath("/unknown-path");
      apiClient.get.mockRejectedValue(new Error("no session"));

      render(<App />);

      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      expect(
        screen.getByRole("textbox", { name: /email/i })
      ).toBeInTheDocument();
    });
  });

  // Authenticated routing

  describe("authenticated routing", () => {
    it("redirects /login to /chat when already authenticated", async () => {
      const fakeUser = {
        id: "u1",
        email: "me@test.com",
        firstName: "Me",
        lastName: "Test",
      };
      localStorage.setItem("authToken", "valid-token");
      // checkAuth resolves with user, apiClient.get used for contacts inside ChatRoom too
      apiClient.get.mockResolvedValue({ data: fakeUser });

      setPath("/login");
      render(<App />);

      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      // Should be on /chat now (ChatRoom renders), not on the Login form
      expect(
        screen.queryByRole("textbox", { name: /email/i })
      ).not.toBeInTheDocument();
    });

    it("redirects /signup to /chat when already authenticated", async () => {
      const fakeUser = {
        id: "u2",
        email: "me@test.com",
        firstName: "Me",
        lastName: "Test",
      };
      localStorage.setItem("authToken", "valid-token");
      apiClient.get.mockResolvedValue({ data: fakeUser });

      setPath("/signup");
      render(<App />);

      await waitFor(() =>
        expect(screen.queryByText(/^loading\.{3}$/i)).not.toBeInTheDocument()
      );

      // Signup form should NOT be shown
      expect(
        screen.queryByRole("textbox", { name: /first name/i })
      ).not.toBeInTheDocument();
    });
  });
});
