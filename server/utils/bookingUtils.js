function isProviderRole(role) {
    return role === "VIDEOGRAPHER" || role === "PHOTOGRAPHER";
  }
  
  function safeInt(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  
  /**
   * Логика смены статуса бронирования 
   * Возвращает новый статус или null если действие запрещен.
   */
  function resolveNextBookingStatus(currentStatus, action, isClient, isProvider) {
    let nextStatus = currentStatus;
  
    if (action === "confirm" && isProvider) nextStatus = "confirmed";
    else if (action === "decline" && isProvider) nextStatus = "declined";
    else if (action === "cancel" && isClient) nextStatus = "canceled";
    else if (action === "done" && isProvider) nextStatus = "done";
    else return null;
  
    return nextStatus;
  }
  
  module.exports = { isProviderRole, safeInt, resolveNextBookingStatus };
  