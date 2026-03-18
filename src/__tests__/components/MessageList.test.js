import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageList from "../../components/MessageList";
import { factories } from "../testUtils";

//Unit tests for MessageList component

describe("MessageList", () => {
  describe("empty state", () => {
    it("displays empty-state message when no messages exist", () => {
      render(<MessageList messages={[]} currentUserId="user-123" />);
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });
  });

  describe("message rendering", () => {
    it("renders all message content", () => {
      const messages = [
        factories.message({ content: "Hello!" }),
        factories.message({ _id: "msg-2", content: "Hi back!", senderId: "user-456" }),
      ];

      render(<MessageList messages={messages} currentUserId="user-123" />);

      expect(screen.getByText("Hello!")).toBeInTheDocument();
      expect(screen.getByText("Hi back!")).toBeInTheDocument();
    });

    it("renders messages in the correct order", () => {
      const messages = [
        factories.message({ _id: "msg-1", content: "First" }),
        factories.message({ _id: "msg-2", content: "Second" }),
        factories.message({ _id: "msg-3", content: "Third" }),
      ];

      render(<MessageList messages={messages} currentUserId="user-123" />);

      const items = screen.getAllByText(/First|Second|Third/);
      expect(items[0]).toHaveTextContent("First");
      expect(items[1]).toHaveTextContent("Second");
      expect(items[2]).toHaveTextContent("Third");
    });
  });

  describe("CSS classification", () => {
    it("applies 'sent' class to user's own messages", () => {
      const { container } = render(
        <MessageList
          messages={[factories.message({ senderId: "user-123" })]}
          currentUserId="user-123"
        />
      );

      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("applies 'received' class to other users' messages", () => {
      const { container } = render(
        <MessageList
          messages={[factories.message({ senderId: "user-456" })]}
          currentUserId="user-123"
        />
      );

      expect(container.querySelector(".message.received")).toBeInTheDocument();
    });

    it("correctly classifies mixed sender list", () => {
      const { container } = render(
        <MessageList
          messages={[
            factories.message({ senderId: "user-123" }),
            factories.message({ _id: "msg-2", senderId: "user-456" }),
          ]}
          currentUserId="user-123"
        />
      );

      expect(container.querySelectorAll(".message.sent")).toHaveLength(1);
      expect(container.querySelectorAll(".message.received")).toHaveLength(1);
    });
  });

  describe("senderId format handling", () => {
    it("reads senderId from sender._id (MongoDB populate format)", () => {
      const { container } = render(
        <MessageList
          messages={[
            factories.message({
              sender: { _id: "user-123" },
              senderId: undefined,
            }),
          ]}
          currentUserId="user-123"
        />
      );

      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("reads senderId from sender.id (alternate format)", () => {
      const { container } = render(
        <MessageList
          messages={[factories.message({ sender: { id: "user-123" } })]}
          currentUserId="user-123"
        />
      );

      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });

    it("coerces numeric senderId to string for comparison", () => {
      const { container } = render(
        <MessageList
          messages={[factories.message({ senderId: 123 })]}
          currentUserId="123"
        />
      );

      expect(container.querySelector(".message.sent")).toBeInTheDocument();
    });
  });

  describe("timestamp handling", () => {
    it("renders timestamp element for each message", () => {
      render(
        <MessageList
          messages={[factories.message()]}
          currentUserId="user-123"
        />
      );

      const timeEl = document.querySelector(".message-time");
      expect(timeEl).toBeInTheDocument();
      expect(timeEl.textContent).not.toBe("");
    });

    it("handles missing timestamp without crashing", () => {
      expect(() => {
        render(
          <MessageList
            messages={[factories.message({ timestamp: undefined })]}
            currentUserId="user-123"
          />
        );
      }).not.toThrow();
    });

    it("formats timestamp in HH:MM format", () => {
      const timestamp = "2024-01-15T14:30:00.000Z";
      render(
        <MessageList
          messages={[factories.message({ timestamp })]}
          currentUserId="user-123"
        />
      );

      const timeEl = document.querySelector(".message-time");
      // Should be valid time format (not empty)
      expect(timeEl.textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
