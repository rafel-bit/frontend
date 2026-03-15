import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContactsList from "../../components/ContactsList";
import { factories } from "../testUtils";

/**
 * Unit tests for ContactsList component
 * 
 * Tests focus on:
 * - Rendering empty state
 * - Contact list rendering and display
 * - Avatar initials generation
 * - Selection and deletion callbacks
 * - Active state styling
 * - Field fallback handling
 */
describe("ContactsList", () => {
  const noop = jest.fn();

  describe("empty state", () => {
    it("displays empty-state message when no contacts", () => {
      render(
        <ContactsList
          contacts={[]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument();
    });
  });

  describe("contact rendering", () => {
    it("renders one contact row per item", () => {
      const contacts = [
        factories.contact({ firstName: "Alice", lastName: "Smith" }),
        factories.contact({
          _id: "contact-2",
          firstName: "Bob",
          lastName: "Jones",
        }),
      ];

      render(
        <ContactsList
          contacts={contacts}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    it("displays email for each contact", () => {
      const contacts = [
        factories.contact({ email: "alice@example.com" }),
        factories.contact({ _id: "contact-2", email: "bob@example.com" }),
      ];

      render(
        <ContactsList
          contacts={contacts}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
  });

  describe("avatar rendering", () => {
    it("renders avatar initials from first and last name", () => {
      const contacts = [
        factories.contact({ firstName: "Alice", lastName: "Smith" }),
      ];

      render(
        <ContactsList
          contacts={contacts}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText("AS")).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("calls onSelectContact with contact object on row click", () => {
      const onSelect = jest.fn();
      const contact = factories.contact({ firstName: "Alice", lastName: "Smith" });

      render(
        <ContactsList
          contacts={[contact]}
          selectedContact={null}
          onSelectContact={onSelect}
          onDeleteContact={noop}
        />
      );

      fireEvent.click(screen.getByText("Alice Smith"));
      expect(onSelect).toHaveBeenCalledWith(contact);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("calls onDeleteContact with contact id on delete button click", () => {
      const onDelete = jest.fn();
      const contact = factories.contact({ _id: "contact-123" });

      render(
        <ContactsList
          contacts={[contact]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={onDelete}
        />
      );

      const deleteButton = screen.getByTitle("Delete conversation");
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith("contact-123");
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("uses id field when _id is not available", () => {
      const onDelete = jest.fn();
      const contact = {
        id: "alt-id",
        firstName: "Carol",
        lastName: "White",
        email: "carol@example.com",
      };

      render(
        <ContactsList
          contacts={[contact]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={onDelete}
        />
      );

      fireEvent.click(screen.getByTitle("Delete conversation"));
      expect(onDelete).toHaveBeenCalledWith("alt-id");
    });
  });

  describe("selection styling", () => {
    it("marks selected contact with 'active' class", () => {
      const contact = factories.contact();
      const { container } = render(
        <ContactsList
          contacts={[contact]}
          selectedContact={contact}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      const item = container.querySelector(".contact-item");
      expect(item).toHaveClass("active");
    });

    it("removes 'active' class from non-selected contacts", () => {
      const contacts = [
        factories.contact({ _id: "contact-1" }),
        factories.contact({ _id: "contact-2" }),
      ];

      const { container } = render(
        <ContactsList
          contacts={contacts}
          selectedContact={contacts[0]}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      const items = container.querySelectorAll(".contact-item");
      expect(items[0]).toHaveClass("active");
      expect(items[1]).not.toHaveClass("active");
    });
  });

  describe("field fallback handling", () => {
    it("falls back to otherUser fields when main fields missing", () => {
      const contact = {
        _id: "contact-1",
        otherUser: {
          firstName: "Dave",
          lastName: "Brown",
          email: "dave@example.com",
        },
      };

      render(
        <ContactsList
          contacts={[contact]}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText("Dave Brown")).toBeInTheDocument();
      expect(screen.getByText("dave@example.com")).toBeInTheDocument();
    });

    it("displays error when contacts prop is not an array", () => {
      render(
        <ContactsList
          contacts={null}
          selectedContact={null}
          onSelectContact={noop}
          onDeleteContact={noop}
        />
      );

      expect(screen.getByText(/not an array/i)).toBeInTheDocument();
    });
  });
});
