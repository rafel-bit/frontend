import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock API client
jest.mock("../../services/apiClient", () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
}));

import SearchContacts from "../../components/SearchContacts";
import apiClient from "../../services/apiClient";
import { factories } from "../testUtils";

//Unit tests for SearchContacts component

describe("SearchContacts", () => {
  const mockOnContactAdded = jest.fn();
  const results = [
    factories.contact({
      _id: "user-1",
      firstName: "Dave",
      lastName: "Brown",
      email: "dave@example.com",
    }),
    factories.contact({
      _id: "user-2",
      firstName: "Eve",
      lastName: "Clark",
      email: "eve@example.com",
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders search input field", () => {
      render(<SearchContacts onContactAdded={mockOnContactAdded} />);
      expect(screen.getByPlaceholderText(/search by name or email/i)).toBeInTheDocument();
    });

    it("renders search button", () => {
      render(<SearchContacts onContactAdded={mockOnContactAdded} />);
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    });
  });

  describe("search validation", () => {
    it("does not call API when search query is empty", () => {
      render(<SearchContacts onContactAdded={mockOnContactAdded} />);
      fireEvent.click(screen.getByRole("button", { name: /search/i }));
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("does not call API for whitespace-only query", async () => {
      const user = userEvent.setup();
      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "   ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("API interaction", () => {
    it("calls search API with entered query", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "Dave");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", {
          searchTerm: "Dave",
        });
      });
    });

    it("trims whitespace from search query before API call", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "  Dave  ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith("/api/contacts/search", {
          searchTerm: "Dave",
        });
      });
    });
  });

  describe("result rendering", () => {
    it("displays search results", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText("Dave Brown")).toBeInTheDocument();
        expect(screen.getByText("Eve Clark")).toBeInTheDocument();
      });
    });

    it("displays 'No contacts found' when results are empty", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: [] } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "XYZ");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText(/no contacts found/i)).toBeInTheDocument();
      });
    });
  });

  describe("contact selection", () => {
    it("toggles contact selection on click", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => screen.getByText("Dave Brown"));

      const row = screen.getByText("Dave Brown").closest(".search-result-item");

      // First click: select
      fireEvent.click(row);
      expect(row).toHaveClass("selected");

      // Second click: deselect
      fireEvent.click(row);
      expect(row).not.toHaveClass("selected");
    });

    it("displays selection count", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => screen.getByText("Dave Brown"));

      fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
      expect(screen.getByText(/1 contact\(s\) selected/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText("Eve Clark").closest(".search-result-item"));
      expect(screen.getByText(/2 contact\(s\) selected/i)).toBeInTheDocument();
    });
  });

  describe("message button", () => {
    it("calls onContactAdded with selected contacts when message button clicked", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => screen.getByText("Dave Brown"));

      fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
      fireEvent.click(screen.getByRole("button", { name: /message 1 user/i }));

      expect(mockOnContactAdded).toHaveBeenCalledWith([results[0]]);
      expect(mockOnContactAdded).toHaveBeenCalledTimes(1);
    });

    it("passes all selected contacts to callback", async () => {
      apiClient.post.mockResolvedValue({ data: { contacts: results } });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "a");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => screen.getByText("Dave Brown"));

      fireEvent.click(screen.getByText("Dave Brown").closest(".search-result-item"));
      fireEvent.click(screen.getByText("Eve Clark").closest(".search-result-item"));
      fireEvent.click(screen.getByRole("button", { name: /message.*user/i }));

      expect(mockOnContactAdded).toHaveBeenCalledWith(results);
    });
  });

  describe("error handling", () => {
    it("displays error message when API call fails", async () => {
      apiClient.post.mockRejectedValue({
        response: { data: { message: "Unauthorized" } },
      });
      const user = userEvent.setup();

      render(<SearchContacts onContactAdded={mockOnContactAdded} />);

      await user.type(screen.getByPlaceholderText(/search by name or email/i), "test");
      fireEvent.click(screen.getByRole("button", { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      });
    });
  });
});
