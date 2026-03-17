const { Order, ORDER_STATUSES, PAYMENT_STATUSES } = require("../models/Order");
const { OrderItem } = require("../models/OrderItem");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => Math.round(value * 100) / 100;

const validateItemsPayload = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "items must be a non-empty array.";
  }

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") {
      return `items[${index}] must be an object.`;
    }

    if (!item.menu_id || typeof item.menu_id !== "string") {
      return `items[${index}].menu_id is required and must be a string.`;
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return `items[${index}].quantity must be a positive integer.`;
    }

    if (typeof item.price !== "number" || item.price < 0) {
      return `items[${index}].price must be a non-negative number.`;
    }
  }

  return null;
};

const buildOrderItemsDocs = (orderId, items) =>
  items.map((item) => ({
    order_id: orderId,
    menu_id: item.menu_id.trim(),
    quantity: item.quantity,
    price: roundMoney(item.price),
  }));

const computeTotalFromItems = (items) =>
  roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  );

const buildOrderResponse = (order, orderItems) => ({
  ...order.toJSON(),
  order_items: orderItems.map((item) => item.toJSON()),
});

const groupItemsByOrderId = (items) => {
  const map = new Map();

  for (const item of items) {
    const current = map.get(item.order_id) || [];
    current.push(item);
    map.set(item.order_id, current);
  }

  return map;
};

const createOrder = async (req, res, next) => {
  try {
    const { user_id, table_id, status, payment_status, total, items, created_at } =
      req.body;

    if (!user_id || typeof user_id !== "string") {
      return res.status(400).json({ message: "user_id is required and must be a string." });
    }

    if (!table_id || typeof table_id !== "string") {
      return res.status(400).json({ message: "table_id is required and must be a string." });
    }

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        message: `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    const itemsError = validateItemsPayload(items);
    if (itemsError) {
      return res.status(400).json({ message: itemsError });
    }

    if (total !== undefined && (typeof total !== "number" || total < 0)) {
      return res.status(400).json({ message: "total must be a non-negative number when provided." });
    }

    const computedTotal = computeTotalFromItems(items);
    const finalTotal = total !== undefined ? roundMoney(total) : computedTotal;

    let createdAtValue;
    if (created_at !== undefined) {
      createdAtValue = new Date(created_at);
      if (Number.isNaN(createdAtValue.getTime())) {
        return res.status(400).json({ message: "created_at must be a valid date." });
      }
    }

    const order = await Order.create({
      user_id: user_id.trim(),
      table_id: table_id.trim(),
      status: status || "Pending",
      total: finalTotal,
      payment_status: payment_status || "Pending",
      ...(createdAtValue && { created_at: createdAtValue }),
    });

    const createdItems = await OrderItem.insertMany(
      buildOrderItemsDocs(order.id, items)
    );

    return res.status(201).json({
      message: "Order created successfully.",
      data: buildOrderResponse(order, createdItems),
    });
  } catch (error) {
    return next(error);
  }
};

const listOrders = async (req, res, next) => {
  try {
    const {
      status,
      payment_status,
      user_id,
      table_id,
      from,
      to,
      page,
      limit,
      sort_by,
      sort_order,
    } = req.query;

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        message: `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (payment_status) filters.payment_status = payment_status;
    if (user_id) filters.user_id = user_id;
    if (table_id) filters.table_id = table_id;

    if (from || to) {
      filters.created_at = {};

      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ message: "from must be a valid date." });
        }
        filters.created_at.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ message: "to must be a valid date." });
        }
        filters.created_at.$lte = toDate;
      }
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT)))
    );
    const skip = (safePage - 1) * safeLimit;

    const sortField = sort_by === "total" ? "total" : "created_at";
    const sortDirection = sort_order === "asc" ? 1 : -1;

    const [orders, totalCount] = await Promise.all([
      Order.find(filters)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(safeLimit),
      Order.countDocuments(filters),
    ]);

    const orderIds = orders.map((order) => order.id);
    const orderItems = orderIds.length
      ? await OrderItem.find({ order_id: { $in: orderIds } })
      : [];

    const groupedItems = groupItemsByOrderId(orderItems);
    const data = orders.map((order) =>
      buildOrderResponse(order, groupedItems.get(order.id) || [])
    );

    return res.status(200).json({
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const orderItems = await OrderItem.find({ order_id: id });

    return res.status(200).json({
      data: buildOrderResponse(order, orderItems),
    });
  } catch (error) {
    return next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, table_id, status, payment_status, total, items } = req.body;

    const hasUpdatableField =
      user_id !== undefined ||
      table_id !== undefined ||
      status !== undefined ||
      payment_status !== undefined ||
      total !== undefined ||
      items !== undefined;

    if (!hasUpdatableField) {
      return res.status(400).json({
        message:
          "At least one of user_id, table_id, status, payment_status, total, or items must be provided.",
      });
    }

    const existingOrder = await Order.findOne({ id });
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (user_id !== undefined && (typeof user_id !== "string" || !user_id.trim())) {
      return res.status(400).json({ message: "user_id must be a non-empty string." });
    }

    if (table_id !== undefined && (typeof table_id !== "string" || !table_id.trim())) {
      return res.status(400).json({ message: "table_id must be a non-empty string." });
    }

    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    if (payment_status !== undefined && !PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        message: `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    if (total !== undefined && (typeof total !== "number" || total < 0)) {
      return res.status(400).json({ message: "total must be a non-negative number." });
    }

    if (items !== undefined) {
      const itemsError = validateItemsPayload(items);
      if (itemsError) {
        return res.status(400).json({ message: itemsError });
      }
    }

    const updates = {};
    if (user_id !== undefined) updates.user_id = user_id.trim();
    if (table_id !== undefined) updates.table_id = table_id.trim();
    if (status !== undefined) updates.status = status;
    if (payment_status !== undefined) updates.payment_status = payment_status;

    let responseOrderItems = null;

    if (items !== undefined) {
      await OrderItem.deleteMany({ order_id: id });
      responseOrderItems = await OrderItem.insertMany(buildOrderItemsDocs(id, items));

      const computedTotal = computeTotalFromItems(items);
      updates.total = total !== undefined ? roundMoney(total) : computedTotal;
    } else if (total !== undefined) {
      updates.total = roundMoney(total);
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!responseOrderItems) {
      responseOrderItems = await OrderItem.find({ order_id: id });
    }

    return res.status(200).json({
      message: "Order updated successfully.",
      data: buildOrderResponse(updatedOrder, responseOrderItems),
    });
  } catch (error) {
    return next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status is required and must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    const order = await Order.findOneAndUpdate(
      { id },
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const orderItems = await OrderItem.find({ order_id: id });

    return res.status(200).json({
      message: "Order status updated successfully.",
      data: buildOrderResponse(order, orderItems),
    });
  } catch (error) {
    return next(error);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!payment_status || !PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        message: `payment_status is required and must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    const order = await Order.findOneAndUpdate(
      { id },
      { $set: { payment_status } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const orderItems = await OrderItem.find({ order_id: id });

    return res.status(200).json({
      message: "Payment status updated successfully.",
      data: buildOrderResponse(order, orderItems),
    });
  } catch (error) {
    return next(error);
  }
};

const getOrderItems = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ id });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const orderItems = await OrderItem.find({ order_id: id });

    return res.status(200).json({
      order_id: id,
      order_items: orderItems.map((item) => item.toJSON()),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findOneAndDelete({ id });
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    const deletedItems = await OrderItem.deleteMany({ order_id: id });

    return res.status(200).json({
      message: "Order deleted successfully.",
      deleted_order_id: id,
      deleted_order_items: deletedItems.deletedCount,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderItems,
  deleteOrder,
};
