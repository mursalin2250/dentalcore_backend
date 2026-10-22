import { HTTP_STATUS } from "../constants/httpStatus.js";

export function sendSuccess(res, { status = HTTP_STATUS.OK, data = null, message = "" } = {}) {
  res.status(status).json({ success: true, data, message });
}
