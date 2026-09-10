const assert = require("node:assert/strict");
const test = require("node:test");

const passwordService = require("../services/passwordService");

test("hashPassword creates a hash accepted by passwordMatches", async function() {
  const password = "NewPassword123";
  const hash = await passwordService.hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await passwordService.passwordMatches(password, hash), true);
  assert.equal(await passwordService.passwordMatches("wrong-password", hash), false);
});

test("replacePassword persists and verifies the new hash", async function() {
  const account = { _id: "account-1", password: "old-hash" };
  const model = {
    updateOne(query, update) {
      assert.deepEqual(query, {
        _id: account._id,
        deletion_status: { $ne: 1 }
      });
      account.password = update.$set.password;
      return { exec: async function() { return { n: 1, nModified: 1 }; } };
    },
    findById(id) {
      assert.equal(id, account._id);
      return {
        select(selection) {
          assert.equal(selection, "password");
          return { exec: async function() { return account; } };
        }
      };
    }
  };

  await passwordService.replacePassword(model, account._id, "Replacement456");

  assert.equal(
    await passwordService.passwordMatches("Replacement456", account.password),
    true
  );
});
