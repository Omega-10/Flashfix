import {
  identifyHandler,
  staffLoginHandler,
  verifyOtpHandler,
  sendOtpHandler,
  meHandler,
  logoutHandler,
  googleAuthStartHandler,
  googleAuthCallbackHandler,
} from './_lib/routes/auth.ts';
import {
  getAddressesHandler,
  createAddressHandler,
  deleteAddressHandler,
  updateMeHandler,
} from './_lib/routes/account.ts';
import {
  getStoresHandler,
  getNearbyStoresHandler,
} from './_lib/routes/stores.ts';
import {
  getDashboardHandler,
  getTeamHandler,
  createTeamMemberHandler,
  updateTeamRoleHandler,
  getInventoryHandler,
  upsertInventoryHandler,
  updateInventoryStockHandler,
  deleteInventoryHandler,
  getAdminStoresHandler,
  upsertStoreHandler,
  toggleStoreHandler,
  deleteStoreHandler,
  assignStoreAdminsHandler,
  assignBookingStaffHandler,
  getAdminBookingsHandler,
  getSettingsHandler,
  updateSettingsHandler,
} from './_lib/routes/admin.ts';
import {
  createBookingHandler,
  getMyBookingsHandler,
  getBookingByIdHandler,
  getBookingTrailHandler,
  startPickupHandler,
  sendPickupOtpHandler,
  verifyPickupHandler,
  sendCustodyOtpHandler,
  verifyCustodyHandler,
  completeRepairHandler,
  startReturnHandler,
  deliverBookingHandler,
  updateBookingStatusHandler,
  cancelBookingHandler,
  genericBookingActionHandler,
} from './_lib/routes/bookings.ts';
import { HttpError } from './_lib/authz.ts';

/**
 * Flashfix Serverless API Catch-All Dispatcher
 */
export default async function handler(req: any, res: any) {
  // 1. Set standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Parse canonical pathname
  let pathname = '';
  if (req.query?.route) {
    if (Array.isArray(req.query.route)) {
      pathname = '/' + req.query.route.join('/');
    } else {
      pathname = '/' + req.query.route;
    }
  } else {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      pathname = url.pathname.replace(/^\/api/, '');
    } catch {
      pathname = (req.url || '').replace(/^\/api/, '');
    }
  }

  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // 3. Parse JSON body safely
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body || '{}');
    } catch {
      req.body = {};
    }
  } else if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }

  const method = req.method;

  try {
    // --- Auth Endpoints ---
    if (pathname === '/auth/google' && method === 'GET') return await googleAuthStartHandler(req, res);
    if (pathname === '/auth/google/callback' && method === 'GET') return await googleAuthCallbackHandler(req, res);
    if (pathname === '/auth/identify' && method === 'POST') return await identifyHandler(req, res);
    if ((pathname === '/auth/staff-login' || pathname === '/admin/auth/login') && method === 'POST') return await staffLoginHandler(req, res);
    if (pathname === '/auth/verify-otp' && method === 'POST') return await verifyOtpHandler(req, res);
    if (pathname === '/auth/send-otp' && method === 'POST') return await sendOtpHandler(req, res);
    if (pathname === '/auth/me' && method === 'GET') return await meHandler(req, res);
    if (pathname === '/auth/me' && method === 'PATCH') return await updateMeHandler(req, res);
    if (pathname === '/auth/logout' && method === 'POST') return await logoutHandler(req, res);

    // --- Account Endpoints ---
    if (pathname === '/account/addresses' && method === 'GET') return await getAddressesHandler(req, res);
    if (pathname === '/account/addresses' && method === 'POST') return await createAddressHandler(req, res);
    const deleteAddressMatch = pathname.match(/^\/account\/addresses\/([^\/]+)$/);
    if (deleteAddressMatch && method === 'DELETE') return await deleteAddressHandler(req, res, deleteAddressMatch[1]);

    // --- Stores Endpoints ---
    if ((pathname === '/stores/nearby' || pathname === '/api/stores/nearby') && method === 'GET') return await getNearbyStoresHandler(req, res);
    if (pathname === '/stores' && method === 'GET') return await getStoresHandler(req, res);
    if (pathname === '/admin/stores' && method === 'GET') return await getAdminStoresHandler(req, res);
    if (pathname === '/admin/stores' && method === 'POST') return await upsertStoreHandler(req, res);
    const storeToggleMatch = pathname.match(/^\/admin\/stores\/([^\/]+)\/toggle$/);
    if (storeToggleMatch && (method === 'POST' || method === 'PATCH')) return await toggleStoreHandler(req, res, storeToggleMatch[1]);
    if (pathname === '/admin/stores/toggle' && (method === 'POST' || method === 'PATCH')) return await toggleStoreHandler(req, res, req.body.storeId);
    const storeDeleteMatch = pathname.match(/^\/admin\/stores\/([^\/]+)$/);
    if (storeDeleteMatch && method === 'DELETE') return await deleteStoreHandler(req, res, storeDeleteMatch[1]);
    if (pathname === '/admin/stores/delete' && method === 'POST') return await deleteStoreHandler(req, res, req.body.storeId);
    if (pathname === '/admin/stores/assign-admins' && method === 'POST') return await assignStoreAdminsHandler(req, res);

    // --- Admin Operations ---
    if ((pathname === '/settings' || pathname === '/admin/settings') && method === 'GET') return await getSettingsHandler(req, res);
    if (pathname === '/admin/settings' && (method === 'PUT' || method === 'POST')) return await updateSettingsHandler(req, res);
    if (pathname === '/admin/dashboard' && method === 'GET') return await getDashboardHandler(req, res);
    if (pathname === '/admin/team' && method === 'GET') return await getTeamHandler(req, res);
    if ((pathname === '/admin/team' || pathname === '/admin/team/invite') && method === 'POST') return await createTeamMemberHandler(req, res);
    const teamRoleMatch = pathname.match(/^\/admin\/team\/([^\/]+)\/role$/);
    if (teamRoleMatch && method === 'PATCH') return await updateTeamRoleHandler(req, res, teamRoleMatch[1]);
    if (pathname === '/admin/inventory' && method === 'GET') return await getInventoryHandler(req, res);
    if (pathname === '/admin/inventory' && method === 'POST') return await upsertInventoryHandler(req, res);
    const invStockMatch = pathname.match(/^\/admin\/inventory\/([^\/]+)\/stock$/);
    if (invStockMatch && method === 'PATCH') return await updateInventoryStockHandler(req, res, invStockMatch[1]);
    const invDeleteMatch = pathname.match(/^\/admin\/inventory\/([^\/]+)$/);
    if (invDeleteMatch && method === 'DELETE') return await deleteInventoryHandler(req, res, invDeleteMatch[1]);
    const assignBookingMatch = pathname.match(/^\/admin\/bookings\/([^\/]+)\/assign$/);
    if (assignBookingMatch && method === 'POST') return await assignBookingStaffHandler(req, res, assignBookingMatch[1]);
    if ((pathname === '/admin/bookings' || pathname === '/bookings') && method === 'GET') return await getAdminBookingsHandler(req, res);

    // --- Customer Bookings & Operations ---
    if (pathname === '/bookings' && method === 'POST') return await createBookingHandler(req, res);
    if (pathname === '/bookings/mine' && method === 'GET') return await getMyBookingsHandler(req, res);

    const bookingCancelMatch = pathname.match(/^\/bookings\/([^\/]+)\/cancel$/);
    if (bookingCancelMatch && method === 'POST') return await cancelBookingHandler(req, res, bookingCancelMatch[1]);

    const bookingTrailMatch = pathname.match(/^\/bookings\/([^\/]+)\/trail$/);
    if (bookingTrailMatch && method === 'GET') return await getBookingTrailHandler(req, res, bookingTrailMatch[1]);

    const startPickupMatch = pathname.match(/^\/bookings\/([^\/]+)\/start-pickup$/);
    if (startPickupMatch && method === 'POST') return await startPickupHandler(req, res, startPickupMatch[1]);

    const sendPickupOtpMatch = pathname.match(/^\/bookings\/([^\/]+)\/send-pickup-otp$/);
    if (sendPickupOtpMatch && method === 'POST') return await sendPickupOtpHandler(req, res, sendPickupOtpMatch[1]);

    const verifyPickupMatch = pathname.match(/^\/bookings\/([^\/]+)\/verify-pickup$/);
    if (verifyPickupMatch && method === 'POST') return await verifyPickupHandler(req, res, verifyPickupMatch[1]);

    const sendCustodyOtpMatch = pathname.match(/^\/bookings\/([^\/]+)\/send-custody-otp$/);
    if (sendCustodyOtpMatch && method === 'POST') return await sendCustodyOtpHandler(req, res, sendCustodyOtpMatch[1]);

    const verifyCustodyMatch = pathname.match(/^\/bookings\/([^\/]+)\/verify-custody$/);
    if (verifyCustodyMatch && method === 'POST') return await verifyCustodyHandler(req, res, verifyCustodyMatch[1]);

    const repairCompleteMatch = pathname.match(/^\/bookings\/([^\/]+)\/repair-complete$/);
    if (repairCompleteMatch && method === 'POST') return await completeRepairHandler(req, res, repairCompleteMatch[1]);

    const startReturnMatch = pathname.match(/^\/bookings\/([^\/]+)\/start-return$/);
    if (startReturnMatch && method === 'POST') return await startReturnHandler(req, res, startReturnMatch[1]);

    const deliverMatch = pathname.match(/^\/bookings\/([^\/]+)\/deliver$/);
    if (deliverMatch && method === 'POST') return await deliverBookingHandler(req, res, deliverMatch[1]);

    const statusMatch = pathname.match(/^\/(?:admin\/)?bookings\/([^\/]+)\/status$/);
    if (statusMatch && method === 'PATCH') return await updateBookingStatusHandler(req, res, statusMatch[1]);

    const genericActionMatch = pathname.match(/^\/bookings\/([^\/]+)\/([a-zA-Z0-9_-]+)$/);
    if (genericActionMatch && method === 'POST' && !['status', 'cancel', 'trail'].includes(genericActionMatch[2])) {
      return await genericBookingActionHandler(req, res, genericActionMatch[1], genericActionMatch[2]);
    }

    const singleBookingMatch = pathname.match(/^\/bookings\/([^\/]+)$/);
    if (singleBookingMatch && method === 'GET' && !['mine', 'nearby'].includes(singleBookingMatch[1])) {
      return await getBookingByIdHandler(req, res, singleBookingMatch[1]);
    }

    // Default 404 / ping handler
    return res.status(200).json({
      status: 'ok',
      service: 'flashfix-serverless-api',
      time: new Date().toISOString(),
      route: pathname,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    console.error('Unhandled API Gateway Error:', err);
    return res.status(500).json({ error: { message: err.message || 'Internal server error.' } });
  }
}
