export default {
  apiV1URL: "/v1",
  constants: {
    SALT_ROUNDS: 10,
  },
  error: {
    dataBaseError: {
      code: 100,
      description:
        "A database error has occurred. Contact your system administrator.",
    },
    unauthorized: {
      code: 403,
      description: "Unauthorized",
    },
    badRequest: {
      code: 400,
      description: "Bad Request",
    },
    notFound: {
      code: 404,
      description: "Not Found",
    },
    forbidden: {
      code: 403,
      description: "Forbidden",
      message: "Unauthorised access",
    },
    internalServerError: {
      code: 500,
      description:
        "We encountered a problem while processing your request. Please try again. If problem persist please contact our support",
    },
    invalidToken: {
      code: 401,
      description: "Invalid or Expired Token",
    },
    notImplemented: {
      code: 501,
      description: "Not Implemented",
    },
    unprocessableEntity: {
      code: 422,
      description: "Unprocessable Entity",
    },
    fileError: {
      write: {
        code: 409,
        description: "Error Occurred While Writing To File",
      },
      read: {
        code: 409,
        description: "Error Occurred While Reading File",
      },
    },
  },
};
