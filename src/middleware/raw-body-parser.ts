import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Simple middleware to capture raw body and parse JSON for webhooks
 */
export const webhookBodyParser = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[Webhook Body Parser] Processing ${req.method} request to ${req.path}`);
  
  let rawBody = '';
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk: string) => {
    rawBody += chunk;
  });

  req.on('end', () => {
    // Store raw body as Buffer for signature verification
    req.rawBody = Buffer.from(rawBody, 'utf8');
    console.log(`[Webhook Body Parser] Captured ${req.rawBody.length} bytes`);
    
    // Parse JSON
    if (rawBody.length > 0) {
      try {
        req.body = JSON.parse(rawBody);
        console.log(`[Webhook Body Parser] Successfully parsed JSON`);
      } catch (error) {
        console.error('[Webhook Body Parser] JSON parsing error:', error);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }
    
    next();
  });

  req.on('error', (error) => {
    console.error('[Webhook Body Parser] Error reading body:', error);
    next(error);
  });
};
