import * as bookingsService from "../services/bookingsService.js";

export class BookingsController {
  static async list(req, res, next) {
    try {
      const result = await bookingsService.listMyBookings(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, bookings: result.bookings });
    } catch (err) {
      next(err);
    }
  }

  static async listForMentor(req, res, next) {
    try {
      const result = await bookingsService.listMentorBookings(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, bookings: result.bookings });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await bookingsService.createBooking(req.userId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.status(201).json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async confirmForMentor(req, res, next) {
    try {
      const result = await bookingsService.confirmMentorBooking(req.userId, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async completeForMentor(req, res, next) {
    try {
      const result = await bookingsService.completeMentorBooking(req.userId, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async updateNotesForMentor(req, res, next) {
    try {
      const result = await bookingsService.updateMentorNotes(req.userId, req.params.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async reschedule(req, res, next) {
    try {
      const result = await bookingsService.rescheduleMyBooking(req.userId, req.params.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const result = await bookingsService.getMyBooking(req.userId, req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req, res, next) {
    try {
      const result = await bookingsService.cancelMyBooking(req.userId, req.params.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (err) {
      next(err);
    }
  }
}
