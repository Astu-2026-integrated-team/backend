require('dotenv').config();

const thresholds = Object.freeze({
  STALE_THRESHOLD_MINUTES:   parseInt(process.env.STALE_THRESHOLD_MINUTES  || '5', 10),
  OFFLINE_THRESHOLD_MINUTES: parseInt(process.env.OFFLINE_THRESHOLD_MINUTES || '15', 10),
  THEFT_DROP_LITERS:         parseFloat(process.env.THEFT_DROP_LITERS       || '4.0'),
  THEFT_WINDOW_MINUTES:      parseInt(process.env.THEFT_WINDOW_MINUTES      || '5', 10),
  LOW_FUEL_PERCENT:          parseInt(process.env.LOW_FUEL_PERCENT           || '15', 10),
  REFILL_MIN_LITERS:         parseFloat(process.env.REFILL_MIN_LITERS        || '5.0'),
  OVERSPEED_KMH:             parseFloat(process.env.OVERSPEED_KMH            || '80')
});

export default thresholds;
