import appConfig from "../configs/app";
import { Response } from "express";

export default class Dispatcher {
  static DispatchSuccessMessage(
    res: Response,
    message: string,
    data?: unknown,
  ) {
    return res.status(200).json({
      code: 200,
      status: "OK",
      message: message,
      data,
    });
  }

  static DispatchCustomMessage(
    res: Response,
    message: string,
    statusCode: number,
    status?: string,
    data?: unknown,
  ) {
    return res.status(statusCode).json({
      code: statusCode,
      status,
      message: message,
      data,
    });
  }

  static DispatchErrorMessage(res: Response, errors: string | string[]) {
    const errorMessage = Array.isArray(errors) ? errors.join(", ") : errors;
    return res.status(400).json({
      code: appConfig.error.badRequest.code,
      status: "error",
      message: errorMessage,
    });
  }

  static SendUnAuthorizedMessage(res: Response) {
    return res.status(403).json({
      code: appConfig.error.forbidden.code,
      status: appConfig.error.forbidden.description,
      message: appConfig.error.forbidden.message,
    });
  }

  static DispatchNotFoundMessage(res: Response) {
    return res.status(404).json({
      code: appConfig.error.notFound.code,
      message: appConfig.error.notFound.description,
    });
  }

  static SendNotImplementedError(res: Response) {
    return res.status(501).json({
      code: appConfig.error.notImplemented.code,
      message: appConfig.error.notImplemented.description,
    });
  }

  static SendInvalidTokenError(res: Response) {
    return res.status(401).json({
      code: appConfig.error.invalidToken.code,
      message: appConfig.error.invalidToken.description,
    });
  }
}
