const cors = require("cors");
const express = require("express");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const menuRoutes = require("./routes/menu.routes");
const orderRoutes = require("./routes/order.routes");
const settingRoutes = require("./routes/setting.routes");
const tableRoutes = require("./routes/table.routes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ultron-orders-api",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/settings", settingRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
