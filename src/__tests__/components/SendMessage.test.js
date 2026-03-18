import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SendMessage from "../../components/SendMessage";

//Unit tests for SendMessage component

describe("SendMessage", () => {
  describe("rendering", () => {
    it("renders text input field", () => {
      render(<SendMessage onSendMessage={jest.fn()} />);
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    });

    it("renders send button", () => {
      render(<SendMessage onSendMessage={jest.fn()} />);
      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });
  });

  describe("input validation", () => {
    it("does not call onSendMessage when input is empty", () => {
      const onSend = jest.fn();
      render(<SendMessage onSendMessage={onSend} />);

      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not call onSendMessage for whitespace-only input", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      await user.type(screen.getByPlaceholderText(/type a message/i), "   ");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("message sending", () => {
    it("calls onSendMessage with typed text on send", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Hello world");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith("Hello world");
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("clears input field after successful send", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Test message");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("trims whitespace from input before sending", async () => {
      const onSend = jest.fn().mockResolvedValue();
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "  Message with spaces  ");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith("Message with spaces");
    });
  });

  describe("loading state", () => {
    it("disables input while sending", async () => {
      let resolve;
      const onSend = jest.fn(() => new Promise((r) => { resolve = r; }));
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Test");

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /send/i }));
      });

      expect(input).toBeDisabled();

      act(() => resolve());
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });

    it("disables button and shows loading text while sending", async () => {
      let resolve;
      const onSend = jest.fn(() => new Promise((r) => { resolve = r; }));
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Test");

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /send/i }));
      });

      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

      act(() => resolve());
    });
  });

  describe("error handling", () => {
    it("re-enables input after send failure", async () => {
      const onSend = jest.fn().mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Will fail");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });

    it("keeps input value when send fails", async () => {
      const onSend = jest.fn().mockRejectedValue(new Error("Failed"));
      const user = userEvent.setup();

      render(<SendMessage onSendMessage={onSend} />);

      const input = screen.getByPlaceholderText(/type a message/i);
      await user.type(input, "Unsent message");
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(input).toHaveValue("Unsent message");
      });
    });
  });
});
