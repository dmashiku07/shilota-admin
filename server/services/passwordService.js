const bcrypt = require("bcrypt-nodejs");

function hashPassword(password) {
  return new Promise(function(resolve, reject) {
    bcrypt.genSalt(10, function(saltError, salt) {
      if (saltError) {
        return reject(saltError);
      }

      bcrypt.hash(String(password), salt, null, function(hashError, hash) {
        if (hashError) {
          return reject(hashError);
        }
        resolve(hash);
      });
    });
  });
}

function passwordMatches(password, hash) {
  return new Promise(function(resolve, reject) {
    bcrypt.compare(String(password), String(hash), function(error, matches) {
      if (error) {
        return reject(error);
      }
      resolve(matches);
    });
  });
}

async function replacePassword(model, accountId, newPassword) {
  const passwordHash = await hashPassword(newPassword);
  const result = await model.updateOne(
    {
      _id: accountId,
      deletion_status: { $ne: 1 }
    },
    {
      $set: { password: passwordHash }
    }
  ).exec();

  const matchedCount = Number(
    result && result.matchedCount !== undefined ? result.matchedCount : result && result.n
  );
  if (!matchedCount) {
    throw new Error("Password reset account was not updated");
  }

  const updatedAccount = await model.findById(accountId).select("password").exec();
  if (!updatedAccount || !(await passwordMatches(newPassword, updatedAccount.password))) {
    throw new Error("Password reset verification failed");
  }
}

module.exports = {
  hashPassword,
  passwordMatches,
  replacePassword
};
