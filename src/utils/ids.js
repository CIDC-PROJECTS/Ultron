const { randomUUID } = require("crypto");

const generatePrefixedId = (prefix) => {
  const chunk = randomUUID().split("-")[0].toUpperCase();
  return `${prefix}-${chunk}`;
};

module.exports = {
  generatePrefixedId,
};
