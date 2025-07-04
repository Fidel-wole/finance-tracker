import { createLogger, format, transports } from "winston";
import path from "path";

const logger = createLogger({
  level: "debug",
  format: format.json(),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(__dirname, "../../logs/app.log"),
      level: "info",
      format: format.combine(format.timestamp(), format.simple()),
    }),
  ],
});

export default logger;