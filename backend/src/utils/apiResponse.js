export function successResponse(res, data = {}, message = 'Operation successful', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data
  });
}

export function errorResponse(res, message = 'An error occurred', statusCode = 500, code = 'ERROR', details = null) {
  return res.status(statusCode).json({
    success: false,
    error: code,
    message,
    details
  });
}

export function paginatedResponse(res, items = [], total = 0, page = 1, limit = 20, extra = {}) {
  const totalPages = Math.ceil(total / limit) || 1;
  return res.status(200).json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    ...extra
  });
}
