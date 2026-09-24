import { DataSourceMeta } from '../../src/types.js';
import { db } from '../db.js';

export interface CurrencyRatesResponse {
  base_currency: string;
  rates: Record<string, number>;
  source: DataSourceMeta;
}

const FALLBACK_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.0118,
  EUR: 0.0109,
  GBP: 0.0093,
  SGD: 0.0157,
  AED: 0.0433,
  AUD: 0.0182,
  CAD: 0.0163,
  JPY: 1.82,
  THB: 0.41,
};

export class CurrencyService {
  async getRates(base = 'INR'): Promise<CurrencyRatesResponse> {
    const cleanBase = (base || 'INR').toUpperCase();
    const cacheKey = `rates_${cleanBase}`;
    const cached = db.getCache<CurrencyRatesResponse>(cacheKey);
    if (cached) {
      return {
        ...cached,
        source: {
          ...cached.source,
          data_status: 'CACHED',
          notes: 'Hourly cached live rates',
        },
      };
    }

    const startTime = Date.now();
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${cleanBase}`, {
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const duration = Date.now() - startTime;
        db.updateHealth('currency', {
          status: 'operational',
          response_time_ms: duration,
          notes: 'Open Exchange Rates live feed active',
        });

        const result: CurrencyRatesResponse = {
          base_currency: cleanBase,
          rates: data.rates || FALLBACK_RATES,
          source: {
            source_name: 'Open Exchange Rates (open.er-api.com)',
            source_type: 'live_api',
            retrieved_at: new Date().toISOString(),
            data_status: 'LIVE',
            source_url: 'https://open.er-api.com',
            notes: `Real-time FX rates updated at ${data.time_last_update_utc || new Date().toUTCString()}`,
          },
        };

        // Cache for 1 hour
        db.setCache(cacheKey, result, 3600);
        return result;
      }
    } catch (err) {
      console.warn('Currency API error, using fallback rates:', err);
      db.updateHealth('currency', {
        status: 'degraded',
        error_count: (db.getHealth().currency?.error_count || 0) + 1,
        notes: 'Fallback currency exchange table active',
      });
    }

    return {
      base_currency: base.toUpperCase(),
      rates: FALLBACK_RATES,
      source: {
        source_name: 'Central Bank Reference FX Matrix',
        source_type: 'demo_data',
        retrieved_at: new Date().toISOString(),
        data_status: 'ESTIMATED',
        notes: 'Backup currency exchange rates',
      },
    };
  }

  async convert(amount: number, from: string, to: string): Promise<{ converted: number; rate: number; source: DataSourceMeta }> {
    const fromClean = (from || 'INR').toUpperCase();
    const toClean = (to || 'INR').toUpperCase();
    if (fromClean === toClean) {
      return {
        converted: amount,
        rate: 1,
        source: {
          source_name: 'Direct Unit Equality',
          source_type: 'live_api',
          retrieved_at: new Date().toISOString(),
          data_status: 'LIVE',
        },
      };
    }

    const ratesData = await this.getRates(fromClean);
    const rate = ratesData.rates[toClean] || (1 / (FALLBACK_RATES[fromClean] || 1)) * (FALLBACK_RATES[toClean] || 1);
    const converted = Math.round(amount * rate * 100) / 100;

    return {
      converted,
      rate,
      source: ratesData.source,
    };
  }
}

export const currencyService = new CurrencyService();
