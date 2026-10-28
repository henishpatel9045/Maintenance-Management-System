import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyCsrf } from "../../src/core/http/csrf";
import { isLoginThrottled, recordLoginAttempt } from "../../src/core/auth/throttle";
import { generateSessionToken, hashToken } from "../../src/core/auth/session";

describe("Security Suite: CSRF Verification, Login Throttling & Session Security", () => {
  describe("CSRF Defense", () => {
    it("permits safe HTTP methods without origin checks", () => {
      const getReq = new NextRequest("http://localhost:8080/api/v1/seva", {
        method: "GET",
      });
      expect(verifyCsrf(getReq).valid).toBe(true);

      const headReq = new NextRequest("http://localhost:8080/api/health", {
        method: "HEAD",
      });
      expect(verifyCsrf(headReq).valid).toBe(true);
    });

    it("rejects cross-site requests indicated by Sec-Fetch-Site header", () => {
      const req = new NextRequest("http://localhost:8080/api/v1/seva", {
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "http://localhost:8080",
          host: "localhost:8080",
        },
      });
      const check = verifyCsrf(req);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Cross-site");
    });

    it("rejects mismatched Origin and Host headers on state-mutating requests", () => {
      const req = new NextRequest("http://localhost:8080/api/v1/seva", {
        method: "POST",
        headers: {
          origin: "http://attacker.evil.com",
          host: "localhost:8080",
        },
      });
      const check = verifyCsrf(req);
      expect(check.valid).toBe(false);
      expect(check.reason).toContain("Origin header does not match Host");
    });

    it("permits legitimate same-origin state-mutating requests", () => {
      const req = new NextRequest("http://localhost:8080/api/v1/seva", {
        method: "POST",
        headers: {
          origin: "http://localhost:8080",
          host: "localhost:8080",
          "sec-fetch-site": "same-origin",
        },
      });
      expect(verifyCsrf(req).valid).toBe(true);
    });
  });

  describe("Brute-Force Throttling & Account Lockout", () => {
    const testIp = "192.168.1.50";
    const testEmail = "victim@community.local";

    it("allows initial attempts below the 5-per-minute threshold", () => {
      const status = isLoginThrottled({ ip: testIp, email: testEmail });
      expect(status.throttled).toBe(false);
    });

    it("throttles after 5 failed attempts within 60 seconds", () => {
      const ip = "10.0.0.1";
      const email = "user1@domain.local";

      for (let i = 0; i < 5; i++) {
        recordLoginAttempt({ ip, email, success: false });
      }

      const status = isLoginThrottled({ ip, email });
      expect(status.throttled).toBe(true);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("locks account for 15 minutes after 10 failed attempts", () => {
      const ip = "10.0.0.2";
      const email = "user2@domain.local";

      for (let i = 0; i < 10; i++) {
        recordLoginAttempt({ ip, email, success: false });
      }

      const status = isLoginThrottled({ ip, email });
      expect(status.throttled).toBe(true);
      // Lockout duration is 15 minutes (900 seconds)
      expect(status.retryAfterSeconds).toBeGreaterThan(60);
    });

    it("clears failed attempt counters upon successful authentication", () => {
      const ip = "10.0.0.3";
      const email = "user3@domain.local";

      for (let i = 0; i < 4; i++) {
        recordLoginAttempt({ ip, email, success: false });
      }

      // Successful login resets counters
      recordLoginAttempt({ ip, email, success: true });

      const status = isLoginThrottled({ ip, email });
      expect(status.throttled).toBe(false);
    });
  });

  describe("Session Cryptography", () => {
    it("generates cryptographically secure 256-bit hex tokens", () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).toHaveLength(64); // 32 bytes in hex = 64 chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it("computes deterministic SHA-256 hashes for storage without exposing raw token", () => {
      const token = generateSessionToken();
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(token);
    });
  });
});
