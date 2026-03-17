const notFound = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  void req;
  void next;

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
