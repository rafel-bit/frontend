import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock
jest.mock("../../services/apiClient");

import { AuthProvider, AuthContext } from "../../context/AuthContext";
import apiClient from "../../services/apiClient";
import { factories } from "../testUtils";

//Unit tests for AuthContext
describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderAuthConsumer = () => {
    let contextValue;
    const Consumer = () => {
      contextValue = React.useContext(AuthContext);
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    return () => contextValue;
  };

  describe("initialization", () => {
    it("starts with loading=true and no user", () => {
      localStorage.setItem("authToken", "pending-token");
      apiClient.get.mockReturnValue(new Promise(() => {})); // Never resolves
      const getContext = renderAuthConsumer();

      expect(getContext().loading).toBe(true);
      expect(getContext().user).toBeNull();
      expect(getContext().isAuthenticated).toBe(false);
    });

    it("loads user when valid token in localStorage", async () => {
      const fakeUser = { id: "u1", email: "me@test.com" };
      localStorage.setItem("authToken", "valid-token");
      apiClient.get.mockResolvedValue({ data: fakeUser });

      const getContext = renderAuthConsumer();

      await waitFor(() => expect(getContext().loading).toBe(false));

      expect(getContext().user).toEqual(fakeUser);
      expect(getContext().isAuthenticated).toBe(true);
    });

    it("stays unauthenticated and skips API when no token", async () => {
      const getContext = renderAuthConsumer();

      await waitFor(() => expect(getContext().loading).toBe(false));

      expect(getContext().user).toBeNull();
      expect(getContext().isAuthenticated).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("removes invalid token from localStorage on auth check failure", async () => {
      localStorage.setItem("authToken", "expired-token");
      apiClient.get.mockRejectedValue(new Error("401 Unauthorized"));

      const getContext = renderAuthConsumer();

      await waitFor(() => expect(getContext().loading).toBe(false));

      expect(localStorage.getItem("authToken")).toBeNull();
      expect(getContext().user).toBeNull();
    });
  });

  describe("login()", () => {
    it("sets user on successful login", async () => {
      const fakeUser = factories.user({ id: "u2", email: "a@b.com" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await act(() => getContext().login("a@b.com", "pw"));

      expect(getContext().user).toEqual(fakeUser);
      expect(getContext().isAuthenticated).toBe(true);
    });

    it("accepts flat response without .user wrapper", async () => {
      const fakeUser = factories.user({ id: "u3", email: "flat@b.com" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: fakeUser });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await act(() => getContext().login("flat@b.com", "pw"));

      expect(getContext().user).toEqual(fakeUser);
    });

    it("calls API with email and password", async () => {
      const fakeUser = factories.user();
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await act(() => getContext().login("user@test.com", "password123"));

      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/login", {
        email: "user@test.com",
        password: "password123",
      });
    });

    it("exposes error message on login failure", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Bad credentials" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      try {
        await act(() => getContext().login("x", "y"));
      } catch (err) {
        // Expected to throw
      }

      await waitFor(() => expect(getContext().error).toBe("Bad credentials"));
    });

    it("rethrows error after setting state", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      const error = { response: { data: { message: "Bad creds" } } };
      apiClient.post.mockRejectedValue(error);

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await expect(act(() => getContext().login("x", "y"))).rejects.toEqual(error);
    });
  });

  describe("logout()", () => {
    it("clears user and removes token", async () => {
      const fakeUser = factories.user({ id: "u4" });
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: fakeUser });
      apiClient.post.mockResolvedValue({});

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().logout());

      expect(getContext().user).toBeNull();
      expect(localStorage.getItem("authToken")).toBeNull();
      expect(getContext().isAuthenticated).toBe(false);
    });

    it("clears user even when API call fails", async () => {
      const fakeUser = factories.user({ id: "u5" });
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: fakeUser });
      apiClient.post.mockRejectedValue(new Error("Network error"));

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().logout());

      expect(getContext().user).toBeNull();
      expect(localStorage.getItem("authToken")).toBeNull();
    });

    it("calls logout API endpoint", async () => {
      const fakeUser = factories.user();
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: fakeUser });
      apiClient.post.mockResolvedValue({});

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().logout());

      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/logout");
    });
  });

  describe("signup()", () => {
    it("sets user on successful signup", async () => {
      const newUser = factories.user({ id: "u6", email: "new@test.com" });
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: newUser } });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await act(() => getContext().signup("new@test.com", "pw", "New", "User"));

      expect(getContext().user).toEqual({ ...newUser, firstName: "New", lastName: "User" });
      expect(getContext().isAuthenticated).toBe(true);
    });

    it("calls API with all four parameters in correct order", async () => {
      const newUser = factories.user();
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: newUser } });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await act(() =>
        getContext().signup("test@test.com", "secret", "Test", "User")
      );

      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/signup", {
        email: "test@test.com",
        password: "secret",
        firstName: "Test",
        lastName: "User",
      });
    });

    it("exposes error message on signup failure", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Email already exists" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      try {
        await act(() => getContext().signup("x", "y", "A", "B"));
      } catch (err) {
        // Expected to throw
      }

      await waitFor(() =>
        expect(getContext().error).toBe("Email already exists")
      );
    });

    it("rethrows error after setting state", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      const error = { response: { data: { message: "Email taken" } } };
      apiClient.post.mockRejectedValue(error);

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      await expect(act(() => getContext().signup("x", "y", "A", "B"))).rejects.toEqual(
        error
      );
    });
  });

  describe("updateProfile()", () => {
    //Each test needs an already authenticated user so it can call updateProfile.
    const existingUser = {
      id: "u10",
      email: "profile@test.com",
      firstName: "Old",
      lastName: "Name",
      color: "#000",
    };

    it("updates user state with new names", async () => {
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: existingUser });
      apiClient.post.mockResolvedValue({
        data: { user: { ...existingUser, firstName: "Alice", lastName: "Smith" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().updateProfile("Alice", "Smith"));

      expect(getContext().user.firstName).toBe("Alice");
      expect(getContext().user.lastName).toBe("Smith");
    });

    it("merges returned fields with submitted names", async () => {
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: existingUser });
      // API returns an extra field (color) that was not in the original user
      apiClient.post.mockResolvedValue({
        data: { user: { ...existingUser, color: "#abc" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().updateProfile("Alice", "Smith"));

      const updated = getContext().user;
      // Returned field merged in
      expect(updated.color).toBe("#abc");
      // Submitted names always applied on top
      expect(updated.firstName).toBe("Alice");
      expect(updated.lastName).toBe("Smith");
    });

    it("calls the correct API endpoint with names", async () => {
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: existingUser });
      apiClient.post.mockResolvedValue({
        data: { user: { ...existingUser, firstName: "Bob", lastName: "Jones" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await act(() => getContext().updateProfile("Bob", "Jones"));

      expect(apiClient.post).toHaveBeenCalledWith("/api/auth/update-profile", {
        firstName: "Bob",
        lastName: "Jones",
      });
    });

    it("throws and sets error on failure", async () => {
      localStorage.setItem("authToken", "tok");
      apiClient.get.mockResolvedValue({ data: existingUser });
      const error = { response: { data: { message: "Update failed" } } };
      apiClient.post.mockRejectedValue(error);

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().isAuthenticated).toBe(true));

      await expect(
        act(() => getContext().updateProfile("Bad", "Input"))
      ).rejects.toEqual(error);

      await waitFor(() =>
        expect(getContext().error).toBe("Update failed")
      );
    });
  });

  describe("error message handling", () => {
    it("clears error on successful login", async () => {
      const fakeUser = factories.user();
      apiClient.get.mockRejectedValue(new Error("no token"));

      // First, trigger an error
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Bad creds" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      try {
        await act(() => getContext().login("x", "y"));
      } catch (err) {
        // Expected
      }

      expect(getContext().error).toEqual("Bad creds");

      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });

      await act(() => getContext().login("user@test.com", "password"));

      expect(getContext().error).toBeNull();
    });

    it("extracts error message from response.data.message", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Custom error message" } },
      });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      try {
        await act(() => getContext().login("x", "y"));
      } catch (err) {
        // Expected
      }

      await waitFor(() =>
        expect(getContext().error).toBe("Custom error message")
      );
    });
  });

  describe("context API", () => {
    it("provides all required methods", async () => {
      apiClient.get.mockRejectedValue(new Error("no token"));

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      const ctx = getContext();
      expect(typeof ctx.login).toBe("function");
      expect(typeof ctx.logout).toBe("function");
      expect(typeof ctx.signup).toBe("function");
      expect(typeof ctx.updateProfile).toBe("function");
    });

    it("provides isAuthenticated boolean derived from user", async () => {
      const fakeUser = factories.user();
      apiClient.get.mockRejectedValue(new Error("no token"));
      apiClient.post.mockResolvedValue({ data: { user: fakeUser } });

      const getContext = renderAuthConsumer();
      await waitFor(() => expect(getContext().loading).toBe(false));

      expect(getContext().isAuthenticated).toBe(false);

      await act(() => getContext().login("user@test.com", "pw"));

      expect(getContext().isAuthenticated).toBe(true);
    });
  });
});
