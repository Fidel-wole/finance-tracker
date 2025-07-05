import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Middleware to capture raw body for webhook signature verification
 * This must be applied before any body parsing middleware
 */
export const rawBodyParser = (req: Request, res: Response, next: NextFunction) => {
  // Only capture raw body for POST requests (webhooks)
  if (req.method !== 'POST') {
    return next();
  }

  const chunks: Buffer[] = [];
  
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });

  req.on('error', (error) => {
    console.error('Error reading raw body:', error);
    next(error);
  });
};

/**
 * Middleware factory for specific routes that need raw body
 * @param path - Path pattern to apply raw body parsing to
 */
export const conditionalRawBodyParser = (path: string | RegExp) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const shouldApplyRawParser = typeof path === 'string' 
      ? req.path.includes(path)
      : path.test(req.path);

    if (shouldApplyRawParser) {
      return rawBodyParser(req, res, next);
    }
    
    next();
  };
};

/**
 * Express middleware that parses JSON but preserves raw body
 */
export const jsonWithRawBody = (req: Request, res: Response, next: NextFunction) => {
  // Only parse JSON for POST requests with raw body
  if (req.method === 'POST' && req.rawBody) {
    try {
      req.body = JSON.parse(req.rawBody.toString());
    } catch (error) {
      console.error('JSON parsing error:', error);
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }
  }
  next();
};
