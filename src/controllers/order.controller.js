const { ORDER_STATUSES, PAYMENT_STATUSES } = require("../models/Order");

const { getSupabaseClient } = require("../config/supabase");
const { generatePrefixedId } = require("../utils/ids");

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
    id: generatePrefixedId("ITEM"),
    order_id: orderId,
    menu_id: item.menu_id.trim(),
    quantity: item.quantity,
    price: roundMoney(item.price),
  }));

const computeTotalFromItems = (items) =>
  roundMoney(items.reduce((sum, item) => sum + item.quantity * item.price, 0));

const buildOrderResponse = (order, orderItems) => ({
  ...order,
  order_items: orderItems.map((item) => item),
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
    const supabase = getSupabaseClient();
    const {
      user_id,
      table_id,
      status,
      payment_status,
      total,
      items,
      created_at,
    } = req.body;

    if (!user_id || typeof user_id !== "string") {
      return res
        .status(400)
        .json({ message: "user_id is required and must be a string." });
    }

    if (!table_id || typeof table_id !== "string") {
      return res
        .status(400)
        .json({ message: "table_id is required and must be a string." });
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

    const itemsValidationError = validateItemsPayload(items);
    if (itemsValidationError) {
      return res.status(400).json({ message: itemsValidationError });
    }

    if (total !== undefined && (typeof total !== "number" || total < 0)) {
      return res
        .status(400)
        .json({
          message: "total must be a non-negative number when provided.",
        });
    }

    const computedTotal = computeTotalFromItems(items);
    const finalTotal = total !== undefined ? roundMoney(total) : computedTotal;

    let createdAtValue;
    if (created_at !== undefined) {
      createdAtValue = new Date(created_at);
      if (Number.isNaN(createdAtValue.getTime())) {
        return res
          .status(400)
          .json({ message: "created_at must be a valid date." });
      }
    }

    const orderId = generatePrefixedId("ORD");

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        user_id: user_id.trim(),
        table_id: table_id.trim(),
        status: status || "Pending",
        total: finalTotal,
        payment_status: payment_status || "Pending",
        ...(createdAtValue && { created_at: createdAtValue.toISOString() }),
      })
      .select("*")
      .single();

    if (orderError) {
      throw orderError;
    }

    const itemsPayload = buildOrderItemsDocs(orderId, items);
    const { data: createdItems, error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload)
      .select("*");

    if (itemsError) {
      throw itemsError;
    }

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
    const supabase = getSupabaseClient();
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

    let query = supabase.from("orders").select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (payment_status) query = query.eq("payment_status", payment_status);
    if (user_id) query = query.eq("user_id", user_id);
    if (table_id) query = query.eq("table_id", table_id);

    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: "from must be a valid date." });
      }
      query = query.gte("created_at", fromDate.toISOString());
    }

    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "to must be a valid date." });
      }
      query = query.lte("created_at", toDate.toISOString());
    }

    const safePage = Math.max(1, Math.floor(toNumber(page, DEFAULT_PAGE)));
    const safeLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT))),
    );
    const skip = (safePage - 1) * safeLimit;

    const sortField = sort_by === "total" ? "total" : "created_at";
    const sortDirection = sort_order === "asc" ? 1 : -1;

    const rangeFrom = skip;
    const rangeTo = skip + safeLimit - 1;

    const {
      data: orders,
      count: totalCount,
      error,
    } = await query
      .order(sortField, { ascending: sortDirection === 1 })
      .range(rangeFrom, rangeTo);

    if (error) {
      throw error;
    }

    const orderIds = (orders || []).map((order) => order.id);

    let orderItems = [];

    if (orderIds.length) {
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      if (itemsError) {
        throw itemsError;
      }

      orderItems = itemsData || [];
    }

    const groupedItems = groupItemsByOrderId(orderItems);
    const data = (orders || []).map((order) =>
      buildOrderResponse(order, groupedItems.get(order.id) || []),
    );

    return res.status(200).json({
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / safeLimit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) {
      throw itemsError;
    }

    return res.status(200).json({
      data: buildOrderResponse(order, orderItems),
    });
  } catch (error) {
    return next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { user_id, table_id, status, payment_status, total, items } =
      req.body;

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

    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (
      user_id !== undefined &&
      (typeof user_id !== "string" || !user_id.trim())
    ) {
      return res
        .status(400)
        .json({ message: "user_id must be a non-empty string." });
    }

    if (
      table_id !== undefined &&
      (typeof table_id !== "string" || !table_id.trim())
    ) {
      return res
        .status(400)
        .json({ message: "table_id must be a non-empty string." });
    }

    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    if (
      payment_status !== undefined &&
      !PAYMENT_STATUSES.includes(payment_status)
    ) {
      return res.status(400).json({
        message: `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    if (total !== undefined && (typeof total !== "number" || total < 0)) {
      return res
        .status(400)
        .json({ message: "total must be a non-negative number." });
    }

    if (items !== undefined) {
      const itemsValidationError = validateItemsPayload(items);
      if (itemsValidationError) {
        return res.status(400).json({ message: itemsValidationError });
      }
    }

    const updates = {};
    if (user_id !== undefined) updates.user_id = user_id.trim();
    if (table_id !== undefined) updates.table_id = table_id.trim();
    if (status !== undefined) updates.status = status;
    if (payment_status !== undefined) updates.payment_status = payment_status;

    let responseOrderItems = null;

    if (items !== undefined) {
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", id);

      if (deleteError) {
        throw deleteError;
      }

      const itemsPayload = buildOrderItemsDocs(id, items);
      const { data: insertedItems, error: insertError } = await supabase
        .from("order_items")
        .insert(itemsPayload)
        .select("*");

      if (insertError) {
        throw insertError;
      }

      responseOrderItems = insertedItems;

      const computedTotal = computeTotalFromItems(items);
      updates.total = total !== undefined ? roundMoney(total) : computedTotal;
    } else if (total !== undefined) {
      updates.total = roundMoney(total);
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!responseOrderItems) {
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id);

      if (itemsError) {
        throw itemsError;
      }

      responseOrderItems = orderItems;
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
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status is required and must be one of: ${ORDER_STATUSES.join(", ")}.`,
      });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) {
      throw itemsError;
    }

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
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!payment_status || !PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        message: `payment_status is required and must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
      });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update({ payment_status })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) {
      throw itemsError;
    }

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
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) {
      throw itemsError;
    }

    return res.status(200).json({
      order_id: id,
      order_items: (orderItems || []).map((item) => item),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { count: deletedItemsCount, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", id);

    if (countError) {
      throw countError;
    }

    const { data: deletedOrder, error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.status(200).json({
      message: "Order deleted successfully.",
      deleted_order_id: id,
      deleted_order_items: deletedItemsCount || 0,
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
