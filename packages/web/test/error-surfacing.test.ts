import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function getStatusText(status: number, statusText?: string): string {
  if (statusText && statusText.trim()) return statusText.trim();
  switch (status) {
    case 400: return "Bad Request";
    case 401: return "Unauthorized";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 500: return "Internal Server Error";
    case 502: return "Bad Gateway";
    case 503: return "Service Unavailable";
    case 504: return "Gateway Timeout";
    default: return "";
  }
}

function extractErrorMessage(res: { status: number; statusText?: string }, resText: string, data: any): string {
  if (data?.error?.code === "DISPOSABLE_EMAIL_NOT_ALLOWED" || data?.error?.message?.includes("disposable")) {
    return "Disposable email domains are not allowed. Please enter your work or personal email.";
  }
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  if (typeof data?.error === "string") return data.error;

  const trimmed = (resText || "").trim();
  if (trimmed && !trimmed.startsWith("<")) {
    return `Server error (${res.status}): ${trimmed.slice(0, 160)}`;
  }

  const statusText = getStatusText(res.status, res.statusText);
  const statusMsg = statusText ? ` ${statusText}` : "";
  return `Server error (${res.status}${statusMsg}). Please check configuration or server logs.`;
}

describe('Frontend Error Surfacing Logic (Login.tsx & LoginModal.tsx)', () => {
  test('surfaces clean 500 Internal Server Error on HTML response instead of generic message', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const html = '<!DOCTYPE html><html><body>500 Internal Server Error</body></html>';
    let data: any = null;
    try {
      data = JSON.parse(html);
    } catch {
      data = null;
    }

    const errorMsg = extractErrorMessage(res, html, data);
    assert.strictEqual(
      errorMsg,
      'Server error (500 Internal Server Error). Please check configuration or server logs.'
    );
    assert.notStrictEqual(errorMsg, 'Failed to send verification code. Please try again.');
  });

  test('surfaces clean 404 Not Found on HTML response', () => {
    const res = { status: 404, statusText: '' };
    const html = '<!DOCTYPE html><html><body>404 Not Found</body></html>';
    let data: any = null;
    try {
      data = JSON.parse(html);
    } catch {
      data = null;
    }

    const errorMsg = extractErrorMessage(res, html, data);
    assert.strictEqual(
      errorMsg,
      'Server error (404 Not Found). Please check configuration or server logs.'
    );
  });

  test('surfaces JSON diagnostic error code and message', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const jsonStr = JSON.stringify({
      error: {
        code: 'BREVO_API_KEY_MISSING',
        message: 'Brevo API key is not configured. Please set BREVO_API_KEY in environment variables.',
      },
    });
    const data = JSON.parse(jsonStr);

    const errorMsg = extractErrorMessage(res, jsonStr, data);
    assert.strictEqual(
      errorMsg,
      'Brevo API key is not configured. Please set BREVO_API_KEY in environment variables.'
    );
  });

  test('surfaces plaintext server crash snippets', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const text = "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/packages/web/api/_brevo'";
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    const errorMsg = extractErrorMessage(res, text, data);
    assert.strictEqual(
      errorMsg,
      "Server error (500): Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/packages/web/api/_brevo'"
    );
  });

  test('surfaces disposable email domain error accurately', () => {
    const res = { status: 400, statusText: 'Bad Request' };
    const jsonStr = JSON.stringify({
      error: {
        code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
        message: 'Disposable email addresses are not accepted.',
      },
    });
    const data = JSON.parse(jsonStr);

    const errorMsg = extractErrorMessage(res, jsonStr, data);
    assert.strictEqual(
      errorMsg,
      'Disposable email domains are not allowed. Please enter your work or personal email.'
    );
  });
});
