import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_COOKIE,
  createAccessSession,
  getSessionSigningSecret,
  isAuthorizedRequest,
} from "../src/lib/server-auth.ts";

const secret = "access-test-secret-with-enough-entropy";

function requestWithCookie(value) {
  return new Request("https://wikitrack.example", {
    headers: { cookie: `${ACCESS_COOKIE}=${value}` },
  });
}

test("shared access sessions accept a valid signature and reject a different secret", () => {
  const token = createAccessSession(secret);
  assert.equal(isAuthorizedRequest(requestWithCookie(token), secret), true);
  assert.equal(isAuthorizedRequest(requestWithCookie(token), `${secret}-other`), false);
});

test("shared access sessions reject forged and expired cookies", () => {
  const forgedToken = `${Date.now() + 60_000}.${"0".repeat(64)}`;
  assert.equal(isAuthorizedRequest(requestWithCookie(forgedToken), secret), false);

  const expiredToken = createAccessSession(secret, 0);
  assert.equal(isAuthorizedRequest(requestWithCookie(expiredToken), secret), false);
  assert.equal(isAuthorizedRequest(requestWithCookie("malformed"), secret), false);
});

test("changing the shared password invalidates sessions", () => {
  const signingSecret = getSessionSigningSecret(secret, "old-shared-password");
  const token = createAccessSession(signingSecret);
  const changedSigningSecret = getSessionSigningSecret(secret, "new-shared-password");
  assert.equal(isAuthorizedRequest(requestWithCookie(token), changedSigningSecret), false);
});
